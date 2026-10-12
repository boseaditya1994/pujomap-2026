"use client";

import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { APIProvider, Map, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";
import { useI18n } from "@/components/i18n-provider";
import { KOLKATA_CENTER } from "@/lib/domain/types";
import { publicEnv } from "@/lib/env";
import { cn } from "@/lib/utils";
import type { MapPoint, PandalMapProps } from "./types";

function pinElement(point: MapPoint, selected: boolean): HTMLElement {
  const el = document.createElement("div");
  const size = selected ? 30 : 22;
  el.style.cssText = [
    `width:${size}px`,
    `height:${size}px`,
    "border-radius:9999px",
    "border:2px solid #fff",
    "box-shadow:0 1px 4px rgba(0,0,0,.45)",
    `background:${selected ? "#c7301c" : point.verified ? "#7b1626" : "#8a6f66"}`,
    selected ? "outline:2px solid #e9c873" : "",
    "cursor:pointer",
  ].join(";");
  return el;
}

/**
 * Markers are created imperatively (not as React elements) and handed to a
 * clusterer, which keeps rendering cheap with hundreds of pandals.
 */
function Markers({ points, selectedId, onSelect, userLocation }: PandalMapProps) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");
  const clusterer = useRef<MarkerClusterer | null>(null);
  const markers = useRef(new globalThis.Map<string, google.maps.marker.AdvancedMarkerElement>());
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Rebuild markers only when the set of points changes.
  useEffect(() => {
    if (!map || !markerLib) return;
    clusterer.current ??= new MarkerClusterer({ map });
    const created = markers.current;
    const bounds = new google.maps.LatLngBounds();
    for (const p of points) {
      const marker = new markerLib.AdvancedMarkerElement({
        position: { lat: p.lat, lng: p.lng },
        title: p.name,
        content: pinElement(p, false),
        gmpClickable: true,
      });
      marker.addEventListener("gmp-click", () => onSelectRef.current(p.id));
      created.set(p.id, marker);
      bounds.extend(marker.position as google.maps.LatLngLiteral);
    }
    clusterer.current.addMarkers([...created.values()]);
    if (points.length === 1) {
      map.setCenter({ lat: points[0].lat, lng: points[0].lng });
      map.setZoom(15);
    } else if (points.length > 1) {
      map.fitBounds(bounds, 56);
    }
    return () => {
      clusterer.current?.clearMarkers();
      created.clear();
    };
  }, [map, markerLib, points]);

  // Restyle and pan on selection without touching the other markers.
  useEffect(() => {
    if (!map) return;
    const byId = new globalThis.Map(points.map((p) => [p.id, p]));
    markers.current.forEach((marker, id) => {
      const p = byId.get(id);
      if (!p) return;
      marker.content = pinElement(p, id === selectedId);
      marker.zIndex = id === selectedId ? 10 : null;
    });
    const sel = selectedId ? byId.get(selectedId) : null;
    if (sel) {
      map.panTo({ lat: sel.lat, lng: sel.lng });
      if ((map.getZoom() ?? 0) < 14) map.setZoom(15);
    }
  }, [map, markerLib, points, selectedId]);

  useEffect(() => {
    if (!map || !markerLib || !userLocation) return;
    const dot = document.createElement("div");
    dot.style.cssText =
      "width:16px;height:16px;border-radius:9999px;background:#2563eb;border:2px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,.25)";
    const marker = new markerLib.AdvancedMarkerElement({ map, position: userLocation, content: dot, zIndex: 20 });
    return () => {
      marker.map = null;
    };
  }, [map, markerLib, userLocation]);

  return null;
}

export default function GoogleMap(props: PandalMapProps & { onFail: () => void }) {
  const { t, lang } = useI18n();
  const { onFail, className, onSelect } = props;

  useEffect(() => {
    // Google calls this global when the key is invalid, unbilled or not allowed for this site.
    const w = window as unknown as { gm_authFailure?: () => void };
    w.gm_authFailure = onFail;
    return () => {
      delete w.gm_authFailure;
    };
  }, [onFail]);

  return (
    <div
      role="region"
      aria-label={t.map.label}
      data-testid="map"
      data-map-kind="google"
      className={cn("relative", className)}
    >
      <APIProvider apiKey={publicEnv.googleMapsKey} language={lang} region="IN" onError={onFail}>
        <Map
          defaultCenter={KOLKATA_CENTER}
          defaultZoom={12}
          // Advanced markers need a map ID; DEMO_MAP_ID is Google's documented placeholder.
          mapId={publicEnv.googleMapsMapId || "DEMO_MAP_ID"}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          clickableIcons={false}
          onClick={() => onSelect(null)}
          style={{ width: "100%", height: "100%" }}
        >
          <Markers {...props} />
        </Map>
      </APIProvider>
    </div>
  );
}
