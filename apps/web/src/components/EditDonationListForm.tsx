import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  donationDateIssues,
  minExpiresAt,
  minPickupDeadline,
  updateDonation,
  type DonationList,
} from '../lib/donations';
import { getApiErrorMessage } from '../lib/api';
import { toLocalInputValue } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { Button } from './ui/Button';
import { InputField } from './ui/Field';

type FieldErrors = Record<string, string>;

const toIso = (value: string) => new Date(value).toISOString();

export function EditDonationListForm({
  donationList,
  onDone,
}: {
  donationList: DonationList;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { allowPartial } = donationList;
  const [availableAt, setAvailableAt] = useState(toLocalInputValue(donationList.availableAt));
  // Sem reserva parcial o prazo é um só, da lista; com ela, cada item tem o seu.
  const [sharedDeadline, setSharedDeadline] = useState(toLocalInputValue(donationList.pickupDeadline));
  const [items, setItems] = useState(
    donationList.items.map((item) => ({
      id: item.id,
      foodName: item.foodName,
      pickupDeadline: toLocalInputValue(item.pickupDeadline),
      expiresAt: toLocalInputValue(item.expiresAt),
    })),
  );
  const [notes, setNotes] = useState(donationList.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const deadlineOf = (item: (typeof items)[number]) => (allowPartial ? item.pickupDeadline : sharedDeadline);
  const updateItem = (id: string, patch: Partial<(typeof items)[number]>) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const minExpiry = (pickupDeadline: string) => {
    const min = minExpiresAt(pickupDeadline);
    return min ? toLocalInputValue(min) : undefined;
  };
  // A regra de 1 dia conta da publicação original, não de agora.
  const minDeadline = toLocalInputValue(minPickupDeadline(new Date(donationList.createdAt)));

  const mutation = useMutation({
    mutationFn: () =>
      updateDonation(donationList.id, {
        availableAt: toIso(availableAt),
        pickupDeadline: allowPartial ? undefined : toIso(sharedDeadline),
        items: items.map((item) => ({
          id: item.id,
          pickupDeadline: allowPartial ? toIso(item.pickupDeadline) : undefined,
          expiresAt: toIso(item.expiresAt),
        })),
        // String vazia, e não `undefined`: com `undefined` a API mantinha o
        // texto antigo e não havia como apagar uma observação.
        notes: notes.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      queryClient.invalidateQueries({ queryKey: ['donation', donationList.id] });
      showToast('Doação atualizada.', 'success');
      onDone();
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível salvar as alterações.')),
  });

  const submit = () => {
    const errors: FieldErrors = {};
    items.forEach((item) => {
      if (!deadlineOf(item)) errors[allowPartial ? `${item.id}.pickupDeadline` : 'pickupDeadline'] = 'Informe o prazo.';
      if (!item.expiresAt) errors[`${item.id}.expiresAt`] = 'Informe a validade.';
    });
    const issues = donationDateIssues({
      availableAt,
      postedAt: new Date(donationList.createdAt),
      items: items.map((item) => ({ pickupDeadline: deadlineOf(item), expiresAt: item.expiresAt })),
    });
    for (const issue of issues) {
      const key =
        issue.field === 'pickupDeadline' && !allowPartial
          ? 'pickupDeadline'
          : `${items[issue.index].id}.${issue.field}`;
      errors[key] ??= issue.message;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setError(null);
    mutation.mutate();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mt-3 flex flex-col gap-3 rounded-2xl border border-line bg-canvas p-4"
    >
      <p className="text-xs text-ink-muted">
        Dá pra ajustar datas e observações. Os alimentos e as quantidades não mudam depois de publicados —
        para isso, cancele e publique de novo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <InputField
          type="datetime-local"
          label="Disponível a partir de"
          value={availableAt}
          onChange={(e) => setAvailableAt(e.target.value)}
        />
        {!allowPartial && (
          <InputField
            type="datetime-local"
            label="Prazo limite de retirada"
            min={minDeadline}
            hint="Vale para todos os itens."
            value={sharedDeadline}
            error={fieldErrors.pickupDeadline}
            onChange={(e) => setSharedDeadline(e.target.value)}
          />
        )}
      </div>

      {items.map((item) => (
        <div key={item.id} className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <p className="text-sm font-bold text-leaf-800 sm:col-span-2">{item.foodName}</p>
          {allowPartial && (
            <InputField
              type="datetime-local"
              label="Prazo de retirada"
              min={minDeadline}
              value={item.pickupDeadline}
              error={fieldErrors[`${item.id}.pickupDeadline`]}
              onChange={(e) => updateItem(item.id, { pickupDeadline: e.target.value })}
            />
          )}
          <InputField
            type="datetime-local"
            label="Validade do alimento"
            min={minExpiry(deadlineOf(item))}
            value={item.expiresAt}
            error={fieldErrors[`${item.id}.expiresAt`]}
            onChange={(e) => updateItem(item.id, { expiresAt: e.target.value })}
          />
        </div>
      ))}

      <InputField label="Observações" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={mutation.isPending}>
          Salvar alterações
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
