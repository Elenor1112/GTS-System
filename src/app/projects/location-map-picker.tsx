'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';

import { defaultCentre } from '@/lib/geofence';

/**
 * A click-to-pin map for choosing a site's coordinates.
 *
 * OpenStreetMap tiles, not Google Maps: the app has no Maps API key
 * anywhere, and this needs none. Clicking or dragging the marker is a
 * convenience on top of the lat/lng fields, not a replacement for
 * them — the fields stay the source of truth, and typing into them
 * moves the pin right back (see `MapPickerSync` in the caller).
 */

// Leaflet's default marker icon resolves its images against its own
// CSS file's URL, which webpack does not rewrite correctly. Importing
// the three PNGs as static assets and pointing the icon at them
// sidesteps that without needing a public-folder copy or a CDN.
const markerIcon = L.icon({
  iconUrl: markerIconUrl.src,
  iconRetinaUrl: markerIconRetinaUrl.src,
  shadowUrl: markerShadowUrl.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function ClickToPin({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

/** Recentres the map when the parent's lat/lng change from somewhere
 *  else — typed by hand, or "use my position". */
function FlyToPoint({ lat, lng }: { lat: number; lng: number }) {
  const map = useMapEvents({});
  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 14));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);
  return null;
}

export function LocationMapPicker({
  lat,
  lng,
  governorateCode,
  onPick,
}: {
  lat: string;
  lng: string;
  governorateCode?: number;
  onPick: (lat: string, lng: string) => void;
}) {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  const hasPin = lat !== '' && lng !== '' && Number.isFinite(parsedLat) && Number.isFinite(parsedLng);

  const centre = useMemo(() => defaultCentre(governorateCode), [governorateCode]);
  const initialCentre = useMemo<[number, number]>(
    () => (hasPin ? [parsedLat, parsedLng] : [centre.lat, centre.lng]),
    // Only used for the map's initial view; recentring afterwards is
    // handled by FlyToPoint so this deliberately does not re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="gts-map-picker">
      <MapContainer
        center={initialCentre}
        zoom={hasPin ? 15 : centre.zoom}
        style={{ height: '18rem', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToPin onPick={(la, ln) => onPick(la.toFixed(6), ln.toFixed(6))} />
        {hasPin && (
          <>
            <Marker
              position={[parsedLat, parsedLng]}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend: (event) => {
                  const marker = event.target as L.Marker;
                  const position = marker.getLatLng();
                  onPick(position.lat.toFixed(6), position.lng.toFixed(6));
                },
              }}
            />
            <FlyToPoint lat={parsedLat} lng={parsedLng} />
          </>
        )}
      </MapContainer>
      <p className="gts-help">Click the map, or drag the pin, to set the coordinates.</p>
    </div>
  );
}
