"use client";

import { Badge } from "@/components/ui/badge";

interface StockBadgeProps {
  available: number;
  total: number;
}

/**
 * StockBadge — Shows available/total units with color-coded status
 * Blue = well-stocked, Amber = low stock, Red = critical/out of stock
 */
export function StockBadge({ available, total }: StockBadgeProps) {
  const percentage = total > 0 ? (available / total) * 100 : 0;

  let bgColor = "";
  let textColor = "";
  let dotColor = "";
  let label = "";

  if (available === 0) {
    bgColor = "oklch(0.97 0.03 27)";
    textColor = "oklch(0.55 0.22 27)";
    dotColor = "oklch(0.65 0.22 27)";
    label = "Out of Stock";
  } else if (percentage <= 20) {
    bgColor = "oklch(0.97 0.04 50)";
    textColor = "oklch(0.50 0.18 50)";
    dotColor = "oklch(0.65 0.18 50)";
    label = `${available} left`;
  } else if (percentage <= 50) {
    bgColor = "oklch(0.97 0.04 80)";
    textColor = "oklch(0.50 0.14 80)";
    dotColor = "oklch(0.72 0.14 80)";
    label = `${available} units`;
  } else {
    bgColor = "oklch(0.93 0.04 195)";
    textColor = "oklch(0.38 0.13 195)";
    dotColor = "oklch(0.55 0.15 195)";
    label = `${available} units`;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold font-mono"
      style={{ background: bgColor, color: textColor }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />
      {label}
    </span>
  );
}
