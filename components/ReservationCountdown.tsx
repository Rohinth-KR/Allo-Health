"use client";

import { useEffect, useState, useRef } from "react";

interface ReservationCountdownProps {
  expiresAt: string;
  onExpired?: () => void;
}

/**
 * ReservationCountdown — Live countdown timer to reservation expiry.
 * Updates every second. Calls onExpired callback when timer reaches zero.
 */
export function ReservationCountdown({
  expiresAt,
  onExpired,
}: ReservationCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const initialTimeRef = useRef<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      return Math.max(0, Math.floor(diff / 1000));
    };

    const initial = calculateTimeLeft();
    initialTimeRef.current = initial;
    setTimeLeft(initial);

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        onExpired?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  // Color shifts as time runs out
  const isUrgent = timeLeft <= 60;
  const isCritical = timeLeft <= 30;

  // Calculate bar percentage from initial time (drains from 100% → 0%)
  const totalDuration = initialTimeRef.current || 600;
  const barPercent = Math.min(100, (timeLeft / totalDuration) * 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm text-muted-foreground">Time remaining</p>
      <div
        className={`
          font-mono text-4xl font-bold tabular-nums tracking-wider
          ${isCritical ? "text-red-500 animate-pulse" : ""}
          ${isUrgent && !isCritical ? "text-yellow-500" : ""}
          ${!isUrgent ? "text-emerald-400" : ""}
        `}
      >
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>
      {isUrgent && (
        <p className="text-xs text-red-400">
          {timeLeft === 0
            ? "Reservation expired!"
            : "Hurry! Reservation expiring soon"}
        </p>
      )}
      {/* Progress bar */}
      <div className="w-full max-w-xs h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`
            h-full rounded-full transition-all duration-1000 ease-linear
            ${isCritical ? "bg-red-500" : ""}
            ${isUrgent && !isCritical ? "bg-yellow-500" : ""}
            ${!isUrgent ? "bg-emerald-500" : ""}
          `}
          style={{
            width: `${barPercent}%`,
          }}
        />
      </div>
    </div>
  );
}

