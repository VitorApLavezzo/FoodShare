export interface PostalAddress {
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
  latitude?: number | null;
  longitude?: number | null;
}

/** "Rua X, 123 · Centro · Limeira/SP" — o que aparece onde a ONG precisa saber aonde ir. */
export function formatAddress(address: PostalAddress) {
  const street = [address.street, address.number].filter(Boolean).join(', ');
  return [street, address.neighborhood, `${address.city}/${address.state}`].filter(Boolean).join(' · ');
}

/** Rota até o endereço no Google Maps; usa a coordenada quando existe, que é mais exata. */
export function directionsUrl(address: PostalAddress) {
  const destination =
    typeof address.latitude === 'number' && typeof address.longitude === 'number'
      ? `${address.latitude},${address.longitude}`
      : formatAddress(address);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
