import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { customersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const router: IRouter = Router();

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const supplied = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(hashBuffer, supplied);
}

function safeCustomer(c: typeof customersTable.$inferSelect) {
  const { passwordHash: _, ...safe } = c;
  return {
    ...safe,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.post("/customers/register", async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: "email, password and name are required" });
      return;
    }

    const [existing] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.email, email.toLowerCase().trim()));

    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const [customer] = await db
      .insert(customersTable)
      .values({ email: email.toLowerCase().trim(), passwordHash, name, phone })
      .returning();

    res.status(201).json(safeCustomer(customer));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to register" });
  }
});

router.post("/customers/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.email, email.toLowerCase().trim()));

    if (!customer) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(password, customer.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    res.json(safeCustomer(customer));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to login" });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.id, Number(req.params.id)));

    if (!customer) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(safeCustomer(customer));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

router.put("/customers/:id", async (req, res) => {
  try {
    const { name, phone, billingAddress, billingCity, billingState, billingZip, cardLastFour, cardBrand } = req.body;
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (billingAddress !== undefined) updateData.billingAddress = billingAddress;
    if (billingCity !== undefined) updateData.billingCity = billingCity;
    if (billingState !== undefined) updateData.billingState = billingState;
    if (billingZip !== undefined) updateData.billingZip = billingZip;
    if (cardLastFour !== undefined) updateData.cardLastFour = cardLastFour;
    if (cardBrand !== undefined) updateData.cardBrand = cardBrand;

    const [updated] = await db
      .update(customersTable)
      .set(updateData)
      .where(eq(customersTable.id, Number(req.params.id)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Not found" }); return; }

    res.json(safeCustomer(updated));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to update customer" });
  }
});

export default router;
