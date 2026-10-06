import { StoreDetailsForm } from "./StoreDetailsForm";
import { OrdersPage } from "./OrdersPage";
import { useState } from "react";
import { CategoryManagement } from "./CategoryManagement";
import { Link, NavLink, useLocation, useNavigate } from "react-router";
import { LayoutDashboard, Package, ClipboardList, ArrowUpRight, ArrowRight, LogOut, Settings } from "lucide-react";
import type { Account } from "../lib/auth";
import { ProductList } from "./ProductList";
import { ProductForm } from "./ProductForm";
import { useManagerProducts } from "./useManagerProducts";
import { productStats } from "./products";
import { useManagerSettings } from "./useManagerSettings";
import { SettingsPage } from "./SettingsPage";

interface Props {
  user: Account | null; token?: string; validating: boolean; sessionError: string | null;
  onLogin: () => void; onLogout: () => void; onUnauthorized: (message: string) => void; onChanged: () => void;
}
export function Manager(props: Props) {
  if (props.validating) return <main className="min-h-screen bg-background grid place-items-center"><p role="status">Validando sessão...</p></main>;
  if (!props.user || props.user.role !== "ADMIN" || !props.token) return <main className="min-h-screen bg-background flex items-center justify-center p-5">
    <section className="w-full max-w-lg bg-card border border-border rounded-xl p-8 space-y-5">
      <p className="text-sm tracking-widest text-primary">LÖWEN · ADMINISTRAÇÃO</p>
      <h1 className="font-serif text-3xl font-bold">{props.user ? "Acesso restrito" : "Acesso administrativo"}</h1>
      <p className="text-muted-foreground">{props.user ? "Esta área é exclusiva para administradores." : "Entre com sua conta de administrador para continuar."}</p>
      {props.sessionError && <p role="alert" className="text-destructive text-sm">{props.sessionError}</p>}
      <div className="flex flex-wrap gap-4 items-center">{!props.user && <button onClick={props.onLogin} className="rounded-lg bg-primary text-primary-foreground px-5 py-2.5">Entrar</button>}<Link to="/" className="inline-flex px-3 py-2.5 text-lg font-medium text-primary underline underline-offset-4">← Voltar para a loja</Link></div>
    </section>
  </main>;
  return <ManagerWorkspace key={props.token} {...props} user={props.user} token={props.token} />;
}

function ManagerWorkspace({ user, token, onLogout, onUnauthorized, onChanged }: Props & { user: Account; token: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const data = useManagerProducts(token, onUnauthorized, onChanged);
  const path = location.pathname.replace(/\/$/, "");
  const [storeSaving, setStoreSaving] = useState(false);
  const [orderSaving, setOrderSaving] = useState(false);
  const settings = useManagerSettings(token, path, onUnauthorized);
  const edit = /^\/manager\/produtos\/(\d+)\/editar$/.exec(path);
  const isNew = path === "/manager/produtos/novo";
  const product = edit ? data.products.find(item => item.id === Number(edit[1])) : undefined;
  const stats = settings.threshold === null ? null : productStats(data.products, settings.threshold);
  const navigation = [
    { to: "/manager", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/manager/produtos", label: "Produtos", icon: Package, end: false },
    { to: "/manager/pedidos", label: "Pedidos", icon: ClipboardList, end: true },
    { to: "/manager/settings", label: "Configurações", icon: Settings, end: true }
  ];
  return <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="lg:sticky lg:top-0 lg:h-screen bg-card border-b lg:border-b-0 lg:border-r border-border p-5 flex flex-col">
      <div className="mb-5 lg:mb-9"><span className="font-serif text-2xl tracking-[0.2em] text-primary">LÖWEN</span><p className="text-xs tracking-widest text-muted-foreground mt-1">ADMINISTRAÇÃO</p></div>
      <nav aria-label="Navegação administrativa" className="flex flex-wrap lg:flex-col gap-2">
        {navigation.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={event => { if (data.busy || settings.saving || storeSaving || orderSaving) event.preventDefault(); }} className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}><Icon size={18} />{label}</NavLink>)}
        <hr className="w-full border-border my-2 lg:my-5" />
        <Link to="/" onClick={event => { if (data.busy || settings.saving || storeSaving || orderSaving) event.preventDefault(); }} className="flex items-center gap-2 px-3 py-3 text-base font-medium text-muted-foreground hover:text-primary"><ArrowUpRight size={20} />Ver loja</Link>
        <button disabled={data.busy || settings.saving || storeSaving || orderSaving} onClick={onLogout} className="flex items-center gap-2 px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive disabled:opacity-50"><LogOut size={18} />Sair</button>
      </nav>
      <div className="mt-5 lg:mt-auto pt-5 border-t border-border text-xs text-muted-foreground break-all"><p className="font-medium text-foreground">{user.name}</p><p className="mt-1">{user.email}</p></div>
    </aside>
    <main className="min-w-0 w-full max-w-7xl mx-auto p-4 sm:p-8 lg:p-10">
      {path !== "/manager/pedidos" && data.error && <div role="alert" className="mb-5 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 text-sm"><p>{data.error}</p><button disabled={data.busy} onClick={data.reload} className="underline mt-2">Atualizar lista</button></div>}
      {path === "/manager/pedidos" ? <OrdersPage token={token} onUnauthorized={onUnauthorized} onBusy={setOrderSaving} onConfirmed={() => { data.reload(); onChanged(); }} /> : settings.loading ? <p role="status" className="py-20 text-center text-muted-foreground">Carregando configurações...</p> : settings.error || settings.threshold === null || !stats ? <div role="alert" className="rounded-xl border border-destructive/20 bg-card p-6"><p>{settings.error || "Configurações indisponíveis."}</p><button type="button" onClick={settings.reload} className="min-h-11 text-primary underline">Tentar novamente</button></div> : path === "/manager/settings" ? <><SettingsPage threshold={settings.threshold} saving={settings.saving || storeSaving} onSave={settings.save} /><StoreDetailsForm disabled={settings.saving || data.busy} token={token} onUnauthorized={onUnauthorized} onBusy={setStoreSaving} />{data.loading ? <p role="status" className="mt-6 text-sm text-muted-foreground">Carregando categorias...</p> : data.loaded && <CategoryManagement settings categories={data.categories} busy={data.busy} onSave={data.saveCategory} onDelete={data.removeCategory} />}</> : data.loading ? <p role="status" className="py-20 text-center text-muted-foreground">Carregando produtos...</p> : data.error && !data.loaded ? null : path === "/manager" ? <>
        <div className="mb-8"><p className="text-sm text-primary font-medium mb-2">VISÃO GERAL</p><h1 className="font-serif text-3xl font-bold">Dashboard</h1><p className="text-muted-foreground mt-2">Acompanhe a disponibilidade do seu catálogo.</p></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
          { label: "Total de produtos", count: stats.products, to: "/manager/produtos", detail: "Ver catálogo completo" },
          { label: "Total de variantes (cor/tamanho)", count: stats.variants, detail: <><span>{stats.stockedVariants} com estoque</span>{" · "}{stats.emptyVariants > 0 ? <Link to="/manager/produtos?estoque=variante-sem-estoque" aria-label={`Ver ${stats.emptyVariants} variantes sem estoque`} onClick={event => { if (data.busy || settings.saving || storeSaving || orderSaving) event.preventDefault(); }} className="inline-block py-1 text-primary underline decoration-primary/40 underline-offset-2 transition-colors duration-200 hover:text-foreground hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none">{stats.emptyVariants} sem estoque</Link> : <span>0 sem estoque</span>}</> },
          { label: "Produtos sem estoque", count: stats.empty, to: "/manager/produtos?estoque=sem-estoque", arrow: true },
          { label: "Variantes com estoque baixo", count: stats.lowVariants, to: "/manager/produtos?estoque=variante-baixo", arrow: true, variant: true }
        ].map(({ label, count, to, detail, arrow, variant }) => {
          const content = <><h2 className="text-sm text-muted-foreground">{label}</h2><p className="text-4xl font-semibold mt-4">{count}</p>
            <p className={`mt-3 text-sm ${to ? "text-primary" : "text-muted-foreground"}`}>{arrow ? <span className="inline-flex items-center gap-1.5">{variant ? "Ver variantes" : "Ver produtos"} <ArrowRight aria-hidden="true" size={15} className="transition-transform duration-200 motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1 motion-reduce:transform-none motion-reduce:translate-none motion-reduce:transition-none" /></span> : detail}</p></>;
          const base = "bg-card border border-border rounded-xl p-6 transition-[translate,box-shadow,border-color] duration-200 motion-reduce:transition-none";
          return to ? <Link key={label} to={to} onClick={event => { if (data.busy || settings.saving || storeSaving || orderSaving) event.preventDefault(); }} className={`${base} group block cursor-pointer motion-safe:hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40 motion-safe:focus-visible:-translate-y-0.5 focus-visible:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none motion-reduce:translate-none`}>{content}</Link>
            : <section key={label} aria-label={label} className={`${base} hover:border-primary/20 hover:shadow-sm`}>{content}</section>;
        })}</div>
        <section className="mt-6 bg-card border border-border rounded-xl p-6 sm:p-8"><h2 className="text-lg font-semibold">Seu catálogo, em dia</h2><p className="text-muted-foreground text-sm mt-2">O estoque de cada produto é a soma de suas variantes. Variantes com estoque baixo: de 1 a {settings.threshold} unidades.</p><Link to="/manager/produtos" className="inline-flex mt-5 text-primary font-semibold items-center gap-2">Gerenciar produtos <ArrowUpRight size={18} /></Link></section>
      </> : path === "/manager/produtos" ? <><CategoryManagement categories={data.categories} busy={data.busy} onSave={data.saveCategory} onDelete={data.removeCategory} /><ProductList categories={data.categories} threshold={settings.threshold} products={data.products} busy={data.busy} error={data.error} onDelete={data.remove} onCarousel={data.setCarousel} /></> : isNew || (edit && product) ? <>
        <h1 className="font-serif text-3xl font-bold mb-2">{isNew ? "Novo produto" : "Editar produto"}</h1><p className="text-muted-foreground mb-6">{isNew ? "Adicione uma nova peça ao catálogo." : product?.name}</p>
        <ProductForm categories={data.categories} onSaveCategory={data.saveCategory} key={product?.id ?? "new"} product={product} busy={data.busy} onUpload={data.upload} onCancel={() => navigate("/manager/produtos")} onSave={async input => { if (await data.save(input, product?.id)) navigate("/manager/produtos"); }} />
      </> : <section className="p-8 bg-card border border-border rounded-xl"><h1 className="text-xl font-semibold">{edit ? "Produto não encontrado" : "Página não encontrada"}</h1><Link to="/manager/produtos" className="inline-block mt-4 text-primary underline">Voltar para produtos</Link></section>}
    </main>
  </div>;
}
