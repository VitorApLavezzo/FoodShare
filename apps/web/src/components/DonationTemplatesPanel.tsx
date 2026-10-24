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
import { Button, InlineDangerButton } from './ui/Button';
import { QueryState } from './ui/QueryState';
import { InputField, SelectField } from './ui/Field';

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
    onSuccess: (template) => {
      setError(null);
      invalidate();
      showToast(template.isActive ? 'Recorrência retomada.' : 'Recorrência pausada.', 'info');
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível alterar o modelo.')),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      setError(null);
      invalidate();
      showToast('Recorrência removida.', 'info');
    },
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
  const active = templates.filter((template) => template.isActive);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-leaf-800 p-6">
        <div>
          <h2 className="font-display text-[22px] font-semibold text-canvas">Doações recorrentes</h2>
          <p className="mt-1 text-sm text-leaf-200">
            Sobra todo dia? Deixa que a gente publica no horário combinado.
            {/* Só a contagem: a lista completa (com pausar e remover) já vem logo abaixo. */}
            {active.length > 0 && (
              <> {active.length === 1 ? '1 recorrência ativa.' : `${active.length} recorrências ativas.`}</>
            )}
          </p>
        </div>
        <Button variant="accent" aria-expanded={showForm} onClick={() => setShowForm((prev) => !prev)}>
          {showForm ? 'Fechar' : 'Nova recorrência'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6"
        >
          <InputField
            label="Nome do modelo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: sobra de padaria no fim do dia"
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              label="Alimento"
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              required
            />
            <SelectField
              label="Categoria"
              value={category}
              onChange={(e) => setCategory(e.target.value as DonationCategory)}
            >
              {DONATION_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {DONATION_CATEGORY_LABEL[value]}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <InputField
              type="number"
              step="any"
              min={0}
              label="Quantidade estimada"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <InputField label="Unidade" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField
              label="Frequência"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as DonationRecurrence)}
            >
              {Object.entries(RECURRENCE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <InputField
              type="number"
              min={0}
              max={23}
              label="Hora de publicar"
              hint="De 0 a 23 — ex.: 20 publica às 20h."
              value={hourOfDay}
              onChange={(e) => setHourOfDay(e.target.value)}
            />
            {recurrence === 'WEEKLY' && (
              <SelectField label="Dia da semana" value={weekday} onChange={(e) => setWeekday(e.target.value)}>
                {WEEKDAY_LABEL.map((label, index) => (
                  <option key={label} value={index}>
                    {label}
                  </option>
                ))}
              </SelectField>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={createMutation.isPending}>
              Criar recorrência
            </Button>
            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <div>
        <QueryState
          isLoading={query.isLoading}
          isError={query.isError}
          error={query.error}
          isEmpty={templates.length === 0}
          emptyMessage='Nenhuma doação recorrente configurada. Use "Nova recorrência" para publicar sozinho todo dia.'
          onRetry={() => query.refetch()}
        >
          <div className="flex flex-col gap-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-line bg-surface px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="font-bold text-ink">
                    {template.name}{' '}
                    {!template.isActive && (
                      <span className="text-xs font-normal text-ink-muted">(pausada)</span>
                    )}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {describeSchedule(template)} · {template.items.map((i) => i.foodName).join(', ')}
                  </p>
                  {template.lastGeneratedAt && (
                    <p className="mt-0.5 text-xs text-ink-dim">
                      Última publicação: {formatDateTime(template.lastGeneratedAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <Button
                    variant="secondary"
                    loading={toggleMutation.isPending && toggleMutation.variables?.id === template.id}
                    onClick={() => toggleMutation.mutate({ id: template.id, isActive: !template.isActive })}
                  >
                    {template.isActive ? 'Pausar' : 'Retomar'}
                  </Button>
                  <InlineDangerButton
                    disabled={deleteMutation.isPending}
                    onClick={() => {
                      if (!window.confirm(`Remover a recorrência "${template.name}"?`)) return;
                      deleteMutation.mutate(template.id);
                    }}
                  >
                    Remover
                  </InlineDangerButton>
                </div>
              </div>
            ))}
          </div>
        </QueryState>
      </div>
    </section>
  );
}
