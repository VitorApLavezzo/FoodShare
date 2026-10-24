import { useEffect, useState } from 'react';
import { CATEGORY_LABEL } from '../lib/donations';
import { useDebouncedValue } from '../lib/use-debounced-value';
import { FILTER_CONTROL_CLASS } from './ui/Field';

export interface DonationFilterValues {
  search?: string;
  category?: string;
  city?: string;
}

/**
 * A API já filtrava por alimento, categoria e cidade — a tela simplesmente não
 * expunha isso, e a ONG via uma lista única sem como procurar nada.
 */
export function DonationFilters({
  value,
  onChange,
}: {
  value: DonationFilterValues;
  onChange: (value: DonationFilterValues) => void;
}) {
  const [search, setSearch] = useState(value.search ?? '');
  // A cidade também espera a pessoa parar de digitar: antes cada letra virava
  // uma busca (e "Limei" não acha nada, porque a cidade é comparada inteira).
  const [city, setCity] = useState(value.city ?? '');
  const debouncedSearch = useDebouncedValue(search.trim());
  const debouncedCity = useDebouncedValue(city.trim());

  useEffect(() => {
    if ((value.search ?? '') === debouncedSearch && (value.city ?? '') === debouncedCity) return;
    onChange({ ...value, search: debouncedSearch || undefined, city: debouncedCity || undefined });
    // `value` e `onChange` mudam a cada render do pai; só o texto digitado importa aqui.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debouncedCity]);

  const hasFilters = !!(search || city || value.category);

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[20px] border border-line bg-surface p-3">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar alimento…"
        aria-label="Buscar alimento"
        className={`${FILTER_CONTROL_CLASS} min-w-40 flex-1`}
      />
      <select
        value={value.category ?? ''}
        onChange={(e) => onChange({ ...value, category: e.target.value || undefined })}
        aria-label="Categoria"
        className={FILTER_CONTROL_CLASS}
      >
        <option value="">Todas as categorias</option>
        {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <input
        value={city}
        onChange={(e) => setCity(e.target.value)}
        placeholder="Cidade"
        aria-label="Cidade"
        className={`${FILTER_CONTROL_CLASS} w-36`}
      />
      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setCity('');
            onChange({});
          }}
          className="rounded-sm px-1 text-sm font-semibold text-ink-muted transition hover:text-leaf-800 hover:underline"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
