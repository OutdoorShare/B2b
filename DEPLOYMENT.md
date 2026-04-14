# OutdoorShare Deployment Guide

## Project Structure

This is a **pnpm monorepo**. The two key artifacts for production are:

| Artifact | Directory | Purpose |
|---|---|---|
| Frontend (React SPA) | `artifacts/rental-platform/` | Tenant admin portals + storefronts |
| API Server (Node/Express) | `artifacts/api-server/` | REST API + auth + DB |

---

## Frontend — Vercel

### Build Settings (configure in Vercel dashboard)

| Setting | Value |
|---|---|
| **Framework Preset** | Other |
| **Root Directory** | *(leave blank — monorepo root)* |
| **Install Command** | `pnpm install --frozen-lockfile` |
| **Build Command** | `pnpm --filter @workspace/rental-platform run build` |
| **Output Directory** | `artifacts/rental-platform/dist/public` |

### Environment Variables (set in Vercel dashboard)

| Variable | Value |
|---|---|
| `BASE_PATH` | `/` |
| `NODE_ENV` | `production` |
| `STRIPE_PUBLISHABLE_KEY` | Your live Stripe publishable key |
| `STRIPE_TEST_PUBLISHABLE_KEY` | Your test Stripe publishable key |

### API Rewrites

Update `vercel.json` with your real API server URL once deployed:

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR_API_HOST/api/:path*"
    },
    {
      "source": "/:path*",
      "destination": "/index.html"
    }
  ]
}
```

---

## API Server — Replit Deployments (Recommended)

The API server runs on Node.js with PostgreSQL. Deploying it from Replit is the simplest option.

1. In Replit, click **Deploy** on the `artifacts/api-server: API Server` workflow
2. The server runs on port `8080` by default
3. After deploying, you'll get a URL like `https://your-project.replit.app`
4. Update `vercel.json` to point `/api/*` at that URL

### API Environment Variables (set in Replit Secrets)

- `DATABASE_URL` — PostgreSQL connection string
- `SESSION_SECRET` — Random secret for sessions
- `STRIPE_SECRET_KEY` — Stripe secret key
- `STRIPE_CONNECT_CLIENT_ID` — Stripe Connect client ID
- `DEFAULT_OBJECT_STORAGE_BUCKET_ID` — Object storage bucket

---

## Domain Setup

For production (`outdoorshare.rent`):
1. Point `outdoorshare.rent` → Vercel (frontend)
2. Point `api.outdoorshare.rent` → API server host
3. Update `vercel.json` destination to `https://api.outdoorshare.rent/api/:path*`
