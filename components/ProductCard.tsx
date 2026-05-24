"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StockBadge } from "@/components/StockBadge";
import type { ProductResponse } from "@/lib/schemas";

interface ProductCardProps {
  product: ProductResponse;
  onReserved?: () => void;
}

/**
 * Returns a relevant medical emoji icon for a product based on its name.
 */
function getMedicalIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("vitamin") || n.includes("d3") || n.includes("k2")) return "☀️";
  if (n.includes("omega") || n.includes("fish")) return "🐟";
  if (n.includes("protein") || n.includes("collagen")) return "💪";
  if (n.includes("probiotic") || n.includes("gut")) return "🦠";
  if (n.includes("magnesium") || n.includes("sleep")) return "🌙";
  if (n.includes("turmeric") || n.includes("curcumin")) return "🌿";
  if (n.includes("biotin") || n.includes("hair") || n.includes("nail")) return "✨";
  if (n.includes("ashwagandha") || n.includes("stress")) return "🧘";
  if (n.includes("zinc") || n.includes("immune")) return "🛡️";
  return "💊";
}

/**
 * ProductCard — Displays a product with stock levels per warehouse
 * and a "Reserve" button that creates a reservation.
 * Includes medical category icons, urgency labels, and stock bars.
 */
export function ProductCard({ product, onReserved }: ProductCardProps) {
  const router = useRouter();
  const [isReserving, setIsReserving] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const totalAvailable = product.stocks.reduce(
    (sum, s) => sum + s.availableUnits,
    0
  );

  const icon = getMedicalIcon(product.name);

  const handleReserve = async () => {
    if (!selectedWarehouse) {
      toast.error("Please select a warehouse");
      return;
    }

    const stock = product.stocks.find((s) => s.warehouseId === selectedWarehouse);
    if (!stock || stock.availableUnits < quantity) {
      toast.error("Not enough stock at selected warehouse");
      return;
    }

    setIsReserving(true);

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": uuidv4(),
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse,
          quantity,
        }),
      });

      const data = await response.json();

      if (response.status === 409) {
        toast.error("Not enough stock!", {
          description:
            data.details || "Another customer may have reserved the remaining units.",
        });
        onReserved?.();
        return;
      }

      if (!response.ok) {
        toast.error("Reservation failed", {
          description: data.error || "Something went wrong",
        });
        return;
      }

      toast.success("Stock reserved!", {
        description: `${quantity} unit(s) reserved for 10 minutes`,
      });

      router.push(`/reservations/${data.id}`);
    } catch {
      toast.error("Network error", {
        description: "Please check your connection and try again",
      });
    } finally {
      setIsReserving(false);
    }
  };

  return (
    <Card
      className="card-hover flex flex-col overflow-hidden bg-white"
      style={{
        borderColor: "var(--border)",
        borderRadius: "1rem",
        boxShadow: "0 2px 8px oklch(0.48 0.17 240 / 0.06)",
      }}
    >
      {/* Coloured top strip based on icon */}
      <div
        className="h-1.5 w-full"
        style={{ background: "linear-gradient(90deg, oklch(0.48 0.17 240), oklch(0.55 0.15 195))" }}
      />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Icon bubble */}
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
              style={{ background: "oklch(0.95 0.03 220)" }}
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base leading-tight font-semibold" style={{ color: "var(--foreground)" }}>
                {product.name}
              </CardTitle>
              <CardDescription className="mt-0.5 font-mono text-[11px]">
                {product.sku}
              </CardDescription>
            </div>
          </div>
          <Badge
            className="shrink-0 font-semibold text-xs"
            style={{ background: "oklch(0.92 0.06 220)", color: "oklch(0.38 0.15 240)", border: "none" }}
          >
            ₹{product.price.toLocaleString("en-IN")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {product.description && (
          <p className="text-sm leading-relaxed line-clamp-2" style={{ color: "var(--muted-foreground)" }}>
            {product.description}
          </p>
        )}

        {/* Stock per warehouse */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
            Stock by Warehouse
          </p>
          <div className="space-y-2">
            {product.stocks.map((stock) => {
              const pct = stock.totalUnits > 0 ? (stock.availableUnits / stock.totalUnits) * 100 : 0;
              const isUrgent = stock.availableUnits > 0 && stock.availableUnits <= 3;
              const barColor =
                stock.availableUnits === 0
                  ? "oklch(0.65 0.15 27)"
                  : pct <= 20
                  ? "oklch(0.72 0.16 50)"
                  : pct <= 50
                  ? "oklch(0.72 0.14 80)"
                  : "oklch(0.55 0.15 195)";

              return (
                <button
                  key={stock.warehouseId}
                  onClick={() => {
                    if (stock.availableUnits > 0) {
                      setSelectedWarehouse(stock.warehouseId);
                      setQuantity(1);
                    }
                  }}
                  disabled={stock.availableUnits === 0}
                  className={`warehouse-row w-full rounded-xl px-3 py-2.5 text-left text-sm ${
                    stock.availableUnits === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                  }`}
                  style={{
                    background:
                      selectedWarehouse === stock.warehouseId
                        ? "oklch(0.93 0.06 220)"
                        : "oklch(0.97 0.01 220)",
                    border:
                      selectedWarehouse === stock.warehouseId
                        ? "1.5px solid oklch(0.48 0.17 240)"
                        : "1.5px solid oklch(0.88 0.03 220)",
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-xs truncate" style={{ color: "var(--foreground)" }}>
                        {stock.warehouseName}
                      </span>
                      <span className="text-[10px] truncate" style={{ color: "var(--muted-foreground)" }}>
                        {stock.warehouseLocation}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isUrgent && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "oklch(0.97 0.04 50)", color: "oklch(0.55 0.18 50)" }}>
                          ⚡ Only {stock.availableUnits} left!
                        </span>
                      )}
                      <StockBadge available={stock.availableUnits} total={stock.totalUnits} />
                    </div>
                  </div>

                  {/* Stock progress bar */}
                  <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "oklch(0.90 0.02 220)" }}>
                    <div
                      className="h-full rounded-full stock-bar-fill"
                      style={{ width: `${pct}%`, background: barColor }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quantity selector */}
        {selectedWarehouse && (
          <div className="flex items-center gap-3 pt-1">
            <label className="text-sm" style={{ color: "var(--muted-foreground)" }}>Qty:</label>
            <div className="flex items-center rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-1.5 text-sm transition-colors hover:bg-sky-50"
                disabled={quantity <= 1}
              >
                −
              </button>
              <span className="px-4 py-1.5 font-mono text-sm bg-white min-w-[3rem] text-center" style={{ color: "var(--foreground)" }}>
                {quantity}
              </span>
              <button
                onClick={() => {
                  const stock = product.stocks.find((s) => s.warehouseId === selectedWarehouse);
                  if (stock && quantity < stock.availableUnits) setQuantity(quantity + 1);
                }}
                className="px-3 py-1.5 text-sm transition-colors hover:bg-sky-50"
              >
                +
              </button>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-4">
        <Button
          onClick={handleReserve}
          disabled={!selectedWarehouse || isReserving || totalAvailable === 0}
          className="w-full font-semibold cursor-pointer text-white"
          size="lg"
          style={{
            background:
              totalAvailable === 0
                ? "oklch(0.75 0 0)"
                : "linear-gradient(135deg, oklch(0.48 0.17 240), oklch(0.42 0.15 255))",
            border: "none",
          }}
        >
          {isReserving ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Reserving...
            </span>
          ) : totalAvailable === 0 ? (
            "Out of Stock"
          ) : !selectedWarehouse ? (
            "Select a Warehouse"
          ) : (
            `Reserve ${quantity} Unit${quantity > 1 ? "s" : ""}`
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
