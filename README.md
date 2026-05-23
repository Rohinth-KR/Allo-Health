# Allo Health — Inventory Reservation System

A full-stack **Next.js** application that solves the inventory **race-condition** problem for multi-warehouse retail and D2C brands using a **concurrency-safe reservation model**.

---

## The Problem

When a customer reaches checkout, payment can take several minutes (3DS flows, UPI confirmations, wallet redirects). During that window, thousands of other shoppers may be looking at the same product:

- **Decrement at add-to-cart** → 80 % of carts are abandoned → inventory looks depleted → conversion tanks.
- **Decrement at payment** → Two customers pay for the same physical unit → one gets a refund, the other a bad experience.
- ✅ **Reservation model** → Temporarily hold units at checkout → confirm on payment success → auto-release on timeout or failure.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Framework | Next.js 15 (App Router, Turbopack) | Full-stack in one repo, API routes + SSR |
| Language | TypeScript | End-to-end type safety |
| ORM | Prisma 7 (with `@prisma/adapter-pg`) | Type-safe DB access, raw SQL when needed |
| Database | Supabase (hosted PostgreSQL) | Free, managed Postgres with row-level security |
| Cache / Idempotency | Upstash Redis (REST) | Serverless Redis, perfect for edge/Vercel |
| Validation | Zod | Shared schemas between API and frontend |
| UI | Tailwind CSS + shadcn/ui | Rapid, consistent component library |
| Deployment | Vercel | Zero-config Next.js deploys, cron jobs |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier)
- An [Upstash](https://upstash.com) account (free tier)

### 1. Clone & Install

```bash
git clone https://github.com/Rohinth-KR/Allo-Health.git
cd Allo-Health
npm install
```

### 2. Environment Variables

```bash
cp .env.example .env
```

Fill in your credentials:

| Variable | Where to find it |
|---|---|
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (URI) |
| `DIRECT_URL` | Same as above (direct/session mode, port 5432) |
| `UPSTASH_REDIS_REST_URL` | Upstash Console → Your DB → REST API section |
| `UPSTASH_REDIS_REST_TOKEN` | Same as above |
| `CRON_SECRET` | Any random string you choose |

### 3. Set Up Database

```bash
npx prisma generate        # Generate the Prisma client
npx prisma db push          # Push schema to Supabase
npm run db:seed             # Seed 9 products, 5 warehouses, 45 stock entries
```

### 4. Run

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
| **Stock** | `productId`, `warehouseId`, `totalUnits`, `reservedUnits` |
| **Reservation** | `productId`, `warehouseId`, `quantity`, `status` (PENDING / CONFIRMED / RELEASED), `expiresAt` |

**Available units** = `totalUnits - reservedUnits` (computed, never stored).

---

## API Endpoints

| Method | Endpoint | Description | Error Codes |
|---|---|---|---|
| `GET` | `/api/products` | List products with available stock per warehouse | — |
| `GET` | `/api/warehouses` | List all warehouses | — |
| `POST` | `/api/reservations` | Reserve units for a product/warehouse | `409` if not enough stock |
| `GET` | `/api/reservations/:id` | Get a single reservation | `404` if not found |
| `POST` | `/api/reservations/:id/confirm` | Confirm reservation (payment succeeded) | `410` if expired |
| `POST` | `/api/reservations/:id/release` | Release reservation (payment failed / user cancelled) | `400` if already released |
| `GET` | `/api/cron/release-expired` | Cron: auto-release expired reservations | `401` if bad secret |

---

## Concurrency Strategy — The Core

This is the heart of the exercise. The reservation endpoint uses **PostgreSQL row-level locking** via `SELECT ... FOR UPDATE` inside a **Serializable transaction**:

```sql
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  -- 1. Acquire exclusive lock on the specific stock row
  SELECT id, "totalUnits", "reservedUnits"
  FROM stocks
  WHERE "productId" = $1 AND "warehouseId" = $2
  FOR UPDATE;

  -- 2. Application logic checks: totalUnits - reservedUnits >= quantity

  -- 3. If OK → UPDATE reservedUnits, INSERT reservation
  -- 4. If NOT → ROLLBACK, return 409

COMMIT;
```

### Why this is correct

1. Two concurrent requests arrive for the last unit of SKU `ALLO-ASH-001` at Warehouse A.
2. Request A acquires the `FOR UPDATE` lock first, reads `reservedUnits = 49`, confirms `50 - 49 >= 1`, increments to `50`, creates the reservation, commits.
3. Request B **waits** for the lock. Once A commits, B reads the **updated** row: `reservedUnits = 50`. It computes `50 - 50 = 0 < 1` → returns `409 Conflict`.
4. **Exactly one reservation succeeds. No double-booking.**

### Why not Redis-based locking?

A distributed lock (Redlock) + Postgres write = two separate systems that can fail independently. If the app crashes between acquiring the Redis lock and writing to Postgres, you get a phantom lock. `SELECT FOR UPDATE` keeps everything inside **one ACID transaction** — atomicity and consistency are guaranteed by the database itself.

---

## Reservation Expiry

Three complementary mechanisms ensure expired reservations are always cleaned up:

### 1. Vercel Cron Job (Primary)

Configured in `vercel.json`, runs **every minute**:

```json
{
  "crons": [{
    "path": "/api/cron/release-expired",
    "schedule": "* * * * *"
  }]
}
```

The endpoint finds all `PENDING` reservations where `expiresAt < now`, sets them to `RELEASED`, and decrements `reservedUnits`. Protected by `CRON_SECRET` bearer token.

### 2. Lazy Cleanup on Read

`GET /api/products` also releases expired reservations before returning stock data. This ensures the UI always shows accurate availability, even if the cron hasn't fired recently.

### 3. Client-Side Countdown

The checkout page renders a real-time countdown timer. When it hits zero, the UI immediately warns the user and prevents confirmation.

---

## Bonus: Idempotency

Implemented for `POST /api/reservations` and `POST /api/reservations/:id/confirm`.

### How it works

1. Client sends `Idempotency-Key: <UUID>` header with each request.
2. Server checks **Upstash Redis** for an existing cached response for that key.
3. **Cache hit** → returns the cached `{status, body}` immediately. No side effects.
4. **Cache miss** → processes normally, then stores `{status, body}` in Redis with a **24-hour TTL**.

### Why Redis for idempotency (not Postgres)?

- Idempotency records are **ephemeral** — Redis handles TTL-based expiry natively with zero overhead.
- No schema migration needed for what is essentially a caching concern.
- **Graceful degradation** — if Redis is temporarily unavailable, the request still processes normally; you just lose idempotency protection for that call.

### Client implementation

The frontend generates a fresh UUID (via the `uuid` package) for every reservation and confirmation request, automatically enabling retry safety.

---

## Frontend

| Page | Route | Features |
|---|---|---|
| **Product Listing** | `/` | Search/filter, live stock badges, auto-refresh (30s), loading skeletons, stats bar |
| **Checkout** | `/reservations/[id]` | Live countdown timer, confirm/cancel actions, expiry detection, toast notifications |

### Key UX decisions

- **Instant UI updates** — after confirm/cancel, state is updated locally without a full page refresh.
- **Color-coded stock** — green (> 50%), yellow (20-50%), red (< 20% or out of stock).
- **Countdown color shift** — green → yellow (< 60s) → red + pulse (< 30s).
- **Toast notifications** — success, error, and info toasts via Sonner for all actions.

---

## Trade-offs & What I'd Add with More Time

### What's here

- ✅ Concurrency-safe reservations with `SELECT FOR UPDATE` in serializable transactions
- ✅ Full REST API with proper HTTP status codes (201, 400, 404, 409, 410)
- ✅ Reservation expiry via cron + lazy cleanup + client countdown
- ✅ Idempotency via Redis (bonus)
- ✅ Zod validation shared between API and frontend
- ✅ Dark-mode UI with search, live badges, and countdown timer
- ✅ 9 products, 5 warehouses, 45 stock entries for realistic demo

### What I'd add with more time

- **Authentication** — Tie reservations to authenticated users via NextAuth / Supabase Auth
- **Rate limiting** — Middleware to prevent reservation spam (e.g., `@upstash/ratelimit`)
- **WebSocket / SSE** — Real-time stock push instead of 30-second polling
- **Multi-item cart** — Batch multiple products into a single reservation
- **Load testing** — k6 or Artillery scripts to verify behavior under concurrent load
- **Database connection pooling** — PgBouncer via Supabase for production traffic
- **Monitoring & alerting** — Datadog / Sentry for transaction failures and lock contention metrics
- **Optimistic locking alternative** — Compare `SELECT FOR UPDATE` vs optimistic versioning with benchmarks

---

## Project Structure

```
├── app/
│   ├── page.tsx                           # Product listing (search, stats, grid)
│   ├── layout.tsx                         # Root layout (dark mode, toasts)
│   ├── globals.css                        # Tailwind + shadcn/ui theme
│   ├── reservations/[id]/page.tsx         # Checkout page (countdown, confirm/cancel)
│   └── api/
│       ├── products/route.ts              # GET — list products + lazy cleanup
│       ├── warehouses/route.ts            # GET — list warehouses
│       ├── reservations/
│       │   ├── route.ts                   # POST — create reservation (concurrency-safe)
│       │   └── [id]/
│       │       ├── route.ts               # GET — single reservation
│       │       ├── confirm/route.ts       # POST — confirm (410 if expired)
│       │       └── release/route.ts       # POST — release early
│       └── cron/release-expired/route.ts  # GET — cron cleanup endpoint
├── components/
│   ├── ProductCard.tsx                    # Product card with warehouse selector
│   ├── ReservationCountdown.tsx           # Live countdown with progress bar
│   ├── StockBadge.tsx                     # Color-coded stock indicator
│   └── ui/                               # shadcn/ui primitives
├── lib/
│   ├── prisma.ts                          # Prisma client singleton (pg adapter)
│   ├── redis.ts                           # Upstash Redis client
│   ├── schemas.ts                         # Zod schemas (shared)
│   └── utils.ts                           # Utility functions (cn)
├── prisma/
│   ├── schema.prisma                      # Data model
│   └── seed.ts                            # Seed script (10 products × 5 warehouses)
├── vercel.json                            # Cron configuration
├── .env.example                           # Environment variable template
└── README.md
```
