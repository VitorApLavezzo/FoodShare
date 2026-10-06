import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateDonation, type DonationList } from '../lib/donations';
import { getApiErrorMessage } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Button } from './ui/Button';

const inputClass =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-canvas px-3.5 py-3 text-[15px] text-ink transition placeholder:text-ink-faint focus:border-leaf-600 focus:bg-surface focus:ring-4 focus:ring-leaf-600/15 focus:outline-none';
const labelClass = 'mb-1.5 block text-sm font-semibold text-ink-body';

function toLocalInputValue(iso: string) {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

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

  const mutation = useMutation({
    mutationFn: () =>
      updateDonation(donationList.id, {
        availableAt: new Date(availableAt).toISOString(),
        pickupDeadline: new Date(pickupDeadline).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donations'] });
      showToast('Doação atualizada.', 'success');
      onDone();
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Não foi possível salvar as alterações.')),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="mt-3 flex flex-col gap-3 rounded-2xl border border-line bg-canvas p-4"
    >
      <p className="text-xs text-ink-muted">
        Só é possível editar os itens ainda intactos: nome/quantidade dos alimentos não podem ser alterados
        após a publicação.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Disponível a partir de</label>
          <input
            type="datetime-local"
            className={inputClass}
            value={availableAt}
            onChange={(e) => setAvailableAt(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Prazo limite de retirada</label>
          <input
            type="datetime-local"
            className={inputClass}
            value={pickupDeadline}
            onChange={(e) => setPickupDeadline(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Validade</label>
          <input
            type="datetime-local"
            className={inputClass}
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Observações</label>
        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p className="text-sm font-semibold text-danger">{error}</p>}
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
