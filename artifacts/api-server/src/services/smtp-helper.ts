import { db } from "@workspace/db";
import { businessProfileTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { decrypt, isEncrypted } from "../lib/crypto";
import type { SmtpCreds } from "./gmail";

export async function getTenantSmtpCreds(tenantId: number | null | undefined): Promise<SmtpCreds | null> {
  if (!tenantId) return null;
  try {
    const [profile] = await db
      .select({
        name: businessProfileTable.name,
        senderEmail: businessProfileTable.senderEmail,
        senderPassword: businessProfileTable.senderPassword,
      })
      .from(businessProfileTable)
      .where(eq(businessProfileTable.tenantId, tenantId))
      .limit(1);

    if (!profile?.senderEmail || !profile?.senderPassword) return null;
    const pass = isEncrypted(profile.senderPassword)
      ? decrypt(profile.senderPassword)
      : profile.senderPassword;
    return { user: profile.senderEmail, pass, fromName: profile.name || undefined };
  } catch {
    return null;
  }
}
