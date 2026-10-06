import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DONATION_CATEGORIES, DONATION_CATEGORY_LABEL, type DonationCategory } from '@foodshare/types';
import {
  createTemplate,
  deleteTemplate,
  fetchTemplates,
  setTemplateActive,
  RECURRENCE_LABEL,
  WEEKDAY_LABEL,
  type DonationRecurrence,
  type DonationTemplate,
} from '../lib/templates';
import { getApiErrorMessage } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { Button } from './ui/Button';
import { QueryState } from './ui/QueryState';

const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900';
const labelClass = 'mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300';

function describeSchedule(template: DonationTemplate) {
  const hora = `${String(template.hourOfDay).padStart(2, '0')}h`;
  if (template.recurrence === 'WEEKLY') {
    return `${WEEKDAY_LABEL[template.weekday ?? 1]}, às ${hora}`;
  }
  return `${RECURRENCE_LABEL[template.recurrence]}, às ${hora}`;
}

/**
 * Doações recorrentes: o doador descreve a oferta uma vez e o sistema publica
 * sozinho no horário combinado, em vez de exigir que ele recrie a mesma lista
 * manualmente todo dia.
 */
export function DonationTemplatesPanel() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [foodName, setFoodName] = useState('');
  const [category, setCategory] = useState<DonationCategory>('PREPARED_MEALS');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('un');
  const [recurrence, setRecurrence] = useState<DonationRecurrence>('DAILY');
  const [hourOfDay, setHourOfDay] = useState('20');
  const [weekday, setWeekday] = useState('1');

  const query = useQuery({ queryKey: ['donation-templates'], queryFn: fetchTemplates });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['donation-templates'] });

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      setError(null);
      setShowForm(false);
      setName('');
      setFoodName('');
      invalidate();
      showToast('Doação recorrente criada.', 'success');
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível criar o modelo.')),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setTemplateActive(id, isActive),
    onSuccess: invalidate,
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível alterar o modelo.')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: invalidate,
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível remover o modelo.')),
  });

  const submit = () => {
    createMutation.mutate({
      name,
      allowPartial: true,
      recurrence,
      hourOfDay: Number(hourOfDay),
      weekday: recurrence === 'WEEKLY' ? Number(weekday) : undefined,
      items: [{ foodName, category, quantity: Number(quantity), unit }],
    });
  };

  const templates = query.data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Doações recorrentes</h2>
          <p className="text-sm text-neutral-500">Publique sozinho o que sobra todo dia, sem recadastrar.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? 'Fechar' : 'Nova recorrência'}
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mt-4 flex flex-col gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <div>
            <label className={labelClass}>Nome do modelo</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: sobra de padaria no fim do dia"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Alimento</label>
              <input
                className={inputClass}
                value={foodName}
                onChange={(e) => setFoodName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Categoria</label>
              <select
                className={inputClass}
                value={category}
                onChange={(e) => setCategory(e.target.value as DonationCategory)}
              >
                {DONATION_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {DONATION_CATEGORY_LABEL[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Quantidade estimada</label>
              <input
                type="number"
                step="any"
                min={0}
                className={inputClass}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Unidade</label>
              <input className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={labelClass}>Frequência</label>
              <select
                className={inputClass}
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as DonationRecurrence)}
              >
                {Object.entries(RECURRENCE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Hora de publicar</label>
              <input
                type="number"
                min={0}
                max={23}
                className={inputClass}
                value={hourOfDay}
                onChange={(e) => setHourOfDay(e.target.value)}
              />
            </div>
            {recurrence === 'WEEKLY' && (
              <div>
                <label className={labelClass}>Dia da semana</label>
                <select className={inputClass} value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                  {WEEKDAY_LABEL.map((label, index) => (
                    <option key={label} value={index}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <Button type="submit" size="sm" className="self-start" loading={createMutation.isPending}>
            Criar recorrência
          </Button>
        </form>
      )}

      <div className="mt-4">
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={templates.length === 0}
          emptyMessage="Nenhuma doação recorrente configurada."
          onRetry={() => query.refetch()}
        >
          <div className="flex flex-col gap-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <div>
                  <p className="font-medium text-neutral-900 dark:text-white">
                    {template.name}{' '}
                    {!template.isActive && (
                      <span className="text-xs font-normal text-neutral-500">(pausada)</span>
                    )}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {describeSchedule(template)} · {template.items.map((i) => i.foodName).join(', ')}
                  </p>
                  {template.lastGeneratedAt && (
                    <p className="mt-0.5 text-xs text-neutral-400">
                      Última publicação: {formatDateTime(template.lastGeneratedAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toggleMutation.mutate({ id: template.id, isActive: !template.isActive })}
                  >
                    {template.isActive ? 'Pausar' : 'Retomar'}
                  </Button>
                  <button
                    onClick={() => {
                      if (!window.confirm(`Remover a recorrência "${template.name}"?`)) return;
                      deleteMutation.mutate(template.id);
                    }}
                    className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        </QueryState>
      </div>
    </div>
  );
}
