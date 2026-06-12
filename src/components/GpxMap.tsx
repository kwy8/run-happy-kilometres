import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";

interface GpxMapProps {
  gpxUrl: string;
}

function parseGpx(xmlString: string): { coords: [number, number][]; distanceKm: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");
  if (doc.querySelector("parsererror")) return { coords: [], distanceKm: 0 };
  const trkpts = doc.querySelectorAll("trkpt");
  const rtepts = doc.querySelectorAll("rtept");
  const wpts = doc.querySelectorAll("wpt");
  const points = trkpts.length > 0 ? trkpts : rtepts.length > 0 ? rtepts : wpts;

  const coords: [number, number][] = [];
  let distanceKm = 0;

  points.forEach((pt, i) => {
    const lat = parseFloat(pt.getAttribute("lat") || "0");
    const lon = parseFloat(pt.getAttribute("lon") || "0");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    coords.push([lat, lon]);

    if (coords.length > 1) {
      const [prevLat, prevLon] = coords[coords.length - 2];
      distanceKm += haversine(prevLat, prevLon, lat, lon);
    }
  });

  return { coords, distanceKm };
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function storagePathFromPublicUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = "/storage/v1/object/public/gpx-files/";
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(parsed.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

async function loadGpxText(gpxUrl: string): Promise<string> {
  try {
    const res = await fetch(gpxUrl);
    if (res.ok) return res.text();
  } catch {
    // Fall through to authenticated Storage download.
  }

  const storagePath = storagePathFromPublicUrl(gpxUrl);
  if (!storagePath) throw new Error("Failed to fetch GPX");

  const { data, error } = await supabase.storage.from("gpx-files").download(storagePath);
  if (error || !data) throw new Error(error?.message || "Failed to download GPX");
  return data.text();
}

export function GpxMap({ gpxUrl }: GpxMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    setError(false);
    setDistance(null);

    const map = L.map(mapRef.current);
    mapInstance.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    loadGpxText(gpxUrl)
      .then((text) => {
        if (cancelled) return;
        const { coords, distanceKm } = parseGpx(text);
        if (coords.length === 0) {
          setError(true);
          return;
        }
        setDistance(distanceKm);

        const polyline = L.polyline(coords, { color: "hsl(var(--primary))", weight: 4 }).addTo(map);
        map.fitBounds(polyline.getBounds(), { padding: [30, 30] });

        // Start marker
        L.circleMarker(coords[0], { radius: 7, color: "#22c55e", fillColor: "#22c55e", fillOpacity: 1 })
          .bindPopup("Start")
          .addTo(map);

        // End marker
        if (coords.length > 1) {
          L.circleMarker(coords[coords.length - 1], { radius: 7, color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1 })
            .bindPopup("Finish")
            .addTo(map);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      map.remove();
      mapInstance.current = null;
    };
  }, [gpxUrl]);

  if (error) {
    return <p className="text-sm text-muted-foreground">Could not load route map.</p>;
  }

  return (
    <div className="space-y-2">
      <div ref={mapRef} className="w-full aspect-video rounded-lg z-0" />
      {distance !== null && (
        <p className="text-sm text-muted-foreground">
          Route distance: <span className="font-semibold text-foreground">{distance.toFixed(1)} km</span>
        </p>
      )}
    </div>
  );
}
