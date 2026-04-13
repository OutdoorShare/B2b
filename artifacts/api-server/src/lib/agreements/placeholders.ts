/**
 * Handlebars-based placeholder resolution for agreement templates.
 *
 * Supports:
 *   {{renter.first_name}}, {{booking.id}}, {{listing.name}}, etc.
 *   {{#each riders}}...{{/each}}
 *   {{#each minors}}...{{/each}}
 *   Legacy flat tokens: {{first_name}}, {{booking_id}}, etc.
 */

import Handlebars from "handlebars";

// ── Placeholder registry ─────────────────────────────────────────────────────
export const PLACEHOLDER_REGISTRY: Array<{ token: string; description: string; category: "auto" | "renter" | "booking" }> = [
  // Auto-filled
  { token: "{{renter.first_name}}",    description: "Renter first name",      category: "auto" },
  { token: "{{renter.last_name}}",     description: "Renter last name",       category: "auto" },
  { token: "{{renter.full_name}}",     description: "Renter full name",       category: "auto" },
  { token: "{{renter.email}}",         description: "Renter email",           category: "auto" },
  { token: "{{renter.phone}}",         description: "Renter phone",           category: "auto" },
  { token: "{{booking.id}}",           description: "Booking ID",             category: "auto" },
  { token: "{{booking.start_date}}",   description: "Start date",             category: "auto" },
  { token: "{{booking.end_date}}",     description: "End date",               category: "auto" },
  { token: "{{listing.name}}",         description: "Listing/item name",      category: "auto" },
  { token: "{{storefront.name}}",      description: "Company/storefront name",category: "auto" },
  { token: "{{signature.name}}",       description: "Signer typed name",      category: "auto" },
  { token: "{{signature.signed_at}}",  description: "Date/time signed",       category: "auto" },
  // Renter-provided
  { token: "{{renter.address}}",       description: "Renter address",         category: "renter" },
  { token: "{{renter.license}}",       description: "Driver license #",       category: "renter" },
  // Booking
  { token: "{{booking.total_price}}",  description: "Total price",            category: "booking" },
  { token: "{{booking.deposit}}",      description: "Deposit amount",         category: "booking" },
  { token: "{{booking.num_days}}",     description: "Number of days",         category: "booking" },
];

// Also support legacy flat {{token}} format used in old templates
const LEGACY_MAP: Record<string, string> = {
  "first_name":       "renter.first_name",
  "last_name":        "renter.last_name",
  "full_name":        "renter.full_name",
  "email":            "renter.email",
  "phone":            "renter.phone",
  "address":          "renter.address",
  "booking_id":       "booking.id",
  "start_date":       "booking.start_date",
  "end_date":         "booking.end_date",
  "num_days":         "booking.num_days",
  "listing_title":    "listing.name",
  "company_name":     "storefront.name",
  "signer_name":      "signature.name",
  "signed_at":        "signature.signed_at",
};

export interface AgreementData {
  renter: {
    firstName:  string;
    lastName:   string;
    email:      string;
    phone?:     string;
    address?:   string;
    license?:   string;
  };
  booking: {
    id:          number | string;
    startDate:   string;
    endDate:     string;
    numDays?:    number;
    totalPrice?: string;
    deposit?:    string;
  };
  listing: {
    name: string;
  };
  storefront: {
    name: string;
  };
  signature: {
    name:     string;
    signedAt: string;
  };
  riders?: string[];
  minors?: string[];
  checkboxes?: Record<string, boolean>;
}

/**
 * Normalize template text: upgrades legacy {{flat_token}} to {{nested.token}}.
 */
function normalizeLegacyTokens(template: string): string {
  let out = template;
  for (const [legacy, modern] of Object.entries(LEGACY_MAP)) {
    // Only replace standalone {{token}} not already nested
    out = out.replace(new RegExp(`\\{\\{${legacy}\\}\\}`, "g"), `{{${modern}}}`);
  }
  return out;
}

/**
 * Build the Handlebars context object from AgreementData.
 */
function buildContext(data: AgreementData) {
  return {
    renter: {
      first_name: data.renter.firstName,
      last_name:  data.renter.lastName,
      full_name:  `${data.renter.firstName} ${data.renter.lastName}`.trim(),
      email:      data.renter.email,
      phone:      data.renter.phone ?? "",
      address:    data.renter.address ?? "",
      license:    data.renter.license ?? "",
    },
    booking: {
      id:          data.booking.id,
      start_date:  data.booking.startDate,
      end_date:    data.booking.endDate,
      num_days:    data.booking.numDays ?? "",
      total_price: data.booking.totalPrice ?? "",
      deposit:     data.booking.deposit ?? "",
    },
    listing: {
      name: data.listing.name,
    },
    storefront: {
      name: data.storefront.name,
    },
    signature: {
      name:      data.signature.name,
      signed_at: data.signature.signedAt,
    },
    riders: (data.riders ?? []).map(r => ({ name: r })),
    minors: (data.minors ?? []).map(m => ({ name: m })),
  };
}

/**
 * Render a template string with agreement data using Handlebars.
 * Handles both modern {{renter.first_name}} and legacy {{first_name}} tokens.
 * Also supports {{#each riders}}{{this.name}}{{/each}} loops.
 */
export function renderTemplate(templateText: string, data: AgreementData): string {
  const normalized = normalizeLegacyTokens(templateText);
  try {
    const compiled = Handlebars.compile(normalized, { noEscape: true, strict: false });
    return compiled(buildContext(data));
  } catch (err) {
    // On Handlebars error fall back to simple string replacement
    let out = normalized;
    const ctx = buildContext(data);
    const flatten = (obj: Record<string, any>, prefix = ""): Record<string, string> => {
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          Object.assign(result, flatten(v, key));
        } else {
          result[key] = String(v ?? "");
        }
      }
      return result;
    };
    for (const [key, val] of Object.entries(flatten(ctx))) {
      out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), val);
    }
    return out;
  }
}

/**
 * Detect unknown placeholders in a template for admin validation.
 */
export function detectUnknownPlaceholders(templateText: string): string[] {
  const normalized = normalizeLegacyTokens(templateText);
  const knownPaths = new Set(PLACEHOLDER_REGISTRY.map(p => p.token.replace(/[{}]/g, "")));
  // Also accept each/riders/minors constructs
  const allTokens = [...normalized.matchAll(/\{\{([^#\/][^}]*)\}\}/g)].map(m => m[1].trim());
  return allTokens.filter(t => !knownPaths.has(t) && !t.startsWith("this.") && !t.startsWith("@"));
}
