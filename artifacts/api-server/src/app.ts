import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "path";
import router from "./routes";
import uploadRouter from "./routes/upload";
import stripeRouter from "./routes/stripe";
import billingRouter from "./routes/billing";
import promoCodesRouter from "./routes/promo-codes";
import listingRulesRouter from "./routes/listing-rules";
import protectionPlansRouter from "./routes/superadmin-protection";
import productsRouter from "./routes/products";
import docsRouter from "./routes/docs";
import developerRouter from "./routes/superadmin-developer";
import superadminExportRouter from "./routes/superadmin-export";
import marketplaceRouter from "./routes/marketplace";
import hostRouter from "./routes/host";
import memoriesRouter from "./routes/memories";
import activitiesRouter from "./routes/activities";
import { logger } from "./lib/logger";
import { resolveTenant } from "./middleware/admin-auth";
import { errorLoggerMiddleware, captureUnhandledErrors } from "./middleware/error-logger";

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

const app: Express = express();

// Security headers — must be first so every response is covered
app.use(
  helmet({
    // CSP is not meaningful on a JSON API but harmless; disable to avoid
    // interfering with any proxied HTML responses (e.g. Stripe redirect pages)
    contentSecurityPolicy: false,
    // Allow cross-origin resource loading — needed for the Replit proxy / iframe preview
    crossOriginEmbedderPolicy: false,
    // Keep nosniff, frameguard (DENY), HSTS, referrerPolicy, etc. at defaults
  })
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/.*\.replit\.dev$/,
  /^https?:\/\/.*\.replit\.app$/,
  /^https?:\/\/.*\.myoutdoorshare\.com$/,
];

// Extra origins from env (space-separated), e.g. ALLOWED_ORIGINS="https://custom.com"
const extraOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(" ")
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, cb) {
      // Allow server-to-server / same-origin requests (no Origin header)
      if (!origin) return cb(null, true);
      if (extraOrigins.includes(origin)) return cb(null, true);
      if (ALLOWED_ORIGIN_PATTERNS.some(re => re.test(origin))) return cb(null, true);
      cb(new Error(`CORS: origin not allowed — ${origin}`));
    },
    credentials: true,
  })
);

// Stripe + billing webhooks need raw body for signature verification — must be before express.json()
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsDir));
app.use("/api/uploads", express.static(uploadsDir));

captureUnhandledErrors();

app.use("/api/admin/auth", authRateLimit);
app.use("/api/customers/login", authRateLimit);
app.use("/api/customers/register", authRateLimit);
app.use("/api/superadmin/auth", authRateLimit);
app.use("/api/ai/chat", aiRateLimit);

app.use("/api", resolveTenant as any);
app.use("/api", errorLoggerMiddleware);
app.use("/api", developerRouter);
app.use("/api", superadminExportRouter);
app.use("/api", uploadRouter);
app.use("/api", stripeRouter);
app.use("/api", billingRouter);
app.use("/api", promoCodesRouter);
app.use("/api", listingRulesRouter);
app.use("/api", protectionPlansRouter);
app.use("/api", productsRouter);
app.use("/api", docsRouter);
app.use("/api", marketplaceRouter);
app.use("/api", hostRouter);
app.use("/api", memoriesRouter);
app.use("/api", activitiesRouter);
app.use("/api", router);

export default app;
