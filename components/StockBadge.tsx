"use client";

import { Badge } from "@/components/ui/badge";

interface StockBadgeProps {
  available: number;
  total: number;
}

/**
 * StockBadge — Shows available/total units with color-coded status
 * Green = well-stocked, Yellow = low stock, Red = critical/out of stock
 */
export function StockBadge({ available, total }: StockBadgeProps) {
  const percentage = total > 0 ? (available / total) * 100 : 0;

  let variant: "default" | "secondary" | "destructive" | "outline" = "default";
  let label = "";
  let dotColor = "";

  if (available === 0) {
    variant = "destructive";
    label = "Out of Stock";
    dotColor = "bg-red-500";
  } else if (percentage <= 20) {
    variant = "destructive";
    label = `${available} left`;
    dotColor = "bg-red-500";
  } else if (percentage <= 50) {
    variant = "outline";
    label = `${available} units`;
    dotColor = "bg-yellow-500";
  } else {
    variant = "outline";
    label = `${available} units`;
    dotColor = "bg-emerald-500";
  }

  return (
    <Badge variant={variant} className="gap-1.5 font-mono text-xs">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {label}
    </Badge>
  );
}
