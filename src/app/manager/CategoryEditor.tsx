import { useRef, useState } from "react";
import { toast } from "sonner";
import type { Category } from "../lib/categories";

export function CategoryEditor({ category, busy, onSave, onCancel, persistent = false, settings = false }: {
  category?: Category; busy: boolean; onSave: (name: string, id?: number) => Promise<Category | null>; onCancel: () => void;
  persistent?: boolean; settings?: boolean;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const disabled = busy || submitting;
  const changed = !category || name.trim() !== category.name;
  async function save() {
    if (disabled || pending.current || !changed) return;
    if (!name.trim()) { toast.error("Informe o nome da categoria."); return; }
    pending.current = true; setSubmitting(true);
    try {
      if (await onSave(name, category?.id)) {
        if (persistent) setName(""); else onCancel();
      }
    } finally { pending.current = false; setSubmitting(false); }
  }
  return <div className={settings ? "space-y-2" : "rounded-lg border border-border bg-muted/30 p-3 space-y-3"}>
    <div className={settings ? "flex flex-wrap items-center gap-2" : "space-y-3"}>
    <label className={settings ? "block min-w-0 flex-1 basis-40 text-sm font-medium" : "block space-y-2 text-sm font-medium"}><span className={settings ? "sr-only" : undefined}>{category ? "Renomear categoria" : "Nova categoria"}</span>
      <input autoFocus={!persistent} placeholder={persistent ? "Nova categoria..." : undefined} maxLength={80} disabled={disabled} value={name} onChange={event => setName(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void save(); } }}
        className="w-full min-w-0 rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50" />
    </label>
    <div className="flex flex-wrap justify-end gap-2">
      {!persistent && <button type="button" disabled={disabled} onClick={onCancel} className="min-h-11 px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Cancelar</button>}
      <button type="button" disabled={disabled || !name.trim() || !changed} aria-busy={submitting} onClick={() => void save()} className="min-h-11 rounded-lg bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{submitting ? category ? "Salvando..." : "Adicionando..." : category ? settings ? "Salvar" : "Salvar nome" : "Adicionar"}</button>
    </div>
    </div>
  </div>;
}
