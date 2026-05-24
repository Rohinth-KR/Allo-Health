# Allo Health — Inventory Reservation System
<img width="1377" height="901" alt="image" src="https://github.com/user-attachments/assets/bf5f8488-0d1b-49d8-b7c9-d86874fe85f0" />

🌐 **Live Demo:** [https://allo-health-dusky.vercel.app](https://allo-health-dusky.vercel.app)

A full-stack **Next.js** application that solves the inventory **race-condition** problem for multi-warehouse pharmaceutical/D2C brands using a **concurrency-safe reservation model**.

---

## The Problem

When a customer reaches checkout, payment can take several minutes (3DS flows, UPI confirmations, wallet redirects). During that window, thousands of other shoppers may be looking at the same product:

- **Decrement at add-to-cart** → 80% of carts are abandoned → inventory looks depleted → conversion tanks.
- **Decrement at payment** → Two customers pay for the same physical unit → one gets a refund, the other a bad experience.
- ✅ **Reservation model** → Temporarily hold units at checkout → confirm on payment success → auto-release on timeout or failure.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 15 (App Router, Turbopack) | Full-stack in one repo, API routes + SSR |
| Language | TypeScript | End-to-end type safety |
| ORM | Prisma 7 (with `@prisma/adapter-pg`) | Type-safe DB access, raw SQL when needed |
| Database | Supabase (hosted PostgreSQL) | Managed Postgres with connection pooling |
| Cache / Idempotency | Upstash Redis (REST) | Serverless Redis, perfect for Vercel edge |
| Validation | Zod | Shared schemas between API and frontend |
| UI | Tailwind CSS + shadcn/ui + Inter font | Clean, medical-grade design system |
| Deployment | Vercel | Zero-config Next.js deploys, cron jobs |

---

## Running Locally

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier is enough)
- An [Upstash](https://upstash.com) account (free tier is enough)

### 1. Clone & Install

```bash
git clone https://github.com/Rohinth-KR/Allo-Health.git
cd Allo-Health
npm install
```

### 2. Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Supabase — use the Pooler connection string (port 6543) for serverless
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection — used for migrations (bypasses the pooler)
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres"

# Upstash Redis — from your Upstash console → REST API tab
UPSTASH_REDIS_REST_URL="https://<your-db>.upstash.io"
UPSTASH_REDIS_REST_TOKEN="<your-token>"

# Cron protection — any random secret string you choose
CRON_SECRET="your-secret-key-here"
```

> **Where to find each value:**
> | Variable | Location |
> |---|---|
> | `DATABASE_URL` | Supabase Dashboard → **Connect** (green button) → **ORM** tab → select **Prisma** → copy `DATABASE_URL` |
> | `DIRECT_URL` | Same screen, copy `DIRECT_URL` |
> | `UPSTASH_REDIS_REST_URL` | Upstash Console → your database → **REST API** section |
> | `UPSTASH_REDIS_REST_TOKEN` | Same section |
> | `CRON_SECRET` | Any random string — e.g. `openssl rand -hex 32` |

> **Important:** Your Supabase password may contain special characters (e.g. `@`). URL-encode them — `@` becomes `%40`. Example: `Kingrocky@777` → `Kingrocky%40777%40`.

### 3. Set Up the Database

```bash
npx prisma generate     # Generate the Prisma client from the schema
npx prisma db push      # Push schema to Supabase (creates tables)
npm run db:seed         # Seed 9 products, 5 warehouses, 45 stock entries
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Data Model

```
Product ──< Stock >── Warehouse
               │
         Reservation
```

| Model | Key Fields |
|---|---|
| **Product** | `id`, `name`, `sku`, `price`, `description` |
| **Warehouse** | `id`, `name`, `location` |
| **Stock** | `productId`, `warehouseId`, `totalUnits`, `reservedUnits` — unique constraint on `(productId, warehouseId)` |
| **Reservation** | `productId`, `warehouseId`, `quantity`, `status` (`PENDING` / `CONFIRMED` / `RELEASED`), `expiresAt` |

**Available units** = `totalUnits - reservedUnits` — computed on read, never stored separately to avoid drift.

---

## API Endpoints

| Method | Endpoint | Description | Notable Codes |
|---|---|---|---|
| `GET` | `/api/products` | List all products with available stock per warehouse | — |
| `GET` | `/api/warehouses` | List all warehouses | — |
| `POST` | `/api/reservations` | Reserve units for a product/warehouse | `409` insufficient stock |
| `GET` | `/api/reservations/:id` | Fetch a single reservation | `404` not found |
| `POST` | `/api/reservations/:id/confirm` | Confirm reservation (payment succeeded) | `410` if expired |
| `POST` | `/api/reservations/:id/release` | Release reservation (user cancelled) | `400` if already released |
| `GET` | `/api/cron/release-expired` | Cron: auto-release all expired reservations | `401` bad secret |

---

## Concurrency Strategy — The Core

This is the heart of the system. The reservation endpoint uses **PostgreSQL row-level locking** via `SELECT ... FOR UPDATE` inside a **Serializable transaction**:

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  -- 1. Acquire exclusive row lock on the specific stock row
  SELECT id, "totalUnits", "reservedUnits"
  FROM stocks
  WHERE "productId" = $1 AND "warehouseId" = $2
  FOR UPDATE;

  -- 2. Application checks: totalUnits - reservedUnits >= requestedQuantity

  -- 3. If OK  → UPDATE reservedUnits += quantity, INSERT reservation row
  -- 4. If NOT → ROLLBACK, return 409 Conflict

COMMIT;
```

### Why this is correct

1. Two concurrent requests arrive for the **last unit** of a product at Warehouse A.
2. Request A acquires the `FOR UPDATE` lock first, reads `reservedUnits = 49`, confirms `50 - 49 >= 1`, increments to `50`, inserts the reservation, and commits.
3. Request B **waits** for the lock. Once A commits, B reads the updated row: `reservedUnits = 50`. It computes `50 - 50 = 0 < 1` → returns `409 Conflict`.
4. **Exactly one reservation succeeds. Zero double-bookings.**

### Why not Redis distributed locking (Redlock)?

A Redis lock + Postgres write = two separate systems that can fail independently. If the app crashes between acquiring the Redis lock and writing to Postgres, you get a **phantom lock** — the lock is held but no write was made. `SELECT FOR UPDATE` keeps the entire operation inside **one ACID transaction** — atomicity and consistency are guaranteed by Postgres itself, not the application.

---

## How the Expiry Mechanism Works in Production

Three complementary layers ensure expired reservations are always released — even if one layer fails:

### Layer 1 — Vercel Cron Job (Primary)

Configured in `vercel.json`. On the **Hobby (free) plan**, Vercel limits cron jobs to once per day, so the cron runs at midnight UTC:

```json
{
  "crons": [{
    "path": "/api/cron/release-expired",
    "schedule": "0 0 * * *"
  }]
}
```

The endpoint fetches all `PENDING` reservations where `expiresAt < now`, updates them to `RELEASED`, and decrements `reservedUnits` for each. The endpoint is protected by a `Bearer <CRON_SECRET>` check so only Vercel (or an authorized caller) can trigger it.

> **Note:** On a **Pro plan**, you can change the schedule to `* * * * *` (every minute) for near-real-time cleanup.

### Layer 2 — Lazy Cleanup on Product Fetch (Always Active)

`GET /api/products` also performs a cleanup pass before returning data. It finds all expired `PENDING` reservations and releases them inline. This means:

- Stock numbers shown to the user are **always accurate**, regardless of when the cron last ran.
- There is **no stale stock display**, even on the Hobby plan with a daily cron.

### Layer 3 — Client-Side Countdown (UX Safety Net)

The checkout page renders a real-time countdown timer that ticks every second. When it hits zero:
- The confirm button is disabled immediately.
- The user sees a clear expiry warning.
- If they try to confirm via the API anyway, the server returns `410 Gone`.

All three layers are independent — if any one fails, the others still protect correctness.

---

## Idempotency (Bonus)

Implemented for `POST /api/reservations` and `POST /api/reservations/:id/confirm`.

### How it works

1. Client generates a **UUID v4** for every request and sends it as `Idempotency-Key: <uuid>`.
2. Server checks **Upstash Redis** for an existing cached response for that key.
3. **Cache hit** → returns the cached `{status, body}` immediately. No DB writes, no side effects.
4. **Cache miss** → processes normally, then stores `{status, body}` in Redis with a **24-hour TTL**.

This protects against duplicate network retries (e.g., user double-taps Reserve, or the mobile app retries after a timeout) — only the first request creates a reservation; all retries get the same cached response.

---

## Trade-offs & What I'd Do Differently with More Time

### Trade-offs made

**`SELECT FOR UPDATE` over optimistic locking**
Optimistic locking (versioning + retry on conflict) can have higher throughput under low contention, but it requires application-level retry loops and can cause poor UX under high contention when many retries fail. `FOR UPDATE` is simpler, predictable, and for a reservation system (write-heavy, low tolerance for conflicts), the pessimistic approach is the right choice.

**Daily cron instead of per-minute**
The Vercel Hobby plan only allows daily cron jobs. I mitigated this entirely with the lazy cleanup on `GET /api/products`, so stock accuracy is not actually affected — the cron is just a secondary safety net.

**Polling over WebSockets**
The UI polls `/api/products` every 30 seconds for fresh stock data. WebSockets or Server-Sent Events (SSE) would give real-time push updates, but they require persistent connections that don't fit well with Vercel's serverless model without additional infrastructure (e.g., Pusher, Ably).

**No authentication**
Reservations are anonymous (no user identity). In production, you'd tie each reservation to an authenticated user so they can't hold unlimited stock and to enable order history.

### What I'd add with more time

- **Authentication** — NextAuth or Supabase Auth to tie reservations to users, preventing anonymous stock squatting.
- **Rate limiting** — `@upstash/ratelimit` middleware to cap reservations per IP/user per minute.
- **WebSocket / SSE stock updates** — Real-time push so all open tabs instantly see when stock changes.
- **Multi-item cart** — Batch reserve multiple products in a single transaction.
- **Load testing** — k6 or Artillery scripts to verify `SELECT FOR UPDATE` behavior under simulated concurrent load (100+ simultaneous requests for the last unit).
- **Monitoring** — Sentry for error tracking and lock contention alerts; Datadog for transaction latency percentiles.
- **Optimistic locking comparison** — Benchmark `SELECT FOR UPDATE` vs CAS (compare-and-swap) versioning to quantify the throughput difference.

---

## Project Structure

```
├── app/
│   ├── page.tsx                           # Product listing (search, stats, live refresh)
│   ├── layout.tsx                         # Root layout (Inter font, Sonner toasts)
│   ├── globals.css                        # Tailwind + medical blue theme
│   ├── reservations/[id]/page.tsx         # Checkout page (countdown, confirm/cancel)
│   └── api/
│       ├── products/route.ts              # GET — list products + lazy expiry cleanup
│       ├── warehouses/route.ts            # GET — list warehouses
│       ├── reservations/
│       │   ├── route.ts                   # POST — create reservation (SELECT FOR UPDATE)
│       │   └── [id]/
│       │       ├── route.ts               # GET — single reservation
│       │       ├── confirm/route.ts       # POST — confirm (returns 410 if expired)
│       │       └── release/route.ts       # POST — release early
│       └── cron/release-expired/route.ts  # GET — cron cleanup, protected by CRON_SECRET
├── components/
│   ├── ProductCard.tsx                    # Product card with icons, urgency labels, stock bars
│   ├── ReservationCountdown.tsx           # Live countdown with blue→amber→red progression
│   ├── StockBadge.tsx                     # Color-coded stock indicator (teal/amber/red)
│   └── ui/                               # shadcn/ui primitives
├── lib/
│   ├── prisma.ts                          # Prisma client singleton (pg adapter + SSL)
│   ├── redis.ts                           # Upstash Redis client
│   ├── schemas.ts                         # Zod schemas shared between API and frontend
│   └── utils.ts                           # cn() utility
├── prisma/
│   ├── schema.prisma                      # Data model
│   └── seed.ts                            # Seed: 9 products × 5 warehouses = 45 stock rows
├── vercel.json                            # Cron job configuration
├── .env.example                           # Environment variable template
└── README.md
```
