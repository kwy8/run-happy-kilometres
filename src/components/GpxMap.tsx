import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface GpxMapProps {
  gpxUrl: string;
}

function parseGpx(xmlString: string): { coords: [number, number][]; distanceKm: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");
  const trkpts = doc.querySelectorAll("trkpt");
  const rtepts = doc.querySelectorAll("rtept");
  const points = trkpts.length > 0 ? trkpts : rtepts;

  const coords: [number, number][] = [];
  let distanceKm = 0;

  points.forEach((pt, i) => {
    const lat = parseFloat(pt.getAttribute("lat") || "0");
    const lon = parseFloat(pt.getAttribute("lon") || "0");
    coords.push([lat, lon]);

    if (i > 0) {
      const [prevLat, prevLon] = coords[i - 1];
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

export function GpxMap({ gpxUrl }: GpxMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = L.map(mapRef.current);
    mapInstance.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    fetch(gpxUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch GPX");
        return res.text();
      })
      .then((text) => {
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
      .catch(() => setError(true));

    return () => {
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
