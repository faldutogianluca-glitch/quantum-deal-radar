"""Genera le immagini 1200x1200 dark-gold della rubrica "La casa in pillole" (pillole n. 4-15).
Uso: pip install pillow && python scripts/immagini_pillole.py
Per una nuova settimana: copiate un blocco "# Pillola" e cambiate numero, gancio, conto e checklist.
Su Mac/Windows i font DejaVu potrebbero mancare: cambiate SERIF_B, SANS, SANS_B con un font installato."""
from PIL import Image, ImageDraw, ImageFont
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "assets", "logo", "logo QRE blu e Arancio solo.png")
OUT = os.path.join(ROOT, "output", "immagini")
os.makedirs(OUT, exist_ok=True)
# THEME=gold (default, dark-gold) oppure THEME=blu (blu e arancio Quantum RE), per i test A/B sullo stile
THEME = os.environ.get("THEME", "gold")
if THEME == "blu":
    BG = (27, 48, 124); GOLD = (235, 122, 50); GOLD2 = (255, 176, 120); TXT = (255, 255, 255); MUTED = (190, 200, 230); PANEL = (40, 62, 140)
    FRAME = (70, 92, 170); DIM = (70, 95, 175); DIM2 = (110, 130, 200); WARN = (255, 214, 102); LOGO_RGB = (255, 255, 255)
else:
    BG = (14, 14, 16); GOLD = (201, 168, 92); GOLD2 = (231, 205, 140); TXT = (236, 230, 216); MUTED = (150, 142, 126); PANEL = (26, 25, 24)
    FRAME = (60, 52, 36); DIM = (90, 78, 52); DIM2 = (120, 104, 70); WARN = (232, 120, 80); LOGO_RGB = GOLD
SUFFIX = "" if THEME == "gold" else "-" + THEME
SERIF_B = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
def F(p, s):
    try: return ImageFont.truetype(p, s)
    except OSError: return ImageFont.load_default(size=s)

def gold_logo(h):
    lg = Image.open(LOGO).convert("RGBA")
    bbox = lg.getbbox(); lg = lg.crop(bbox)
    a = lg.split()[3]
    gold = Image.new("RGBA", lg.size, LOGO_RGB + (255,)); gold.putalpha(a)
    w = int(lg.width * h / lg.height)
    return gold.resize((w, h), Image.LANCZOS)

def wrap(d, text, font, maxw):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if d.textlength(t, font=font) <= maxw: cur = t
        else: lines.append(cur); cur = w
    lines.append(cur); return lines

def base(n, title):
    im = Image.new("RGB", (1200, 1200), BG); d = ImageDraw.Draw(im)
    d.rectangle([40, 40, 1159, 1159], outline=FRAME, width=2)
    badge = f"LA CASA IN PILLOLE · N. {n}"; bf = F(SANS_B, 26)
    bw = d.textlength(badge, font=bf) + 70
    d.rounded_rectangle([90, 95, 90 + bw, 155], radius=30, outline=GOLD, width=3)
    d.text((90 + 35, 125), badge, font=bf, fill=GOLD, anchor="lm")
    tf = F(SERIF_B, 50); y = 200
    for ln in wrap(d, title, tf, 1020):
        d.text((90, y), ln, font=tf, fill=TXT); y += 66
    d.line([90, y + 20, 250, y + 20], fill=GOLD, width=4)
    return im, d, y + 60

def footer(im, d, src, label="Esempio illustrativo"):
    sf = F(SANS, 20)
    d.text((90, 1035), label, font=F(SANS_B, 20), fill=GOLD)
    d.text((90, 1065), src, font=sf, fill=MUTED)
    d.text((90, 1105), "Quantum RE – Osservatorio Real Estate", font=F(SANS, 22), fill=MUTED)
    lg = gold_logo(70); im.paste(lg, (1110 - lg.width, 1060), lg)

def bars(d, y, rows, maxv, step=90):
    lf = F(SANS, 28); vf = F(SANS_B, 34)
    for label, val, col, note in rows:
        d.text((90, y), label, font=lf, fill=TXT); y += 44
        w = int(740 * val / maxv)
        d.rounded_rectangle([90, y, 90 + max(w, 12), y + 56], radius=8, fill=col)
        d.text((90 + max(w, 12) + 20, y + 28), note, font=vf, fill=GOLD2, anchor="lm"); y += step
    return y

def checklist(d, y, items):
    f = F(SANS, 27); nf = F(SANS_B, 28)
    for i, t in enumerate(items, 1):
        d.ellipse([90, y, 136, y + 46], outline=GOLD, width=3)
        d.text((113, y + 23), str(i), font=nf, fill=GOLD, anchor="mm")
        ly = y + 6
        for ln in wrap(d, t, f, 900):
            d.text((160, ly), ln, font=f, fill=TXT); ly += 38
        y = max(y + 64, ly + 22)
    return y

# Pillola 4
im, d, y = base(4, "Il bonus under 36 sulle imposte è finito nel 2023. La garanzia dello Stato sul mutuo invece c'è ancora.")
d.text((90, y), "Casa da 200.000 euro: l'anticipo che vi serve", font=F(SANS, 28), fill=MUTED); y += 60
y = bars(d, y, [("Mutuo all'80%", 40000, DIM, "40.000 €"),
                ("Mutuo al 95% con garanzia Consap", 10000, GOLD, "10.000 €")], 40000)
y = checklist(d, y, ["Chiedete se la banca aderisce al Fondo e fino a quanto finanzia.", "ISEE aggiornato prima di andare in filiale.", "Mutuo entro 250.000 euro, niente A/1, A/8, A/9."])
footer(im, d, "Fonte: Consap, Fondo prima casa (agg. 30/9/2026). 95% illustrativo.")
im.save(f"{OUT}/pillola-4-garanzia-consap-under36{SUFFIX}.png")

# Pillola 5
im, d, y = base(5, "Avete versato 25.000 euro di caparra. La banca vi nega il mutuo. Quei soldi possono restare al venditore.")
d.text((90, y), "Casa da 250.000 euro, caparra confirmatoria al 10%", font=F(SANS, 28), fill=MUTED); y += 60
y = bars(d, y, [("Saltate voi: la perdete", 25000, DIM, "-25.000 €"),
                ("Salta il venditore: ve la restituisce doppia", 50000, GOLD, "50.000 €")], 50000)
y = checklist(d, y - 30, ["Scrivete il tipo di caparra.", "Inserite la condizione del mutuo, con importo e data.", "Fissatela su quanto potete permettervi di perdere."])
footer(im, d, "Fonte: Codice civile, artt. 1385 e 1386.")
im.save(f"{OUT}/pillola-5-caparra-confirmatoria{SUFFIX}.png")

# Pillola 6
im, d, y = base(6, "All'asta il saldo si paga entro un termine fisso, di solito 120 giorni. Se il mutuo non arriva, perdete la cauzione.")
d.text((90, y), "Aggiudicazione a 150.000 euro: chi paga cosa", font=F(SANS, 28), fill=MUTED); y += 60
# stacked bar
segs = [(15000, DIM2, "Cauzione 10%", "15.000"), (120000, GOLD, "Mutuo 80%", "120.000"), (15000, WARN, "Scoperto", "15.000")]
x = 90
for v, c, lab, num in segs:
    w = int(1020 * v / 150000)
    d.rectangle([x, y, x + w - 4, y + 80], fill=c); x += w
ly = y + 105
for v, c, lab, num in segs:
    d.rectangle([90, ly + 6, 114, ly + 30], fill=c)
    d.text((130, ly + 18), lab, font=F(SANS, 25), fill=TXT, anchor="lm")
    d.text((560, ly + 18), num + " €", font=F(SANS_B, 26), fill=GOLD2, anchor="lm"); ly += 40
y = ly + 25
y = checklist(d, y, ["Delibera di mutuo prima dell'asta, per iscritto.", "Perizia letta per intero: occupazione, abusi, arretrati.", "Termine del saldo nell'avviso di vendita."])
footer(im, d, "Fonte: PMI.it, 1/7/2026; Money.it. Più imposte, non incluse.")
im.save(f"{OUT}/pillola-6-prima-casa-asta{SUFFIX}.png")
def panels(d, y, cols, h=250):
    # due riquadri affiancati: (titolo, sottotitolo, [righe])
    w = 495; x = 90
    for i, (tit, sub, rows) in enumerate(cols):
        d.rounded_rectangle([x, y, x + w, y + h], radius=14, fill=PANEL, outline=GOLD if i == 1 else FRAME, width=3)
        d.text((x + 30, y + 28), tit, font=F(SANS_B, 32), fill=GOLD)
        d.text((x + 30, y + 74), sub, font=F(SANS, 22), fill=MUTED)
        ly = y + 122
        for r in rows:
            for ln in wrap(d, r, F(SANS, 23), w - 50):
                d.text((x + 30, ly), ln, font=F(SANS, 23), fill=TXT); ly += 31
            ly += 9
        x += w + 30
    return y + h + 40

# Pillola 7
im, d, y = base(7, "La planimetria catastale non dice se la casa è in regola. Dice solo come è registrata al Catasto.")
y = panels(d, y, [("CATASTO", "conformità catastale", ["Planimetria uguale alla casa di oggi.", "Dichiarata al rogito, a pena di nullità.", "Funzione fiscale: non sana nulla."]),
                  ("COMUNE", "conformità urbanistica", ["Casa uguale ai titoli edilizi.", "Licenze, permessi, pratiche.", "Le difformità restano a chi compra."])])
y = checklist(d, y, ["Chiedete i titoli edilizi, non solo la planimetria.", "Accesso agli atti in Comune con un tecnico.", "Difformità? Nel preliminare: chi sistema, costi, tempi."])
footer(im, d, "Fonti: L. 52/1985 art. 29 c. 1-bis; DPR 380/2001 art. 9-bis.")
im.save(f"{OUT}/pillola-7-catasto-comune{SUFFIX}.png")

# Pillola 8
im, d, y = base(8, "L'APE di solito si legge al rogito. Andrebbe letto prima di fare l'offerta.")
d.text((90, y), "Due bilocali da 60 mq: energia che serve, sulla carta", font=F(SANS, 28), fill=MUTED); y += 60
y = bars(d, y, [("Indice 200 kWh/mq all'anno", 12000, DIM, "12.000 kWh"),
                ("Indice 60 kWh/mq all'anno", 3600, GOLD, "3.600 kWh")], 12000)
y = checklist(d, y, ["Data dell'APE: vale 10 anni, salvo lavori.", "Guardate l'indice, non solo la lettera.", "Leggete le raccomandazioni e chiedete un preventivo."])
footer(im, d, "Fonte: D.Lgs. 192/2005. Consumo teorico, non la bolletta.")
im.save(f"{OUT}/pillola-8-ape-classe-energetica{SUFFIX}.png")

# Pillola 9
im, d, y = base(9, "All'asta non c'è la garanzia per i vizi. La perizia è l'unica che avete, e va letta tutta.")
y = bars(d, y - 10, [("Offerta, esempio illustrativo", 120000, DIM2, "120.000 €"),
                ("Veranda da demolire + arretrati condominiali", 10000, WARN, "+10.000 €"),
                ("Il vostro conto, più imposte", 130000, GOLD, "130.000 €")], 130000 * 1.25, step=80)
y = checklist(d, y, ["Perizia per intero, allegati compresi.", "Visita con il custode sul Portale vendite pubbliche.", "Costi di sanatoria stimati da un tecnico."])
footer(im, d, "Fonti: art. 2922 c.c.; DPR 380/2001 art. 46; disp. att. c.c. art. 63.")
im.save(f"{OUT}/pillola-9-perizia-asta{SUFFIX}.png")
# Pillola 10
im, d, y = base(10, "Casa da 180.000 euro: prima delle chiavi, oltre 12.500 euro in più.")
d.text((90, y), "Acquisto da privato, mutuo da 126.000 euro: le voci principali", font=F(SANS, 26), fill=MUTED); y += 54
y = bars(d, y, [("Agenzia, 3% più IVA", 6588, GOLD, "6.588 €"),
                ("Notaio, compravendita e mutuo", 2500, DIM2, "2.500 €"),
                ("Imposte prima casa da privato", 1550, DIM, "1.550 €")], 6588 * 1.25, step=74)
y = checklist(d, y, ["Provvigione per iscritto, agente abilitato.", "Preventivo scritto del notaio, anche più di uno.", "Budget: anticipo più costi accessori."])
footer(im, d, "Fonte: Facile.it. Istruttoria, perizia e altre voci non mostrate.", label="Simulazione Facile.it")
im.save(f"{OUT}/pillola-10-costi-accessori{SUFFIX}.png")

# Pillola 11
im, d, y = base(11, "Il prezzo di un annuncio non è il prezzo della casa. È quello che il venditore spera.")
y = panels(d, y, [("ANNUNCIO", "superficie commerciale", ["80 mq, muri e balconi compresi.", "250.000 euro.", "3.125 euro al metro."]),
                  ("CASA", "superficie calpestabile", ["68 mq in cui camminate.", "Stesso prezzo.", "3.676 euro al metro: +18%."])])
y = checklist(d, y, ["Planimetria e metri calpestabili, stanza per stanza.", "Confronto con quotazioni OMI e prezzi degli atti.", "Quello che manca: piano, spese, anno. Chiedetelo."])
footer(im, d, "Criteri: DPR 138/1998. Rapporto 68/80 illustrativo.")
im.save(f"{OUT}/pillola-11-leggere-annuncio{SUFFIX}.png")

# Pillola 12
im, d, y = base(12, "Sul mutuo della prima casa potete recuperare fino a 760 euro l'anno.")
d.text((90, y), "Detrazione del 19% su un massimo di 4.000 euro l'anno", font=F(SANS, 28), fill=MUTED); y += 60
y = bars(d, y, [("Interessi e oneri pagati nell'anno", 5500, DIM2, "5.500 €"),
                ("Quota che conta, al massimo", 4000, DIM, "4.000 €"),
                ("Quello che recuperate, 19%", 760, GOLD, "760 €")], 5500 * 1.25, step=74)
y = checklist(d, y, ["Contratto e certificazione degli interessi.", "Residenza entro un anno dall'acquisto.", "Mutuo cointestato: ognuno la sua quota."])
footer(im, d, "Fonte: TUIR art. 15, c. 1, lett. b). Conti illustrativi.")
im.save(f"{OUT}/pillola-12-detrazione-interessi{SUFFIX}.png")
# Pillola 13
im, d, y = base(13, "Una proposta d'acquisto può già vincolarvi. Dipende da cosa c'è scritto.")
y = panels(d, y, [("SENZA CONDIZIONI", "proposta accettata", ["La banca dice no al mutuo.", "L'accordo può essere concluso.", "La vostra posizione è debole."]),
                  ("CON CONDIZIONI", "scritte prima di firmare", ["Mutuo: importo, banca, data.", "Conformità da verificare.", "Irrevocabilità breve."])])
y = checklist(d, y, ["Condizione del mutuo con data della delibera.", "Uscita se conformità o catasto non tornano.", "Cosa succede all'assegno se l'affare salta."])
footer(im, d, "Riferimenti: artt. 1326 e 1329 c.c. Caso illustrativo.")
im.save(f"{OUT}/pillola-13-proposta-acquisto{SUFFIX}.png")

# Pillola 14
im, d, y = base(14, "Fisso o variabile? Contate la rata se il tasso sale.")
d.text((90, y), "170.000 euro in 25 anni, rata mensile", font=F(SANS, 28), fill=MUTED); y += 60
y = bars(d, y, [("Fisso al 3,8%, per tutta la durata", 879, DIM2, "879 €"),
                ("Variabile oggi, al 3,4%", 842, GOLD, "842 €"),
                ("Variabile con un punto in più, al 4,4%", 935, WARN, "935 €")], 935 * 1.25, step=74)
y = checklist(d, y, ["Simulazione con +1 e +2 punti.", "Variabile con tetto massimo: quanto costa.", "Surroga: si cambia banca senza costi."])
footer(im, d, "Tassi illustrativi, non offerte. Ammortamento alla francese.")
im.save(f"{OUT}/pillola-14-fisso-variabile{SUFFIX}.png")

# Pillola 15
im, d, y = base(15, "Prima casa: le agevolazioni si perdono anche dopo il rogito.")
d.text((90, y), "Valore catastale 100.000 euro, acquisto da privato", font=F(SANS, 28), fill=MUTED); y += 60
y = bars(d, y, [("Registro con agevolazione, 2%", 2000, GOLD, "2.000 €"),
                ("Se decadete: differenza d'imposta", 7000, DIM2, "7.000 €"),
                ("Più sanzione del 30%", 2100, WARN, "2.100 €")], 7000 * 1.25, step=74)
y = checklist(d, y, ["Residenza nel Comune entro 18 mesi.", "Vendita prima di 5 anni: riacquisto entro 1 anno.", "Termine a rischio: notaio subito, sanzione ridotta."])
footer(im, d, "Fonte: DPR 131/1986, nota II-bis. Più interessi.")
im.save(f"{OUT}/pillola-15-decadenza-prima-casa{SUFFIX}.png")
print("ok")
