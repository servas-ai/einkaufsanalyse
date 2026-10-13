import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { Beef, Euro, HeartPulse, Receipt as RIcon, ShoppingBasket, TrendingDown, TrendingUp } from 'lucide-react'
import { useApp } from './ctx'
import { fmtEur } from './lib/data'
import { by, heat, priceTrends, series, stores, type Gran } from './lib/agg'
import { C1, C2, C3, C5, Empty, Kpi, Panel, Seg, StoreLogo, axis, tip } from './ui'
import { Badge } from '@/components/ui/badge'

function useTotals() {
  const { receipts } = useApp()
  return useMemo(() => {
    const spend = receipts.reduce((s, r) => s + r.total, 0)
    let prot = 0, protSpend = 0, hs = 0, hn = 0, ready = 0, linked = 0, items = 0
    for (const r of receipts) for (const i of r.items) { items++; if (i.protein) { prot += i.protein; protSpend += i.price } if (i.health != null) { hs += i.health * i.price; hn += i.price } if (i.ready) ready += i.price; if (i.fgId != null) linked++ }
    return { spend, n: receipts.length, avg: receipts.length ? spend / receipts.length : 0, prot, eur10p: prot ? protSpend / prot * 10 : 0, health: hn ? hs / hn : null, ready, items, linked }
  }, [receipts])
}
const H = 260

export function Uebersicht() {
  const { receipts } = useApp(); const t = useTotals(); const [g, setG] = useState<Gran>('Woche')
  const s = useMemo(() => series(receipts, g), [receipts, g]); const st = useMemo(() => stores(receipts).slice(0, 5), [receipts])
  const span = receipts.length ? `${new Date(receipts[receipts.length - 1].date).toLocaleDateString('de-AT')} – ${new Date(receipts[0].date).toLocaleDateString('de-AT')}` : ''
  return <div className="space-y-6">
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Kpi label="Ausgaben" value={fmtEur(t.spend)} sub={span} icon={<Euro className="size-4" />} />
      <Kpi label="Einkäufe" value={String(t.n)} sub={`Ø ${fmtEur(t.avg)} pro Bon`} icon={<RIcon className="size-4" />} />
      <Kpi label="Protein gekauft" value={`${(t.prot / 1000).toFixed(1)} kg`} sub={`${t.eur10p.toFixed(2).replace('.', ',')} € pro 10 g Protein`} icon={<Beef className="size-4" />} />
      <Kpi label="Health-Score" value={t.health != null ? t.health.toFixed(1).replace('.', ',') : '–'} sub={`${t.linked} von ${t.items} Artikeln mit Fertiggerichte-Daten`} icon={<HeartPulse className="size-4" />} />
    </div>
    <Panel title="Ausgaben im Verlauf" right={<Seg value={g} options={['Tag', 'Woche', 'Monat']} onChange={setG} />}>
      {s.length ? <ResponsiveContainer height={H + 40}><AreaChart data={s} margin={{ left: -10, right: 8 }}>
        <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C1} stopOpacity={0.25} /><stop offset="1" stopColor={C1} stopOpacity={0} /></linearGradient></defs>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="label" {...axis} minTickGap={24} /><YAxis {...axis} tickFormatter={v => `${v} €`} />
        <Tooltip {...tip} formatter={(v: any) => [fmtEur(+v), 'Ausgaben']} /><Area dataKey="spend" stroke={C1} strokeWidth={2.5} fill="url(#ga)" type="monotone" />
      </AreaChart></ResponsiveContainer> : <Empty>Noch keine Einkäufe.</Empty>}
    </Panel>
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Top-Läden"><StoreList rows={st} total={t.spend} /></Panel>
      <Panel title="Fertiggerichte vs. Zutaten" desc="Anteil der Ausgaben für Lebensmittel"><ReadyVsIng /></Panel>
    </div>
  </div>
}
function StoreList({ rows, total }: { rows: ReturnType<typeof stores>; total: number }) {
  return <div className="space-y-4">{rows.map(r => <div key={r.k} className="flex items-center gap-4">
    <StoreLogo store={r.k} size={36} />
    <div className="min-w-0 flex-1"><div className="flex justify-between text-sm"><span className="font-medium truncate">{r.k}</span><span className="tabular-nums font-semibold">{fmtEur(r.spend)}</span></div>
      <div className="mt-1.5 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(r.spend / total) * 100}%` }} /></div>
      <div className="mt-1 text-xs text-muted-foreground">{r.n} Einkäufe · Ø {fmtEur(r.avg)}</div></div>
  </div>)}</div>
}
function ReadyVsIng() {
  const { receipts } = useApp(); let ready = 0, ing = 0
  for (const r of receipts) for (const i of r.items) { if (i.ready) ready += i.price; else if (!['Drogerie & Haushalt', 'Getränke'].includes(i.category ?? '')) ing += i.price }
  const tot = ready + ing || 1
  return <div className="space-y-5 pt-2">
    <div className="flex h-4 overflow-hidden rounded-full"><div className="bg-primary" style={{ width: `${ready / tot * 100}%` }} /><div className="bg-foreground/20" style={{ width: `${ing / tot * 100}%` }} /></div>
    <div className="grid grid-cols-2 gap-4">
      <div><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="size-2.5 rounded-full bg-primary" />Fertiggerichte</div><div className="mt-1 text-2xl font-bold">{Math.round(ready / tot * 100)} %</div><div className="text-xs text-muted-foreground">{fmtEur(ready)}</div></div>
      <div><div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="size-2.5 rounded-full bg-foreground/20" />Zutaten & Grundnahrung</div><div className="mt-1 text-2xl font-bold">{Math.round(ing / tot * 100)} %</div><div className="text-xs text-muted-foreground">{fmtEur(ing)}</div></div>
    </div>
  </div>
}

const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
export function Verlauf() {
  const { receipts } = useApp(); const [g, setG] = useState<Gran>('Monat')
  const s = useMemo(() => series(receipts, g), [receipts, g]); const h = useMemo(() => heat(receipts), [receipts]); const pt = useMemo(() => priceTrends(receipts).slice(0, 12), [receipts])
  const max = Math.max(1, ...h.flat()); const hours = Array.from({ length: 16 }, (_, i) => i + 6)
  return <div className="space-y-6">
    <Panel title="Ausgaben je Zeitraum" right={<Seg value={g} options={['Tag', 'Woche', 'Monat']} onChange={setG} />}>
      <ResponsiveContainer height={H}><BarChart data={s} margin={{ left: -10 }}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="label" {...axis} minTickGap={16} /><YAxis {...axis} tickFormatter={v => `${v} €`} /><Tooltip {...tip} cursor={{ fill: 'hsl(var(--muted))' }} formatter={(v: any) => [fmtEur(+v), 'Ausgaben']} /><Bar dataKey="spend" fill={C1} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
    </Panel>
    <Panel title="Wann kaufst du ein?" desc="Ausgaben nach Wochentag und Uhrzeit">
      <div className="overflow-x-auto"><div className="min-w-[560px]">
        <div className="grid gap-1" style={{ gridTemplateColumns: `32px repeat(${hours.length},1fr)` }}>
          <div />{hours.map(x => <div key={x} className="text-center text-[11px] text-muted-foreground">{x}</div>)}
          {DAYS.map((d, di) => [<div key={d} className="text-xs text-muted-foreground self-center">{d}</div>, ...hours.map(x => { const v = h[di][x]; return <div key={d + x} title={`${d} ${x}:00 – ${fmtEur(v)}`} className="aspect-square rounded-md" style={{ background: v ? `hsl(var(--c1) / ${0.12 + 0.88 * v / max})` : 'hsl(var(--muted))' }} /> })])}
        </div></div></div>
    </Panel>
    <Panel title="Preisentwicklung wiederkehrender Artikel" desc="Stückpreis, mindestens 3 Käufe">
      {pt.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{pt.map(p => <div key={p.k} className="rounded-xl border p-4">
        <div className="flex items-start justify-between gap-2"><div className="text-sm font-medium leading-snug line-clamp-2">{p.k}</div>
          <Badge variant="outline" className={`shrink-0 gap-1 ${p.ch > 0.5 ? 'text-destructive' : p.ch < -0.5 ? 'text-emerald-600' : ''}`}>{p.ch > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{p.ch.toFixed(1).replace('.', ',')} %</Badge></div>
        <div className="mt-1 text-xs text-muted-foreground">{fmtEur(p.first)} → {fmtEur(p.last)} · {p.n}×</div>
        <ResponsiveContainer height={48}><LineChart data={p.pts}><Line dataKey="p" stroke={C2} dot={false} strokeWidth={2} /><YAxis hide domain={['dataMin', 'dataMax']} /></LineChart></ResponsiveContainer>
      </div>)}</div> : <Empty>Noch zu wenige wiederholte Käufe.</Empty>}
    </Panel>
  </div>
}

export function Laeden() {
  const { receipts } = useApp(); const st = useMemo(() => stores(receipts), [receipts]); const tot = st.reduce((s, r) => s + r.spend, 0)
  return <div className="space-y-6">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{st.map(r => <div key={r.k} className="rounded-2xl border p-5">
      <div className="flex items-center justify-between gap-3"><StoreLogo store={r.k} size={52} /><div className="text-right"><div className="text-2xl font-bold tabular-nums">{fmtEur(r.spend)}</div><div className="text-xs text-muted-foreground">{Math.round(r.spend / tot * 100)} % aller Ausgaben</div></div></div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm"><div><div className="text-muted-foreground text-xs">Einkäufe</div><div className="font-semibold">{r.n}</div></div><div><div className="text-muted-foreground text-xs">Ø Bon</div><div className="font-semibold">{fmtEur(r.avg)}</div></div></div>
    </div>)}</div>
    <Panel title="Ausgaben je Laden"><ResponsiveContainer height={Math.max(160, st.length * 44)}><BarChart data={st} layout="vertical" margin={{ left: 10, right: 16 }}><XAxis type="number" {...axis} tickFormatter={v => `${v} €`} /><YAxis type="category" dataKey="k" {...axis} width={80} /><Tooltip {...tip} cursor={{ fill: 'hsl(var(--muted))' }} formatter={(v: any) => [fmtEur(+v), 'Ausgaben']} /><Bar dataKey="spend" fill={C1} radius={[0, 6, 6, 0]} barSize={22} /></BarChart></ResponsiveContainer></Panel>
  </div>
}

export function Kategorien() {
  const { receipts, fg } = useApp()
  const cats = useMemo(() => by(receipts, (_r, i) => i.category ?? 'Sonstiges'), [receipts]); const top = useMemo(() => by(receipts, (_r, i) => i.name).slice(0, 15), [receipts])
  const tot = cats.reduce((s, c) => s + c.spend, 0)
  const img = (name: string) => { for (const r of receipts) for (const i of r.items) if (i.name === name && i.fgId != null) return fg.get(i.fgId)?.img; return undefined }
  return <div className="space-y-6">
    <Panel title="Ausgaben je Kategorie">
      <div className="space-y-3">{cats.map((c, i) => <div key={c.k} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm"><span className="truncate">{c.k}</span><div className="h-2.5 rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${c.spend / cats[0].spend * 100}%`, background: i === 0 ? C1 : C2, opacity: i === 0 ? 1 : 0.55 }} /></div><span className="tabular-nums font-medium w-24 text-right">{fmtEur(c.spend)} <span className="text-muted-foreground text-xs">{Math.round(c.spend / tot * 100)}%</span></span></div>)}</div>
    </Panel>
    <Panel title="Top-Produkte" desc="nach Ausgaben">
      <div className="divide-y">{top.map((p, i) => { const im = img(p.k); return <div key={p.k} className="flex items-center gap-3 py-2.5">
        <span className="w-5 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
        <div className="size-10 shrink-0 overflow-hidden rounded-lg bg-muted">{im && <img src={im} alt="" loading="lazy" className="size-full object-cover" />}</div>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{p.k}</div><div className="text-xs text-muted-foreground">{p.qty}× gekauft</div></div>
        <div className="tabular-nums text-sm font-semibold">{fmtEur(p.spend)}</div></div> })}</div>
    </Panel>
  </div>
}

export function Protein() {
  const { receipts, fg } = useApp(); const [g, setG] = useState<Gran>('Woche'); const s = useMemo(() => series(receipts, g), [receipts, g])
  const linked = useMemo(() => { const m = new Map<number, number>(); for (const r of receipts) for (const i of r.items) if (i.fgId != null) m.set(i.fgId, (m.get(i.fgId) ?? 0) + i.qty); return [...m.entries()].map(([id, n]) => ({ f: fg.get(id)!, n })).filter(x => x.f).sort((a, b) => (a.f.e ?? 99) - (b.f.e ?? 99)) }, [receipts, fg])
  return <div className="space-y-6">
    <div className="flex justify-end"><Seg value={g} options={['Tag', 'Woche', 'Monat']} onChange={setG} /></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Protein gekauft" desc="Gramm je Zeitraum"><ResponsiveContainer height={H}><BarChart data={s} margin={{ left: -10 }}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="label" {...axis} minTickGap={16} /><YAxis {...axis} /><Tooltip {...tip} cursor={{ fill: 'hsl(var(--muted))' }} formatter={(v: any) => [`${v} g`, 'Protein']} /><Bar dataKey="protein" fill={C3} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></Panel>
      <Panel title="€ pro 10 g Protein" desc="niedriger ist besser"><ResponsiveContainer height={H}><LineChart data={s} margin={{ left: -10 }}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="label" {...axis} minTickGap={16} /><YAxis {...axis} /><Tooltip {...tip} formatter={(v: any) => [`${(+v).toFixed(2)} €`, '€/10 g']} /><Line dataKey="eur10p" stroke={C1} strokeWidth={2.5} dot={false} connectNulls /></LineChart></ResponsiveContainer></Panel>
      <Panel title="Health-Score der Einkäufe" desc="ausgabengewichtet, nur Artikel mit Fertiggerichte-Daten"><ResponsiveContainer height={H}><LineChart data={s} margin={{ left: -10 }}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="label" {...axis} minTickGap={16} /><YAxis {...axis} /><Tooltip {...tip} formatter={(v: any) => [v, 'Health-Score']} /><Line dataKey="health" stroke={C2} strokeWidth={2.5} dot={false} connectNulls /></LineChart></ResponsiveContainer></Panel>
      <Panel title="Fertiggerichte vs. Zutaten" desc="€ je Zeitraum"><ResponsiveContainer height={H}><BarChart data={s} margin={{ left: -10 }}><CartesianGrid vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="label" {...axis} minTickGap={16} /><YAxis {...axis} /><Tooltip {...tip} cursor={{ fill: 'hsl(var(--muted))' }} formatter={(v: any, n: any) => [fmtEur(+v), n === 'ready' ? 'Fertiggerichte' : 'Zutaten']} /><Bar dataKey="ready" stackId="a" fill={C1} /><Bar dataKey="ing" stackId="a" fill={C5} radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></Panel>
    </div>
    <Panel title="Gekaufte Fertiggerichte aus dem Datensatz" desc="verknüpft mit dem Fertiggerichte-Vergleich, sortiert nach € pro 10 g Protein">
      {linked.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{linked.slice(0, 18).map(({ f, n }) => <div key={f.id} className="flex gap-3 rounded-xl border p-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">{f.img && <img src={f.img} alt="" loading="lazy" className="size-full object-cover" />}</div>
        <div className="min-w-0 text-sm"><div className="font-medium line-clamp-2 leading-snug">{f.n}</div><div className="mt-1 text-xs text-muted-foreground">{f.b ?? ''} · {f.s} · {n}×</div>
          <div className="mt-1.5 flex flex-wrap gap-1"><Badge variant="secondary">{f.pp ? `${Math.round(f.pp)} g Protein` : '–'}</Badge>{f.e != null && <Badge variant="secondary">{f.e.toFixed(2).replace('.', ',')} €/10 g</Badge>}{f.sc != null && <Badge variant="outline">Score {f.sc.toFixed(1)}</Badge>}</div></div>
      </div>)}</div> : <Empty>Keine Artikel mit dem Fertiggerichte-Datensatz verknüpft.</Empty>}
    </Panel>
  </div>
}
export { Cell }
