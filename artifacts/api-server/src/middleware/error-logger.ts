import { type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { platformErrorLogsTable } from "@workspace/db";

const SKIP_PATHS = new Set([
  "/api/superadmin/developer/errors",
  "/api/superadmin/developer/health",
  "/api/superadmin/developer/metrics",
  "/api/superadmin/developer/system",
  "/api/superadmin/developer/tenant-health",
]);

export function errorLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const status = res.statusCode;
    if (status < 400) return;
    if (SKIP_PATHS.has(req.path)) return;

    const responseTimeMs = Date.now() - start;
    const level = status >= 500 ? "error" : "warn";

    const tenantSlug =
      (req as any).tenant?.slug ??
      req.headers["x-tenant-slug"] as string ??
      undefined;

    const bodySnippet = req.body && typeof req.body === "object"
      ? JSON.stringify(req.body).slice(0, 500)
      : undefined;

    db.insert(platformErrorLogsTable).values({
      level,
      method: req.method,
      path: req.path,
      statusCode: status,
      message: `${req.method} ${req.path} → ${status}`,
      tenantSlug: tenantSlug ?? null,
      userAgent: (req.headers["user-agent"] ?? "").slice(0, 200),
      ip: (req.headers["x-forwarded-for"] as string ?? req.socket.remoteAddress ?? "").slice(0, 50),
      responseTimeMs,
      body: bodySnippet ?? null,
    }).catch(() => {});
  });

  next();
}

export function captureUnhandledErrors() {
  process.on("uncaughtException", (err) => {
    db.insert(platformErrorLogsTable).values({
      level: "error",
      method: null,
      path: null,
      statusCode: null,
      message: err.message?.slice(0, 500) ?? "Uncaught exception",
      stack: err.stack?.slice(0, 2000),
      tenantSlug: null,
      userAgent: null,
      ip: null,
      responseTimeMs: null,
      body: null,
    }).catch(() => {});
  });

  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error
      ? reason.message
      : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    db.insert(platformErrorLogsTable).values({
      level: "error",
      method: null,
      path: null,
      statusCode: null,
      message: `Unhandled rejection: ${msg?.slice(0, 500)}`,
      stack: stack?.slice(0, 2000) ?? null,
      tenantSlug: null,
      userAgent: null,
      ip: null,
      responseTimeMs: null,
      body: null,
    }).catch(() => {});
  });
}
