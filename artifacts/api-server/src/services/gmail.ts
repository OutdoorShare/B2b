import { google } from "googleapis";

let connectionSettings: any;

async function getAccessToken() {
  if (
    connectionSettings &&
    connectionSettings.settings.expires_at &&
    new Date(connectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    return connectionSettings.settings.access_token;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=google-mail",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  const accessToken =
    connectionSettings?.settings?.access_token ||
    connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error("Gmail not connected");
  }
  return accessToken;
}

async function getUncachableGmailClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

const PLATFORM_FROM = "OutdoorShare <contact.us@myoutdoorshare.com>";

function makeRawEmail(to: string, subject: string, htmlBody: string): string {
  const boundary = "boundary_outdoorshare";
  const message = [
    `From: ${PLATFORM_FROM}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
    `--${boundary}--`,
  ].join("\r\n");
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const APP_URL =
  process.env.APP_URL ||
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "https://outdoorshare.app");

// ── Brand constants ────────────────────────────────────────────────────────────
const BRAND_GREEN = "#3ab549";
const BRAND_DARK = "#1a2332";
const LOGO_URL = `${APP_URL}/outdoorshare-logo.png`;

// ── Shared HTML wrapper ────────────────────────────────────────────────────────
function emailShell(opts: {
  preheader: string;
  badgeLabel: string;
  badgeColor: string;
  body: string;
}): string {
  const { preheader, badgeLabel, badgeColor, body } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OutdoorShare</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <!-- preheader text (hidden) -->
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2f0;min-height:100vh;">
    <tr>
      <td align="center" valign="top" style="padding:40px 16px;">

        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header: logo on dark bg -->
          <tr>
            <td style="background:${BRAND_DARK};padding:28px 40px;text-align:center;">
              <img src="${LOGO_URL}" alt="OutdoorShare" width="180" style="display:inline-block;max-width:180px;height:auto;" />
            </td>
          </tr>

          <!-- Badge strip -->
          <tr>
            <td style="background:${badgeColor};padding:12px 40px;text-align:center;">
              <span style="color:#ffffff;font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">${badgeLabel}</span>
            </td>
          </tr>

          <!-- Body content -->
          <tr>
            <td style="padding:36px 40px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8faf8;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 6px 0;font-size:13px;color:#6b7280;">
                <strong style="color:${BRAND_GREEN};">OutdoorShare</strong> &mdash; Find New Boundaries
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                Questions? Contact us at <a href="mailto:contact.us@myoutdoorshare.com" style="color:#9ca3af;">contact.us@myoutdoorshare.com</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Shared CTA button ──────────────────────────────────────────────────────────
function ctaButton(label: string, url: string, color = BRAND_GREEN): string {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:32px auto;">
    <tr>
      <td align="center" style="border-radius:8px;background:${color};">
        <a href="${url}" target="_blank" style="display:inline-block;padding:14px 40px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

// ── Info table ─────────────────────────────────────────────────────────────────
function infoTable(rows: { label: string; value: string; mono?: boolean }[]): string {
  const rowsHtml = rows.map(r => `
    <tr>
      <td style="padding:10px 16px;background:#f8faf8;font-size:13px;color:#6b7280;font-weight:600;white-space:nowrap;border-bottom:1px solid #e5e7eb;width:130px;">${r.label}</td>
      <td style="padding:10px 16px;font-size:14px;color:#111827;border-bottom:1px solid #e5e7eb;${r.mono ? "font-family:monospace;letter-spacing:0.5px;" : ""}">${r.value}</td>
    </tr>`).join("");

  return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;margin:24px 0;">
    <tbody>${rowsHtml}</tbody>
  </table>`;
}

// ── Welcome email ──────────────────────────────────────────────────────────────
export async function sendWelcomeEmail(opts: {
  toEmail: string;
  companyName: string;
  slug: string;
  password: string;
}): Promise<void> {
  const { toEmail, companyName, slug, password } = opts;
  const loginUrl = `${APP_URL}/${slug}/admin`;
  const storefrontUrl = `${APP_URL}/${slug}`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Welcome aboard, ${companyName}! 🎉</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Your rental management account has been created and is ready to use. Below are your login credentials — keep them safe.
    </p>

    ${infoTable([
      { label: "Email", value: toEmail },
      { label: "Password", value: password, mono: true },
      { label: "Storefront", value: `<a href="${storefrontUrl}" style="color:${BRAND_GREEN};text-decoration:none;">${storefrontUrl}</a>` },
    ])}

    ${ctaButton("Log In to Your Dashboard", loginUrl)}

    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      We recommend changing your password after your first login.
    </p>
  `;

  const html = emailShell({
    preheader: `Your OutdoorShare account for ${companyName} is ready. Log in to get started.`,
    badgeLabel: "Account Created",
    badgeColor: BRAND_GREEN,
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, `Your OutdoorShare account for ${companyName} is ready`, html) },
  });
}

// ── Account updated email ──────────────────────────────────────────────────────
export async function sendAccountUpdatedEmail(opts: {
  toEmail: string;
  companyName: string;
  slug: string;
  passwordChanged: boolean;
  newPassword?: string;
}): Promise<void> {
  const { toEmail, companyName, slug, passwordChanged, newPassword } = opts;
  const loginUrl = `${APP_URL}/${slug}/admin`;
  const storefrontUrl = `${APP_URL}/${slug}`;

  const tableRows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Email", value: toEmail },
    { label: "Storefront", value: `<a href="${storefrontUrl}" style="color:${BRAND_GREEN};text-decoration:none;">${storefrontUrl}</a>` },
  ];
  if (passwordChanged && newPassword) {
    tableRows.push({ label: "New Password", value: newPassword, mono: true });
  }

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Your account has been updated</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Your <strong>OutdoorShare</strong> account for <strong>${companyName}</strong> was updated by the platform administrator.
      ${passwordChanged && newPassword ? "Your password has been changed — please update it after logging in." : "Review the details below."}
    </p>

    ${infoTable(tableRows)}

    ${ctaButton("Log In to Your Dashboard", loginUrl)}

    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      If you did not expect this change, please contact OutdoorShare support immediately.
    </p>
  `;

  const html = emailShell({
    preheader: `Your OutdoorShare account for ${companyName} has been updated.`,
    badgeLabel: "Account Updated",
    badgeColor: "#0e7490",
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, `Your OutdoorShare account has been updated`, html) },
  });
}

// ── Pickup link email (to renter) ────────────────────────────────────────────
export async function sendPickupLinkEmail(opts: {
  toEmail: string;
  customerName: string;
  pickupUrl: string;
  listingTitle: string;
  startDate: string;
  endDate: string;
  companyName: string;
}): Promise<void> {
  const { toEmail, customerName, pickupUrl, listingTitle, startDate, endDate, companyName } = opts;

  const tableRows: { label: string; value: string }[] = [
    { label: "Equipment",   value: listingTitle },
    { label: "Pickup Date", value: startDate },
    { label: "Return Date", value: endDate },
    { label: "Company",     value: companyName },
  ];

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Pre-Pickup Photo Check Required</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${customerName}</strong>, it's almost time to pick up your rental from <strong>${companyName}</strong>.
      Before pickup, please document the condition of the equipment by uploading photos using the link below.
      These photos protect you in case of any future damage claims.
    </p>
    ${infoTable(tableRows)}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">📸 What to photograph:</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:13px;color:#15803d;line-height:1.8;">
        <li>All sides of the equipment (front, back, left, right)</li>
        <li>Any existing scratches, dents, or damage</li>
        <li>Serial numbers or identifying markings</li>
      </ul>
    </div>
    ${ctaButton("Upload Pickup Photos", pickupUrl, BRAND_GREEN)}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      This link is unique to your booking and expires after pickup is complete.
    </p>
  `;

  const html = emailShell({
    preheader: `Upload pickup photos for your ${listingTitle} rental — required before pickup.`,
    badgeLabel: "Action Required — Upload Pickup Photos",
    badgeColor: BRAND_GREEN,
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, `[${companyName}] Please upload pickup photos for your rental`, html) },
  });
}

// ── Claim alert email (to superadmin) ─────────────────────────────────────────
export async function sendClaimChargeEmail(opts: {
  claimId: number;
  customerName: string;
  customerEmail: string;
  amount: number;
  mode: "link" | "invoice" | "installments";
  paymentUrl: string | null;
  tenantName: string;
  installmentCount?: number;
  dueInDays?: number;
}): Promise<void> {
  const { claimId, customerName, customerEmail, amount, mode, paymentUrl, tenantName, installmentCount, dueInDays } = opts;

  const modeLabel = mode === "link" ? "Payment Link" : mode === "invoice" ? "Invoice" : "Installment Plan";
  const modeDesc = mode === "link"
    ? "A payment link has been sent to collect the damage amount. Please click the button below to complete your payment."
    : mode === "invoice"
    ? `A Stripe Invoice has been emailed to you directly and is due in ${dueInDays ?? 7} days. You can also use the button below to access your invoice.`
    : `Your damage charge has been split into ${installmentCount ?? 3} equal installments. You will receive separate invoice emails for each installment due on a rolling schedule.`;

  const tableRows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Claim #",   value: `#${claimId}`, mono: true },
    { label: "Amount",    value: `$${amount.toFixed(2)}` },
    { label: "Company",   value: tenantName },
    { label: "Method",    value: modeLabel },
    ...(mode === "installments" ? [{ label: "Installments", value: `${installmentCount ?? 3} payments` }] : []),
    ...(mode === "invoice" && dueInDays != null ? [{ label: "Due In", value: `${dueInDays} days` }] : []),
  ];

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Damage Charge Notice</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Dear <strong>${customerName}</strong>, a damage charge of <strong>$${amount.toFixed(2)}</strong> has been issued by <strong>${tenantName}</strong> in connection with your recent rental. ${modeDesc}
    </p>
    ${infoTable(tableRows)}
    ${paymentUrl ? ctaButton(mode === "link" ? "Pay Now" : "View Invoice", paymentUrl, "#dc2626") : ""}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      If you believe this charge is in error, please contact ${tenantName} directly or reply to this email.
    </p>
  `;

  const html = emailShell({
    preheader: `Damage charge of $${amount.toFixed(2)} has been issued for Claim #${claimId} — action required.`,
    badgeLabel: "Damage Charge — Action Required",
    badgeColor: "#dc2626",
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(customerEmail, `[Claim #${claimId}] Damage Charge Notice — $${amount.toFixed(2)}`, html) },
  });
}

export async function sendClaimAlertEmail(opts: {
  claimId: number;
  customerName: string;
  customerEmail: string;
  type: string;
  description: string;
  claimedAmount: number | null;
  companyName: string;
  slug: string;
  bookingId: number | null;
}): Promise<void> {
  const { claimId, customerName, customerEmail, type, description, claimedAmount, companyName, slug, bookingId } = opts;

  const gmail = await getUncachableGmailClient();
  const profile = await gmail.users.getProfile({ userId: "me" });
  const toEmail = profile.data.emailAddress!;

  const claimsUrl = `${APP_URL}/superadmin/claims`;
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const descPreview = description.length > 140 ? description.substring(0, 140) + "…" : description;

  const tableRows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Claim #",     value: `#${claimId}`, mono: true },
    { label: "Customer",    value: customerName },
    { label: "Email",       value: customerEmail },
    { label: "Type",        value: typeLabel },
    { label: "Company",     value: `${companyName} (/${slug})` },
    ...(claimedAmount != null ? [{ label: "Claimed",  value: `$${claimedAmount.toFixed(2)}` }] : []),
    ...(bookingId    != null ? [{ label: "Booking #", value: `#${bookingId}`, mono: true }]    : []),
    { label: "Details",     value: descPreview },
  ];

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">New Claim Submitted</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      A new <strong>${typeLabel}</strong> claim has been filed for <strong>${companyName}</strong> and requires your attention.
    </p>
    ${infoTable(tableRows)}
    ${ctaButton("Review Claim in Console", claimsUrl, "#dc2626")}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      Log in to the Super Admin console to update the status or add notes.
    </p>
  `;

  const html = emailShell({
    preheader: `New ${typeLabel} claim from ${customerName} at ${companyName} — action required.`,
    badgeLabel: "New Claim — Action Required",
    badgeColor: "#dc2626",
    body,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, `[Claim #${claimId}] New ${typeLabel} claim — ${companyName}`, html) },
  });
}
