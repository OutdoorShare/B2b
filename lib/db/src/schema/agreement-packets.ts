import { pgTable, serial, text, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";

// ── Booking Agreement Packets ─────────────────────────────────────────────────
// One immutable record per signed booking. Written atomically at signing time
// and never mutated afterward.
export const bookingAgreementPacketsTable = pgTable("booking_agreement_packets", {
  id:                 serial("id").primaryKey(),
  bookingId:          integer("booking_id").notNull().unique(),
  tenantId:           integer("tenant_id").notNull(),
  signerName:         text("signer_name").notNull(),
  signerEmail:        text("signer_email").notNull(),
  ipAddress:          text("ip_address"),
  userAgent:          text("user_agent"),
  signatureStorageKey: text("signature_storage_key"),
  finalPdfStorageKey: text("final_pdf_storage_key"),
  resolvedConfig:     jsonb("resolved_config"),     // snapshot of which agreements applied
  agreementVersionIds: jsonb("agreement_version_ids"), // { platformAgreementIds, operatorContractId }
  fieldValues:        jsonb("field_values"),         // all filled placeholder values
  checkboxStates:     jsonb("checkbox_states"),      // { key: boolean }
  auditHash:          text("audit_hash"),            // SHA-256 of finalPdf bytes
  riders:             jsonb("riders"),               // string[] of additional rider names
  minors:             jsonb("minors"),               // string[] of minor names
  signedAt:           timestamp("signed_at").notNull().defaultNow(),
  createdAt:          timestamp("created_at").notNull().defaultNow(),
});

// ── Booking Agreement Documents ───────────────────────────────────────────────
// One record per document included in the packet (operator contract, each platform agreement, etc.)
export const bookingAgreementDocumentsTable = pgTable("booking_agreement_documents", {
  id:                       serial("id").primaryKey(),
  packetId:                 integer("packet_id").notNull(),
  sourceType:               text("source_type", { enum: ["operator", "platform"] }).notNull(),
  sourceAgreementId:        integer("source_agreement_id"),     // operator_contract.id or platform_agreement.id
  sourceAgreementVersion:   integer("source_agreement_version"), // version snapshot
  title:                    text("title").notNull(),
  contentSnapshot:          text("content_snapshot"),           // rendered text at signing time
  checkboxLabel:            text("checkbox_label"),
  accepted:                 boolean("accepted").notNull().default(true),
  generationOrder:          integer("generation_order").notNull().default(0),
  generatedPdfStorageKey:   text("generated_pdf_storage_key"),  // intermediate PDF (optional)
  createdAt:                timestamp("created_at").notNull().defaultNow(),
});

export type BookingAgreementPacket   = typeof bookingAgreementPacketsTable.$inferSelect;
export type BookingAgreementDocument = typeof bookingAgreementDocumentsTable.$inferSelect;
