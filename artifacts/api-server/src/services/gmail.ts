import { google } from "googleapis";
import nodemailer from "nodemailer";
import { AsyncLocalStorage } from "async_hooks";

// ── SMTP context (per-request, safe for concurrency) ──────────────────────────
export interface SmtpCreds {
  user: string;
  pass: string;
  fromName?: string;
}

const smtpStorage = new AsyncLocalStorage<SmtpCreds | null>();

/** Wrap any email-sending call so it uses the tenant's SMTP credentials. */
export async function withSmtpCreds<T>(
  creds: SmtpCreds | null | undefined,
  fn: () => Promise<T>
): Promise<T> {
  return smtpStorage.run(creds ?? null, fn);
}

// ── Brand context (per-request, safe for concurrency) ─────────────────────────
export interface BrandOpts {
  logoUrl?: string | null;
  primaryColor?: string | null;
  companyName?: string | null;
  contactEmail?: string | null;
}

const brandStorage = new AsyncLocalStorage<BrandOpts | null>();

/** Wrap any email-sending call so it uses the tenant's brand. */
export async function withBrand<T>(
  brand: BrandOpts | null | undefined,
  fn: () => Promise<T>
): Promise<T> {
  return brandStorage.run(brand ?? null, fn);
}

/** Parse the base64url-encoded raw MIME message produced by makeRawEmail(). */
function parseRawMime(raw: string): { to: string; subject: string; replyTo?: string; html: string } {
  const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  const [headerBlock, ...rest] = decoded.split("\r\n\r\n");
  const headerLines = headerBlock.split("\r\n");

  const getHeader = (name: string) => {
    const line = headerLines.find(h => h.toLowerCase().startsWith(name.toLowerCase() + ":"));
    return line ? line.slice(name.length + 1).trim() : "";
  };

  const to = getHeader("To");
  const rawSubject = getHeader("Subject");
  const replyTo = getHeader("Reply-To") || undefined;

  // Decode =?UTF-8?B?...?= encoded subject
  const subjectMatch = rawSubject.match(/=\?UTF-8\?B\?([^?]+)\?=/i);
  const subject = subjectMatch
    ? Buffer.from(subjectMatch[1], "base64").toString("utf8")
    : rawSubject;

  // Extract HTML between the first content block and the closing boundary
  const body = rest.join("\r\n\r\n");
  const htmlStart = body.indexOf("\r\n\r\n") + 4;
  const boundaryEnd = body.lastIndexOf("\r\n--boundary_outdoorshare--");
  const html = boundaryEnd > htmlStart ? body.slice(htmlStart, boundaryEnd) : body.slice(htmlStart);

  return { to, subject, replyTo, html };
}

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

async function getGmailClientDirect() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

/** Returns either a real Gmail API client or an SMTP-backed mock, depending on context. */
async function getUncachableGmailClient() {
  const smtpCreds = smtpStorage.getStore();
  if (smtpCreds) {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: { user: smtpCreds.user, pass: smtpCreds.pass },
    });
    const fromLabel = smtpCreds.fromName
      ? `${smtpCreds.fromName} <${smtpCreds.user}>`
      : smtpCreds.user;

    return {
      users: {
        messages: {
          send: async ({ requestBody }: { requestBody: { raw: string } }) => {
            const { to, subject, replyTo, html } = parseRawMime(requestBody.raw);
            await transporter.sendMail({
              from: fromLabel,
              to,
              subject,
              html,
              ...(replyTo && { replyTo }),
            });
          },
        },
      },
    };
  }
  return getGmailClientDirect();
}

const PLATFORM_FROM = "OutdoorShare <samhos@myoutdoorshare.com>";

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

// ── Brand constants (platform defaults) ───────────────────────────────────────
const BRAND_GREEN = "#3ab549";
const BRAND_DARK  = "#1a2332";
const PLATFORM_LOGO_URL = `${APP_URL}/outdoorshare-logo.png`;

// ── Shared HTML wrapper ────────────────────────────────────────────────────────
function emailShell(opts: {
  preheader: string;
  badgeLabel: string;
  badgeColor: string;
  body: string;
}): string {
  // Pull tenant branding from context (set via withBrand), falling back to platform defaults
  const brand       = brandStorage.getStore();
  const accentColor = brand?.primaryColor  || BRAND_GREEN;
  const companyName = brand?.companyName   || "OutdoorShare";
  const contactEmail = brand?.contactEmail || "samhos@myoutdoorshare.com";

  // Header: tenant logo → tenant name text → platform logo (fallback cascade)
  const logoSrc   = brand?.logoUrl || (brand ? null : PLATFORM_LOGO_URL);
  const headerHtml = logoSrc
    ? `<img src="${logoSrc}" alt="${companyName}" width="180" style="display:inline-block;max-width:180px;max-height:80px;height:auto;object-fit:contain;" />`
    : `<span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">${companyName}</span>`;

  const { preheader, badgeLabel, badgeColor, body } = opts;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${companyName}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f0;font-family:'Helvetica Neue',Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</span>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f2f0;min-height:100vh;">
    <tr>
      <td align="center" valign="top" style="padding:40px 16px;">

        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- Header: brand logo / name on dark bg -->
          <tr>
            <td style="background:${BRAND_DARK};padding:28px 40px;text-align:center;">
              ${headerHtml}
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
                <strong style="color:${accentColor};">${companyName}</strong>
              </p>
              <p style="margin:0;font-size:11px;color:#9ca3af;">
                Questions? <a href="mailto:${contactEmail}" style="color:#9ca3af;">${contactEmail}</a>
              </p>
              <p style="margin:8px 0 0;font-size:10px;color:#d1d5db;">Powered by OutdoorShare</p>
            </td>
          </tr>

        </table>

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
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;
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

// ── Email verification ─────────────────────────────────────────────────────────
export async function sendVerificationEmail(opts: {
  toEmail: string;
  companyName: string;
  verifyUrl: string;
}): Promise<void> {
  const { toEmail, companyName, verifyUrl } = opts;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Verify your email address</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Thanks for signing up, <strong>${companyName}</strong>! Click the button below to verify your email address
      and activate your OutdoorShare account. This link expires in <strong>24 hours</strong>.
    </p>

    ${ctaButton("Verify My Email", verifyUrl)}

    <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
      If you didn't create an OutdoorShare account, you can safely ignore this email.
    </p>
  `;

  const html = emailShell({
    preheader: `Verify your email to activate your OutdoorShare account for ${companyName}.`,
    badgeLabel: "Verify Your Email",
    badgeColor: BRAND_GREEN,
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, `Verify your email — ${companyName} on OutdoorShare`, html) },
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
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;
  const replyTo = companyEmail || undefined;

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
    requestBody: { raw: makeRawEmail(toEmail, subject, html, fromHeader, replyTo) },
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
    ? `${companyName} <samhos@myoutdoorshare.com>`
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
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;
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

// ── Claim settlement email (to renter) ─────────────────────────────────────────
export async function sendClaimSettlementEmail(opts: {
  claimId: number;
  customerName: string;
  customerEmail: string;
  type: string;
  companyName: string;
  tenantSlug: string;
  chargedAmount: number;      // deposit that was captured
  settledAmount: number | null; // damages kept by company
  refundAmount: number;        // amount refunded to renter
  noRefund: boolean;           // true if company kept everything
  adminNotes?: string | null;
  adminEmail?: string;
}): Promise<void> {
  const {
    claimId, customerName, customerEmail, type, companyName, tenantSlug,
    chargedAmount, settledAmount, refundAmount, noRefund, adminNotes, adminEmail,
  } = opts;

  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;

  const typeLabel = type === "policy_violation" ? "Policy Violation"
    : type.charAt(0).toUpperCase() + type.slice(1);

  const tableRows: { label: string; value: string; mono?: boolean }[] = [
    { label: "Claim #",          value: `#${claimId}`, mono: true },
    { label: "Company",          value: companyName },
    { label: "Claim Type",       value: typeLabel },
    { label: "Deposit Captured", value: `$${chargedAmount.toFixed(2)}` },
    ...(settledAmount != null ? [{ label: "Damages Settled",  value: `$${settledAmount.toFixed(2)}` }] : []),
    {
      label: "Refund to You",
      value: noRefund ? "No refund — full deposit retained" : `$${refundAmount.toFixed(2)}`,
    },
    ...(adminNotes ? [{ label: "Notes", value: adminNotes }] : []),
  ];

  const refundColor = noRefund ? "#dc2626" : "#16a34a";
  const refundNote = noRefund
    ? `After review, <strong>${companyName}</strong> has determined that no refund is applicable and has retained the full security deposit of <strong>$${chargedAmount.toFixed(2)}</strong>.`
    : `After review, <strong>${companyName}</strong> has resolved this claim. A refund of <strong style="color:#16a34a;">$${refundAmount.toFixed(2)}</strong> will be returned to your original payment method within 5–10 business days.`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Your Claim Has Been Resolved</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Dear <strong>${customerName}</strong>, your ${typeLabel.toLowerCase()} claim (<strong>#${claimId}</strong>) with <strong>${companyName}</strong> has been fully resolved.
    </p>
    ${infoTable(tableRows)}
    <div style="background:${noRefund ? "#fef2f2" : "#f0fdf4"};border:1px solid ${noRefund ? "#fecaca" : "#bbf7d0"};border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0;font-size:14px;color:${refundColor};line-height:1.6;">${refundNote}</p>
    </div>
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">
      Questions? Reply to this email or contact <strong>${companyName}</strong> directly.
    </p>
  `;

  const html = emailShell({
    preheader: noRefund
      ? `Your claim #${claimId} has been resolved — no refund applicable.`
      : `Your claim #${claimId} has been resolved — $${refundAmount.toFixed(2)} refund is on its way.`,
    badgeLabel: `Claim #${claimId} Resolved`,
    badgeColor: "#16a34a",
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: makeRawEmail(
        customerEmail,
        noRefund
          ? `[Claim #${claimId}] Resolved — No Refund | ${companyName}`
          : `[Claim #${claimId}] Resolved — $${refundAmount.toFixed(2)} Refund | ${companyName}`,
        html,
        fromHeader,
      ),
    },
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
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;
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
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;

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
        "samhos@myoutdoorshare.com",
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
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;
  const replyToEmail = companyEmail || undefined;
  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: makeRawEmail(
        toEmail,
        `Your ${listingTitle} rental is confirmed — pickup details inside`,
        html,
        fromHeader,
        replyToEmail,
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

// ── Pre-pickup reminder to RENTER (timed, ~12 hrs before pickup day) ──────────
export async function sendPrePickupReminderRenterEmail(opts: {
  customerName: string;
  customerEmail: string;
  bookingId: number;
  listingTitle: string;
  startDate: string;
  endDate: string;
  pickupTime?: string | null;
  pickupAddress?: string | null;
  companyName: string;
  tenantSlug?: string;
  adminEmail?: string;
  contactPhone?: string | null;
}): Promise<void> {
  const { customerName, customerEmail, bookingId, listingTitle, startDate, endDate, pickupTime, pickupAddress, companyName, tenantSlug, adminEmail, contactPhone } = opts;
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;
  const bookingUrl = tenantSlug ? `${APP_URL}/${tenantSlug}/my-bookings/${bookingId}` : null;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Your rental starts soon, ${customerName}!</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      This is a reminder that your <strong>${listingTitle}</strong> rental at <strong>${companyName}</strong> is coming up.
    </p>

    ${infoTable([
      { label: "Booking #",    value: `#${bookingId}`, mono: true },
      { label: "Item",         value: listingTitle },
      { label: "Pickup Date",  value: startDate },
      { label: "Return Date",  value: endDate },
      ...(pickupTime ? [{ label: "Pickup Time", value: pickupTime }] : []),
      ...(pickupAddress ? [{ label: "Pickup Address", value: pickupAddress }] : []),
      ...(contactPhone ? [{ label: "Company Phone", value: contactPhone }] : []),
    ])}

    <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#713f12;">📸 Step 2 when you arrive — upload photos</p>
      <p style="margin:0 0 10px;font-size:13px;color:#92400e;line-height:1.6;">
        After picking up your rental, you'll need to photograph the equipment condition before leaving. This protects you.
      </p>
      <ul style="margin:0;padding-left:20px;font-size:13px;color:#92400e;line-height:2;">
        <li>1 Front</li><li>1 Left Side</li><li>1 Right Side</li><li>1 Rear</li><li>1 Interior / Detail</li>
      </ul>
      <p style="margin:10px 0 0;font-size:12px;color:#92400e;">A link to the photo portal will be in your confirmation or available in your booking page.</p>
    </div>

    ${bookingUrl ? ctaButton("View Your Booking", bookingUrl, BRAND_DARK) : ""}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">Questions? Reply to this email — <strong>${companyName}</strong> will get back to you.</p>
  `;

  const html = emailShell({
    preheader: `Reminder: Your ${listingTitle} rental starts on ${startDate} — see your pickup details inside.`,
    badgeLabel: "Rental Reminder",
    badgeColor: "#f59e0b",
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(customerEmail, `[${companyName}] Reminder — your rental starts soon 🚀`, html, fromHeader, adminEmail) },
  });
}

// ── Pre-pickup reminder to ADMIN (timed, ~12 hrs before pickup day) ────────────
export async function sendPrePickupReminderAdminEmail(opts: {
  adminEmail: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  bookingId: number;
  listingTitle: string;
  startDate: string;
  endDate: string;
  pickupTime?: string | null;
  companyName: string;
  tenantSlug: string;
}): Promise<void> {
  const { adminEmail, customerName, customerEmail, customerPhone, bookingId, listingTitle, startDate, endDate, pickupTime, companyName, tenantSlug } = opts;
  const adminBookingUrl = `${APP_URL}/${tenantSlug}/admin/bookings/${bookingId}`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Pickup arriving soon — action needed</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      <strong>${customerName}</strong> is picking up <strong>${listingTitle}</strong> tomorrow (${startDate}). Make sure they complete the photo documentation at pickup.
    </p>

    ${infoTable([
      { label: "Booking #",   value: `#${bookingId}`, mono: true },
      { label: "Customer",    value: customerName },
      { label: "Email",       value: customerEmail },
      ...(customerPhone ? [{ label: "Phone", value: customerPhone }] : []),
      { label: "Item",        value: listingTitle },
      { label: "Pickup",      value: `${startDate}${pickupTime ? ` at ${pickupTime}` : ""}` },
      { label: "Return",      value: endDate },
    ])}

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:24px 0;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#9a3412;">⚠️ What you must do at pickup</p>
      <ol style="margin:0;padding-left:20px;font-size:13px;color:#c2410c;line-height:2;">
        <li>Greet <strong>${customerName}</strong> at the agreed pickup time and address.</li>
        <li>Send them the <strong>pickup photo link</strong> from their booking page so they can document equipment condition.</li>
        <li>Do <strong>not</strong> hand over equipment until at least 5 photos are uploaded.</li>
        <li>Their <strong>security deposit</strong> will be automatically held when photos are submitted.</li>
      </ol>
    </div>

    ${ctaButton("Open Booking in Dashboard", adminBookingUrl, BRAND_DARK)}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">This is an automated reminder sent ~12 hours before every pickup.</p>
  `;

  const html = emailShell({
    preheader: `${customerName} picks up ${listingTitle} on ${startDate} — don't forget pickup photos!`,
    badgeLabel: "⏰ Pickup Reminder — Action Needed",
    badgeColor: "#f97316",
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(adminEmail, `[${companyName}] Pickup reminder — ${customerName} · ${listingTitle} tomorrow`, html) },
  });
}

// ── Return reminder to RENTER (timed, ~24 hrs before return date) ─────────────
export async function sendReturnReminderRenterEmail(opts: {
  customerName: string;
  customerEmail: string;
  bookingId: number;
  listingTitle: string;
  startDate: string;
  endDate: string;
  companyName: string;
  tenantSlug?: string;
  adminEmail?: string;
  depositNote?: string;
}): Promise<void> {
  const { customerName, customerEmail, bookingId, listingTitle, startDate, endDate, companyName, tenantSlug, adminEmail, depositNote } = opts;
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;
  const bookingUrl = tenantSlug ? `${APP_URL}/${tenantSlug}/my-bookings/${bookingId}` : null;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Return reminder — due tomorrow, ${customerName}</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Your <strong>${listingTitle}</strong> rental is due back to <strong>${companyName}</strong> tomorrow (<strong>${endDate}</strong>).
      Please plan your return in advance to avoid any late fees.
    </p>

    ${infoTable([
      { label: "Booking #",   value: `#${bookingId}`, mono: true },
      { label: "Item",        value: listingTitle },
      { label: "Rental Start", value: startDate },
      { label: "Due Back",    value: endDate },
      { label: "Company",     value: companyName },
    ])}

    ${depositNote ? `
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600;">💰 Security Deposit</p>
      <p style="margin:6px 0 0;font-size:13px;color:#1d4ed8;line-height:1.6;">${depositNote}</p>
    </div>` : ""}

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin:20px 0;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#166534;">📸 Return photos required</p>
      <p style="margin:0;font-size:13px;color:#15803d;line-height:1.6;">
        When you drop off the equipment your rental company will send you a return photo link.
        Please photograph all sides of the equipment to protect yourself against any damage claims.
      </p>
    </div>

    ${bookingUrl ? ctaButton("View Your Booking", bookingUrl, "#1d4ed8") : ""}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;">Questions about your return? Reply to this email — <strong>${companyName}</strong> will help.</p>
  `;

  const html = emailShell({
    preheader: `Your ${listingTitle} is due back tomorrow (${endDate}) — return info inside.`,
    badgeLabel: "Return Due Tomorrow",
    badgeColor: "#3b82f6",
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(customerEmail, `[${companyName}] Return reminder — your rental is due back tomorrow`, html, fromHeader, adminEmail) },
  });
}

// ── Chat: renter message → admin email ────────────────────────────────────────
export async function sendChatMessageToAdminEmail(opts: {
  adminEmail: string;
  companyName: string;
  customerName: string;
  customerEmail: string;
  messageBody: string;
  threadId: number;
  slug: string;
}): Promise<void> {
  const { adminEmail, companyName, customerName, customerEmail, messageBody, threadId, slug } = opts;
  const chatUrl = `${APP_URL}/${slug}/admin/messages?thread=${threadId}`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">New message from ${customerName}</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      A renter has sent you a message through the chat system. Reply directly in your admin portal.
    </p>

    ${infoTable([
      { label: "From",    value: `${customerName} (${customerEmail})` },
      { label: "Message", value: messageBody },
    ])}

    ${ctaButton("View & Reply in Admin Portal", chatUrl, BRAND_GREEN)}
  `;

  const html = emailShell({
    preheader: `${customerName} sent you a message: "${messageBody.substring(0, 60)}…"`,
    badgeLabel: "New Customer Message",
    badgeColor: BRAND_GREEN,
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(adminEmail, `[${companyName}] New message from ${customerName}`, html) },
  });
}

// ── Chat: admin reply → renter email ─────────────────────────────────────────
export async function sendChatReplyToRenterEmail(opts: {
  renterEmail: string;
  renterName: string;
  companyName: string;
  companyEmail?: string;
  messageBody: string;
  threadId: number;
  slug: string;
}): Promise<void> {
  const { renterEmail, renterName, companyName, companyEmail, messageBody, threadId, slug } = opts;
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;
  const replyToEmail = companyEmail || undefined;
  const chatUrl = `${APP_URL}/${slug}`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">You have a reply, ${renterName}!</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      ${companyName} replied to your message.
    </p>

    ${infoTable([
      { label: "From",    value: companyName },
      { label: "Message", value: messageBody },
    ])}

    ${ctaButton("View Conversation", chatUrl, BRAND_GREEN)}
  `;

  const html = emailShell({
    preheader: `${companyName} replied: "${messageBody.substring(0, 60)}…"`,
    badgeLabel: "Reply from the Team",
    badgeColor: BRAND_GREEN,
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(renterEmail, `[${companyName}] You have a new reply`, html, fromHeader, replyToEmail) },
  });
}

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
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;
  const replyToEmail = companyEmail || undefined;

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
    requestBody: { raw: makeRawEmail(toEmail, subject, html, fromHeader, replyToEmail) },
  });
}

// ── Stripe account restricted — action required alert ─────────────────────────
export async function sendStripeRestrictedAlertEmail(opts: {
  adminEmail: string;
  companyName: string;
  tenantSlug: string;
  disabledReason?: string | null;
  isReminder?: boolean;
}): Promise<void> {
  const { adminEmail, companyName, tenantSlug, disabledReason, isReminder } = opts;

  const settingsUrl = `${APP_URL}/${tenantSlug}/admin/settings`;

  const reasonMap: Record<string, string> = {
    fields_needed: "Stripe requires updated business or identity information before payments can resume.",
    listed: "Your account has been flagged for review by Stripe's compliance team.",
    rejected_fraud: "Your account has been suspended for suspected fraudulent activity. Contact Stripe support.",
    rejected_listed: "Your account has been suspended. Contact Stripe support for assistance.",
    rejected_terms_of_service: "Your account was suspended for a terms of service violation. Contact Stripe support.",
    under_review: "Your account is currently under review by Stripe. No action needed — we'll notify you when resolved.",
    other: "Stripe has temporarily disabled payments on your account. Please update your account information.",
  };
  const reasonKey = disabledReason?.replace(/\./g, "_") ?? "other";
  const reasonText = reasonMap[reasonKey] ?? reasonMap["other"];

  const badgeLabel = isReminder ? "Reminder — Stripe Account Still Restricted" : "Action Required — Stripe Account Restricted";
  const subject = isReminder
    ? `[OutdoorShare] Reminder: your Stripe account is still restricted`
    : `[OutdoorShare] Action required: your Stripe account has been restricted`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">
      ${isReminder ? "Reminder: Stripe Payments Still Paused" : "Stripe Payments Have Been Paused"}
    </p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${companyName}</strong>,${isReminder ? " we wanted to follow up —" : ""} Stripe has <strong>temporarily paused payments</strong> on your account.
      Renters will not be able to complete bookings until this is resolved.
    </p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:0 0 24px;">
      <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#991b1b;">⚠️ Why this happened</p>
      <p style="margin:0;font-size:13px;color:#7f1d1d;line-height:1.6;">${reasonText}</p>
    </div>

    ${infoTable([
      { label: "Account",   value: companyName },
      { label: "Status",    value: "Restricted — payments paused", mono: false },
      { label: "Reason",    value: disabledReason ?? "Unknown", mono: true },
    ])}

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;">
      <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#166534;">✅ How to fix it</p>
      <ol style="margin:0;padding-left:20px;font-size:13px;color:#15803d;line-height:2.0;">
        <li>Click <strong>"Update Stripe Account"</strong> below to open your settings.</li>
        <li>In the <em>Payments</em> section, click <strong>"Update Account"</strong>.</li>
        <li>Complete any outstanding requirements in the Stripe dashboard.</li>
        <li>Once Stripe approves your updates, payments resume automatically.</li>
      </ol>
    </div>

    ${ctaButton("Update Stripe Account →", settingsUrl, "#dc2626")}

    <p style="margin:0;font-size:13px;color:#6b7280;text-align:center;line-height:1.6;">
      Need help? Reply to this email or reach us at
      <a href="mailto:samhos@myoutdoorshare.com" style="color:#3ab549;">samhos@myoutdoorshare.com</a>
    </p>
  `;

  const html = emailShell({
    preheader: `Action required — Stripe has paused payments on your ${companyName} account. Update your information to resume.`,
    badgeLabel,
    badgeColor: "#dc2626",
    body,
  });

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(adminEmail, subject, html, PLATFORM_FROM) },
  });
}

// ── Agreement link email (sent to renter so they can sign the rental agreement remotely) ──
export async function sendAgreementLinkEmail(opts: {
  toEmail: string;
  customerName: string;
  agreementUrl: string;
  listingTitle: string;
  startDate: string;
  endDate: string;
  companyName: string;
  companyEmail?: string;
}): Promise<void> {
  const { toEmail, customerName, agreementUrl, listingTitle, startDate, endDate, companyName, companyEmail } = opts;
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;
  const replyToEmail = companyEmail || undefined;
  const subject = `[${companyName}] Please sign your rental agreement`;
  const preheader = `Action required — sign your rental agreement for ${listingTitle} before pickup.`;

  const tableRows = [
    { label: "Equipment",    value: listingTitle },
    { label: "Pickup Date",  value: startDate },
    { label: "Return Date",  value: endDate },
    { label: "Company",      value: companyName },
  ];

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Your rental agreement is ready to sign</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${customerName}</strong>, your upcoming rental with <strong>${companyName}</strong> requires you to review and sign the rental agreement before pickup.
      Please click the button below to complete this step.
    </p>
    ${infoTable(tableRows)}
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 18px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600;">
        📋 You'll be able to review and sign the agreement digitally. No printing required.
      </p>
    </div>
    ${ctaButton("Sign Rental Agreement →", agreementUrl, BRAND_GREEN)}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
      Questions? Contact <strong>${companyName}</strong> directly.
    </p>
  `;

  const html = emailShell({ preheader, badgeLabel: "Action Required — Sign Agreement", badgeColor: BRAND_GREEN, body });
  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, subject, html, fromHeader, replyToEmail) },
  });
}

// ── Identity verification email (sent to renter so they can verify via Stripe Identity) ──
export async function sendIdentityVerificationEmail(opts: {
  toEmail: string;
  customerName: string;
  verificationUrl: string;
  listingTitle: string;
  companyName: string;
  companyEmail?: string;
}): Promise<void> {
  const { toEmail, customerName, verificationUrl, listingTitle, companyName, companyEmail } = opts;
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;
  const replyToEmail = companyEmail || undefined;
  const subject = `[${companyName}] Identity verification required for your rental`;
  const preheader = `Verify your identity before your rental pickup — takes under 2 minutes.`;

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Identity verification required</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${customerName}</strong>, <strong>${companyName}</strong> requires identity verification before your rental of <strong>${listingTitle}</strong>.
      This is a quick, secure process powered by Stripe that takes under 2 minutes.
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 18px;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:13px;color:#166534;font-weight:600;">🔒 What you'll need:</p>
      <ul style="margin:6px 0 0;padding-left:18px;font-size:13px;color:#15803d;line-height:1.8;">
        <li>A government-issued ID (driver's license, passport, or ID card)</li>
        <li>A device with a camera for a quick selfie</li>
      </ul>
    </div>
    ${ctaButton("Verify My Identity →", verificationUrl, BRAND_GREEN)}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
      Your information is encrypted and handled securely by Stripe. <strong>${companyName}</strong> does not store your ID.<br/>
      Questions? Contact <strong>${companyName}</strong> directly.
    </p>
  `;

  const html = emailShell({ preheader, badgeLabel: "Action Required — Verify Identity", badgeColor: BRAND_GREEN, body });
  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, subject, html, fromHeader, replyToEmail) },
  });
}

// ── Payment request email (sent to renter when admin creates a booking with payment link) ──
export async function sendPaymentRequestEmail(opts: {
  toEmail: string;
  customerName: string;
  paymentUrl: string;
  listingTitle: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  companyName: string;
  companyEmail?: string;
}): Promise<void> {
  const { toEmail, customerName, paymentUrl, listingTitle, startDate, endDate, totalPrice, companyName, companyEmail } = opts;
  const fromHeader = `${companyName} <samhos@myoutdoorshare.com>`;
  const replyToEmail = companyEmail || undefined;
  const subject = `[${companyName}] Complete your rental payment — ${listingTitle}`;
  const preheader = `Your rental from ${companyName} is reserved. Complete payment to confirm your booking.`;

  const tableRows = [
    { label: "Equipment",    value: listingTitle },
    { label: "Pickup Date",  value: startDate },
    { label: "Return Date",  value: endDate },
    { label: "Total Due",    value: `$${totalPrice.toFixed(2)}` },
    { label: "Company",      value: companyName },
  ];

  const body = `
    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:${BRAND_DARK};">Your rental is reserved — payment required</p>
    <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
      Hi <strong>${customerName}</strong>, <strong>${companyName}</strong> has created a rental booking for you.
      Complete your secure payment below to confirm the reservation. Your booking will remain pending until payment is received.
    </p>
    ${infoTable(tableRows)}
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin:20px 0;">
      <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">
        🔒 Secure checkout powered by Stripe — your card details are never shared with us.
      </p>
    </div>
    ${ctaButton("Complete Payment →", paymentUrl, BRAND_GREEN)}
    <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6;">
      After payment you will receive a confirmation and instructions for your rental pickup.<br/>
      Questions? Contact <strong>${companyName}</strong> directly.
    </p>
  `;

  const html = emailShell({ preheader, badgeLabel: "Action Required — Complete Payment", badgeColor: BRAND_GREEN, body });
  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, subject, html, fromHeader, replyToEmail) },
  });
}
