import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Logo, LogoMark } from '../components/layout/Logo';
import { ButtonLink } from '../components/ui/Button';

interface HealthResponse {
  status: string;
  nodeId: string;
  checks?: { database: boolean; redis: boolean };
}

// Numeração legítima: são três passos em ordem, não três itens quaisquer.
const STEPS = [
  {
    step: '1',
    title: 'O estabelecimento publica',
    desc: 'Sobrou no fim do dia? Cadastre quantidade, categoria e prazo de retirada em poucos segundos.',
  },
  {
    step: '2',
    title: 'A ONG reserva',
    desc: 'A instituição mais perto garante o alimento antes que ele vença. Uma reserva por doação, sem disputa.',
  },
  {
    step: '3',
    title: 'Retirada com código',
    desc: 'Na hora de buscar, um código confirma a entrega. Fica tudo registrado, do prato até quem recebeu.',
  },
];

interface PublicStats {
  profiles: number;
}

export function HomePage() {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    api
      .get<HealthResponse>('/ready')
      .then((res) => setHealth(res.data))
      .catch(() => setError('offline'));
    // O primeiro número era um "3" fixo (os três papéis de acesso) e parecia
    // um contador travado; agora é a contagem real de doadores e ONGs.
    api
      .get<PublicStats>('/dashboard/public')
      .then((res) => setStats(res.data))
      .catch(() => setStats(null));
  }, []);

  const statItems = [
    { value: stats ? stats.profiles.toLocaleString('pt-BR') : '—', label: 'perfis cadastrados' },
    { value: '100%', label: 'rastreável' },
    { value: 'multi-região', label: 'arquitetura distribuída' },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <Link to="/">
          <Logo className="h-[34px] w-auto" />
        </Link>
        {/* Quem já tem sessão aberta não precisa de "Entrar" e "Cadastrar" —
            precisa de um caminho de volta para o painel. */}
        <nav className="flex items-center gap-2">
          {user ? (
            <ButtonLink to="/dashboard">Ir para o painel</ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost">
                Entrar
              </ButtonLink>
              <ButtonLink to="/register">Cadastrar</ButtonLink>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-12 pb-22 lg:grid-cols-2">
        <div className="flex flex-col items-start gap-6">
          <span className="rounded-full bg-sun-100 px-4 py-1.5 text-sm font-semibold text-sun-800">
            Sustentabilidade · Alimentação · Impacto social
          </span>

          <h1 className="font-display text-[clamp(2.75rem,6vw,4.25rem)] leading-[1.02] font-semibold tracking-[-0.01em] text-balance text-leaf-800">
            Sobrou comida boa? <span className="text-sun-500">Compartilhaê.</span>
          </h1>

          <p className="max-w-[520px] text-[19px] leading-relaxed text-pretty text-ink-soft">
            A gente conecta restaurantes e mercados que têm excedente com ONGs que levam o alimento até quem
            precisa. Reserva sem confusão e retirada acompanhada do começo ao fim.
          </p>

          <div className="flex flex-wrap gap-3">
            {user ? (
              <ButtonLink to="/dashboard" size="lg">
                Continuar no painel
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/register" size="lg">
                  Quero participar
                </ButtonLink>
                <ButtonLink to="/login" variant="secondary" size="lg">
                  Já tenho conta
                </ButtonLink>
              </>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-9">
            {statItems.map((s) => (
              <div key={s.label}>
                <p className="font-display text-[28px] leading-none font-semibold text-leaf-800">{s.value}</p>
                <p className="mt-1 text-[13px] text-ink-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Anéis concêntricos em sombra sólida: o mark parece pousado no papel,
            sem nenhuma imagem de fundo. */}
        <div className="flex justify-center">
          <div className="flex aspect-square w-[min(100%,460px)] items-center justify-center rounded-full bg-canvas shadow-[0_0_0_18px_var(--color-sand-soft),0_0_0_36px_var(--color-canvas),0_0_0_37px_var(--color-line)]">
            <LogoMark className="h-auto w-[72%]" />
          </div>
        </div>
      </main>

      <section className="bg-leaf-800 px-6 py-20 text-canvas">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex flex-col gap-2">
            <h2 className="font-display text-[40px] leading-tight font-semibold">Como funciona</h2>
            <p className="text-[17px] text-leaf-200">Três passos, do prato ao prato.</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.step}
                className="flex flex-col gap-3 rounded-[28px] bg-canvas p-7 transition motion-safe:hover:-translate-y-1"
              >
                <span className="font-display flex h-13 w-13 items-center justify-center rounded-full bg-sun-500 text-[22px] font-bold text-leaf-800">
                  {s.step}
                </span>
                <h3 className="font-display mt-1.5 text-[22px] font-semibold text-leaf-800">{s.title}</h3>
                <p className="text-[15px] leading-relaxed text-pretty text-ink-soft">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line px-6 py-7">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <span className="flex items-center gap-2.5 text-sm text-ink-muted">
            <LogoMark className="h-7 w-auto" />
            Compartilhaê · comida boa circulando de mão em mão
          </span>
          <span
            className={`flex items-center gap-2 text-[13px] font-medium ${
              error ? 'text-danger' : health ? 'text-leaf-600' : 'text-ink-faint'
            }`}
          >
            <span
              className={`h-[7px] w-[7px] rounded-full ${
                error ? 'bg-danger' : health ? 'bg-leaf-600' : 'animate-pulse bg-line-bold'
              }`}
              aria-hidden
            />
            {error ? 'API indisponível' : health ? `sistema operante · nó ${health.nodeId}` : 'verificando…'}
          </span>
        </div>
      </footer>
    </div>
  );
}
