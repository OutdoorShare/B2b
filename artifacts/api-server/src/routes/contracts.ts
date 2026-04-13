import { Router } from "express";
import multer from "multer";
import { db, operatorContractsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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

// ── POST /contracts — create or fully replace the tenant's active contract ───
// Deactivates any previous active contract first, then inserts a new one.
router.post("/contracts", async (req, res) => {
  try {
    if (!req.tenantId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const { title, content, checkboxLabel, includeOutdoorShareAgreements } = req.body ?? {};
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "title is required" }); return;
    }

    // Fetch the current version (to increment)
    const [current] = await db
      .select({ version: operatorContractsTable.version })
      .from(operatorContractsTable)
      .where(and(
        eq(operatorContractsTable.tenantId, req.tenantId),
        eq(operatorContractsTable.isActive, true),
      ))
      .limit(1);

    const nextVersion = (current?.version ?? 0) + 1;

    // Deactivate existing
    await db
      .update(operatorContractsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(operatorContractsTable.tenantId, req.tenantId),
        eq(operatorContractsTable.isActive, true),
      ));

    // Insert new version
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

    const { title, checkboxLabel, includeOutdoorShareAgreements } = req.body ?? {};
    const { randomBytes } = await import("crypto");
    const storageKey = `contracts/${req.tenantId}/pdf-${randomBytes(8).toString("hex")}.pdf`;

    // Upload to object storage (or fall back to local)
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

    // Fetch current version
    const [current] = await db
      .select({ version: operatorContractsTable.version })
      .from(operatorContractsTable)
      .where(and(eq(operatorContractsTable.tenantId, req.tenantId), eq(operatorContractsTable.isActive, true)))
      .limit(1);
    const nextVersion = (current?.version ?? 0) + 1;

    // Deactivate existing
    await db.update(operatorContractsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(operatorContractsTable.tenantId, req.tenantId), eq(operatorContractsTable.isActive, true)));

    // Insert new uploaded-PDF contract
    const [inserted] = await db.insert(operatorContractsTable).values({
      tenantId:                    req.tenantId,
      title:                       typeof title === "string" && title.trim() ? title.trim() : "Rental Agreement",
      contractType:                "uploaded_pdf",
      content:                     "",
      uploadedPdfStorageKey:       savedKey,
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
