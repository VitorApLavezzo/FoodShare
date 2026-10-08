import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [-22.5, -47.4]; // Limeira/SP

const LAYERS = {
  street: {
    label: 'Mapa',
    attribution: 'Tiles &copy; Esri &mdash; OpenStreetMap',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  },
  satellite: {
    label: 'Satélite',
    attribution: 'Tiles &copy; Esri &mdash; Maxar, Earthstar Geographics',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  },
} as const;

type LayerKey = keyof typeof LAYERS;

/**
 * Pino em gota com a ponta no ponto exato: o círculo do MapPage cobre a
 * coordenada com o próprio corpo, o que atrapalha justamente quem está
 * tentando acertar a porta do prédio.
 */
const pinIcon = L.divIcon({
  className: '',
  html: `<svg width="32" height="42" viewBox="0 0 32 42" style="filter:drop-shadow(0 2px 3px rgba(22,82,46,.4))"><path d="M16 1C7.7 1 1 7.6 1 15.8 1 27 16 41 16 41s15-14 15-25.2C31 7.6 24.3 1 16 1z" fill="#16522e" stroke="#fcf9f0" stroke-width="2"/><circle cx="16" cy="15.5" r="5.5" fill="#fcf9f0"/></svg>`,
  iconSize: [32, 42],
  iconAnchor: [16, 41],
});

function sameSpot(a: [number, number] | null, b: [number, number] | null) {
  if (!a || !b) return false;
  return Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

/**
 * Leva o mapa até o ponto quando ele muda por fora (CEP, geocodificação). Se a
 * mudança veio do próprio arraste, o mapa fica onde a pessoa deixou.
 */
function FollowPosition({
  position,
  lastPicked,
}: {
  position: [number, number] | null;
  lastPicked: { current: [number, number] | null };
}) {
  const map = useMap();
  useEffect(() => {
    if (!position || sameSpot(position, lastPicked.current)) return;
    map.setView(position, Math.max(map.getZoom(), 17));
  }, [map, position, lastPicked]);
  return null;
}

function ClickToPick({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (event) => onPick(event.latlng.lat, event.latlng.lng),
  });
  return null;
}

export function LocationPicker({
  latitude,
  longitude,
  onChange,
}: {
  latitude?: number;
  longitude?: number;
  onChange: (coordinates: { latitude: number; longitude: number }) => void;
}) {
  const [layer, setLayer] = useState<LayerKey>('street');
  const lastPicked = useRef<[number, number] | null>(null);

  const position = useMemo<[number, number] | null>(
    () =>
      typeof latitude === 'number' &&
      typeof longitude === 'number' &&
      !Number.isNaN(latitude) &&
      !Number.isNaN(longitude)
        ? [latitude, longitude]
        : null,
    [latitude, longitude],
  );

  const pick = useCallback(
    (lat: number, lng: number) => {
      lastPicked.current = [lat, lng];
      onChange({ latitude: lat, longitude: lng });
    },
    [onChange],
  );

  const markerHandlers = useMemo(
    () => ({
      dragend: (event: L.LeafletEvent) => {
        const { lat, lng } = (event.target as L.Marker).getLatLng();
        pick(lat, lng);
      },
    }),
    [pick],
  );

  return (
    // z-0 mantém os painéis do Leaflet abaixo do cabeçalho fixo.
    <div className="relative z-0 h-[320px] overflow-hidden rounded-2xl border-[1.5px] border-line bg-sand-deep">
      <MapContainer
        center={position ?? DEFAULT_CENTER}
        zoom={position ? 17 : 12}
        maxZoom={19}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          key={layer}
          attribution={LAYERS[layer].attribution}
          url={LAYERS[layer].url}
          maxZoom={19}
        />
        <FollowPosition position={position} lastPicked={lastPicked} />
        <ClickToPick onPick={pick} />
        {position && (
          <Marker
            position={position}
            icon={pinIcon}
            draggable
            eventHandlers={markerHandlers}
          />
        )}
      </MapContainer>

      <div
        role="group"
        aria-label="Tipo de mapa"
        className="absolute right-3 top-3 z-[1000] flex rounded-full border-[1.5px] border-line-strong bg-canvas p-0.5 shadow-sm"
      >
        {(Object.keys(LAYERS) as LayerKey[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={layer === key}
            onClick={() => setLayer(key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              layer === key
                ? 'bg-leaf-800 text-canvas'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            {LAYERS[key].label}
          </button>
        ))}
      </div>
    </div>
  );
}
