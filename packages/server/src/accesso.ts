/**
 * Accesso al server (rilievo 3 della revisione del 24/10/2026).
 *
 * Modalita' locale (predefinita): ascolto solo su loopback. Senza token l'accesso e' aperto
 * a chi sta sul computer, ma richieste cross-site e DNS rebinding sono bloccate controllando
 * Host e Origin.
 *
 * Modalita' remota: il server ascolta su un'interfaccia raggiungibile da altri SOLO se
 * esistono QDR_HOST (non loopback) e QDR_TOKEN valido. Senza, non parte. Il traffico va
 * cifrato da chi espone il servizio (reverse proxy con TLS): il server non fa TLS.
 *
 * Il token non e' mai nel JavaScript pubblico ne' in un URL: viaggia nell'intestazione
 * Authorization (Bearer per gli script, Basic per il browser, che lo chiede da solo).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export class ErroreConfigurazione extends Error {
  constructor(messaggio: string) {
    super(messaggio);
    this.name = "ErroreConfigurazione";
  }
}

export interface ConfigAccesso {
  host: string;
  /** null = nessuna autenticazione (consentito solo in locale) */
  token: string | null;
  remoto: boolean;
  /** secondi minimi fra due avvii di scraping o arricchimento */
  cooldownOperazioniSecondi: number;
  /** tentativi di accesso falliti consentiti per indirizzo, nella finestra */
  maxFallimenti: number;
  finestraFallimentiSecondi: number;
  /** nomi di host accettati oltre a loopback (per un reverse proxy) */
  hostPermessi: string[];
}

export const TOKEN_LUNGHEZZA_MINIMA = 24;

export function eLoopback(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "::1" || /^127\.\d+\.\d+\.\d+$/.test(h);
}

const numeroEnv = (v: string | undefined, predefinito: number): number => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) && n >= 0 ? n : predefinito;
};

export function leggiConfigAccesso(env: NodeJS.ProcessEnv = process.env): ConfigAccesso {
  const host = (env.QDR_HOST ?? "127.0.0.1").trim();
  const remoto = !eLoopback(host);
  const token = env.QDR_TOKEN && env.QDR_TOKEN.length > 0 ? env.QDR_TOKEN : null;

  if (token !== null && token.length < TOKEN_LUNGHEZZA_MINIMA) {
    throw new ErroreConfigurazione(
      `QDR_TOKEN troppo corto: servono almeno ${TOKEN_LUNGHEZZA_MINIMA} caratteri (generane uno con: openssl rand -hex 24).`,
    );
  }
  if (remoto && token === null) {
    throw new ErroreConfigurazione(
      `Il server e' configurato per ascoltare su ${host}, raggiungibile da altri computer, ma manca QDR_TOKEN. ` +
        "Imposta un token di almeno 24 caratteri oppure usa l'ascolto locale (QDR_HOST=127.0.0.1).",
    );
  }
  return {
    host,
    token,
    remoto,
    cooldownOperazioniSecondi: numeroEnv(env.QDR_COOLDOWN_SECONDI, 30),
    maxFallimenti: numeroEnv(env.QDR_MAX_FALLIMENTI, 10),
    finestraFallimentiSecondi: numeroEnv(env.QDR_FINESTRA_FALLIMENTI_SECONDI, 300),
    hostPermessi: (env.QDR_HOST_PERMESSI ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
  };
}

const impronta = (s: string): Buffer => createHash("sha256").update(s).digest();

/** Confronto a tempo costante: l'esito non dipende da quanti caratteri coincidono. */
export function tokenCorretto(fornito: string, atteso: string): boolean {
  return timingSafeEqual(impronta(fornito), impronta(atteso));
}

/** Estrae il token da Authorization: Bearer <token> oppure Basic base64(utente:token). */
export function tokenDaIntestazione(valore: string | undefined): string | null {
  if (!valore) return null;
  const m = /^(Bearer|Basic)\s+(.+)$/i.exec(valore.trim());
  if (!m) return null;
  if (m[1]!.toLowerCase() === "bearer") return m[2]!.trim();
  try {
    const decodificato = Buffer.from(m[2]!.trim(), "base64").toString("utf8");
    const i = decodificato.indexOf(":");
    return i >= 0 ? decodificato.slice(i + 1) : null;
  } catch {
    return null;
  }
}

const nomeHost = (hostHeader: string | undefined): string => {
  const h = (hostHeader ?? "").trim().toLowerCase();
  if (h.startsWith("[")) return h.slice(1, h.indexOf("]")); // [::1]:3000
  return h.split(":")[0] ?? "";
};

/** Respinge richieste con Host o Origin estranei: difende da DNS rebinding e richieste cross-site. */
export function controlloOrigine(config: ConfigAccesso) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const host = nomeHost(req.headers.host);
    const ammesso = eLoopback(host) || config.hostPermessi.includes(host) || (config.remoto && host === config.host.toLowerCase());
    if (!ammesso) {
      res.status(421).json({ errore: "Host non ammesso" });
      return;
    }
    const origin = req.headers.origin;
    if (typeof origin === "string" && origin !== "null") {
      let oh = "";
      try { oh = new URL(origin).host.toLowerCase(); } catch { /* origine non valida */ }
      if (oh !== (req.headers.host ?? "").toLowerCase()) {
        res.status(403).json({ errore: "Origine non ammessa" });
        return;
      }
    } else if (origin === "null" && req.method !== "GET" && req.method !== "HEAD") {
      res.status(403).json({ errore: "Origine non ammessa" });
      return;
    }
    next();
  };
}

/** Registro dei tentativi falliti per indirizzo, in memoria. */
export class LimiteFallimenti {
  private tentativi = new Map<string, number[]>();
  constructor(private max: number, private finestraMs: number, private adesso: () => number = Date.now) {}

  private pulisci(chiave: string): number[] {
    const limite = this.adesso() - this.finestraMs;
    const v = (this.tentativi.get(chiave) ?? []).filter((t) => t > limite);
    if (v.length) this.tentativi.set(chiave, v); else this.tentativi.delete(chiave);
    return v;
  }
  bloccato(chiave: string): number {
    const v = this.pulisci(chiave);
    if (v.length < this.max) return 0;
    return Math.max(1, Math.ceil((v[0]! + this.finestraMs - this.adesso()) / 1000));
  }
  registra(chiave: string): void {
    const v = this.pulisci(chiave);
    v.push(this.adesso());
    this.tentativi.set(chiave, v);
  }
  azzera(chiave: string): void {
    this.tentativi.delete(chiave);
  }
}

/** Autenticazione. Con token: serve a tutto, dashboard compresa. Senza token: passa. */
export function autenticazione(config: ConfigAccesso, limite: LimiteFallimenti) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (config.token === null) { next(); return; }
    const chi = req.ip ?? req.socket.remoteAddress ?? "sconosciuto";
    const attesa = limite.bloccato(chi);
    if (attesa > 0) {
      res.set("Retry-After", String(attesa)).status(429).json({ errore: "Troppi tentativi falliti, riprova piu' tardi" });
      return;
    }
    const fornito = tokenDaIntestazione(req.headers.authorization);
    if (fornito !== null && tokenCorretto(fornito, config.token)) {
      limite.azzera(chi);
      next();
      return;
    }
    // Solo un token SBAGLIATO e' un tentativo: l'assenza di intestazione e' la richiesta iniziale
    // del browser (o di uno scanner) e dietro un proxy condiviso bloccherebbe il proprietario.
    if (fornito !== null) limite.registra(chi);
    res.set("WWW-Authenticate", 'Basic realm="Quantum Deal Radar", charset="UTF-8"').status(401).json({ errore: "Autenticazione richiesta" });
  };
}

/** Intestazioni di difesa per la dashboard. Nessuna risorsa esterna: tutto da 'self'. */
export function intestazioniSicurezza(_req: Request, res: Response, next: NextFunction): void {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  });
  next();
}
