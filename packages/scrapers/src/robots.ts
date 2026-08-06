/**
 * Rispetto minimo di robots.txt + rate limiting per host. Non e' un parser
 * robots.txt completo (niente wildcard/regex avanzate), ma copre il caso
 * comune: gruppi User-agent con righe Disallow/Allow a prefisso.
 */

const USER_AGENT = "QuantumDealRadarBot/1.0 (+contatto: vedi package @qdr/scrapers)";

interface RegoleRobots {
  disallow: string[];
  allow: string[];
}

const cacheRobots = new Map<string, RegoleRobots>();
const ultimaRichiesta = new Map<string, number>();

async function leggiRobots(origin: string): Promise<RegoleRobots> {
  const cached = cacheRobots.get(origin);
  if (cached) return cached;

  let regole: RegoleRobots = { disallow: [], allow: [] };
  try {
    const resp = await fetch(new URL("/robots.txt", origin).toString(), {
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

function parseRobotsTxt(testo: string): RegoleRobots {
  const righe = testo.split("\n").map((r) => r.split("#")[0]?.trim() ?? "");
  let inGruppoRilevante = false;
  let inGruppoWildcard = false;
  const disallow: string[] = [];
  const allow: string[] = [];

  for (const riga of righe) {
    const [chiaveRaw, ...resto] = riga.split(":");
    if (!chiaveRaw || resto.length === 0) continue;
    const chiave = chiaveRaw.trim().toLowerCase();
    const valore = resto.join(":").trim();

    if (chiave === "user-agent") {
      inGruppoWildcard = valore === "*";
      inGruppoRilevante = valore.toLowerCase().includes("quantumdealradar") || inGruppoWildcard;
    } else if (inGruppoRilevante && chiave === "disallow" && valore) {
      disallow.push(valore);
    } else if (inGruppoRilevante && chiave === "allow" && valore) {
      allow.push(valore);
    }
  }
  return { disallow, allow };
}

export async function consentito(url: string): Promise<boolean> {
  const u = new URL(url);
  const regole = await leggiRobots(u.origin);
  const path = u.pathname + u.search;

  const disallowMatch = regole.disallow.filter((p) => path.startsWith(p));
  const allowMatch = regole.allow.filter((p) => path.startsWith(p));
  if (disallowMatch.length === 0) return true;

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

export { USER_AGENT };
