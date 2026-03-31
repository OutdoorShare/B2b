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

function makeRawEmail(to: string, subject: string, htmlBody: string): string {
  const boundary = "boundary_outdoorshare";
  const message = [
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

export async function sendWelcomeEmail(opts: {
  toEmail: string;
  companyName: string;
  slug: string;
  password: string;
}): Promise<void> {
  const { toEmail, companyName, slug, password } = opts;
  const loginUrl = `${APP_URL}/admin`;

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #16a34a; padding: 32px 40px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Welcome to OutdoorShare</h1>
    </div>
    <div style="padding: 32px 40px;">
      <p style="font-size: 16px; color: #333;">Hi there,</p>
      <p style="font-size: 16px; color: #333;">
        Your rental management account for <strong>${companyName}</strong> has been created and is ready to go.
      </p>
      <table style="background: #f9fafb; border-radius: 6px; padding: 20px 24px; width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr>
          <td style="padding: 8px 0; color: #555; font-size: 14px; width: 120px;"><strong>Email</strong></td>
          <td style="padding: 8px 0; font-size: 14px; color: #111;">${toEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #555; font-size: 14px;"><strong>Password</strong></td>
          <td style="padding: 8px 0; font-size: 14px; color: #111; font-family: monospace;">${password}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #555; font-size: 14px;"><strong>Storefront</strong></td>
          <td style="padding: 8px 0; font-size: 14px;"><a href="${APP_URL}/${slug}" style="color: #16a34a;">${APP_URL}/${slug}</a></td>
        </tr>
      </table>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${loginUrl}" style="background: #16a34a; color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">
          Log In to Your Dashboard
        </a>
      </div>
      <p style="font-size: 14px; color: #888; text-align: center;">
        We recommend changing your password after your first login.
      </p>
    </div>
    <div style="background: #f0fdf4; padding: 16px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #999; margin: 0;">Powered by OutdoorShare &mdash; Rental Management Platform</p>
    </div>
  </div>
</body>
</html>`;

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, `Your OutdoorShare account for ${companyName} is ready`, html) },
  });
}

export async function sendAccountUpdatedEmail(opts: {
  toEmail: string;
  companyName: string;
  slug: string;
  passwordChanged: boolean;
  newPassword?: string;
}): Promise<void> {
  const { toEmail, companyName, slug, passwordChanged, newPassword } = opts;
  const loginUrl = `${APP_URL}/admin`;

  const passwordSection = passwordChanged && newPassword
    ? `<tr>
        <td style="padding: 8px 0; color: #555; font-size: 14px; width: 140px;"><strong>New Password</strong></td>
        <td style="padding: 8px 0; font-size: 14px; color: #111; font-family: monospace;">${newPassword}</td>
       </tr>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <div style="background: #1d4ed8; padding: 32px 40px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Account Updated</h1>
    </div>
    <div style="padding: 32px 40px;">
      <p style="font-size: 16px; color: #333;">Hi there,</p>
      <p style="font-size: 16px; color: #333;">
        Your <strong>OutdoorShare</strong> account for <strong>${companyName}</strong> has been updated by the platform administrator.
      </p>
      <table style="background: #f9fafb; border-radius: 6px; padding: 20px 24px; width: 100%; border-collapse: collapse; margin: 24px 0;">
        <tr>
          <td style="padding: 8px 0; color: #555; font-size: 14px; width: 140px;"><strong>Email</strong></td>
          <td style="padding: 8px 0; font-size: 14px; color: #111;">${toEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #555; font-size: 14px;"><strong>Storefront</strong></td>
          <td style="padding: 8px 0; font-size: 14px;"><a href="${APP_URL}/${slug}" style="color: #1d4ed8;">${APP_URL}/${slug}</a></td>
        </tr>
        ${passwordSection}
      </table>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${loginUrl}" style="background: #1d4ed8; color: #fff; text-decoration: none; padding: 14px 36px; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">
          Log In to Your Dashboard
        </a>
      </div>
      <p style="font-size: 14px; color: #888; text-align: center;">
        If you did not expect this change, please contact us immediately.
      </p>
    </div>
    <div style="background: #eff6ff; padding: 16px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #999; margin: 0;">Powered by OutdoorShare &mdash; Rental Management Platform</p>
    </div>
  </div>
</body>
</html>`;

  const gmail = await getUncachableGmailClient();
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: makeRawEmail(toEmail, `Your OutdoorShare account has been updated`, html) },
  });
}
