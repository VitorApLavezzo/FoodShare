/**
 * O mark do projeto de design é um PNG que não passa pelo limite de leitura do
 * DesignSync. Este é o símbolo que o app já tinha, recolorido para a paleta
 * Compartilhaê — forma preservada, cor nova. Trocar pelo arquivo original é só
 * substituir este SVG por uma <img>.
 */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="20" cy="20" r="20" className="fill-leaf-800" />
      <path
        d="M20 8c-6.6 0-12 5.4-12 12 0 4.9 3 9.1 7.2 10.9.5-3.9 1.9-7.4 4-10.2 2.1-2.8 4.9-5.1 8.1-6.6.4 1.4.7 2.9.7 4.5 0 4.6-2.6 8.6-6.4 10.6"
        className="stroke-canvas"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="27.5" cy="13.5" r="2.6" className="fill-sun-500" />
    </svg>
  );
}

/**
 * O wordmark do design também é um PNG indisponível, então é composto em
 * Fredoka — a própria família de display do sistema. Texto de verdade: nítido
 * em qualquer tamanho, sem download e lido por leitor de tela.
 */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-display text-xl leading-none font-semibold tracking-tight text-leaf-800 ${className}`}
    >
      Compartilhaê
    </span>
  );
}
