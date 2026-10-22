import { businessHoursLines } from "../lib/business-hours";
import { formatCep } from "../lib/address";
import { formatWhatsapp } from "../lib/store-settings";
import { useStoreDetails } from "../hooks/useStoreDetails";

export function StoreFooter({ store }: { store: ReturnType<typeof useStoreDetails> }) {
  return (
    <footer id="contato" className="mt-20 bg-secondary border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid md:grid-cols-3 gap-10 text-center md:text-left">
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-xl font-bold text-primary leading-none" style={{ fontFamily: '"Bodoni Moda", serif', fontWeight: 500, letterSpacing: '0.25em' }}>LÖWEN</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">Vestindo fé. Carregando propósito.</p>
          </div>
          <div className="flex flex-col items-center md:text-center">
            <h4 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground mb-3">Contato</h4>
            <ul className="space-y-2 text-sm text-foreground/80">
              {store.address ? <li><address className="not-italic break-words">
                {store.address.street}, {store.address.number}{store.address.complement ? ` · ${store.address.complement}` : ""}<br />
                {store.address.neighborhood}<br />{store.address.city} - {store.address.state}<br />CEP {formatCep(store.address.cep)}
              </address></li> : <li>Endereço da loja ainda não informado.</li>}
              <li>✉️ contato@lowen.com.br</li>
              {store.whatsapp && <li>📱 {formatWhatsapp(store.whatsapp)}</li>}
            </ul>
          </div>
          <div className="flex flex-col items-center md:items-end md:text-right">
            <h4 className="font-semibold text-sm uppercase tracking-widest text-muted-foreground mb-3">Horário loja física</h4>
            <ul className="space-y-2 text-sm text-foreground/80">
              {store.businessHours ? businessHoursLines(store.businessHours).map(line => <li key={line}>{line}</li>) : <li>{store.loading ? "Carregando horários..." : "Horários de funcionamento indisponíveis."}</li>}
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground text-center">
          © 2026 Löwen - Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
