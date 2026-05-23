import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/reservations/:id/release
 *
 * Release a pending reservation early (payment failed or user cancelled).
 * - Sets status to RELEASED
 * - Decrements reservedUnits only (units go back to available stock)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // ── Find the reservation ──────────────────────
    const reservation = await prisma.reservation.findUnique({
      where: { id },
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
          details: `This reservation has already been ${reservation.status.toLowerCase()} and cannot be released.`,
        },
        { status: 400 }
      );
    }

    // ── Release: update reservation + restore stock ──
    const released = await prisma.$transaction(
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
          data: { status: "RELEASED" },
          include: {
            product: { select: { name: true, sku: true, price: true } },
            warehouse: { select: { name: true, location: true } },
          },
        });

        // Decrement reservedUnits only — units go back to available
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

        return updated;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      }
    );

    return NextResponse.json({
      id: released.id,
      productId: released.productId,
      warehouseId: released.warehouseId,
      quantity: released.quantity,
      status: released.status,
      expiresAt: released.expiresAt.toISOString(),
      createdAt: released.createdAt.toISOString(),
      product: released.product,
      warehouse: released.warehouse,
    });
  } catch (error) {
    console.error("POST /api/reservations/:id/release error:", error);
    return NextResponse.json(
      { error: "Failed to release reservation" },
      { status: 500 }
    );
  }
}
