"""Genera le immagini 1200x1200 dark-gold della rubrica "La casa in pillole" (esempio: pillole n. 4-6).
Uso: pip install pillow && python scripts/immagini_pillole.py
Per una nuova settimana: copiate un blocco "# Pillola" e cambiate numero, gancio, conto e checklist.
Su Mac/Windows i font DejaVu potrebbero mancare: cambiate SERIF_B, SANS, SANS_B con un font installato."""
from PIL import Image, ImageDraw, ImageFont
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "assets", "logo", "logo QRE blu e Arancio solo.png")
OUT = os.path.join(ROOT, "output", "immagini")
os.makedirs(OUT, exist_ok=True)
BG = (14, 14, 16); GOLD = (201, 168, 92); GOLD2 = (231, 205, 140); TXT = (236, 230, 216); MUTED = (150, 142, 126); PANEL = (26, 25, 24)
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
    gold = Image.new("RGBA", lg.size, GOLD + (255,)); gold.putalpha(a)
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
    d.rectangle([40, 40, 1159, 1159], outline=(60, 52, 36), width=2)
    badge = f"LA CASA IN PILLOLE · N. {n}"; bf = F(SANS_B, 26)
    bw = d.textlength(badge, font=bf) + 70
    d.rounded_rectangle([90, 95, 90 + bw, 155], radius=30, outline=GOLD, width=3)
    d.text((90 + 35, 125), badge, font=bf, fill=GOLD, anchor="lm")
    tf = F(SERIF_B, 50); y = 200
    for ln in wrap(d, title, tf, 1020):
        d.text((90, y), ln, font=tf, fill=TXT); y += 66
    d.line([90, y + 20, 250, y + 20], fill=GOLD, width=4)
    return im, d, y + 60

def footer(im, d, src):
    sf = F(SANS, 20)
    d.text((90, 1035), "Esempio illustrativo", font=F(SANS_B, 20), fill=GOLD)
    d.text((90, 1065), src, font=sf, fill=MUTED)
    d.text((90, 1105), "Quantum RE – Osservatorio Real Estate", font=F(SANS, 22), fill=MUTED)
    lg = gold_logo(70); im.paste(lg, (1110 - lg.width, 1060), lg)

def bars(d, y, rows, maxv):
    lf = F(SANS, 28); vf = F(SANS_B, 34)
    for label, val, col, note in rows:
        d.text((90, y), label, font=lf, fill=TXT); y += 44
        w = int(740 * val / maxv)
        d.rounded_rectangle([90, y, 90 + max(w, 12), y + 56], radius=8, fill=col)
        d.text((90 + max(w, 12) + 20, y + 28), note, font=vf, fill=GOLD2, anchor="lm"); y += 90
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
y = bars(d, y, [("Mutuo all'80%", 40000, (90, 78, 52), "40.000 €"),
                ("Mutuo al 95% con garanzia Consap", 10000, GOLD, "10.000 €")], 40000)
y = checklist(d, y, ["Chiedete se la banca aderisce al Fondo e fino a quanto finanzia.", "ISEE aggiornato prima di andare in filiale.", "Mutuo entro 250.000 euro, niente A/1, A/8, A/9."])
footer(im, d, "Fonte: Consap, Fondo prima casa (agg. 30/9/2026). 95% illustrativo.")
im.save(f"{OUT}/pillola-4-garanzia-consap-under36.png")

# Pillola 5
im, d, y = base(5, "Avete versato 25.000 euro di caparra. La banca vi nega il mutuo. Quei soldi possono restare al venditore.")
d.text((90, y), "Casa da 250.000 euro, caparra confirmatoria al 10%", font=F(SANS, 28), fill=MUTED); y += 60
y = bars(d, y, [("Saltate voi: la perdete", 25000, (90, 78, 52), "-25.000 €"),
                ("Salta il venditore: ve la restituisce doppia", 50000, GOLD, "50.000 €")], 50000)
y = checklist(d, y - 30, ["Scrivete il tipo di caparra.", "Inserite la condizione del mutuo, con importo e data.", "Fissatela su quanto potete permettervi di perdere."])
footer(im, d, "Fonte: Codice civile, artt. 1385 e 1386.")
im.save(f"{OUT}/pillola-5-caparra-confirmatoria.png")

# Pillola 6
im, d, y = base(6, "All'asta il saldo si paga entro un termine fisso, di solito 120 giorni. Se il mutuo non arriva, perdete la cauzione.")
d.text((90, y), "Aggiudicazione a 150.000 euro: chi paga cosa", font=F(SANS, 28), fill=MUTED); y += 60
# stacked bar
segs = [(15000, (120, 104, 70), "Cauzione 10%", "15.000"), (120000, GOLD, "Mutuo 80%", "120.000"), (15000, (232, 120, 80), "Scoperto", "15.000")]
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
im.save(f"{OUT}/pillola-6-prima-casa-asta.png")
print("ok")
