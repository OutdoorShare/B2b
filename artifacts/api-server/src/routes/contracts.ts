import { Router } from "express";
import { db, operatorContractsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

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
