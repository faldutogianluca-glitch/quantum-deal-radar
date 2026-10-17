"""Misura la visibilita' dei siti nelle risposte delle AI.

Pone le domande di domande.csv a ChatGPT (OpenAI), Perplexity e Gemini, con la
ricerca web attiva, e registra per ogni risposta se il brand e' nominato e se il
suo sito e' tra le fonti. Usa solo la libreria standard di Python.

Chiavi (variabili d'ambiente; i motori senza chiave vengono saltati):
    OPENAI_API_KEY      PERPLEXITY_API_KEY      GEMINI_API_KEY
Modelli (facoltativi): OPENAI_MODEL, PERPLEXITY_MODEL, GEMINI_MODEL

Uso:
    python misura.py                      # tutti i siti, 3 ripetizioni
    python misura.py --siti quantumre --ripetizioni 1
    python misura.py --riepilogo-solo     # rifa' solo riepilogo.md

I risultati vanno in risultati/: un CSV per giorno e riepilogo.md. Se lo script
si interrompe, rilanciandolo riprende dalle risposte mancanti.
"""
import argparse
import csv
import datetime
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from urllib.parse import urlparse

QUI = os.path.dirname(os.path.abspath(__file__))
CAMPI = ["data", "sito", "n", "tipo", "motore", "ripetizione", "nominato", "citato",
         "domanda", "fonti", "risposta", "errore"]


def _post(url, corpo, intestazioni):
    req = urllib.request.Request(url, data=json.dumps(corpo).encode(), method="POST",
                                 headers={"Content-Type": "application/json", **intestazioni})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def _url_in(obj):
    """Tutti gli URL e i titoli-dominio presenti in una risposta JSON, a qualsiasi livello."""
    trovati = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and k in ("url", "uri", "title") and ("." in v):
                trovati.append(v)
            else:
                trovati += _url_in(v)
    elif isinstance(obj, list):
        for v in obj:
            trovati += _url_in(v) if not isinstance(v, str) else ([v] if v.startswith("http") else [])
    return trovati


def openai(domanda):
    dati = _post("https://api.openai.com/v1/responses",
                 {"model": os.environ.get("OPENAI_MODEL", "gpt-6-astra"),
                  "tools": [{"type": "web_search"}], "input": domanda},
                 {"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"})
    testo = " ".join(c.get("text", "") for item in dati.get("output", []) if item.get("type") == "message"
                     for c in item.get("content", []))
    return testo, _url_in(dati.get("output", []))


def perplexity(domanda):
    dati = _post("https://api.perplexity.ai/v1/sonar",
                 {"model": os.environ.get("PERPLEXITY_MODEL", "sonar"),
                  "messages": [{"role": "user", "content": domanda}]},
                 {"Authorization": f"Bearer {os.environ['PERPLEXITY_API_KEY']}"})
    testo = " ".join(c.get("message", {}).get("content", "") for c in dati.get("choices", []))
    return testo, dati.get("citations", []) + _url_in(dati.get("search_results", []))


def gemini(domanda):
    modello = os.environ.get("GEMINI_MODEL", "gemini-3.8-flash")
    dati = _post(f"https://generativelanguage.googleapis.com/v1beta/models/{modello}:generateContent",
                 {"contents": [{"parts": [{"text": domanda}]}], "tools": [{"google_search": {}}]},
                 {"x-goog-api-key": os.environ["GEMINI_API_KEY"]})
    cand = dati.get("candidates", [])
    testo = " ".join(p.get("text", "") for c in cand for p in c.get("content", {}).get("parts", []))
    return testo, _url_in([c.get("groundingMetadata", {}) for c in cand])


MOTORI = {"chatgpt": ("OPENAI_API_KEY", openai),
          "perplexity": ("PERPLEXITY_API_KEY", perplexity),
          "gemini": ("GEMINI_API_KEY", gemini)}


REDIRECT = {"vertexaisearch.cloud.google.com"}  # link intermedi di Gemini, non sono fonti


def dominio(u):
    """Dominio di un URL, o il titolo stesso se e' gia' un dominio (Gemini mette li' la fonte)."""
    u = u.strip().lower()
    host = urlparse(u).netloc if u.startswith("http") else u
    host = host.removeprefix("www.").split(":")[0]
    return host if re.fullmatch(r"[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}", host) and host not in REDIRECT else ""


def valuta(testo, fonti, sito):
    t = testo.lower()
    nominato = any(re.search(r"\b" + re.escape(n.lower()) + r"\b", t) for n in sito["nomi"])
    domini = {d for d in map(dominio, fonti) if d}
    nel_testo = set(re.findall(r"[a-z0-9-]+\.(?:it|com)\b", t))
    citato = any(d == dom or d.endswith("." + dom) for d in domini | nel_testo for dom in sito["domini"])
    return nominato, citato, sorted(domini)


def chiedi(fn, domanda, tentativi=3):
    for i in range(tentativi):
        try:
            return fn(domanda) + ("",)
        except urllib.error.HTTPError as e:
            errore = f"HTTP {e.code}: {e.read()[:200].decode(errors='replace')}"
            if e.code not in (429, 500, 502, 503, 504):
                break
        except Exception as e:  # rete, timeout, JSON inatteso
            errore = f"{type(e).__name__}: {e}"
        time.sleep(5 * (i + 1))
    return "", [], errore


def misura(siti, domande, motori, ripetizioni, file_csv):
    fatte = set()
    if os.path.exists(file_csv):
        with open(file_csv, encoding="utf-8") as f:
            fatte = {(r["sito"], r["n"], r["motore"], r["ripetizione"]) for r in csv.DictReader(f) if not r["errore"]}
    nuovo = not os.path.exists(file_csv)
    with open(file_csv, "a", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CAMPI)
        if nuovo:
            w.writeheader()
        for d in domande:
            for motore in motori:
                for rip in range(1, ripetizioni + 1):
                    if (d["sito"], d["n"], motore, str(rip)) in fatte:
                        continue
                    testo, fonti, errore = chiedi(MOTORI[motore][1], d["domanda"])
                    if errore.startswith(("HTTP 401", "HTTP 403")):
                        sys.exit(f"{motore}: chiave rifiutata ({errore}). Controlla {MOTORI[motore][0]}.")
                    nom, cit, domini = valuta(testo, fonti, siti[d["sito"]])
                    w.writerow({"data": datetime.date.today().isoformat(), "sito": d["sito"], "n": d["n"],
                                "tipo": d["tipo"], "motore": motore, "ripetizione": rip,
                                "nominato": int(nom), "citato": int(cit), "domanda": d["domanda"],
                                "fonti": " ".join(domini), "risposta": testo[:4000], "errore": errore})
                    f.flush()
                    stato = "ERRORE" if errore else ("NOMINATO" if nom else "-")
                    print(f"{d['sito']} #{d['n']} {motore} r{rip}: {stato}", file=sys.stderr)


def riepilogo(file_csv, file_md):
    with open(file_csv, encoding="utf-8") as f:
        righe = [r for r in csv.DictReader(f) if not r["errore"]]
    per = defaultdict(list)
    concorrenti = defaultdict(Counter)
    for r in righe:
        per[(r["sito"], r["tipo"], r["motore"])].append(r)
        if r["tipo"] == "scoperta":
            concorrenti[r["sito"]].update(r["fonti"].split())
    pct = lambda rs, k: f"{100 * sum(int(r[k]) for r in rs) / len(rs):.0f}%" if rs else "-"
    motori = sorted({r["motore"] for r in righe})
    out = [f"# Misura visibilità AI – {os.path.basename(file_csv)[10:20]}", "",
           "Percentuale di risposte in cui il brand è nominato / il sito è tra le fonti.",
           "Le domande \"scoperta\" non contengono il nome del brand: sono quelle che contano.", ""]
    for sito in sorted({r["sito"] for r in righe}):
        out += [f"## {sito}", "", "| Motore | Scoperta: nominato | Scoperta: citato | Brand: nominato | Risposte |",
                "| --- | --- | --- | --- | --- |"]
        for m in motori:
            s, b = per[(sito, "scoperta", m)], per[(sito, "brand", m)]
            out.append(f"| {m} | {pct(s, 'nominato')} | {pct(s, 'citato')} | {pct(b, 'nominato')} | {len(s) + len(b)} |")
        top = ", ".join(f"{d} ({n})" for d, n in concorrenti[sito].most_common(10))
        out += ["", f"Fonti più citate nelle domande di scoperta: {top or '-'}", ""]
    with open(file_md, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    print("\n".join(out))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--siti", default="tutti", help="tutti, oppure nomi separati da virgola")
    ap.add_argument("--ripetizioni", type=int, default=3)
    ap.add_argument("--riepilogo-solo", action="store_true")
    a = ap.parse_args()

    with open(os.path.join(QUI, "siti.json"), encoding="utf-8") as f:
        siti = json.load(f)
    with open(os.path.join(QUI, "domande.csv"), encoding="utf-8") as f:
        domande = list(csv.DictReader(f))
    if a.siti != "tutti":
        scelti = set(a.siti.split(","))
        domande = [d for d in domande if d["sito"] in scelti]

    cartella = os.path.join(QUI, "risultati")
    os.makedirs(cartella, exist_ok=True)
    file_csv = os.path.join(cartella, f"risultati_{datetime.date.today().isoformat()}.csv")

    if not a.riepilogo_solo:
        motori = [m for m, (chiave, _) in MOTORI.items() if os.environ.get(chiave)]
        if not motori:
            sys.exit("Nessuna chiave API trovata: imposta OPENAI_API_KEY, PERPLEXITY_API_KEY o GEMINI_API_KEY.")
        print(f"Motori: {', '.join(motori)} · {len(domande)} domande × {a.ripetizioni} ripetizioni", file=sys.stderr)
        misura(siti, domande, motori, a.ripetizioni, file_csv)
    riepilogo(file_csv, os.path.join(cartella, "riepilogo.md"))


if __name__ == "__main__":
    main()
