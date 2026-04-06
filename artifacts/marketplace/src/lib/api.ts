const API_BASE = "/api";

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
  createdAt: string;
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

export const api = {
  marketplace: {
    listings: (params?: Record<string, string>) => {
      const qs = params ? "?" + new URLSearchParams(params).toString() : "";
      return get<MarketplaceListing[]>(`/marketplace/listings${qs}`);
    },
    listing: (id: number) => get<MarketplaceListingDetail>(`/marketplace/listings/${id}`),
    categories: () => get<MarketplaceCategory[]>("/marketplace/categories"),
    companies: () => get<MarketplaceCompany[]>("/marketplace/companies"),
    stats: () => get<MarketplaceStats>("/marketplace/stats"),
    renterBookings: (customerId: number) =>
      get<RenterBooking[]>(`/marketplace/renter/bookings?customerId=${customerId}`),
  },
  customers: {
    login: (email: string, password: string) =>
      post<Customer>("/customers/login", { email, password }),
    register: (email: string, password: string, name: string, phone?: string) =>
      post<Customer>("/customers/register", { email, password, name, phone }),
  },
};
