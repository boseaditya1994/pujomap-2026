"use client";

import { useMemo } from "react";
import { useI18n } from "@/components/i18n-provider";
import { boundsOf } from "@/lib/domain/geo";
import { cn } from "@/lib/utils";
import type { PandalMapProps } from "./types";

/**
 * Fallback shown when Google Maps is not configured or fails to load. It
 * plots pins by coordinates on a blank canvas: no tiles, no network calls,
 * and no claim to show streets. Every pin is a real, focusable button.
 */
export function SchematicMap({
  points,
  selectedId,
  onSelect,
  userLocation,
  className,
  notice,
}: PandalMapProps & { notice: string }) {
  const { t } = useI18n();
  const placed = useMemo(() => {
    const all = userLocation ? [...points, userLocation] : points;
    const b = boundsOf(all);
    if (!b) return { pins: [], user: null };
    const latSpan = Math.max(b.north - b.south, 0.01);
    const lngSpan = Math.max(b.east - b.west, 0.01);
    // Keep pins away from the edges so labels and focus rings are not clipped.
    const project = (lat: number, lng: number) => ({
      left: 8 + ((lng - b.west) / lngSpan) * 84,
      top: 24 + ((b.north - lat) / latSpan) * 64,
    });
    return {
      pins: points.map((p) => ({ ...p, ...project(p.lat, p.lng) })),
      user: userLocation ? project(userLocation.lat, userLocation.lng) : null,
    };
  }, [points, userLocation]);

  return (
    <div
      role="region"
      aria-label={t.map.label}
      data-testid="map"
      data-map-kind="schematic"
      className={cn("relative overflow-hidden bg-[#f1e6cf]", className)}
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(to right, #e3d2b2 1px, transparent 1px), linear-gradient(to bottom, #e3d2b2 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <p className="bg-card/95 text-muted-foreground absolute inset-x-2 top-2 z-10 rounded-lg px-3 py-2 text-xs shadow-sm">
        {notice}
      </p>
      {placed.user ? (
        <span
          aria-hidden
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow"
          style={{ left: `${placed.user.left}%`, top: `${placed.user.top}%` }}
        />
      ) : null}
      {placed.pins.map((p) => {
        const selected = p.id === selectedId;
        return (
          <button
            key={p.id}
            type="button"
            data-testid="map-marker"
            data-pandal-id={p.id}
            aria-label={p.name}
            aria-pressed={selected}
            onClick={() => onSelect(selected ? null : p.id)}
            className={cn(
              "absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
              selected ? "z-20" : "z-10",
            )}
            style={{ left: `${p.left}%`, top: `${p.top}%` }}
          >
            <span
              className={cn(
                "block rounded-full border-2 border-white shadow-md transition-transform",
                p.verified ? "bg-maroon" : "bg-[#8a6f66]",
                selected ? "bg-vermilion ring-gold size-7 scale-110 ring-2" : "size-5",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
