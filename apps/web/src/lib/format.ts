const LOCALE = 'pt-BR';

export function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' });
}

export function formatTime(value: string | Date) {
  return new Date(value).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

export function formatQuantity(value: number, unit: string) {
  // Quantidades são decimais (0.5 kg): remove zeros à direita sem arredondar.
  return `${Number(value.toFixed(3))} ${unit}`;
}
