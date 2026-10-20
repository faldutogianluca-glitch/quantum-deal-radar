"""Serie "Impegni scritti" nello stile della pillola sulla caparra (dark-gold), con le correzioni dell'analisi TikTok:
titolo dal fotogramma 0, volto sempre visibile (riquadro tondo nelle schede), sottotitoli al 67% dell'altezza,
riquadri che non spezzano le parole, audio a -14 LUFS.
Uso: python3 gen.py N  -> index.html dell'episodio N nei progetti 9x16 e 4x5."""
import difflib, html, json, re, sys
V = "/home/user/quantum-deal-radar/videos/"
MD = "/home/user/quantum-deal-radar/marketing/video-avatar/impegni-scritti.md"
GOLD = "#CFAF45"
TAIL = 4.6
AI = "Video con avatar AI di Gianluca Falduto. Contenuto generato con AI sotto la supervisione di Gianluca Falduto."

# Episodi: ogni blocco parte dalla frase indicata (prime parole del copione) e finisce dove parte il blocco dopo.
EP = {
 1: dict(
   hook='Mandi un immobile<br>e <g>non sai più niente?</g>',
   blocks=[
     ("loop", "Da noi non", dict(t='Da noi <g>non succede.</g>')),
     ("cards", "Entro quarantotto", dict(h="48 ORE", s="Risposta motivata, per iscritto", cards=[
         ("Entro quarantotto", "IL TEMPO", "Ti rispondiamo entro", "48 ore"),
         ("GO, WATCH", "IL VERDETTO", "Per iscritto:", "GO · WATCH · SCARTA"),
         ("E se è", "SE È NO", "Ti diciamo perché, e", "a che prezzo diventa sì")])),
     ("face", "Così sai", {}),
     ("name", "Sono Gianluca", {}),
     ("list", "Compriamo immobili", dict(h="COSA COMPRIAMO", s="A Milano e in Lombardia", items=[
         ("palazzine", "Palazzine intere"), ("uffici", "Uffici da trasformare in case"), ("immobili all'asta", "Immobili all'asta")])),
     ("cta", "Se ne hai", dict(q="Hai un immobile?<br><g>Il link è nel primo commento.</g>",
                               nx="Prossimo impegno: un'offerta vincolante in 7-10 giorni")),
   ],
   end='Risposta motivata<br>entro <g>48 ore.</g><br>Per iscritto.'),
 2: dict(
   hook="Un'offerta <g>a voce</g><br>non vale niente.",
   blocks=[
     ("cards", "Per questo, dopo", dict(h="7-10 GIORNI", s="Per un'offerta vincolante", cards=[
         ("planimetria", "I DOCUMENTI", "Planimetria, visure, provenienza", "e la perizia, se è all'asta"),
         ("Da quando", "DAI DOCUMENTI", "Entro", "7-10 giorni"),
         ("Scritta, con", "L'OFFERTA", "Scritta, con", "un prezzo e dei tempi")])),
     ("loop", "Non una manifestazione", dict(t='Non una manifestazione di interesse<br><g>da rinnovare ogni mese.</g>')),
     ("face", "Il proprietario sa", {}),
     ("name", "Sono Gianluca", {}),
     ("cta", "Il link per", dict(q="Hai un immobile da segnalarci?<br><g>Il link è nel primo commento.</g>",
                                 nx="Prossimo impegno: zero rinegoziazioni dopo la lettera d'intenti")),
   ],
   end='Offerta vincolante<br>in <g>7-10 giorni</g><br>dai documenti.'),
 3: dict(
   hook="A due settimane dal rogito<br>il compratore chiede <g>uno sconto?</g>",
   blocks=[
     ("loop", "Noi non lo", dict(t='Noi <g>non lo facciamo.</g>')),
     ("cards", "Dopo la lettera", dict(h="ZERO RINEGOZIAZIONI", s="Dopo la lettera d'intenti", cards=[
         ("Dopo la lettera", "DOPO LA LETTERA D'INTENTI", "Il prezzo", "non si rinegozia"),
         ("L'unica eccezione", "UNICA ECCEZIONE", "Fatti nuovi, documentati,", "che prima non si potevano vedere")])),
     ("list", "Il motivo è", dict(h="LI CERCHIAMO PRIMA", s="E li mettiamo subito nel prezzo, non al rogito", items=[
         ("Abusi", "Abusi"), ("occupazione", "Occupazione"), ("spese", "Spese condominiali arretrate"), ("conformità", "Conformità")])),
     ("name", "Sono Gianluca", {}),
     ("cta", "Se hai un", dict(q="Hai un immobile complicato?<br><g>Il link è nel primo commento.</g>",
                               nx="Prossimo impegno: il cliente resta tuo")),
   ],
   end='<g>Zero</g> rinegoziazioni<br>dopo la lettera<br>d\'intenti.'),
 4: dict(
   hook="Se ci porti un immobile,<br><g>il cliente resta tuo.</g>",
   blocks=[
     ("loop", "Sono tre regole", dict(t='<g>Tre regole.</g><br>Scritte prima, non dopo.')),
     ("list", "Uno: agli", dict(h="LE 3 REGOLE", s="Per chi ci porta un immobile", items=[
         ("Uno: agli", "Provvigione piena agli agenti iscritti"), ("Due: non", "Non scavalchiamo mai chi ci ha portato l'immobile"),
         ("Tre: quando", "Il mandato di rivendita va a chi ce l'ha portato")])),
     ("face", "Così una segnalazione", {}),
     ("name", "Sono Gianluca", {}),
     ("cta", "Il link è", dict(q="Lavoriamo a Milano e in Lombardia.<br><g>Il link è nel primo commento.</g>",
                               nx="I 4 impegni: 48 ore · 7-10 giorni · zero rinegoziazioni · il cliente resta tuo")),
   ],
   end='Se ci porti un immobile,<br><g>il cliente resta tuo.</g>'),
}

# Pillole TikTok "La casa in pillole" (copioni in marketing/analisi-tiktok-2026-10.md, copia in videos/pillole-tiktok-9x16/copioni.json)
PILL_TOP = "SEGUI LA CASA IN PILLOLE"
PILL_EP = "Vuoi vendere un immobile o segnalarcene uno?"
PILL_DISC = "Esempio illustrativo. Contenuto informativo, non consulenza."
EP.update({
 6: dict(pill=True,
   hook="Vinci l'asta<br>e <g>perdi 15.000 €?</g>",
   blocks=[
     ("loop", "E dipende da", dict(t='Dipende da <g>una data.</g>')),
     ("loop", "All'asta il saldo", dict(t='Saldo entro <g>120 giorni.</g><br>Non si tratta.')),
     ("cards", "Esempio illustrativo.", dict(h="IL CONTO", s="Esempio illustrativo", cards=[
         ("Ti aggiudichi", "AGGIUDICAZIONE", "Casa all'asta a", "150.000 €"),
         ("Con l'offerta", "CAUZIONE 10%", "Già versata:", "15.000 €"),
         ("La banca, all'ottanta", "MUTUO 80%", "La banca mette", "120.000 €"),
         ("Gli altri quindicimila", "DA AVERE GIÀ", "Il resto, più le imposte:", "15.000 €")])),
     ("loop", "Se il saldo", dict(t='Saldo non pagato:<br><g>cauzione persa.</g>')),
     ("list", "Prima di offrire", dict(h="PRIMA DI OFFRIRE", s="Tre cose da fare", items=[
         ("Uno: chiedi", "Mutuo chiesto prima dell'asta, per iscritto"), ("Due: leggi", "Leggi tutta la perizia"),
         ("Tre: controlla", "Controlla nell'avviso il termine del saldo")])),
     ("cta", "Tu quanti giorni", dict(q="Quanti giorni hai aspettato la banca?<br><g>Scrivilo nei commenti.</g>",
                                      nx="La prossima pillola: quanto costa davvero una casa da 180.000 €")),
   ],
   end="Vinci l'asta<br><g>senza perdere la cauzione.</g>"),
 10: dict(pill=True,
   hook="Casa da 180.000 €?<br><g>Te ne servono 12.500 in più.</g>",
   blocks=[
     ("loop", "Da dove arrivano?", dict(t='Da dove arrivano?<br><g>Da tre voci.</g>')),
     ("cards", "L'agenzia: nella", dict(h="I COSTI IN PIÙ", s="Simulazione Facile.it, agosto 2025", cards=[
         ("L'agenzia: nella", "AGENZIA", "Il 3% nella simulazione:", "5.400 € + IVA"),
         ("Il notaio, per", "NOTAIO", "Compravendita e mutuo:", "circa 2.500 €"),
         ("Le imposte, prima", "IMPOSTE", "Prima casa da privato:", "1.550 €")])),
     ("list", "Prima della proposta", dict(h="PRIMA DELLA PROPOSTA", s="Tre cose da fare", items=[
         ("Uno: fatti", "Provvigione scritta, prima di firmare"), ("Due: chiedi", "Preventivi scritti da più notai"),
         ("Tre: metti", "Anticipo e costi nello stesso budget")])),
     ("cta", "Quale costo ti", dict(q="Quale costo ti ha sorpreso di più?<br><g>Scrivilo nei commenti.</g>",
                                    nx="La prossima pillola: mutuo fisso o variabile")),
   ],
   end='Il prezzo<br>è solo <g>la prima riga.</g>'),
 14: dict(pill=True,
   hook="<g>879 €</g> per sempre<br>o <g>842 €</g> oggi?",
   blocks=[
     ("loop", "Fisso o variabile:", dict(t='Fisso o variabile?<br>Dipende da <g>una domanda.</g>')),
     ("cards", "Esempio illustrativo.", dict(h="FISSO O VARIABILE", s="170.000 € in 25 anni · esempio", cards=[
         ("Fisso al", "FISSO 3,8%", "Rata per sempre:", "879 € al mese"),
         ("Variabile al", "VARIABILE 3,4%", "Rata oggi:", "842 € al mese"),
         ("Ma se il", "VARIABILE +1 PUNTO (4,4%)", "La rata diventa:", "935 € al mese")])),
     ("loop", "La domanda non", dict(t='Non quale costa meno.<br><g>Quanto puoi reggere se sale.</g>')),
     ("list", "Prima di scegliere,", dict(h="PRIMA DI SCEGLIERE", s="Tre cose da fare", items=[
         ("Uno: fatti", "Simulazione con +1 e +2 punti"), ("Due: chiedi", "Variabile con un tetto al tasso"),
         ("Tre: ricorda", "Il mutuo si può spostare senza costi")])),
     ("cta", "Tu hai scelto", dict(q="Tu hai scelto fisso o variabile?<br><g>Scrivilo nei commenti.</g>",
                                   nx="Segui La casa in pillole: una a settimana")),
   ],
   end='Non quale costa meno:<br><g>quanto puoi reggere.</g>'),
})

CFG = {
 "9x16": dict(W=1080, H=1920, vy=0, hook_y=800, cap_y=1290, cap_fs=60, logo_y=1430, head_y=90, card_y=460, card_gap=26,
              pip=(860, 250, 170), name_y=1150, cta_y=890, bar=True, end_top=430),
 "4x5": dict(W=1080, H=1350, vy=-60, hook_y=690, cap_y=1060, cap_fs=54, logo_y=1240, head_y=56, card_y=350, card_gap=18,
             pip=(880, 190, 140), name_y=900, cta_y=640, bar=True, end_top=220),
}

def norm(s):
    s = s.lower().replace("’", "'")
    s = re.sub(r"[^\w']", "", s)
    return {"48": "quarantotto", "7": "sette", "1": "uno", "2": "due", "3": "tre", "10": "dieci"}.get(s, s)

def script_words(n):
    if EP[n].get("pill"):
        return json.load(open(V + "pillole-tiktok-9x16/copioni.json"))[str(n)].split()
    t = open(MD).read()
    s = re.findall(r"## Video \d\..*?```\n(.*?)```", t, re.S)[n - 1]
    return s.split()

DISPLAY = {"quarantotto": "48", "sette,": "7-10", "dieci": ""}
# numeri detti in lettere -> cifre nei sottotitoli (frasi del copione, in minuscolo e senza punteggiatura)
PHRASES = [
 ("dieci per cento", "10%"), ("ottanta per cento", "80%"), ("all'ottanta per cento", "all'80%"), ("tre per cento", "3%"),
 ("tre virgola otto per cento", "3,8%"), ("tre virgola quattro", "3,4%"), ("quattro virgola quattro", "4,4%"),
 ("quindicimila", "15.000"), ("centoventi", "120"), ("centocinquantamila", "150.000"), ("centoventimila", "120.000"),
 ("centottantamila", "180.000"), ("dodicimilacinquecento", "12.500"), ("cinquemilaquattrocento", "5.400"),
 ("duemilacinquecento", "2.500"), ("millecinquecentocinquanta", "1.550"), ("ottocentosettantanove", "879"),
 ("ottocentoquarantadue", "842"), ("centosettantamila", "170.000"), ("venticinque", "25"), ("trentasette", "37"),
 ("novecentotrentacinque", "935"), ("cinquantasei", "56")]

def numbers(out):
    res, i = [], 0
    while i < len(out):
        for ph, disp in sorted(PHRASES, key=lambda x: -len(x[0].split())):
            p = ph.split(); seg = out[i:i + len(p)]
            if [norm(w["key"]) for w in seg] == p:
                tail = re.sub(r"^.*?([.,?!:;]*)$", r"\1", seg[-1]["text"])
                res.append(dict(text=disp + tail, key=" ".join(w["key"] for w in seg), start=seg[0]["start"], end=seg[-1]["end"]))
                i += len(p); break
        else:
            res.append(out[i]); i += 1
    return res

def align(n, asr):
    sw = script_words(n)
    a = [norm(w["text"]) for w in asr]; b = [norm(w) for w in sw]
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    tim = [None] * len(sw)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for k in range(j2 - j1):
                tim[j1 + k] = (asr[i1 + k]["start"], asr[i1 + k]["end"])
        elif tag == "replace" and i2 > i1:
            s0, e0 = asr[i1]["start"], asr[i2 - 1]["end"]; m = j2 - j1
            for k in range(m):
                tim[j1 + k] = (s0 + (e0 - s0) * k / m, s0 + (e0 - s0) * (k + 1) / m)
    # parole del copione senza tempo: interpolate fra i vicini
    for j in range(len(sw)):
        if tim[j] is None:
            p = next((tim[k][1] for k in range(j - 1, -1, -1) if tim[k]), 0.0)
            q = next((tim[k][0] for k in range(j + 1, len(sw)) if tim[k]), p + 0.3)
            tim[j] = (p, max(p + 0.05, q))
    out = []
    for w, (s, e) in zip(sw, tim):
        d = w if EP[n].get("pill") else DISPLAY.get(w, w)
        if d == "" and out:
            out[-1]["end"] = e; continue
        out.append(dict(text=d, key=w, start=round(s, 3), end=round(e, 3)))
    return numbers(out)

def find(words, phrase):
    p = [norm(x) for x in phrase.split()]
    flat = [(norm(x), w["start"]) for w in words for x in w["key"].split()]
    k = [a for a, _ in flat]
    for i in range(len(k) - len(p) + 1):
        if k[i:i + len(p)] == p:
            return flat[i][1]
    raise SystemExit(f"frase non trovata: {phrase}")

def groups(words):
    out, g = [], []
    for w in words:
        g.append(w)
        if len(g) >= 4 or w["text"][-1] in ".,?!:;" or (len(g) >= 3 and len(w["text"]) > 9):
            out.append(g); g = []
    if g: out.append(g)
    return out

def gold(s): return s.replace("<g>", '<span class="gd">').replace("</g>", "</span>")

def page(n, k, words, alen):
    e, c = EP[n], CFG[k]; W, H = c["W"], c["H"]
    last = words[-1]["end"]; END = round(min(last + 0.35, alen), 2); D = round(END + (3.6 if e.get("pill") else TAIL), 2)
    ES = round(END - 0.3, 2)  # la card finale entra in dissolvenza mentre il video finisce
    px, py, pr = c["pip"]
    # tempi dei blocchi
    B = []
    for i, (kind, ph, data) in enumerate(e["blocks"]):
        B.append([kind, find(words, ph), data])
    for i in range(len(B)):
        B[i].append(B[i + 1][1] if i + 1 < len(B) else END)
    hook_end = B[0][1]
    els, js = [], []
    # sottotitoli
    G = groups(words); ev = []
    for gi, g in enumerate(G):
        spans = " ".join(f'<span class="w" id="w{gi}_{j}">{html.escape(w["text"])}</span>' for j, w in enumerate(g))
        els.append(f'<div class="cap" id="g{gi}" data-layout-allow-occlusion>{spans}</div>')
        a = g[0]["start"]; b = G[gi + 1][0]["start"] if gi + 1 < len(G) else last + 0.3
        ev.append([gi, round(max(a, 0), 3), round(min(b, END), 3), [round(w["start"], 3) for w in g]])
    # titolo d'aggancio: già visibile al fotogramma 0
    els.append(f'<div class="hook box" id="hook" data-layout-allow-occlusion><div class="dash"></div>{gold(e["hook"])}</div>')
    js.append(f'tl.set($("hook"), {{ opacity: 1 }}, 0); tl.to($("hook"), {{ opacity: 0, y: -16, duration: 0.3, ease: "power2.in" }}, {hook_end - 0.3:.2f});')
    pip_on = []
    for bi, (kind, t0, data, t1) in enumerate(B):
        if kind == "loop":
            els.append(f'<div class="hook box loop" id="b{bi}" data-layout-allow-occlusion>{gold(data["t"])}</div>')
            js.append(f'tl.fromTo($("b{bi}"), {{ opacity: 0, scale: 0.92 }}, {{ opacity: 1, scale: 1, duration: 0.35, ease: "back.out(1.6)" }}, {t0:.2f}); tl.to($("b{bi}"), {{ opacity: 0, duration: 0.25 }}, {t1 - 0.25:.2f});')
        elif kind in ("cards", "list"):
            pip_on.append((t0, t1))
            many = len(data.get("cards") or data.get("items") or []) >= 4
            inner = [f'<div class="shd"><div class="sh pf">{data["h"]}</div><div class="ss pf">{data["s"]}</div></div><div class="stack{' compact' if many else ''}">']
            if kind == "cards":
                for ci, (ph, lab, txt, val) in enumerate(data["cards"]):
                    inner.append(f'<div class="card" id="b{bi}c{ci}"><div class="cl">{lab}</div><div class="ct pf">{txt}</div><div class="cv pf">{val}</div></div>')
                    js.append(f'tl.fromTo($("b{bi}c{ci}"), {{ opacity: 0, x: -40 }}, {{ opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }}, {max(find(words, ph), t0 + 0.35):.2f});')
            else:
                for ci, (ph, txt) in enumerate(data["items"]):
                    inner.append(f'<div class="item" id="b{bi}c{ci}"><div class="in pf">{ci + 1:02d}</div><div class="it pf">{txt}</div></div>')
                    js.append(f'tl.fromTo($("b{bi}c{ci}"), {{ opacity: 0, x: -40 }}, {{ opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }}, {max(find(words, ph), t0 + 0.35):.2f});')
            els.append(f'<div class="sect" id="b{bi}" data-layout-allow-occlusion>{"".join(inner)}</div></div>')
            js.append(f'tl.fromTo($("b{bi}"), {{ opacity: 0 }}, {{ opacity: 1, duration: 0.35 }}, {t0 + 0.1:.2f}); tl.to($("b{bi}"), {{ opacity: 0, duration: 0.3 }}, {t1 - 0.3:.2f});')
        elif kind == "name":
            els.append(f'<div class="lt" id="b{bi}" data-layout-allow-occlusion><div class="lb"></div><div><div class="nm">Gianluca Falduto</div><div class="rl">Quantum RE · Milano</div></div></div>')
            js.append(f'tl.fromTo($("b{bi}"), {{ opacity: 0, x: -30 }}, {{ opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }}, {t0:.2f}); tl.to($("b{bi}"), {{ opacity: 0, duration: 0.3 }}, {min(t1, t0 + 3.2) - 0.3:.2f});')
        elif kind == "cta":
            els.append(f'<div class="topbar" id="b{bi}t"><span>{PILL_TOP if e.get("pill") else f"IMPEGNI SCRITTI · N. {n} DI 4"}</span></div>')
            els.append(f'<div class="box cta" id="b{bi}" data-layout-allow-occlusion>{gold(data["q"])}</div>')
            els.append(f'<div class="next" id="b{bi}n" data-layout-allow-occlusion><div class="nl">{data["nx"]}</div></div>')
            js.append(f'tl.fromTo($("b{bi}t"), {{ opacity: 0, y: -20 }}, {{ opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }}, {t0:.2f});')
            js.append(f'tl.fromTo($("b{bi}"), {{ opacity: 0, x: -40 }}, {{ opacity: 1, x: 0, duration: 0.45, ease: "power3.out" }}, {t0 + 0.15:.2f});')
            js.append(f'tl.fromTo($("b{bi}n"), {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }}, {t0 + 0.9:.2f});')
            js.append(f'tl.set([$("b{bi}t"), $("b{bi}"), $("b{bi}n")], {{ opacity: 0 }}, {END + 0.4:.2f});')
    # riquadro tondo: il volto resta in scena nelle schede
    for a, b in pip_on:
        js.append(f'tl.to($("vw"), {{ clipPath: "circle(330px at 540px 480px)", x: {px - 540}, y: {py - 480 - c["vy"]}, scale: {pr / 330:.4f}, duration: 0.55, ease: "power3.inOut" }}, {a:.2f});')
        js.append(f'tl.fromTo($("ring"), {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3 }}, {a + 0.4:.2f});')
        js.append(f'tl.to($("ring"), {{ opacity: 0, duration: 0.2 }}, {b - 0.5:.2f});')
        js.append(f'tl.to($("vw"), {{ clipPath: "circle(1400px at 540px 480px)", x: 0, y: 0, scale: 1, duration: 0.55, ease: "power3.inOut" }}, {b - 0.45:.2f});')
    sc = pr / 330
    return f'''<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="assets/vendor/gsap.min.js"></script>
    <style>
      @font-face {{ font-family: "Playfair Display"; font-weight: 700; font-display: block; src: url("assets/fonts/PlayfairDisplay-700.woff2") format("woff2"); }}
      @font-face {{ font-family: "Inter"; font-weight: 500; font-display: block; src: url("assets/fonts/Inter-500.woff2") format("woff2"); }}
      @font-face {{ font-family: "Inter"; font-weight: 700; font-display: block; src: url("assets/fonts/Inter-700.woff2") format("woff2"); }}
      @font-face {{ font-family: "Inter"; font-weight: 800; font-display: block; src: url("assets/fonts/Inter-800.woff2") format("woff2"); }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: #0b0b0b; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "Inter", sans-serif; color: #ffffff;
        background: radial-gradient(120% 70% at 50% 0%, #1d1a10 0%, #0d0d0d 55%, #070707 100%); }}
      .pf {{ font-family: "Playfair Display", serif; font-weight: 700; }}
      .gd {{ color: {GOLD}; }}
      #vw {{ position: absolute; left: 0; top: {c["vy"]}px; width: 1080px; height: 1920px; transform-origin: 540px 480px; clip-path: circle(1400px at 540px 480px); }}
      #av {{ position: absolute; left: 0; top: 0; width: 1080px; height: 1920px; object-fit: cover; }}
      #ring {{ position: absolute; left: {px - pr - 4}px; top: {py - pr - 4}px; width: {2 * pr + 8}px; height: {2 * pr + 8}px; border-radius: 50%; border: 4px solid {GOLD}; opacity: 0; }}
      #shade {{ position: absolute; left: 0; top: {round(H * 0.55)}px; width: {W}px; height: {H - round(H * 0.55)}px; background: linear-gradient(180deg, rgba(0,0,0,0), rgba(0,0,0,.55)); }}
      .box {{ position: absolute; left: 60px; right: 60px; background: rgba(8,8,8,.78); border-left: 6px solid {GOLD}; padding: 26px 34px;
        font-family: "Playfair Display", serif; font-weight: 700; color: #ffffff; text-align: center; overflow-wrap: normal; word-break: normal; hyphens: none; }}
      .hook {{ top: {c["hook_y"]}px; font-size: {58 if k == "9x16" else 52}px; line-height: 1.22; }}
      .hook .dash {{ position: absolute; left: 50%; top: -22px; width: 70px; height: 3px; margin-left: -35px; background: {GOLD}; }}
      .loop {{ opacity: 0; }}
      .sect {{ position: absolute; left: 0; top: 0; width: {W}px; height: {H}px; opacity: 0; }}
      .shd {{ position: absolute; left: 60px; right: {W - px + pr + 30}px; top: {c["head_y"]}px; }}
      .stack {{ position: absolute; left: 60px; right: 60px; top: {c["card_y"]}px; display: flex; flex-direction: column; gap: {c["card_gap"]}px; }}
      .sh {{ font-size: {64 if k == "9x16" else 54}px; line-height: 1.05; color: {GOLD}; letter-spacing: .04em; }}
      .ss {{ margin-top: 12px; font-size: {32 if k == "9x16" else 28}px; color: #e9e4d2; }}
      .card, .item {{ position: relative; background: linear-gradient(180deg, #161616, #0e0e0e); border: 1px solid rgba(207,175,69,.22); border-left: 5px solid {GOLD}; border-radius: 10px; opacity: 0; }}
      .card {{ padding: {"28px 34px" if k == "9x16" else "18px 28px"}; }}
      .cl {{ font-weight: 700; font-size: {24 if k == "9x16" else 21}px; letter-spacing: .14em; color: {GOLD}; }}
      .ct {{ margin-top: 10px; font-size: {44 if k == "9x16" else 33}px; color: #ffffff; line-height: 1.2; }}
      .cv {{ margin-top: 6px; font-size: {56 if k == "9x16" else 40}px; color: {GOLD}; line-height: 1.15; }}
      .stack.compact {{ gap: 14px; }}
      .stack.compact .card {{ padding: 14px 26px; }}
      .stack.compact .cl {{ font-size: 21px; }}
      .stack.compact .ct {{ font-size: {34 if k == "9x16" else 28}px; margin-top: 6px; }}
      .stack.compact .cv {{ font-size: {44 if k == "9x16" else 34}px; margin-top: 2px; }}
      .stack.compact .item {{ padding: 12px 24px; }}
      .stack.compact .it {{ font-size: {36 if k == "9x16" else 30}px; }}
      .item {{ display: flex; align-items: center; gap: 26px; padding: 18px 28px; }}
      .in {{ font-size: {60 if k == "9x16" else 48}px; color: {GOLD}; line-height: 1; flex: none; }}
      .it {{ font-size: {44 if k == "9x16" else 33}px; line-height: 1.2; }}
      .cap {{ position: absolute; left: 110px; right: 110px; top: {c["cap_y"]}px; text-align: center; font-weight: 800; font-size: {c["cap_fs"]}px; line-height: 1.2;
        color: #ffffff; text-shadow: 0 3px 12px rgba(0,0,0,.85), 0 0 2px rgba(0,0,0,.9); opacity: 0; }}
      .w {{ display: inline-block; }}
      #logo {{ position: absolute; left: {W // 2 - 60}px; top: {c["logo_y"]}px; width: 120px; height: 66px; opacity: .92; }}
      #logo img {{ display: block; width: 100%; height: 100%; }}
      .lt {{ position: absolute; left: 60px; top: {c["name_y"]}px; display: flex; align-items: center; gap: 18px; opacity: 0; background: rgba(8,8,8,.7); padding: 14px 26px 14px 18px; border-radius: 8px; }}
      .lb {{ width: 6px; height: 70px; background: {GOLD}; }}
      .nm {{ font-family: "Playfair Display", serif; font-weight: 700; font-size: 38px; }}
      .rl {{ font-weight: 500; font-size: 26px; color: #e9e4d2; }}
      .topbar {{ position: absolute; left: 0; top: 0; width: {W}px; height: 92px; background: rgba(6,6,6,.92); border-bottom: 3px solid {GOLD}; display: flex; align-items: center; justify-content: center; opacity: 0; }}
      .topbar span {{ font-family: "Playfair Display", serif; font-weight: 700; font-size: 34px; letter-spacing: .1em; color: {GOLD}; }}
      .cta {{ top: {c["cta_y"]}px; font-size: {50 if k == "9x16" else 44}px; line-height: 1.25; opacity: 0; }}
      .next {{ position: absolute; left: 60px; right: 60px; top: {c["cta_y"] + (230 if k == "9x16" else 190)}px; display: flex; justify-content: center; opacity: 0; }}
      .nl {{ background: rgba(207,175,69,.92); color: #111111; font-weight: 700; font-size: {30 if k == "9x16" else 27}px; line-height: 1.3; padding: 14px 24px; border-radius: 8px; text-align: center; }}
      #end {{ position: absolute; left: 0; top: 0; width: {W}px; height: {H}px; background: radial-gradient(120% 70% at 50% 0%, #1d1a10 0%, #0d0d0d 55%, #070707 100%); }}
      #ein {{ position: absolute; left: 80px; right: 80px; top: {c["end_top"]}px; display: flex; flex-direction: column; gap: 42px; }}
      #elogo {{ height: 120px; }}
      #elogo img {{ display: block; height: 100%; }}
      #eline {{ width: 90px; height: 4px; background: {GOLD}; }}
      #eh {{ font-size: {84 if k == "9x16" else 72}px; line-height: 1.1; color: #ffffff; }}
      #ep {{ font-weight: 500; font-size: 36px; color: #e9e4d2; }}
      #eurl {{ align-self: flex-start; font-weight: 800; font-size: 44px; background: {GOLD}; color: #111111; padding: 18px 30px; border-radius: 10px; }}
      #eai {{ position: absolute; left: 80px; right: 80px; top: {H - (210 if k == "9x16" else 150)}px; font-weight: 500; font-size: 24px; line-height: 1.4; color: #b9b29a; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{D}" data-width="{W}" data-height="{H}">
      <div id="vw" data-layout-allow-overflow>
        <video id="av" class="clip" src="assets/avatar/v{n}.mp4" muted playsinline data-start="0" data-duration="{min(END, alen):.2f}" data-track-index="0"></video>
      </div>
      <div id="ring"></div>
      <div id="shade"></div>
      <div id="logo"><img src="assets/logo-bianco.svg" alt="Quantum RE" /></div>
      {chr(10).join("      " + x for x in els).strip()}
      <audio id="voice" src="assets/avatar/v{n}-audio.m4a" data-start="0" data-duration="{min(END, alen):.2f}" data-track-index="2" data-volume="1"></audio>
      <div id="end" class="clip" data-start="{ES}" data-duration="{round(D - ES, 2)}" data-track-index="1">
        <div id="ein">
          <div id="elogo"><img src="assets/logo-bianco.svg" alt="Quantum RE" /></div>
          <div id="eline"></div>
          <div id="eh" class="pf">{gold(e["end"])}</div>
          <div id="ep">{PILL_EP if e.get("pill") else "Hai un immobile a Milano o in Lombardia?"}</div>
          <div id="eurl">valutazione.quantumre.it</div>
        </div>
        <div id="eai">{(PILL_DISC + " ") if e.get("pill") else ""}{AI}</div>
      </div>
    </div>
    <script>
      (function () {{
        const $ = (id) => document.getElementById(id);
        const tl = gsap.timeline({{ paused: true }});
        {chr(10).join("        " + x for x in js).strip()}
        const ev = {json.dumps(ev)};
        ev.forEach(([g, a, b, ws]) => {{
          const el = $("g" + g);
          tl.set(el, {{ opacity: 1 }}, a);
          tl.set(el, {{ opacity: 0 }}, b);
          ws.forEach((t, j) => {{
            const w = $("w" + g + "_" + j);
            tl.set(w, {{ color: "{GOLD}" }}, t);
            tl.set(w, {{ color: "#ffffff" }}, j + 1 < ws.length ? ws[j + 1] : b);
          }});
        }});
        tl.fromTo($("end"), {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3, ease: "power2.out" }}, {ES});
        tl.fromTo($("elogo"), {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }}, {END + 0.15:.2f});
        tl.fromTo($("eline"), {{ scaleX: 0 }}, {{ scaleX: 1, duration: 0.5, ease: "power3.out", transformOrigin: "0% 50%" }}, {END + 0.3:.2f});
        tl.fromTo($("eh"), {{ opacity: 0, y: 40 }}, {{ opacity: 1, y: 0, duration: 0.55, ease: "power4.out" }}, {END + 0.4:.2f});
        tl.fromTo($("ep"), {{ opacity: 0, y: 20 }}, {{ opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }}, {END + 0.8:.2f});
        tl.fromTo($("eurl"), {{ opacity: 0, scale: 0.7 }}, {{ opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.8)" }}, {END + 1.1:.2f});
        tl.fromTo($("eai"), {{ opacity: 0 }}, {{ opacity: 1, duration: 0.5 }}, {END + 1.2:.2f});
        tl.to({{}}, {{ duration: {D} }}, 0);
        window.__timelines = window.__timelines || {{}};
        window.__timelines["main"] = tl;
      }})();
    </script>
  </body>
</html>
'''

if __name__ == "__main__":
    n = int(sys.argv[1])
    pill = EP[n].get("pill")
    for k in (["9x16"] if pill else CFG):
        d = V + (f"pillole-tiktok-{k}/" if pill else f"impegni-scritti-{k}/")
        asr = json.load(open(d + f"assets/avatar/v{n}-words.json"))
        words = align(n, asr)
        json.dump(words, open(d + f"assets/avatar/v{n}-captions.json", "w"), ensure_ascii=False, indent=0)
        import subprocess
        alen = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", d + f"assets/avatar/v{n}-audio.m4a"]))
        vlen = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", d + f"assets/avatar/v{n}.mp4"]))
        open(d + "index.html", "w").write(page(n, k, words, min(alen, vlen) - 0.02))
    print("ok", n, " ".join(w["text"] for w in words))
