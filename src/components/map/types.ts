import type { LatLng } from "@/lib/domain/geo";

export type MapPoint = LatLng & { id: string; name: string; verified: boolean };

export type PandalMapProps = {
  points: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Shown as a "you are here" dot when the visitor has shared their position. */
  userLocation?: LatLng | null;
  className?: string;
};
