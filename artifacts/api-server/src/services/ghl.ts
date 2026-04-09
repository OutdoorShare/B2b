const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_COMPANY_ID = process.env.GHL_COMPANY_ID;
const GHL_API_BASE = "https://services.leadconnectorhq.com";

interface GHLCreateLocationResult {
  locationId: string;
  success: true;
}

interface GHLCreateLocationError {
  success: false;
  error: string;
}

export async function createGHLSubAccount(params: {
  companyName: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  slug: string;
}): Promise<GHLCreateLocationResult | GHLCreateLocationError> {
  if (!GHL_API_KEY || !GHL_COMPANY_ID) {
    console.warn("[GHL] Missing GHL_API_KEY or GHL_COMPANY_ID — skipping sub-account creation");
    return { success: false, error: "GHL credentials not configured" };
  }

  try {
    const body: Record<string, any> = {
      name: params.companyName,
      companyId: GHL_COMPANY_ID,
      email: params.email,
      ...(params.phone ? { phone: params.phone } : {}),
      ...(params.address ? { address: params.address } : {}),
      ...(params.city ? { city: params.city } : {}),
      ...(params.state ? { state: params.state } : {}),
      country: params.country ?? "US",
      timezone: "America/Denver",
      settings: {
        allowDuplicateContact: false,
        allowDuplicateOpportunity: false,
        allowFacebookNameMerge: false,
        disableContactTimezone: false,
      },
      snapshot: {
        type: "own-location",
      },
    };

    const response = await fetch(`${GHL_API_BASE}/locations/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GHL_API_KEY}`,
        Version: "2021-07-28",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data?.message || data?.error || `HTTP ${response.status}`;
      console.error(`[GHL] Sub-account creation failed for ${params.slug}:`, msg);
      return { success: false, error: msg };
    }

    const locationId: string = data?.location?.id ?? data?.id;
    if (!locationId) {
      console.error("[GHL] No location ID in response:", JSON.stringify(data));
      return { success: false, error: "No location ID returned from GHL" };
    }

    console.log(`[GHL] Sub-account created for ${params.slug} — locationId: ${locationId}`);
    return { success: true, locationId };
  } catch (err: any) {
    console.error("[GHL] Unexpected error:", err.message);
    return { success: false, error: err.message };
  }
}
