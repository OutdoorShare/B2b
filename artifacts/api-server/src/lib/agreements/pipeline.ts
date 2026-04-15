/**
 * Main agreement generation pipeline.
 *
 * Steps:
 *  1. Resolve agreement bundle for tenant
 *  2. Render each document (Handlebars → text)
 *  3. Generate PDF buffer for each doc
 *  4. Merge all PDFs + signature page into one final PDF
 *  5. Store final PDF
 *  6. Write immutable packet record
 *  7. Return storage key
 *
 * This entire flow is atomic — if any step fails, nothing is written.
 */

import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { resolveAgreementBundle, type ResolvedAgreementBundle } from "./resolver";
import { renderTemplate, type AgreementData } from "./placeholders";
import { renderDocPdf } from "./pdf/render-doc-pdf";
import { renderSignaturePage, type AcceptanceLine } from "./pdf/render-signature-page";
import { mergePdfs, stampMetadata } from "./pdf/merge-pdfs";
import { finalizeAgreementPacket } from "./pdf/finalize-packet";
import { objectStorageClient } from "../objectStorage";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const BUCKET_ID   = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";

export interface PipelineSignPayload {
  bookingId:        number;
  tenantId:         number;
  signerName:       string;
  signerEmail:      string;
  signatureDataUrl: string;
  riders?:          string[];
  minors?:          string[];
  ipAddress?:       string;
  userAgent?:       string;
  hasProtectionPlan?: boolean;
  acceptances?: Array<{
    checkboxLabel: string;
    accepted:      boolean;
    type:          "operator" | "platform";
  }>;
  bookingContext: {
    startDate:   string;
    endDate:     string;
    listingName: string;
    companyName: string;
    numDays?:    number;
    totalPrice?: string;
    deposit?:    string;
    phone?:      string;
    address?:    string;
  };
}

export interface PipelineResult {
  pdfFilename:        string;
  pdfStorageKey:      string;
  packetId:           number;
  resolvedBundle:     ResolvedAgreementBundle;
  auditHash:          string;
}

export async function runAgreementPipeline(payload: PipelineSignPayload): Promise<PipelineResult> {
  const {
    bookingId, tenantId, signerName, signerEmail,
    signatureDataUrl, riders, minors, ipAddress, userAgent,
    bookingContext,
  } = payload;

  // ── Step 1: Resolve bundle ─────────────────────────────────────────────────
  const bundle = await resolveAgreementBundle(tenantId, {
    hasProtectionPlan: payload.hasProtectionPlan,
  });

  // ── Step 2: Build agreement data for template rendering ───────────────────
  const nameParts = signerName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName  = nameParts.slice(1).join(" ");
  const signedAt  = new Date();

  const agreementData: AgreementData = {
    renter: {
      firstName,
      lastName,
      email:   signerEmail,
      phone:   bookingContext.phone,
      address: bookingContext.address,
    },
    booking: {
      id:         bookingId,
      startDate:  bookingContext.startDate,
      endDate:    bookingContext.endDate,
      numDays:    bookingContext.numDays,
      totalPrice: bookingContext.totalPrice,
      deposit:    bookingContext.deposit,
    },
    listing: { name: bookingContext.listingName },
    storefront: { name: bookingContext.companyName },
    signature: {
      name:     signerName,
      signedAt: signedAt.toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      }),
    },
    riders,
    minors,
  };

  // ── Step 3: Build ordered acceptances list ────────────────────────────────
  const acceptances: AcceptanceLine[] = [];

  if (bundle.operatorDoc) {
    const incomingAcc = payload.acceptances?.find(a => a.type === "operator");
    acceptances.push({
      checkboxLabel: bundle.operatorDoc.checkboxLabel,
      accepted:      incomingAcc?.accepted ?? true,
      type:          "operator",
    });
  }

  for (const pdoc of bundle.platformDocs) {
    const incomingAcc = payload.acceptances?.find(
      a => a.type === "platform" && a.checkboxLabel === pdoc.checkboxLabel,
    );
    acceptances.push({
      checkboxLabel: pdoc.checkboxLabel,
      accepted:      incomingAcc?.accepted ?? true,
      type:          "platform",
    });
  }

  // ── Step 4: Generate each document PDF ────────────────────────────────────
  const docPdfBuffers: Buffer[] = [];

  // 4a: Operator contract
  if (bundle.operatorDoc) {
    if (bundle.operatorDoc.contractType === "uploaded_pdf" && bundle.operatorDoc.uploadedPdfStorageKey) {
      // Mode 2: uploaded PDF — load the raw bytes from storage
      try {
        const uploadedBuf = await downloadFromStorage(bundle.operatorDoc.uploadedPdfStorageKey);
        docPdfBuffers.push(uploadedBuf);
      } catch (err) {
        console.error("[pipeline] Failed to load uploaded PDF, generating placeholder:", err);
        const renderedContent = `[Operator uploaded contract — unable to retrieve file. Please contact the operator.]`;
        const buf = await renderDocPdf({
          title:        bundle.operatorDoc.title,
          content:      renderedContent,
          checkboxLabel: bundle.operatorDoc.checkboxLabel,
          accepted:     true,
          sourceType:   "operator",
          companyName:  bookingContext.companyName,
          bookingId,
        });
        docPdfBuffers.push(buf);
      }
    } else {
      // Mode 1: template-based contract — render Handlebars then PDFKit
      const rendered = renderTemplate(bundle.operatorDoc.content, agreementData);
      const acc = acceptances.find(a => a.type === "operator");
      const buf = await renderDocPdf({
        title:        bundle.operatorDoc.title,
        content:      rendered,
        checkboxLabel: bundle.operatorDoc.checkboxLabel,
        accepted:     acc?.accepted ?? true,
        sourceType:   "operator",
        companyName:  bookingContext.companyName,
        bookingId,
      });
      docPdfBuffers.push(buf);
    }
  }

  // 4b: Platform agreements
  for (const pdoc of bundle.platformDocs) {
    const rendered = renderTemplate(pdoc.content, agreementData);
    const acc = acceptances.find(a => a.type === "platform" && a.checkboxLabel === pdoc.checkboxLabel);
    const buf = await renderDocPdf({
      title:        pdoc.title,
      content:      rendered,
      checkboxLabel: pdoc.checkboxLabel,
      accepted:     acc?.accepted ?? true,
      sourceType:   "platform",
      companyName:  bookingContext.companyName,
      bookingId,
    });
    docPdfBuffers.push(buf);
  }

  // 4c: Signature page (always last)
  const sigPageBuf = await renderSignaturePage({
    companyName:      bookingContext.companyName,
    bookingId,
    signerName,
    signedAt,
    signatureDataUrl,
    acceptances,
    riders,
    minors,
    ipAddress,
  });
  docPdfBuffers.push(sigPageBuf);

  // ── Step 5: Merge all PDFs ─────────────────────────────────────────────────
  let finalPdfBuffer = await mergePdfs(docPdfBuffers);

  // ── Step 6: Stamp metadata ─────────────────────────────────────────────────
  finalPdfBuffer = await stampMetadata(finalPdfBuffer, {
    title:    `Rental Agreement — Booking #${bookingId}`,
    author:   bookingContext.companyName,
    subject:  `Signed by ${signerName} on ${signedAt.toISOString()}`,
    keywords: ["rental", "agreement", "signed", `booking-${bookingId}`],
  });

  // ── Step 7: Store final PDF ────────────────────────────────────────────────
  const filename  = `agreement-${bookingId}-${randomBytes(6).toString("hex")}.pdf`;
  const storageKey = `agreements/${filename}`;

  let pdfStorageKey = storageKey;

  if (BUCKET_ID) {
    try {
      const bucket = objectStorageClient.bucket(BUCKET_ID);
      await bucket.file(storageKey).save(finalPdfBuffer, { contentType: "application/pdf" });
    } catch (storageErr) {
      console.error("[pipeline] Object storage unavailable, falling back to local:", storageErr);
      pdfStorageKey = await saveLocally(finalPdfBuffer, filename);
    }
  } else {
    pdfStorageKey = await saveLocally(finalPdfBuffer, filename);
  }

  // ── Step 8: Write immutable packet record ─────────────────────────────────
  const packetId = await finalizeAgreementPacket({
    bookingId,
    tenantId,
    data:               agreementData,
    bundle,
    finalPdfBuffer,
    finalPdfStorageKey: pdfStorageKey,
    signatureDataUrl,
    ipAddress,
    userAgent,
    acceptances:        acceptances.map(a => ({ ...a, accepted: a.accepted })),
  });

  // Compute audit hash for return value
  const { createHash } = await import("crypto");
  const auditHash = createHash("sha256").update(finalPdfBuffer).digest("hex");

  return {
    pdfFilename:    filename,
    pdfStorageKey,
    packetId,
    resolvedBundle: bundle,
    auditHash,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function saveLocally(buffer: Buffer, filename: string): Promise<string> {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filepath = path.join(UPLOADS_DIR, filename);
  await fs.promises.writeFile(filepath, buffer);
  return filename;
}

async function downloadFromStorage(storageKey: string): Promise<Buffer> {
  const bucket = objectStorageClient.bucket(BUCKET_ID);
  const [contents] = await bucket.file(storageKey).download();
  return contents;
}
