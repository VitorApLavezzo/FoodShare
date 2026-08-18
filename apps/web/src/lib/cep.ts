export interface CepAddress {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  latitude?: number;
  longitude?: number;
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

async function geocodeWithNominatim(street: string, city: string, state: string, number?: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const addressLine = number ? `${street}, ${number}` : street;
    const query = encodeURIComponent(`${addressLine}, ${city}, ${state}, Brasil`);
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`);
    if (!response.ok) return null;
    const data: NominatimResponse[] = await response.json();
    if (!data.length) return null;
    return { latitude: Number(data[0].lat), longitude: Number(data[0].lon) };
  } catch {
    return null;
  }
}

export async function geocodeAddress(
  street: string,
  number: string,
  city: string,
  state: string,
): Promise<{ latitude: number; longitude: number } | null> {
  if (!street || !city || !state) return null;
  return geocodeWithNominatim(street, city, state, number || undefined);
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

export async function fetchAddressByCep(cep: string): Promise<CepAddress | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;

  let address = await fetchFromBrasilApi(digits).catch(() => null);
  if (!address) {
    address = await fetchFromViaCep(digits);
  }
  if (!address) return null;

  // O ponto retornado pelo CEP (BrasilAPI/ViaCEP) é o centroide da região postal,
  // que pode ficar a alguns km da rua real. Geocodificar pelo nome da rua no
  // Nominatim é bem mais preciso — só cai no ponto do CEP se a busca falhar.
  const coordinates = await geocodeWithNominatim(address.street, address.city, address.state);
  if (coordinates) {
    address.latitude = coordinates.latitude;
    address.longitude = coordinates.longitude;
  }

  return address;
}
