import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { donationDateIssues, updateDonation, type DonationDates, type DonationList } from '../lib/donations';
import { getApiErrorMessage } from '../lib/api';
import { toLocalInputValue } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { Button } from './ui/Button';
import { InputField } from './ui/Field';

export function EditDonationListForm({
  donationList,
  onDone,
}: {
  donationList: DonationList;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [availableAt, setAvailableAt] = useState(toLocalInputValue(donationList.availableAt));
  const [pickupDeadline, setPickupDeadline] = useState(toLocalInputValue(donationList.pickupDeadline));
  const [expiresAt, setExpiresAt] = useState(toLocalInputValue(donationList.expiresAt));
  const [notes, setNotes] = useState(donationList.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof DonationDates, string>>>({});

  const mutation = useMutation({
    mutationFn: () =>
      updateDonation(donationList.id, {
        availableAt: new Date(availableAt).toISOString(),
        pickupDeadline: new Date(pickupDeadline).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
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
    const issues = donationDateIssues({ availableAt, pickupDeadline, expiresAt });
    setFieldErrors(Object.fromEntries(issues.map((issue) => [issue.field, issue.message])));
    if (issues.length > 0) return;
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
      <div className="grid gap-3 sm:grid-cols-3">
        <InputField
          type="datetime-local"
          label="Disponível a partir de"
          value={availableAt}
          error={fieldErrors.availableAt}
          onChange={(e) => setAvailableAt(e.target.value)}
        />
        <InputField
          type="datetime-local"
          label="Prazo limite de retirada"
          value={pickupDeadline}
          error={fieldErrors.pickupDeadline}
          onChange={(e) => setPickupDeadline(e.target.value)}
        />
        <InputField
          type="datetime-local"
          label="Validade do alimento"
          value={expiresAt}
          error={fieldErrors.expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
      </div>
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
