"""Copertina 1200x644 dark-gold per "Immobili in Movimento" (Osservatorio Real Estate di Quantum RE).
Uso: python scripts/copertina_newsletter.py            -> genera la copertina dell'edizione in EDIZIONE
Per una nuova edizione: aggiungete un blocco in EDIZIONI con titolo, tre numeri e fonti, poi cambiate EDIZIONE
(oppure EDIZIONE=38 python scripts/copertina_newsletter.py). I numeri devono essere quelli verificati della bozza.
Su Mac/Windows i font DejaVu potrebbero mancare: cambiate SERIF_B, SERIF, SANS, SANS_B con un font installato."""
from PIL import Image, ImageDraw, ImageFont
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "assets", "logo", "logo QuantumRE blu e Arancio.png")
OUT = os.path.join(ROOT, "output", "copertine")
os.makedirs(OUT, exist_ok=True)
BG = (14, 15, 18); GOLD = (201, 168, 92); IVORY = (232, 226, 212); MUTED = (140, 138, 132); DIM = (60, 58, 52); FAINT = (95, 95, 95)
SERIF_B = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

EDIZIONI = {
    37: {
        "titolo": ("Il tempo è tornato", "a costare"),
        "numeri": [("4,2%", "INFLAZIONE ITALIA", "settembre 2026, dato definitivo"),
                   ("3,99%", "TAEG MEDIO MUTUI CASA", "nuovi contratti, agosto 2026"),
                   ("+4,1%", "COSTO DI COSTRUZIONE", "fabbricato residenziale, agosto 2026")],
        "frase": "Un mese di ritardo, oggi, ha un prezzo che si vede. Per chi compra, ristruttura o aspetta.",
        "fonti": "Fonti: Istat, Banca d'Italia, dati al 16/10/2026",
    },
}

def F(p, s):
    try: return ImageFont.truetype(p, s)
    except OSError: return ImageFont.load_default(size=s)

def gold_logo(h):
    lg = Image.open(LOGO).convert("RGBA")
    lg = lg.crop(lg.getbbox())
    gold = Image.new("RGBA", lg.size, GOLD + (255,)); gold.putalpha(lg.split()[3])
    return gold.resize((int(lg.width * h / lg.height), h), Image.LANCZOS)

def copertina(n, e):
    im = Image.new("RGB", (1200, 644), BG); d = ImageDraw.Draw(im)
    d.rectangle([60, 56, 65, 94], fill=GOLD)
    d.text((80, 58), f"IMMOBILI IN MOVIMENTO  ·  EDIZIONE {n}", font=F(SANS, 20), fill=GOLD)
    d.text((80, 82), "Osservatorio Real Estate di Quantum RE", font=F(SANS, 15), fill=MUTED)
    tf = F(SERIF_B, 58)
    d.text((60, 136), e["titolo"][0], font=tf, fill=IVORY)
    d.text((60, 200), e["titolo"][1], font=tf, fill=GOLD)
    d.line([60, 292, 1140, 292], fill=(120, 100, 56), width=1)
    x = 60
    for i, (num, lab, sub) in enumerate(e["numeri"]):
        if i: d.line([x - 24, 320, x - 24, 470], fill=DIM, width=1)
        d.text((x, 322), num, font=F(SERIF_B, 76), fill=GOLD if i == 1 else IVORY)
        d.text((x, 420), lab, font=F(SANS_B, 15), fill=GOLD)
        d.text((x, 444), sub, font=F(SANS, 15), fill=MUTED)
        x += 360
    d.text((60, 502), e["frase"], font=F(SERIF, 19), fill=IVORY)
    d.line([60, 560, 1140, 560], fill=(40, 40, 40), width=1)
    lg = gold_logo(46); im.paste(lg, (60, 578), lg)
    d.text((160, 594), e["fonti"], font=F(SANS, 12), fill=FAINT)
    sig = "Quantum RE – Osservatorio Real Estate"; sf = F(SANS, 15)
    d.text((1140 - d.textlength(sig, font=sf), 593), sig, font=sf, fill=MUTED)
    path = os.path.join(OUT, f"copertina-edizione-{n}.png"); im.save(path); return path

if __name__ == "__main__":
    n = int(os.environ.get("EDIZIONE", max(EDIZIONI)))
    print(copertina(n, EDIZIONI[n]))
