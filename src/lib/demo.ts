import type { FG, Receipt } from './data'
// BEISPIELDATEN – künstlich erzeugt, KEINE echten Einkäufe
const BASIC: [string, number][] = [['Vollmilch 3,5% 1l', 1.49], ['Eier Freiland 10 Stk', 3.99], ['Bananen 1kg', 1.79], ['Vollkornbrot 500g', 2.49], ['Skyr Natur 450g', 2.29], ['Hühnerbrust Filet 400g', 6.99], ['Tomaten 500g', 2.19], ['Gouda Scheiben 150g', 1.99], ['Mineralwasser 1,5l', 0.59], ['Spaghetti 500g', 1.29], ['Haferflocken 500g', 1.09], ['Äpfel 1kg', 2.49], ['Topfen 250g', 1.19], ['Kaffee Bohnen 500g', 7.99], ['Schokolade 100g', 1.49], ['Chips 150g', 1.99], ['Zahnpasta', 1.95], ['Paprika rot', 0.99], ['Kartoffeln 2kg', 2.99], ['Linsen 500g', 1.89]]
export function makeDemo(fg: FG[]): Receipt[] {
  let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
  const stores = ['Billa', 'Spar', 'Hofer', 'Lidl', 'Penny', 'Billa', 'Spar', 'Interspar']
  const meals = fg.filter(f => f.pp && f.s && ['Billa', 'Spar', 'Hofer', 'Lidl'].includes(f.s))
  const out: Receipt[] = []; const end = new Date('2026-10-12T00:00:00')
  for (let d = 120; d >= 0; d--) {
    if (rnd() < 0.45) continue
    const store = pick(stores); const day = new Date(end.getTime() - d * 864e5)
    day.setHours(7 + Math.floor(rnd() * 13), Math.floor(rnd() * 60))
    const items = []
    const nb = 2 + Math.floor(rnd() * 7)
    for (let i = 0; i < nb; i++) { const [n, p] = pick(BASIC); const q = rnd() < 0.2 ? 2 : 1; items.push({ name: n, qty: q, price: +(p * q * (0.95 + rnd() * 0.15) + d * 0.0004).toFixed(2) }) }
    const own = meals.filter(m => store.includes(m.s!) || (m.s === 'Spar' && store === 'Interspar'))
    const nm = Math.floor(rnd() * 4); for (let i = 0; i < nm && own.length; i++) { const m = pick(own); items.push({ name: `${m.b ? m.b + ' ' : ''}${m.n}`, qty: 1, price: m.p, fgId: m.id }) }
    out.push({ id: `demo-${d}`, store, date: day.toISOString(), total: +items.reduce((s, x) => s + x.price, 0).toFixed(2), items, source: 'Beispieldaten', demo: true })
  }
  return out
}
