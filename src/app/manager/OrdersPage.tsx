import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { toast } from "sonner";
import { notify } from "../lib/notifications";
import { createManagerApi, ManagerApiError } from "./api";
import { orderStatusLabels, orderStatusLabel, orderAction, canCancelOrder, orderCancellationDescription, orderMoney, orderDate, type OrderQuery, type OrderPage, type OrderDetails, type OrderStatus, type StockConflict } from "./orders";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "../components/ui/alert-dialog";
import { useSearchParams } from "react-router";
const action = "min-h-11 rounded-lg px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed";
function Status({ status, fulfillmentMethod }: Pick<OrderDetails, "status" | "fulfillmentMethod">) {
  return <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${status === "CANCELLED" ? "bg-destructive/10 text-destructive" : status === "PENDING_CONFIRMATION" ? "bg-muted text-foreground" : "bg-primary/10 text-primary"}`}>{orderStatusLabel(status, fulfillmentMethod)}</span>;
}
export function OrdersPage({ token, onUnauthorized, onConfirmed, onBusy }: {
  token: string; onUnauthorized: (message: string) => void; onConfirmed: () => void; onBusy: (busy: boolean) => void;
}) {
  const api = useMemo(() => createManagerApi(token, import.meta.env.VITE_API_URL || "/api"), [token]);
  const [searchParams, setSearchParams] = useSearchParams();
  const callbacks = useRef({ onUnauthorized, onConfirmed, onBusy }); callbacks.current = { onUnauthorized, onConfirmed, onBusy };
  const [query, setQuery] = useState<OrderQuery>(() => {
    const status = searchParams.get("status") ?? "";
    const sort = searchParams.get("sort"); const direction = searchParams.get("direction"); const page = Number(searchParams.get("page"));
    return { search: searchParams.get("search") ?? "", status: Object.hasOwn(orderStatusLabels, status) ? status as OrderStatus : "", sort: sort === "number" ? "number" : "date", direction: direction === "asc" ? "asc" : "desc", page: Number.isSafeInteger(page) && page > 0 ? page : 1 };
  });
  const [result, setResult] = useState<OrderPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<OrderDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRevision, setDetailRevision] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [conflicts, setConflicts] = useState<StockConflict[]>([]);
  const pending = useRef(false);
  const mounted = useRef(true);
  const lastSearch = useRef("");
  const confirmationRequest = useRef<AbortController | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  const openedFrom = useRef<HTMLButtonElement | null>(null);
  const detailDialog = useRef<HTMLDivElement | null>(null);
  const confirmButton = useRef<HTMLButtonElement | null>(null);
  const listSection = useRef<HTMLElement | null>(null);
  const listHeight = useRef(192);
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    for (const key of ["status", "search", "sort", "direction", "page"]) next.delete(key);
    if (query.status) next.set("status", query.status);
    if (query.search.trim()) next.set("search", query.search.trim());
    next.set("sort", query.sort); next.set("direction", query.direction); next.set("page", String(query.page));
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [query, searchParams, setSearchParams]);
  function failure(reason: unknown) {
    if (reason instanceof ManagerApiError && [401, 403].includes(reason.status)) callbacks.current.onUnauthorized(reason.message);
    return reason instanceof Error ? reason.message : "Não foi possível concluir a operação.";
  }
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; confirmationRequest.current?.abort(); callbacks.current.onBusy(false); }; }, []);
  useEffect(() => {
    const request = new AbortController();
    listHeight.current = Math.max(192, listSection.current?.getBoundingClientRect().height ?? 192);
    setLoading(true); setError("");
    const timer = setTimeout(() => {
      lastSearch.current = query.search;
      api.orders(query, request.signal).then(data => {
        if (!request.signal.aborted) { setResult(data); if (data.page !== query.page) setQuery(old => ({ ...old, page: data.page })); }
      }).catch(reason => { if (!request.signal.aborted) setError(failure(reason)); })
        .finally(() => { if (!request.signal.aborted) setLoading(false); });
    }, query.search !== lastSearch.current ? 300 : 0);
    return () => { clearTimeout(timer); request.abort(); };
  }, [api, query, revision]);
  useEffect(() => {
    if (selected === null) return;
    const request = new AbortController(); setDetail(null); setDetailLoading(true); setDetailError(""); setConfirmError(""); setConflicts([]);
    api.order(selected, request.signal).then(data => { if (!request.signal.aborted) setDetail(data); })
      .catch(reason => { if (!request.signal.aborted) setDetailError(failure(reason)); })
      .finally(() => { if (!request.signal.aborted) setDetailLoading(false); });
    return () => request.abort();
  }, [api, selected, detailRevision]);
  function sort(field: OrderQuery["sort"]) {
    setQuery(old => ({ ...old, page: 1, sort: field, direction: old.sort === field && old.direction === "asc" ? "desc" : "asc" }));
  }
  async function updateOrder() {
    if (pending.current || !detail || (cancelling ? !canCancelOrder(detail.status) : !orderAction(detail))) return;
    pending.current = true; setBusy(true); callbacks.current.onBusy(true); setConfirmError(""); setConflicts([]);
    const request = new AbortController(); confirmationRequest.current = request;
    try {
      const isConfirmation = !cancelling && detail.status === "PENDING_CONFIRMATION";
      const updated = cancelling && canCancelOrder(detail.status)
        ? await api.cancelOrder(detail.id, detail.status, request.signal)
        : isConfirmation
        ? await api.confirmOrder(detail.id, request.signal)
        : await api.advanceOrder(detail.id, detail.status as "PREPARING" | "READY_OR_SHIPPED", request.signal);
      if (!mounted.current) return;
      setDetail(old => old?.id === updated.id ? { ...old, ...updated } : old);
      setConfirming(false); setCancelling(false); setArchiving(false); setRevision(old => old + 1);
      if (isConfirmation || (cancelling && detail.status !== "PENDING_CONFIRMATION")) callbacks.current.onConfirmed();
      notify.positive(cancelling ? "Pedido cancelado com sucesso!" : isConfirmation ? "Pedido confirmado com sucesso!" : "Status do pedido atualizado com sucesso!");
      setArchiving(false);
    } catch (reason) {
      if (!mounted.current) return;
      const message = failure(reason); setConfirmError(message); setConfirming(false); setCancelling(false); setArchiving(false); toast.error(message);
      if (reason instanceof ManagerApiError && reason.conflicts?.length) setConflicts(reason.conflicts);
      else {
        // A response can be lost after commit or another admin can have changed it.
        // Re-read server state before offering another action.
        try { const current = await api.order(detail.id, request.signal); if (mounted.current) {
          setDetail(current); setRevision(old => old + 1);
          if (cancelling && detail.status !== "PENDING_CONFIRMATION" && current.status === "CANCELLED") callbacks.current.onConfirmed();
        } }
        catch (refreshError) { if (mounted.current) { setDetail(null); setDetailError(failure(refreshError)); } }
      }
    } finally {
      pending.current = false; confirmationRequest.current = null;
      if (mounted.current) { setBusy(false); callbacks.current.onBusy(false); }
    }
  }
  async function archiveSelected() {
    if (pending.current || !detail) return;
    pending.current = true; setBusy(true); callbacks.current.onBusy(true);
    try { await api.archiveOrder(detail.id); if (!mounted.current) return; setConfirming(false); setArchiving(false); setSelected(null); setRevision(value => value + 1); notify.positive(`Pedido #${detail.number} arquivado.`); callbacks.current.onConfirmed(); }
    catch (reason) { if (mounted.current) { const message = failure(reason); setConfirmError(message); toast.error(message); } }
    finally { pending.current = false; if (mounted.current) { setBusy(false); callbacks.current.onBusy(false); } }
  }

  return <>
    <header className="mb-6"><h1 className="font-serif text-3xl font-bold">Pedidos</h1><p className="text-muted-foreground mt-1">Confira os pedidos e confirme a disponibilidade dos produtos.</p></header>
    <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border bg-card p-4 mb-5">
      <label className="flex flex-col gap-2 text-sm"><span className="flex items-center gap-2"><Search size={14} aria-hidden="true" />Pesquisar pedidos</span><input ref={searchInput} type="search" maxLength={100} value={query.search} onChange={event => setQuery(old => ({ ...old, search: event.target.value, page: 1 }))} placeholder="Número ou nome do cliente" className="min-h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary" /></label>
      <label className="flex flex-col gap-2 text-sm"><span>Status</span><select aria-label="Status" value={query.status} onChange={event => setQuery(old => ({ ...old, status: event.target.value as OrderStatus | "", page: 1 }))} className="min-h-11 min-w-0 w-full rounded-lg border border-border bg-background px-3 py-2 focus-visible:outline-2 focus-visible:outline-primary"><option value="">Todos</option>{Object.entries(orderStatusLabels).map(([value, label]) => <option key={value} value={value}>{label === "Finalizado" ? "Finalizados" : label === "Cancelado" ? "Cancelados" : label}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap gap-2 items-center mb-4" aria-label="Ordenação de pedidos"><span className="text-sm text-muted-foreground">Ordenar por:</span>{(["number", "date"] as const).map(field => {
      const active = query.sort === field; const Icon = active ? query.direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
      const label = field === "number" ? "Número" : "Data";
      return <button key={field} type="button" onClick={() => sort(field)} aria-pressed={active} aria-label={`Ordenar por ${label.toLowerCase()}${active ? `: ${query.direction === "asc" ? "crescente" : "decrescente"}` : ""}`} className={`${action} inline-flex items-center gap-2 border border-border ${active ? "bg-primary/10 text-primary" : "bg-card"}`}>{label}<Icon size={16} aria-hidden="true" /></button>;
    })}</div>
    <section ref={listSection} style={{ minHeight: loading ? listHeight.current : 192 }} aria-label="Lista de pedidos" aria-busy={loading} className="min-h-48 space-y-3">
      {loading ? <p role="status" className="py-16 text-center text-muted-foreground">Carregando pedidos...</p> : error ? <div role="alert" className="rounded-xl border border-destructive/20 bg-card p-5"><p className="text-destructive">{error}</p><button type="button" onClick={() => setRevision(old => old + 1)} className={`${action} text-primary underline`}>Tentar novamente</button></div> : result?.items.length ? result.items.map(order => <article key={order.id} aria-label={`Pedido #${order.number}`} className="rounded-xl border border-border bg-card p-4 sm:p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto] items-center">
        <div className="min-w-0"><h2 className="font-semibold">#{order.number}</h2><p className="text-sm mt-1 break-words">{order.customerName}</p><p className="text-sm text-muted-foreground mt-1">{orderDate(order.createdAt)} · {order.fulfillmentMethod === "DELIVERY" ? "Entrega" : "Retirada"}</p></div>
        <div className="min-w-0 space-y-2"><p className="font-semibold break-words">{orderMoney(order.total)}</p><Status status={order.status} fulfillmentMethod={order.fulfillmentMethod} /></div>
        <button type="button" onClick={event => { openedFrom.current = event.currentTarget; setSelected(order.id); }} className={`${action} text-primary underline justify-self-start sm:col-span-2 lg:col-span-1`}>Ver detalhes<span className="sr-only"> do pedido #{order.number}</span></button>
      </article>) : <p className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">{query.search.trim() || query.status ? "Nenhum pedido corresponde aos filtros selecionados." : "Nenhum pedido encontrado."}</p>}
    </section>
    {result && !error && <div className="flex flex-wrap items-center justify-center gap-2 mt-5" aria-label="Paginação"><button type="button" disabled={loading || result.page <= 1} onClick={() => setQuery(old => ({ ...old, page: old.page - 1 }))} className={`${action} border border-border`}>Anterior</button><p className="text-sm" aria-live="polite">Página {result.page} de {result.totalPages}</p><button type="button" disabled={loading || result.page >= result.totalPages} onClick={() => setQuery(old => ({ ...old, page: old.page + 1 }))} className={`${action} border border-border`}>Próxima</button><p className="w-full text-center text-xs text-muted-foreground">{result.total} pedido(s)</p></div>}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open && !pending.current) { setSelected(null); setConfirming(false); setArchiving(false); setCancelling(false); setConfirmError(""); setConflicts([]); } }}>
      <DialogContent onCloseAutoFocus={event => { event.preventDefault(); (openedFrom.current?.isConnected ? openedFrom.current : searchInput.current)?.focus(); }} className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl min-w-0 break-words" onEscapeKeyDown={event => { if (pending.current) event.preventDefault(); }} onInteractOutside={event => { if (pending.current) event.preventDefault(); }}>
        <div ref={detailDialog} tabIndex={-1}><DialogHeader><DialogTitle>{detail ? `Pedido #${detail.number}` : "Detalhes do pedido"}</DialogTitle><DialogDescription>Dados históricos registrados na criação do pedido.</DialogDescription></DialogHeader></div>
        {detailLoading ? <p role="status" className="py-12 text-center">Carregando detalhes...</p> : detailError ? <div role="alert"><p className="text-destructive">{detailError}</p><button type="button" onClick={() => setDetailRevision(old => old + 1)} className={`${action} text-primary underline`}>Tentar carregar detalhes novamente</button></div> : detail && <>
          <Status status={detail.status} fulfillmentMethod={detail.fulfillmentMethod} />
          <dl className="grid gap-3 sm:grid-cols-2 text-sm"><div><dt className="text-muted-foreground">Cliente</dt><dd>{detail.customerName}</dd></div><div><dt className="text-muted-foreground">Data e horário</dt><dd>{orderDate(detail.createdAt, true)}</dd></div><div><dt className="text-muted-foreground">Recebimento</dt><dd>{detail.fulfillmentMethod === "DELIVERY" ? "Entrega" : "Retirada na loja"}</dd></div></dl>
          <section><h3 className="font-semibold mb-2">{detail.fulfillmentMethod === "DELIVERY" ? "Endereço de entrega" : "Local de retirada"}</h3>{(() => {
            const address = detail.fulfillmentMethod === "DELIVERY" ? detail.deliveryAddress : detail.pickupAddress;
            return address ? <address className="not-italic text-sm leading-6">{address.street}, {address.number}{address.complement && <><br />{address.complement}</>}<br />{address.neighborhood}<br />{address.city} - {address.state}<br />CEP {address.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}</address> : <p className="text-sm text-muted-foreground">Endereço não registrado neste pedido.</p>;
          })()}</section>
          <section aria-label="Itens do pedido"><h3 className="font-semibold mb-3">Itens</h3><div className="space-y-3">{detail.items.map(item => <article key={item.id} className="rounded-lg border border-border p-3 text-sm"><h4 className="font-medium">{item.quantity}x {item.productName}</h4><p className="mt-1">Cor: {item.colorName}</p><p>Tamanho: {item.size}</p><p className="mt-2">Unitário: {orderMoney(item.unitPrice)}</p><p className="font-semibold">Subtotal: {orderMoney(item.subtotal)}</p></article>)}</div></section>
          <p className="font-semibold text-lg">Total dos produtos: {orderMoney(detail.total)}</p>
          {confirmError && <div role="alert" className="rounded-lg bg-destructive/10 text-destructive p-4 text-sm"><p>{confirmError}</p>{conflicts.length > 0 && <><p className="font-semibold mt-3">Estoque insuficiente:</p>{conflicts.map((conflict, index) => <div key={`${conflict.variantId}-${index}`} className="mt-3"><p className="font-medium">{conflict.productName}</p><p>Cor: {conflict.colorName}</p><p>Tamanho: {conflict.size}</p><p>Solicitado: {conflict.requested}</p><p>Disponível: {conflict.available}</p></div>)}</>}</div>}
          <div className="flex flex-wrap gap-3">
            {orderAction(detail) && <button type="button" disabled={busy} onClick={event => { confirmButton.current = event.currentTarget; setCancelling(false); setConfirming(true); }} className={`${action} max-w-full whitespace-normal bg-primary text-primary-foreground`}>{busy && !cancelling ? detail.status === "PENDING_CONFIRMATION" ? "Confirmando..." : "Atualizando..." : orderAction(detail)?.label}</button>}
            {canCancelOrder(detail.status) && <button type="button" disabled={busy} onClick={event => { confirmButton.current = event.currentTarget; setCancelling(true); setConfirming(true); }} className={`${action} max-w-full whitespace-normal border border-destructive/30 text-destructive`}>{busy && cancelling ? "Cancelando..." : "Cancelar pedido"}</button>}
            {!detail.archivedAt && <button type="button" disabled={busy} onClick={event => { confirmButton.current = event.currentTarget; setArchiving(true); setConfirming(true); }} className={`${action} border border-border`}>Arquivar pedido</button>}

          </div>
        </>}
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirming} onOpenChange={open => { if (!pending.current) { setConfirming(open); if (!open) { setArchiving(false); setCancelling(false); } } }}>
      <AlertDialogContent onCloseAutoFocus={event => { event.preventDefault(); (confirmButton.current?.isConnected ? confirmButton.current : detailDialog.current)?.focus(); }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{archiving ? `Arquivar o pedido #${detail?.number}?` : cancelling ? `Cancelar o pedido #${detail?.number}?` : detail && orderAction(detail)?.title}</AlertDialogTitle>
          <AlertDialogDescription>{archiving ? "O pedido será ocultado da listagem operacional. Seus dados históricos e itens serão preservados; estoque e status não serão alterados." : cancelling && detail && canCancelOrder(detail.status) ? orderCancellationDescription(detail.status) : detail?.status === "PENDING_CONFIRMATION" ? "Ao confirmar, o estoque das variantes deste pedido será reduzido." : "Confirme a atualização do status deste pedido."}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelling ? "Voltar" : "Cancelar"}</AlertDialogCancel>
          <button type="button" disabled={busy} onClick={archiving ? archiveSelected : updateOrder} className={`${action} max-w-full whitespace-normal ${cancelling || archiving ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}>{busy ? archiving ? "Arquivando..." : cancelling ? "Cancelando..." : detail?.status === "PENDING_CONFIRMATION" ? "Confirmando..." : "Atualizando..." : archiving ? "Arquivar pedido" : cancelling ? "Cancelar pedido" : detail && orderAction(detail)?.label}</button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
