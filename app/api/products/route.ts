import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/products
 * Returns all products with available stock per warehouse.
 * Also performs lazy cleanup of expired reservations for accuracy.
 */
export async function GET() {
  try {
    // Lazy cleanup: release any expired pending reservations
    // This ensures the stock numbers are always accurate
    const now = new Date();
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: now },
      },
    });

    if (expiredReservations.length > 0) {
      // Release each expired reservation and restore stock
      for (const reservation of expiredReservations) {
        await prisma.$transaction(async (tx) => {
          await tx.reservation.update({
            where: { id: reservation.id },
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
      }
    }

    // Fetch all products with their stock levels
    const products = await prisma.product.findMany({
      include: {
        stocks: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Transform to response shape with computed availableUnits
    const response = products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      description: product.description,
      price: product.price,
      imageUrl: product.imageUrl,
      stocks: product.stocks.map((stock) => ({
        warehouseId: stock.warehouseId,
        warehouseName: stock.warehouse.name,
        warehouseLocation: stock.warehouse.location,
        totalUnits: stock.totalUnits,
        reservedUnits: stock.reservedUnits,
        availableUnits: stock.totalUnits - stock.reservedUnits,
      })),
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/products error:", error);
    console.error("DATABASE_URL set:", !!process.env.DATABASE_URL);
    console.error("Error name:", (error as Error)?.name);
    console.error("Error message:", (error as Error)?.message);
    return NextResponse.json(
      { error: "Failed to fetch products", details: (error as Error)?.message },
      { status: 500 }
    );
  }
}
