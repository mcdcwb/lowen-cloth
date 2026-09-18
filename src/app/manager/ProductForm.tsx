import { useEffect, useId, useRef, useState } from "react";
import { Pipette, Plus, Trash2 } from "lucide-react";
import { ProductImage } from "../components/ProductImage";
import { audiences, categories, labels, normalizeHex, toDraft, toInput, validateDraft, type ManagedProduct, type ProductDraft, type ProductInput } from "./products";

type EyeDropperConstructor = new () => { open: (options?: { signal: AbortSignal }) => Promise<{ sRGBHex: string }> };

const inputClass = "w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
export function ProductForm({ product, busy, onSave, onCancel }: {
  product?: ManagedProduct; busy: boolean; onSave: (input: ProductInput) => Promise<void>; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(product));
  const [errors, setErrors] = useState<string[]>([]);
  const colorId = useId();
  const previewRef = useRef<HTMLDivElement>(null);
  const selection = useRef<AbortController | null>(null);
  const [picking, setPicking] = useState(false);
  const [colorNotice, setColorNotice] = useState("");
  const EyeDropper = (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper;
  const supportsEyeDropper = typeof EyeDropper === "function";
  const imageSource = draft.imageUrl.trim() || draft.images.split(/\r?\n/).find(value => value.trim())?.trim();
  const hex = normalizeHex(draft.colorValue);
  useEffect(() => () => selection.current?.abort(), []);
  const change = (key: keyof Omit<ProductDraft, "variants">, value: string) => setDraft(previous => ({ ...previous, [key]: value }));
  async function pickFromImage() {
    if (!supportsEyeDropper || busy || selection.current || !imageSource) return;
    const controller = new AbortController();
    selection.current = controller;
    setPicking(true);
    setColorNotice("Clique na região desejada da prévia. Esc cancela a seleção.");
    try {
      // Keep open() in the click gesture; awaiting a scroll would lose user activation.
      previewRef.current?.scrollIntoView({ behavior: "instant", block: "center" });
      const result = await new EyeDropper().open({ signal: controller.signal });
      if (controller.signal.aborted) return;
      const selected = normalizeHex(result.sRGBHex);
      if (!selected) throw new Error("Invalid color");
      change("colorValue", selected);
      setColorNotice(`Cor selecionada: ${selected}.`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setColorNotice(error instanceof DOMException && error.name === "AbortError"
        ? "Seleção cancelada. A cor foi mantida."
        : "Não foi possível selecionar a cor. Use o seletor de cores ou informe o HEX.");
    } finally {
      if (!controller.signal.aborted) { selection.current = null; setPicking(false); }
    }
  }
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
    if (busy || picking) return;
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
            <div className="min-w-0 space-y-2 text-sm font-medium">
              <label htmlFor={colorId}>Valor da cor</label>
              <div className="flex items-center gap-2">
                <input type="color" aria-label="Seletor de cor" value={hex ?? "#000000"}
                  onChange={event => { change("colorValue", normalizeHex(event.target.value)!); setColorNotice(""); }}
                  className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-border bg-card p-1" />
                <input id={colorId} className={inputClass + " min-w-0 font-mono"} placeholder="#1F2937" value={draft.colorValue}
                  aria-describedby={`${colorId}-hint`} aria-invalid={Boolean(draft.colorValue.trim() && !hex)}
                  onChange={event => { change("colorValue", normalizeHex(event.target.value) ?? event.target.value); setColorNotice(""); }} />
              </div>
              <button type="button" onClick={pickFromImage} disabled={picking || !supportsEyeDropper || !imageSource}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed">
                <Pipette size={16} aria-hidden="true" />{picking ? "Selecionando..." : "Selecionar na imagem"}
              </button>
              <p id={`${colorId}-hint`} className="text-xs font-normal text-muted-foreground">
                {!supportsEyeDropper ? "Conta-gotas indisponível neste navegador. Use o seletor ou o HEX." : !imageSource ? "Adicione uma imagem para usar o conta-gotas." : "Selecione uma região da prévia do produto. Esc cancela."}
              </p>
              {colorNotice && <p role="status" className="text-xs font-normal text-muted-foreground">{colorNotice}</p>}
            </div>
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
        <div ref={previewRef}><ProductImage src={imageSource} alt="Prévia do produto" className="w-full h-56 object-contain rounded-lg bg-muted" /></div>
        {field("Imagem principal", "imageUrl")}
        <label className="block space-y-2 text-sm font-medium">Imagens adicionais<textarea className={inputClass} rows={5} value={draft.images} onChange={event => change("images", event.target.value)} placeholder="Uma URL ou caminho por linha" /></label>
        <p className="text-xs text-muted-foreground">Informe URLs ou caminhos de imagens já disponíveis. Uma imagem adicional por linha.</p>
      </section>
    </fieldset>
    <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-5">
      <button type="button" disabled={busy} onClick={onCancel} className="px-5 py-2.5 rounded-lg border border-border disabled:opacity-50">Cancelar</button>
      <button type="submit" disabled={busy || picking} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold disabled:opacity-50">{busy ? "Salvando..." : "Salvar produto"}</button>
    </div>
  </form>;
}
