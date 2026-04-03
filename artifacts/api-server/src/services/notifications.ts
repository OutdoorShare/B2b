import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db/schema";

export async function createNotification(opts: {
  tenantId: number;
  targetType: "admin" | "renter";
  targetEmail?: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
  isActionRequired?: boolean;
  relatedId?: number;
}) {
  try {
    await db.insert(notificationsTable).values({
      tenantId: opts.tenantId,
      targetType: opts.targetType,
      targetEmail: opts.targetEmail ?? null,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      actionUrl: opts.actionUrl ?? null,
      isActionRequired: opts.isActionRequired ?? false,
      relatedId: opts.relatedId ?? null,
    });
  } catch (err) {
    console.error("[notifications] failed to create:", err);
  }
}
