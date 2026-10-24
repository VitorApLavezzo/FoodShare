import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, Circle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ORGANIZATION_TYPE_LABEL, type OrganizationType } from '@foodshare/types';
import { fetchReservations } from '../lib/reservations';
import {
  fetchMapDonors,
  fetchMapNgos,
  fetchMapDonations,
  fetchMapReach,
  type MapDonation,
  type MapOrganization,
} from '../lib/map';
import { CATEGORY_LABEL } from '../lib/donations';
import { formatDateTime, formatQuantity } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useMyOrganization } from '../lib/use-my-organization';
import { AppHeader } from '../components/layout/AppHeader';
import { ButtonLink } from '../components/ui/Button';
import { QueryState } from '../components/ui/QueryState';

const DEFAULT_CENTER: [number, number] = [-22.5, -47.4]; // Limeira/SP
const NGO_ZOOM = 13;
const RADIUS_OPTIONS = [5, 10, 25, 50];

// Laranja é comida disponível agora (a mesma cor da doação no resto do
// sistema), verde escuro é o doador, verde claro a ONG e azul é o seu endereço.
const COLOR = {
  food: '#f28b0a',
  donor: '#16522e',
  ngo: '#5fa86b',
  home: '#244a6b',
  paper: '#fcf9f0',
} as const;

const STORE_PATH = 'M3 9.5 4.5 4h11L17 9.5M3 9.5h14M3 9.5v6.5h14V9.5M8 16v-4h4v4';
const HEART_PATH = 'M10 16s-6-3.6-6-8a3.2 3.2 0 0 1 6-1.6A3.2 3.2 0 0 1 16 8c0 4.4-6 8-6 8z';
const PIN_PATH = 'M16 1C7.7 1 1 7.6 1 15.8 1 27 16 41 16 41s15-14 15-25.2C31 7.6 24.3 1 16 1z';

const controlClass =
  'rounded-full border-[1.5px] border-line-strong bg-surface px-4 py-2 text-sm text-ink-body outline-none focus-visible:border-leaf-600 focus-visible:ring-4 focus-visible:ring-leaf-100';

/* Marcadores
 *
 * Todo doador tem o mesmo símbolo (uma loja); a cor diz se ele tem comida
 * agora. Antes doador com e sem doação eram duas "coisas" diferentes no mapa,
 * e a pergunta "quem é o doador?" não tinha resposta à primeira vista. */

const storeSvg = (color: string, size: number) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 20 20" aria-hidden="true"><path d="${STORE_PATH}" fill="none" stroke="${color}" stroke-width="1.9" stroke-linejoin="round"/></svg>`;

function circleHtml(background: string, border: string, size: number, inner: string, extra = '') {
  return `<span style="position:relative;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:${background};border:${border};box-shadow:0 1px 5px rgba(22,82,46,.35)">${inner}${extra}</span>`;
}

function icon(html: string, size: number) {
  return L.divIcon({
    className: '',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

const foodIcons = new Map<number, L.DivIcon>();
/** Doador com doação aberta. O selo com o número só aparece com mais de uma lista. */
function foodIcon(count: number) {
  if (!foodIcons.has(count)) {
    const badge =
      count > 1
        ? `<span style="position:absolute;top:-7px;right:-7px;display:flex;align-items:center;justify-content:center;min-width:19px;height:19px;padding:0 4px;border-radius:9999px;background:${COLOR.donor};color:${COLOR.paper};font:700 11px Figtree,system-ui,sans-serif;border:2px solid ${COLOR.paper}">${count}</span>`
        : '';
    foodIcons.set(
      count,
      icon(circleHtml(COLOR.food, `3px solid ${COLOR.paper}`, 36, storeSvg(COLOR.donor, 17), badge), 36),
    );
  }
  return foodIcons.get(count)!;
}

const idleDonorIcon = icon(
  circleHtml(COLOR.paper, `2px solid ${COLOR.donor}`, 28, storeSvg(COLOR.donor, 14)),
  28,
);

const ngoIcon = icon(
  circleHtml(
    COLOR.ngo,
    `3px solid ${COLOR.paper}`,
    30,
    `<svg width="14" height="14" viewBox="0 0 20 20" aria-hidden="true"><path d="${HEART_PATH}" fill="${COLOR.paper}"/></svg>`,
  ),
  30,
);

// Gota com a ponta no endereço: o símbolo universal de "você está aqui".
const homeIcon = L.divIcon({
  className: '',
  html: `<svg width="30" height="40" viewBox="0 0 32 42" style="filter:drop-shadow(0 2px 3px rgba(22,82,46,.4))"><path d="${PIN_PATH}" fill="${COLOR.home}" stroke="${COLOR.paper}" stroke-width="2"/><circle cx="16" cy="15.5" r="5.5" fill="${COLOR.paper}"/></svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 39],
  tooltipAnchor: [0, -36],
});

/* Legenda: os mesmos desenhos dos marcadores. */

function StoreGlyph({ color, size }: { color: string; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <path d={STORE_PATH} fill="none" stroke={color} strokeWidth="1.9" strokeLinejoin="round" />
    </svg>
  );
}

const SWATCH: Record<'food' | 'idle' | 'ngo' | 'home' | 'area', ReactNode> = {
  food: (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-canvas shadow-sm"
      style={{ background: COLOR.food }}
    >
      <StoreGlyph color={COLOR.donor} size={12} />
    </span>
  ),
  idle: (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-canvas shadow-sm"
      style={{ borderColor: COLOR.donor }}
    >
      <StoreGlyph color={COLOR.donor} size={12} />
    </span>
  ),
  ngo: (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-canvas shadow-sm"
      style={{ background: COLOR.ngo }}
    >
      <svg width="11" height="11" viewBox="0 0 20 20" aria-hidden>
        <path d={HEART_PATH} fill={COLOR.paper} />
      </svg>
    </span>
  ),
  home: (
    <svg width="18" height="24" viewBox="0 0 32 42" className="mx-[3px] shrink-0" aria-hidden>
      <path d={PIN_PATH} fill={COLOR.home} stroke={COLOR.paper} strokeWidth="2" />
      <circle cx="16" cy="15.5" r="5.5" fill={COLOR.paper} />
    </svg>
  ),
  area: (
    <span className="h-6 w-6 shrink-0 rounded-full border-2 border-dashed border-leaf-800 bg-leaf-800/5" />
  ),
};

function LegendRow({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-2">
      {swatch}
      <span>{label}</span>
    </span>
  );
}

function itemsSummary(donation: MapDonation) {
  return donation.items
    .map((i) => `${i.foodName} (${formatQuantity(i.remainingQuantity, i.unit)})`)
    .join(', ');
}

function formatKm(distanceKm: number | null) {
  return distanceKm === null ? null : `${distanceKm.toLocaleString('pt-BR')} km`;
}

export function MapPage() {
  const { user } = useAuth();
  const role = user?.role ?? 'NGO';
  const isNgo = role === 'NGO';
  const isDonor = role === 'DONOR';
  const isAdmin = role === 'ADMIN';
  const seesNetwork = isNgo || isAdmin;

  const organizationQuery = useMyOrganization();
  const organization = organizationQuery.data;
  // O endereço do cadastro é o centro do mapa e o ponto de partida de todas as
  // distâncias. Antes havia também a "localização atual" do aparelho, e as duas
  // referências competiam — a distância mudava sem a pessoa entender por quê.
  // Depende só dos números: o cadastro é reconsultado a cada minuto e um objeto
  // novo faria o mapa voltar sozinho para o endereço no meio de um arraste.
  const homeLat = organization?.address.latitude;
  const homeLng = organization?.address.longitude;
  const home = useMemo<[number, number] | null>(
    () => (homeLat !== undefined && homeLng !== undefined ? [homeLat, homeLng] : null),
    [homeLat, homeLng],
  );
  const homeLabel = isNgo ? 'Sua ONG' : 'Seu estabelecimento';

  const [map, setMap] = useState<L.Map | null>(null);
  const [category, setCategory] = useState('');
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  // Para a ONG, doador sem comida agora é ruído: começa escondido. O admin quer
  // ver a rede inteira.
  const [showIdleDonors, setShowIdleDonors] = useState(isAdmin);
  const [showNgos, setShowNgos] = useState(true);
  const [selectedDonorId, setSelectedDonorId] = useState<string | null>(null);
  const markerRefs = useRef(new Map<string, L.Marker>());
  const mapBoxRef = useRef<HTMLDivElement>(null);

  const distance = { lat: home?.[0], lng: home?.[1], radiusKm: home && radiusKm ? radiusKm : undefined };

  const donationsQuery = useQuery({
    queryKey: ['map', 'donations', category, distance],
    queryFn: () => fetchMapDonations({ ...distance, category: category || undefined }),
    enabled: seesNetwork,
  });
  const donorsQuery = useQuery({
    queryKey: ['map', 'donors', distance],
    queryFn: () => fetchMapDonors(distance),
    enabled: seesNetwork && showIdleDonors,
  });
  const ngosQuery = useQuery({
    queryKey: ['map', 'ngos'],
    queryFn: () => fetchMapNgos(),
    enabled: isAdmin && showNgos,
  });
  const reachQuery = useQuery({ queryKey: ['map', 'reach'], queryFn: fetchMapReach, enabled: isDonor });
  // Doações em que a ONG já tem reserva ativa levam à reserva, não a um novo pedido.
  const reservationsQuery = useQuery({
    queryKey: ['reservations'],
    queryFn: fetchReservations,
    enabled: isNgo,
  });
  const reservedListIds = new Set(
    (reservationsQuery.data ?? []).filter((r) => r.status === 'ACTIVE').map((r) => r.donationListId),
  );
  const linkLabel = (donationId: string) =>
    !isNgo ? 'Ver doação →' : reservedListIds.has(donationId) ? 'Ver minha reserva →' : 'Ver e reservar →';

  const donations = useMemo(() => donationsQuery.data ?? [], [donationsQuery.data]);
  const reach = reachQuery.data;

  // Listas do mesmo estabelecimento têm a mesma coordenada: viram um ponto só.
  const groups = useMemo(() => {
    const byDonor = new Map<string, MapDonation[]>();
    for (const donation of donations) {
      byDonor.set(donation.donorId, [...(byDonor.get(donation.donorId) ?? []), donation]);
    }
    return [...byDonor.values()];
  }, [donations]);
  const donorsWithFood = new Set(groups.map((group) => group[0].donorId));
  const idleDonors = showIdleDonors ? (donorsQuery.data ?? []).filter((d) => !donorsWithFood.has(d.id)) : [];
  const ngos = useMemo(
    () => (isAdmin && showNgos ? (ngosQuery.data ?? []) : []),
    [isAdmin, showNgos, ngosQuery.data],
  );

  // ONG: sempre volta ao próprio endereço; com distância escolhida, enquadra o
  // círculo inteiro em volta dele.
  useEffect(() => {
    if (!map || !home || !isNgo) return;
    if (radiusKm) map.fitBounds(L.latLng(home).toBounds(radiusKm * 2000), { padding: [24, 24] });
    else map.setView(home, NGO_ZOOM);
  }, [map, home, radiusKm, isNgo]);

  // Doador: enquadra a área de alerta inteira, centrada no endereço.
  const reachRadiusKm = reach?.defaultRadiusKm;
  useEffect(() => {
    if (!map || !home || !isDonor || !reachRadiusKm) return;
    map.fitBounds(L.latLng(home).toBounds(reachRadiusKm * 2000), { padding: [16, 16] });
  }, [map, home, isDonor, reachRadiusKm]);

  // Admin não tem endereço: enquadra o que houver na rede, uma vez.
  const adminFitted = useRef(false);
  useEffect(() => {
    if (!map || !isAdmin || adminFitted.current || !donationsQuery.isSuccess) return;
    if (showNgos && !ngosQuery.isSuccess) return;
    adminFitted.current = true;
    const points: [number, number][] = [
      ...donations.map((d): [number, number] => [d.latitude, d.longitude]),
      ...ngos.map((o): [number, number] => [o.latitude, o.longitude]),
    ];
    if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 13 });
  }, [map, isAdmin, donationsQuery.isSuccess, ngosQuery.isSuccess, showNgos, donations, ngos]);

  const backToHome = () => {
    if (!map || !home) return;
    if (isDonor && reachRadiusKm) {
      map.fitBounds(L.latLng(home).toBounds(reachRadiusKm * 2000), { padding: [16, 16] });
    } else if (radiusKm) {
      map.fitBounds(L.latLng(home).toBounds(radiusKm * 2000), { padding: [24, 24] });
    } else {
      map.setView(home, NGO_ZOOM);
    }
  };

  /** Liga a lista ao mapa: leva até o ponto e abre o balão dele. */
  const showOnMap = (donorId: string) => {
    setSelectedDonorId(donorId);
    const marker = markerRefs.current.get(donorId);
    if (!map || !marker) return;
    // No celular a lista fica embaixo do mapa: sobe até ele antes.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      mapBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const target = marker.getLatLng();
    const zoom = Math.max(map.getZoom(), 15);
    if (map.getCenter().distanceTo(target) < 5 && map.getZoom() === zoom) {
      marker.openPopup();
      return;
    }
    map.once('moveend', () => marker.openPopup());
    map.flyTo(target, zoom, { duration: 0.6 });
  };

  const registerMarker = (donorId: string) => (marker: L.Marker | null) => {
    if (marker) markerRefs.current.set(donorId, marker);
    else markerRefs.current.delete(donorId);
  };

  const subtitle = isNgo
    ? 'Os estabelecimentos com comida disponível perto da sua ONG, do mais perto para o mais longe.'
    : isDonor
      ? 'Até onde chegam as suas doações: quantas ONGs recebem o aviso quando você publica.'
      : 'Visão geral da rede: doadores, ONGs e as doações abertas agora.';

  // O mapa nasce já centrado no endereço do cadastro. Montá-lo antes de saber
  // esse endereço faria ele abrir em Limeira e depois pular.
  const waitingForHome = (isNgo || isDonor) && organizationQuery.isLoading;

  return (
    <div>
      <AppHeader />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 pt-8 pb-20">
        <div>
          <h1 className="font-display text-[2.125rem] leading-tight font-semibold text-leaf-800">Mapa</h1>
          <p className="mt-1 text-[0.9375rem] text-ink-muted">{subtitle}</p>
        </div>

        {seesNetwork && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Categoria das doações"
              className={controlClass}
            >
              <option value="">Todas as categorias</option>
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {isNgo && home && (
              <select
                value={radiusKm ?? ''}
                onChange={(e) => setRadiusKm(e.target.value ? Number(e.target.value) : null)}
                aria-label="Distância máxima da sua ONG"
                className={controlClass}
              >
                <option value="">Qualquer distância</option>
                {RADIUS_OPTIONS.map((km) => (
                  <option key={km} value={km}>
                    Até {km} km
                  </option>
                ))}
              </select>
            )}

            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={showIdleDonors}
                onChange={(e) => setShowIdleDonors(e.target.checked)}
                className="h-4 w-4 accent-leaf-800"
              />
              Mostrar doadores sem doação agora
            </label>

            {isAdmin && (
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={showNgos}
                  onChange={(e) => setShowNgos(e.target.checked)}
                  className="h-4 w-4 accent-leaf-800"
                />
                Mostrar ONGs
              </label>
            )}
          </div>
        )}

        {/* Lista ao lado do mapa, e não solta embaixo dele: cada doação tem um
            "Ver no mapa" que leva até o ponto e abre o balão. */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <aside className="order-2 flex flex-col overflow-hidden rounded-[22px] border border-line bg-surface lg:order-1 lg:h-[600px]">
            {seesNetwork ? (
              <>
                <div className="border-b border-line px-5 py-4">
                  <h2 className="font-display text-xl font-semibold text-leaf-800">
                    {donationsQuery.isSuccess
                      ? `${donations.length} ${donations.length === 1 ? 'doação disponível' : 'doações disponíveis'}`
                      : 'Doações disponíveis'}
                  </h2>
                  <p className="mt-0.5 text-[13px] text-ink-muted">
                    {isNgo
                      ? radiusKm
                        ? `Até ${radiusKm} km da sua ONG.`
                        : 'Da mais perto para a mais longe da sua ONG.'
                      : 'Em toda a rede, das que vencem primeiro.'}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  <QueryState
                    isLoading={donationsQuery.isLoading}
                    isError={donationsQuery.isError}
                    error={donationsQuery.error}
                    isEmpty={donations.length === 0}
                    emptyMessage={
                      radiusKm || category
                        ? 'Nada com esses filtros agora. Tente outra categoria ou uma distância maior.'
                        : 'Nenhuma doação disponível agora. Avisamos pelo sino quando aparecer algo por perto.'
                    }
                    onRetry={() => donationsQuery.refetch()}
                  >
                    <ul className="flex flex-col gap-2">
                      {donations.map((donation) => {
                        const selected = selectedDonorId === donation.donorId;
                        return (
                          <li
                            key={donation.id}
                            className={`rounded-2xl border px-4 py-3 transition ${
                              selected ? 'border-sun-400 bg-sun-50' : 'border-line hover:border-line-bold'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="min-w-0 text-[15px] font-bold text-ink">
                                {donation.items.map((i) => i.foodName).join(', ')}
                              </p>
                              {formatKm(donation.distanceKm) && (
                                <span className="shrink-0 text-xs font-semibold text-ink-muted">
                                  {formatKm(donation.distanceKm)}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[13px] text-ink-soft">
                              {donation.donorName} · {donation.city}/{donation.state}
                            </p>
                            <p className="text-[13px] text-ink-muted">
                              Retirada até {formatDateTime(donation.pickupDeadline)}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => showOnMap(donation.donorId)}
                                className="flex items-center gap-1.5 rounded-sm text-[13px] font-semibold text-ink-soft transition hover:text-leaf-800 focus-visible:ring-4 focus-visible:ring-leaf-600/20 focus-visible:outline-none"
                              >
                                <svg width="11" height="14" viewBox="0 0 32 42" aria-hidden>
                                  <path d={PIN_PATH} fill="currentColor" />
                                </svg>
                                Ver no mapa
                              </button>
                              <Link
                                to={`/doacoes/${donation.id}`}
                                className="text-sm font-bold text-leaf-600 hover:underline"
                              >
                                {linkLabel(donation.id)}
                              </Link>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </QueryState>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4 overflow-y-auto p-5">
                <h2 className="font-display text-xl font-semibold text-leaf-800">Alcance das suas doações</h2>
                <QueryState
                  isLoading={reachQuery.isLoading}
                  isError={reachQuery.isError}
                  error={reachQuery.error}
                  onRetry={() => reachQuery.refetch()}
                >
                  {reach && (
                    <>
                      <div className="rounded-2xl bg-leaf-50 px-4 py-4">
                        <p className="font-display text-[44px] leading-none font-semibold text-leaf-800">
                          {reach.totalNgos}
                        </p>
                        <p className="mt-1.5 text-[15px] text-ink-body">
                          {reach.totalNgos === 1 ? 'ONG recebe' : 'ONGs recebem'} o aviso quando você publica
                          uma doação.
                        </p>
                      </div>

                      <p className="text-[13px] leading-relaxed text-ink-muted">
                        Recebem o aviso as ONGs a até {reach.defaultRadiusKm} km do seu endereço — a área
                        tracejada no mapa. Por privacidade, o endereço delas não aparece; você vê só em que
                        cidades estão.
                      </p>

                      {reach.byCity.length > 0 ? (
                        <ul className="flex flex-col">
                          {reach.byCity.map((city) => (
                            <li
                              key={`${city.city}-${city.state}`}
                              className="flex items-center justify-between border-t border-sand py-2.5 text-sm"
                            >
                              <span className="font-semibold text-ink">
                                {city.city}/{city.state}
                              </span>
                              <span className="text-ink-muted">
                                {city.count} {city.count === 1 ? 'ONG' : 'ONGs'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="rounded-2xl bg-sun-50 px-4 py-3 text-sm leading-relaxed text-sun-900">
                          Ainda não há ONG dentro dessa área, então ninguém recebe o aviso automático. Mesmo
                          assim, suas doações aparecem no painel de todas as ONGs da plataforma.
                        </p>
                      )}

                      <ButtonLink to="/dashboard" className="self-start">
                        Publicar uma doação
                      </ButtonLink>
                    </>
                  )}
                </QueryState>
              </div>
            )}
          </aside>

          {/* z-0 mantém os painéis do Leaflet abaixo do cabeçalho fixo. */}
          <div
            ref={mapBoxRef}
            className="relative z-0 order-1 h-[380px] overflow-hidden rounded-3xl border border-line bg-sand-deep lg:order-2 lg:h-[600px]"
          >
            {waitingForHome ? (
              <div className="flex h-full items-center justify-center text-sm text-ink-muted">
                Carregando mapa…
              </div>
            ) : (
              <MapContainer
                ref={setMap}
                center={home ?? DEFAULT_CENTER}
                zoom={isDonor ? 9 : home ? NGO_ZOOM : 11}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution="Tiles &copy; Esri &mdash; OpenStreetMap"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                />

                {isDonor && home && reach && (
                  <Circle
                    center={home}
                    radius={reach.defaultRadiusKm * 1000}
                    pathOptions={{ color: COLOR.donor, weight: 1.5, fillOpacity: 0.05, dashArray: '6 6' }}
                  />
                )}

                {isNgo && home && radiusKm && (
                  <Circle
                    center={home}
                    radius={radiusKm * 1000}
                    pathOptions={{ color: COLOR.home, weight: 1.5, fillOpacity: 0.04, dashArray: '6 6' }}
                  />
                )}

                {idleDonors.map((org: MapOrganization) => (
                  <Marker
                    key={`idle-${org.id}`}
                    position={[org.latitude, org.longitude]}
                    icon={idleDonorIcon}
                  >
                    <Popup>
                      <strong>{org.tradeName}</strong>
                      <br />
                      {org.type ? ORGANIZATION_TYPE_LABEL[org.type as OrganizationType] : 'Doador'} ·{' '}
                      {org.city}/{org.state}
                      {formatKm(org.distanceKm) && <> · {formatKm(org.distanceKm)}</>}
                      <br />
                      <em>Sem doação aberta agora{category ? ' nesta categoria' : ''}.</em>
                    </Popup>
                  </Marker>
                ))}

                {ngos.map((org) => (
                  <Marker key={`ngo-${org.id}`} position={[org.latitude, org.longitude]} icon={ngoIcon}>
                    <Popup>
                      <strong>{org.tradeName}</strong>
                      <br />
                      ONG · {org.city}/{org.state}
                    </Popup>
                  </Marker>
                ))}

                {groups.map((group) => {
                  const first = group[0];
                  return (
                    <Marker
                      key={`food-${first.donorId}`}
                      ref={registerMarker(first.donorId)}
                      position={[first.latitude, first.longitude]}
                      icon={foodIcon(group.length)}
                      zIndexOffset={500}
                      eventHandlers={{
                        popupopen: () => setSelectedDonorId(first.donorId),
                        popupclose: () =>
                          setSelectedDonorId((current) => (current === first.donorId ? null : current)),
                      }}
                    >
                      <Popup minWidth={240}>
                        <strong>{first.donorName}</strong>
                        <br />
                        <span className="text-ink-muted">
                          Doador · {first.city}/{first.state}
                          {formatKm(first.distanceKm) && <> · {formatKm(first.distanceKm)}</>}
                        </span>
                        {group.map((donation) => (
                          <span key={donation.id} className="mt-2 block border-t border-sand pt-2">
                            {itemsSummary(donation)}
                            <br />
                            <span className="text-ink-muted">
                              Retirada até {formatDateTime(donation.pickupDeadline)}
                            </span>
                            <br />
                            <Link
                              to={`/doacoes/${donation.id}`}
                              className="font-bold text-leaf-600 hover:underline"
                            >
                              {linkLabel(donation.id)}
                            </Link>
                          </span>
                        ))}
                      </Popup>
                    </Marker>
                  );
                })}

                {home && (
                  <Marker position={home} icon={homeIcon} zIndexOffset={1000}>
                    <Tooltip permanent direction="top">
                      {homeLabel}
                    </Tooltip>
                  </Marker>
                )}
              </MapContainer>
            )}

            {/* Legenda curta sobre o próprio mapa: o que cada símbolo é, sem
                parágrafos. Não captura o mouse, para não atrapalhar o arraste. */}
            {!waitingForHome && (
              <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex max-w-[calc(100%-1.5rem)] flex-col gap-1.5 rounded-2xl border border-line bg-canvas/95 px-3 py-2.5 text-xs text-ink-body shadow-sm">
                {seesNetwork && <LegendRow swatch={SWATCH.food} label="Doador com comida disponível" />}
                {seesNetwork && showIdleDonors && (
                  <LegendRow swatch={SWATCH.idle} label="Doador sem doação agora" />
                )}
                {isAdmin && showNgos && <LegendRow swatch={SWATCH.ngo} label="ONG" />}
                {home && <LegendRow swatch={SWATCH.home} label={homeLabel} />}
                {isDonor && reach && (
                  <LegendRow swatch={SWATCH.area} label={`Área de alerta (${reach.defaultRadiusKm} km)`} />
                )}
                {!isAdmin && (
                  <span className="text-[11px] text-ink-muted">
                    {isNgo ? 'Outras ONGs não aparecem no mapa.' : 'ONGs não aparecem no mapa.'}
                  </span>
                )}
              </div>
            )}

            {home && map && (
              <button
                type="button"
                onClick={backToHome}
                className="absolute top-3 right-3 z-[1000] rounded-full border-[1.5px] border-line-strong bg-canvas px-3.5 py-1.5 text-xs font-semibold text-leaf-800 shadow-sm transition hover:border-leaf-800"
              >
                Voltar para {isNgo ? 'minha ONG' : 'meu endereço'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
