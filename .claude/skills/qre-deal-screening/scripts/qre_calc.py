#!/usr/bin/env python3
"""Calcolo deterministico delle metriche QRE per un'operazione immobiliare.

Uso:
  python qre_calc.py --acquisto 170000 --oneri 60000 --rigenerazione 450000 \
      --valore-post 1230000 --mesi 24 [--costi-vendita-pct 3] [--soglia-margine 30]

Stampa JSON con costo totale, utile lordo, margine/ROI lordo, IRR annuo
(ipotesi: esborso tutto a t0, incasso tutto a fine operazione), verdetto
numerico e sensitivity su prezzo di vendita (-10%/-20%) e costi (+15%).
"""
import argparse, json


def metriche(acq, oneri, rig, valore, mesi, vendita_pct):
    costi_vendita = valore * vendita_pct / 100
    costo_tot = acq + oneri + rig
    utile = valore - costi_vendita - costo_tot
    margine = utile / costo_tot
    multiplo = (valore - costi_vendita) / costo_tot
    irr = multiplo ** (12 / mesi) - 1 if multiplo > 0 else -1.0
    return {
        "costo_totale": round(costo_tot),
        "costi_vendita": round(costi_vendita),
        "utile_lordo": round(utile),
        "margine_roi_lordo_pct": round(margine * 100, 1),
        "irr_annuo_pct": round(irr * 100, 1),
    }


def verdetto(m, soglia_margine):
    ok_margine = m["margine_roi_lordo_pct"] >= soglia_margine
    ok_roi = m["margine_roi_lordo_pct"] >= 20
    ok_irr = m["irr_annuo_pct"] >= 12
    if ok_margine and ok_irr:
        return "GO (numerico)"
    if ok_roi and ok_irr:
        return "WATCH (sopra soglie minime, sotto soglia club deal)"
    return "SCARTA (numerico)"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--acquisto", type=float, required=True)
    p.add_argument("--oneri", type=float, default=0, help="imposte, notaio, professionisti, oneri urbanistici")
    p.add_argument("--rigenerazione", type=float, default=0)
    p.add_argument("--valore-post", type=float, required=True)
    p.add_argument("--mesi", type=float, required=True, help="durata totale operazione in mesi")
    p.add_argument("--costi-vendita-pct", type=float, default=0)
    p.add_argument("--soglia-margine", type=float, default=30)
    a = p.parse_args()

    base = metriche(a.acquisto, a.oneri, a.rigenerazione, a.valore_post, a.mesi, a.costi_vendita_pct)
    sens = {
        "vendita_-10%": metriche(a.acquisto, a.oneri, a.rigenerazione, a.valore_post * 0.9, a.mesi, a.costi_vendita_pct),
        "vendita_-20%": metriche(a.acquisto, a.oneri, a.rigenerazione, a.valore_post * 0.8, a.mesi, a.costi_vendita_pct),
        "rigenerazione_+15%": metriche(a.acquisto, a.oneri, a.rigenerazione * 1.15, a.valore_post, a.mesi, a.costi_vendita_pct),
        "tempi_+6_mesi": metriche(a.acquisto, a.oneri, a.rigenerazione, a.valore_post, a.mesi + 6, a.costi_vendita_pct),
    }
    # prezzo massimo d'acquisto che rispetta la soglia di margine
    target = 1 + a.soglia_margine / 100
    netto = a.valore_post * (1 - a.costi_vendita_pct / 100)
    max_costo = netto / target
    max_acquisto = max_costo - a.oneri - a.rigenerazione
    out = {
        "base": base,
        "verdetto_numerico": verdetto(base, a.soglia_margine),
        "sensitivity": sens,
        "prezzo_max_acquisto_per_soglia": round(max_acquisto),
        "ipotesi_irr": "esborso interamente a t0, incasso interamente a fine operazione, senza leva",
    }
    print(json.dumps(out, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
