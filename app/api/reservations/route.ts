import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { createReservationSchema } from "@/lib/schemas";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

// Reservation window: 10 minutes
const RESERVATION_TTL_MINUTES = 10;

// Idempotency key TTL: 24 hours
const IDEMPOTENCY_TTL_SECONDS = 86400;

/**
 * POST /api/reservations
 *
 * Reserve units for a product at a specific warehouse.
 * Uses PostgreSQL SELECT FOR UPDATE for race-condition-safe concurrency.
 *
 * Returns 409 if not enough stock available.
 * Supports Idempotency-Key header for safe retries (bonus).
 */
export async function POST(request: NextRequest) {
  try {
    // ── Idempotency check ──────────────────────────
    const idempotencyKey = request.headers.get("idempotency-key");

    if (idempotencyKey) {
      try {
        // Check Redis first (fast path)
        const cached = await redis.get<string>(`idem:${idempotencyKey}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return NextResponse.json(parsed.body, {
            status: parsed.status,
          });
        }
      } catch {
        // Redis unavailable — fall through to normal processing
        console.warn("Redis unavailable for idempotency check, continuing...");
      }
    }

    // ── Parse and validate request body ──────────────
    const body = await request.json();
    const parsed = createReservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: parsed.error.issues.map((i) => i.message).join(", "),
        },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // ── Concurrency-safe reservation using SELECT FOR UPDATE ──
    // This is the CORE of the exercise.
    //
    // How it works:
    // 1. Begin a serializable transaction
    // 2. SELECT the Stock row FOR UPDATE — acquires an exclusive row lock
    // 3. Check if enough units are available (totalUnits - reservedUnits >= quantity)
    // 4. If yes: increment reservedUnits, create Reservation
    // 5. If no: return 409 Conflict
    //
    // Two concurrent requests for the last unit:
    // - Request A acquires the lock first, increments reservedUnits, commits
    // - Request B waits for the lock, then reads the updated row
    // - Request B sees availableUnits = 0, returns 409
    // - Only one reservation succeeds — no double-booking

    const result = await prisma.$transaction(
      async (tx) => {
        // Step 1: Lock the stock row with SELECT FOR UPDATE
        const stockRows = await tx.$queryRaw<
          Array<{
            id: string;
            totalUnits: number;
            reservedUnits: number;
          }>
        >(
          Prisma.sql`
          SELECT id, "totalUnits", "reservedUnits"
          FROM stocks
          WHERE "productId" = ${productId}
            AND "warehouseId" = ${warehouseId}
          FOR UPDATE
        `
        );

        if (stockRows.length === 0) {
          throw new Error("STOCK_NOT_FOUND");
        }

        const stock = stockRows[0];
        const availableUnits = stock.totalUnits - stock.reservedUnits;

        // Step 2: Check availability
        if (availableUnits < quantity) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        // Step 3: Increment reserved units
        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId,
              warehouseId,
            },
          },
          data: {
            reservedUnits: { increment: quantity },
          },
        });

        // Step 4: Create the reservation
        const expiresAt = new Date(
          Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000
        );

        const reservation = await tx.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity,
            status: "PENDING",
            expiresAt,
          },
          include: {
            product: {
              select: { name: true, sku: true, price: true },
            },
            warehouse: {
              select: { name: true, location: true },
            },
          },
        });

        return reservation;
      },
      {
        // Use serializable isolation for maximum safety
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      }
    );

    const responseBody = {
      id: result.id,
      productId: result.productId,
      warehouseId: result.warehouseId,
      quantity: result.quantity,
      status: result.status,
      expiresAt: result.expiresAt.toISOString(),
      createdAt: result.createdAt.toISOString(),
      product: result.product,
      warehouse: result.warehouse,
    };

    // ── Store idempotency record ──────────────────
    if (idempotencyKey) {
      try {
        await redis.set(
          `idem:${idempotencyKey}`,
          JSON.stringify({ status: 201, body: responseBody }),
          { ex: IDEMPOTENCY_TTL_SECONDS }
        );
      } catch {
        // Redis unavailable — idempotency won't cache, but request succeeded
        console.warn("Redis unavailable for idempotency store");
      }
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (error) {
    // ── Handle specific errors ──────────────────
    if (error instanceof Error) {
      if (error.message === "STOCK_NOT_FOUND") {
        return NextResponse.json(
          { error: "Stock not found for this product/warehouse combination" },
          { status: 404 }
        );
      }
      if (error.message === "INSUFFICIENT_STOCK") {
        const errorResponse = {
          error: "Insufficient stock available",
          details:
            "Not enough units available to fulfill this reservation. Another customer may have reserved the remaining stock.",
        };

        // Cache the 409 for idempotency too
        const idempotencyKey = request.headers.get("idempotency-key");
        if (idempotencyKey) {
          try {
            await redis.set(
              `idem:${idempotencyKey}`,
              JSON.stringify({ status: 409, body: errorResponse }),
              { ex: IDEMPOTENCY_TTL_SECONDS }
            );
          } catch {
            // Redis unavailable
          }
        }

        return NextResponse.json(errorResponse, { status: 409 });
      }
    }

    console.error("POST /api/reservations error:", error);
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    );
  }
}
