import { useState } from "react";
import { Link } from "react-router";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { ProductImage } from "../components/ProductImage";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "../components/ui/alert-dialog";
import { labels, stockStatus, totalStock, type ManagedProduct } from "./products";

export function StockBadge({ stock }: { stock: number }) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${stock === 0 ? "bg-destructive/10 text-destructive" : stockStatus(stock) === "Estoque baixo" ? "bg-amber-100 text-amber-900" : "bg-primary/10 text-primary"}`}>{stockStatus(stock)}</span>;
}
export function ProductList({ products, busy, error, onDelete }: { products: ManagedProduct[]; busy: boolean; error: string | null; onDelete: (id: number) => Promise<boolean> }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [audience, setAudience] = useState("");
  const [deleting, setDeleting] = useState<ManagedProduct | null>(null);
  const visible = products.filter(product => product.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")) &&
    (!category || product.category === category) && (!audience || product.public === audience));
  return <>
    <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
      <div><h1 className="font-serif text-3xl font-bold">Produtos</h1><p className="text-muted-foreground mt-1">Gerencie as peças e a disponibilidade da loja.</p></div>
      <Link to="/manager/produtos/novo" className="inline-flex gap-2 items-center rounded-lg bg-primary text-primary-foreground px-4 py-2.5 font-medium"><Plus size={18} />Novo produto</Link>
    </div>
    <div className="grid gap-3 sm:grid-cols-3 rounded-xl border border-border bg-card p-4 mb-5">
      <label className="flex flex-col gap-2 text-sm"><span className="flex items-center gap-2"><Search size={14} />Buscar por nome</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2" placeholder="Nome do produto" /></label>
      <label className="flex flex-col gap-2 text-sm"><span>Categoria</span><select aria-label="Categoria" value={category} onChange={event => setCategory(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2"><option value="">Todas as categorias</option>{[...new Set(products.map(p => p.category))].map(value => <option key={value} value={value}>{labels[value] ?? value}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm"><span>Público</span><select aria-label="Público" value={audience} onChange={event => setAudience(event.target.value)} className="h-10 w-full rounded-lg border border-border bg-background px-3 py-2"><option value="">Todos os públicos</option>{[...new Set(products.map(p => p.public))].map(value => <option key={value} value={value}>{labels[value] ?? value}</option>)}</select></label>
    </div>
    <p className="mb-3 text-sm text-muted-foreground">{visible.length} produto(s)</p>
    <div className="space-y-3">
      {visible.map(product => <article key={product.id} aria-label={product.name} className="flex flex-wrap gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 items-center">
        <ProductImage src={product.imageUrl || product.images[0]} alt={product.name} className="h-24 w-20 object-cover rounded-lg bg-muted shrink-0" />
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="font-semibold break-words">{product.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">{labels[product.category] ?? product.category} · {labels[product.public] ?? product.public}</p>
          <p className="font-semibold mt-1">{product.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
        </div>
        <div className="flex-1 min-w-0 basis-44 space-y-2">
          <div className="flex flex-wrap gap-1.5">{product.variants.map(variant => <span key={variant.value} className="text-xs rounded border border-border px-2 py-1 break-all">{variant.value}: {variant.stock}</span>)}{!product.variants.length && <span className="text-sm text-muted-foreground">Sem variantes</span>}</div>
          <div className="flex gap-2 items-center flex-wrap"><span className="text-sm">Estoque: {totalStock(product)}</span><StockBadge stock={totalStock(product)} /></div>
        </div>
        <div className="flex gap-2">
          <Link to={`/manager/produtos/${product.id}/editar`} className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"><Pencil size={15} />Editar</Link>
          <button disabled={busy} onClick={() => setDeleting(product)} className="inline-flex items-center gap-2 rounded-lg border border-destructive/25 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"><Trash2 size={15} />Excluir</button>
        </div>
      </article>)}
      {!visible.length && <div className="text-center rounded-xl border border-border bg-card py-16 text-muted-foreground">Nenhum produto encontrado.</div>}
    </div>
    <AlertDialog open={deleting !== null} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Excluir produto?</AlertDialogTitle><AlertDialogDescription>Deseja excluir “{deleting?.name}”? Suas variantes também serão removidas. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
          <button disabled={busy} className="rounded-lg bg-destructive text-white px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={async () => { if (deleting && await onDelete(deleting.id)) setDeleting(null); }}>{busy ? "Excluindo..." : "Confirmar exclusão"}</button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
