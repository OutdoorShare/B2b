import { Router } from "express";
import multer from "multer";
import { db, operatorContractsTable } from "@workspace/db";
import { adminUsersTable, tenantsTable, platformAgreementsTable, operatorAcknowledgementsTable } from "@workspace/db/schema";
import { eq, and, desc, asc, or, isNull } from "drizzle-orm";
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

// ── GET /contracts/resolve — public: resolve the correct contract for a listing ──
// Used by checkout to get the exact operator contract a renter must sign.
// Resolution order: listing-specific contract → global default → null.
// No auth required — contracts are not personally sensitive (they are rental terms).
router.get("/contracts/resolve", async (req, res) => {
  try {
    const { tenantSlug, listingId } = req.query;
    if (!tenantSlug || !listingId) {
      res.status(400).json({ error: "tenantSlug and listingId are required" }); return;
    }
    const listingIdNum = Number(listingId);
    if (isNaN(listingIdNum) || listingIdNum <= 0) {
      res.status(400).json({ error: "Invalid listingId" }); return;
    }

    const [tenant] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, tenantSlug as string))
      .limit(1);

    if (!tenant) {
      res.json({ operatorContract: null }); return;
    }

    const activeContracts = await db
      .select({
        id: operatorContractsTable.id,
        title: operatorContractsTable.title,
        checkboxLabel: operatorContractsTable.checkboxLabel,
        version: operatorContractsTable.version,
        contractType: operatorContractsTable.contractType,
        content: operatorContractsTable.content,
        uploadedPdfStorageKey: operatorContractsTable.uploadedPdfStorageKey,
        uploadedFileName: operatorContractsTable.uploadedFileName,
        listingIds: operatorContractsTable.listingIds,
        includeOutdoorShareAgreements: operatorContractsTable.includeOutdoorShareAgreements,
      })
      .from(operatorContractsTable)
      .where(and(
        eq(operatorContractsTable.tenantId, tenant.id),
        eq(operatorContractsTable.isActive, true),
      ))
      .orderBy(desc(operatorContractsTable.updatedAt));

    // Resolution priority: listing-specific → global default (empty listingIds)
    const contract =
      activeContracts.find(c => (c.listingIds as number[] ?? []).includes(listingIdNum)) ??
      activeContracts.find(c => !(c.listingIds as number[] ?? []).length) ??
      null;

    res.json({
      operatorContract: contract
        ? {
            id: contract.id,
            title: contract.title,
            checkboxLabel: contract.checkboxLabel,
            version: contract.version,
            contractType: contract.contractType ?? "template",
            content: contract.contractType !== "uploaded_pdf" ? (contract.content ?? "") : null,
            hasPdf: contract.contractType === "uploaded_pdf" && !!contract.uploadedPdfStorageKey,
            uploadedFileName: contract.uploadedFileName ?? null,
            includeOutdoorShareAgreements: contract.includeOutdoorShareAgreements,
          }
        : null,
    });
  } catch (err) {
    console.error("[contracts/resolve]", err);
    res.status(500).json({ error: "Failed to resolve contract" });
  }
});

// ── GET /contracts/public-pdf/:id — stream an active contract PDF (public, for checkout preview) ──
// Only serves PDFs for active contracts. No personal data is exposed.
router.get("/contracts/public-pdf/:id", async (req, res) => {
  try {
    const { tenantSlug } = req.query;
    const contractId = Number(req.params.id);
    if (isNaN(contractId) || !tenantSlug) {
      res.status(400).json({ error: "contractId and tenantSlug required" }); return;
    }

    const [tenant] = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.slug, tenantSlug as string))
      .limit(1);
    if (!tenant) { res.status(404).json({ error: "Tenant not found" }); return; }

    const [contract] = await db
      .select()
      .from(operatorContractsTable)
      .where(and(
        eq(operatorContractsTable.id, contractId),
        eq(operatorContractsTable.tenantId, tenant.id),
        eq(operatorContractsTable.isActive, true),
      ))
      .limit(1);

    if (!contract || contract.contractType !== "uploaded_pdf" || !contract.uploadedPdfStorageKey) {
      res.status(404).json({ error: "No PDF found" }); return;
    }
    await streamPdf(res, req, contract.uploadedPdfStorageKey, contract.uploadedFileName ?? "rental-agreement.pdf");
  } catch (err) {
    console.error("[contracts/public-pdf]", err);
    res.status(500).json({ error: "Failed to serve PDF" });
  }
});

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

// ─────────────────────────────────────────────────────────────────────────────
// ACKNOWLEDGEMENT CHECKBOXES
// ─────────────────────────────────────────────────────────────────────────────

// GET /contracts/acknowledgements?tenantSlug=X&contractId=Y
// Public — used by checkout to get the acknowledgements a renter must check.
// Returns acknowledgements for the specific contract + global (null contractId) ones.
router.get("/contracts/acknowledgements", async (req, res) => {
  try {
    const { tenantSlug, contractId } = req.query as Record<string, string>;
    if (!tenantSlug) return res.status(400).json({ error: "tenantSlug required" });
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.slug, tenantSlug)).limit(1);
    if (!tenant) return res.status(404).json({ error: "Tenant not found" });

    const cid = contractId ? parseInt(contractId, 10) : null;
    const rows = await db
      .select()
      .from(operatorAcknowledgementsTable)
      .where(
        and(
          eq(operatorAcknowledgementsTable.tenantId, tenant.id),
          eq(operatorAcknowledgementsTable.isActive, true),
          cid != null
            ? or(isNull(operatorAcknowledgementsTable.contractId), eq(operatorAcknowledgementsTable.contractId, cid))
            : isNull(operatorAcknowledgementsTable.contractId)
        )
      )
      .orderBy(asc(operatorAcknowledgementsTable.sortOrder), asc(operatorAcknowledgementsTable.id));

    res.json(rows);
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Failed to fetch acknowledgements" });
  }
});

// GET /contracts/acknowledgements/admin?contractId=Y
// Admin — list all acknowledgements for a tenant (optional contractId filter)
router.get("/contracts/acknowledgements/admin", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const { contractId } = req.query as Record<string, string>;

    const conditions: any[] = [eq(operatorAcknowledgementsTable.tenantId, tenantId)];
    if (contractId) {
      const cid = parseInt(contractId, 10);
      conditions.push(
        or(isNull(operatorAcknowledgementsTable.contractId), eq(operatorAcknowledgementsTable.contractId, cid))
      );
    }

    const rows = await db
      .select()
      .from(operatorAcknowledgementsTable)
      .where(and(...conditions))
      .orderBy(asc(operatorAcknowledgementsTable.sortOrder), asc(operatorAcknowledgementsTable.id));
    res.json(rows);
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Failed to fetch acknowledgements" });
  }
});

// POST /contracts/acknowledgements
// Admin — create an acknowledgement
router.post("/contracts/acknowledgements", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const { text, required, sortOrder, contractId } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "text required" });

    const [row] = await db.insert(operatorAcknowledgementsTable).values({
      tenantId,
      contractId: contractId ? Number(contractId) : null,
      text: text.trim(),
      required: required !== false,
      sortOrder: sortOrder ?? 0,
      isActive: true,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Failed to create acknowledgement" });
  }
});

// PATCH /contracts/acknowledgements/:id
// Admin — update an acknowledgement
router.patch("/contracts/acknowledgements/:id", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const id = parseInt(req.params.id, 10);
    const { text, required, sortOrder, isActive, contractId } = req.body;

    const [existing] = await db.select().from(operatorAcknowledgementsTable)
      .where(and(eq(operatorAcknowledgementsTable.id, id), eq(operatorAcknowledgementsTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });

    const updates: Partial<typeof existing> = { updatedAt: new Date() };
    if (text !== undefined) updates.text = text.trim();
    if (required !== undefined) updates.required = required;
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (isActive !== undefined) updates.isActive = isActive;
    if (contractId !== undefined) updates.contractId = contractId ? Number(contractId) : null;

    const [updated] = await db.update(operatorAcknowledgementsTable)
      .set(updates).where(eq(operatorAcknowledgementsTable.id, id)).returning();
    res.json(updated);
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Failed to update acknowledgement" });
  }
});

// DELETE /contracts/acknowledgements/:id
// Admin — delete an acknowledgement
router.delete("/contracts/acknowledgements/:id", async (req, res) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(operatorAcknowledgementsTable)
      .where(and(eq(operatorAcknowledgementsTable.id, id), eq(operatorAcknowledgementsTable.tenantId, tenantId)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });
    await db.delete(operatorAcknowledgementsTable).where(eq(operatorAcknowledgementsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Failed to delete acknowledgement" });
  }
});

export default router;
