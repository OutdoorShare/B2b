const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

function isConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM_NUMBER);
}

export async function sendSms(to: string, body: string): Promise<{
  success: true;
  sid: string;
} | {
  success: false;
  error: string;
  simulated: boolean;
}> {
  if (!isConfigured()) {
    console.warn("[SMS] Twilio not configured — message simulated. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER to enable.");
    return { success: false, error: "SMS provider not configured", simulated: true };
  }

  const normalised = normaliseTo(to);
  if (!normalised) {
    return { success: false, error: `Invalid phone number: ${to}`, simulated: false };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const creds = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

    const params = new URLSearchParams();
    params.set("To", normalised);
    params.set("From", TWILIO_FROM_NUMBER!);
    params.set("Body", body);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${creds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await res.json() as any;

    if (!res.ok) {
      const msg = data?.message ?? data?.code ?? `HTTP ${res.status}`;
      console.error(`[SMS] Twilio error to ${normalised}:`, msg);
      return { success: false, error: msg, simulated: false };
    }

    console.log(`[SMS] Sent to ${normalised} — SID: ${data.sid}`);
    return { success: true, sid: data.sid };
  } catch (err: any) {
    console.error("[SMS] Unexpected error:", err.message);
    return { success: false, error: err.message, simulated: false };
  }
}

export function smsConfigured(): boolean {
  return isConfigured();
}

function normaliseTo(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length > 7) return `+${digits}`;
  return null;
}
