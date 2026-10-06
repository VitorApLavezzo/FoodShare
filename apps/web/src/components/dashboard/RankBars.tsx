/**
 * Ranking em barras horizontais. A escala é relativa ao maior item, não ao
 * total: a leitura que interessa é a comparação entre as linhas.
 */
export function RankBars({
  label,
  data,
  emptyMessage = 'Sem dados ainda.',
}: {
  label: string;
  data: { name: string; count: number }[];
  emptyMessage?: string;
}) {
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="rounded-[22px] border border-line bg-surface px-6 py-5">
      <p className="text-[13px] font-semibold text-ink-soft">{label}</p>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{emptyMessage}</p>
      ) : (
        <ul className="mt-2">
          {data.map((d) => (
            <li
              key={d.name}
              className="grid grid-cols-[minmax(5rem,9rem)_minmax(0,1fr)_auto] items-center gap-3 border-t border-sand py-2.5 text-sm"
            >
              <span className="truncate font-semibold text-ink" title={d.name}>
                {d.name}
              </span>
              <div className="h-2.5 overflow-hidden rounded-full bg-sand">
                <div
                  className="h-full rounded-full bg-leaf-600"
                  style={{ width: `${Math.round((d.count / max) * 100)}%` }}
                />
              </div>
              <span className="text-ink-muted">{d.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
