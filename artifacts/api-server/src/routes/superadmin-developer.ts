import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import {
  platformErrorLogsTable,
  tenantsTable,
  listingsTable,
  bookingsTable,
  superadminUsersTable,
  businessProfileTable,
  docArticlesTable,
  docCategoriesTable,
} from "@workspace/db";
import { eq, desc, sql, and, gte, lt, count, isNull } from "drizzle-orm";
import os from "os";
import v8 from "v8";

const router = Router();

// ── Auth (reuse superadmin token) ─────────────────────────────────────────────
async function requireSA(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-superadmin-token"] as string | undefined;
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select().from(superadminUsersTable)
    .where(eq(superadminUsersTable.token, token)).limit(1);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  next();
}

// ── Health Checks ─────────────────────────────────────────────────────────────
router.get("/superadmin/developer/health", requireSA, async (req, res) => {
  const checks: {
    name: string;
    status: "ok" | "warn" | "error";
    message: string;
    responseMs?: number;
  }[] = [];

  // 1. Database connectivity
  try {
    const t = Date.now();
    await db.execute(sql`SELECT 1`);
    checks.push({ name: "Database", status: "ok", message: "Connected", responseMs: Date.now() - t });
  } catch (e: any) {
    checks.push({ name: "Database", status: "error", message: e.message ?? "Connection failed" });
  }

  // 2. Tenants table readable
  try {
    const t = Date.now();
    const [r] = await db.select({ count: sql<number>`count(*)` }).from(tenantsTable);
    checks.push({ name: "Tenants Table", status: "ok", message: `${r.count} tenants`, responseMs: Date.now() - t });
  } catch (e: any) {
    checks.push({ name: "Tenants Table", status: "error", message: e.message });
  }

  // 3. Bookings table readable
  try {
    const t = Date.now();
    const [r] = await db.select({ count: sql<number>`count(*)` }).from(bookingsTable);
    checks.push({ name: "Bookings Table", status: "ok", message: `${r.count} bookings`, responseMs: Date.now() - t });
  } catch (e: any) {
    checks.push({ name: "Bookings Table", status: "error", message: e.message });
  }

  // 4. Listings table readable
  try {
    const t = Date.now();
    const [r] = await db.select({ count: sql<number>`count(*)` }).from(listingsTable);
    checks.push({ name: "Listings Table", status: "ok", message: `${r.count} listings`, responseMs: Date.now() - t });
  } catch (e: any) {
    checks.push({ name: "Listings Table", status: "error", message: e.message });
  }

  // 5. Docs tables readable
  try {
    const t = Date.now();
    const [r] = await db.select({ count: sql<number>`count(*)` }).from(docArticlesTable);
    checks.push({ name: "Docs Tables", status: "ok", message: `${r.count} articles`, responseMs: Date.now() - t });
  } catch (e: any) {
    checks.push({ name: "Docs Tables", status: "error", message: e.message });
  }

  // 6. Error log table readable
  try {
    const t = Date.now();
    const [r] = await db.select({ count: sql<number>`count(*)` }).from(platformErrorLogsTable);
    checks.push({ name: "Error Log Table", status: "ok", message: `${r.count} entries`, responseMs: Date.now() - t });
  } catch (e: any) {
    checks.push({ name: "Error Log Table", status: "error", message: e.message });
  }

  // 7. Recent error rate
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [r] = await db.select({ count: sql<number>`count(*)` })
      .from(platformErrorLogsTable)
      .where(and(
        gte(platformErrorLogsTable.createdAt, oneHourAgo),
        eq(platformErrorLogsTable.level, "error")
      ));
    const errCount = Number(r.count);
    checks.push({
      name: "Error Rate (1h)",
      status: errCount === 0 ? "ok" : errCount < 10 ? "warn" : "error",
      message: `${errCount} server errors in the last hour`,
    });
  } catch (e: any) {
    checks.push({ name: "Error Rate (1h)", status: "warn", message: "Could not check" });
  }

  // 8. Memory usage — compare against the actual V8 heap limit, not heapTotal
  // (heapTotal is the current allocation, not the ceiling; heapSizeLimit is the real cap)
  const usedMem = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  const heapUsedMB = Math.round(usedMem.heapUsed / 1024 / 1024);
  const heapLimitMB = Math.round(heapStats.heap_size_limit / 1024 / 1024);
  const heapTotalMB = Math.round(usedMem.heapTotal / 1024 / 1024);
  const heapPct = Math.round((usedMem.heapUsed / heapStats.heap_size_limit) * 100);
  checks.push({
    name: "Memory (Heap)",
    status: heapPct < 75 ? "ok" : heapPct < 90 ? "warn" : "error",
    message: `${heapUsedMB}MB used / ${heapLimitMB}MB limit (${heapPct}%) · allocated ${heapTotalMB}MB`,
  });

  // 9. Active tenants with no listings
  try {
    const tenants = await db.select({ id: tenantsTable.id, slug: tenantsTable.slug })
      .from(tenantsTable)
      .where(eq(tenantsTable.status, "active"));

    let emptyCount = 0;
    for (const t of tenants) {
      const [{ c }] = await db.select({ c: sql<number>`count(*)` })
        .from(listingsTable).where(eq(listingsTable.tenantId, t.id));
      if (Number(c) === 0) emptyCount++;
    }
    checks.push({
      name: "Tenant Listings",
      status: emptyCount === 0 ? "ok" : "warn",
      message: emptyCount === 0
        ? "All active tenants have listings"
        : `${emptyCount} active tenant(s) have no listings`,
    });
  } catch (e: any) {
    checks.push({ name: "Tenant Listings", status: "warn", message: "Could not check" });
  }

  // 10. Tenants without Stripe
  try {
    const [r] = await db.select({ count: sql<number>`count(*)` })
      .from(tenantsTable)
      .where(and(eq(tenantsTable.status, "active"), isNull(tenantsTable.stripeAccountId)));
    const c = Number(r.count);
    checks.push({
      name: "Stripe Connect",
      status: c === 0 ? "ok" : "warn",
      message: c === 0
        ? "All active tenants have Stripe connected"
        : `${c} active tenant(s) missing Stripe Connect`,
    });
  } catch (e: any) {
    checks.push({ name: "Stripe Connect", status: "warn", message: "Could not check" });
  }

  const overallStatus = checks.some(c => c.status === "error")
    ? "error"
    : checks.some(c => c.status === "warn")
      ? "warn"
      : "ok";

  res.json({ overallStatus, checkedAt: new Date().toISOString(), checks });
});

// ── Error Logs ────────────────────────────────────────────────────────────────
router.get("/superadmin/developer/errors", requireSA, async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const level = req.query.level as string | undefined;
  const path = req.query.path as string | undefined;

  const conditions: any[] = [];
  if (level) conditions.push(eq(platformErrorLogsTable.level, level));
  if (path) conditions.push(eq(platformErrorLogsTable.path, path));

  const logs = await db.select().from(platformErrorLogsTable)
    .where(conditions.length ? (conditions.length === 1 ? conditions[0] : and(...conditions)) : undefined)
    .orderBy(desc(platformErrorLogsTable.createdAt))
    .limit(limit);

  const [{ total }] = await db.select({ total: sql<number>`count(*)` }).from(platformErrorLogsTable);

  res.json({ total: Number(total), logs });
});

router.delete("/superadmin/developer/errors", requireSA, async (_req, res) => {
  await db.delete(platformErrorLogsTable);
  res.json({ cleared: true });
});

// ── Request Metrics ───────────────────────────────────────────────────────────
router.get("/superadmin/developer/metrics", requireSA, async (_req, res) => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [errorsLastHour] = await db.select({ count: sql<number>`count(*)` })
    .from(platformErrorLogsTable)
    .where(and(gte(platformErrorLogsTable.createdAt, oneHourAgo), eq(platformErrorLogsTable.level, "error")));

  const [warnsLastHour] = await db.select({ count: sql<number>`count(*)` })
    .from(platformErrorLogsTable)
    .where(and(gte(platformErrorLogsTable.createdAt, oneHourAgo), eq(platformErrorLogsTable.level, "warn")));

  const [errorsLastDay] = await db.select({ count: sql<number>`count(*)` })
    .from(platformErrorLogsTable)
    .where(and(gte(platformErrorLogsTable.createdAt, oneDayAgo), eq(platformErrorLogsTable.level, "error")));

  const avgResponseTime = await db.select({ avg: sql<number>`avg(response_time_ms)` })
    .from(platformErrorLogsTable)
    .where(gte(platformErrorLogsTable.createdAt, oneHourAgo));

  const topErrors = await db
    .select({
      path: platformErrorLogsTable.path,
      statusCode: platformErrorLogsTable.statusCode,
      count: sql<number>`count(*)`,
    })
    .from(platformErrorLogsTable)
    .where(gte(platformErrorLogsTable.createdAt, oneDayAgo))
    .groupBy(platformErrorLogsTable.path, platformErrorLogsTable.statusCode)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  res.json({
    errorsLastHour: Number(errorsLastHour.count),
    warnsLastHour: Number(warnsLastHour.count),
    errorsLastDay: Number(errorsLastDay.count),
    avgResponseMs: avgResponseTime[0]?.avg ? Math.round(Number(avgResponseTime[0].avg)) : null,
    topErrors,
  });
});

// ── Tenant Health Audit ───────────────────────────────────────────────────────
router.get("/superadmin/developer/tenant-health", requireSA, async (_req, res) => {
  const tenants = await db.select().from(tenantsTable).orderBy(tenantsTable.name);

  const results = await Promise.all(tenants.map(async (t) => {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Stripe check
    if (!t.stripeAccountId) {
      issues.push("No Stripe Connect account");
    } else if (t.stripeAccountStatus === "restricted") {
      issues.push("Stripe account is restricted");
    } else if (!t.stripeChargesEnabled) {
      warnings.push("Stripe charges not yet enabled");
    }

    // Listings check
    const [{ listingCount }] = await db
      .select({ listingCount: sql<number>`count(*)` })
      .from(listingsTable)
      .where(eq(listingsTable.tenantId, t.id));

    if (Number(listingCount) === 0) {
      issues.push("No listings created");
    }

    // Business profile check
    const [bp] = await db.select().from(businessProfileTable)
      .where(eq(businessProfileTable.tenantId, t.id)).limit(1);
    if (!bp?.logoUrl) warnings.push("No logo uploaded");
    if (!bp?.phone) warnings.push("No phone number set");

    // Trial expiry
    if (t.trialEndsAt && new Date(t.trialEndsAt) < new Date()) {
      issues.push("Trial period expired");
    }

    // Suspended tenant
    if (t.status === "suspended") {
      issues.push("Account suspended");
    }

    // No bookings ever
    const [{ bookingCount }] = await db
      .select({ bookingCount: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(eq(bookingsTable.tenantId, t.id));

    const health = issues.length === 0 ? (warnings.length === 0 ? "ok" : "warn") : "error";

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      plan: t.plan,
      status: t.status,
      health,
      issues,
      warnings,
      listingCount: Number(listingCount),
      bookingCount: Number(bookingCount),
      stripeConnected: !!t.stripeAccountId,
      stripeStatus: t.stripeAccountStatus ?? null,
      createdAt: t.createdAt.toISOString(),
    };
  }));

  const summary = {
    total: results.length,
    healthy: results.filter(r => r.health === "ok").length,
    warnings: results.filter(r => r.health === "warn").length,
    errors: results.filter(r => r.health === "error").length,
  };

  res.json({ summary, tenants: results });
});

// ── System Stats ──────────────────────────────────────────────────────────────
router.get("/superadmin/developer/system", requireSA, async (_req, res) => {
  const mem = process.memoryUsage();
  const heapStats = v8.getHeapStatistics();
  const cpuLoad = os.loadavg();
  const uptime = process.uptime();

  // Table row counts
  const tables = [
    { name: "tenants", table: tenantsTable },
    { name: "listings", table: listingsTable },
    { name: "bookings", table: bookingsTable },
    { name: "doc_articles", table: docArticlesTable },
    { name: "doc_categories", table: docCategoriesTable },
    { name: "error_logs", table: platformErrorLogsTable },
  ];

  const tableCounts: Record<string, number> = {};
  for (const t of tables) {
    try {
      const [{ c }] = await db.select({ c: sql<number>`count(*)` }).from(t.table as any);
      tableCounts[t.name] = Number(c);
    } catch {
      tableCounts[t.name] = -1;
    }
  }

  // Recent bookings (activity signal)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [recentBookings] = await db.select({ count: sql<number>`count(*)` })
    .from(bookingsTable)
    .where(gte(bookingsTable.createdAt, sevenDaysAgo));

  res.json({
    server: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.round(uptime),
      pid: process.pid,
    },
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      heapLimitMB: Math.round(heapStats.heap_size_limit / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
      externalMB: Math.round(mem.external / 1024 / 1024),
      heapPercent: Math.round((mem.heapUsed / heapStats.heap_size_limit) * 100),
    },
    os: {
      hostname: os.hostname(),
      totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
      freeMemMB: Math.round(os.freemem() / 1024 / 1024),
      cpuLoad1m: cpuLoad[0].toFixed(2),
      cpuLoad5m: cpuLoad[1].toFixed(2),
      cpuCores: os.cpus().length,
    },
    database: {
      tableCounts,
    },
    activity: {
      bookingsLast7Days: Number(recentBookings.count),
    },
    checkedAt: new Date().toISOString(),
  });
});

// ── Cancel test / demo bookings for a tenant ─────────────────────────────────
// Useful for resetting test-mode tenants without touching production data.
// Cancels all non-cancelled bookings where the tenant is in testMode.
router.post("/superadmin/developer/cancel-test-bookings", requireSA, async (req, res) => {
  const { tenantId, listingId } = req.body ?? {};

  const conditions: any[] = [
    sql`${bookingsTable.status} NOT IN ('cancelled', 'rejected')`,
  ];

  if (tenantId) {
    conditions.push(eq(bookingsTable.tenantId, Number(tenantId)));
  } else {
    // Only affect test-mode tenants when no specific tenantId given
    const testTenants = await db
      .select({ id: tenantsTable.id })
      .from(tenantsTable)
      .where(eq(tenantsTable.testMode, true));
    const testTenantIds = testTenants.map(t => t.id);
    if (testTenantIds.length === 0) {
      res.json({ cancelled: 0, message: "No test-mode tenants found." });
      return;
    }
    conditions.push(sql`${bookingsTable.tenantId} = ANY(ARRAY[${sql.join(testTenantIds.map(id => sql`${id}`), sql`, `)}]::int[])`);
  }

  if (listingId) {
    conditions.push(eq(bookingsTable.listingId, Number(listingId)));
  }

  const result = await db
    .update(bookingsTable)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(...conditions));

  res.json({ cancelled: (result as any).rowCount ?? "done", message: "Test bookings cancelled." });
});

export default router;
