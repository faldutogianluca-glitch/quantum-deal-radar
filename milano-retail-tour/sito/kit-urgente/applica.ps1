# Applica al progetto Astro del sito milanoretailtour.com le pagine della campagna MiRT Radar.
# Uso (PowerShell, dalla cartella del progetto del sito, quella con package.json e src\site\pages.json):
#   powershell -ExecutionPolicy Bypass -File .\applica.ps1 -Kit "C:\percorso\kit-urgente" [-Tutto]
# Senza -Tutto: solo le pagine urgenti (radar, mirt-radar-2027, guide, articolo 1) + tutti i PDF.
# Con -Tutto: anche gli altri 7 articoli (il blog li mostra subito, anche con data futura).
param([Parameter(Mandatory=$true)][string]$Kit, [switch]$Tutto)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path 'src\site\pages.json')) { throw 'Esegui questo script dalla cartella del progetto del sito (manca src\site\pages.json).' }
$raw = 'https://raw.githubusercontent.com/faldutogianluca-glitch/quantum-deal-radar/claude/milano-retail-tour-editorial-3m3toj/milano-retail-tour/sito'
$content = Join-Path $Kit 'content'
$pagine = if ($Tutto) { 'pages-json-aggiunte.json' } else { 'pages-aggiunte-urgenti.json' }
$add = Get-Content (Join-Path $Kit $pagine) -Raw -Encoding UTF8 | ConvertFrom-Json
# 1. frammenti HTML
New-Item -ItemType Directory -Force 'src\site\content' | Out-Null
foreach ($p in $add.PSObject.Properties) { Copy-Item (Join-Path $content $p.Value.file) 'src\site\content\' -Force; Write-Host "content: $($p.Value.file)" }
# 2. PDF e anteprima da GitHub (file grandi, non nel kit)
New-Item -ItemType Directory -Force 'public\download\guide' | Out-Null
$files = @('MiRT-Radar-2027.pdf','mirt-radar-2027-anteprima.jpg')
foreach ($f in $files) { Invoke-WebRequest "$raw/download/$f" -OutFile "public\download\$f"; Write-Host "download: $f" }
$guide = @('MiRT-guida-negozio-visibile-AI.pdf','MiRT-kit-commesso-aumentato.pdf','MiRT-5-idee-flagship-Milano.pdf','MiRT-guide-store-visible-to-AI.pdf','MiRT-augmented-sales-associate-kit.pdf','MiRT-5-ideas-Milan-flagships.pdf')
foreach ($f in $guide) { Invoke-WebRequest "$raw/download/guide/$f" -OutFile "public\download\guide\$f"; Write-Host "download/guide: $f" }
# 3. pages.json: aggiunge o sostituisce le voci (ordine conservato, chiavi esistenti aggiornate)
$json = Get-Content 'src\site\pages.json' -Raw -Encoding UTF8
$pages = $json | ConvertFrom-Json
foreach ($p in $add.PSObject.Properties) {
  if ($pages.PSObject.Properties[$p.Name]) { $pages.$($p.Name) = $p.Value; Write-Host "pages.json aggiornata: $($p.Name)" }
  else { $pages | Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value; Write-Host "pages.json aggiunta: $($p.Name)" }
}
Copy-Item 'src\site\pages.json' 'src\site\pages.json.bak' -Force
$pages | ConvertTo-Json -Depth 5 | Set-Content 'src\site\pages.json' -Encoding UTF8
Write-Host "`nFatto. Ora: npm run build  e poi carica la cartella dist sul server (almeno: radar, en/radar, mirt-radar-2027, en/mirt-radar-2027, guide, en/guide, cliente-chiede-ai-dove-comprare, en/cliente-chiede-ai-dove-comprare, download, _astro, sitemap.xml, search-index)."
