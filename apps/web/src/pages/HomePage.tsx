import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Logo, LogoMark } from '../components/layout/Logo';
import { Button } from '../components/ui/Button';

interface HealthResponse {
  status: string;
  nodeId: string;
  checks?: { database: boolean; redis: boolean };
}

const STEPS = [
  {
    step: '01',
    title: 'Estabelecimento publica',
    desc: 'Restaurantes e mercados cadastram o excedente do dia em segundos — quantidade, categoria e prazo de retirada.',
    icon: '🍽️',
  },
  {
    step: '02',
    title: 'ONG reserva com prioridade',
    desc: 'A instituição mais próxima reserva o alimento antes que ele vença. Sem disputa: o sistema garante que só uma reserva vale.',
    icon: '📋',
  },
  {
    step: '03',
    title: 'Retirada rastreada',
    desc: 'Um código confirma a retirada presencial. Todo o trajeto fica registrado, do prato até quem recebeu.',
    icon: '✅',
  },
];

const STATS = [
  { value: '3', label: 'perfis de acesso' },
  { value: '100%', label: 'rastreável' },
  { value: 'multi-região', label: 'arquitetura distribuída' },
];

export function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<HealthResponse>('/ready')
      .then((res) => setHealth(res.data))
      .catch(() => setError('offline'));
  }, []);

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-40 right-[-10%] h-[36rem] w-[36rem] rounded-full bg-brand-200/50 blur-3xl dark:bg-brand-900/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-32 left-[-15%] h-[28rem] w-[28rem] rounded-full bg-accent-200/40 blur-3xl dark:bg-accent-900/10"
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Entrar
            </Button>
          </Link>
          <Link to="/register">
            <Button size="sm">Cadastrar</Button>
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 pb-20 pt-12 text-center">
        <span className="rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300">
          🌱 Sustentabilidade · Alimentação · Impacto social
        </span>

        <h1 className="font-display max-w-3xl text-5xl font-medium leading-[1.1] tracking-tight text-neutral-900 sm:text-6xl dark:text-white">
          Comida que sobra <span className="text-brand-600 dark:text-brand-400">não devia virar lixo</span>
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
          O FoodShare conecta restaurantes e mercados com excedentes alimentares a
          ONGs que distribuem para quem precisa — com reserva sem conflito e
          rastreabilidade de ponta a ponta.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/register">
            <Button size="md" className="px-6 py-3 text-base">
              Começar agora
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary" size="md" className="px-6 py-3 text-base">
              Já tenho conta
            </Button>
          </Link>
        </div>

        <div className="mt-4 flex items-center gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display text-2xl font-semibold text-neutral-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-neutral-500">{s.label}</p>
            </div>
          ))}
        </div>
      </main>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24">
        <div className="mb-10 text-center">
          <h2 className="font-display text-3xl font-medium text-neutral-900 dark:text-white">Como funciona</h2>
          <p className="mt-2 text-neutral-500">Três passos, do prato ao prato.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.step}
              className="group relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
            >
              <span className="font-display text-4xl text-neutral-100 transition group-hover:text-brand-100 dark:text-neutral-800 dark:group-hover:text-brand-900/60">
                {s.step}
              </span>
              <span className="absolute right-6 top-6 text-2xl">{s.icon}</span>
              <h3 className="mt-3 text-lg font-semibold text-neutral-900 dark:text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-neutral-200 px-6 py-8 dark:border-neutral-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="inline-flex items-center gap-2 text-sm text-neutral-500">
            <LogoMark className="h-5 w-5" />
            FoodShare · plataforma distribuída de compartilhamento de alimentos
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-xs ${
              error ? 'text-red-500' : health ? 'text-brand-600 dark:text-brand-400' : 'text-neutral-400'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                error ? 'bg-red-500' : health ? 'bg-brand-500' : 'bg-neutral-300 animate-pulse'
              }`}
            />
            {error ? 'API indisponível' : health ? `sistema operante · nó ${health.nodeId}` : 'verificando…'}
          </span>
        </div>
      </footer>
    </div>
  );
}
