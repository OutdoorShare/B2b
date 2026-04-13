import { Router } from "express";
import multer from "multer";
import { db, operatorContractsTable } from "@workspace/db";
import { adminUsersTable, tenantsTable, platformAgreementsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";

// ── Auth helper ───────────────────────────────────────────────────────────────
async function resolveTenantId(req: any): Promise<number | null> {
  if (req.tenantId) return req.tenantId;
  const token = req.cookies?.admin_session
    ?? (req.headers["x-admin-token"] as string | undefined)
    ?? (req.query.token as string | undefined);
  if (!token) return null;
  const [u] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.token, token)).limit(1);
  if (u?.tenantId) return u.tenantId;
  const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.adminToken, token)).limit(1);
  return t?.id ?? null;
}

// ── Helper: stream a PDF from storage/disk ────────────────────────────────────
async function streamPdf(res: any, req: any, key: string, filename: string) {
  if (BUCKET_ID) {
    try {
      const bucket = objectStorageClient.bucket(BUCKET_ID);
      const file = bucket.file(key);
      const [exists] = await file.exists();
      if (exists) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
        res.setHeader("Cache-Control", "private, no-cache");
        file.createReadStream().pipe(res);
        return;
      }
    } catch (err) {
      req.log?.warn(err, "Object storage read failed, trying local fallback");
    }
  }
  const fs  = await import("fs");
  const pth = await import("path");
  const localPath = pth.resolve(process.cwd(), "uploads", key);
  if (!fs.existsSync(localPath)) {
    res.status(404).json({ error: "PDF file not found in storage" }); return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.setHeader("Cache-Control", "private, no-cache");
  fs.createReadStream(localPath).pipe(res);
}

// ── GET /contracts — all templates for this tenant ───────────────────────────
router.get("/contracts", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const rows = await db
      .select()
      .from(operatorContractsTable)
      .where(eq(operatorContractsTable.tenantId, req.tenantId))
      .orderBy(desc(operatorContractsTable.updatedAt));
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch contracts" });
  }
});

// ── GET /contracts/platform-agreements — active OutdoorShare documents for admin preview ──
router.get("/contracts/platform-agreements", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const rows = await db
      .select({
        id:           platformAgreementsTable.id,
        title:        platformAgreementsTable.title,
        content:      platformAgreementsTable.content,
        checkboxLabel: platformAgreementsTable.checkboxLabel,
        isRequired:   platformAgreementsTable.isRequired,
        sortOrder:    platformAgreementsTable.sortOrder,
        version:      platformAgreementsTable.version,
      })
      .from(platformAgreementsTable)
      .where(and(eq(platformAgreementsTable.isActive, true), eq(platformAgreementsTable.isRequired, true)))
      .orderBy(platformAgreementsTable.sortOrder);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch platform agreements" });
  }
});

// ── GET /contracts/active/pdf — stream the active uploaded PDF for admin viewing ──
router.get("/contracts/active/pdf", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [contract] = await db
      .select()
      .from(operatorContractsTable)
      .where(and(
        eq(operatorContractsTable.tenantId, tenantId),
        eq(operatorContractsTable.isActive, true),
      ))
      .orderBy(desc(operatorContractsTable.updatedAt))
      .limit(1);

    if (!contract || contract.contractType !== "uploaded_pdf" || !contract.uploadedPdfStorageKey) {
      res.status(404).json({ error: "No uploaded PDF contract found" }); return;
    }
    await streamPdf(res, req, contract.uploadedPdfStorageKey, contract.uploadedFileName ?? "contract.pdf");
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to serve PDF" });
  }
});

// ── GET /contracts/:id/pdf — stream a specific contract's PDF ────────────────
router.get("/contracts/:id/pdf", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const contractId = Number(req.params.id);
    const [contract] = await db
      .select()
      .from(operatorContractsTable)
      .where(and(
        eq(operatorContractsTable.id, contractId),
        eq(operatorContractsTable.tenantId, tenantId),
      ))
      .limit(1);

    if (!contract || contract.contractType !== "uploaded_pdf" || !contract.uploadedPdfStorageKey) {
      res.status(404).json({ error: "No PDF for this contract" }); return;
    }
    await streamPdf(res, req, contract.uploadedPdfStorageKey, contract.uploadedFileName ?? "contract.pdf");
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to serve PDF" });
  }
});

// ── POST /contracts — create a new template ──────────────────────────────────
// Does NOT deactivate existing templates — multiple can be active.
router.post("/contracts", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const { title, content, checkboxLabel, includeOutdoorShareAgreements, listingIds } = req.body ?? {};
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "title is required" }); return;
    }

    const [inserted] = await db
      .insert(operatorContractsTable)
      .values({
        tenantId: req.tenantId,
        title:    title.trim(),
        content:  typeof content === "string" ? content : "",
        checkboxLabel: typeof checkboxLabel === "string" && checkboxLabel.trim()
          ? checkboxLabel.trim()
          : "I agree to the rental terms and conditions",
        includeOutdoorShareAgreements: includeOutdoorShareAgreements !== false,
        listingIds: Array.isArray(listingIds) ? listingIds : [],
        version: 1,
        isActive: true,
      })
      .returning();

    res.status(201).json(inserted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to create contract" });
  }
});

// ── PATCH /contracts/:id — edit a template in-place ─────────────────────────
router.patch("/contracts/:id", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const contractId = Number(req.params.id);
    const { title, content, checkboxLabel, includeOutdoorShareAgreements, listingIds } = req.body ?? {};

    const updateFields: Record<string, any> = { updatedAt: new Date() };
    if (typeof title === "string" && title.trim()) updateFields.title = title.trim();
    if (typeof content === "string") updateFields.content = content;
    if (typeof checkboxLabel === "string" && checkboxLabel.trim()) updateFields.checkboxLabel = checkboxLabel.trim();
    if (typeof includeOutdoorShareAgreements === "boolean") updateFields.includeOutdoorShareAgreements = includeOutdoorShareAgreements;
    if (Array.isArray(listingIds)) updateFields.listingIds = listingIds;

    // Bump version on content edits
    if ("content" in updateFields || "title" in updateFields) {
      const [cur] = await db.select({ version: operatorContractsTable.version })
        .from(operatorContractsTable)
        .where(and(eq(operatorContractsTable.id, contractId), eq(operatorContractsTable.tenantId, req.tenantId)))
        .limit(1);
      if (cur) updateFields.version = (cur.version ?? 0) + 1;
    }

    const [updated] = await db
      .update(operatorContractsTable)
      .set(updateFields)
      .where(and(
        eq(operatorContractsTable.id, contractId),
        eq(operatorContractsTable.tenantId, req.tenantId),
      ))
      .returning();

    if (!updated) { res.status(404).json({ error: "Contract not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update contract" });
  }
});

// ── PATCH /contracts/:id/activate — set this template active ─────────────────
router.patch("/contracts/:id/activate", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const contractId = Number(req.params.id);

    const [updated] = await db
      .update(operatorContractsTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(and(
        eq(operatorContractsTable.id, contractId),
        eq(operatorContractsTable.tenantId, req.tenantId),
      ))
      .returning();

    if (!updated) { res.status(404).json({ error: "Contract not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to activate contract" });
  }
});

// ── PATCH /contracts/:id/deactivate — set this template inactive ──────────────
router.patch("/contracts/:id/deactivate", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const contractId = Number(req.params.id);

    const [updated] = await db
      .update(operatorContractsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(operatorContractsTable.id, contractId),
        eq(operatorContractsTable.tenantId, req.tenantId),
      ))
      .returning();

    if (!updated) { res.status(404).json({ error: "Contract not found" }); return; }
    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to deactivate contract" });
  }
});

// ── DELETE /contracts/:id — permanently delete a template ────────────────────
router.delete("/contracts/:id", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const contractId = Number(req.params.id);

    if (isNaN(contractId) || contractId <= 0) {
      res.status(400).json({ error: "Invalid contract ID" }); return;
    }

    await db
      .delete(operatorContractsTable)
      .where(and(
        eq(operatorContractsTable.id, contractId),
        eq(operatorContractsTable.tenantId, req.tenantId),
      ));

    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete contract" });
  }
});

// ── DELETE /contracts/active — backward-compat: deactivate the most-recent active ──
router.delete("/contracts/active", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    await db
      .update(operatorContractsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(operatorContractsTable.tenantId, req.tenantId),
        eq(operatorContractsTable.isActive, true),
      ));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to deactivate contract" });
  }
});

// ── POST /contracts/upload-pdf — upload a PDF as a new template ──────────────
router.post("/contracts/upload-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!file) { res.status(400).json({ error: "No file provided" }); return; }
    if (file.mimetype !== "application/pdf") {
      res.status(400).json({ error: "Only PDF files are accepted" }); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      res.status(400).json({ error: "File exceeds 20 MB limit" }); return;
    }

    const { title, checkboxLabel, includeOutdoorShareAgreements, listingIds } = req.body ?? {};
    const { randomBytes } = await import("crypto");
    const storageKey = `contracts/${req.tenantId}/pdf-${randomBytes(8).toString("hex")}.pdf`;
    const originalName = file.originalname || "rental-agreement.pdf";

    let savedKey = storageKey;
    if (BUCKET_ID) {
      try {
        const bucket = objectStorageClient.bucket(BUCKET_ID);
        await bucket.file(storageKey).save(file.buffer, { contentType: "application/pdf" });
      } catch (storageErr) {
        req.log.error(storageErr, "Object storage upload failed, saving locally");
        const fs  = await import("fs");
        const pth = await import("path");
        const dir = pth.resolve(process.cwd(), "uploads");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const fname = `contract-${req.tenantId}-${randomBytes(6).toString("hex")}.pdf`;
        await fs.promises.writeFile(pth.join(dir, fname), file.buffer);
        savedKey = fname;
      }
    } else {
      const fs  = await import("fs");
      const pth = await import("path");
      const dir = pth.resolve(process.cwd(), "uploads");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const fname = `contract-${req.tenantId}-${randomBytes(6).toString("hex")}.pdf`;
      await fs.promises.writeFile(pth.join(dir, fname), file.buffer);
      savedKey = fname;
    }

    let parsedListingIds: number[] = [];
    try { parsedListingIds = JSON.parse(listingIds ?? "[]"); } catch { /* ignore */ }

    const [inserted] = await db.insert(operatorContractsTable).values({
      tenantId:                    req.tenantId,
      title:                       typeof title === "string" && title.trim() ? title.trim() : "Rental Agreement",
      contractType:                "uploaded_pdf",
      content:                     "",
      uploadedPdfStorageKey:       savedKey,
      uploadedFileName:            originalName,
      uploadedFileSizeBytes:       file.size,
      checkboxLabel:               typeof checkboxLabel === "string" && checkboxLabel.trim()
                                     ? checkboxLabel.trim()
                                     : "I have read and agree to the attached rental agreement",
      includeOutdoorShareAgreements: includeOutdoorShareAgreements !== "false" && includeOutdoorShareAgreements !== false,
      listingIds:                  Array.isArray(parsedListingIds) ? parsedListingIds : [],
      version:                     1,
      isActive:                    true,
    }).returning();

    res.status(201).json(inserted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to upload contract PDF" });
  }
});

export default router;
