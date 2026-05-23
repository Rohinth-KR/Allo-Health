import { z } from "zod";

// ──────────────────────────────────────────────
// Request schemas — shared between API and frontend
// ──────────────────────────────────────────────

export const createReservationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  warehouseId: z.string().min(1, "Warehouse ID is required"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

// ──────────────────────────────────────────────
// Response schemas — typed API responses
// ──────────────────────────────────────────────

export const stockResponseSchema = z.object({
  warehouseId: z.string(),
  warehouseName: z.string(),
  warehouseLocation: z.string(),
  totalUnits: z.number(),
  reservedUnits: z.number(),
  availableUnits: z.number(),
});

export type StockResponse = z.infer<typeof stockResponseSchema>;

export const productResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  sku: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  imageUrl: z.string().nullable(),
  stocks: z.array(stockResponseSchema),
});

export type ProductResponse = z.infer<typeof productResponseSchema>;

export const warehouseResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
});

export type WarehouseResponse = z.infer<typeof warehouseResponseSchema>;

export const reservationResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number(),
  status: z.enum(["PENDING", "CONFIRMED", "RELEASED"]),
  expiresAt: z.string(),
  createdAt: z.string(),
  product: z.object({
    name: z.string(),
    sku: z.string(),
    price: z.number(),
  }),
  warehouse: z.object({
    name: z.string(),
    location: z.string(),
  }),
});

export type ReservationResponse = z.infer<typeof reservationResponseSchema>;

export const errorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
