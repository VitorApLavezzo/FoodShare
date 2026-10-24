import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo, LogoMark } from './Logo';

// Os três pontos coloridos são a legenda do sistema inteiro: laranja é o que
// está disponível, verde claro é quem reserva, verde escuro é a retirada
// concluída. Quem entra já aprende o código de cores antes de logar.
const HIGHLIGHTS = [
  { dot: 'bg-sun-500', text: 'Estabelecimentos publicam o excedente em segundos' },
  { dot: 'bg-leaf-600', text: 'ONGs reservam com prioridade e sem disputa' },
  { dot: 'bg-leaf-800', text: 'Retirada acompanhada, do prato até quem recebe' },
];

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between gap-10 border-r border-line bg-canvas p-10 lg:flex">
        <Link to="/" className="self-start">
          <Logo className="h-[34px] w-auto" />
        </Link>

        <div className="flex max-w-md flex-col gap-7">
          <LogoMark className="h-auto w-48" />
          <p className="font-display text-[2.125rem] leading-[1.15] font-semibold text-balance text-leaf-800">
            Comida boa não é pra virar lixo enquanto alguém passa fome.
          </p>
          <ul className="flex flex-col gap-3.5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-[15px] text-ink-soft">
                <span className={`h-2 w-2 shrink-0 rounded-full ${h.dot}`} aria-hidden />
                {h.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[13px] text-ink-muted">Feito pra funcionar em várias cidades e regiões</p>
      </div>

      <div className="flex flex-col justify-center bg-surface px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-[380px]">
          {/* No celular o painel da esquerda some, e com ele o único caminho de
              volta para a página inicial. */}
          <Link to="/" className="mb-8 inline-block lg:hidden">
            <Logo className="h-7 w-auto" />
          </Link>

          <h1 className="font-display text-[2.125rem] leading-tight font-semibold text-leaf-800">{title}</h1>
          <p className="mt-2 text-[15px] text-ink-muted">{subtitle}</p>

          <div className="mt-8">{children}</div>

          <div className="mt-8 text-center text-sm text-ink-muted">{footer}</div>
        </div>
      </div>
    </div>
  );
}
