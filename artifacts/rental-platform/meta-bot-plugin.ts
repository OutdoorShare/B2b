/**
 * Vite dev-server plugin: intercepts bot/scraper requests for tenant storefronts
 * and returns minimal HTML with the correct og:, twitter:, and title meta tags.
 * Regular browsers pass through normally to the React SPA.
 *
 * Uses pg directly (raw SQL) to avoid ESM directory-import issues
 * with the @workspace/db package at Vite config load time.
 */
import type { Plugin } from "vite";
import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (!pool) {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) throw new Error("DATABASE_URL not set");
    pool = new Pool({ connectionString: connStr });
  }
  return pool;
}

// ── Bot detection ────────────────────────────────────────────────────────────

const BOT_PATTERNS = [
  "facebookexternalhit", "facebot", "twitterbot", "linkedinbot",
  "whatsapp", "slackbot", "telegrambot", "discordbot",
  "applebot", "googlebot", "bingbot", "yandexbot",
  "curl", "wget", "python-requests", "postmanruntime",
  "go-http-client", "scrapy",
];

function isBot(ua: string): boolean {
  const lower = ua.toLowerCase();
  return BOT_PATTERNS.some(p => lower.includes(p));
}

// ── URL parsing ──────────────────────────────────────────────────────────────

// Non-tenant first-path-segments to skip entirely
const SKIP_SEGMENTS = new Set([
  "api", "uploads", "src", "@fs", "@vite", "node_modules",
  "__vite_ping", ".well-known", "vite", "favicon.ico",
]);

interface ParsedUrl {
  slug: string;
  listingId?: number;
}

function parseTenantUrl(url: string): ParsedUrl | null {
  const path = url.split("?")[0].split("#")[0];
  // Must match /{slug}[/listings/{id}][/...]
  const m = path.match(/^\/([a-zA-Z0-9][a-zA-Z0-9-_]{1,80})(\/(.*))?$/);
  if (!m) return null;

  const slug = m[1];
  if (SKIP_SEGMENTS.has(slug) || slug.startsWith("@")) return null;

  const rest = m[3] ?? "";
  const listingMatch = rest.match(/^listings\/(\d+)(\/|$)/);
  const listingId = listingMatch ? parseInt(listingMatch[1], 10) : undefined;

  return { slug, listingId };
}

// ── DB queries ───────────────────────────────────────────────────────────────

interface TenantMeta {
  tenantId: number;
  name: string;
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  primaryColor: string;
}

async function fetchTenantMeta(slug: string): Promise<TenantMeta | null> {
  const { rows } = await getPool().query<{
    tenant_id: number;
    name: string;
    tagline: string | null;
    description: string | null;
    logo_url: string | null;
    primary_color: string;
  }>(
    `SELECT t.id AS tenant_id, bp.name, bp.tagline, bp.description,
            bp.logo_url, bp.primary_color
     FROM tenants t
     JOIN business_profile bp ON bp.tenant_id = t.id
     WHERE t.slug = $1 AND t.status = 'active'
     LIMIT 1`,
    [slug],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    tenantId: r.tenant_id,
    name: r.name,
    tagline: r.tagline,
    description: r.description,
    logoUrl: r.logo_url,
    primaryColor: r.primary_color || "#1b4332",
  };
}

interface ListingMeta {
  title: string;
  description: string;
  imageUrls: string[];
}

async function fetchListingMeta(listingId: number, tenantId: number): Promise<ListingMeta | null> {
  const { rows } = await getPool().query<{
    title: string;
    description: string;
    image_urls: string[] | null;
  }>(
    `SELECT title, description, image_urls
     FROM listings
     WHERE id = $1 AND tenant_id = $2
     LIMIT 1`,
    [listingId, tenantId],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    title: r.title,
    description: r.description,
    imageUrls: Array.isArray(r.image_urls) ? r.image_urls : [],
  };
}

// ── HTML generation ──────────────────────────────────────────────────────────

function toAbsoluteUrl(url: string, origin: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

function esc(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildMetaHtml(opts: {
  title: string;
  description: string;
  image: string;
  url: string;
  siteName: string;
  primaryColor: string;
}): string {
  const { title, description, image, url, siteName, primaryColor } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="theme-color" content="${esc(primaryColor)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:image" content="${esc(image)}" />
  <meta property="og:image:secure_url" content="${esc(image)}" />
  <meta property="og:image:alt" content="${esc(title)}" />
  <meta property="og:site_name" content="${esc(siteName)}" />

  <!-- Twitter / X card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(image)}" />
  <meta name="twitter:image:alt" content="${esc(title)}" />

  <!-- Redirect real browsers back to the SPA URL instantly -->
  <noscript><meta http-equiv="refresh" content="0;url=${esc(url)}" /></noscript>
</head>
<body>
  <script>
    // Bots read the meta tags above and stop; real browsers are redirected.
    if (typeof window !== 'undefined') {
      window.location.replace(${JSON.stringify(url)});
    }
  </script>
  <p><a href="${esc(url)}">${esc(title)}</a></p>
</body>
</html>`;
}

// ── Plugin ───────────────────────────────────────────────────────────────────

export function tenantMetaBotPlugin(): Plugin {
  return {
    name: "tenant-meta-bot",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        try {
          if (req.method !== "GET") return next();

          const ua = req.headers["user-agent"] ?? "";
          if (!isBot(ua)) return next();

          const url = req.url ?? "/";
          const parsed = parseTenantUrl(url);
          if (!parsed) return next();

          const tenant = await fetchTenantMeta(parsed.slug);
          if (!tenant) return next();

          // Build canonical URL for the og:url tag
          const proto = (req.headers["x-forwarded-proto"] as string) ?? "http";
          const host = (req.headers["x-forwarded-host"] as string) ?? req.headers.host ?? "localhost";
          const origin = `${proto}://${host}`;
          const fullUrl = `${origin}${url}`;

          const businessName = tenant.name || "Outdoor Rentals";
          let title = `${businessName} — Rental Booking`;
          let description = tenant.description || tenant.tagline || `Book rentals from ${businessName} online.`;
          let image = tenant.logoUrl
            ? toAbsoluteUrl(tenant.logoUrl, origin)
            : `${origin}/outdoorshare-logo.png`;

          // If this is a listing detail page, use listing-specific metadata
          if (parsed.listingId) {
            const listing = await fetchListingMeta(parsed.listingId, tenant.tenantId);
            if (listing) {
              title = `${listing.title} — ${businessName}`;
              description = listing.description || description;
              if (listing.imageUrls.length > 0) {
                image = toAbsoluteUrl(listing.imageUrls[0], origin);
              }
            }
          }

          const html = buildMetaHtml({
            title,
            description,
            image,
            url: fullUrl,
            siteName: businessName,
            primaryColor: tenant.primaryColor,
          });

          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Cache-Control", "public, max-age=300");
          res.statusCode = 200;
          res.end(html);
        } catch {
          // Never crash the dev server on a DB or network error — pass through
          next();
        }
      });
    },
  };
}
