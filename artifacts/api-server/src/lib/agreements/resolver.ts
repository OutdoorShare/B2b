/**
 * Agreement bundle resolver.
 * Given a booking/tenant context, determines the exact set of documents
 * that must be presented to and signed by the renter.
 *
 * Output is the canonical `ResolvedAgreementBundle` — immutable per booking.
 */

import { db, operatorContractsTable, platformAgreementsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface ResolvedOperatorDoc {
  id: number;
  title: string;
  checkboxLabel: string;
  version: number;
  contractType: "template" | "uploaded_pdf";
  content: string;
  uploadedPdfStorageKey?: string | null;
  includeOutdoorShareAgreements: boolean;
}

export interface ResolvedPlatformDoc {
  id: number;
  title: string;
  checkboxLabel: string;
  version: number;
  content: string;
  sortOrder: number;
}

export interface ResolvedAgreementBundle {
  tenantId: number;
  operatorDoc: ResolvedOperatorDoc | null;
  platformDocs: ResolvedPlatformDoc[];
  // True if both operator + platform docs are included
  hasCombinedDocs: boolean;
}

/**
 * Resolve the full agreement bundle for a given tenant at signing time.
 * Always pulls the current active versions.
 */
export interface ResolveBundleOptions {
  hasProtectionPlan?: boolean;
}

export async function resolveAgreementBundle(tenantId: number, opts?: ResolveBundleOptions): Promise<ResolvedAgreementBundle> {
  // Fetch active operator contract
  const [contract] = await db
    .select()
    .from(operatorContractsTable)
    .where(and(eq(operatorContractsTable.tenantId, tenantId), eq(operatorContractsTable.isActive, true)))
    .limit(1);

  const operatorDoc: ResolvedOperatorDoc | null = contract
    ? {
        id:                           contract.id,
        title:                        contract.title,
        checkboxLabel:                contract.checkboxLabel,
        version:                      contract.version,
        contractType:                 (contract.contractType ?? "template") as "template" | "uploaded_pdf",
        content:                      contract.content,
        uploadedPdfStorageKey:        contract.uploadedPdfStorageKey,
        includeOutdoorShareAgreements: contract.includeOutdoorShareAgreements,
      }
    : null;

  // Fetch active platform agreements
  const platformRows = await db
    .select()
    .from(platformAgreementsTable)
    .where(and(eq(platformAgreementsTable.isActive, true), eq(platformAgreementsTable.isRequired, true)))
    .orderBy(platformAgreementsTable.sortOrder);

  const includePlatform = opts?.hasProtectionPlan
    ? true
    : operatorDoc ? operatorDoc.includeOutdoorShareAgreements : true;

  const platformDocs: ResolvedPlatformDoc[] = includePlatform
    ? platformRows.map(r => ({
        id:           r.id,
        title:        r.title,
        checkboxLabel: r.checkboxLabel,
        version:      r.version,
        content:      r.content,
        sortOrder:    r.sortOrder,
      }))
    : [];

  return {
    tenantId,
    operatorDoc,
    platformDocs,
    hasCombinedDocs: !!operatorDoc && platformDocs.length > 0,
  };
}
