import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createDonation, type CreateDonationInput, type Donation } from '../lib/donations';
import { getApiErrorMessage } from '../lib/api';

const schema = z.object({
  foodName: z.string().min(2, 'Informe o nome do alimento.'),
  category: z.enum([
    'PREPARED_MEALS',
    'FRUITS',
    'VEGETABLES',
    'LEGUMES',
    'PACKAGED_GOODS',
    'BAKERY',
    'BEVERAGES',
    'OTHER',
  ]),
  description: z.string().optional(),
  quantity: z.coerce.number().positive('A quantidade deve ser maior que zero.'),
  unit: z.string().min(1, 'Informe a unidade (kg, un, L...).'),
  availableAt: z.string().min(1, 'Informe a data/hora de disponibilidade.'),
  pickupDeadline: z.string().min(1, 'Informe o prazo limite de retirada.'),
  expiresAt: z.string().min(1, 'Informe a validade.'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-neutral-700 dark:bg-neutral-900';
const labelClass = 'mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300';

export function DonationForm({ onCreated }: { onCreated: (donation: Donation) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { category: 'PREPARED_MEALS' } });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const input: CreateDonationInput = {
      ...values,
      availableAt: new Date(values.availableAt).toISOString(),
      pickupDeadline: new Date(values.pickupDeadline).toISOString(),
      expiresAt: new Date(values.expiresAt).toISOString(),
    };
    try {
      const donation = await createDonation(input);
      onCreated(donation);
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Não foi possível publicar a doação.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Alimento</label>
          <input className={inputClass} {...register('foodName')} />
          {errors.foodName && <p className="mt-1 text-sm text-red-600">{errors.foodName.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Categoria</label>
          <select className={inputClass} {...register('category')}>
            <option value="PREPARED_MEALS">Alimentos preparados</option>
            <option value="FRUITS">Frutas</option>
            <option value="VEGETABLES">Verduras</option>
            <option value="LEGUMES">Legumes</option>
            <option value="PACKAGED_GOODS">Produtos industrializados</option>
            <option value="BAKERY">Padaria</option>
            <option value="BEVERAGES">Bebidas</option>
            <option value="OTHER">Outros</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Quantidade</label>
          <input type="number" step="any" min={0} className={inputClass} {...register('quantity')} />
          {errors.quantity && <p className="mt-1 text-sm text-red-600">{errors.quantity.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Unidade (kg, un, L…)</label>
          <input className={inputClass} {...register('unit')} />
          {errors.unit && <p className="mt-1 text-sm text-red-600">{errors.unit.message}</p>}
        </div>
      </div>

      <div>
        <label className={labelClass}>Descrição (opcional)</label>
        <textarea className={inputClass} rows={2} {...register('description')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Disponível a partir de</label>
          <input type="datetime-local" className={inputClass} {...register('availableAt')} />
          {errors.availableAt && <p className="mt-1 text-sm text-red-600">{errors.availableAt.message}</p>}
        </div>
        <div>
          <label className={labelClass}>Prazo limite de retirada</label>
          <input type="datetime-local" className={inputClass} {...register('pickupDeadline')} />
          {errors.pickupDeadline && (
            <p className="mt-1 text-sm text-red-600">{errors.pickupDeadline.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Validade</label>
          <input type="datetime-local" className={inputClass} {...register('expiresAt')} />
          {errors.expiresAt && <p className="mt-1 text-sm text-red-600">{errors.expiresAt.message}</p>}
        </div>
      </div>

      <div>
        <label className={labelClass}>Observações (opcional)</label>
        <input className={inputClass} {...register('notes')} />
      </div>

      <p className="text-xs text-neutral-500">
        Lembre-se de seguir as normas sanitárias aplicáveis ao armazenamento e transporte de alimentos.
      </p>

      {serverError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {isSubmitting ? 'Publicando…' : 'Publicar doação'}
      </button>
    </form>
  );
}
