import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/warehouses
 * Returns all warehouses.
 */
export async function GET() {
  try {
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { name: "asc" },
    });

    const response = warehouses.map((warehouse) => ({
      id: warehouse.id,
      name: warehouse.name,
      location: warehouse.location,
    }));

    return NextResponse.json(response);
  } catch (error) {
    console.error("GET /api/warehouses error:", error);
    return NextResponse.json(
      { error: "Failed to fetch warehouses" },
      { status: 500 }
    );
  }
}
