// ── Agreement Token Resolver ─────────────────────────────────────────────────
// Resolves {{placeholder}} tokens in agreement/contract templates.
// Used by both the signing flow (API) and the PDF generator.

export interface AgreementTokenVars {
  signerName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  bookingId?: number | string;
  listingTitle?: string;
  startDate?: string;
  endDate?: string;
  companyName?: string;
  additionalRiders?: string[];
  minors?: string[];
  signedAt?: Date | string;
  totalPrice?: string | number;
}

export function resolveAgreementTokens(template: string, vars: AgreementTokenVars): string {
  const nameParts = (vars.signerName ?? "").trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName  = nameParts.length > 1 ? nameParts.slice(1).join(" ") : firstName;

  const ridersStr = vars.additionalRiders?.length
    ? vars.additionalRiders.join(", ")
    : "None";
  const minorsStr = vars.minors?.length
    ? vars.minors.join(", ")
    : "None";

  const signedAtStr = vars.signedAt
    ? new Date(vars.signedAt).toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  const priceStr = vars.totalPrice != null
    ? `$${parseFloat(String(vars.totalPrice)).toFixed(2)}`
    : "";

  return template
    .replace(/{{first_name}}/gi,         firstName)
    .replace(/{{last_name}}/gi,          lastName)
    .replace(/{{full_name}}/gi,          vars.signerName ?? "")
    .replace(/{{renter_name}}/gi,        vars.signerName ?? vars.customerName ?? "")
    .replace(/{{customer_name}}/gi,      vars.customerName ?? "")
    .replace(/{{email}}/gi,              vars.customerEmail ?? "")
    .replace(/{{phone}}/gi,              vars.customerPhone ?? "")
    .replace(/{{booking_id}}/gi,         String(vars.bookingId ?? ""))
    .replace(/{{listing_name}}/gi,       vars.listingTitle ?? "")
    .replace(/{{listing_title}}/gi,      vars.listingTitle ?? "")
    .replace(/{{start_date}}/gi,         vars.startDate ?? "")
    .replace(/{{end_date}}/gi,           vars.endDate ?? "")
    .replace(/{{company_name}}/gi,       vars.companyName ?? "")
    .replace(/{{additional_riders}}/gi,  ridersStr)
    .replace(/{{riders}}/gi,             ridersStr)
    .replace(/{{minors}}/gi,             minorsStr)
    .replace(/{{signed_at}}/gi,          signedAtStr)
    .replace(/{{total_price}}/gi,        priceStr)
    .replace(/{{today}}/gi,              new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))
    .replace(/{{date}}/gi,               new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))
    .replace(/{{[^}]+}}/g, "___");        // catch-all for unknown tokens
}
