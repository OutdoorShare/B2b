const API_BASE = "/api";

function previewParam(): Record<string, string> {
  try {
    return sessionStorage.getItem("os_marketplace_preview") === "true" ? { preview: "true" } : {};
  } catch { return {}; }
}

export interface MarketplaceListing {
  id: number;
  title: string;
  description: string;
  pricePerDay: string;
  imageUrls: string[];
  location: string | null;
  tenantSlug: string;
  tenantName: string;
  businessName: string;
  businessLogoUrl: string | null;
  businessPrimaryColor: string;
  businessAccentColor: string;
  businessCity: string | null;
  businessState: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  categoryIcon: string | null;
  quantity: number;
  condition: string | null;
  brand: string | null;
  model: string | null;
}

export interface MarketplaceListingDetail extends MarketplaceListing {
  isHost: boolean;
  contactName: string;
  weekendPrice: string | null;
  pricePerWeek: string | null;
  depositAmount: string | null;
  halfDayEnabled: boolean;
  halfDayRate: string | null;
  hourlyEnabled: boolean;
  includedItems: string[];
  requirements: string | null;
  ageRestriction: number | null;
  dimensions: string | null;
  weight: string | null;
  business: {
    name: string;
    tagline: string | null;
    description: string | null;
    logoUrl: string | null;
    coverImageUrl: string | null;
    primaryColor: string;
    accentColor: string;
    phone: string | null;
    website: string | null;
    city: string | null;
    state: string | null;
    location: string | null;
  };
  category: { id: number; name: string; slug: string; icon: string | null } | null;
}

export interface MarketplaceCategory {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  listingCount: number;
}

export interface MarketplaceCompany {
  tenantId: number;
  slug: string;
  businessName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  city: string | null;
  state: string | null;
  tagline: string | null;
  listingCount: number;
}

export interface MarketplaceStats {
  listings: number;
  companies: number;
  customers: number;
}

export interface RenterBooking {
  id: number;
  status: string;
  startDate: string;
  endDate: string;
  totalPrice: string;
  listingTitle: string;
  listingImage: string | null;
  tenantSlug: string | null;
  businessName: string | null;
  businessLogoUrl: string | null;
  businessPrimaryColor: string | null;
  createdAt: string;
}

export interface Customer {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  tenantSlug: string | null;
  identityVerificationStatus: string;
  billingAddress: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZip: string | null;
  cardLastFour: string | null;
  cardBrand: string | null;
  createdAt: string;
}

export interface HostInfo {
  hostTenantId: number;
  slug: string;
  name: string;
}

export interface HostListing {
  id: number;
  title: string;
  description: string;
  status: string;
  pricePerDay: string;
  imageUrls: string[];
  location: string | null;
  quantity: number;
  condition: string | null;
  brand: string | null;
  model: string | null;
  categoryId: number | null;
  categoryName: string | null;
  createdAt: string;
}

export interface HostBooking {
  id: number;
  status: string;
  startDate: string;
  endDate: string;
  totalPrice: string;
  listingTitle: string;
  listingImage: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  createdAt: string;
}

export interface HostStats {
  listings: { total: number; active: number };
  bookings: { total: number; pending: number; confirmed: number; totalRevenue: string };
}

export interface HostMeResponse {
  id: number;
  slug: string;
  name: string;
  business: {
    name: string;
    city: string | null;
    state: string | null;
    description: string | null;
    logoUrl: string | null;
    phone: string | null;
    website: string | null;
  } | null;
}

export interface HostCategory {
  id: number;
  name: string;
  slug: string;
}

export interface HostBundle {
  id: number;
  tenantId: number;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  pricePerDay: string;
  listingIds: number[];
  discountPercent: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

function hostHeaders(customerId: number): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Customer-Id": String(customerId),
  };
}

async function hostGet<T>(path: string, customerId: number): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "X-Customer-Id": String(customerId) },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any).error || `API error ${res.status}`);
  }
  return res.json();
}

async function hostPost<T>(path: string, body: unknown, customerId: number): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: hostHeaders(customerId),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || `API error ${res.status}`);
  return data;
}

async function hostPut<T>(path: string, body: unknown, customerId: number): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: hostHeaders(customerId),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || `API error ${res.status}`);
  return data;
}

async function hostDelete<T>(path: string, customerId: number): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { "X-Customer-Id": String(customerId) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as any).error || `API error ${res.status}`);
  return data;
}

export const api = {
  marketplace: {
    listings: (params?: Record<string, string>) => {
      const merged = { ...previewParam(), ...(params ?? {}) };
      const qs = Object.keys(merged).length ? "?" + new URLSearchParams(merged).toString() : "";
      return get<MarketplaceListing[]>(`/marketplace/listings${qs}`);
    },
    listing: (id: number) => {
      const p = previewParam();
      const qs = Object.keys(p).length ? "?" + new URLSearchParams(p).toString() : "";
      return get<MarketplaceListingDetail>(`/marketplace/listings/${id}${qs}`);
    },
    categories: () => {
      const p = previewParam();
      const qs = Object.keys(p).length ? "?" + new URLSearchParams(p).toString() : "";
      return get<MarketplaceCategory[]>(`/marketplace/categories${qs}`);
    },
    companies: () => {
      const p = previewParam();
      const qs = Object.keys(p).length ? "?" + new URLSearchParams(p).toString() : "";
      return get<MarketplaceCompany[]>(`/marketplace/companies${qs}`);
    },
    stats: () => {
      const p = previewParam();
      const qs = Object.keys(p).length ? "?" + new URLSearchParams(p).toString() : "";
      return get<MarketplaceStats>(`/marketplace/stats${qs}`);
    },
    renterBookings: (customerId: number) =>
      get<RenterBooking[]>(`/marketplace/renter/bookings?customerId=${customerId}`),
  },
  customers: {
    login: (email: string, password: string) =>
      post<Customer>("/customers/login", { email, password }),
    register: (email: string, password: string, name: string, phone?: string) =>
      post<Customer>("/customers/register", { email, password, name, phone }),
    updateProfile: (id: number, body: Partial<Pick<Customer, "name" | "phone" | "billingAddress" | "billingCity" | "billingState" | "billingZip">>) =>
      put<Customer>(`/customers/${id}`, body),
    removeCard: (id: number) =>
      put<Customer>(`/customers/${id}`, { cardLastFour: null, cardBrand: null }),
    changePassword: (id: number, currentPassword: string, newPassword: string) =>
      post<{ ok: boolean }>(`/customers/${id}/change-password`, { currentPassword, newPassword }),
  },
  host: {
    become: (customerId: number, body: { displayName?: string; city?: string; state?: string }) =>
      hostPost<HostInfo>("/host/become", body, customerId),
    me: (customerId: number) =>
      hostGet<HostMeResponse>("/host/me", customerId),
    checkIsHost: async (customerId: number): Promise<boolean> => {
      try {
        await hostGet("/host/me", customerId);
        return true;
      } catch {
        return false;
      }
    },
    stats: (customerId: number) =>
      hostGet<HostStats>("/host/stats", customerId),
    listings: (customerId: number) =>
      hostGet<HostListing[]>("/host/listings", customerId),
    createListing: (customerId: number, body: Record<string, unknown>) =>
      hostPost<HostListing>("/host/listings", body, customerId),
    updateListing: (customerId: number, id: number, body: Record<string, unknown>) =>
      hostPut<HostListing>(`/host/listings/${id}`, body, customerId),
    deleteListing: (customerId: number, id: number) =>
      hostDelete<{ success: boolean }>(`/host/listings/${id}`, customerId),
    bookings: (customerId: number) =>
      hostGet<HostBooking[]>("/host/bookings", customerId),
    updateSettings: (customerId: number, body: Record<string, unknown>) =>
      hostPut<{ success: boolean }>("/host/settings", body, customerId),
    categories: () =>
      get<HostCategory[]>("/host/categories"),
    bundles: (customerId: number) =>
      hostGet<HostBundle[]>("/host/bundles", customerId),
    createBundle: (customerId: number, body: Record<string, unknown>) =>
      hostPost<HostBundle>("/host/bundles", body, customerId),
    updateBundle: (customerId: number, id: number, body: Record<string, unknown>) =>
      hostPut<HostBundle>(`/host/bundles/${id}`, body, customerId),
    deleteBundle: (customerId: number, id: number) =>
      hostDelete<{ success: boolean }>(`/host/bundles/${id}`, customerId),
  },
};
