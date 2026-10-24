import { useId, useState, type ChangeEvent } from 'react';
import { useFieldArray, useForm, type UseFormSetValue, type UseFormWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DONATION_CATEGORIES, type DonationCategory } from '@foodshare/types';
import {
  CATEGORY_LABEL,
  createDonation,
  donationDateIssues,
  uploadImage,
  type CreateDonationListInput,
  type DonationList,
} from '../lib/donations';
import { getApiErrorMessage } from '../lib/api';
import { toLocalInputValue } from '../lib/format';
import { InputField, SelectField, TextareaField } from './ui/Field';
import { Button } from './ui/Button';

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

const schema = z
  .object({
    items: z.array(itemSchema).min(1, 'Adicione pelo menos um item.'),
    allowPartial: z.boolean(),
    availableAt: z.string().min(1, 'Informe a data/hora de disponibilidade.'),
    pickupDeadline: z.string().min(1, 'Informe o prazo limite de retirada.'),
    expiresAt: z.string().min(1, 'Informe a validade.'),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    for (const issue of donationDateIssues(values)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [issue.field], message: issue.message });
    }
  });

type FormValues = z.infer<typeof schema>;

const labelClass = 'mb-1.5 block text-sm font-semibold text-ink-body';

// Sugestões, não lista fechada: o campo continua aceitando qualquer unidade.
const UNIT_SUGGESTIONS = ['kg', 'g', 'un', 'L', 'porções', 'pacotes', 'caixas', 'marmitas'];

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
  const inputId = useId();

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
      <label htmlFor={inputId} className={labelClass}>
        Foto (opcional)
      </label>
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
          id={inputId}
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

export function DonationForm({
  onCreated,
  onCancel,
}: {
  onCreated: (donationList: DonationList) => void;
  onCancel?: () => void;
}) {
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
    // "Disponível a partir de" quase sempre é agora: já vem preenchido.
    defaultValues: { items: [emptyItem], allowPartial: true, availableAt: toLocalInputValue(new Date()) },
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
              <InputField
                label="Alimento"
                placeholder="Ex.: arroz com feijão"
                error={errors.items?.[index]?.foodName?.message}
                {...register(`items.${index}.foodName`)}
              />
              <SelectField label="Categoria" {...register(`items.${index}.category`)}>
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InputField
                type="number"
                step="any"
                min={0}
                label="Quantidade"
                error={errors.items?.[index]?.quantity?.message}
                {...register(`items.${index}.quantity`)}
              />
              <InputField
                label="Unidade"
                placeholder="kg, un, L…"
                list="donation-unit-suggestions"
                error={errors.items?.[index]?.unit?.message}
                {...register(`items.${index}.unit`)}
              />
            </div>

            <div className="mt-4">
              <TextareaField
                label="Descrição (opcional)"
                rows={2}
                {...register(`items.${index}.description`)}
              />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InputField
                label="Alergênicos (opcional)"
                placeholder="Ex.: contém glúten, leite"
                {...register(`items.${index}.allergens`)}
              />
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
        <InputField
          type="datetime-local"
          label="Disponível a partir de"
          error={errors.availableAt?.message}
          {...register('availableAt')}
        />
        <InputField
          type="datetime-local"
          label="Prazo limite de retirada"
          error={errors.pickupDeadline?.message}
          {...register('pickupDeadline')}
        />
        <InputField
          type="datetime-local"
          label="Validade do alimento"
          error={errors.expiresAt?.message}
          {...register('expiresAt')}
        />
      </div>

      <InputField
        label="Observações (opcional)"
        placeholder="Ex.: retirar pela porta lateral, trazer caixa térmica"
        {...register('notes')}
      />

      <p className="text-xs text-ink-muted">
        Lembre-se de seguir as normas sanitárias aplicáveis ao armazenamento e transporte de alimentos.
      </p>

      {serverError && (
        <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger">
          {serverError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="md" loading={isSubmitting}>
          {isSubmitting ? 'Publicando…' : 'Publicar doação'}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" size="md" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>

      <datalist id="donation-unit-suggestions">
        {UNIT_SUGGESTIONS.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
    </form>
  );
}
