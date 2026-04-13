import { Router } from "express";
import multer from "multer";
import { db, operatorContractsTable } from "@workspace/db";
import { adminUsersTable, tenantsTable } from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { objectStorageClient } from "../lib/objectStorage";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";

// ── GET /contracts — fetch tenant's active operator contract ─────────────────
router.get("/contracts", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const [contract] = await db
      .select()
      .from(operatorContractsTable)
      .where(and(
        eq(operatorContractsTable.tenantId, req.tenantId),
        eq(operatorContractsTable.isActive, true),
      ))
      .limit(1);
    res.json(contract ?? null);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch contract" });
  }
});

// ── GET /contracts/history — all versions for this tenant ────────────────────
router.get("/contracts/history", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const rows = await db
      .select()
      .from(operatorContractsTable)
      .where(eq(operatorContractsTable.tenantId, req.tenantId))
      .orderBy(desc(operatorContractsTable.version))
      .limit(25);
    res.json(rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch contract history" });
  }
});

// ── GET /contracts/active/pdf — stream the uploaded PDF for viewing ──────────
// Accepts auth via x-admin-token header OR ?token= query param (for browser new-tab)
router.get("/contracts/active/pdf", async (req, res) => {
  try {
    // Resolve tenant from token (header or query param)
    const token = (req as any).cookies?.admin_session
      ?? (req.headers["x-admin-token"] as string | undefined)
      ?? (req.query.token as string | undefined);

    let tenantId = req.tenantId;
    if (!tenantId && token) {
      // Try staff user
      const [u] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.token, token)).limit(1);
      if (u?.tenantId) { tenantId = u.tenantId; }
      else {
        const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.adminToken, token)).limit(1);
        if (t) tenantId = t.id;
      }
    }
    if (!tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const [contract] = await db
      .select()
      .from(operatorContractsTable)
      .where(and(
        eq(operatorContractsTable.tenantId, tenantId),
        eq(operatorContractsTable.isActive, true),
      ))
      .limit(1);

    if (!contract || contract.contractType !== "uploaded_pdf" || !contract.uploadedPdfStorageKey) {
      res.status(404).json({ error: "No uploaded PDF contract found" }); return;
    }

    const key = contract.uploadedPdfStorageKey;
    const filename = contract.uploadedFileName ?? "contract.pdf";

    // Try object storage first
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
      } catch (storageErr) {
        req.log.warn(storageErr, "Object storage read failed, trying local fallback");
      }
    }

    // Local fallback — key is just a filename
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
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to serve PDF" });
  }
});

// ── GET /contracts/:id/pdf — stream a specific version PDF ──────────────────
router.get("/contracts/:id/pdf", async (req, res) => {
  try {
    const token = (req as any).cookies?.admin_session
      ?? (req.headers["x-admin-token"] as string | undefined)
      ?? (req.query.token as string | undefined);

    let tenantId = req.tenantId;
    if (!tenantId && token) {
      const [u] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.token, token)).limit(1);
      if (u?.tenantId) { tenantId = u.tenantId; }
      else {
        const [t] = await db.select().from(tenantsTable).where(eq(tenantsTable.adminToken, token)).limit(1);
        if (t) tenantId = t.id;
      }
    }
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
      res.status(404).json({ error: "No PDF for this contract version" }); return;
    }

    const key = contract.uploadedPdfStorageKey;
    const filename = contract.uploadedFileName ?? "contract.pdf";

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
      } catch { /* fall through to local */ }
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
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to serve PDF" });
  }
});

// ── POST /contracts — create or fully replace the tenant's active contract ───
router.post("/contracts", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const { title, content, checkboxLabel, includeOutdoorShareAgreements } = req.body ?? {};
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "title is required" }); return;
    }

    const [current] = await db
      .select({ version: operatorContractsTable.version })
      .from(operatorContractsTable)
      .where(and(
        eq(operatorContractsTable.tenantId, req.tenantId),
        eq(operatorContractsTable.isActive, true),
      ))
      .limit(1);

    const nextVersion = (current?.version ?? 0) + 1;

    await db
      .update(operatorContractsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(operatorContractsTable.tenantId, req.tenantId),
        eq(operatorContractsTable.isActive, true),
      ));

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
        version: nextVersion,
        isActive: true,
      })
      .returning();

    res.status(201).json(inserted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to save contract" });
  }
});

// ── POST /contracts/upload-pdf — upload a PDF file as the operator's contract ─
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

    const { title, checkboxLabel, includeOutdoorShareAgreements } = req.body ?? {};
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

    const [current] = await db
      .select({ version: operatorContractsTable.version })
      .from(operatorContractsTable)
      .where(and(eq(operatorContractsTable.tenantId, req.tenantId), eq(operatorContractsTable.isActive, true)))
      .limit(1);
    const nextVersion = (current?.version ?? 0) + 1;

    await db.update(operatorContractsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(operatorContractsTable.tenantId, req.tenantId), eq(operatorContractsTable.isActive, true)));

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
      version:                     nextVersion,
      isActive:                    true,
    }).returning();

    res.status(201).json(inserted);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to upload contract PDF" });
  }
});

// ── PATCH /contracts/:id/activate — restore a previous version ───────────────
router.patch("/contracts/:id/activate", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const contractId = Number(req.params.id);

    const [target] = await db
      .select()
      .from(operatorContractsTable)
      .where(and(
        eq(operatorContractsTable.id, contractId),
        eq(operatorContractsTable.tenantId, req.tenantId),
      ))
      .limit(1);

    if (!target) { res.status(404).json({ error: "Contract version not found" }); return; }

    // Deactivate all current versions
    await db.update(operatorContractsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(operatorContractsTable.tenantId, req.tenantId));

    // Activate the target
    const [updated] = await db.update(operatorContractsTable)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(operatorContractsTable.id, contractId))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to activate contract version" });
  }
});

// ── DELETE /contracts/active — deactivate (clear) the active contract ────────
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
    res.status(500).json({ error: "Failed to delete contract" });
  }
});

export default router;
