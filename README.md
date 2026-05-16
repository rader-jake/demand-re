# TenantFirst — Tenant-Driven CRE Marketplace

NYC's first commercial real estate marketplace where tenants create verified profiles and landlords come to them.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL 16 |
| Auth | JWT (access + refresh tokens) |
| Charts | Recharts |
| Forms | React Hook Form + Zod |

## Project Structure

```
cre-marketplace/
├── backend/          Express API server
│   └── src/
│       ├── config/   Database, JWT config
│       ├── middleware/ Auth, event tracking, validation
│       ├── routes/   auth, tenants, landlords, messages, admin, analytics
│       └── services/ ScoringService, AnalyticsService
├── frontend/         Next.js app
│   └── src/
│       ├── app/      Route pages (tenant/, landlord/, admin/, (auth)/)
│       ├── components/ AppShell, TenantCard, ScoreBar, etc.
│       ├── lib/      api.ts, auth.ts, utils.ts
│       └── types/    TypeScript types
└── database/
    ├── schema.sql    Full PostgreSQL schema
    └── seed.sql      Sample data
```

## Quick Start (Docker)

```bash
# Clone and start everything
git clone <repo-url>
cd cre-marketplace
docker compose up --build

# App available at:
#   Frontend:  http://localhost:3000
#   Backend:   http://localhost:4000
#   DB:        localhost:5432
```

## Quick Start (Local Dev)

### Prerequisites
- Node.js 20+
- PostgreSQL 16
- npm

### 1. Database

```bash
createdb cre_marketplace
psql cre_marketplace < database/schema.sql
psql cre_marketplace < database/seed.sql   # optional seed data
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT secrets
npm install
npm run dev   # runs on :4000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev   # runs on :3000
```

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cre_marketplace
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_REFRESH_EXPIRES_IN=30d
PORT=4000
CORS_ORIGINS=http://localhost:3000
NODE_ENV=development
```

### Frontend

The frontend uses Next.js rewrites — all `/api/*` requests proxy to the backend. No additional env vars needed for local dev.

For production, set:
```env
NEXT_PUBLIC_API_URL=https://your-api.com
```

## Seed Accounts

After running `seed.sql`:

| Role | Email | Password |
|---|---|---|
| Admin | admin@tenantfirst.com | Admin123! |
| Landlord | sarah@nyrealty.com | Landlord123! |
| Tenant | marcus@groundfloor.com | Tenant123! |

## Key Features

### Tenant Side
- Multi-step onboarding (business info → financials → space requirements → amenities)
- Privacy controls (revenue/credit visibility toggles)
- Receive and respond to landlord interest
- Dashboard with live desirability score

### Landlord Side
- Advanced tenant search (industry, neighborhood, budget PSF, SF, credit, funding, score)
- Save tenants, express interest, track deal pipeline (CRM)
- Full messaging system
- Demand trend insights

### Admin
- User management (activate/deactivate)
- Analytics dashboard (Recharts): growth trends, demand heatmap, industry breakdown, funding distribution, score distribution
- JSON data export
- Trigger scoring recomputation and heatmap refresh

### Scoring Engine (Rules-Based)
Tenants receive a **Desirability Index** (0–100) composed of:
- Financial Strength (30%) — revenue, credit score, funding stage, guarantor
- Expansion Likelihood (25%) — number of locations, funding stage, years in operation
- Operational Stability (20%) — years, credit, guarantor
- Market Desirability (25%) — industry demand, NYC neighborhood premiums, budget signal

## API Reference

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh

GET/POST/PUT  /api/tenants/profile
PUT           /api/tenants/profile/space-requirements
GET/PUT       /api/tenants/interests/:id/respond

GET           /api/landlords/search
GET/PUT       /api/landlords/profile
POST/DELETE   /api/landlords/save/:profileId
POST          /api/landlords/interest/:profileId
GET|POST|PUT  /api/landlords/deals

GET           /api/messages/conversations
POST          /api/messages/conversations
POST          /api/messages/conversations/:id/messages

GET           /api/admin/users
GET           /api/admin/analytics/overview
GET           /api/admin/analytics/demand-heatmap
GET           /api/admin/analytics/tenant-insights
GET           /api/admin/analytics/export
```
# demand-re
