export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[22px] border border-line bg-surface px-5 py-4.5">
      <span className="text-xs font-semibold tracking-[0.04em] text-ink-muted uppercase">{label}</span>
      <span className="font-display text-[30px] leading-none font-semibold text-leaf-800">{value}</span>
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </div>
  );
}

/**
 * Cartão de destaque: fundo verde e número em laranja. É o único invertido da
 * grade, usado para o total que resume a tela — se houvesse dois, nenhum
 * destacaria nada.
 */
export function FeatureStatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-[22px] bg-leaf-800 px-5 py-4.5">
      <span className="text-xs font-semibold tracking-[0.04em] text-leaf-200 uppercase">{label}</span>
      <span className="font-display text-[30px] leading-none font-semibold text-sun-500">{value}</span>
    </div>
  );
}
