// Quality Gate: alle Seiten @1920 und @390, keine JS-Fehler, kein horizontaler Overflow
import { chromium } from '/workspace/RAT-fixer-browser/node_modules/playwright/index.mjs'
const URL = process.env.URL || 'http://localhost:8777/einkaufsanalyse/'
const pages = ['uebersicht', 'verlauf', 'laeden', 'kategorien', 'protein', 'bons', 'import']
const b = await chromium.launch(); let fail = 0
for (const [vn, vp] of [['1920', { width: 1920, height: 1080 }], ['390', { width: 390, height: 844 }]]) {
  for (const dark of [false, true]) {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: vn === '390' ? 2 : 1, colorScheme: dark ? 'dark' : 'light' })
    const p = await ctx.newPage(); const errs = []
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !m.text().startsWith('Failed to load resource') && errs.push(m.text()))
    p.on('response', r => r.status() >= 400 && !r.url().endsWith('/receipts.json') && errs.push(`HTTP ${r.status()} ${r.url()}`))
    for (const pg of pages) {
      if (dark && !['uebersicht', 'protein'].includes(pg)) continue
      await p.goto(URL + '#' + pg, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200)
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      const demo = await p.locator('text=Beispieldaten').count()
      const ok = ov <= 1 && errs.length === 0 && demo > 0
      if (!ok) fail++
      console.log(`${ok ? 'OK  ' : 'FAIL'} ${vn}${dark ? ' dark' : ''} ${pg} overflow=${ov} errors=${errs.length} demoLabel=${demo}`); errs.forEach(e => console.log('   ', e)); errs.length = 0
      await p.screenshot({ path: `shots/${pg}_${vn}${dark ? '_dark' : ''}.png`, fullPage: vn === '1920' })
    }
    await ctx.close()
  }
}
await b.close(); process.exit(fail ? 1 : 0)
