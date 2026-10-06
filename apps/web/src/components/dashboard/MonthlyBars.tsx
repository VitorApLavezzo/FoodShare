/**
 * Barras em CSS puro, como no projeto de design — e não um gráfico de
 * biblioteca. São seis números numa escala só: eixo, grade e tooltip seriam
 * mais peso de leitura (e 348 KB de recharts) do que informação.
 *
 * O mês mais recente sai em laranja: é o único que a pessoa ainda pode mudar.
 */
export function MonthlyBars({ label, data }: { label: string; data: { month: string; count: number }[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface px-6 py-5">
      <span className="text-[13px] font-semibold text-ink-soft">{label}</span>
      <div className="grid h-40 auto-cols-fr grid-flow-col items-end gap-4">
        {data.map((d, index) => (
          <div key={d.month} className="flex h-full flex-col items-center justify-end gap-1.5">
            <span className="text-xs font-semibold text-leaf-800">{d.count}</span>
            <div
              className={`w-full max-w-14 rounded-t-xl rounded-b ${
                index === data.length - 1 ? 'bg-sun-500' : 'bg-leaf-600'
              }`}
              // Altura mínima de 2% para um mês zerado continuar visível como linha.
              style={{ height: `${Math.max((d.count / max) * 100, 2)}%` }}
            />
            <span className="text-xs text-ink-muted">{d.month}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
