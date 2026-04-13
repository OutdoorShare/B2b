import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Operator Contracts ────────────────────────────────────────────────────────
// Per-tenant custom contracts that operators build or upload.
// Each tenant has at most one active contract (isActive = true).
// Supports {{placeholder}} tokens — see resolveAgreementTokens() in the API.
//
// includeOutdoorShareAgreements: when true, active platform_agreements are
// appended to the combined PDF in addition to this contract.
// When false (insurance opted out), only this contract is included unless the
// operator explicitly re-enables it.
export const operatorContractsTable = pgTable("operator_contracts", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull(),
  title: text("title").notNull().default("Rental Agreement"),
  // contractType: "template" = built in the editor; "uploaded_pdf" = operator uploaded a PDF file
  contractType: text("contract_type", { enum: ["template", "uploaded_pdf"] }).notNull().default("template"),
  content: text("content").notNull().default(""),
  // For uploaded_pdf type — object-storage key for the uploaded PDF
  uploadedPdfStorageKey: text("uploaded_pdf_storage_key"),
  uploadedFileName: text("uploaded_file_name"),
  uploadedFileSizeBytes: integer("uploaded_file_size_bytes"),
  checkboxLabel: text("checkbox_label").notNull().default("I agree to the rental terms and conditions"),
  includeOutdoorShareAgreements: boolean("include_outdoorshare_agreements").notNull().default(true),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertOperatorContractSchema = createInsertSchema(operatorContractsTable, {
  title: z.string().min(1),
  content: z.string(),
  checkboxLabel: z.string().min(1),
  includeOutdoorShareAgreements: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type OperatorContract = typeof operatorContractsTable.$inferSelect;
export type NewOperatorContract = typeof operatorContractsTable.$inferInsert;
