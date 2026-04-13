import app from "./app";
import { logger } from "./lib/logger";
import { seedOwnerAccount, seedDemoTenant } from "./routes/superadmin";
import { startScheduler } from "./services/scheduler";
import { validateStripeEnv } from "./services/stripe";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Validate Stripe configuration at startup — logs warnings for missing optional vars
try {
  validateStripeEnv();
} catch (e: any) {
  logger.error(e.message, "Stripe env validation failed — check your environment variables");
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  seedOwnerAccount().catch(e => logger.error(e, "seedOwnerAccount failed"));
  seedDemoTenant().catch(e => logger.error(e, "seedDemoTenant failed"));
  startScheduler();
});
