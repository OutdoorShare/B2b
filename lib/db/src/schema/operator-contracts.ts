import { pgTable, serial, text, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Operator Contracts ────────────────────────────────────────────────────────
// Per-tenant custom contracts that operators build or upload.
// Multiple templates can be active simultaneously. isActive = true means
// this template is in use. listingIds controls which listings use it:
//   - empty array  → default contract (used for any booking not matched below)
//   - [3, 7, 12]   → only for bookings on listing 3, 7, or 12
//
// Resolution priority when a booking is created:
//   1. Active contract whose listingIds includes the booking's listing
//   2. Active contract with empty listingIds (global default)
//
// includeOutdoorShareAgreements: when true, active platform_agreements are
// appended to the combined PDF in addition to this contract.
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
  // Listing IDs this template is assigned to. Empty = global default.
  listingIds: json("listing_ids").$type<number[]>().notNull().default([]),
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
