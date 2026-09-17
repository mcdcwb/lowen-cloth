import { Link } from "react-router";
import type { Account } from "../lib/auth";

export function AccountPage({ user, favorites, onLogin }: {
  user: Account | null; favorites: boolean; onLogin: () => void;
}) {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-16 min-h-[60vh]">
      <Link to="/" className="text-sm text-muted-foreground hover:text-primary">← Voltar para a loja</Link>
      <section className="mt-8 p-6 sm:p-8 bg-card border border-border rounded-xl">
        {user?.role === "USER" ? (
          <>
            <h1 className="font-serif text-3xl font-bold">{favorites ? "Favoritos" : "Minha Conta"}</h1>
            <p className="mt-4 text-muted-foreground">{favorites
              ? "Em breve, suas peças favoritas estarão aqui."
              : `Olá, ${user.name.trim().split(/\s+/)[0]}! Este é o espaço da sua conta.`}</p>
          </>
        ) : (
          <>
            <h1 className="font-serif text-3xl font-bold">Área de clientes</h1>
            <p className="mt-4 text-muted-foreground">Entre com uma conta de cliente para acessar esta página.</p>
            {!user && <button onClick={onLogin} className="mt-6 px-5 py-2 rounded-lg bg-primary text-primary-foreground">Entrar</button>}
          </>
        )}
      </section>
    </main>
  );
}
