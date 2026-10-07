/**
 * Marca oficial do Compartilhaê, extraída do arquivo original.
 *
 * As duas peças são separadas de propósito: o símbolo sozinho aparece no herói,
 * no painel de entrada e no rodapé; o wordmark, onde é preciso ler o nome. O
 * `className` controla a altura (ou a largura, no herói) — a outra dimensão
 * fica em `auto` para o logo nunca distorcer.
 */
export function LogoMark({ className = 'h-8 w-auto' }: { className?: string }) {
  return (
    <img src="/brand/compartilhae-mark.png" alt="" aria-hidden className={`object-contain ${className}`} />
  );
}

export function Logo({ className = 'h-7 w-auto' }: { className?: string }) {
  return (
    <img src="/brand/compartilhae-wordmark.png" alt="Compartilhaê" className={`object-contain ${className}`} />
  );
}
