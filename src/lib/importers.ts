import Papa from 'papaparse'
import { normStore, parseNum, type Receipt, type Item } from './data'

const A = {
  date: ['datum', 'date', 'einkaufsdatum', 'kaufdatum', 'buchungsdatum', 'valutadatum', 'transaktionsdatum', 'zeitpunkt', 'bon datum'],
  time: ['uhrzeit', 'zeit', 'time'],
  store: ['filiale', 'markt', 'store', 'händler', 'haendler', 'geschäft', 'shop', 'partnername', 'empfänger', 'empfaenger', 'auftraggeber/empfänger', 'zahlungsempfänger', 'name', 'buchungstext', 'verwendungszweck'],
  item: ['artikel', 'artikelname', 'produkt', 'bezeichnung', 'item', 'product', 'artikelbezeichnung', 'beschreibung'],
  qty: ['menge', 'anzahl', 'qty', 'quantity', 'stk', 'stück'],
  price: ['betrag', 'preis', 'summe', 'price', 'amount', 'gesamtpreis', 'betrag (eur)', 'betrag in eur', 'umsatz', 'wert'],
  bon: ['bon', 'bonnummer', 'bon-nr', 'belegnummer', 'receipt', 'receipt_id', 'transaktion', 'einkauf id', 'id'],
}
const find = (h: string[], keys: string[]) => { const l = h.map(x => x.toLowerCase().trim()); for (const k of keys) { const i = l.indexOf(k); if (i >= 0) return h[i] } for (const k of keys) { const i = l.findIndex(x => x.includes(k)); if (i >= 0) return h[i] } return undefined }
export function parseDate(s: string, t?: string): string | null {
  s = (s || '').trim(); let m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/)
  let d: Date | null = null
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; d = new Date(y, +m[2] - 1, +m[1], +(m[4] ?? 12), +(m[5] ?? 0)) }
  else if ((m = s.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/))) d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 12), +(m[5] ?? 0))
  if (!d || isNaN(+d)) return null
  const tm = t?.match(/(\d{1,2}):(\d{2})/); if (tm) d.setHours(+tm[1], +tm[2])
  return d.toISOString()
}
const GROCERY = /billa|penny|spar|hofer|lidl|\bdm\b|mpreis|unimarkt|merkur|gurkerl|interspar|eurospar|nah ?& ?frisch|adeg|metro/i

export type ImportResult = { receipts: Receipt[]; format: string; warnings: string[] }
export function importRows(rows: Record<string, string>[], file: string): ImportResult {
  const h = Object.keys(rows[0] ?? {}); const w: string[] = []
  const c = { date: find(h, A.date), time: find(h, A.time), store: find(h, A.store), item: find(h, A.item), qty: find(h, A.qty), price: find(h, A.price), bon: find(h, A.bon) }
  if (!c.date || !c.price) return { receipts: [], format: 'unbekannt', warnings: [`Spalten nicht erkannt (gefunden: ${h.join(', ')}). Benötigt: Datum + Betrag.`] }
  const bank = !c.item && /buchung|valuta|partner|empf|iban/i.test(h.join(' '))
  const map = new Map<string, Receipt>()
  let skipped = 0
  for (const r of rows) {
    const iso = parseDate(r[c.date], c.time ? r[c.time] : undefined); if (!iso) { skipped++; continue }
    const rawStore = c.store ? r[c.store] : file
    if (bank && !GROCERY.test(rawStore)) { skipped++; continue }
    let price = parseNum(r[c.price]); if (bank) price = Math.abs(price)
    const store = normStore(rawStore)
    const key = c.bon && r[c.bon] ? `${store}|${r[c.bon]}` : `${store}|${iso.slice(0, 16)}`
    const rc = map.get(key) ?? { id: `imp-${map.size}-${Date.now().toString(36)}`, store, date: iso, total: 0, items: [], source: bank ? 'Bank-CSV' : file }
    if (c.item) rc.items.push({ name: r[c.item], qty: c.qty ? parseNum(r[c.qty]) || 1 : 1, price })
    rc.total = +(rc.total + price).toFixed(2); map.set(key, rc)
  }
  if (skipped) w.push(`${skipped} Zeilen übersprungen${bank ? ' (keine Supermarkt-Buchung oder ohne Datum)' : ' (ohne gültiges Datum)'}.`)
  if (bank) w.push('Bank-CSV: nur Summen je Einkauf, keine Einzelartikel.')
  return { receipts: [...map.values()], format: bank ? 'Bank-CSV' : 'Artikel-CSV', warnings: w }
}
export async function importFile(f: File): Promise<ImportResult> {
  const text = await f.text()
  if (/\.json$/i.test(f.name) || /^\s*[[{]/.test(text)) {
    const j = JSON.parse(text); const arr = Array.isArray(j) ? j : j.receipts ?? j.bons ?? j.purchases ?? j.data ?? []
    if (arr.length && arr[0].items) return { receipts: arr.map((r: any, i: number) => ({ id: r.id ?? `json-${i}`, store: normStore(r.store ?? r.markt ?? r.filiale ?? ''), date: parseDate(String(r.date ?? r.datum)) ?? new Date().toISOString(), total: parseNum(r.total ?? r.summe ?? (r.items as any[]).reduce((s, x) => s + parseNum(x.price ?? x.preis), 0)), items: (r.items as any[]).map((x): Item => ({ name: x.name ?? x.artikel, qty: parseNum(x.qty ?? x.menge) || 1, price: parseNum(x.price ?? x.preis), lowConf: x.lowConf })), source: r.source ?? f.name, ocrConfidence: r.ocrConfidence })), format: 'JSON (Bons)', warnings: [] }
    return importRows(arr, f.name)
  }
  if (/\.txt$/i.test(f.name)) { const r = parseReceiptText(text, f.name); return { receipts: r ? [r] : [], format: 'e-Bon Text', warnings: r ? [] : ['Kein Bon erkannt.'] } }
  const p = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: true, delimiter: '' })
  return importRows(p.data, f.name)
}

// Kassenbon-Text (OCR oder e-Bon) → Receipt
export function parseReceiptText(text: string, source: string, conf?: number): Receipt | null {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const store = normStore(lines.slice(0, 8).join(' ') + ' ' + text.slice(-400))
  let iso: string | null = null, total: number | null = null
  const items: Item[] = []
  let pend: number | null = null
  const priceRe = /^(.*?[A-Za-zÄÖÜäöüß].*?)\s+(-?\d{1,4}[,.]\d{2})\s*(?:[ABCD12]|EUR|€)?\s*\*?$/
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (!iso) { const d = l.match(/\d{1,2}\.\d{1,2}\.\d{2,4}(?:\s+\d{1,2}:\d{2})?/); if (d) iso = parseDate(d[0], l) }
    if (/(summe|gesamt|zu zahlen|total|betrag)\b/i.test(l)) { const m = l.match(/(-?\d{1,4}[,.]\d{2})/); if (m && total === null) total = parseNum(m[1]); continue }
    if (/(mwst|ust|bar\b|bankomat|karte|rückgeld|gegeben|visa|maestro|steuer|netto|brutto|uid|kassa|bon-?nr|danke|filiale|tel\.?|www\.)/i.test(l)) continue
    const ql = l.match(/^(\d+)\s*[xX*]\s*(\d+[,.]\d{2})\s*[A-D]?$/)
    if (ql) { const n = +ql[1], u = parseNum(ql[2]); const pv = items[items.length - 1]; if (pv && Math.abs(pv.price - n * u) < 0.02) pv.qty = n; else pend = n; continue }
    const m = l.match(priceRe); if (!m) continue
    let name = m[1].replace(/\s{2,}/g, ' ').trim(); let qty = pend ?? 1; pend = null; const price = parseNum(m[2])
    const q = name.match(/^(\d+)\s*[xX*]\s*/) || name.match(/\s(\d+)\s*[xX*]\s*\d+[,.]\d{2}$/)
    if (q) { qty = +q[1]; name = name.replace(q[0], ' ').trim() }
    const prev = items[items.length - 1]
    if (/^\d+\s*[xX*]\s*\d+[,.]\d{2}$/.test(name) && prev) { prev.qty = qty; prev.price = price; continue }
    const low = name.length < 3 || /[^\p{L}\p{N}\s.,%&\-/()+']/u.test(name) || price > 200
    items.push({ name, qty, price, lowConf: low || undefined })
  }
  if (!items.length) return null
  const sum = +items.reduce((s, x) => s + x.price, 0).toFixed(2)
  return { id: `bon-${Date.now().toString(36)}`, store, date: iso ?? new Date().toISOString(), total: total ?? sum, items, source, ocrConfidence: conf }
}

export function toCSV(rs: Receipt[]) {
  const rows = [['bon_id', 'datum', 'markt', 'artikel', 'menge', 'preis', 'kategorie', 'fertiggericht_id', 'protein_g', 'health_score', 'quelle']]
  for (const r of rs) for (const i of r.items.length ? r.items : [{ name: '(Summe)', qty: 1, price: r.total } as Item]) rows.push([r.id, r.date, r.store, i.name, String(i.qty), i.price.toFixed(2), i.category ?? '', String(i.fgId ?? ''), String(i.protein ?? ''), String(i.health ?? ''), r.source])
  return rows.map(r => r.map(x => /[;"\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x).join(';')).join('\n')
}
