import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  productsTable, listingsTable, tenantsTable, businessProfileTable,
  categoriesTable, superadminUsersTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import * as XLSX from "xlsx";
import { google } from "googleapis";

const router: IRouter = Router();

// ── Superadmin auth guard ─────────────────────────────────────────────────────
async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-superadmin-token"] as string | undefined;
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select().from(superadminUsersTable)
    .where(eq(superadminUsersTable.token, token)).limit(1);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

// ── Gmail access token ────────────────────────────────────────────────────────
let _connCache: any = null;

async function getGmailAccessToken(): Promise<string> {
  if (
    _connCache?.settings?.expires_at &&
    new Date(_connCache.settings.expires_at).getTime() > Date.now() + 30_000
  ) {
    return _connCache.settings.access_token;
  }
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;
  if (!xReplitToken) throw new Error("Replit identity token not found");
  const data = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=google-mail`,
    { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } }
  ).then(r => r.json());
  _connCache = data.items?.[0];
  const token =
    _connCache?.settings?.access_token ||
    _connCache?.settings?.oauth?.credentials?.access_token;
  if (!token) throw new Error("Gmail not connected");
  return token;
}

// ── Excel builder ─────────────────────────────────────────────────────────────
async function buildExcelBuffer(): Promise<Buffer> {
  const [products, listings, tenants, profiles, cats] = await Promise.all([
    db.select().from(productsTable).orderBy(desc(productsTable.createdAt)),
    db.select().from(listingsTable).orderBy(desc(listingsTable.createdAt)),
    db.select({ id: tenantsTable.id, name: tenantsTable.name, slug: tenantsTable.slug, plan: tenantsTable.plan }).from(tenantsTable),
    db.select({ tenantId: businessProfileTable.tenantId, companyName: businessProfileTable.name }).from(businessProfileTable),
    db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable),
  ]);

  const tenantMap = new Map(tenants.map(t => [t.id, t]));
  const profileMap = new Map(profiles.map(p => [p.tenantId, p.companyName]));
  const catMap = new Map(cats.map(c => [c.id, c.name]));

  const inventoryRows = products.map(p => ({
    "Tenant Slug":         tenantMap.get(p.tenantId)?.slug ?? "",
    "Company Name":        profileMap.get(p.tenantId) ?? tenantMap.get(p.tenantId)?.name ?? "",
    "Plan":                tenantMap.get(p.tenantId)?.plan ?? "",
    "Product ID":          p.id,
    "Name":                p.name,
    "SKU":                 p.sku ?? "",
    "Category":            catMap.get(p.categoryId ?? 0) ?? "",
    "Status":              p.status,
    "Qty":                 p.quantity ?? 1,
    "Brand":               p.brand ?? "",
    "Model":               p.model ?? "",
    "Year":                p.year ?? "",
    "Serial Number":       p.serialNumber ?? "",
    "Estimated Value ($)": p.estimatedValue != null ? Number(p.estimatedValue) : "",
    "Next Maintenance":    p.nextMaintenanceDate ?? "",
    "Service Until":       p.serviceUntil ?? "",
    "Specs":               p.specs ?? "",
    "Notes":               p.notes ?? "",
    "Created At":          p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "",
  }));

  const listingRows = listings.map(l => ({
    "Tenant Slug":          tenantMap.get(l.tenantId)?.slug ?? "",
    "Company Name":         profileMap.get(l.tenantId) ?? tenantMap.get(l.tenantId)?.name ?? "",
    "Plan":                 tenantMap.get(l.tenantId)?.plan ?? "",
    "Listing ID":           l.id,
    "Title":                l.title,
    "Category":             catMap.get(l.categoryId ?? 0) ?? "",
    "Status":               l.status,
    "Qty":                  l.quantity ?? 1,
    "Price / Day ($)":      l.pricePerDay != null ? Number(l.pricePerDay) : "",
    "Price / Week ($)":     l.pricePerWeek != null ? Number(l.pricePerWeek) : "",
    "Price / Hour ($)":     l.pricePerHour != null ? Number(l.pricePerHour) : "",
    "Deposit ($)":          l.depositAmount != null ? Number(l.depositAmount) : "",
    "Weekend Price ($)":    l.weekendPrice != null ? Number(l.weekendPrice) : "",
    "Half Day Enabled":     l.halfDayEnabled ? "Yes" : "No",
    "Half Day Rate ($)":    l.halfDayRate != null ? Number(l.halfDayRate) : "",
    "Hourly Enabled":       l.hourlyEnabled ? "Yes" : "No",
    "Brand":                l.brand ?? "",
    "Model":                l.model ?? "",
    "Condition":            l.condition ?? "",
    "Location":             l.location ?? "",
    "Weight":               l.weight ?? "",
    "Age Restriction":      l.ageRestriction ?? "",
    "ID Verification":      l.requireIdentityVerification ? "Yes" : "No",
    "Linked Product ID":    l.productId ?? "",
    "Created At":           l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(inventoryRows.length ? inventoryRows : [{ Note: "No inventory items found" }]),
    "Inventory"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(listingRows.length ? listingRows : [{ Note: "No listings found" }]),
    "Listings"
  );

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ── Download route ────────────────────────────────────────────────────────────
router.get("/superadmin/export/inventory", requireSuperAdmin as any, async (req, res) => {
  try {
    const buf = await buildExcelBuffer();
    const today = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="outdoorshare-export-${today}.xlsx"`);
    res.setHeader("Content-Length", buf.length);
    res.send(buf);
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: err.message ?? "Export failed" });
  }
});

// ── Email route ───────────────────────────────────────────────────────────────
router.post("/superadmin/export/inventory/email", requireSuperAdmin as any, async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "A valid email address is required." });
    return;
  }

  try {
    const buf = await buildExcelBuffer();
    const today = new Date().toISOString().split("T")[0];
    const filename = `outdoorshare-export-${today}.xlsx`;
    const boundary = `os_export_${Date.now()}`;
    const attachB64 = buf.toString("base64");

    const htmlBody = `
<html><body style="font-family:sans-serif;color:#1e293b;max-width:600px;">
  <p>Hi,</p>
  <p>Please find attached the OutdoorShare platform export: <strong>${filename}</strong></p>
  <p>This workbook contains two sheets:</p>
  <ul>
    <li><strong>Inventory</strong> — all products across every company</li>
    <li><strong>Listings</strong> — all rental listings across every company</li>
  </ul>
  <p style="margin-top:24px;color:#64748b;font-size:12px;">
    Generated ${new Date().toUTCString()} · OutdoorShare Super Admin Console
  </p>
</body></html>`;

    const subjectEncoded = `=?UTF-8?B?${Buffer.from(`OutdoorShare Platform Export – ${today}`, "utf8").toString("base64")}?=`;

    const mimeLines = [
      `From: OutdoorShare <samhos@myoutdoorshare.com>`,
      `To: ${email}`,
      `Subject: ${subjectEncoded}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      htmlBody,
      `--${boundary}`,
      `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${filename}"`,
      ``,
      (attachB64.match(/.{1,76}/g) ?? []).join("\r\n"),
      `--${boundary}--`,
    ];

    const raw = Buffer.from(mimeLines.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const accessToken = await getGmailAccessToken();
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });
    await gmail.users.messages.send({ userId: "me", requestBody: { raw } });

    res.json({ ok: true, message: `Export sent to ${email}` });
  } catch (err: any) {
    req.log.error(err);
    res.status(500).json({ error: err.message ?? "Failed to send export email" });
  }
});

export default router;
