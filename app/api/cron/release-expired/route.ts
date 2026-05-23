import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/release-expired
 *
 * Cron job endpoint that runs every minute (configured in vercel.json).
 * Finds all PENDING reservations past their expiresAt time and releases them,
 * restoring the reserved units back to available stock.
 *
 * Protected by CRON_SECRET env var to prevent unauthorized access.
 */
export async function GET(request: NextRequest) {
  try {
    // ── Verify cron secret ──────────────────────────
    const authHeader = request.headers.get("authorization");

    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();

    // Find all expired pending reservations
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now },
      },
    });

    if (expiredReservations.length === 0) {
      return NextResponse.json({
        message: "No expired reservations to release",
        released: 0,
      });
    }

    // Release each one in its own transaction for safety
    let releasedCount = 0;

    for (const reservation of expiredReservations) {
      try {
        await prisma.$transaction(async (tx) => {
          // Update reservation status
          await tx.reservation.update({
            where: { id: reservation.id },
            data: { status: "RELEASED" },
          });

          // Restore reserved units to available stock
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

        releasedCount++;
      } catch (error) {
        // Log but continue — don't let one failure stop others
        console.error(
          `Failed to release reservation ${reservation.id}:`,
          error
        );
      }
    }

    console.log(
      `[CRON] Released ${releasedCount}/${expiredReservations.length} expired reservations`
    );

    return NextResponse.json({
      message: `Released ${releasedCount} expired reservations`,
      released: releasedCount,
      total: expiredReservations.length,
    });
  } catch (error) {
    console.error("GET /api/cron/release-expired error:", error);
    return NextResponse.json(
      { error: "Failed to release expired reservations" },
      { status: 500 }
    );
  }
}
