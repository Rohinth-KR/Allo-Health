import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyRecord.deleteMany();

  console.log("  Cleared existing data.");

  // ──────────────────────────────────────────────
  // Create 5 Warehouses
  // ──────────────────────────────────────────────
  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: {
        name: "Mumbai Central Hub",
        location: "Mumbai, Maharashtra",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Delhi NCR Fulfillment",
        location: "Gurugram, Haryana",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Bangalore Tech Park",
        location: "Bangalore, Karnataka",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Chennai Coastal Depot",
        location: "Chennai, Tamil Nadu",
      },
    }),
    prisma.warehouse.create({
      data: {
        name: "Kolkata East Zone",
        location: "Kolkata, West Bengal",
      },
    }),
  ]);

  console.log(`  Created ${warehouses.length} warehouses.`);

  // ──────────────────────────────────────────────
  // Create 9 Health & Wellness Products
  // ──────────────────────────────────────────────
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Ashwagandha Root Extract",
        sku: "ALLO-ASH-001",
        description:
          "Premium KSM-66 Ashwagandha root extract capsules for stress relief and vitality. 60 capsules per bottle.",
        price: 599,
        imageUrl: null,
      },
    }),
    prisma.product.create({
      data: {
        name: "Omega-3 Fish Oil",
        sku: "ALLO-OMG-002",
        description:
          "Triple-strength Omega-3 fish oil softgels with EPA & DHA for heart and brain health. 90 softgels.",
        price: 899,
        imageUrl: null,
      },
    }),
    prisma.product.create({
      data: {
        name: "Vitamin D3 + K2 Drops",
        sku: "ALLO-VDK-003",
        description:
          "Liquid Vitamin D3 5000 IU with K2 MK-7 for bone density and immune support. 30ml bottle.",
        price: 449,
        imageUrl: null,
      },
    }),
    prisma.product.create({
      data: {
        name: "Probiotics 50 Billion CFU",
        sku: "ALLO-PRO-004",
        description:
          "Advanced multi-strain probiotic blend with 16 clinically studied strains for gut health. 30 capsules.",
        price: 749,
        imageUrl: null,
      },
    }),
    prisma.product.create({
      data: {
        name: "Collagen Peptides Powder",
        sku: "ALLO-COL-005",
        description:
          "Hydrolyzed marine collagen peptides for skin elasticity, joint support and hair growth. 250g tub.",
        price: 1299,
        imageUrl: null,
      },
    }),
    prisma.product.create({
      data: {
        name: "Magnesium Glycinate",
        sku: "ALLO-MAG-006",
        description:
          "High-absorption magnesium glycinate 400mg for sleep quality and muscle recovery. 60 tablets.",
        price: 499,
        imageUrl: null,
      },
    }),
    prisma.product.create({
      data: {
        name: "Turmeric Curcumin Complex",
        sku: "ALLO-TUR-007",
        description:
          "Curcumin C3 complex with BioPerine black pepper extract for joint comfort and inflammation support. 60 capsules.",
        price: 649,
        imageUrl: null,
      },
    }),
    prisma.product.create({
      data: {
        name: "Biotin 10000mcg",
        sku: "ALLO-BIO-008",
        description:
          "High-potency biotin supplements for healthy hair, skin and nails. 120 vegetarian tablets.",
        price: 399,
        imageUrl: null,
      },
    }),
    prisma.product.create({
      data: {
        name: "Plant Protein Blend",
        sku: "ALLO-PPB-010",
        description:
          "Organic pea and brown rice protein powder with complete amino acid profile. Chocolate flavour. 1kg bag.",
        price: 1899,
        imageUrl: null,
      },
    }),
  ]);

  console.log(`  Created ${products.length} products.`);

  // ──────────────────────────────────────────────
  // Create Stock entries — each product in each warehouse
  // with varying realistic stock levels
  // ──────────────────────────────────────────────
  const stockLevels = [
    // [productIndex, warehouseIndex, totalUnits]
    // Ashwagandha — popular, well-stocked
    [0, 0, 150], [0, 1, 120], [0, 2, 200], [0, 3, 80], [0, 4, 60],
    // Omega-3 — moderately stocked
    [1, 0, 90], [1, 1, 70], [1, 2, 110], [1, 3, 50], [1, 4, 40],
    // Vitamin D3 — high demand, some low stock
    [2, 0, 200], [2, 1, 180], [2, 2, 250], [2, 3, 30], [2, 4, 15],
    // Probiotics — moderate
    [3, 0, 75], [3, 1, 60], [3, 2, 90], [3, 3, 45], [3, 4, 35],
    // Collagen — premium, lower stock
    [4, 0, 40], [4, 1, 30], [4, 2, 55], [4, 3, 20], [4, 4, 10],
    // Magnesium — well-stocked
    [5, 0, 180], [5, 1, 150], [5, 2, 200], [5, 3, 100], [5, 4, 80],
    // Turmeric — moderate
    [6, 0, 100], [6, 1, 85], [6, 2, 120], [6, 3, 60], [6, 4, 45],
    // Biotin — high stock, affordable
    [7, 0, 250], [7, 1, 200], [7, 2, 300], [7, 3, 150], [7, 4, 100],
    // Plant Protein — bulk item, lower stock
    [8, 0, 35], [8, 1, 25], [8, 2, 50], [8, 3, 15], [8, 4, 8],
  ] as const;

  const stockEntries = await Promise.all(
    stockLevels.map(([pIdx, wIdx, units]) =>
      prisma.stock.create({
        data: {
          productId: products[pIdx].id,
          warehouseId: warehouses[wIdx].id,
          totalUnits: units,
          reservedUnits: 0,
        },
      })
    )
  );

  console.log(`  Created ${stockEntries.length} stock entries.`);

  console.log("\n✅ Seed complete!");
  console.log(`   ${products.length} products`);
  console.log(`   ${warehouses.length} warehouses`);
  console.log(`   ${stockEntries.length} stock entries`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
