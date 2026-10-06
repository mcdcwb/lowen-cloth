import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { notify } from "../lib/notifications";
import { emptyAddress, formatCep, lookupCep, type Address } from "../lib/address";
import { formatWhatsapp, storeDetailsRequest } from "../lib/store-settings";
import { hoursDraft, hoursToInput } from "../lib/business-hours";
import { BusinessHoursFields } from "./BusinessHoursFields";
import { SettingsSectionContent } from "./SettingsSectionContent";

const fields: { key: keyof Address; label: string; max: number }[] = [
  { key: "cep", label: "CEP", max: 9 }, { key: "street", label: "Rua / Logradouro", max: 200 },
  { key: "number", label: "Número", max: 20 }, { key: "complement", label: "Complemento (opcional)", max: 100 },
  { key: "neighborhood", label: "Bairro", max: 100 }, { key: "city", label: "Cidade", max: 100 },
  { key: "state", label: "Estado / UF", max: 2 }
];
export function StoreDetailsForm({ token, onUnauthorized, onBusy, disabled = false }: {
  token: string; onUnauthorized: (message: string) => void; onBusy: (busy: boolean) => void; disabled?: boolean;
}) {
  const [address, setAddress] = useState<Address>({ ...emptyAddress });
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState(() => hoursDraft(null));
  const [saveError, setSaveError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [cepChanged, setCepChanged] = useState(false);
  const [cepStatus, setCepStatus] = useState("");
  const edited = useRef(new Set<keyof Address>());
  const pending = useRef(false);
  const alive = useRef(true);
  const callbacks = useRef({ onUnauthorized, onBusy }); callbacks.current = { onUnauthorized, onBusy };
  const requestController = useRef<AbortController | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; requestController.current?.abort(); callbacks.current.onBusy(false); }; }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 15000);
    setLoaded(false); setError("");
    storeDetailsRequest(token, undefined, controller.signal).then(details => {
      if (!active || controller.signal.aborted) return;
      setAddress(details.address ? { ...details.address, cep: formatCep(details.address.cep) } : { ...emptyAddress });
      setPhone(details.whatsapp ? formatWhatsapp(details.whatsapp) : ""); setLoaded(true);
      setHours(hoursDraft(details.businessHours));
    }).catch(reason => {
      if (!active) return;
      if (controller.signal.aborted) { setError("Não foi possível carregar os dados da loja. Tente novamente."); return; }
      setError(reason.message);
      if (reason.message.includes("não está autorizada")) callbacks.current.onUnauthorized(reason.message);
    }).finally(() => clearTimeout(timer));
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [token, revision]);
  useEffect(() => {
    const cep = address.cep.replace(/\D/g, "");
    setCepStatus("");
    if (!cepChanged || cep.length !== 8 || saving) return;
    const controller = new AbortController(); let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      setCepStatus("Buscando CEP..."); timeout = setTimeout(() => controller.abort(), 6000);
      lookupCep(cep, controller.signal).then(result => {
        if (!active) return;
        setAddress(previous => ({ ...previous, ...Object.fromEntries(Object.entries(result).filter(([key]) => !edited.current.has(key as keyof Address))) }));
        setCepStatus("CEP encontrado. Confira o endereço e informe o número.");
      }).catch(() => { if (active) setCepStatus("Consulta de CEP indisponível. Preencha o endereço manualmente."); }).finally(() => clearTimeout(timeout));
    }, 350);
    return () => { active = false; clearTimeout(timer); clearTimeout(timeout); controller.abort(); };
  }, [address.cep, cepChanged, saving]);
  const hasAddress = Object.values(address).some(value => value.trim());
  return <section className="mt-6 max-w-2xl rounded-xl border border-border bg-card p-6 sm:p-8" aria-labelledby="store-details-title">
    <SettingsSectionContent title="Dados da loja" headingId="store-details-title" className="mb-3">
    <p className="text-sm text-muted-foreground mb-5">Endereço comercial e contato exibidos na loja. O endereço é opcional; se preencher, informe todos os campos obrigatórios.</p>
    {!loaded ? <>{error ? <><p role="alert" className="text-destructive">{error}</p><button onClick={() => setRevision(n => n + 1)} className="min-h-11 underline text-primary">Recarregar dados da loja</button></> : <p role="status">Carregando dados da loja...</p>}</> :
    <form onSubmit={async event => {
      event.preventDefault(); if (pending.current || disabled) return;
      pending.current = true; setSaving(true); setCepChanged(false); callbacks.current.onBusy(true);
      setSaveError("");
      const controller = new AbortController(); requestController.current = controller;
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const details = await storeDetailsRequest(token, { address: hasAddress ? address : null, whatsapp: phone.trim() || null, businessHours: hoursToInput(hours) }, controller.signal);
        if (!alive.current) return;
        setAddress(details.address ? { ...details.address, cep: formatCep(details.address.cep) } : { ...emptyAddress });
        setPhone(details.whatsapp ? formatWhatsapp(details.whatsapp) : "");
        setHours(previous => hoursDraft(details.businessHours, previous));
        notify.positive("Dados da loja salvos com sucesso!"); window.dispatchEvent(new Event("store-details-updated"));
      } catch (reason) {
        if (!alive.current) return;
        const message = reason instanceof Error && reason.name !== "AbortError" ? reason.message : "Não foi possível salvar. Tente novamente.";
        toast.error(message);
        setSaveError(message);
        if (message.includes("não está autorizada")) callbacks.current.onUnauthorized(message);
      } finally { clearTimeout(timer); pending.current = false; requestController.current = null; callbacks.current.onBusy(false); if (alive.current) setSaving(false); }
    }}>
      <fieldset disabled={saving || disabled} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(field => <label key={field.key} className="block min-w-0 text-sm font-medium">{field.label}
            <input value={address[field.key]} maxLength={field.max} required={hasAddress && field.key !== "complement"}
              inputMode={field.key === "cep" ? "numeric" : undefined} pattern={field.key === "cep" ? "[0-9]{5}-[0-9]{3}" : undefined}
              className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 focus-visible:outline-2 focus-visible:outline-primary"
              onChange={event => {
                const value = field.key === "cep" ? formatCep(event.target.value) : field.key === "state" ? event.target.value.toUpperCase() : event.target.value;
                if (field.key === "cep") { edited.current.clear(); setCepChanged(true); } else edited.current.add(field.key);
                setAddress(previous => ({ ...previous, [field.key]: value }));
              }} />
          </label>)}
        </div>
        {cepStatus && <p role="status" className="text-sm text-muted-foreground">{cepStatus}</p>}
        <button type="button" className="min-h-11 underline text-sm" onClick={() => { setAddress({ ...emptyAddress }); setCepChanged(false); }}>Limpar endereço comercial</button>
        <label className="block text-sm font-medium">Telefone / WhatsApp
          <input type="tel" value={phone} maxLength={40} aria-describedby="store-phone-help" onChange={event => setPhone(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 focus-visible:outline-2 focus-visible:outline-primary" />
        </label>
        <p id="store-phone-help" className="text-sm text-muted-foreground">Informe DDD e número, com ou sem +55. Deixe vazio para ocultar o contato por WhatsApp.</p>
        <BusinessHoursFields value={hours} onChange={(day, update) => setHours(previous => ({ ...previous, [day]: { ...previous[day], ...update } }))} />
        {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
        <button disabled={saving} aria-busy={saving} className="min-h-11 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 font-medium disabled:opacity-50">{saving ? "Salvando dados da loja..." : "Salvar dados da loja"}</button>
      </fieldset>
    </form>}
    </SettingsSectionContent>
  </section>;
}
