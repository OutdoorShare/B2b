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

function encodeSubject(subject: string): string {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function makeRawEmail(to: string, subject: string, htmlBody: string, from?: string, replyTo?: string): string {
  const boundary = "boundary_outdoorshare";
  const lines = [
    `From: ${from ?? PLATFORM_FROM}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  if (replyTo) lines.push(`Reply-To: ${replyTo}`);
  lines.push(
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
    `--${boundary}--`,
  );
  const message = lines.join("\r\n");
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

// ── Blast / manual message email ──────────────────────────────────────────────
export async function sendBlastEmail(opts: {
  toEmail: string;
  customerName: string;
  subject: string;
  bodyText: string;
  companyName: string;
  companyEmail?: string | null;
}): Promise<void> {
  const { toEmail, customerName, subject, bodyText, companyName, companyEmail } = opts;
  const fromHeader = `${companyName} via OutdoorShare <contact.us@myoutdoorshare.com>`;
  const replyTo = companyEmail || undefined;

  // Convert plain-text line breaks to HTML paragraphs
  const bodyHtml = bodyText
    .split(/\n\n+/)
    .map(para => `<p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">${para.replace(/\n/g, "<br />")}</p>`)
    .join("");

  const body = `
    <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:${BRAND_DARK};">Hi ${customerName},</p>
    ${bodyHtml}
    <p style="margin:24px 0 0;font-size:14px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">
      &mdash; The team at <strong>${companyName}</strong>
      ${companyEmail ? `&nbsp;·&nbsp;<a href="mailto:${companyEmail}" style="color:${BRAND_GREEN};">${companyEmail}</a>` : ""}
    </p>
  `;

  const html = emailShell({
    preheader: subject,
    badgeLabel: `Message from ${companyName}`,
    badgeColor: BRAND_DARK,
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, subject, html, fromHeader, replyTo) },
  });
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
  companyEmail?: string;
  hostPickup?: boolean;
}): Promise<void> {
  const { toEmail, customerName, pickupUrl, listingTitle, startDate, endDate, companyName, companyEmail, hostPickup } = opts;
  const fromHeader = companyEmail ? `${companyName} <${companyEmail}>` : undefined;

  const tableRows: { label: string; value: string }[] = [
    { label: "Equipment",   value: listingTitle },
    { label: "Pickup Date", value: startDate },
    { label: "Return Date", value: endDate },
    { label: "Company",     value: companyName },
  ];

  const headline = hostPickup
    ? "Please Upload Your Pickup Photos"
    : "Pre-Pickup Photo Check Required";

  const intro = hostPickup
    ? `Hi <strong>${customerName}</strong>, your host at <strong>${companyName}</strong> has completed the equipment handoff for your rental.
       Please take a moment to photograph the equipment's current condition using the link below.
       These photos are your record and protect you against any future damage claims.`
    : `Hi <strong>${customerName}</strong>, it's almost time to pick up your rental from <strong>${companyName}</strong>.
       Before pickup, please document the condition of the equipment by uploading photos using the link below.
       These photos protect you in case of any future damage claims.`;

  const badge = hostPickup ? "Action Required — Document Equipment Condition" : "Action Required — Upload Pickup Photos";
  const preheader = hostPickup
    ? `Your host has completed the handoff — please upload photos to document your ${listingTitle}.`
    : `Upload pickup photos for your ${listingTitle} rental — required before pickup.`;
  const subject = hostPickup
    ? `[${companyName}] Please document your rental equipment condition`
    : `[${companyName}] Please upload pickup photos for your rental`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">${headline}</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">${intro}</p>
    ${infoTable(tableRows)}
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#166534;font-weight:600;">📸 What to photograph:</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:13px;color:#15803d;line-height:1.8;">
        <li>All sides of the equipment (front, back, left, right)</li>
        <li>Any existing scratches, dents, or damage</li>
        <li>Serial numbers or identifying markings</li>
      </ul>
    </div>
    ${ctaButton("Upload Photos Now", pickupUrl, BRAND_GREEN)}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      This link is unique to your booking. You can upload multiple photos.
    </p>
  `;

  const html = emailShell({ preheader, badgeLabel: badge, badgeColor: BRAND_GREEN, body });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, subject, html, fromHeader) },
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
  tenantEmail?: string;
  installmentCount?: number;
  dueInDays?: number;
}): Promise<void> {
  const { claimId, customerName, customerEmail, amount, mode, paymentUrl, tenantName, tenantEmail, installmentCount, dueInDays } = opts;
  const fromHeader = tenantEmail ? `${tenantName} <${tenantEmail}>` : undefined;

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
    requestBody: { raw: makeRawEmail(customerEmail, `[Claim #${claimId}] Damage Charge Notice — $${amount.toFixed(2)}`, html, fromHeader) },
  });
}

// ── Credentials confirmation email ─────────────────────────────────────────────
export async function sendCredentialsEmail(opts: {
  customerName: string;
  customerEmail: string;
  tenantSlug: string;
  password: string;
  companyName?: string;
  adminEmail?: string;
}): Promise<void> {
  const { customerName, customerEmail, tenantSlug, password, companyName, adminEmail } = opts;
  const loginUrl = `${APP_URL}/${tenantSlug}/login`;
  const fromHeader = companyName
    ? `${companyName} <contact.us@myoutdoorshare.com>`
    : PLATFORM_FROM;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Your account is ready, ${customerName}!</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Here are your login credentials. Keep this email somewhere safe.
    </p>

    ${infoTable([
      { label: "Email",    value: customerEmail },
      { label: "Password", value: password, mono: true },
    ])}

    ${ctaButton("Sign In to My Account", loginUrl)}

    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      You can change your password at any time from your account settings.
    </p>
  `;

  const html = emailShell({
    preheader: `Your OutdoorShare account credentials for ${customerEmail}.`,
    badgeLabel: "Account Created",
    badgeColor: BRAND_GREEN,
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(customerEmail, "Your account login credentials", html, fromHeader, adminEmail) },
  });
}

// ── Kiosk account setup email ──────────────────────────────────────────────────
export async function sendKioskAccountSetupEmail(opts: {
  customerName: string;
  customerEmail: string;
  bookingId: number;
  tenantSlug: string;
  companyName: string;
  adminEmail?: string;
  startDate: string;
  endDate: string;
  listingTitle: string;
}): Promise<void> {
  const { customerName, customerEmail, bookingId, tenantSlug, companyName, adminEmail, startDate, endDate, listingTitle } = opts;
  const fromHeader = `${companyName} <contact.us@myoutdoorshare.com>`;
  const registerUrl = `${APP_URL}/${tenantSlug}/set-password?email=${encodeURIComponent(customerEmail)}`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Your booking is confirmed, ${customerName}!</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Thank you for booking with <strong>${companyName}</strong>. Your rental has been reserved — see the details below.
    </p>

    ${infoTable([
      { label: "Booking #",  value: `#${bookingId}`, mono: true },
      { label: "Item",       value: listingTitle },
      { label: "Pickup",     value: startDate },
      { label: "Return",     value: endDate },
      { label: "Company",    value: companyName },
    ])}

    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      <strong>Set up your free account</strong> to track your booking, view your rental agreement, and manage future rentals — all in one place.
    </p>

    ${ctaButton("Create My Account &amp; View Booking", registerUrl)}

    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      Already booked? Your email <strong>${customerEmail}</strong> is pre-filled — just choose a password to finish.
    </p>
  `;

  const html = emailShell({
    preheader: `Your rental at ${companyName} is confirmed (#${bookingId}). Set up your account to view it anytime.`,
    badgeLabel: "Booking Confirmed",
    badgeColor: BRAND_GREEN,
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(customerEmail, `Your rental at ${companyName} is confirmed — set up your account`, html, fromHeader, adminEmail) },
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

// ── Claim status change alert (to superadmin) ─────────────────────────────────
export async function sendClaimStatusAlertEmail(opts: {
  claimId: number;
  customerName: string;
  customerEmail: string;
  type: string;
  oldStatus: string;
  newStatus: string;
  companyName: string;
  slug: string;
  adminNotes?: string | null;
}): Promise<void> {
  const { claimId, customerName, customerEmail, type, oldStatus, newStatus, companyName, slug, adminNotes } = opts;

  const gmail = await getUncachableGmailClient();
  const profile = await gmail.users.getProfile({ userId: "me" });
  const toEmail = profile.data.emailAddress!;

  const claimsUrl = `${APP_URL}/superadmin/claims`;
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const statusColors: Record<string, string> = {
    open: "#dc2626", reviewing: "#d97706", resolved: "#16a34a", denied: "#6b7280",
  };
  const badgeColor = statusColors[newStatus] ?? BRAND_DARK;

  const tableRows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Claim #",   value: `#${claimId}`, mono: true },
    { label: "Customer",  value: customerName },
    { label: "Email",     value: customerEmail },
    { label: "Type",      value: typeLabel },
    { label: "Company",   value: `${companyName} (/${slug})` },
    { label: "Status",    value: `${capitalize(oldStatus)} → ${capitalize(newStatus)}` },
    ...(adminNotes ? [{ label: "Notes", value: adminNotes }] : []),
  ];

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Claim Status Updated</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Claim <strong>#${claimId}</strong> for <strong>${companyName}</strong> has been updated to
      <strong style="color:${badgeColor};">${capitalize(newStatus)}</strong>.
    </p>
    ${infoTable(tableRows)}
    ${ctaButton("View Claim in Console", claimsUrl, badgeColor)}
  `;

  const html = emailShell({
    preheader: `Claim #${claimId} status changed from ${oldStatus} to ${newStatus} — ${companyName}.`,
    badgeLabel: `Claim Updated — ${capitalize(newStatus)}`,
    badgeColor,
    body,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, `[Claim #${claimId}] Status updated to ${capitalize(newStatus)} — ${companyName}`, html) },
  });
}

// ── Booking confirmation + pickup reminder (to renter, non-kiosk) ──────────────
export async function sendBookingPickupReminderEmail(opts: {
  customerName: string;
  customerEmail: string;
  bookingId: number;
  listingTitle: string;
  startDate: string;
  endDate: string;
  companyName: string;
  tenantSlug?: string;
  adminEmail?: string;
}): Promise<void> {
  const { customerName, customerEmail, bookingId, listingTitle, startDate, endDate, companyName, tenantSlug, adminEmail } = opts;
  const fromHeader = `${companyName} <contact.us@myoutdoorshare.com>`;
  const bookingUrl = tenantSlug ? `${APP_URL}/${tenantSlug}/my-bookings/${bookingId}` : null;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Your booking is confirmed, ${customerName}!</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Thank you for booking with <strong>${companyName}</strong>. Your rental is all set — see the details below.
    </p>

    ${infoTable([
      { label: "Booking #",  value: `#${bookingId}`, mono: true },
      { label: "Item",       value: listingTitle },
      { label: "Pickup",     value: startDate },
      { label: "Return",     value: endDate },
      { label: "Company",    value: companyName },
    ])}

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#166534;">📸 When you arrive — take pickup photos</p>
      <p style="margin:0 0 10px;font-size:13px;color:#15803d;line-height:1.6;">
        Before taking your rental, you'll be asked to photograph the equipment. This protects you against any future damage claims.
      </p>
      <ul style="margin:0;padding-left:20px;font-size:13px;color:#15803d;line-height:2;">
        <li>1 Front</li>
        <li>1 Left Side</li>
        <li>1 Right Side</li>
        <li>1 Rear</li>
        <li>1 Interior</li>
      </ul>
    </div>

    ${bookingUrl ? `
    <div style="text-align:center;margin:28px 0;">
      <a href="${bookingUrl}" style="display:inline-block;background:#1a9c3c;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">
        View Your Booking &amp; Start Pickup →
      </a>
      <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">You'll be asked to log in to your account first.</p>
    </div>
    ` : ""}

    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      Questions? Reply to this email and <strong>${companyName}</strong> will get back to you.
    </p>
  `;

  const html = emailShell({
    preheader: `Your ${listingTitle} rental at ${companyName} is confirmed — see what to expect at pickup.`,
    badgeLabel: "Booking Confirmed",
    badgeColor: BRAND_GREEN,
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(customerEmail, `[${companyName}] Your rental is confirmed — here's what to expect`, html, fromHeader, adminEmail) },
  });
}

// ── Admin pickup reminder (to tenant admin, non-kiosk booking) ────────────────
export async function sendAdminPickupReminderEmail(opts: {
  adminEmail: string;
  customerName: string;
  customerEmail: string;
  bookingId: number;
  listingTitle: string;
  startDate: string;
  endDate: string;
  companyName: string;
  tenantSlug: string;
}): Promise<void> {
  const { adminEmail, customerName, customerEmail, bookingId, listingTitle, startDate, endDate, companyName, tenantSlug } = opts;
  const adminBookingsUrl = `${APP_URL}/${tenantSlug}/admin/bookings`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">New rental booking received</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      <strong>${customerName}</strong> has completed an online booking for <strong>${listingTitle}</strong>. See the details below.
    </p>

    ${infoTable([
      { label: "Booking #",  value: `#${bookingId}`, mono: true },
      { label: "Customer",   value: customerName },
      { label: "Email",      value: customerEmail },
      { label: "Item",       value: listingTitle },
      { label: "Pickup",     value: startDate },
      { label: "Return",     value: endDate },
    ])}

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#9a3412;">⚠️ Pickup reminder</p>
      <p style="margin:0;font-size:13px;color:#c2410c;line-height:1.6;">
        Before releasing the equipment to <strong>${customerName}</strong>, please ensure they complete the pickup photo documentation.
        This step is required to protect your business against any future damage disputes.
      </p>
    </div>

    ${ctaButton("View Booking in Dashboard", adminBookingsUrl, BRAND_DARK)}

    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      This is an automated reminder sent when a new online booking is confirmed.
    </p>
  `;

  const html = emailShell({
    preheader: `New booking from ${customerName} for ${listingTitle} starting ${startDate} — pickup photo reminder.`,
    badgeLabel: "New Booking — Pickup Reminder",
    badgeColor: "#f97316",
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(adminEmail, `[${companyName}] New booking — ${customerName} · ${listingTitle}`, html) },
  });
}

// ── Ready to adventure email (to renter after pickup photos completed) ─────────
export async function sendReadyToAdventureEmail(opts: {
  customerName: string;
  customerEmail: string;
  bookingId: number;
  listingTitle: string;
  startDate: string;
  endDate: string;
  companyName: string;
  adminEmail?: string;
}): Promise<void> {
  const { customerName, customerEmail, bookingId, listingTitle, startDate, endDate, companyName, adminEmail } = opts;
  const fromHeader = `${companyName} <contact.us@myoutdoorshare.com>`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">You're all set — enjoy your adventure, ${customerName}!</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Your pickup is complete and your <strong>${listingTitle}</strong> rental is officially underway. Your photos have been saved — you're good to go!
    </p>

    ${infoTable([
      { label: "Booking #",  value: `#${bookingId}`, mono: true },
      { label: "Item",       value: listingTitle },
      { label: "Started",    value: startDate },
      { label: "Return by",  value: endDate },
      { label: "Company",    value: companyName },
    ])}

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:24px 0;text-align:center;">
      <p style="margin:0 0 6px;font-size:22px;">🏔️</p>
      <p style="margin:0;font-size:15px;font-weight:700;color:#166534;">Find New Boundaries</p>
      <p style="margin:4px 0 0;font-size:13px;color:#15803d;">Make the most of your rental and stay safe out there.</p>
    </div>

    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;text-align:center;">
      Please return your rental by <strong>${endDate}</strong>.<br />
      Questions along the way? Reply to this email and <strong>${companyName}</strong> will be happy to help.
    </p>
  `;

  const html = emailShell({
    preheader: `Pickup complete — your ${listingTitle} adventure is officially underway. Enjoy!`,
    badgeLabel: "Pickup Complete — Adventure Begins!",
    badgeColor: BRAND_GREEN,
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(customerEmail, `[${companyName}] You're all set — enjoy your adventure! 🏔️`, html, fromHeader, adminEmail) },
  });
}

export async function sendAuditRequestEmail(opts: {
  name: string;
  email: string;
  phone?: string;
  businessName: string;
  website?: string;
  equipmentTypes?: string[];
  monthlyBookings?: string;
  annualRevenue?: string;
  painPoints?: string[];
  currentSoftware?: string;
  message?: string;
}): Promise<void> {
  const { name, email, phone, businessName, website, equipmentTypes, monthlyBookings, annualRevenue, painPoints, currentSoftware, message } = opts;

  const equipmentList = (equipmentTypes ?? []).join(", ") || "Not specified";
  const painList = (painPoints ?? []).join(", ") || "Not specified";

  const adminBody = `
    <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:${BRAND_DARK};">New Audit Request — ${businessName}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
      ${[
        ["Business", businessName],
        ["Contact", name],
        ["Email", email],
        ["Phone", phone || "—"],
        ["Website", website || "—"],
        ["Equipment Types", equipmentList],
        ["Monthly Bookings", monthlyBookings || "—"],
        ["Annual Revenue", annualRevenue || "—"],
        ["Current Software", currentSoftware || "—"],
        ["Pain Points", painList],
      ].map(([label, value]) => `
        <tr>
          <td style="padding:8px 12px;background:#f8faf8;border-bottom:1px solid #e5e7eb;font-weight:600;color:#374151;width:40%;">${label}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${value}</td>
        </tr>
      `).join("")}
    </table>
    ${message ? `<div style="margin-top:20px;padding:16px;background:#f8faf8;border-radius:8px;font-size:13px;color:#374151;"><strong>Additional notes:</strong><br/>${message}</div>` : ""}
  `;

  const adminHtml = emailShell({
    preheader: `New audit request from ${businessName} — ${name} (${email})`,
    badgeLabel: "Audit Request",
    badgeColor: "#f59e0b",
    body: adminBody,
  });

  const confirmBody = `
    <p style="margin:0 0 12px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Thanks, ${name}!</p>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      We received your free rental business audit request for <strong>${businessName}</strong>.
      Our team will review your submission and reach out within <strong>1 business day</strong>.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      In the meantime, feel free to explore the platform or start your free trial — no credit card required.
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${APP_URL}/signup" style="display:inline-block;background:${BRAND_GREEN};color:#ffffff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:999px;text-decoration:none;">
        Start Free Trial
      </a>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;">
      Have an urgent question? Call us at <a href="tel:8016530765" style="color:${BRAND_GREEN};">801-653-0765</a>
    </p>
  `;

  const confirmHtml = emailShell({
    preheader: "We received your audit request and will be in touch within 1 business day.",
    badgeLabel: "Request Received",
    badgeColor: BRAND_GREEN,
    body: confirmBody,
  });

  const gmail = await getUncachableGmailClient();

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: makeRawEmail(
        "contact.us@myoutdoorshare.com",
        `Audit Request — ${businessName}`,
        adminHtml,
        PLATFORM_FROM,
        email,
      ),
    },
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: makeRawEmail(
        email,
        "Your free rental business audit request — OutdoorShare",
        confirmHtml,
        PLATFORM_FROM,
      ),
    },
  });
}

// ── Contact Card email (to renter) ────────────────────────────────────────────
export async function sendContactCardEmail(opts: {
  toEmail: string;
  customerName: string;
  listingTitle: string;
  startDate: string;
  endDate: string;
  companyName: string;
  companyEmail?: string;
  contactCard: {
    name: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    specialInstructions?: string | null;
  };
}): Promise<void> {
  const { toEmail, customerName, listingTitle, startDate, endDate, companyName, companyEmail, contactCard } = opts;

  const rows: { label: string; value: string }[] = [
    { label: "Equipment", value: listingTitle },
    { label: "Pickup Date", value: startDate },
    { label: "Return Date", value: endDate },
  ];
  if (contactCard.address) rows.push({ label: "Pickup Address", value: contactCard.address });
  if (contactCard.phone) rows.push({ label: "Phone", value: `<a href="tel:${contactCard.phone}" style="color:${BRAND_GREEN};text-decoration:none;">${contactCard.phone}</a>` });
  if (contactCard.email) rows.push({ label: "Email", value: `<a href="mailto:${contactCard.email}" style="color:${BRAND_GREEN};text-decoration:none;">${contactCard.email}</a>` });

  const instructionsBlock = contactCard.specialInstructions
    ? `<div style="margin:24px 0;padding:16px 20px;background:#f0faf0;border-left:4px solid ${BRAND_GREEN};border-radius:0 8px 8px 0;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:${BRAND_GREEN};text-transform:uppercase;letter-spacing:1px;">Special Instructions</p>
        <p style="margin:0;font-size:14px;color:#1a2332;line-height:1.7;">${contactCard.specialInstructions.replace(/\n/g, "<br/>")}</p>
      </div>`
    : "";

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Your rental is confirmed! 🎉</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Hi ${customerName}, your booking with <strong>${companyName}</strong> has been approved. Here's everything you need to know to prepare for your rental.
    </p>

    ${infoTable(rows)}

    ${instructionsBlock}

    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;text-align:center;">
      Questions? Reach out to ${companyName} directly using the contact details above.
    </p>
  `;

  const html = emailShell({
    preheader: `Your ${listingTitle} rental with ${companyName} is confirmed — here's what you need to know.`,
    badgeLabel: "Booking Confirmed",
    badgeColor: BRAND_GREEN,
    body,
  });

  const gmail = await getUncachableGmailClient();
  const fromHeader = companyEmail ? `${companyName} <${companyEmail}>` : undefined;
  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: makeRawEmail(
        toEmail,
        `Your ${listingTitle} rental is confirmed — pickup details inside`,
        html,
        fromHeader ?? PLATFORM_FROM,
        fromHeader ? undefined : companyEmail,
      ),
    },
  });
}

// ── Admin booking notification (renter contact, no address) ──────────────────
export async function sendAdminBookingContactEmail(opts: {
  toEmail: string;
  companyName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  listingTitle: string;
  startDate: string;
  endDate: string;
  bookingId: number;
  slug: string;
}): Promise<void> {
  const { toEmail, companyName, customerName, customerEmail, customerPhone, listingTitle, startDate, endDate, bookingId, slug } = opts;

  const rows: { label: string; value: string }[] = [
    { label: "Guest", value: customerName },
    { label: "Email", value: `<a href="mailto:${customerEmail}" style="color:${BRAND_GREEN};text-decoration:none;">${customerEmail}</a>` },
  ];
  if (customerPhone) rows.push({ label: "Phone", value: `<a href="tel:${customerPhone}" style="color:${BRAND_GREEN};text-decoration:none;">${customerPhone}</a>` });
  rows.push({ label: "Equipment", value: listingTitle });
  rows.push({ label: "Pickup Date", value: startDate });
  rows.push({ label: "Return Date", value: endDate });

  const bookingUrl = `${APP_URL}/${slug}/admin/bookings/${bookingId}`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">New booking confirmed</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      A booking has been confirmed for <strong>${companyName}</strong>. Here is the renter's contact information so you can coordinate the pickup.
    </p>

    ${infoTable(rows)}

    ${ctaButton("View Booking", bookingUrl)}
  `;

  const html = emailShell({
    preheader: `${customerName} is confirmed for ${listingTitle} — ${startDate} to ${endDate}.`,
    badgeLabel: "Booking Confirmed",
    badgeColor: BRAND_DARK,
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: makeRawEmail(
        toEmail,
        `Booking confirmed — ${customerName} for ${listingTitle}`,
        html,
        PLATFORM_FROM,
      ),
    },
  });
}

// ── Return link email (to renter) ─────────────────────────────────────────────
export async function sendReturnLinkEmail(opts: {
  toEmail: string;
  customerName: string;
  returnUrl: string;
  listingTitle: string;
  startDate: string;
  endDate: string;
  companyName: string;
  companyEmail?: string;
}): Promise<void> {
  const { toEmail, customerName, returnUrl, listingTitle, startDate, endDate, companyName, companyEmail } = opts;
  const fromHeader = companyEmail ? `${companyName} <${companyEmail}>` : undefined;

  const tableRows = [
    { label: "Equipment",   value: listingTitle },
    { label: "Pickup Date", value: startDate },
    { label: "Return Date", value: endDate },
    { label: "Company",     value: companyName },
  ];

  const subject = `[${companyName}] Please upload return photos for your rental`;
  const preheader = `Upload return photos for your ${listingTitle} — protects you against any damage claims.`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Return Photo Documentation</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${customerName}</strong>, thank you for returning your rental to <strong>${companyName}</strong>.
      Please document the equipment's condition at return by uploading photos using the link below.
      These photos protect you against any after-the-fact damage claims.
    </p>
    ${infoTable(tableRows)}
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600;">📸 What to photograph at return:</p>
      <ul style="margin:8px 0 0;padding-left:20px;font-size:13px;color:#1d4ed8;line-height:1.8;">
        <li>All sides of the equipment (front, back, left, right)</li>
        <li>Any scratches, dents, or marks</li>
        <li>All accessories and parts returned</li>
      </ul>
    </div>
    ${ctaButton("Upload Return Photos", returnUrl, "#1d4ed8")}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      This link is unique to your booking. You can upload multiple photos.
    </p>
  `;

  const html = emailShell({ preheader, badgeLabel: "Action Required — Return Photo Check", badgeColor: "#1d4ed8", body });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, subject, html, fromHeader) },
  });
}
