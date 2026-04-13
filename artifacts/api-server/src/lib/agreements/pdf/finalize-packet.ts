/**
 * Writes the immutable booking_agreement_packets + booking_agreement_documents
 * records after the final PDF is successfully generated and stored.
 *
 * Must be called ONLY after PDF generation succeeds — never partially.
 */

import crypto from "crypto";
import { db, bookingAgreementPacketsTable, bookingAgreementDocumentsTable } from "@workspace/db";
import type { ResolvedAgreementBundle } from "../resolver";
import type { AgreementData } from "../placeholders";

export interface FinalizePacketOpts {
  bookingId:          number;
  tenantId:           number;
  data:               AgreementData;
  bundle:             ResolvedAgreementBundle;
  finalPdfBuffer:     Buffer;
  finalPdfStorageKey: string;
  signatureDataUrl:   string;
  ipAddress?:         string;
  userAgent?:         string;
  acceptances:        Array<{ checkboxLabel: string; accepted: boolean; type: "operator" | "platform" }>;
}

export async function finalizeAgreementPacket(opts: FinalizePacketOpts): Promise<number> {
  const {
    bookingId, tenantId, data, bundle,
    finalPdfBuffer, finalPdfStorageKey,
    signatureDataUrl, ipAddress, userAgent, acceptances,
  } = opts;

  // ── Audit hash ─────────────────────────────────────────────────────────────
  const auditHash = crypto.createHash("sha256").update(finalPdfBuffer).digest("hex");

  // ── Build resolved config snapshot ────────────────────────────────────────
  const resolvedConfig = {
    operatorContractId:      bundle.operatorDoc?.id ?? null,
    operatorContractVersion: bundle.operatorDoc?.version ?? null,
    platformAgreementIds:    bundle.platformDocs.map(d => d.id),
    platformAgreementVersions: bundle.platformDocs.map(d => ({ id: d.id, version: d.version })),
  };

  // ── Build checkboxes state map ─────────────────────────────────────────────
  const checkboxStates: Record<string, boolean> = {};
  for (const acc of acceptances) {
    checkboxStates[acc.checkboxLabel] = acc.accepted;
  }

  // ── Write packet ──────────────────────────────────────────────────────────
  const [packet] = await db
    .insert(bookingAgreementPacketsTable)
    .values({
      bookingId,
      tenantId,
      signerName:          data.signature.name,
      signerEmail:         data.renter.email,
      ipAddress,
      userAgent,
      signatureStorageKey: null,       // raw signature stored inline in PDF; could store separately later
      finalPdfStorageKey,
      resolvedConfig,
      agreementVersionIds: resolvedConfig,
      fieldValues:         {
        renter:  data.renter,
        booking: data.booking,
        listing: data.listing,
        storefront: data.storefront,
      },
      checkboxStates,
      auditHash,
      riders:  data.riders ?? [],
      minors:  data.minors ?? [],
      signedAt: new Date(),
    })
    .returning({ id: bookingAgreementPacketsTable.id });

  const packetId = packet.id;

  // ── Write per-document records ─────────────────────────────────────────────
  const docRows: Array<typeof bookingAgreementDocumentsTable.$inferInsert> = [];
  let order = 0;

  if (bundle.operatorDoc) {
    const acc = acceptances.find(a => a.type === "operator");
    docRows.push({
      packetId,
      sourceType:               "operator",
      sourceAgreementId:        bundle.operatorDoc.id,
      sourceAgreementVersion:   bundle.operatorDoc.version,
      title:                    bundle.operatorDoc.title,
      contentSnapshot:          bundle.operatorDoc.content,
      checkboxLabel:            bundle.operatorDoc.checkboxLabel,
      accepted:                 acc?.accepted ?? true,
      generationOrder:          order++,
      generatedPdfStorageKey:   null,
    });
  }

  for (const pdoc of bundle.platformDocs) {
    const acc = acceptances.find(a => a.type === "platform" && a.checkboxLabel === pdoc.checkboxLabel);
    docRows.push({
      packetId,
      sourceType:               "platform",
      sourceAgreementId:        pdoc.id,
      sourceAgreementVersion:   pdoc.version,
      title:                    pdoc.title,
      contentSnapshot:          pdoc.content,
      checkboxLabel:            pdoc.checkboxLabel,
      accepted:                 acc?.accepted ?? true,
      generationOrder:          order++,
      generatedPdfStorageKey:   null,
    });
  }

  if (docRows.length > 0) {
    await db.insert(bookingAgreementDocumentsTable).values(docRows);
  }

  return packetId;
}
