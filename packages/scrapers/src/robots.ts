/**
 * Rispetto minimo di robots.txt + rate limiting per host. Non e' un parser
 * completo (niente wildcard `*`/`$` nei path), ma copre il caso comune:
 * gruppi User-agent con righe Disallow/Allow a prefisso.
 */

const USER_AGENT = "QuantumDealRadarBot/1.0 (+contatto: vedi package @qdr/scrapers)";

/** Product token con cui ci si identifica nei gruppi di robots.txt (RFC 9309). */
const TOKEN_BOT = "quantumdealradarbot";

interface RegoleRobots {
  disallow: string[];
  allow: string[];
}

const cacheRobots = new Map<string, RegoleRobots>();
const ultimaRichiesta = new Map<string, number>();

/** Svuota cache dei robots.txt e timer di rate limiting. Serve ai test per
 *  partire da uno stato pulito: senza, un host gia' interrogato resta memorizzato. */
export function azzeraCacheRobots(): void {
  cacheRobots.clear();
  ultimaRichiesta.clear();
}

async function leggiRobots(origin: string, f: typeof fetch): Promise<RegoleRobots> {
  const cached = cacheRobots.get(origin);
  if (cached) return cached;

  let regole: RegoleRobots = { disallow: [], allow: [] };
  try {
    const resp = await f(new URL("/robots.txt", origin).toString(), {
      headers: { "User-Agent": USER_AGENT },
    });
    if (resp.ok) {
      regole = parseRobotsTxt(await resp.text());
    }
  } catch {
    // robots.txt irraggiungibile: si tratta come "consenti tutto",
    // in linea con la convenzione standard.
  }
  cacheRobots.set(origin, regole);
  return regole;
}

interface Gruppo {
  agenti: string[];
  regole: RegoleRobots;
}

/**
 * Estrae le regole che si applicano a noi.
 *
 * RFC 9309 §2.2.1: vale il gruppo che nomina il nostro product token; solo in
 * sua assenza si ricade sul gruppo `*`. Unire i due, come faceva la versione
 * precedente, fa ereditare i divieti generici anche a un sito che ci concede
 * esplicitamente l'accesso — si scrapava meno di quanto permesso.
 */
export function parseRobotsTxt(testo: string, token: string = TOKEN_BOT): RegoleRobots {
  const gruppi: Gruppo[] = [];
  let corrente: Gruppo | null = null;
  // Righe User-agent consecutive condividono lo stesso gruppo di regole; la prima
  // riga di regole dopo di esse chiude l'elenco degli agenti.
  let inElencoAgenti = false;

  for (const rigaRaw of testo.split(/\r?\n/)) {
    const riga = rigaRaw.split("#")[0]?.trim() ?? "";
    const sep = riga.indexOf(":");
    if (sep < 0) continue;

    const chiave = riga.slice(0, sep).trim().toLowerCase();
    const valore = riga.slice(sep + 1).trim();

    if (chiave === "user-agent") {
      if (!corrente || !inElencoAgenti) {
        corrente = { agenti: [], regole: { disallow: [], allow: [] } };
        gruppi.push(corrente);
      }
      corrente.agenti.push(valore.toLowerCase());
      inElencoAgenti = true;
      continue;
    }

    inElencoAgenti = false;
    if (!corrente) continue;
    // "Disallow:" senza valore significa "nessun divieto": va ignorato, non
    // registrato come prefisso vuoto (che combacerebbe con qualunque path).
    if (chiave === "disallow" && valore) corrente.regole.disallow.push(valore);
    else if (chiave === "allow" && valore) corrente.regole.allow.push(valore);
  }

  const t = token.toLowerCase();
  const nostri = gruppi.filter((g) => g.agenti.some((a) => a !== "*" && (a === t || a.includes(t))));
  const scelti = nostri.length ? nostri : gruppi.filter((g) => g.agenti.includes("*"));

  return {
    disallow: scelti.flatMap((g) => g.regole.disallow),
    allow: scelti.flatMap((g) => g.regole.allow),
  };
}

export async function consentito(url: string, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const u = new URL(url);
  const regole = await leggiRobots(u.origin, fetchImpl);
  const path = u.pathname + u.search;

  const disallowMatch = regole.disallow.filter((p) => path.startsWith(p));
  const allowMatch = regole.allow.filter((p) => path.startsWith(p));
  if (disallowMatch.length === 0) return true;

  // Regola piu' lunga vince; a parita' vince Allow (RFC 9309 §2.2.2).
  const piuLungoDisallow = Math.max(...disallowMatch.map((p) => p.length));
  const piuLungoAllow = allowMatch.length ? Math.max(...allowMatch.map((p) => p.length)) : -1;
  return piuLungoAllow >= piuLungoDisallow;
}

/** Attende quanto serve perche' le richieste verso `sito` restino distanziate di `minSecondi`. */
export async function rallenta(sito: string, minSecondi: number): Promise<void> {
  const ultima = ultimaRichiesta.get(sito);
  const ora = Date.now();
  if (ultima !== undefined) {
    const trascorsi = (ora - ultima) / 1000;
    if (trascorsi < minSecondi) {
      await new Promise((r) => setTimeout(r, (minSecondi - trascorsi) * 1000));
    }
  }
  ultimaRichiesta.set(sito, Date.now());
}

export { USER_AGENT, TOKEN_BOT };
