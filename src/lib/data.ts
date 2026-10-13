export type Item = { name: string; qty: number; price: number; category?: string; fgId?: number | null; protein?: number | null; health?: number | null; ready?: boolean; lowConf?: boolean }
export type Receipt = { id: string; store: string; date: string; total: number; items: Item[]; source: string; demo?: boolean; ocrConfidence?: number }
export type FG = { id: number; n: string; b?: string; s?: string; p: number; pp?: number | null; sc?: number | null; k?: number | null; e?: number | null; img?: string; d?: string | null }

const KEY = 'einkaufsanalyse.receipts.v1'
export function loadReal(): Receipt[] | null { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null } catch { return null } }
export function saveReal(r: Receipt[] | null) { if (r === null) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(r)) }

export const STORES: Record<string, { logo?: string; color: string }> = {
  Billa: { logo: 'billa.svg', color: '#e30613' }, 'Billa Plus': { logo: 'billa.svg', color: '#e30613' }, Penny: { logo: 'penny.svg', color: '#cd1414' },
  Spar: { logo: 'spar.svg', color: '#00843d' }, Eurospar: { logo: 'spar.svg', color: '#00843d' }, Interspar: { logo: 'spar.svg', color: '#00843d' },
  Hofer: { logo: 'hofer.svg', color: '#00205b' }, Lidl: { logo: 'lidl.svg', color: '#0050aa' }, dm: { logo: 'dm.svg', color: '#002878' },
  MPreis: { color: '#c8102e' }, Unimarkt: { color: '#e2001a' }, 'Gurkerl': { color: '#5aa02c' },
}
export function normStore(s: string): string {
  const t = (s || '').toLowerCase()
  const m: [RegExp, string][] = [[/billa\s*plus|merkur/, 'Billa Plus'], [/billa/, 'Billa'], [/penny/, 'Penny'], [/interspar/, 'Interspar'], [/eurospar/, 'Eurospar'], [/spar/, 'Spar'], [/hofer|aldi/, 'Hofer'], [/lidl/, 'Lidl'], [/\bdm\b|drogerie ?markt/, 'dm'], [/mpreis/, 'MPreis'], [/unimarkt/, 'Unimarkt'], [/gurkerl/, 'Gurkerl']]
  for (const [r, n] of m) if (r.test(t)) return n
  return s?.trim() || 'Unbekannt'
}
export function chainOf(s: string) { return s.startsWith('Billa') ? 'Billa' : /spar/i.test(s) ? 'Spar' : s }

const CATS: [string, RegExp, boolean][] = [
  ['Fertiggerichte', /(gulasch|lasagne|suppentopf|eintopf|chili|risotto|curry|fertig|bowl|pfanne|nudelgericht|ravioli|tortellini|pizza|knödel mit|schnitzel|burger|wrap|sandwich|salat ?bowl|inzersdorfer|felix|frosta|iglo|good choice|fit to go)/i, true],
  ['Fleisch & Fisch', /(huhn|hühner|hendl|pute|rind|schwein|faschiert|wurst|schinken|lachs|thunfisch|fisch|speck|salami|leberkäse)/i, false],
  ['Milchprodukte & Eier', /(milch|joghurt|topfen|käse|butter|skyr|eier|\bei\b|rahm|obers|mozzarella|gouda|emmentaler|quark)/i, false],
  ['Obst & Gemüse', /(banane|apfel|äpfel|tomate|gurke|paprika|zwiebel|kartoffel|erdäpfel|karotte|salat|zitrone|orange|beeren|brokkoli|zucchini|avocado|knoblauch|spinat|pilz|champignon|trauben|birne)/i, false],
  ['Brot & Backwaren', /(brot|semmel|weckerl|toast|gebäck|baguette|kipferl|croissant|vollkorn)/i, false],
  ['Trockenware', /(nudeln|spaghetti|penne|reis|mehl|zucker|haferflocken|linsen|bohnen|kichererbsen|müsli|öl|essig|gewürz|salz)/i, false],
  ['Getränke', /(wasser|saft|cola|limo|bier|wein|kaffee|tee|eistee|energy|mineral|almdudler|red bull)/i, false],
  ['Süßes & Snacks', /(schoko|chips|keks|gummi|riegel|eis\b|waffel|manner|milka|nüsse|snack|kuchen)/i, false],
  ['Drogerie & Haushalt', /(zahnpasta|shampoo|duschgel|wc|papier|waschmittel|spülmittel|seife|deo|taschentuch|müllsack)/i, false],
]
export function categorize(name: string): { category: string; ready: boolean } {
  for (const [c, r, ready] of CATS) if (r.test(name)) return { category: c, ready }
  return { category: 'Sonstiges', ready: false }
}

const tok = (s: string) => (s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(w => w.length > 2))
export function makeMatcher(fg: FG[]) {
  const idx = fg.map(f => ({ f, t: new Set(tok(`${f.b ?? ''} ${f.n}`)) }))
  return (name: string, store?: string): FG | null => {
    const q = tok(name); if (q.length === 0) return null
    let best: FG | null = null, bs = 0
    for (const { f, t } of idx) {
      let hit = 0; for (const w of q) if (t.has(w)) hit++
      let s = hit / Math.max(q.length, Math.min(t.size, 6)); if (store && f.s && chainOf(store) === f.s) s += 0.05
      if (s > bs) { bs = s; best = f }
    }
    return bs >= 0.6 ? best : null
  }
}
export function enrich(rs: Receipt[], match: ((n: string, s?: string) => FG | null) | null, byId?: Map<number, FG>): Receipt[] {
  return rs.map(r => ({ ...r, store: normStore(r.store), items: r.items.map(it => {
    const c = categorize(it.name); const f = (it.fgId != null ? byId?.get(it.fgId) : null) || (match ? match(it.name, r.store) : null)
    return { ...it, category: it.category || (f ? 'Fertiggerichte' : c.category), ready: it.ready ?? (f ? true : c.ready), fgId: it.fgId ?? f?.id ?? null,
      protein: it.protein ?? (f?.pp != null ? +(f.pp * it.qty).toFixed(1) : estProtein(it.name, it.qty)), health: it.health ?? f?.sc ?? null }
  }) }))
}
// grobe Richtwerte je Packung, nur wenn kein Datensatz-Treffer
function estProtein(n: string, q: number): number | null {
  const t: [RegExp, number][] = [[/skyr|topfen/i, 50], [/eier/i, 60], [/huhn|hühner|pute/i, 100], [/faschiert/i, 90], [/milch/i, 33], [/joghurt/i, 20], [/linsen|kichererbsen/i, 45], [/käse|gouda|emmentaler/i, 50], [/thunfisch/i, 30], [/lachs/i, 50]]
  for (const [r, p] of t) if (r.test(n)) return p * q
  return null
}

export const fmtEur = (n: number) => n.toLocaleString('de-AT', { style: 'currency', currency: 'EUR' })
export const parseNum = (s: unknown) => { if (typeof s === 'number') return s; const t = String(s ?? '').replace(/[€\s]/g, ''); const n = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t; const v = parseFloat(n); return isNaN(v) ? 0 : v }
