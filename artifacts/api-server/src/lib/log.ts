const ENV = process.env.NODE_ENV ?? "development";

export type LogFields = {
  bookingId?: number | string | null;
  listingId?: number | string | null;
  tenantId?: number | string | null;
  customerId?: number | string | null;
  stripeId?: string | null;
  action?: string | null;
  result?: string | null;
  email?: string | null;
  env?: string;
  [key: string]: unknown;
};

function fmt(event: string, fields: LogFields): string {
  return JSON.stringify({
    ts: new Date().toISOString(),
    env: fields.env ?? ENV,
    event,
    ...fields,
  });
}

export function logInfo(event: string, fields: LogFields = {}): void {
  console.log(fmt(event, fields));
}

export function logWarn(event: string, fields: LogFields = {}): void {
  console.warn(fmt(event, fields));
}

export function logError(event: string, fields: LogFields = {}): void {
  console.error(fmt(event, fields));
}
