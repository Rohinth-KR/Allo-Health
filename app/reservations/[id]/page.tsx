"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ReservationCountdown } from "@/components/ReservationCountdown";
import type { ReservationResponse } from "@/lib/schemas";

export default function ReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [reservation, setReservation] = useState<ReservationResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  const fetchReservation = useCallback(async () => {
    try {
      const response = await fetch(`/api/reservations/${id}`);
      if (!response.ok) throw new Error("Reservation not found");
      const data = await response.json();
      setReservation(data);
      setError(null);

      // Check if already expired
      if (data.status === "PENDING" && new Date(data.expiresAt) < new Date()) {
        setIsExpired(true);
      }
    } catch {
      setError("Failed to load reservation details.");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      const response = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
        headers: {
          "Idempotency-Key": uuidv4(),
        },
      });

      const data = await response.json();

      if (response.status === 410) {
        toast.error("Reservation Expired!", {
          description:
            data.details ||
            "Your reservation expired before confirmation. Please create a new one.",
          duration: 8000,
        });
        setIsExpired(true);
        setReservation((prev) =>
          prev ? { ...prev, status: "RELEASED" } : prev
        );
        return;
      }

      if (!response.ok) {
        toast.error("Confirmation failed", {
          description: data.error || "Something went wrong",
        });
        return;
      }

      toast.success("Purchase confirmed! 🎉", {
        description: "Your order has been placed successfully.",
        duration: 5000,
      });

      // Update local state without refresh
      setReservation(data);
    } catch {
      toast.error("Network error", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error("Cancellation failed", {
          description: data.error || "Something went wrong",
        });
        return;
      }

      toast.info("Reservation cancelled", {
        description: "Units have been released back to available stock.",
      });

      // Update local state without refresh
      setReservation(data);
    } catch {
      toast.error("Network error", {
        description: "Please check your connection and try again.",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleExpired = useCallback(() => {
    setIsExpired(true);
    toast.error("Reservation Expired!", {
      description:
        "Your 10-minute window has passed. Please go back and reserve again.",
      duration: 8000,
    });
  }, []);

  // Status badge colors
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            ⏳ Pending
          </Badge>
        );
      case "CONFIRMED":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            ✅ Confirmed
          </Badge>
        );
      case "RELEASED":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            ❌ Released
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading reservation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !reservation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
              <svg
                className="h-8 w-8 text-destructive"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <p className="text-destructive font-medium">
              {error || "Reservation not found"}
            </p>
            <Button
              variant="outline"
              onClick={() => router.push("/")}
              className="cursor-pointer"
            >
              ← Back to Products
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING" && !isExpired;
  const totalPrice = reservation.product.price * reservation.quantity;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="flex h-16 items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Products
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="space-y-6">
          {/* Title + Status */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {reservation.status === "CONFIRMED"
                  ? "Order Confirmed"
                  : reservation.status === "RELEASED"
                    ? "Reservation Cancelled"
                    : "Checkout"}
              </h1>
              <p className="text-sm text-muted-foreground font-mono mt-1">
                ID: {reservation.id}
              </p>
            </div>
            {getStatusBadge(reservation.status)}
          </div>

          {/* Countdown — only for pending reservations */}
          {isPending && (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="py-6">
                <ReservationCountdown
                  expiresAt={reservation.expiresAt}
                  onExpired={handleExpired}
                />
              </CardContent>
            </Card>
          )}

          {/* Expired warning */}
          {isExpired && reservation.status === "PENDING" && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center space-y-3">
              <p className="text-red-400 font-semibold text-lg">
                ⏰ Reservation Expired
              </p>
              <p className="text-sm text-muted-foreground">
                Your 10-minute reservation window has passed. The units have
                been released back to available stock.
              </p>
              <Button
                variant="outline"
                onClick={() => router.push("/")}
                className="cursor-pointer"
              >
                ← Reserve Again
              </Button>
            </div>
          )}

          {/* Order Details */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Product */}
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{reservation.product.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {reservation.product.sku}
                  </p>
                </div>
                <p className="font-mono font-semibold">
                  ₹{reservation.product.price.toLocaleString("en-IN")}
                </p>
              </div>

              <Separator />

              {/* Warehouse */}
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Warehouse</p>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {reservation.warehouse.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {reservation.warehouse.location}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Quantity */}
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">Quantity</p>
                <p className="font-mono font-medium">
                  {reservation.quantity} unit
                  {reservation.quantity > 1 ? "s" : ""}
                </p>
              </div>

              <Separator />

              {/* Total */}
              <div className="flex justify-between items-center pt-2">
                <p className="font-semibold">Total</p>
                <p className="text-xl font-bold font-mono">
                  ₹{totalPrice.toLocaleString("en-IN")}
                </p>
              </div>
            </CardContent>

            {/* Action Buttons — only for pending, non-expired */}
            {isPending && (
              <CardFooter className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isCancelling || isConfirming}
                  className="flex-1 cursor-pointer"
                  size="lg"
                >
                  {isCancelling ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Cancelling...
                    </span>
                  ) : (
                    "Cancel Reservation"
                  )}
                </Button>
                <Button
                  onClick={handleConfirm}
                  disabled={isConfirming || isCancelling}
                  className="flex-1 cursor-pointer"
                  size="lg"
                >
                  {isConfirming ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Confirming...
                    </span>
                  ) : (
                    "Confirm Purchase"
                  )}
                </Button>
              </CardFooter>
            )}

            {/* Post-action: Confirmed */}
            {reservation.status === "CONFIRMED" && (
              <CardFooter className="pt-4">
                <div className="w-full text-center space-y-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                    <svg
                      className="h-8 w-8 text-emerald-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-emerald-400 font-semibold">
                    Payment confirmed! Your order is being processed.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/")}
                    className="cursor-pointer"
                  >
                    ← Continue Shopping
                  </Button>
                </div>
              </CardFooter>
            )}

            {/* Post-action: Released/Cancelled */}
            {reservation.status === "RELEASED" && !isExpired && (
              <CardFooter className="pt-4">
                <div className="w-full text-center space-y-4">
                  <p className="text-muted-foreground">
                    This reservation has been cancelled. Units returned to
                    stock.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => router.push("/")}
                    className="cursor-pointer"
                  >
                    ← Back to Products
                  </Button>
                </div>
              </CardFooter>
            )}
          </Card>

          {/* Reservation Meta */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <p>
              Created:{" "}
              {new Date(reservation.createdAt).toLocaleString("en-IN")}
            </p>
            <p>
              Expires:{" "}
              {new Date(reservation.expiresAt).toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
