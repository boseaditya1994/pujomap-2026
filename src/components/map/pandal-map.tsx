"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useState, type ReactNode } from "react";
import { useI18n } from "@/components/i18n-provider";
import { publicEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import { SchematicMap } from "./schematic-map";
import type { PandalMapProps } from "./types";

function MapLoading({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className={cn("bg-muted text-muted-foreground flex items-center justify-center text-sm", className)}
    >
      {t.map.loading}
    </div>
  );
}

// The Google Maps code is only downloaded when a key is configured and a map is on screen.
const GoogleMap = dynamic(() => import("./google-map"), {
  ssr: false,
  loading: () => <MapLoading className="h-full w-full" />,
});

class MapErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * Shows Google Maps when a browser key is configured, and degrades to the
 * schematic view if the key is missing, rejected, over quota or the script
 * fails to load. The rest of the page keeps working either way.
 */
export function PandalMap(props: PandalMapProps) {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);

  if (!publicEnv.googleMapsKey) return <SchematicMap {...props} notice={t.map.schematicNote} />;
  if (failed) return <SchematicMap {...props} notice={t.map.loadFailed} />;
  return (
    <MapErrorBoundary onError={onFail}>
      <GoogleMap {...props} onFail={onFail} />
    </MapErrorBoundary>
  );
}
