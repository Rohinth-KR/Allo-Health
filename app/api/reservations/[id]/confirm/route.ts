import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

// Idempotency key TTL: 24 hours
const IDEMPOTENCY_TTL_SECONDS = 86400;

/**
 * POST /api/reservations/:id/confirm
 *
 * Confirm a pending reservation (payment succeeded).
 * - Checks that the reservation exists and is PENDING
 * - Checks that it hasn't expired → returns 410 Gone if expired
 * - Sets status to CONFIRMED
 * - Decrements both totalUnits and reservedUnits (units permanently sold)
 *
 * Supports Idempotency-Key header for safe retries.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ── Idempotency check ──────────────────────────
    const idempotencyKey = request.headers.get("idempotency-key");

    if (idempotencyKey) {
      try {
        const cached = await redis.get<string>(`idem:${idempotencyKey}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          return NextResponse.json(parsed.body, { status: parsed.status });
        }
      } catch {
        console.warn("Redis unavailable for idempotency check, continuing...");
      }
    }

    // ── Find the reservation ──────────────────────
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: { select: { name: true, sku: true, price: true } },
        warehouse: { select: { name: true, location: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      );
    }

    if (reservation.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `Reservation is already ${reservation.status.toLowerCase()}`,
          details: `This reservation has already been ${reservation.status.toLowerCase()} and cannot be confirmed.`,
        },
        { status: 400 }
      );
    }

    // ── Check if expired → 410 Gone ──────────────
    const now = new Date();
    if (reservation.expiresAt < now) {
      // Auto-release the expired reservation
      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id },
          data: { status: "RELEASED" },
        });
        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: {
            reservedUnits: { decrement: reservation.quantity },
          },
        });
      });

      const errorResponse = {
        error: "Reservation has expired",
        details:
          "This reservation expired before payment was confirmed. The units have been released back to available stock. Please create a new reservation.",
      };

      if (idempotencyKey) {
        try {
          await redis.set(
            `idem:${idempotencyKey}`,
            JSON.stringify({ status: 410, body: errorResponse }),
            { ex: IDEMPOTENCY_TTL_SECONDS }
          );
        } catch {
          // Redis unavailable
        }
      }

      return NextResponse.json(errorResponse, { status: 410 });
    }

    // ── Confirm: update reservation + decrement stock ──
    const confirmed = await prisma.$transaction(
      async (tx) => {
        // Lock the stock row
        await tx.$queryRaw(
          Prisma.sql`
          SELECT id FROM stocks
          WHERE "productId" = ${reservation.productId}
            AND "warehouseId" = ${reservation.warehouseId}
          FOR UPDATE
        `
        );

        // Update reservation status
        const updated = await tx.reservation.update({
          where: { id },
          data: { status: "CONFIRMED" },
          include: {
            product: { select: { name: true, sku: true, price: true } },
            warehouse: { select: { name: true, location: true } },
          },
        });

        // Decrement both totalUnits (sold) and reservedUnits (no longer reserved)
        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: {
            totalUnits: { decrement: reservation.quantity },
            reservedUnits: { decrement: reservation.quantity },
          },
        });

        return updated;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      }
    );

    const responseBody = {
      id: confirmed.id,
      productId: confirmed.productId,
      warehouseId: confirmed.warehouseId,
      quantity: confirmed.quantity,
      status: confirmed.status,
      expiresAt: confirmed.expiresAt.toISOString(),
      createdAt: confirmed.createdAt.toISOString(),
      product: confirmed.product,
      warehouse: confirmed.warehouse,
    };

    // Store idempotency record
    if (idempotencyKey) {
      try {
        await redis.set(
          `idem:${idempotencyKey}`,
          JSON.stringify({ status: 200, body: responseBody }),
          { ex: IDEMPOTENCY_TTL_SECONDS }
        );
      } catch {
        console.warn("Redis unavailable for idempotency store");
      }
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("POST /api/reservations/:id/confirm error:", error);
    return NextResponse.json(
      { error: "Failed to confirm reservation" },
      { status: 500 }
    );
  }
}
