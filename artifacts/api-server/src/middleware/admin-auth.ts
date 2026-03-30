import { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { adminUsersTable, tenantsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      tenantId?: number;
      adminUser?: { id: number; role: string; tenantId: number | null };
    }
  }
}

export async function resolveTenant(req: Request, _res: Response, next: NextFunction) {
  const adminToken = req.headers["x-admin-token"] as string | undefined;
  const tenantSlug = req.headers["x-tenant-slug"] as string | undefined;

  try {
    if (adminToken) {
      // Try staff token
      const [user] = await db
        .select()
        .from(adminUsersTable)
        .where(eq(adminUsersTable.token, adminToken))
        .limit(1);

      if (user && user.tenantId) {
        req.tenantId = user.tenantId;
        req.adminUser = { id: user.id, role: user.role, tenantId: user.tenantId };
        return next();
      }

      // Try tenant owner token
      const [tenant] = await db
        .select()
        .from(tenantsTable)
        .where(eq(tenantsTable.adminToken, adminToken))
        .limit(1);

      if (tenant) {
        req.tenantId = tenant.id;
        return next();
      }
    }

    if (tenantSlug) {
      const [tenant] = await db
        .select()
        .from(tenantsTable)
        .where(eq(tenantsTable.slug, tenantSlug))
        .limit(1);

      if (tenant) {
        req.tenantId = tenant.id;
        return next();
      }
    }

    next();
  } catch {
    next();
  }
}

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
