export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  /** Centroide da região postal — impreciso, serve só como ponto de partida. */
  latitude?: number;
  longitude?: number;
}

export interface AddressForGeocoding {
  street: string;
  number?: string;
  neighborhood?: string;
  city: string;
  state: string;
  zipCode?: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface BrasilApiCepV2Response {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  location?: {
    coordinates?: {
      latitude?: string | number | null;
      longitude?: string | number | null;
    };
  };
}

interface ViaCepResponse {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface NominatimResponse {
  lat: string;
  lon: string;
}

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

async function queryNominatim(params: Record<string, string>): Promise<Coordinates | null> {
  const query = new URLSearchParams({ format: 'json', limit: '1', ...params });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query.toString()}`);
  if (!response.ok) return null;

  const data: NominatimResponse[] = await response.json();
  if (!data.length) return null;

  const latitude = Number(data[0].lat);
  const longitude = Number(data[0].lon);
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return null;
  return { latitude, longitude };
}

/**
 * Coordenada do endereço, não do CEP.
 *
 * O ponto devolvido por BrasilAPI/ViaCEP é o centroide da região postal e pode
 * cair a quilômetros da porta — e é a distância entre doador e ONG que decide
 * quem recebe alerta e o que o mapa mostra. Por isso a busca é estruturada
 * (rua + número separados de cidade/UF/CEP), que é a forma mais precisa do
 * Nominatim; só se ela não achar nada é que cai na busca por texto livre, sem
 * o número.
 *
 * Nunca lança: sem coordenada, quem chama decide o que fazer.
 */
export async function geocodeAddress(address: AddressForGeocoding): Promise<Coordinates | null> {
  const { street, number, neighborhood, city, state, zipCode } = address;
  if (!street?.trim() || !city?.trim() || !state?.trim()) return null;

  const postalcode = zipCode?.replace(/\D/g, '') ?? '';

  try {
    const structured = await queryNominatim({
      street: number?.trim() ? `${number.trim()} ${street}` : street,
      city,
      state,
      country: 'Brasil',
      ...(postalcode.length === 8 ? { postalcode } : {}),
    });
    if (structured) return structured;

    const parts = [street, neighborhood, city, state, 'Brasil'].filter((part) => !!part?.trim());
    return await queryNominatim({ q: parts.join(', ') });
  } catch {
    return null;
  }
}

async function fetchFromBrasilApi(digits: string): Promise<CepAddress | null> {
  const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${digits}`);
  if (!response.ok) return null;
  const data: BrasilApiCepV2Response = await response.json();

  const latitude = data.location?.coordinates?.latitude;
  const longitude = data.location?.coordinates?.longitude;

  return {
    street: data.street,
    neighborhood: data.neighborhood,
    city: data.city,
    state: data.state,
    latitude: latitude !== null && latitude !== undefined ? Number(latitude) : undefined,
    longitude: longitude !== null && longitude !== undefined ? Number(longitude) : undefined,
  };
}

async function fetchFromViaCep(digits: string): Promise<CepAddress | null> {
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
  if (!response.ok) return null;
  const data: ViaCepResponse = await response.json();
  if (data.erro) return null;

  return {
    street: data.logradouro,
    neighborhood: data.bairro,
    city: data.localidade,
    state: data.uf,
  };
}

/**
 * Preenche rua/bairro/cidade/UF a partir do CEP. A coordenada que vem junto é
 * só o centroide postal: serve de reserva até o endereço completo ser
 * geocodificado por `geocodeAddress`.
 */
export async function fetchAddressByCep(cep: string): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;

  const address = await fetchFromBrasilApi(digits).catch(() => null);
  return address ?? (await fetchFromViaCep(digits).catch(() => null));
}
