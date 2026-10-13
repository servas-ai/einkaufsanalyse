import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Beef, ExternalLink, FlaskConical, History, Import as ImportIcon, LayoutDashboard, Moon, ReceiptText, Store, Sun, Tags } from 'lucide-react'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { AppCtx } from './ctx'
import { enrich, loadReal, makeMatcher, saveReal, type FG, type Receipt } from './lib/data'
import { makeDemo } from './lib/demo'
import { Kategorien, Laeden, Protein, Uebersicht, Verlauf } from './pages'
import { Bons, Import } from './pages2'

const PAGES = [
  { id: 'uebersicht', t: 'Übersicht', i: LayoutDashboard, C: Uebersicht }, { id: 'verlauf', t: 'Verlauf', i: History, C: Verlauf }, { id: 'laeden', t: 'Läden', i: Store, C: Laeden },
  { id: 'kategorien', t: 'Kategorien', i: Tags, C: Kategorien }, { id: 'protein', t: 'Protein & Gesundheit', i: Beef, C: Protein }, { id: 'bons', t: 'Kassenbons', i: ReceiptText, C: Bons }, { id: 'import', t: 'Import', i: ImportIcon, C: Import },
]
const base = import.meta.env.BASE_URL
const sortR = (r: Receipt[]) => [...r].sort((a, b) => b.date.localeCompare(a.date))

function Nav({ page }: { page: string }) {
  const { setOpenMobile } = useSidebar()
  return <SidebarMenu className="gap-1">{PAGES.map(p => <SidebarMenuItem key={p.id}><SidebarMenuButton asChild isActive={page === p.id} size="lg" className="rounded-full px-4 text-[15px] data-[active=true]:font-bold">
    <a href={`#${p.id}`} onClick={() => setOpenMobile(false)}><p.i className="!size-5" /><span>{p.t}</span></a></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu>
}

export default function App() {
  const [page, setPage] = useState(() => location.hash.slice(1) || 'uebersicht')
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && matchMedia('(prefers-color-scheme: dark)').matches))
  const [fg, setFg] = useState<FG[]>([]); const [real, setRealS] = useState<Receipt[] | null>(() => loadReal())
  useEffect(() => { const f = () => setPage(location.hash.slice(1) || 'uebersicht'); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  useEffect(() => { document.documentElement.classList.toggle('dark', dark); localStorage.setItem('theme', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => { fetch(`${base}fg.json`).then(r => r.json()).then(setFg).catch(() => setFg([])) }, [])
  // Lokal per tools/ocr_receipts.py erzeugte Bons (public/receipts.json, nicht im öffentlichen Repo)
  useEffect(() => { if (real) return; fetch(`${base}receipts.json`).then(r => r.ok ? r.json() : null).then(j => { const rs = j?.receipts; if (Array.isArray(rs) && rs.length && j.demo === false) { saveReal(rs); setRealS(rs) } }).catch(() => {}) }, [])
  const byId = useMemo(() => new Map(fg.map(f => [f.id, f])), [fg]); const match = useMemo(() => fg.length ? makeMatcher(fg) : null, [fg])
  const isDemo = !real || real.length === 0
  const receipts = useMemo(() => sortR(enrich(isDemo ? (fg.length ? makeDemo(fg) : []) : real!, match, byId)), [real, fg, isDemo, match, byId])
  const setReal = (r: Receipt[] | null) => { saveReal(r); setRealS(r) }
  const addReceipts = (r: Receipt[]) => { const cur = isDemo ? [] : real!; const ids = new Set(cur.map(x => x.id)); setReal([...cur, ...r.filter(x => !ids.has(x.id))]) }
  const P = PAGES.find(p => p.id === page) ?? PAGES[0]
  return <AppCtx.Provider value={{ receipts, isDemo, fg: byId, setReal, addReceipts, base }}>
    <SidebarProvider>
      <Sidebar className="border-r">
        <SidebarHeader className="px-5 pt-6 pb-4"><div className="flex items-center gap-2.5"><div className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background"><BarChart3 className="size-5" /></div><div><div className="font-bold leading-tight">Einkaufsanalyse</div><div className="text-xs text-muted-foreground">Deine Bons, deine Daten</div></div></div></SidebarHeader>
        <SidebarContent><SidebarGroup className="px-3"><Nav page={P.id} /></SidebarGroup></SidebarContent>
        <SidebarFooter className="p-4 space-y-2">
          <a href="https://servas-ai.github.io/fertiggerichte-vergleich/" className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><ExternalLink className="size-4" />Fertiggerichte-Vergleich</a>
          <Button variant="outline" className="w-full rounded-full" onClick={() => setDark(!dark)}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}{dark ? 'Hell' : 'Dunkel'}</Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur md:px-8">
          <SidebarTrigger className="-ml-1" /><Separator orientation="vertical" className="mr-1 h-5" /><h1 className="truncate text-lg font-bold">{P.t}</h1>
          {isDemo && <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-300"><FlaskConical className="size-3.5" />Beispieldaten</span>}
        </header>
        <main className="mx-auto w-full max-w-6xl min-w-0 px-4 py-6 md:px-8 md:py-8">
          {isDemo && <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"><b>Beispieldaten – keine echten Einkäufe.</b> Alle Zahlen hier sind künstlich erzeugt. <a href="#import" className="underline font-medium">Importiere deine Bons</a>, dann siehst du deine echte Auswertung. Deine Daten bleiben nur in diesem Browser.</div>}
          <P.C />
        </main>
      </SidebarInset>
    </SidebarProvider>
  </AppCtx.Provider>
}
