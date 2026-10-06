import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchMapDonors, fetchMapNgos, fetchMapDonations } from '../lib/map';
import { CATEGORY_LABEL } from '../lib/donations';
import { AppHeader } from '../components/layout/AppHeader';

const DEFAULT_CENTER: [number, number] = [-22.5, -47.4]; // Limeira/SP

const COLOR = {
  donor: '#16522e',
  ngo: '#5fa86b',
  donation: '#f28b0a',
} as const;

/**
 * Marcador com anel da cor do papel sobre o creme do fundo: o contorno é o que
 * separa o ponto das ruas do mapa, que já são claras e quebradas.
 */
function dotIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:${color};border:3px solid #fcf9f0;box-shadow:0 1px 4px rgba(22,82,46,.35)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const donorIcon = dotIcon(COLOR.donor);
const ngoIcon = dotIcon(COLOR.ngo);
const donationIcon = dotIcon(COLOR.donation);

const controlClass =
  'rounded-full border-[1.5px] border-line-strong bg-canvas px-4 py-2 text-sm text-ink-soft outline-none focus-visible:border-leaf-600 focus-visible:ring-4 focus-visible:ring-leaf-100';

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

export function MapPage() {
  const [category, setCategory] = useState('');
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [locationError, setLocationError] = useState<string | null>(null);

  const filters = {
    category: category || undefined,
    lat: userLocation?.lat,
    lng: userLocation?.lng,
    radiusKm: userLocation ? radiusKm : undefined,
  };

  const donorsQuery = useQuery({
    queryKey: ['map', 'donors', filters],
    queryFn: () => fetchMapDonors(filters),
  });
  const ngosQuery = useQuery({
    queryKey: ['map', 'ngos', filters],
    queryFn: () => fetchMapNgos(filters),
  });
  const donationsQuery = useQuery({
    queryKey: ['map', 'donations', filters],
    queryFn: () => fetchMapDonations(filters),
  });

  const useMyLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Este navegador não informa sua localização. Use o filtro de categoria.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => setLocationError('Não conseguimos sua localização. Verifique a permissão do navegador.'),
    );
  };

  const center: [number, number] = userLocation ? [userLocation.lat, userLocation.lng] : DEFAULT_CENTER;
  const donations = donationsQuery.data ?? [];

  return (
    <div>
      <AppHeader />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 pt-8 pb-20">
        <div>
          <h1 className="font-display text-[2.125rem] leading-tight font-semibold text-leaf-800">Mapa</h1>
          <p className="mt-1 text-[0.9375rem] text-ink-muted">
            Veja quem está doando, quem está recebendo e o que tem disponível por perto.
          </p>
        </div>

        <div className="rounded-[20px] border border-line bg-surface px-4 py-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Categoria"
              className={controlClass}
            >
              <option value="">Todas as categorias</option>
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            <button
              onClick={useMyLocation}
              className={`rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold text-leaf-800 transition ${
                userLocation
                  ? 'border-leaf-600 bg-leaf-50'
                  : 'border-line-bold bg-surface hover:border-leaf-800'
              }`}
            >
              {userLocation ? 'Localização definida ✓' : 'Usar minha localização'}
            </button>

            {userLocation && (
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                Raio (km)
                <input
                  type="number"
                  min={1}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className={`${controlClass} w-20 px-3`}
                />
              </label>
            )}

            <div className="ml-auto flex flex-wrap items-center gap-4 text-[0.8125rem] text-ink-soft">
              <LegendDot color={COLOR.donor} label="Doadores" />
              <LegendDot color={COLOR.ngo} label="ONGs" />
              <LegendDot color={COLOR.donation} label="Doações" />
            </div>
          </div>

          {locationError && (
            <p role="alert" className="mt-2.5 text-sm font-medium text-sun-800">
              {locationError}
            </p>
          )}
        </div>

        {/* z-0 mantém os painéis do Leaflet abaixo do cabeçalho fixo. */}
        <div className="relative z-0 h-[480px] overflow-hidden rounded-3xl border border-line bg-sand-deep">
          <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; OpenStreetMap"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            />

            {donorsQuery.data?.map((org) => (
              <Marker key={org.id} position={[org.latitude, org.longitude]} icon={donorIcon}>
                <Popup>
                  <strong>{org.tradeName}</strong>
                  <br />
                  {org.city}/{org.state}
                  {org.distanceKm !== null && <> · {org.distanceKm} km</>}
                </Popup>
              </Marker>
            ))}

            {ngosQuery.data?.map((org) => (
              <Marker key={org.id} position={[org.latitude, org.longitude]} icon={ngoIcon}>
                <Popup>
                  <strong>{org.tradeName}</strong>
                  <br />
                  {org.city}/{org.state}
                  {org.distanceKm !== null && <> · {org.distanceKm} km</>}
                </Popup>
              </Marker>
            ))}

            {donations.map((donation) => (
              <Marker
                key={donation.id}
                position={[donation.latitude, donation.longitude]}
                icon={donationIcon}
              >
                <Popup>
                  <strong>{donation.items.map((i) => i.foodName).join(', ')}</strong>
                  <br />
                  {donation.items.map((i) => `${i.foodName}: ${i.remainingQuantity} ${i.unit}`).join(' · ')}
                  <br />
                  {donation.donorName}
                  <br />
                  Retirada até {formatDate(donation.pickupDeadline)}
                  {donation.distanceKm !== null && (
                    <>
                      <br />
                      {donation.distanceKm} km de você
                    </>
                  )}
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="rounded-[22px] border border-line bg-surface px-6 py-5">
          <h2 className="font-display text-xl font-semibold text-leaf-800">
            Doações disponíveis {userLocation ? `(dentro de ${radiusKm} km)` : ''}
          </h2>

          {donationsQuery.isSuccess && donations.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              Nada por perto agora. Aumente o raio ou escolha outra categoria.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {donations.map((donation) => (
                <li
                  key={donation.id}
                  className="flex items-center justify-between gap-3 border-t border-sand py-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-sun-500" aria-hidden />
                    <span className="min-w-0">
                      <strong className="font-bold text-ink">
                        {donation.items.map((i) => i.foodName).join(', ')}
                      </strong>{' '}
                      <span className="text-ink-muted">
                        · {donation.donorName} · {donation.city}/{donation.state}
                        {donation.distanceKm !== null && ` · ${donation.distanceKm} km`}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-ink-muted">
                    {donation.items.length} {donation.items.length === 1 ? 'item' : 'itens'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
