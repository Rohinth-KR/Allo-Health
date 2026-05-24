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
    const interval = setInterval(fetchProducts, 30000);
    return () => clearInterval(interval);
  }, [fetchProducts]);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const totalAvailable = products.reduce(
    (sum, p) => sum + p.stocks.reduce((s, st) => s + st.availableUnits, 0),
    0
  );
  const totalReserved = products.reduce(
    (sum, p) =>
      sum +
      p.stocks.reduce((s, st) => s + (st.totalUnits - st.availableUnits), 0),
    0
  );
  const warehouseCount = new Set(
    products.flatMap((p) => p.stocks.map((s) => s.warehouseId))
  ).size;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-xl shadow-sm" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: "oklch(0.92 0.06 220)" }}>
                {/* Medical cross */}
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="20" rx="2" fill="oklch(0.48 0.17 240)" />
                  <rect x="2" y="9" width="20" height="6" rx="2" fill="oklch(0.48 0.17 240)" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight" style={{ color: "oklch(0.48 0.17 240)" }}>
                  Allo Health
                </h1>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: "var(--muted-foreground)" }}>
                  Inventory Reservation System
                </p>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "oklch(0.65 0.15 160)" }}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "oklch(0.55 0.17 160)" }}></span>
                </span>
                Live
              </div>
              <button
                onClick={() => { setIsLoading(true); fetchProducts(); }}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all cursor-pointer hover:bg-sky-50"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)" }}
              >
                <svg className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <div className="hero-gradient border-b" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "oklch(0.92 0.06 220)", color: "oklch(0.38 0.15 240)" }}>
                  🏥 Pharmaceutical Catalog
                </span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight" style={{ color: "var(--foreground)" }}>
                Health & Wellness Products
              </h2>
              <p className="max-w-xl text-sm" style={{ color: "var(--muted-foreground)" }}>
                Browse our certified health catalog. Select a warehouse location and reserve units —
                your hold is secured for{" "}
                <span className="font-semibold" style={{ color: "oklch(0.48 0.17 240)" }}>10 minutes</span>{" "}
                while you complete the order.
              </p>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--muted-foreground)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:outline-none transition-all"
                style={{ borderColor: "var(--border)" }}
                onFocus={(e) => { e.target.style.borderColor = "oklch(0.48 0.17 240)"; e.target.style.boxShadow = "0 0 0 3px oklch(0.48 0.17 240 / 0.15)"; }}
                onBlur={(e) => { e.target.style.borderColor = "var(--border)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          {/* Stats */}
          {products.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3 text-xs bg-white" style={{ borderColor: "var(--border)" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.48 0.17 240)" }} />
                {products.length} Products
              </Badge>
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3 text-xs bg-white" style={{ borderColor: "var(--border)" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.55 0.15 195)" }} />
                {warehouseCount} Warehouses
              </Badge>
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3 text-xs bg-white" style={{ borderColor: "var(--border)" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.55 0.17 160)" }} />
                {totalAvailable.toLocaleString("en-IN")} Available
              </Badge>
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3 text-xs bg-white" style={{ borderColor: "var(--border)" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: "oklch(0.72 0.14 80)" }} />
                {totalReserved.toLocaleString("en-IN")} Reserved
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && (
          <div className="rounded-xl border p-6 text-center mb-6" style={{ borderColor: "oklch(0.88 0.12 27)", background: "oklch(0.98 0.03 27)" }}>
            <p className="font-medium" style={{ color: "oklch(0.55 0.22 27)" }}>{error}</p>
            <button onClick={fetchProducts} className="mt-3 text-sm underline cursor-pointer" style={{ color: "var(--muted-foreground)" }}>
              Try again
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !products.length && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[460px] rounded-2xl animate-pulse" style={{ background: "oklch(0.93 0.02 220)" }} />
            ))}
          </div>
        )}

        {/* Empty DB State */}
        {!isLoading && products.length === 0 && !error && (
          <div className="text-center py-20 space-y-4">
            <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "oklch(0.92 0.04 220)" }}>
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" style={{ color: "oklch(0.48 0.17 240)" }}>
                <rect x="9" y="2" width="6" height="20" rx="2" fill="currentColor" />
                <rect x="2" y="9" width="20" height="6" rx="2" fill="currentColor" />
              </svg>
            </div>
            <p className="text-lg" style={{ color: "var(--muted-foreground)" }}>
              No products found. Run{" "}
              <code className="text-xs rounded px-2 py-1" style={{ background: "oklch(0.92 0.02 220)" }}>
                npm run db:seed
              </code>
            </p>
          </div>
        )}

        {/* No search results */}
        {!isLoading && products.length > 0 && filteredProducts.length === 0 && (
          <div className="text-center py-20">
            <p style={{ color: "var(--muted-foreground)" }}>
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
        <footer className="mt-16 border-t pt-8 pb-8" style={{ borderColor: "var(--border)" }}>
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="20" rx="2" fill="oklch(0.48 0.17 240)" />
                <rect x="2" y="9" width="20" height="6" rx="2" fill="oklch(0.48 0.17 240)" />
              </svg>
              <span>Allo Health · Built with Next.js, Prisma, Supabase & Upstash Redis</span>
            </div>
            <p>Stock refreshes every 30s · Reservations expire in 10 min</p>
          </div>
        </footer>
      </main>
    </div>
  );
}
