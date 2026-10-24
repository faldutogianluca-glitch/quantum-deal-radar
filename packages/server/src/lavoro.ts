/**
 * Un solo lavoro costoso alla volta (scraping o arricchimento): scrivono entrambi sullo stesso
 * database e scaricano dai portali. Due avvii contemporanei (due richieste, oppure una richiesta
 * mentre gira lo scheduler) non devono sovrapporsi.
 */
export class LavoroInCorso extends Error {
  constructor(public readonly nome: string) {
    super(`Un'operazione e' gia' in corso: ${nome}`);
    this.name = "LavoroInCorso";
  }
}

let inCorso: string | null = null;

export function lavoroInCorso(): string | null {
  return inCorso;
}

export async function esclusivo<T>(nome: string, fn: () => Promise<T>): Promise<T> {
  if (inCorso !== null) throw new LavoroInCorso(inCorso);
  inCorso = nome;
  try {
    return await fn();
  } finally {
    inCorso = null;
  }
}
