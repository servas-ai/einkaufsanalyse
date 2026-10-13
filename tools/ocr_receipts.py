#!/usr/bin/env python3
"""Kassenbon-Fotos -> public/receipts.json (Format der Einkaufsanalyse-App).
Nutzung:  python3 tools/ocr_receipts.py FOTO.jpg [FOTO2.png ...] [-o public/receipts.json] [--append]
Benötigt: tesseract-ocr + tesseract-ocr-deu, Pillow.
Unsichere Zeilen (Tesseract-Konfidenz < 75, Sonderzeichen, Summe passt nicht) bekommen lowConf=true.
ACHTUNG: echte Bons sind persönliche Daten – receipts.json ist per .gitignore vom öffentlichen Repo ausgeschlossen."""
import argparse, json, re, subprocess, sys, os, tempfile, datetime, hashlib
from PIL import Image, ImageOps, ImageFilter

STORES = [(r'billa\s*plus|merkur', 'Billa Plus'), (r'billa', 'Billa'), (r'penny', 'Penny'), (r'interspar', 'Interspar'), (r'eurospar', 'Eurospar'), (r'spar', 'Spar'),
          (r'hofer|aldi', 'Hofer'), (r'lidl', 'Lidl'), (r'\bdm\b|drogerie ?markt', 'dm'), (r'mpreis', 'MPreis'), (r'unimarkt', 'Unimarkt')]
SKIP = re.compile(r'(mwst|ust|\bbar\b|bankomat|karte|rückgeld|ruckgeld|gegeben|visa|maestro|mastercard|steuer|netto|brutto|uid|kassa|bon-?nr|danke|filiale|tel\.?|www\.|atu\d)', re.I)
TOTAL = re.compile(r'(summe|gesamt|zu zahlen|total|betrag)\b', re.I)
PRICE = re.compile(r'^(.*?[A-Za-zÄÖÜäöüß].*?)\s+(-?\d{1,4}[,.]\d{2})\s*(?:[ABCD12]|EUR|€)?\s*\*?$')
QTYLINE = re.compile(r'^(\d+)\s*[xX*]\s*(\d+[,.]\d{2})')

def num(s): return float(s.replace(',', '.'))

def ocr_lines(path):
    im = Image.open(path); im = ImageOps.exif_transpose(im).convert('L')
    if im.width < 1600: im = im.resize((1600, int(im.height * 1600 / im.width)), Image.LANCZOS)
    im = ImageOps.autocontrast(im).filter(ImageFilter.SHARPEN)
    with tempfile.NamedTemporaryFile(suffix='.png') as t:
        im.save(t.name)
        tsv = subprocess.run(['tesseract', t.name, '-', '-l', 'deu', '--psm', '6', 'tsv'], capture_output=True, text=True, check=True).stdout
    lines = {}
    for row in tsv.splitlines()[1:]:
        c = row.split('\t')
        if len(c) < 12 or not c[11].strip(): continue
        k = (c[2], c[3], c[4]); conf = float(c[10])
        lines.setdefault(k, []).append((c[11], conf))
    out = []
    for k in sorted(lines, key=lambda k: tuple(map(int, k))):
        ws = lines[k]; out.append((' '.join(w for w, _ in ws), min(c for _, c in ws), sum(c for _, c in ws) / len(ws)))
    return out

def parse(lines, src):
    head = ' '.join(l for l, _, _ in lines[:8]).lower(); tail = ' '.join(l for l, _, _ in lines[-10:]).lower()
    store = next((n for r, n in STORES if re.search(r, head + ' ' + tail)), 'Unbekannt')
    date = None; total = None; items = []; pend = None
    for text, cmin, cavg in lines:
        if not date:
            m = re.search(r'(\d{1,2})\.(\d{1,2})\.(\d{2,4})', text)
            if m:
                y = int(m[3]); y = y + 2000 if y < 100 else y
                tm = re.search(r'(\d{1,2}):(\d{2})', text)
                try: date = datetime.datetime(y, int(m[2]), int(m[1]), int(tm[1]) if tm else 12, int(tm[2]) if tm else 0)
                except ValueError: pass
        if TOTAL.search(text):
            m = re.search(r'(-?\d{1,4}[,.]\d{2})', text)
            if m and total is None: total = num(m[1])
            continue
        if SKIP.search(text): continue
        q = QTYLINE.match(text)
        if q:
            n, u = int(q[1]), num(q[2])
            if items and abs(items[-1]['price'] - n * u) < 0.02: items[-1]['qty'] = n
            else: pend = n
            continue
        m = PRICE.match(text)
        if not m: continue
        name = re.sub(r'\s{2,}', ' ', m[1]).strip(); price = num(m[2]); qty = 1
        if pend: qty = pend; pend = None
        mq = re.match(r'^(\d+)\s*[xX*]\s+', name)
        if mq: qty = int(mq[1]); name = name[mq.end():]
        low = cavg < 75 or cmin < 40 or len(name) < 3 or bool(re.search(r"[^\w\s.,%&\-/()+']", name)) or price > 200
        it = {'name': name, 'qty': qty, 'price': price, 'ocrConf': round(cavg)}
        if low: it['lowConf'] = True
        items.append(it)
    s = round(sum(i['price'] for i in items), 2)
    warn = []
    if total is not None and abs(total - s) > 0.05: warn.append(f'Summe laut Bon {total:.2f} ≠ Artikelsumme {s:.2f}')
    if not date: warn.append('Kein Datum erkannt')
    if store == 'Unbekannt': warn.append('Laden nicht erkannt')
    rid = 'ocr-' + hashlib.sha1(open(src, 'rb').read()).hexdigest()[:10]
    return {'id': rid, 'store': store, 'date': (date or datetime.datetime.now()).isoformat(), 'total': total if total is not None else s, 'items': items,
            'source': f'Foto-OCR: {os.path.basename(src)}', 'ocrConfidence': round(sum(c for _, _, c in lines) / max(1, len(lines))), 'warnings': warn}

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('fotos', nargs='+'); ap.add_argument('-o', default=os.path.join(os.path.dirname(__file__), '..', 'public', 'receipts.json')); ap.add_argument('--append', action='store_true')
    a = ap.parse_args()
    old = json.load(open(a.o))['receipts'] if a.append and os.path.exists(a.o) else []
    ids = {r['id'] for r in old}; new = []
    for f in a.fotos:
        r = parse(ocr_lines(f), f)
        print(f"{f}: {r['store']} {r['date'][:16]} {len(r['items'])} Artikel, Summe {r['total']:.2f}, Konfidenz {r['ocrConfidence']} %, unsicher {sum(1 for i in r['items'] if i.get('lowConf'))}", *(['  ⚠ ' + w for w in r['warnings']]), sep='\n')
        if r['id'] not in ids: new.append(r)
    json.dump({'receipts': old + new, 'generated': datetime.datetime.now().isoformat(), 'demo': False}, open(a.o, 'w'), ensure_ascii=False, indent=1)
    print(f'→ {a.o}: {len(old) + len(new)} Bons')
