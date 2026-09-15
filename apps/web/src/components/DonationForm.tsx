import { useState, type ChangeEvent } from 'react';
import { useFieldArray, useForm, type UseFormSetValue, type UseFormWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DONATION_CATEGORIES, type DonationCategory } from '@foodshare/types';
import {
  CATEGORY_LABEL,
  createDonation,
  uploadImage,
  type CreateDonationListInput,
  type DonationList,
} from '../lib/donations';
import { getApiErrorMessage } from '../lib/api';

const itemSchema = z.object({
  foodName: z.string().min(2, 'Informe o nome do alimento.'),
  // Derivado da lista compartilhada: adicionar categoria não exige mexer aqui.
  category: z.enum(DONATION_CATEGORIES as [DonationCategory, ...DonationCategory[]]),
  description: z.string().optional(),
  quantity: z.coerce.number().positive('A quantidade deve ser maior que zero.'),
  unit: z.string().min(1, 'Informe a unidade (kg, un, L...).'),
  allergens: z.string().optional(),
  imageUrl: z.string().optional(),
});

const schema = z.object({
  items: z.array(itemSchema).min(1, 'Adicione pelo menos um item.'),
  allowPartial: z.boolean(),
  availableAt: z.string().min(1, 'Informe a data/hora de disponibilidade.'),
  pickupDeadline: z.string().min(1, 'Informe o prazo limite de retirada.'),
  expiresAt: z.string().min(1, 'Informe a validade.'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const inputClass =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-neutral-700 dark:bg-neutral-900';
const labelClass = 'mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300';

const emptyItem = {
  foodName: '',
  category: 'PREPARED_MEALS' as const,
  description: '',
  quantity: 1,
  unit: '',
  allergens: '',
  imageUrl: '',
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Upload da foto do item. O arquivo sobe assim que é escolhido e o formulário
 * guarda só a URL, então publicar a doação continua sendo uma única requisição.
 */
function ItemImageField({
  index,
  setValue,
  watch,
}: {
  index: number;
  setValue: UseFormSetValue<FormValues>;
  watch: UseFormWatch<FormValues>;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageUrl = watch(`items.${index}.imageUrl`);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setValue(`items.${index}.imageUrl`, url, { shouldDirty: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Não foi possível enviar a imagem.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className={labelClass}>Foto (opcional)</label>
      {imageUrl ? (
        <div className="flex items-center gap-3">
          <img src={`${API_URL}${imageUrl}`} alt="Prévia do alimento" className="h-16 w-16 rounded-lg object-cover" />
          <button
            type="button"
            onClick={() => setValue(`items.${index}.imageUrl`, '', { shouldDirty: true })}
            className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
          >
            Remover
          </button>
        </div>
      ) : (
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleChange}
          disabled={uploading}
          className="w-full text-sm text-neutral-600 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-neutral-200 dark:text-neutral-400 dark:file:bg-neutral-800"
        />
      )}
      {uploading && <p className="mt-1 text-xs text-neutral-500">Enviando…</p>}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function DonationForm({ onCreated }: { onCreated: (donationList: DonationList) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { items: [emptyItem], allowPartial: true },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    const input: CreateDonationListInput = {
      ...values,
      availableAt: new Date(values.availableAt).toISOString(),
      pickupDeadline: new Date(values.pickupDeadline).toISOString(),
      expiresAt: new Date(values.expiresAt).toISOString(),
    };
    try {
      const donationList = await createDonation(input);
      onCreated(donationList);
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Não foi possível publicar a doação.'));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <div key={field.id} className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Item {index + 1}</h4>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                >
                  Remover
                </button>
              )}
            </div>

            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Alimento</label>
                <input className={inputClass} {...register(`items.${index}.foodName`)} />
                {errors.items?.[index]?.foodName && (
                  <p className="mt-1 text-sm text-red-600">{errors.items[index]?.foodName?.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Categoria</label>
                <select className={inputClass} {...register(`items.${index}.category`)}>
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Quantidade</label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  className={inputClass}
                  {...register(`items.${index}.quantity`)}
                />
                {errors.items?.[index]?.quantity && (
                  <p className="mt-1 text-sm text-red-600">{errors.items[index]?.quantity?.message}</p>
                )}
              </div>
              <div>
                <label className={labelClass}>Unidade (kg, un, L…)</label>
                <input className={inputClass} {...register(`items.${index}.unit`)} />
                {errors.items?.[index]?.unit && (
                  <p className="mt-1 text-sm text-red-600">{errors.items[index]?.unit?.message}</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className={labelClass}>Descrição (opcional)</label>
              <textarea className={inputClass} rows={2} {...register(`items.${index}.description`)} />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Alergênicos (opcional)</label>
                <input
                  className={inputClass}
                  placeholder="Ex.: contém glúten, leite"
                  {...register(`items.${index}.allergens`)}
                />
              </div>
              <ItemImageField index={index} setValue={setValue} watch={watch} />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => append(emptyItem)}
          className="self-start rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:border-brand-500 hover:text-brand-600 dark:border-neutral-700 dark:text-neutral-400"
        >
          + Adicionar item
        </button>
      </div>

      <label className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 text-sm dark:border-neutral-800">
        <input type="checkbox" className="mt-0.5" {...register('allowPartial')} />
        <span>
          Permitir que a ONG reserve parcialmente (escolher só alguns itens, ou parte da quantidade de cada um). Se
          desmarcado, a reserva só pode ser feita para a lista inteira, de uma vez.
        </span>
      </label>

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
