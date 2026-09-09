import { useState, useEffect, useRef } from "react";
import {
  ShoppingCart, X, ChevronDown, Plus, Minus, Trash2,
  User, LogOut, Menu, Heart, Tag, Leaf, Truck, Star,
  LeafyGreen,
  GemIcon, Sprout, MessageCircle
} from "lucide-react";
import { SignpostBig } from "./components/icons/SignpostBig";
import leaoBarrocoAmbas from "./components/img/products/leao-barroco/leao barroco - ambas.png";
import leaoBarrocoCostas from "./components/img/products/leao-barroco/leao barroco - costas.png";
import leaoBarrocoDetails from "./components/img/products/leao-barroco/leao barroco - details.png";
import leaoBarrocoFrente from "./components/img/products/leao-barroco/leao barroco - frente.png";

// ─── Types ───────────────────────────────────────────────────────────────────

type Size = "PP" | "P" | "M" | "G" | "GG";
type Category = "masculino" | "feminino" | "unissex" | "infantil";

interface Product {
  id: number;
  name: string;
  price: number;
  sizes: Size[];
  category: Category;
  imageUrl: string;
  images?: string[];
  badge?: string;
  color: {
    name: string;
    value: string;
  };
}

interface CartItem {
  product: Product;
  size: Size;
  quantity: number;
}

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_CART_KEY = "brecho_cart_v1";
const LS_USER_KEY = "brecho_user_v1";

const ALL_SIZES: Size[] = ["PP", "P", "M", "G", "GG"];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
  { value: "unissex", label: "Unissex" },
  { value: "infantil", label: "Infantil" },
];

const clearCart = () => {
  setItems([]);
};

const PRODUCTS: Product[] = [
  {
    id: 0,
    name: "Camiseta Leão Barroco",
    price: 180.0,
    sizes: ["P", "M", "G"],
    category: "unissex",
    imageUrl: leaoBarrocoFrente,
    images: [leaoBarrocoFrente, leaoBarrocoCostas, leaoBarrocoDetails, leaoBarrocoAmbas],
    badge: "PREMIUM",
    color: { name: "Offwhite", value: "#f4efe8" },
  },
  {
    id: 1,
    name: "Camiseta polo masculina azul marinho",
    price: 45.0,
    sizes: ["M", "G", "GG"],
    category: "masculino",
    imageUrl: "https://images.unsplash.com/photo-1625910513413-c23b8bb81cba?w=480&h=600&fit=crop&auto=format",
    color: { name: "Azul marinho", value: "#1d4f91" },
  },
  {
    id: 2,
    name: "Vestido floral feminino rodado",
    price: 75.0,
    sizes: ["P", "M"],
    category: "feminino",
    imageUrl: "https://images.unsplash.com/photo-1502868354157-ec2edd2a1651?w=480&h=600&fit=crop&auto=format",
    color: { name: "Rosa", value: "#d0a8a4" },
  },
  {
    id: 3,
    name: "Jaqueta jeans unissex vintage",
    price: 120.0,
    sizes: ["M", "G", "GG"],
    category: "unissex",
    imageUrl: "https://images.unsplash.com/photo-1555583743-991174c11425?w=480&h=600&fit=crop&auto=format",
    color: { name: "Azul denim", value: "#6d8aa5" },
  },
  {
    id: 4,
    name: "Conjunto infantil xadrez colorido",
    price: 38.0,
    sizes: ["PP", "P"],
    category: "infantil",
    imageUrl: "https://images.unsplash.com/photo-1604303768345-038b79a8c47a?w=480&h=600&fit=crop&auto=format",
    color: { name: "Terracota", value: "#d78b5c" },
  },
  {
    id: 5,
    name: "Camiseta masculina verde oliva",
    price: 35.0,
    sizes: ["P", "M", "G"],
    category: "masculino",
    imageUrl: "https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=480&h=600&fit=crop&auto=format",
    color: { name: "Oliva", value: "#7b8a62" },
  },
  {
    id: 6,
    name: "Vestido de balada feminino colorido",
    price: 88.0,
    sizes: ["PP", "P", "M"],
    category: "feminino",
    imageUrl: "https://images.unsplash.com/photo-1671848633245-79cc98b0dbe8?w=480&h=600&fit=crop&auto=format",
    color: { name: "Coral", value: "#d88d80" },
  },
  {
    id: 7,
    name: "Moletom unissex cinza vintage",
    price: 85.0,
    sizes: ["M", "G", "GG"],
    category: "unissex",
    imageUrl: "https://images.unsplash.com/photo-1564557287817-3785e38ec1f5?w=480&h=600&fit=crop&auto=format",
    color: { name: "Cinza", value: "#a9a9a7" },
  },
  {
    id: 8,
    name: "Blusa infantil listrada vermelha",
    price: 32.0,
    sizes: ["PP", "P"],
    category: "infantil",
    imageUrl: "https://images.unsplash.com/photo-1604482858862-1db908a653e4?w=480&h=600&fit=crop&auto=format",
    color: { name: "Vermelho", value: "#d84d4d" },
  },
  {
    id: 9,
    name: "Jaqueta denim patchwork artesanal",
    price: 145.0,
    sizes: ["P", "M", "G"],
    category: "unissex",
    imageUrl: "https://images.unsplash.com/photo-1741941171881-40832346c7fe?w=480&h=600&fit=crop&auto=format",
    color: { name: "Azul escuro", value: "#4d648a" },
  },
  {
    id: 10,
    name: "Conjunto infantil floral com short",
    price: 42.0,
    sizes: ["PP", "P"],
    category: "infantil",
    imageUrl: "https://images.unsplash.com/photo-1502451885777-16c98b07834a?w=480&h=600&fit=crop&auto=format",
    color: { name: "Rosa pastel", value: "#f7b5b7" },
  },
  {
    id: 11,
    name: "Moletom feminino branco com capuz",
    price: 68.0,
    sizes: ["P", "M", "G"],
    category: "feminino",
    imageUrl: "https://images.unsplash.com/photo-1508216310976-c518daae0cdc?w=480&h=600&fit=crop&auto=format",
    color: { name: "Branco", value: "#f7f2ec" },
  },
  {
    id: 12,
    name: "Polo masculina preta clássica",
    price: 50.0,
    sizes: ["M", "G", "GG"],
    category: "masculino",
    imageUrl: "https://images.unsplash.com/photo-1625910513413-c23b8bb81cba?w=480&h=600&fit=crop&auto=format&sat=-80",
    color: { name: "Preto", value: "#1d1d1d" },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [activeCategory, setActiveCategory] = useState<Category | "todos">("todos");
  const [selectedSizes, setSelectedSizes] = useState<Size[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [isFeaturedHovering, setIsFeaturedHovering] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load persisted state
  useEffect(() => {
    const savedUser = loadFromStorage<AuthUser | null>(LS_USER_KEY, null);
    const savedCart = loadFromStorage<CartItem[]>(LS_CART_KEY, []);
    if (savedUser) setUser(savedUser);
    if (savedCart.length > 0) setCartItems(savedCart);
  }, []);

  // Persist cart to localStorage when user is not logged in
  useEffect(() => {
    if (!user) saveToStorage(LS_CART_KEY, cartItems);
  }, [cartItems, user]);

  // Close dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCatDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Filtered products
  const filteredProducts = PRODUCTS.filter((p) => {
    const catMatch = activeCategory === "todos" || p.category === activeCategory;
    const sizeMatch = selectedSizes.length === 0 || p.sizes.some((s) => selectedSizes.includes(s));
    return catMatch && sizeMatch;
  });

  const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0);

  function toggleSize(size: Size) {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  }

  function addToCart(product: Product, size: Size) {
    setCartItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id && i.size === size);
      if (idx >= 0) {
        return prev.map((item, i) =>
          i === idx ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, size, quantity: 1 }];
    });
  }

  function removeFromCart(productId: number, size: Size) {
    setCartItems((prev) => prev.filter((i) => !(i.product.id === productId && i.size === size)));
  }

  function clearCart() {
    setCartItems([]);
  }

  function changeQty(productId: number, size: Size, delta: number) {
    setCartItems((prev) =>
      prev
        .map((item) =>
          item.product.id === productId && item.size === size
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function handleLogin(userData: AuthUser) {
    setUser(userData);
    saveToStorage(LS_USER_KEY, userData);
    // In a real app: POST cart items to backend, then merge with user cart
    localStorage.removeItem(LS_CART_KEY);
    setAuthOpen(false);
  }

  function handleLogout() {
    setUser(null);
    localStorage.removeItem(LS_USER_KEY);
    setCartItems([]);
  }

  function selectCategory(cat: Category | "todos") {
    setActiveCategory(cat);
    setCatDropdownOpen(false);
    setMobileMenuOpen(false);
  }

  const activeCatLabel =
    activeCategory === "todos"
      ? "Todas as Peças"
      : CATEGORIES.find((c) => c.value === activeCategory)?.label ?? "";

  const featuredProducts = PRODUCTS.slice(0, 4);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get("productId");

    if (!productId) {
      setDetailProduct(null);
      return;
    }

    const found = PRODUCTS.find((item) => item.id === Number(productId));
    setDetailProduct(found ?? null);
  }, []);

  useEffect(() => {
    if (isFeaturedHovering) return;

    const interval = window.setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % featuredProducts.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [featuredProducts.length, isFeaturedHovering]);

  const goToFeaturedSlide = (direction: "prev" | "next") => {
    setFeaturedIndex((prev) => {
      if (direction === "next") {
        return (prev + 1) % featuredProducts.length;
      }
      return (prev - 1 + featuredProducts.length) % featuredProducts.length;
    });
  };

  if (detailProduct) {
    return (
      <>
        <ProductDetailPage
          product={detailProduct}
          user={user}
          totalItems={totalItems}
          onBack={() => {
            setDetailProduct(null);
            window.history.replaceState({}, "", window.location.pathname);
          }}
          onOpenAuth={() => {
            setAuthMode("login");
            setAuthOpen(true);
          }}
          onLogout={handleLogout}
          onOpenCart={() => setCartOpen(true)}
          onAddToCart={addToCart}
        />

        {cartOpen && (
          <CartDrawer
            items={cartItems}
            totalPrice={totalPrice}
            user={user}
            onClose={() => setCartOpen(false)}
            onRemove={removeFromCart}
            onChangeQty={changeQty}
            onClearCart={clearCart}
            onOpenAuth={() => { setCartOpen(false); setAuthMode("login"); setAuthOpen(true); }}
          />
        )}

        {authOpen && (
          <AuthModal
            mode={authMode}
            onClose={() => setAuthOpen(false)}
            onLogin={handleLogin}
            onSwitchMode={() => setAuthMode((m) => (m === "login" ? "register" : "login"))}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <button onClick={() => {
              window.scrollTo({
                top: 0,
              });
            }}
              className="flex items-baseline gap-1.5 group"
            >
              <span className="text-3xl font-bold text-primary leading-none" style={{ fontFamily: '"Bodoni Moda", serif', fontWeight: 500, letterSpacing: '0.25em' }}>LÖWEN</span>
            </button>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-7">
              <button
                onClick={() => {
                  window.scrollTo({
                    top: 0,
                  });
                }}
                className={`text-sm font-medium cursor-pointer transition-colors hover:text-primary ${activeCategory === "todos" ? "text-primary" : ""
                  }`}
              >
                Início
              </button>

              {/* Categorias dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setCatDropdownOpen((v) => !v)}
                  className="flex items-center gap-1 text-sm font-medium cursor-pointer hover:text-primary transition-colors"
                >
                  Categorias
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${catDropdownOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {catDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => selectCategory(cat.value)}
                        className={`w-full text-left px-4 py-2.5 text-sm cursor-pointer transition-colors hover:bg-muted ${activeCategory === cat.value ? "text-primary font-medium bg-muted" : ""
                          }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <a
                href="#contato"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                Contato
              </a>
            </nav>




            {/* Right actions */}
            <div className="flex items-center gap-2">
              {user ? (
                <div className="hidden md:flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">{user.name.split(" ")[0]}</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    title="Sair"
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setAuthMode("login"); setAuthOpen(true); }}
                  className="hidden md:flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:text-primary transition-all"
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
                onClick={() => selectCategory("todos")}
                className="w-full text-left px-3 py-2.5 text-sm font-medium rounded-lg hover:bg-muted"
              >
                <a href="#home">Todas as Peças</a>
              </button>
              <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Categorias
              </div>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => selectCategory(cat.value)}
                  className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors ${activeCategory === cat.value ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                    }`}
                >
                  {cat.label}
                </button>
              ))}
              <a
                href="#contato"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 text-sm font-medium hover:bg-muted rounded-lg"
              >
                Contato
              </a>
              {!user && (
                <button
                  onClick={() => { setAuthOpen(true); setAuthMode("login"); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm font-medium text-primary rounded-lg hover:bg-primary/10"
                >
                  Entrar / Cadastrar
                </button>
              )}
              {user && (
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="w-full text-left px-3 py-2.5 text-sm font-medium text-muted-foreground rounded-lg hover:bg-muted"
                >
                  Sair da conta
                </button>
              )}
            </div>
          )}
        </div>
      </header>

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
                    <img
                      src={product.id === 0 ? leaoBarrocoAmbas : product.imageUrl}
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
                          className={`h-1.5 rounded-full transition-all ${
                            featuredIndex === index ? "w-6 bg-white" : "w-1.5 bg-white/45 hover:bg-white/75"
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
              {/* Size filter */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" /> Tamanhos
                </h3>
                <div className="grid grid-cols-3 gap-1.5">
                  {ALL_SIZES.map((size) => (
                    <button
                      key={size}
                      onClick={() => toggleSize(size)}
                      className={`h-9 text-sm font-medium border transition-all duration-150 ${selectedSizes.includes(size)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:border-primary/50 hover:bg-muted"
                        }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {selectedSizes.length > 0 && (
                  <button
                    onClick={() => setSelectedSizes([])}
                    className="mt-2.5 text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              {/* Category filter */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  Categoria
                </h3>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setActiveCategory("todos")}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${activeCategory === "todos"
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-foreground"
                      }`}
                  >
                    Todos
                  </button>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setActiveCategory(cat.value)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${activeCategory === cat.value
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground"
                        }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* ── Products section ─────────────────────────────────────────── */}
          <section className="flex-1 min-w-0">
            {/* Section header */}
            <div className="flex items-end justify-between mb-6 gap-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-foreground leading-tight">
                  {activeCatLabel}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {filteredProducts.length}{" "}
                  {filteredProducts.length === 1 ? "peça encontrada" : "peças encontradas"}
                </p>
              </div>

              {/* Mobile size filter */}
              <div className="lg:hidden flex gap-1 flex-wrap justify-end">
                {ALL_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => toggleSize(size)}
                    className={`h-8 px-2.5 text-xs font-medium border transition-all ${selectedSizes.includes(size)
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
                    className="h-8 px-2 text-xs text-muted-foreground border border-border hover:text-primary"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground gap-3">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                  <ShoppingCart className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="text-base font-medium">Nenhuma peça encontrada</p>
                <p className="text-sm">Tente ajustar os filtros de tamanho ou categoria</p>
                <button
                  onClick={() => { setSelectedSizes([]); setActiveCategory("todos"); }}
                  className="mt-1 text-sm text-primary underline underline-offset-2 hover:opacity-80"
                >
                  Limpar todos os filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onAddToCart={addToCart} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

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
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground mb-3">Contato</h4>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li>📍 Curitiba, PR — Brasil</li>
                <li>✉️ contato@lowen.com.br</li>
                <li>📱 (41) 99999-9999</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground mb-3">Horário</h4>
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
          items={cartItems}
          totalPrice={totalPrice}
          user={user}
          onClose={() => setCartOpen(false)}
          onRemove={removeFromCart}
          onChangeQty={changeQty}
          onClearCart={clearCart}
          onOpenAuth={() => { setCartOpen(false); setAuthMode("login"); setAuthOpen(true); }}
        />
      )}

      {!cartOpen && (
        <a
          href="https://wa.me/5541999999999"
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
          onSwitchMode={() => setAuthMode((m) => (m === "login" ? "register" : "login"))}
        />
      )}
    </div>
  );
}

function ProductDetailPage({
  product,
  user,
  totalItems,
  onBack,
  onOpenAuth,
  onLogout,
  onOpenCart,
  onAddToCart,
}: {
  product: Product;
  user: AuthUser | null;
  totalItems: number;
  onBack: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenCart: () => void;
  onAddToCart: (p: Product, s: Size) => void;
}) {
  const productImages = product.images && product.images.length > 0 ? product.images : [product.imageUrl];
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [added, setAdded] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border shadow-sm">
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

            <nav className="hidden md:flex items-center gap-7">
              <button
                onClick={() => {
                  window.location.href = window.location.origin;
                }}
                className="text-sm font-medium cursor-pointer transition-colors hover:text-primary"
              >
                Início
              </button>
              <a href="/#contato" className="text-sm font-medium hover:text-primary transition-colors">Contato</a>
            </nav>

            <div className="flex items-center gap-2">
              {user ? (
                <div className="hidden md:flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">{user.name.split(" ")[0]}</span>
                  </div>
                  <button
                    onClick={onLogout}
                    title="Sair"
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenAuth}
                  className="hidden md:flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-border hover:border-primary/40 hover:text-primary transition-all"
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
              <img
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
                    className={`relative h-20 w-20 shrink-0 overflow-hidden border transition-all ${
                      activeImageIndex === index ? "border-primary" : "border-border"
                    }`}
                  >
                    <img src={image} alt={`${product.name} ${index + 1}`} className="h-full w-full object-contain bg-muted" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground mb-2">
                {product.category}
              </p>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold leading-tight text-foreground">
                {product.name}
              </h1>
            </div>

            <div className="text-2xl font-bold text-primary">{formatPrice(product.price)}</div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Tamanhos
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize((current) => (current === size ? null : size))}
                    className={`min-w-[48px] border px-3 py-2 text-sm font-medium text-center transition-all ${
                      selectedSize === size
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
              disabled={!selectedSize}
              onClick={() => {
                if (!selectedSize) return;
                onAddToCart(product, selectedSize);
                setAdded(true);
                setTimeout(() => setAdded(false), 1800);
              }}
              className={`w-full py-3 text-sm font-semibold uppercase tracking-[0.18em] transition ${
                added
                  ? "bg-accent text-accent-foreground"
                  : selectedSize
                    ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {added ? "✓ Adicionado!" : selectedSize ? "Adicionar ao carrinho" : "Selecione o tamanho"}
            </button>

            <div className="border-t border-border pt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Detalhes
              </p>
              <p className="text-sm leading-relaxed text-foreground/80">
                Peça exclusiva com acabamento premium, ideal para compor looks com personalidade e identidade.
                Disponível em tamanhos selecionados e com visual versátil para uso casual ou statement.
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
  product,
  onAddToCart,
}: {
  product: Product;
  onAddToCart: (p: Product, s: Size) => void;
}) {
  const [selectedSize, setSelectedSize] = useState<Size | null>(null);
  const [added, setAdded] = useState(false);
  const [liked, setLiked] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const productImages = product.images && product.images.length > 0 ? product.images : [product.imageUrl];
  const hasMultipleImages = productImages.length > 1;

  function handleAdd() {
    if (!selectedSize) return;
    onAddToCart(product, selectedSize);
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
          href={`?productId=${product.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block h-full w-full"
        >
          <img
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
                  className={`h-1.5 rounded-full transition-all ${
                    currentImageIndex === index ? "w-5 bg-white" : "w-1.5 bg-white/60 hover:bg-white/90"
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
          onClick={() => setLiked((v) => !v)}
          className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-transparent text-black transition hover:bg-white/10"
          aria-label="Favoritar"
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

        {/* Color swatch */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            title={product.color.name}
            aria-label={product.color.name}
            className="h-5 w-5 border border-border rounded-none shadow-sm transition hover:border-primary/50"
            style={{ backgroundColor: product.color.value }}
          />
        </div>

        {/* Size buttons */}
        <div className="flex gap-1 flex-wrap">
          {product.sizes.map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize((s) => (s === size ? null : size))}
              className={`text-xs px-2 py-1 border font-medium transition-all rounded-none ${selectedSize === size
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
          disabled={!selectedSize}
          className={`mt-auto w-full py-2 text-sm font-semibold transition-all duration-200 rounded-none ${added
            ? "bg-accent text-accent-foreground"
            : selectedSize
              ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
              : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
        >
          {added ? "✓ Adicionado!" : selectedSize ? "Adicionar ao carrinho" : "Selecione o tamanho"}
        </button>
      </div>
    </div>
  );
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({
  items,
  totalPrice,
  user,
  onClose,
  onRemove,
  onChangeQty,
  onClearCart,
  onOpenAuth,
}: {
  items: CartItem[];
  totalPrice: number;
  user: AuthUser | null;
  onClose: () => void;
  onRemove: (id: number, size: Size) => void;
  onChangeQty: (id: number, size: Size, delta: number) => void;
  onOpenAuth: () => void;
  onClearCart: () => void;
}) {
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
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card shadow-2xl flex flex-col">
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
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
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
                key={`${item.product.id}-${item.size}`}
                className="flex gap-3 p-3 rounded-xl bg-muted/40 border border-border/60"
              >
                {/* Thumb */}
                <div className="w-18 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                  <img
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
                    Tamanho: <span className="font-semibold text-foreground">{item.size}</span>
                  </p>
                  <p className="text-sm font-bold text-primary">{formatPrice(item.product.price)}</p>
                  {/* Qty controls */}
                  <div className="flex items-center gap-2 mt-auto">
                    <button
                      onClick={() => onChangeQty(item.product.id, item.size, -1)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      onClick={() => onChangeQty(item.product.id, item.size, 1)}
                      className="w-7 h-7 rounded-lg border border-border flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onRemove(item.product.id, item.size)}
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
              <button onClick={onClearCart} className="flex items-center gap-3 py-0 px-0 rounded-x1 border-border text-sm text-destructive font-medium hover:bg-muted transition-colors">
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
  onSwitchMode,
}: {
  mode: "login" | "register";
  onClose: () => void;
  onLogin: (user: AuthUser) => void;
  onSwitchMode: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  function validate() {
    if (!email.includes("@")) return "E-mail inválido";
    if (password.length < 6) return "Senha deve ter ao menos 6 caracteres";
    if (mode === "register" && name.trim().length < 2) return "Nome muito curto";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setLoading(true);

    // Simulate API call — replace with real Axios call to your backend
    await new Promise((res) => setTimeout(res, 900));

    // Mock success
    onLogin({
      id: Math.random().toString(36).slice(2),
      name: mode === "register" ? name : email.split("@")[0],
      email,
    });
    setLoading(false);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border overflow-hidden">
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            <button
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
                ? "Acesse sua conta para sincronizar seu carrinho"
                : "Cadastre-se para salvar seus favoritos e pedidos"}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl text-black bg-input-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
                required
              />
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm mt-1 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading
                ? "Aguarde..."
                : mode === "login"
                  ? "Entrar"
                  : "Criar conta"}
            </button>

            <p className="text-center text-xs text-muted-foreground pt-1">
              {mode === "login" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
              <button
                type="button"
                onClick={onSwitchMode}
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
