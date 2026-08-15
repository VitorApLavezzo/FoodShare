import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchMapDonors, fetchMapNgos, fetchMapDonations } from '../lib/map';
import { CATEGORY_LABEL, type DonationCategory } from '../lib/donations';
import { AppHeader } from '../components/layout/AppHeader';

const DEFAULT_CENTER: [number, number] = [-22.5, -47.4]; // Limeira/SP

function dotIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.2)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

const donorIcon = dotIcon('#2563eb');
const ngoIcon = dotIcon('#16a34a');
const donationIcon = dotIcon('#f97316');

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function MapPage() {
  const [category, setCategory] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState(10);
  const [locationError, setLocationError] = useState<string | null>(null);

  const filters = {
    category: category || undefined,
    lat: userLocation?.lat,
    lng: userLocation?.lng,
    radiusKm: userLocation ? radiusKm : undefined,
  };

  const donorsQuery = useQuery({ queryKey: ['map', 'donors', filters], queryFn: () => fetchMapDonors(filters) });
  const ngosQuery = useQuery({ queryKey: ['map', 'ngos', filters], queryFn: () => fetchMapNgos(filters) });
  const donationsQuery = useQuery({
    queryKey: ['map', 'donations', filters],
    queryFn: () => fetchMapDonations(filters),
  });

  const useMyLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não é suportada neste navegador.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocationError('Não foi possível obter sua localização.'),
    );
  };

  const center: [number, number] = userLocation ? [userLocation.lat, userLocation.lng] : DEFAULT_CENTER;

  return (
    <div>
      <AppHeader />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8">
      <div>
        <h1 className="font-display text-2xl font-medium text-neutral-900 dark:text-white">Mapa</h1>
        <p className="text-sm text-neutral-500">Estabelecimentos, ONGs e doações disponíveis.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
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
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {userLocation ? 'Localização definida ✓' : 'Usar minha localização'}
        </button>

        {userLocation && (
          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            Raio (km)
            <input
              type="number"
              min={1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              className="w-20 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
          </label>
        )}

        {locationError && <p className="text-sm text-red-600 dark:text-red-400">{locationError}</p>}

        <div className="ml-auto flex items-center gap-4 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-blue-600" /> Doadores
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-brand-600" /> ONGs
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-full bg-orange-500" /> Doações
          </span>
        </div>
      </div>

      <div className="h-[480px] overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <MapContainer center={center} zoom={userLocation ? 12 : 12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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

          {donationsQuery.data?.map((donation) => (
            <Marker key={donation.id} position={[donation.latitude, donation.longitude]} icon={donationIcon}>
              <Popup>
                <strong>{donation.foodName}</strong>
                <br />
                {CATEGORY_LABEL[donation.category as DonationCategory]} · {donation.quantity} {donation.unit}
                <br />
                {donation.donorName}
                <br />
                Retirada até {formatDate(donation.pickupDeadline)}
                {donation.distanceKm !== null && <><br />{donation.distanceKm} km de você</>}
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900 dark:text-white">
          Doações disponíveis {userLocation ? `(dentro de ${radiusKm} km)` : ''}
        </h2>
        {donationsQuery.data && donationsQuery.data.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nenhuma doação encontrada. Tente alterar os filtros ou aumentar o raio de busca.
          </p>
        )}
        <ul className="flex flex-col divide-y divide-neutral-200 dark:divide-neutral-800">
          {donationsQuery.data?.map((donation) => (
            <li key={donation.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <span className="font-medium text-neutral-900 dark:text-white">{donation.foodName}</span>
                <span className="text-neutral-500">
                  {' '}
                  · {donation.donorName} · {donation.city}/{donation.state}
                  {donation.distanceKm !== null && ` · ${donation.distanceKm} km`}
                </span>
              </div>
              <span className="text-neutral-500">{donation.quantity} {donation.unit}</span>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </div>
  );
}
