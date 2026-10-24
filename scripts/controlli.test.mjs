import { test } from "node:test";
import assert from "node:assert/strict";
import { controllaVoce, riconcilia, riepilogo, estraiLink, NOTA_AI, AMAZON } from "./lib/controlli.mjs";

const OGGI = new Date("2026-10-24T00:00:00Z");
const ok = (o = {}) => ({
  id: "x", stato: "programmato", quando: "2026-11-02T09:00", reti: ["linkedin"],
  testo: `Un proprietario aspetta da mesi.\n${NOTA_AI}`, approvato_da: "Gianluca Falduto", approvato_il: "2026-10-23", ...o,
});
const regole = (e) => controllaVoce(e, OGGI).map((x) => x.regola);

test("voce corretta: nessun esito", () => assert.deepEqual(regole(ok()), []));
test("manca la nota AI", () => assert.ok(regole(ok({ testo: "Solo testo." })).includes("nota_ai")));
test("nome Quantum Re errato", () => assert.ok(regole(ok({ testo: `Quantum Re aiuta.\n${NOTA_AI}` })).includes("nome")));
test("Quantum Re S.r.l. e' ammesso", () => assert.ok(!regole(ok({ testo: `Quantum Re S.r.l.\n${NOTA_AI}` })).includes("nome")));
test("segnaposto in voce programmata", () => assert.ok(regole(ok({ testo: `Costo {{cifra}}.\n${NOTA_AI}` })).includes("segnaposto")));
test("parole vietate", () => {
  for (const t of ["Investi con noi", "alti rendimenti", "un club deal", "co-investimento", "meglio dei BTP"])
    assert.ok(regole(ok({ testo: `${t}\n${NOTA_AI}` })).includes("parole_vietate"), t);
});
test("formule ammesse non scattano", () => assert.ok(!regole(ok({ testo: `Non costituisce offerta di strumenti finanziari ne' sollecitazione all'investimento.\n${NOTA_AI}` })).includes("parole_vietate")));
test("libro senza Amazon", () => {
  const r = regole(ok({ testo: `Il libro La tua casa non entra nella tomba.\n${NOTA_AI}` }));
  assert.ok(r.includes("libro_amazon") && r.includes("libro_valutazione"));
});
test("libro completo", () => {
  const t = `La tua casa non entra nella tomba ${AMAZON} https://valutazione.quantumre.it/\n${NOTA_AI}`;
  assert.deepEqual(regole(ok({ testo: t })).filter((r) => r.startsWith("libro")), []);
});
test("www non ammesso", () => assert.ok(regole(ok({ primo_commento: "https://www.valutazione.quantumre.it/?utm_source=linkedin" })).includes("link_www")));
test("utm assente, di altra rete, condiviso", () => {
  assert.ok(regole(ok({ primo_commento: "https://valutazione.quantumre.it/" })).includes("utm_assente"));
  assert.ok(regole(ok({ primo_commento: "https://valutazione.quantumre.it/?utm_source=facebook" })).includes("utm_rete"));
  assert.ok(regole(ok({ reti: ["facebook", "instagram"], primo_commento: "https://valutazione.quantumre.it/?utm_source=facebook" })).includes("utm_condiviso"));
});
test("senza approvazione: errore se futura, storico se passata", () => {
  assert.equal(controllaVoce(ok({ approvato_da: null }), OGGI).find((x) => x.regola === "approvazione").livello, "errore");
  assert.equal(controllaVoce(ok({ approvato_da: null, quando: "2026-10-01T09:00" }), OGGI).find((x) => x.regola === "approvazione").livello, "storico");
});
test("un rinvio non e' dato per ok", () => {
  const e = controllaVoce(ok({ testo: "vedi file X" }), OGGI);
  assert.ok(e.some((x) => x.livello === "non_verificato"));
  assert.ok(!e.some((x) => x.regola === "nota_ai"));
});
test("estraiLink ignora altri domini", () => {
  assert.equal(estraiLink("https://example.com/?utm_source=a").length, 0);
  assert.equal(estraiLink("https://valutazione.quantumre.it/?utm_source=a&utm_medium=b.")[0].utm_medium, "b");
});
test("riconciliazione: assente, stato, orario, orfani", () => {
  const voci = [ok({ id: "a", metricool_uuid: "1" }), ok({ id: "b", metricool_uuid: "2" }), ok({ id: "c", metricool_uuid: "3" })];
  const snap = [
    { uuid: "1", id: 11, d: "2026-11-02T09:00:00", draft: false },
    { uuid: "2", id: 12, d: "2026-11-02T10:00:00", draft: true },
    { uuid: "9", id: 19, d: "2026-11-05T09:00:00", draft: true },
  ];
  const e = riconcilia(voci, snap, new Date("2026-10-24"));
  const r = e.map((x) => `${x.id}:${x.regola}`);
  assert.ok(r.includes("c:metricool_assente"));
  assert.ok(r.includes("b:stato_diverso") && r.includes("b:orario_diverso"));
  assert.ok(r.includes("19:calendario_assente"));
  assert.ok(!r.some((x) => x.startsWith("a:")));
  assert.equal(e.find((x) => x.id === "19").livello, "bozza_orfana");
  assert.equal(riepilogo(e).bozza_orfana, 1);
});
