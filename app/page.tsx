"use client";

import { useEffect, useState, useCallback } from "react";
import { ProductCard } from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import type { ProductResponse } from "@/lib/schemas";

export default function ProductListingPage() {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch("/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      const data = await response.json();
      setProducts(data);
      setError(null);
    } catch {
      setError("Failed to load products. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();

    // Auto-refresh stock every 30 seconds
    const interval = setInterval(fetchProducts, 30000);
    return () => clearInterval(interval);
  }, [fetchProducts]);

  // Filter products by search query
  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  // Compute stats
  const totalAvailable = products.reduce(
    (sum, p) => sum + p.stocks.reduce((s, st) => s + st.availableUnits, 0),
    0
  );
  const totalReserved = products.reduce(
    (sum, p) => sum + p.stocks.reduce((s, st) => s + (st.totalUnits - st.availableUnits), 0),
    0
  );
  const warehouseCount = new Set(
    products.flatMap((p) => p.stocks.map((s) => s.warehouseId))
  ).size;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
                <svg
                  className="h-5 w-5 text-emerald-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">
                  Allo Health
                </h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  Inventory Reservation System
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Live indicator */}
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live
              </div>

              <button
                onClick={() => {
                  setIsLoading(true);
                  fetchProducts();
                }}
                className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-all cursor-pointer"
              >
                <svg
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Products</h2>
              <p className="text-muted-foreground max-w-2xl">
                Browse our health & wellness catalog. Select a warehouse and
                reserve units — your reservation holds stock for{" "}
                <span className="text-foreground font-medium">10 minutes</span>{" "}
                while you complete payment.
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search products or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-card/50 py-2 pl-10 pr-4 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all"
              />
            </div>
          </div>

          {/* Stats Bar */}
          {products.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              <Badge
                variant="outline"
                className="gap-1.5 py-1.5 px-3 text-xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {products.length} Products
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 py-1.5 px-3 text-xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                {warehouseCount} Warehouses
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 py-1.5 px-3 text-xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {totalAvailable.toLocaleString("en-IN")} Available
              </Badge>
              <Badge
                variant="outline"
                className="gap-1.5 py-1.5 px-3 text-xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                {totalReserved.toLocaleString("en-IN")} Reserved
              </Badge>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-destructive font-medium">{error}</p>
            <button
              onClick={fetchProducts}
              className="mt-3 text-sm text-muted-foreground hover:text-foreground underline cursor-pointer"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !products.length && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-[420px] rounded-xl border border-border/50 bg-card/30 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && products.length === 0 && !error && (
          <div className="text-center py-20 space-y-3">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <svg
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
            <p className="text-muted-foreground text-lg">
              No products found. Run{" "}
              <code className="text-xs bg-muted px-2 py-1 rounded">
                npm run db:seed
              </code>{" "}
              to populate the database.
            </p>
          </div>
        )}

        {/* No Search Results */}
        {!isLoading &&
          products.length > 0 &&
          filteredProducts.length === 0 && (
            <div className="text-center py-20">
              <p className="text-muted-foreground">
                No products match &quot;{search}&quot;
              </p>
            </div>
          )}

        {/* Product Grid */}
        {filteredProducts.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onReserved={fetchProducts}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <footer className="mt-16 border-t border-border/50 pt-8 pb-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
            <p>
              Built with Next.js, Prisma, Supabase & Upstash Redis
            </p>
            <p>
              Stock auto-refreshes every 30s • Reservations expire in 10 min
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
