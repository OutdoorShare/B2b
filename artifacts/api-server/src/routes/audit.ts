import { Router } from "express";
import { sendAuditRequestEmail } from "../services/gmail";

const router = Router();

router.post("/api/audit", async (req, res) => {
  const {
    name,
    email,
    phone,
    businessName,
    website,
    equipmentTypes,
    monthlyBookings,
    annualRevenue,
    painPoints,
    currentSoftware,
    message,
  } = req.body as {
    name?: string;
    email?: string;
    phone?: string;
    businessName?: string;
    website?: string;
    equipmentTypes?: string[];
    monthlyBookings?: string;
    annualRevenue?: string;
    painPoints?: string[];
    currentSoftware?: string;
    message?: string;
  };

  if (!name || !email || !businessName) {
    return res.status(400).json({ error: "Name, email, and business name are required." });
  }

  try {
    await sendAuditRequestEmail({
      name,
      email,
      phone,
      businessName,
      website,
      equipmentTypes,
      monthlyBookings,
      annualRevenue,
      painPoints,
      currentSoftware,
      message,
    });
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Audit email error:", err?.message ?? err);
    return res.status(500).json({ error: "Failed to submit audit request. Please try again." });
  }
});

export default router;
