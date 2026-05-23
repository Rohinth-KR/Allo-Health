import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/reservations/:id
 *
 * Get a single reservation by ID with product and warehouse details.
 * Used by the checkout page to display reservation info.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    return NextResponse.json({
      id: reservation.id,
      productId: reservation.productId,
      warehouseId: reservation.warehouseId,
      quantity: reservation.quantity,
      status: reservation.status,
      expiresAt: reservation.expiresAt.toISOString(),
      createdAt: reservation.createdAt.toISOString(),
      product: reservation.product,
      warehouse: reservation.warehouse,
    });
  } catch (error) {
    console.error("GET /api/reservations/:id error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reservation" },
      { status: 500 }
    );
  }
}
