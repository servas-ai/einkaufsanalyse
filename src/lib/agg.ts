import type { Receipt } from './data'
export type Gran = 'Tag' | 'Woche' | 'Monat'
export function bucket(iso: string, g: Gran) {
  const d = new Date(iso)
  if (g === 'Monat') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  if (g === 'Woche') { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.toISOString().slice(0, 10) }
  return iso.slice(0, 10)
}
export const label = (k: string, g: Gran) => g === 'Monat' ? new Date(k + '-01').toLocaleDateString('de-AT', { month: 'short', year: '2-digit' }) : new Date(k).toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })
export function series(rs: Receipt[], g: Gran) {
  const m = new Map<string, { k: string; spend: number; protein: number; protSpend: number; hs: number; hn: number; ready: number; ing: number; n: number }>()
  for (const r of rs) {
    const k = bucket(r.date, g); const o = m.get(k) ?? { k, spend: 0, protein: 0, protSpend: 0, hs: 0, hn: 0, ready: 0, ing: 0, n: 0 }
    o.spend += r.total; o.n++
    for (const i of r.items) { if (i.protein) { o.protein += i.protein; o.protSpend += i.price } if (i.health != null) { o.hs += i.health * i.price; o.hn += i.price } if (i.ready) o.ready += i.price; else if (i.category !== 'Drogerie & Haushalt' && i.category !== 'Getränke') o.ing += i.price }
    m.set(k, o)
  }
  return [...m.values()].sort((a, b) => a.k.localeCompare(b.k)).map(o => ({ ...o, label: label(o.k, g), spend: +o.spend.toFixed(2), protein: Math.round(o.protein), eur10p: o.protein ? +(o.protSpend / o.protein * 10).toFixed(2) : null, health: o.hn ? +(o.hs / o.hn).toFixed(1) : null, ready: +o.ready.toFixed(2), ing: +o.ing.toFixed(2) }))
}
export function by<K extends string>(rs: Receipt[], f: (r: Receipt, i: Receipt['items'][number]) => K | null) {
  const m = new Map<K, { k: K; spend: number; n: number; qty: number }>()
  for (const r of rs) for (const i of r.items) { const k = f(r, i); if (k == null) continue; const o = m.get(k) ?? { k, spend: 0, n: 0, qty: 0 }; o.spend += i.price; o.n++; o.qty += i.qty; m.set(k, o) }
  return [...m.values()].map(o => ({ ...o, spend: +o.spend.toFixed(2) })).sort((a, b) => b.spend - a.spend)
}
export function stores(rs: Receipt[]) {
  const m = new Map<string, { k: string; spend: number; n: number }>()
  for (const r of rs) { const o = m.get(r.store) ?? { k: r.store, spend: 0, n: 0 }; o.spend += r.total; o.n++; m.set(r.store, o) }
  return [...m.values()].map(o => ({ ...o, spend: +o.spend.toFixed(2), avg: +(o.spend / o.n).toFixed(2) })).sort((a, b) => b.spend - a.spend)
}
export function heat(rs: Receipt[]) {
  const g = Array.from({ length: 7 }, () => Array(24).fill(0) as number[])
  for (const r of rs) { const d = new Date(r.date); g[(d.getDay() + 6) % 7][d.getHours()] += r.total }
  return g
}
export function priceTrends(rs: Receipt[]) {
  const m = new Map<string, { d: string; p: number; s: string }[]>()
  for (const r of rs) for (const i of r.items) { const k = i.name.trim(); const a = m.get(k) ?? []; a.push({ d: r.date, p: +(i.price / (i.qty || 1)).toFixed(2), s: r.store }); m.set(k, a) }
  return [...m.entries()].filter(([, a]) => a.length >= 3).map(([k, a]) => { a.sort((x, y) => x.d.localeCompare(y.d)); const f = a[0].p, l = a[a.length - 1].p; return { k, pts: a, first: f, last: l, ch: f ? (l - f) / f * 100 : 0, n: a.length } }).sort((a, b) => b.n - a.n)
}
