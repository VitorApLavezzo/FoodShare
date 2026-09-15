import { useEffect, useState } from 'react';
import { CATEGORY_LABEL } from '../lib/donations';

export interface DonationFilterValues {
  search?: string;
  category?: string;
  city?: string;
}

const inputClass =
  'rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900';

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

  // Espera o usuário parar de digitar para não disparar uma busca por tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((value.search ?? '') !== search) onChange({ ...value, search: search || undefined });
    }, 350);
    return () => clearTimeout(timer);
  }, [search, value, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar alimento…"
        aria-label="Buscar alimento"
        className={`${inputClass} flex-1 min-w-40`}
      />
      <select
        value={value.category ?? ''}
        onChange={(e) => onChange({ ...value, category: e.target.value || undefined })}
        aria-label="Categoria"
        className={inputClass}
      >
        <option value="">Todas as categorias</option>
        {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <input
        value={value.city ?? ''}
        onChange={(e) => onChange({ ...value, city: e.target.value || undefined })}
        placeholder="Cidade"
        aria-label="Cidade"
        className={`${inputClass} w-36`}
      />
      {(value.search || value.category || value.city) && (
        <button
          onClick={() => {
            setSearch('');
            onChange({});
          }}
          className="text-sm font-medium text-neutral-500 hover:underline"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
