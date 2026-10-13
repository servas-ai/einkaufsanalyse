import { STORES, chainOf } from './lib/data'
import { useApp } from './ctx'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { ReactNode } from 'react'
export const C1 = 'hsl(var(--c1))', C2 = 'hsl(var(--c2))', C3 = 'hsl(var(--c3))', C4 = 'hsl(var(--c4))', C5 = 'hsl(var(--c5))'
export const axis = { stroke: 'hsl(var(--muted-foreground))', fontSize: 12, tickLine: false, axisLine: false } as const
export const tip = { contentStyle: { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 13 }, labelStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 } }
export function StoreLogo({ store, size = 40 }: { store: string; size?: number }) {
  const { base } = useApp(); const s = STORES[store] ?? STORES[chainOf(store)]
  return <div className="flex shrink-0 items-center justify-center rounded-xl border bg-white p-1.5" style={{ width: size * 1.6, height: size }}>
    {s?.logo ? <img src={`${base}logos/${s.logo}`} alt={store} className="max-h-full max-w-full object-contain" /> : <span className="text-xs font-bold" style={{ color: s?.color ?? '#555' }}>{store.slice(0, 8)}</span>}
  </div>
}
export function Kpi({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: ReactNode }) {
  return <Card className="shadow-none"><CardContent className="p-5">
    <div className="flex items-center justify-between text-sm text-muted-foreground">{label}{icon}</div>
    <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums">{value}</div>
    {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
  </CardContent></Card>
}
export function Panel({ title, desc, children, right, className = '' }: { title: string; desc?: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return <Card className={`shadow-none min-w-0 ${className}`}><CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
    <div className="min-w-0"><CardTitle className="text-base">{title}</CardTitle>{desc && <CardDescription className="mt-1">{desc}</CardDescription>}</div>{right}
  </CardHeader><CardContent className="min-w-0">{children}</CardContent></Card>
}
export function Seg<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return <div className="inline-flex rounded-full border p-0.5 text-sm">{options.map(o => <button key={o} onClick={() => onChange(o)} className={`rounded-full px-3 py-1 transition ${o === value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}>{o}</button>)}</div>
}
export function Empty({ children }: { children: ReactNode }) { return <div className="flex h-40 items-center justify-center text-sm text-muted-foreground text-center px-4">{children}</div> }
