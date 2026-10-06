import { WEEK_DAYS, dayLabels, type HoursDraft, type WeekDay } from "../lib/business-hours";
export function BusinessHoursFields({ value, onChange }: { value: HoursDraft; onChange: (day: WeekDay, update: Partial<HoursDraft[WeekDay]>) => void }) {
  return <fieldset className="space-y-3" aria-describedby="hours-help"><legend className="text-base font-semibold mb-2">Horário de funcionamento</legend>
    <p id="hours-help" className="text-sm text-muted-foreground">Configure cada dia. A abertura e o fechamento devem ocorrer no mesmo dia.</p>
    {WEEK_DAYS.map(day => <div key={day} className="grid gap-3 rounded-lg border border-border p-3 min-w-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-center">
      <div className="min-w-0"><p className="text-sm font-medium">{dayLabels[day]}</p><label className="inline-flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={value[day].isOpen} onChange={event => onChange(day, { isOpen: event.target.checked })} aria-label={`${dayLabels[day]} aberto`} className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-primary" /><span>{value[day].isOpen ? "Aberto" : "Fechado"}</span></label></div>
      <div className="grid min-w-0 gap-2 grid-cols-1 min-[390px]:grid-cols-2">
        {(["openingTime", "closingTime"] as const).map(field => <label key={field} className={`block min-w-0 text-xs ${value[day].isOpen ? "text-foreground" : "text-muted-foreground"}`}>{field === "openingTime" ? "Abertura" : "Fechamento"}<input type="time" step={60} required={value[day].isOpen} disabled={!value[day].isOpen} value={value[day][field]} onChange={event => onChange(day, { [field]: event.target.value })} aria-label={`${field === "openingTime" ? "Abertura" : "Fechamento"} ${dayLabels[day]}`} className="mt-1 min-h-11 min-w-0 w-full rounded-lg border border-border bg-background px-2 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed" /></label>)}
      </div>
    </div>)}
  </fieldset>;
}
