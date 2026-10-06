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
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-canvas px-3.5 py-3 text-[15px] text-ink transition placeholder:text-ink-faint focus:border-leaf-600 focus:bg-surface focus:ring-4 focus:ring-leaf-600/15 focus:outline-none';
const labelClass = 'mb-1.5 block text-sm font-semibold text-ink-body';

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
          <img
            src={`${API_URL}${imageUrl}`}
            alt="Prévia do alimento"
            className="h-16 w-16 rounded-lg object-cover"
          />
          <button
            type="button"
            onClick={() => setValue(`items.${index}.imageUrl`, '', { shouldDirty: true })}
            className="text-xs font-semibold text-danger transition hover:underline"
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
          className="w-full text-sm text-ink-soft file:mr-3 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-leaf-800 hover:file:bg-line-strong"
        />
      )}
      {uploading && <p className="mt-1 text-xs text-ink-muted">Enviando…</p>}
      {error && <p className="mt-1 text-xs font-semibold text-danger">{error}</p>}
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
          <div key={field.id} className="rounded-[22px] border border-line bg-canvas p-5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-leaf-800">Item {index + 1}</h4>
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-xs font-semibold text-danger transition hover:underline"
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
                  <p className="mt-1.5 text-xs font-semibold text-danger">
                    {errors.items[index]?.foodName?.message}
                  </p>
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
                  <p className="mt-1.5 text-xs font-semibold text-danger">
                    {errors.items[index]?.quantity?.message}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Unidade (kg, un, L…)</label>
                <input className={inputClass} {...register(`items.${index}.unit`)} />
                {errors.items?.[index]?.unit && (
                  <p className="mt-1.5 text-xs font-semibold text-danger">
                    {errors.items[index]?.unit?.message}
                  </p>
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
          className="self-start rounded-full border-[1.5px] border-dashed border-line-bold px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-leaf-600 hover:text-leaf-800"
        >
          + Adicionar item
        </button>
      </div>

      <label className="flex items-start gap-2.5 rounded-2xl border border-line bg-canvas p-4 text-sm text-ink-soft">
        <input type="checkbox" className="mt-0.5" {...register('allowPartial')} />
        <span>
          Permitir que a ONG reserve parcialmente (escolher só alguns itens, ou parte da quantidade de cada
          um). Se desmarcado, a reserva só pode ser feita para a lista inteira, de uma vez.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Disponível a partir de</label>
          <input type="datetime-local" className={inputClass} {...register('availableAt')} />
          {errors.availableAt && (
            <p className="mt-1.5 text-xs font-semibold text-danger">{errors.availableAt.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Prazo limite de retirada</label>
          <input type="datetime-local" className={inputClass} {...register('pickupDeadline')} />
          {errors.pickupDeadline && (
            <p className="mt-1.5 text-xs font-semibold text-danger">{errors.pickupDeadline.message}</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Validade</label>
          <input type="datetime-local" className={inputClass} {...register('expiresAt')} />
          {errors.expiresAt && (
            <p className="mt-1.5 text-xs font-semibold text-danger">{errors.expiresAt.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>Observações (opcional)</label>
        <input className={inputClass} {...register('notes')} />
      </div>

      <p className="text-xs text-ink-muted">
        Lembre-se de seguir as normas sanitárias aplicáveis ao armazenamento e transporte de alimentos.
      </p>

      {serverError && (
        <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-full bg-leaf-800 px-[22px] py-2.5 text-[15px] font-bold text-canvas shadow-[0_2px_0_var(--color-leaf-900)] transition hover:bg-leaf-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Publicando…' : 'Publicar doação'}
      </button>
    </form>
  );
}
