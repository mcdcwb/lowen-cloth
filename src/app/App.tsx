import { Fragment, useState, useEffect, useRef } from "react";
import { useProducts } from "./hooks/useProducts";
import { ProductImage } from "./components/ProductImage";
import { Manager } from "./manager/Manager";
import { catalogSizes, isNumericSize, selectProductColor, stockFor, type Product, type Size } from "./lib/products";
import { useShopping, type CartItem } from "./hooks/useShopping";
import { useAuth } from "./hooks/useAuth";
import { useLocation, useNavigate } from "react-router";
import { AccountMenu } from "./components/AccountMenu";
import { FilterSection, FilterOptions } from "./components/CatalogFilters";
import { AccountPage } from "./components/AccountPage";
import { validateLogin, validateRegistration } from "./lib/auth";
import {
  ShoppingCart, X, ChevronDown, Plus, Minus, Trash2,
  User, Menu, Heart, Tag, Leaf, Truck, Star,
  LeafyGreen,
  GemIcon, Sprout, MessageCircle
} from "lucide-react";
import { SignpostBig } from "./components/icons/SignpostBig";

// ─── Types ───────────────────────────────────────────────────────────────────

type Public = "masculino" | "feminino" | "unissex" | "infantil";
type Category = "camisetas" | "jaquetas" | "calcas" | "bermudas" | "calcados" | "vestidos";

interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "USER" | "ADMIN";
}

// ─── Constants ────────────────────────────────────────────────────────────────



const CATEGORIES: { value: Category; label: string }[] = [
  { value: "camisetas", label: "Camisetas / Camisas" },
  { value: "jaquetas", label: "Jaquetas / Agasalhos" },
  { value: "calcas", label: "Calças" },
  { value: "bermudas", label: "Bermudas / Shorts" },
  { value: "vestidos", label: "Vestidos" },
  { value: "calcados", label: "Calçados" },
];

const PUBLICS: { value: Public; label: string }[] = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "unissex", label: "Unissex" },
  { value: "infantil", label: "Infantil" },
];

function formatPrice(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const sizeButtonClass = "inline-flex h-[48px] w-[48px] shrink-0 items-center justify-center p-0 text-center [overflow-wrap:anywhere]";

export default function App() {
  const { products, loading: productsLoading, error: productsError, retry: retryProducts } = useProducts();
  const allSizes = catalogSizes(products);
  const location = useLocation();
  const navigate = useNavigate();
  const accountPath = location.pathname.replace(/\/$/, "");
  const isAccountPage = accountPath === "/minha-conta" || accountPath === "/favoritos";
  const [activePublic, setActivePublic] = useState<Public | "todos">("todos");
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [selectedSizes, setSelectedSizes] = useState<Size[]>([]);
  const { user, accessToken, validating, sessionError, login, register, logout, updateAccount } = useAuth();
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [isFeaturedHovering, setIsFeaturedHovering] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [publicDropdownOpen, setPublicDropdownOpen] = useState(false);
  const publicDropdownRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const shopping = useShopping(products, user?.role === "USER" ? accessToken : undefined, validating);
  const { items: cartItems, add: addToCart, remove: removeFromCart, clear: clearCart, changeQty } = shopping;
  const shoppingStatus = (shopping.busy || shopping.error || shopping.notice) && (
    <div className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-xl rounded-lg border bg-card p-3 shadow-lg" role={shopping.error ? "alert" : "status"}>
      {shopping.busy ? "Sincronizando favoritos e carrinho..." : shopping.error || shopping.notice}
      {shopping.notice && !shopping.busy && !shopping.error && <button className="ml-3 underline" onClick={shopping.dismissNotice}>Fechar aviso</button>}
      {shopping.error && <button className="ml-3 underline" onClick={shopping.retry}>Tentar novamente</button>}
    </div>
  );
  function toggleFavorite(productId: number) {
    if (!user) { setAuthMode("login"); setAuthOpen(true); return; }
    if (user.role === "USER") void shopping.toggleFavorite(productId);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (!publicDropdownRef.current?.contains(e.target as Node)) setPublicDropdownOpen(false);
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCatDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Filtered products
  const filteredProducts = products.filter((p) => {
    const publicMatch = activePublic === "todos" || p.public === activePublic ||
      ((activePublic === "masculino" || activePublic === "feminino") && p.public === "unissex");
    const sizeMatch = selectedSizes.length === 0 || p.colors.some(c => c.variants.some(v => v.stock > 0 && selectedSizes.includes(v.value)));
    return publicMatch && sizeMatch && (!activeCategory || p.category === activeCategory);
  });

  const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0);

  function toggleSize(size: Size) {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  }

  function availableStock(product: Product, size: Size) {
    if (productsLoading || productsError || !shopping.ready || shopping.busy) return 0;
    return Math.max(0, stockFor(product, size) - cartItems.filter(item => item.product.id === product.id && item.colorId === product.colorId && item.size === size).reduce((sum, item) => sum + item.quantity, 0));
  }

  async function handleLogin(email: string, password: string, signal: AbortSignal) {
    const success = await login(email, password, signal);
    if (success) {
      setAuthOpen(false);
      if (success.role === "ADMIN") navigate("/manager");
    }
  }

  async function handleRegister(name: string, email: string, password: string, signal: AbortSignal) {
    await register({ name, email, password }, signal);
    setAuthMode("login");
  }

  function handleLogout() {
    logout();
    if (location.pathname.startsWith("/manager")) navigate("/");
  }

  function selectPublic(publicValue: Public | "todos") {
    if (isAccountPage) navigate("/");
    setActivePublic(publicValue);
    setCatDropdownOpen(false);
    setMobileMenuOpen(false);
    setPublicDropdownOpen(false);
  }

  function selectCategory(category: Category | null) {
    if (isAccountPage) navigate("/");
    setActiveCategory(category);
    setCatDropdownOpen(false);
    setMobileMenuOpen(false);
    setPublicDropdownOpen(false);
  }

  function clearFilters() {
    setActivePublic("todos");
    setActiveCategory(null);
    setSelectedSizes([]);
  }
  const hasActiveFilters = activePublic !== "todos" || activeCategory !== null || selectedSizes.length > 0;

  const catalogTitle = activeCategory
    ? CATEGORIES.find(piece => piece.value === activeCategory)?.label
    :
    activePublic === "todos"
      ? "Todas as Peças"
      : PUBLICS.find((c) => c.value === activePublic)?.label ?? "";

  const featuredProducts = products.slice(0, 4);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const productId = params.get("productId");

    if (!productId) {
      setDetailProduct(null);
      return;
    }

    const found = products.find((item) => item.id === Number(productId));
    setDetailProduct(found ?? null);
  }, [location.search, products]);

  useEffect(() => {
    if (isFeaturedHovering || featuredProducts.length < 2) return;

    const interval = window.setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % featuredProducts.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [featuredProducts.length, isFeaturedHovering]);

  const goToFeaturedSlide = (direction: "prev" | "next") => {
    if (!featuredProducts.length) return;
    setFeaturedIndex((prev) => {
      if (direction === "next") {
        return (prev + 1) % featuredProducts.length;
      }
      return (prev - 1 + featuredProducts.length) % featuredProducts.length;
    });
  };

  const openProductDetail = (product: Product) => {
    setDetailProduct(product);
    navigate(`/?productId=${product.id}`);
  };

  if (accountPath === "/manager" || accountPath.startsWith("/manager/")) {
    return <>
      <Manager user={user} token={accessToken} validating={validating} sessionError={authOpen ? null : sessionError}
        onLogin={() => { setAuthMode("login"); setAuthOpen(true); }} onLogout={handleLogout}
        onUnauthorized={message => logout(message)} onChanged={retryProducts} />
      {authOpen && <AuthModal mode={authMode} onClose={() => setAuthOpen(false)} onLogin={handleLogin}
        onRegister={handleRegister} onSwitchMode={() => setAuthMode(mode => mode === "login" ? "register" : "login")}
        sessionError={sessionError} />}
    </>;
  }

  if (detailProduct && !isAccountPage) {
    return (
      <>
        {shoppingStatus}
        <ProductDetailPage
          key={detailProduct.id}
          product={detailProduct}
          availableStock={availableStock}
          user={user}
          totalItems={totalItems}
          onBack={() => {
            setDetailProduct(null);
            navigate("/", { replace: true });
          }}
          onOpenAuth={() => {
            setAuthOpen(true);
          }}
          onLogout={handleLogout}
          onOpenCart={() => setCartOpen(true)}
          onAddToCart={addToCart}
        />

        {cartOpen && (
          <CartDrawer
            busy={shopping.busy || !shopping.ready}
            items={cartItems}
            totalPrice={totalPrice}
            user={user}
            onClose={() => setCartOpen(false)}
            onRemove={removeFromCart}
            onChangeQty={changeQty}
            onClearCart={clearCart}
            onOpenAuth={() => { setCartOpen(false); setAuthOpen(true); }}
          />
        )}

        {authOpen && (
          <AuthModal
            mode={authMode}
            onClose={() => setAuthOpen(false)}
            onLogin={handleLogin}
            onRegister={handleRegister}
            onSwitchMode={() => setAuthMode(mode => mode === "login" ? "register" : "login")}
            sessionError={sessionError}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {shoppingStatus}
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-card/95 [&_button]:text-[15px] backdrop-blur border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button onClick={() => {
              navigate("/");
              window.scrollTo({
                top: 0,
              });
            }}
              className="flex items-baseline gap-1.5 group"
            >
              <span className="text-3xl font-bold text-primary leading-none" style={{ fontFamily: '"Bodoni Moda", serif', fontWeight: 500, letterSpacing: '0.25em' }}>LÖWEN</span>
            </button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-3 lg:gap-7">
              <button
                type="button"
                onClick={() => {
                  navigate("/");
                  window.scrollTo({
                    top: 0,
                  });
                }}
                className="text-[15px] font-medium cursor-pointer transition-colors hover:text-primary"
              >
                Início
              </button>

              <div className="relative" ref={publicDropdownRef}>
                <button type="button" aria-expanded={publicDropdownOpen}
                  onClick={() => { setPublicDropdownOpen(value => !value); setCatDropdownOpen(false); }}
                  className="flex items-center gap-1 text-[15px] font-medium hover:text-primary">
                  Público<ChevronDown className={`w-4 h-4 ${publicDropdownOpen ? "rotate-180" : ""}`} />
                </button>
                {publicDropdownOpen && <div className="absolute top-full left-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
                  <FilterOptions options={PUBLICS} value={activePublic} allValue="todos" onChange={value => selectPublic(value ?? "todos")} />
                </div>}
              </div>
              {/* Categorias dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  aria-expanded={catDropdownOpen}
                  onClick={() => { setCatDropdownOpen((v) => !v); setPublicDropdownOpen(false); }}
                  className="flex items-center gap-1 text-[15px] font-medium cursor-pointer hover:text-primary transition-colors"
                >
                  Categorias
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${catDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {catDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
                    <FilterOptions options={CATEGORIES} value={activeCategory} allValue={null} onChange={selectCategory} />
                  </div>
                )}
              </div>

              <a
                href="/#contato"
                className="text-[15px] font-medium hover:text-primary transition-colors"
              >
                Contato
              </a>
            </nav>




            {/* Right actions */}
            <div className="flex items-center gap-2">
              {user ? <AccountMenu name={user.name} role={user.role} onLogout={handleLogout} /> : (<button
                onClick={() => { setAuthOpen(true); }}
                className="hidden md:flex items-center gap-1.5 text-[15px] font-medium px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:text-primary transition-all"
              >
                <User className="w-4 h-4" />
                Entrar
              </button>
              )}

              {/* Cart button */}
              <button
                onClick={() => setCartOpen(true)}
                className="relative p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Abrir carrinho"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </button>

              {/* Mobile hamburger */}
              <button
                aria-label="Abrir menu de navegação"
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="md:hidden p-2 rounded-lg hover:bg-muted transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border py-4 space-y-1">
              <button
                onClick={() => { clearFilters(); setMobileMenuOpen(false); if (isAccountPage) navigate("/"); }}
                className="w-full text-left px-3 py-2.5 text-[15px] font-medium rounded-lg hover:bg-muted"
              >
                <a href="#home">Todas as Peças</a>
              </button>
              <div className="px-3 pt-2 pb-1 text-[15px] font-semibold uppercase tracking-widest text-muted-foreground">
                Categorias
              </div>
              <FilterOptions options={CATEGORIES} value={activeCategory} allValue={null} onChange={selectCategory} />
              <div className="px-3 pt-2 pb-1 text-[15px] font-semibold uppercase tracking-widest text-muted-foreground">Público</div>
              <FilterOptions options={PUBLICS} value={activePublic} allValue="todos" onChange={value => selectPublic(value ?? "todos")} />
              <a
                href="/#contato"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 text-[15px] font-medium hover:bg-muted rounded-lg"
              >
                Contato
              </a>
              {!user && (
                <button
                  onClick={() => { setAuthOpen(true); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-[15px] font-medium text-primary rounded-lg hover:bg-primary/10"
                >
                  Entrar
                </button>
              )}
              {user?.role === "ADMIN" && (
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-[15px] font-medium text-muted-foreground rounded-lg hover:bg-muted"
                >
                  Sair da conta
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {isAccountPage ? <AccountPage accessToken={accessToken} onUpdated={updateAccount} user={user} favorites={accountPath === "/favoritos"} onLogin={() => setAuthOpen(true)}>
        {shopping.ready && !shopping.favorites.length && <p className="mt-4">Nenhum favorito salvo.</p>}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {shopping.favorites.map(product => <ProductCard key={product.id} product={product} liked onFavorite={() => toggleFavorite(product.id)} favoriteBusy={shopping.busy} availableStock={availableStock} onAddToCart={addToCart} />)}
        </div>
      </AccountPage> : <>
        <div className="w-full pt-0">
          <div className="p-0 sm:p-0">
            <div
              className="overflow-hidden rounded-none"
              onMouseEnter={() => setIsFeaturedHovering(true)}
              onMouseLeave={() => setIsFeaturedHovering(false)}
            >
              <div
                className="flex transition-transform duration-300 ease-out"
                style={{ transform: `translateX(-${featuredIndex * 100}%)` }}
              >
                {featuredProducts.map((product) => (
                  <article key={product.id} className="w-full shrink-0 p-0">
                    <div className="group relative overflow-hidden rounded-none">
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-72 w-full object-cover transition-all duration-300 group-hover:scale-105 sm:h-[420px]"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                      <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/20" />

                      <button
                        type="button"
                        onClick={() => goToFeaturedSlide("prev")}
                        aria-label="Produto anterior"
                        className="absolute left-3 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white opacity-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-black/50 group-hover:opacity-100"
                      >
                        <ChevronDown className="h-4 w-4 rotate-90" />
                      </button>

                      <button
                        type="button"
                        onClick={() => goToFeaturedSlide("next")}
                        aria-label="Próximo produto"
                        className="absolute right-3 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/30 text-white opacity-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-black/50 group-hover:opacity-100"
                      >
                        <ChevronDown className="h-4 w-4 -rotate-90" />
                      </button>

                      <div className="absolute inset-0 z-20 flex items-center justify-center p-4 sm:p-6">
                        <button
                          type="button"
                          onClick={() => openProductDetail(product)}
                          className="translate-y-3 rounded-full border border-white/30 bg-black/30 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white opacity-0 backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-black/50 group-hover:translate-y-0 group-hover:opacity-100"
                        >
                          VER MAIS
                        </button>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4 sm:p-6">
                        <div>
                          <h3 className="max-w-[85%] text-base font-semibold text-white sm:text-2xl">
                            {product.name}
                          </h3>
                        </div>
                      </div>

                      <div className="absolute inset-x-0 bottom-4 z-10 flex items-center justify-center gap-1.5 sm:bottom-5">
                        {featuredProducts.map((item, index) => (
                          <button
                            key={item.id}
                            type="button"
                            aria-label={`Ir para o produto ${index + 1}`}
                            onClick={() => setFeaturedIndex(index)}
                            className={`h-1.5 rounded-full transition-all ${featuredIndex === index ? "w-6 bg-white" : "w-1.5 bg-white/45 hover:bg-white/75"
                              }`}
                          />
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden sm:grid bg-primary text-primary-foreground px-3 py-2.5 text-xs font-medium tracking-wide grid-cols-[1fr_auto_1fr_auto_1fr] items-center">
          <span className="flex items-center gap-1.5 justify-self-start">
            <SignpostBig className="w-4 h-4" />
            Fé
          </span>

          <span className="opacity-80 justify-self-center px-4">
            ·
          </span>

          <span className="flex items-center text-base gap-1.5 justify-self-center">
            <Truck className="w-[18px] h-[18px]" />
            Entrega para todo o Brasil
          </span>

          <span className="opacity-80 justify-self-center px-4">
            ·
          </span>

          <span className="flex items-center gap-1.5 justify-self-end">
            Propósito
            <Sprout className="w-4 h-4" />
          </span>
        </div>

        {/* Mobile */}
        <div className="flex sm:hidden bg-primary text-primary-foreground px-3 py-2.5 text-xs font-medium tracking-wide items-center justify-center gap-12">
          <span className="opacity-80 px-2">
            ·
          </span>

          <span className="flex items-center text-sm gap-1.5">
            <Truck className="w-[18px] h-[18px]" />
            Entrega para todo o Brasil
          </span>

          <span className="opacity-80 px-2">
            ·
          </span>
        </div>

        {/* ── Main layout ────────────────────────────────────────────────────── */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex gap-8">

            {/* ── Sidebar ──────────────────────────────────────────────────── */}
            <aside className="hidden lg:block w-52 shrink-0">
              <div className="sticky top-24 space-y-7">
                <FilterSection title="Tamanhos">
                  <div className="grid grid-cols-3 gap-1.5">
                    {allSizes.map((size, index) => <Fragment key={size}>
                      {index > 0 && isNumericSize(size) && !isNumericSize(allSizes[index - 1]) && <hr className="col-span-3 border-border my-2" />}
                      <button aria-pressed={selectedSizes.includes(size)}
                        onClick={() => toggleSize(size)}
                        className={`${sizeButtonClass} text-sm font-medium border transition-colors ${selectedSizes.includes(size) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-muted"}`}>
                        {size}
                      </button></Fragment>)}
                  </div>
                </FilterSection>
                <FilterSection title="Público">
                  <FilterOptions options={PUBLICS} value={activePublic} allValue="todos" onChange={value => selectPublic(value ?? "todos")} />
                </FilterSection>
                <FilterSection title="Categoria">
                  <FilterOptions options={CATEGORIES} value={activeCategory} allValue={null} onChange={selectCategory} />
                </FilterSection>
              </div>
            </aside>

            {/* ── Products section ─────────────────────────────────────────── */}
            <section className="flex-1 min-w-0">
              {/* Section header */}
              <div className="flex flex-wrap items-end justify-between mb-6 gap-4">
                <div>
                  <h2 className="font-serif text-2xl font-bold text-foreground leading-tight">
                    {catalogTitle}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {productsLoading ? "Carregando..." : productsError ? "Catálogo indisponível" : `${filteredProducts.length} ${filteredProducts.length === 1 ? "peça encontrada" : "peças encontradas"}`}
                  </p>
                </div>

                {/* Mobile size filter */}
                <div role="group" aria-label="Filtrar por tamanho" className="lg:hidden flex gap-1 flex-wrap justify-end">
                  {allSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => toggleSize(size)}
                      aria-pressed={selectedSizes.includes(size)}
                      className={`${sizeButtonClass} text-xs font-medium border transition-all ${selectedSizes.includes(size)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:border-primary/50"
                        }`}
                    >
                      {size}
                    </button>
                  ))}
                  {selectedSizes.length > 0 && (
                    <button
                      onClick={() => setSelectedSizes([])}
                      aria-label="Limpar tamanhos"
                      className="h-8 px-2 text-xs text-muted-foreground border border-border hover:text-primary"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {hasActiveFilters && <button type="button" onClick={clearFilters}
                  className="ml-auto shrink-0 px-2 py-2 text-base text-primary underline underline-offset-2">
                  Limpar filtros
                </button>}
              </div>

              {productsLoading ? (
                <div role="status" className="py-24 text-center text-muted-foreground">Carregando produtos...</div>
              ) : productsError ? (
                <div role="alert" className="py-24 text-center text-muted-foreground space-y-3">
                  <p>{productsError}</p>
                  <button onClick={retryProducts} className="text-primary underline underline-offset-2">Tentar novamente</button>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <ShoppingCart className="w-7 h-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-base font-medium">Nenhuma peça encontrada</p>
                  <p className="text-sm">Tente ajustar os filtros de tamanho, público ou categoria</p>
                  {hasActiveFilters && <button
                    onClick={clearFilters}
                    className="mt-1 text-sm text-primary underline underline-offset-2 hover:opacity-80"
                  >
                    Limpar todos os filtros
                  </button>}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProducts.map((product) => (
                    <ProductCard key={product.id} liked={shopping.favorites.some(p => p.id === product.id)} onFavorite={() => toggleFavorite(product.id)} favoriteBusy={shopping.busy || validating || user?.role === "ADMIN"} product={product} availableStock={availableStock} onAddToCart={addToCart} />
                  ))}
                </div>
              )}
            </section>
          </div>
        </main>
      </>}

      {/* ── Contact section ────────────────────────────────────────────────── */}
      <footer id="contato" className="mt-20 bg-secondary border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid md:grid-cols-3 gap-10">
            <div>
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-xl font-bold text-primary leading-none" style={{ fontFamily: '"Bodoni Moda", serif', fontWeight: 500, letterSpacing: '0.25em' }}>LÖWEN</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Vestindo fé. Carregando propósito.
              </p>
            </div>
            <div className="md:text-center">
              <h4 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground mb-3">Contato</h4>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li>📍 Curitiba, PR — Brasil</li>
                <li>✉️ contato@lowen.com.br</li>
                <li>📱 (41) 9 9745-8063</li>
              </ul>
            </div>
            <div className="md:text-right">
              <h4 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground mb-3">Horário loja física</h4>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li>Segunda a Sexta: 9h – 18h</li>
                <li>Sábados: 10h – 15h</li>
                <li>Domingos e feriados: Fechado</li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground text-center">
            © 2026 Löwen - Todos os direitos reservados.
          </div>
        </div>
      </footer>

      {/* ── Cart Drawer ────────────────────────────────────────────────────── */}
      {cartOpen && (
        <CartDrawer
            busy={shopping.busy || !shopping.ready}
          items={cartItems}
          totalPrice={totalPrice}
          user={user}
          onClose={() => setCartOpen(false)}
          onRemove={removeFromCart}
          onChangeQty={changeQty}
          onClearCart={clearCart}
          onOpenAuth={() => { setCartOpen(false); setAuthOpen(true); }}
        />
      )}

      {!cartOpen && (
        <a
          href="https://wa.me/5541997458063"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar conosco pelo WhatsApp"
          className="fixed bottom-5 right-5 z-50 flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#25D366] text-white shadow-lg hover:scale-105 hover:shadow-x1 active:scale-95 transition-all"
        >
          <MessageCircle className="w-7 h-7 sm:w-8 sm:h-8" />
        </a>
      )}

      {/* ── Auth Modal ─────────────────────────────────────────────────────── */}
      {authOpen && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthOpen(false)}
          onLogin={handleLogin}
          onRegister={handleRegister}
          onSwitchMode={() => setAuthMode(mode => mode === "login" ? "register" : "login")}
          sessionError={sessionError}
        />
      )}
    </div>
  );
}

function ColorSelector({ product, onSelect }: { product: Product; onSelect: (id: number) => void }) {
  return <div className="space-y-2"><p className="text-sm">Cor: <span className="font-medium">{product.color.name}</span></p>
    <div className="flex gap-2 flex-wrap" role="group" aria-label="Selecionar cor">
      {product.colors.map(color => <button key={color.id} type="button" title={color.colorName} aria-label={color.colorName}
        aria-pressed={product.colorId === color.id} onClick={() => onSelect(color.id)}
        className={`h-7 w-7 border rounded-none shadow-sm ${product.colorId === color.id ? "ring-2 ring-primary ring-offset-2 border-primary" : "border-border"}`}
        style={{ backgroundColor: color.colorValue }} />)}
    </div>
  </div>;
}

function ProductDetailPage({
  product: baseProduct,
  user,
  totalItems,
  onBack,
  onOpenAuth,
  onLogout,
  onOpenCart,
  onAddToCart,
  availableStock,
}: {
  product: Product;
  user: AuthUser | null;
  totalItems: number;
  onBack: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenCart: () => void;
  onAddToCart: (p: Product, s: Size) => Promise<boolean>;
  availableStock: (p: Product, s: Size) => number;
}) {
  const [selectedColorId, setSelectedColorId] = useState(() => { const id = Number(new URLSearchParams(window.location.search).get("colorId")); return baseProduct.colors.some(c => c.id === id) ? id : baseProduct.colorId; });
  const product = selectProductColor(baseProduct, baseProduct.colors.some(c => c.id === selectedColorId) ? selectedColorId : baseProduct.colors[0].id);

  const productImages = product.images && product.images.length > 0 ? product.images : [product.imageUrl];
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [added, setAdded] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-card/95 [&_button]:text-[15px] backdrop-blur border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => {
                window.location.href = window.location.origin;
              }}
              className="flex items-baseline gap-1.5 group"
            >
              <span className="text-3xl font-bold text-primary leading-none" style={{ fontFamily: '"Bodoni Moda", serif', fontWeight: 500, letterSpacing: '0.25em' }}>LÖWEN</span>
            </button>

            <nav className="hidden md:flex items-center gap-3 lg:gap-7">
              <button
                onClick={() => {
                  window.location.href = window.location.origin;
                }}
                className="text-[15px] font-medium cursor-pointer transition-colors hover:text-primary"
              >
                Início
              </button>
              <a href="/#contato" className="text-[15px] font-medium hover:text-primary transition-colors">Contato</a>
            </nav>

            <div className="flex items-center gap-2">
              {user ? <AccountMenu name={user.name} role={user.role} onLogout={onLogout} /> : (<button
                onClick={onOpenAuth}
                className="hidden md:flex items-center gap-1.5 text-[15px] font-medium px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:text-primary transition-all"
              >
                <User className="w-4 h-4" />
                Entrar
              </button>
              )}

              <button
                onClick={onOpenCart}
                className="relative p-2 rounded-lg hover:bg-muted transition-colors"
                aria-label="Abrir carrinho"
              >
                <ShoppingCart className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {totalItems > 99 ? "99+" : totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <button
          type="button"
          onClick={onBack}
          className="mb-6 inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary"
        >
          ← Voltar para a loja
        </button>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
          <div className="space-y-4">
            <div className="overflow-hidden border border-border bg-card">
              <ProductImage
                src={productImages[activeImageIndex]}
                alt={product.name}
                className="w-full h-[520px] object-contain bg-muted"
              />
            </div>

            {productImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {productImages.map((image, index) => (
                  <button
                    key={`${product.id}-${index}`}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`relative h-20 w-20 shrink-0 overflow-hidden border transition-all ${activeImageIndex === index ? "border-primary" : "border-border"
                      }`}
                  >
                    <ProductImage src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full object-contain bg-muted" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
                {product.public}
              </p>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold leading-tight text-foreground">
                {product.name}
              </h1>
            </div>

            <div className="text-2xl font-bold text-primary">{formatPrice(product.price)}</div>
            <ColorSelector product={product} onSelect={id => {
              const next = selectProductColor(baseProduct, id);
              setSelectedColorId(id); setActiveImageIndex(0); setAdded(false);
              if (selectedSize && availableStock(next, selectedSize) <= 0) setSelectedSize(null);
            }} />

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Tamanhos
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
              aria-pressed={selectedSize === size}
                    disabled={availableStock(product, size) <= 0}
                    title={stockFor(product, size) === 0 ? "Esgotado" : undefined}
                    type="button"
                    onClick={() => setSelectedSize((current) => (current === size ? null : size))}
                    className={`${sizeButtonClass} disabled:opacity-40 disabled:cursor-not-allowed border text-sm font-medium transition-all ${selectedSize === size
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted"
                      }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={!selectedSize || availableStock(product, selectedSize) <= 0}
              onClick={async () => {
                if (!selectedSize) return;
                if (!await onAddToCart(product, selectedSize)) return;
                setAdded(true);
                setTimeout(() => setAdded(false), 1800);
              }}
              className={`disabled:opacity-50 disabled:cursor-not-allowed w-full py-3 text-sm font-semibold uppercase tracking-[0.18em] transition ${added
                ? "bg-accent text-accent-foreground"
                : selectedSize
                  ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
            >
              {added ? "✓ Adicionado!" : !product.variants.some(v => v.stock > 0) ? "Esgotado" : selectedSize && availableStock(product, selectedSize) <= 0 ? "Limite de estoque" : selectedSize ? "Adicionar ao carrinho" : "Selecione o tamanho"}
            </button>

            <div className="border-t border-border pt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Detalhes
              </p>
              <p className="text-sm leading-relaxed text-foreground/80">
                {product.description || "Descrição não informada."}
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({
  liked, onFavorite, favoriteBusy,
  product: baseProduct,
  onAddToCart,
  availableStock,
}: {
  liked: boolean; onFavorite: () => void; favoriteBusy: boolean;
  product: Product;
  onAddToCart: (p: Product, s: Size) => Promise<boolean>;
  availableStock: (p: Product, s: Size) => number;
}) {
  const [selectedColorId, setSelectedColorId] = useState(baseProduct.colorId);
  const product = selectProductColor(baseProduct, baseProduct.colors.some(c => c.id === selectedColorId) ? selectedColorId : baseProduct.colors[0].id);

  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [added, setAdded] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const productImages = product.images && product.images.length > 0 ? product.images : [product.imageUrl];
  const hasMultipleImages = productImages.length > 1;

  async function handleAdd() {
    if (!selectedSize) return;
    if (!await onAddToCart(product, selectedSize)) return;
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  }

  function showPrevImage() {
    setCurrentImageIndex((prev) => (prev - 1 + productImages.length) % productImages.length);
  }

  function showNextImage() {
    setCurrentImageIndex((prev) => (prev + 1) % productImages.length);
  }

  return (
    <div className="bg-card border border-border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group flex flex-col overflow-hidden rounded-b-2xl">
      {/* Image */}
      <div className="relative aspect-[4/5] bg-muted overflow-hidden rounded-none">
        <a
          href={`?productId=${product.id}&colorId=${product.colorId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-full w-full"
        >
          <ProductImage
            src={productImages[currentImageIndex]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
            loading="lazy"
          />
        </a>

        {hasMultipleImages && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showPrevImage();
              }}
              aria-label="Imagem anterior"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/35 bg-white/25 text-black shadow-[0_0_0_1px_rgba(255,255,255,0.35)] backdrop-blur-sm transition hover:bg-white/45"
            >
              <ChevronDown className="h-4 w-4 rotate-90" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                showNextImage();
              }}
              aria-label="Próxima imagem"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-[8px] border border-white/35 bg-white/25 text-black shadow-[0_0_0_1px_rgba(255,255,255,0.35)] backdrop-blur-sm transition hover:bg-white/45"
            >
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
            <div className="absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-1.5">
              {productImages.map((_, index) => (
                <button
                  key={`${product.id}-${index}`}
                  type="button"
                  aria-label={`Ver imagem ${index + 1}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                  className={`h-1.5 rounded-full transition-all ${currentImageIndex === index ? "w-5 bg-white" : "w-1.5 bg-white/60 hover:bg-white/90"
                    }`}
                />
              ))}
            </div>
          </>
        )}
        {/* Badge */}
        {product.badge && (
          <span className="absolute top-2.5 left-2.5 text-[10px] font-bold uppercase tracking-wide bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
            {product.badge}
          </span>
        )}
        {/* Wishlist */}
        <button
          onClick={onFavorite}
          disabled={favoriteBusy}
          aria-pressed={liked}
          className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-transparent text-black transition hover:bg-white/10"
          aria-label={liked ? "Remover dos favoritos" : "Favoritar"}
        >
          <Heart
            className={`w-3.5 h-3.5 transition-colors ${liked ? "fill-primary/80 text-primary/80" : "fill-transparent text-black"}`}
          />
        </button>
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1 rounded-t-2xl bg-card">
        <div>
          <p className="text-sm font-medium leading-snug text-foreground line-clamp-2 min-h-[2.5rem]">
            {product.name}
          </p>
          <p className="mt-1 text-base font-bold text-primary">{formatPrice(product.price)}</p>
        </div>

        <ColorSelector product={product} onSelect={id => {
              const next = selectProductColor(baseProduct, id);
              setSelectedColorId(id); setCurrentImageIndex(0); setAdded(false);
              if (selectedSize && availableStock(next, selectedSize) <= 0) setSelectedSize(null);
            }} />

        {/* Size buttons */}
        <div className="flex gap-1 flex-wrap">
          {product.sizes.map((size) => (
            <button
              key={size}
              aria-pressed={selectedSize === size}
              disabled={availableStock(product, size) <= 0}
              title={stockFor(product, size) === 0 ? "Esgotado" : undefined}
              onClick={() => setSelectedSize((s) => (s === size ? null : size))}
              className={`${sizeButtonClass} disabled:opacity-40 disabled:cursor-not-allowed text-xs border font-medium transition-all rounded-none ${selectedSize === size
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border hover:border-primary/40 hover:bg-muted"
                }`}
            >
              {size}
            </button>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleAdd}
          disabled={!selectedSize || availableStock(product, selectedSize) <= 0}
          className={`disabled:opacity-50 disabled:cursor-not-allowed mt-auto w-full py-2 text-sm font-semibold transition-all duration-200 rounded-none ${added
            ? "bg-accent text-accent-foreground"
            : selectedSize
              ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
              : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
        >
          {added ? "✓ Adicionado!" : !product.variants.some(v => v.stock > 0) ? "Esgotado" : selectedSize && availableStock(product, selectedSize) <= 0 ? "Limite de estoque" : selectedSize ? "Adicionar ao carrinho" : "Selecione o tamanho"}
        </button>
      </div>
    </div>
  );
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({
  busy,
  items,
  totalPrice,
  user,
  onClose,
  onRemove,
  onChangeQty,
  onClearCart,
  onOpenAuth,
}: {
  busy: boolean;
  items: CartItem[];
  totalPrice: number;
  user: AuthUser | null;
  onClose: () => void;
  onRemove: (id: number, size: Size, colorId: number) => void;
  onChangeQty: (id: number, size: Size, delta: number, colorId: number) => void;
  onOpenAuth: () => void;
  onClearCart: () => void;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);
  // Trap focus, close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-sm"
        onClick={(event) => {
          const bounds = drawerRef.current?.getBoundingClientRect();
          if (!bounds) return;
          // Leave at least half the exposed overlay available on narrow screens.
          const safeWidth = Math.min(100, Math.max(0, bounds.left) / 2);
          if (event.clientX < bounds.left - safeWidth) onClose();
        }}
      />

      {/* Drawer */}
      <div ref={drawerRef} className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-serif text-lg font-bold">Seu Carrinho</h2>
            {!user && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Itens salvos localmente.{" "}
                <button onClick={onOpenAuth} className="text-primary underline underline-offset-2 hover:opacity-80">
                  Entre para sincronizar
                </button>
              </p>
            )}
          </div>
          <button aria-label="Fechar carrinho" onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto py-4 px-5 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                <ShoppingCart className="w-9 h-9 opacity-40" />
              </div>
              <div className="text-center">
                <p className="font-medium">Carrinho vazio</p>
                <p className="text-sm mt-1">Adicione peças para começar</p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
              >
                Explorar peças
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={`${item.product.id}-${item.colorId}-${item.size}`}
                className="flex gap-3 p-3 rounded-xl bg-muted/40 border border-border/60"
              >
                {/* Thumb */}
                <div className="w-18 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                  <ProductImage
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                    {item.product.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Cor: <span className="font-semibold text-foreground">{item.product.color.name}</span>{" · "}Tamanho: <span className="font-semibold text-foreground">{item.size}</span>
                  </p>
                  <p className="text-sm font-bold text-primary">{formatPrice(item.product.price)}</p>
                  {/* Qty controls */}
                  <div className="flex items-center gap-2 mt-auto">
                    <button
                      disabled={busy}
                      aria-label="Diminuir quantidade"
                      onClick={() => onChangeQty(item.product.id, item.size, -1, item.colorId)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      disabled={busy || item.quantity >= stockFor(item.product, item.size)}
                      aria-label="Aumentar quantidade"
                      onClick={() => onChangeQty(item.product.id, item.size, 1, item.colorId)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      disabled={busy}
                      aria-label="Remover item"
                      onClick={() => onRemove(item.product.id, item.size, item.colorId)}
                      className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-border px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <button disabled={busy} onClick={onClearCart} className="flex items-center gap-3 py-0 px-0 rounded-x1 border-border text-sm text-destructive font-medium hover:bg-muted transition-colors">
                <Trash2 className="w-4 h-4" />
                Limpar Carrinho
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="font-bold text-lg text-foreground">{formatPrice(totalPrice)}</span>
            </div>
            <button className="w-full py-3 rounded-none bg-primary text-primary-foreground font-semibold hover:opacity-90 active:scale-[0.98] transition-all">
              Finalizar compra
            </button>
            {!user && (
              <button
                onClick={onOpenAuth}
                className="w-full py-2.5 rounded-none border border-border text-sm font-medium hover:bg-muted transition-colors"
              >
                Entrar para salvar carrinho
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Auth Modal ───────────────────────────────────────────────────────────────

function AuthModal({
  mode,
  onClose,
  onLogin,
  onRegister,
  onSwitchMode,
  sessionError,
}: {
  mode: "login" | "register";
  onClose: () => void;
  onLogin: (email: string, password: string, signal: AbortSignal) => Promise<void>;
  onRegister: (name: string, email: string, password: string, signal: AbortSignal) => Promise<void>;
  onSwitchMode: () => void;
  sessionError: string | null;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => pending.current?.abort(), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending.current) return;
    const validation = mode === "login"
      ? validateLogin(email, password)
      : validateRegistration({ name, email, password });
    if (validation) { setError(validation); return; }
    setError("");
    setSuccess("");
    setLoading(true);
    const controller = new AbortController();
    pending.current = controller;
    try {
      if (mode === "login") {
        await onLogin(email, password, controller.signal);
      } else {
        await onRegister(name, email, password, controller.signal);
        setPassword("");
        setSuccess("Conta criada com sucesso. Entre com seu e-mail e senha.");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : "Não foi possível entrar.");
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = modalRef.current?.getBoundingClientRect();
          if (!bounds) return;
          const overlay = event.currentTarget.getBoundingClientRect();
          // Adapt each edge independently, preserving a clickable outer strip.
          const safeGap = (gap: number) => Math.min(100, Math.max(0, gap) / 2);
          if (event.clientX < bounds.left - safeGap(bounds.left - overlay.left) ||
              event.clientX > bounds.right + safeGap(overlay.right - bounds.right) ||
              event.clientY < bounds.top - safeGap(bounds.top - overlay.top) ||
              event.clientY > bounds.bottom + safeGap(overlay.bottom - bounds.bottom)) onClose();
        }}
      >
        <div ref={modalRef} className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden">
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            <button
              aria-label="Fechar login ou cadastro"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            <h2 className="font-serif text-2xl font-bold text-foreground">
              {mode === "login" ? "Entrar" : "Criar conta"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "login"
                ? "Acesse sua conta para continuar."
                : "Cadastre-se para salvar seus favoritos e pedidos."}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3">
            {mode === "register" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nome completo
                </label>
                <input
                  type="text"
                  aria-label="Nome completo"
                  autoComplete="name"
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Maria Silva"
                  className="w-full px-3.5 py-2.5 rounded-xl text-black bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
                  required
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                E-mail
              </label>
              <input
                type="email"
                aria-label="E-mail"
                autoComplete={mode === "login" ? "username" : "email"}
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-3.5 py-2.5 rounded-xl text-black bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Senha
              </label>
              <input
                type="password"
                aria-label="Senha"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "login" ? 1 : 5}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl text-black bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
                required
              />
            </div>

            {(error || sessionError) && (
              <p role="alert" className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error || sessionError}</p>
            )}
            {success && (
              <p role="status" className="text-xs text-primary bg-primary/10 px-3 py-2 rounded-lg">{success}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm mt-1 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>

            <p className="text-center text-xs text-muted-foreground pt-1">
              {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
              <button
                type="button"
                onClick={() => { setError(""); setSuccess(""); onSwitchMode(); }}
                className="text-primary font-medium underline underline-offset-2 hover:opacity-80"
              >
                {mode === "login" ? "Cadastre-se" : "Entrar"}
              </button>
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
