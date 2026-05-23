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
 * ProductCard — Displays a product with stock levels per warehouse
 * and a "Reserve" button that creates a reservation.
 */
export function ProductCard({ product, onReserved }: ProductCardProps) {
  const router = useRouter();
  const [isReserving, setIsReserving] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<string | null>(
    null
  );
  const [quantity, setQuantity] = useState(1);

  // Get total available across all warehouses
  const totalAvailable = product.stocks.reduce(
    (sum, s) => sum + s.availableUnits,
    0
  );

  const handleReserve = async () => {
    if (!selectedWarehouse) {
      toast.error("Please select a warehouse");
      return;
    }

    const stock = product.stocks.find(
      (s) => s.warehouseId === selectedWarehouse
    );
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
            data.details ||
            "Another customer may have reserved the remaining units.",
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

      // Navigate to checkout page
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
    <Card className="flex flex-col overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all hover:border-border hover:shadow-lg hover:shadow-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg leading-tight">
              {product.name}
            </CardTitle>
            <CardDescription className="mt-1 font-mono text-xs">
              {product.sku}
            </CardDescription>
          </div>
          <Badge variant="secondary" className="shrink-0 font-semibold">
            ₹{product.price.toLocaleString("en-IN")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {product.description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {product.description}
          </p>
        )}

        {/* Stock per warehouse */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Stock by Warehouse
          </p>
          <div className="space-y-1.5">
            {product.stocks.map((stock) => (
              <button
                key={stock.warehouseId}
                onClick={() => {
                  if (stock.availableUnits > 0) {
                    setSelectedWarehouse(stock.warehouseId);
                    setQuantity(1);
                  }
                }}
                disabled={stock.availableUnits === 0}
                className={`
                  w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-all
                  ${
                    selectedWarehouse === stock.warehouseId
                      ? "bg-primary/10 border border-primary/30 ring-1 ring-primary/20"
                      : "bg-muted/30 hover:bg-muted/50 border border-transparent"
                  }
                  ${stock.availableUnits === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate text-xs">
                    {stock.warehouseName}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate">
                    {stock.warehouseLocation}
                  </span>
                </div>
                <StockBadge
                  available={stock.availableUnits}
                  total={stock.totalUnits}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Quantity selector — only show when warehouse is selected */}
        {selectedWarehouse && (
          <div className="flex items-center gap-3 pt-1">
            <label className="text-sm text-muted-foreground">Qty:</label>
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-1.5 hover:bg-muted transition-colors text-sm"
                disabled={quantity <= 1}
              >
                −
              </button>
              <span className="px-4 py-1.5 font-mono text-sm bg-background min-w-[3rem] text-center">
                {quantity}
              </span>
              <button
                onClick={() => {
                  const stock = product.stocks.find(
                    (s) => s.warehouseId === selectedWarehouse
                  );
                  if (stock && quantity < stock.availableUnits) {
                    setQuantity(quantity + 1);
                  }
                }}
                className="px-3 py-1.5 hover:bg-muted transition-colors text-sm"
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
          className="w-full font-medium cursor-pointer"
          size="lg"
        >
          {isReserving ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
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
