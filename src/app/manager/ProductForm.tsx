import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ProductImage } from "../components/ProductImage";
import { audiences, categories, labels, toDraft, toInput, validateDraft, type ManagedProduct, type ProductDraft, type ProductInput } from "./products";

const inputClass = "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
export function ProductForm({ product, busy, onSave, onCancel }: {
  product?: ManagedProduct; busy: boolean; onSave: (input: ProductInput) => Promise<void>; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(product));
  const [errors, setErrors] = useState<string[]>([]);
  const change = (key: keyof Omit<ProductDraft, "variants">, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  const variant = (index: number, key: "value" | "stock", value: string) => setDraft(previous => ({ ...previous,
    variants: previous.variants.map((item, i) => i === index ? { ...item, [key]: value } : item)
  }));
  const field = (label: string, key: keyof Omit<ProductDraft, "variants">, type = "text") => (
    <label className="block space-y-2 text-sm font-medium">{label}
      <input className={inputClass} value={draft[key]} onChange={event => change(key, event.target.value)} type={type}
        {...(key === "price" ? { min: "0.01", step: "any" } : {})} />
    </label>
  );
  return <form noValidate onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    const issues = validateDraft(draft);
    setErrors(issues);
    if (!issues.length) await onSave(toInput(draft));
  }} className="space-y-6">
    {errors.length > 0 && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><ul className="list-disc pl-5">{errors.map(error => <li key={error}>{error}</li>)}</ul></div>}
    <fieldset disabled={busy} className="grid min-w-0 gap-6 disabled:opacity-60 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
          <h2 className="font-semibold text-lg">Informações do produto</h2>
          {field("Nome", "name")}
          <label className="block space-y-2 text-sm font-medium">Descrição<textarea className={inputClass} rows={4} value={draft.description} onChange={event => change("description", event.target.value)} /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("Preço (R$)", "price", "number")}
            {field("Badge (opcional)", "badge")}
            <label className="block space-y-2 text-sm font-medium">Público<select aria-label="Público" className={inputClass} value={draft.public} onChange={event => change("public", event.target.value)}>
              {[...new Set([...audiences, draft.public])].map(value => <option key={value} value={value}>{labels[value] ?? value}</option>)}
            </select></label>
            <label className="block space-y-2 text-sm font-medium">Categoria<select aria-label="Categoria" className={inputClass} value={draft.category} onChange={event => change("category", event.target.value)}>
              {[...new Set([...categories, draft.category])].map(value => <option key={value} value={value}>{labels[value] ?? value}</option>)}
            </select></label>
            {field("Nome da cor", "colorName")}
            {field("Valor da cor", "colorValue")}
          </div>
        </section>
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-wrap justify-between gap-3 items-center"><h2 className="font-semibold text-lg">Variantes e estoque</h2>
            <button type="button" onClick={() => setDraft(previous => ({ ...previous, variants: [...previous.variants, { value: "", stock: "0" }] }))} className="inline-flex gap-2 items-center text-sm text-primary font-semibold"><Plus size={16} />Adicionar variante</button>
          </div>
          <p className="text-sm text-muted-foreground">Use tamanhos, numerações ou outros valores. Cada variante tem seu próprio estoque.</p>
          {draft.variants.length === 0 && <p className="text-sm text-muted-foreground">Sem variantes. O produto ficará sem estoque.</p>}
          {draft.variants.map((item, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end">
            <label className="space-y-1 text-sm">Variante {index + 1}<input className={inputClass} value={item.value} onChange={event => variant(index, "value", event.target.value)} placeholder="P, 38, Único..." /></label>
            <label className="space-y-1 text-sm">Estoque {index + 1}<input className={inputClass} type="number" min="0" max="2147483647" step="1" value={item.stock} onChange={event => variant(index, "stock", event.target.value)} /></label>
            <button type="button" aria-label={`Remover variante ${index + 1}`} className="p-3 text-destructive rounded-lg hover:bg-destructive/10" onClick={() => setDraft(previous => ({ ...previous, variants: previous.variants.filter((_, i) => i !== index) }))}><Trash2 size={18} /></button>
          </div>)}
        </section>
      </div>
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5 self-start">
        <h2 className="font-semibold text-lg">Imagens</h2>
        <ProductImage src={draft.imageUrl || draft.images.split("\n")[0]} alt="Prévia do produto" className="w-full h-56 object-contain rounded-lg bg-muted" />
        {field("Imagem principal", "imageUrl")}
        <label className="block space-y-2 text-sm font-medium">Imagens adicionais<textarea className={inputClass} rows={5} value={draft.images} onChange={event => change("images", event.target.value)} placeholder="Uma URL ou caminho por linha" /></label>
        <p className="text-xs text-muted-foreground">Informe URLs ou caminhos de imagens já disponíveis. Uma imagem adicional por linha.</p>
      </section>
    </fieldset>
    <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
      <button type="button" disabled={busy} onClick={onCancel} className="px-5 py-2.5 rounded-lg border border-border disabled:opacity-50">Cancelar</button>
      <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-50">{busy ? "Salvando..." : "Salvar produto"}</button>
    </div>
  </form>;
}
