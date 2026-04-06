import express, { type Express } from "express";
import cors from "cors";
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
import marketplaceRouter from "./routes/marketplace";
import hostRouter from "./routes/host";
import { logger } from "./lib/logger";
import { resolveTenant } from "./middleware/admin-auth";
import { errorLoggerMiddleware, captureUnhandledErrors } from "./middleware/error-logger";

const app: Express = express();

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
app.use(cors());

// Stripe + billing webhooks need raw body for signature verification — must be before express.json()
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsDir));
app.use("/api/uploads", express.static(uploadsDir));

captureUnhandledErrors();

app.use("/api", resolveTenant as any);
app.use("/api", errorLoggerMiddleware);
app.use("/api", developerRouter);
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
app.use("/api", router);

export default app;
