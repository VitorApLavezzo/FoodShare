import { useEffect, useState } from 'react';
import { CATEGORY_LABEL } from '../lib/donations';
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

  // Espera o usuário parar de digitar para não disparar uma busca por tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((value.search ?? '') !== search) onChange({ ...value, search: search || undefined });
    }, 350);
    return () => clearTimeout(timer);
  }, [search, value, onChange]);

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[20px] border border-line bg-surface p-3">
      <input
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
        value={value.city ?? ''}
        onChange={(e) => onChange({ ...value, city: e.target.value || undefined })}
        placeholder="Cidade"
        aria-label="Cidade"
        className={`${FILTER_CONTROL_CLASS} w-36`}
      />
      {(value.search || value.category || value.city) && (
        <button
          onClick={() => {
            setSearch('');
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
