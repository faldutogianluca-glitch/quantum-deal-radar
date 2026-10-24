#!/usr/bin/env bash
# Stessa cosa di applica.ps1 per macOS/Linux. Uso, dalla cartella del progetto del sito:
#   bash /percorso/kit-urgente/applica.sh /percorso/kit-urgente [tutto]
set -euo pipefail
KIT="$1"; MODE="${2:-urgenti}"
[ -f src/site/pages.json ] || { echo "Esegui dalla cartella del progetto del sito (manca src/site/pages.json)"; exit 1; }
RAW=https://raw.githubusercontent.com/faldutogianluca-glitch/quantum-deal-radar/claude/milano-retail-tour-editorial-3m3toj/milano-retail-tour/sito
ADD="$KIT/pages-aggiunte-urgenti.json"; [ "$MODE" = tutto ] && ADD="$KIT/pages-json-aggiunte.json"
mkdir -p src/site/content public/download/guide
node -e '
const fs=require("fs");const add=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
for (const k in add) fs.copyFileSync(process.argv[2]+"/content/"+add[k].file,"src/site/content/"+add[k].file), console.log("content:",add[k].file);
const p="src/site/pages.json";const pages=JSON.parse(fs.readFileSync(p,"utf8"));fs.copyFileSync(p,p+".bak");
for (const k in add){console.log(pages[k]?"pages.json aggiornata:":"pages.json aggiunta:",k);pages[k]=add[k];}
fs.writeFileSync(p,JSON.stringify(pages,null,1)+"\n");' "$ADD" "$KIT"
for f in MiRT-Radar-2027.pdf mirt-radar-2027-anteprima.jpg; do curl -fsSL "$RAW/download/$f" -o "public/download/$f"; echo "download: $f"; done
for f in MiRT-guida-negozio-visibile-AI.pdf MiRT-kit-commesso-aumentato.pdf MiRT-5-idee-flagship-Milano.pdf MiRT-guide-store-visible-to-AI.pdf MiRT-augmented-sales-associate-kit.pdf MiRT-5-ideas-Milan-flagships.pdf; do curl -fsSL "$RAW/download/guide/$f" -o "public/download/guide/$f"; echo "download/guide: $f"; done
echo; echo "Fatto. Ora: npm run build  e carica dist/ sul server."
