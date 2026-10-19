import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { User } from "lucide-react";

export function AccountMenu({ name, role, onLogout, compactMobile = false }: { name: string; role: "USER" | "ADMIN"; onLogout: () => void; compactMobile?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const location = useLocation();

  useEffect(() => setOpen(false), [location]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  return (
    <div ref={root} className="relative"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={event => {
        if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
      }}>
      <button ref={trigger} type="button" aria-expanded={open} aria-controls={id}
        onClick={() => setOpen(value => !value)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white bg-muted text-muted-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary">
        <User aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
        <span className={`${compactMobile ? "sr-only sm:not-sr-only " : ""}text-[15px] font-medium max-w-24 max-[390px]:max-w-6 sm:max-w-40 truncate`}>{name.trim().split(/\s+/)[0]}</span>
      </button>
      {open && (
        <div id={id} className="absolute top-full right-0 pt-2 w-44 z-50">
          <nav aria-label="Menu da conta" className="bg-card border border-border rounded-xl shadow-xl overflow-hidden text-[15px]">
            <Link to="/minha-conta" onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-muted focus-visible:bg-muted">Minha Conta</Link>
            {role === "ADMIN" && <Link to="/manager" onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-muted focus-visible:bg-muted">Painel Administrativo</Link>}
            <Link to="/favoritos" onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-muted focus-visible:bg-muted">Favoritos</Link>
            {role === "USER" && <Link to="/meus-pedidos" onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-muted focus-visible:bg-muted">Meus Pedidos</Link>}
            <button type="button" onClick={() => { setOpen(false); onLogout(); }} className="w-full text-left px-4 py-3 hover:bg-muted focus-visible:bg-muted">Sair</button>
          </nav>
        </div>
      )}
    </div>
  );
}
