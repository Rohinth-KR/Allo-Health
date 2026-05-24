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

  const isUrgent = timeLeft <= 60;
  const isCritical = timeLeft <= 30;

  const totalDuration = initialTimeRef.current || 600;
  const barPercent = Math.min(100, (timeLeft / totalDuration) * 100);

  // Color logic for medical theme
  const timerColor = isCritical
    ? "oklch(0.58 0.22 27)"        // red
    : isUrgent
    ? "oklch(0.65 0.16 50)"        // amber
    : "oklch(0.48 0.17 240)";      // medical blue

  const barColor = isCritical
    ? "oklch(0.65 0.22 27)"
    : isUrgent
    ? "oklch(0.72 0.14 80)"
    : "linear-gradient(90deg, oklch(0.48 0.17 240), oklch(0.55 0.15 195))";

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
        🕐 Time Remaining to Confirm
      </p>

      {/* Timer display */}
      <div
        className={`font-mono text-5xl font-bold tabular-nums tracking-widest ${isCritical ? "animate-pulse" : ""}`}
        style={{ color: timerColor }}
      >
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>

      {/* Urgency message */}
      {isUrgent && (
        <p className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: isCritical ? "oklch(0.97 0.04 27)" : "oklch(0.97 0.04 50)", color: timerColor }}>
          {timeLeft === 0
            ? "⏰ Reservation expired!"
            : "⚡ Hurry! Reservation expiring soon"}
        </p>
      )}

      {/* Progress bar */}
      <div className="w-full max-w-xs h-2 rounded-full overflow-hidden" style={{ background: "oklch(0.92 0.02 220)" }}>
        <div
          className="h-full rounded-full stock-bar-fill"
          style={{
            width: `${barPercent}%`,
            background: barColor,
          }}
        />
      </div>

      {/* Sub label */}
      <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
        Complete your order before the timer runs out
      </p>
    </div>
  );
}
