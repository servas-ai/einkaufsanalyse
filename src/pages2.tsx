import { useRef, useState } from 'react'
import { AlertTriangle, Camera, Download, FileUp, Plus, Trash2, Loader2 } from 'lucide-react'
import { useApp } from './ctx'
import { fmtEur, normStore, parseNum, type Receipt } from './lib/data'
import { importFile, parseReceiptText, toCSV, type ImportResult } from './lib/importers'
import { Panel, StoreLogo } from './ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'

export function Bons() {
  const { receipts, isDemo, setReal } = useApp(); const [open, setOpen] = useState<string | null>(null); const [n, setN] = useState(30)
  return <div className="space-y-4">
    <div className="flex justify-end"><ManualEntry /></div>
    <div className="divide-y rounded-2xl border">{receipts.slice(0, n).map(r => <div key={r.id}>
      <button onClick={() => setOpen(open === r.id ? null : r.id)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/50">
        <StoreLogo store={r.store} size={32} />
        <div className="min-w-0 flex-1"><div className="text-sm font-medium">{r.store}</div><div className="text-xs text-muted-foreground">{new Date(r.date).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short' })} · {r.items.length} Artikel · {r.source}</div></div>
        {r.items.some(i => i.lowConf) && <Badge variant="outline" className="gap-1 text-amber-600"><AlertTriangle className="size-3" />prüfen</Badge>}
        <div className="font-semibold tabular-nums">{fmtEur(r.total)}</div>
      </button>
      {open === r.id && <div className="px-4 pb-4"><div className="rounded-xl bg-muted/50 p-3 text-sm">{r.items.map((i, k) => <div key={k} className={`flex justify-between gap-3 py-1 ${i.lowConf ? 'text-amber-600' : ''}`}><span className="min-w-0 truncate">{i.qty > 1 ? `${i.qty}× ` : ''}{i.name}{i.fgId != null && <Badge variant="secondary" className="ml-2">Fertiggericht-Daten</Badge>}</span><span className="tabular-nums">{fmtEur(i.price)}</span></div>)}</div>
        {!isDemo && <Button variant="ghost" size="sm" className="mt-2 text-destructive" onClick={() => setReal(receipts.filter(x => x.id !== r.id))}><Trash2 className="size-4" />Bon löschen</Button>}</div>}
    </div>)}</div>
    {n < receipts.length && <div className="text-center"><Button variant="outline" onClick={() => setN(n + 30)}>Mehr anzeigen ({receipts.length - n})</Button></div>}
  </div>
}

function ManualEntry() {
  const { addReceipts } = useApp(); const [o, setO] = useState(false)
  const [store, setStore] = useState('Billa'); const [date, setDate] = useState(new Date().toISOString().slice(0, 16)); const [items, setItems] = useState([{ name: '', qty: '1', price: '' }])
  const save = () => { const it = items.filter(i => i.name && i.price).map(i => ({ name: i.name, qty: parseNum(i.qty) || 1, price: parseNum(i.price) })); if (!it.length) return
    addReceipts([{ id: `man-${Date.now().toString(36)}`, store: normStore(store), date: new Date(date).toISOString(), total: +it.reduce((s, x) => s + x.price, 0).toFixed(2), items: it, source: 'Manuell' }]); setO(false); setItems([{ name: '', qty: '1', price: '' }]) }
  return <Dialog open={o} onOpenChange={setO}><DialogTrigger asChild><Button><Plus className="size-4" />Bon eintragen</Button></DialogTrigger>
    <DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Einkauf manuell eintragen</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3"><div><Label>Laden</Label><Input value={store} onChange={e => setStore(e.target.value)} /></div><div><Label>Datum & Uhrzeit</Label><Input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} /></div></div>
      <div className="space-y-2">{items.map((i, k) => <div key={k} className="grid grid-cols-[1fr_56px_80px] gap-2">
        <Input placeholder="Artikel" value={i.name} onChange={e => setItems(items.map((x, j) => j === k ? { ...x, name: e.target.value } : x))} />
        <Input placeholder="Menge" value={i.qty} onChange={e => setItems(items.map((x, j) => j === k ? { ...x, qty: e.target.value } : x))} />
        <Input placeholder="€" inputMode="decimal" value={i.price} onChange={e => setItems(items.map((x, j) => j === k ? { ...x, price: e.target.value } : x))} /></div>)}
        <Button variant="ghost" size="sm" onClick={() => setItems([...items, { name: '', qty: '1', price: '' }])}><Plus className="size-4" />Artikel</Button></div>
      <DialogFooter><Button onClick={save}>Speichern</Button></DialogFooter></DialogContent></Dialog>
}

const dl = (name: string, data: string, type: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click() }

export function Import() {
  const { receipts, isDemo, addReceipts, setReal } = useApp()
  const [log, setLog] = useState<(ImportResult & { file: string })[]>([]); const [ocr, setOcr] = useState<string | null>(null)
  const fi = useRef<HTMLInputElement>(null), pi = useRef<HTMLInputElement>(null)
  const onFiles = async (fs: FileList | null) => { if (!fs) return; const out: Receipt[] = []; const l = []
    for (const f of Array.from(fs)) { try { const r = await importFile(f); out.push(...r.receipts); l.push({ ...r, file: f.name }) } catch (e) { l.push({ receipts: [], format: 'Fehler', warnings: [String(e)], file: f.name }) } }
    if (out.length) addReceipts(out); setLog(l) }
  const onPhotos = async (fs: FileList | null) => { if (!fs) return; const { createWorker } = await import('tesseract.js'); const w = await createWorker('deu'); const out: Receipt[] = []; const l = []
    for (const f of Array.from(fs)) { setOcr(`Lese ${f.name} …`); const { data } = await w.recognize(f); const r = parseReceiptText(data.text, `Foto: ${f.name}`, data.confidence)
      if (r && data.confidence < 70) r.items.forEach(i => i.lowConf = true)
      if (r) out.push(r); l.push({ receipts: r ? [r] : [], format: `Foto-OCR (Konfidenz ${Math.round(data.confidence)} %)`, warnings: r ? (r.items.some(i => i.lowConf) ? ['Unsichere Zeilen markiert – bitte in „Kassenbons“ prüfen.'] : []) : ['Kein Bon erkannt.'], file: f.name }) }
    await w.terminate(); setOcr(null); if (out.length) addReceipts(out); setLog(l) }
  return <div className="space-y-6">
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="Datei importieren" desc="CSV oder JSON">
        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files) }} className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center">
          <FileUp className="size-8 text-muted-foreground" /><div className="text-sm text-muted-foreground">Datei hierher ziehen oder</div>
          <Button onClick={() => fi.current?.click()}>Datei wählen</Button><input ref={fi} type="file" multiple accept=".csv,.json,.txt" hidden onChange={e => onFiles(e.target.files)} /></div>
        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
          <li>• Artikel-CSV mit Spalten wie Datum, Filiale/Markt, Artikel, Menge, Preis/Betrag (z. B. Exporte aus jö / BILLA / PENNY, Spar-App, eigene Listen)</li>
          <li>• Hofer e-Bon als Text (.txt) oder JSON</li><li>• Bank-CSV (George, Raiffeisen, Bank Austria …): nur Supermarkt-Buchungen, nur Summen</li>
          <li>• Spaltennamen werden automatisch erkannt; Formate der Händler-Apps sind nicht offiziell dokumentiert.</li></ul>
      </Panel>
      <Panel title="Kassenbon fotografieren" desc="Texterkennung läuft komplett im Browser">
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 text-center">
          {ocr ? <><Loader2 className="size-8 animate-spin text-muted-foreground" /><div className="text-sm">{ocr}</div></> : <><Camera className="size-8 text-muted-foreground" /><div className="text-sm text-muted-foreground">Foto vom Bon, gerade und gut beleuchtet</div>
          <Button onClick={() => pi.current?.click()}>Foto wählen</Button></>}<input ref={pi} type="file" multiple accept="image/*" capture="environment" hidden onChange={e => onPhotos(e.target.files)} /></div>
        <p className="mt-4 text-xs text-muted-foreground">Unsichere Zeilen werden gelb markiert. Fotos verlassen dein Gerät nicht.</p>
      </Panel>
    </div>
    {log.length > 0 && <Panel title="Ergebnis">{log.map((l, i) => <div key={i} className="border-b py-2 text-sm last:border-0"><b>{l.file}</b> – {l.format}: {l.receipts.length} Bons{l.warnings.map((w, k) => <div key={k} className="text-xs text-amber-600">{w}</div>)}</div>)}</Panel>}
    <Panel title="Daten" desc={isDemo ? 'Aktuell werden Beispieldaten angezeigt. Beim ersten Import werden sie ersetzt.' : `${receipts.length} eigene Bons, gespeichert nur in diesem Browser.`}>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={isDemo} onClick={() => dl('einkaeufe.json', JSON.stringify({ receipts }, null, 1), 'application/json')}><Download className="size-4" />JSON exportieren</Button>
        <Button variant="outline" disabled={isDemo} onClick={() => dl('einkaeufe.csv', '\uFEFF' + toCSV(receipts), 'text/csv')}><Download className="size-4" />CSV exportieren</Button>
        {!isDemo && <Button variant="ghost" className="text-destructive" onClick={() => { if (confirm('Alle eigenen Daten in diesem Browser löschen?')) setReal(null) }}><Trash2 className="size-4" />Alle eigenen Daten löschen</Button>}
      </div>
    </Panel>
  </div>
}
