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

/** Valor aceito por `<input type="datetime-local">`, no fuso de quem está usando. */
export function toLocalInputValue(value: string | Date) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

/** Quanto falta até a data, do jeito que se fala: "faltam 3 h", "falta 1 dia". */
export function timeUntil(value: string | Date, now = Date.now()) {
  const minutes = Math.round((new Date(value).getTime() - now) / 60_000);
  if (minutes <= 0) return 'prazo encerrado';
  if (minutes < 60) return minutes === 1 ? 'falta 1 min' : `faltam ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'falta 1 h' : `faltam ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'falta 1 dia' : `faltam ${days} dias`;
}

/** Menos de duas horas para o prazo: hora de chamar atenção. */
export function isDeadlineClose(value: string | Date, now = Date.now()) {
  return new Date(value).getTime() - now < 2 * 3_600_000;
}
