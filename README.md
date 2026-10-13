# Einkaufsanalyse

Dashboard für die eigenen Supermarkt-Einkäufe (Österreich): Ausgaben im Verlauf, Läden, Kategorien, Protein & € pro 10 g Protein, Health-Score, Fertiggerichte vs. Zutaten, Preisentwicklung, Einkaufs-Heatmap. Artikel werden mit dem [Fertiggerichte-Vergleich](https://servas-ai.github.io/fertiggerichte-vergleich/) verknüpft (Nährwerte, Preis-Leistung).

**Live:** https://servas-ai.github.io/einkaufsanalyse/

- Ohne Import zeigt die App ausschließlich klar markierte **Beispieldaten** (künstlich erzeugt).
- Import: CSV/JSON (Spalten werden automatisch erkannt: Datum, Filiale, Artikel, Menge, Preis), e-Bon-Text, Bank-CSV (nur Supermarkt-Buchungen), Kassenbon-Fotos (tesseract.js im Browser), manuelle Eingabe.
- Daten bleiben im Browser (localStorage). Export als JSON/CSV.
- `tools/ocr_receipts.py FOTO.jpg …` – Kassenbon-Fotos lokal per Tesseract (deu) in `public/receipts.json` umwandeln; unsichere Zeilen bekommen `lowConf`. Die Datei ist per `.gitignore` vom Repo ausgeschlossen.
- `tools/qa.mjs` – Quality Gate (alle Seiten @1920/@390, hell/dunkel, keine JS-Fehler, kein Overflow, Beispieldaten-Label sichtbar).

Stack: Vite, React, TypeScript, Tailwind, shadcn/ui (sidebar), lucide, recharts.
