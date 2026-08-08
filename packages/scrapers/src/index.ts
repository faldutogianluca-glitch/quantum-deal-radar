export * from "./types.js";
export * from "./genericScraper.js";
export * from "./registry.js";
export * from "./parsing.js";
export { ispezionaRobots, consentito, USER_AGENT, type EsitoIspezione } from "./robots.js";
export {
  verificaTutteLeFonti,
  verdetto,
  sospettoBloccoDiRete,
  daDecidere,
  urlDiVerifica,
  type RigaVerifica,
} from "./verificaTutte.js";
export {
  catturaPagina,
  proponiSelettori,
  chiudiBannerConsenso,
  type EsitoCattura,
  type CandidatoSelettore,
  type EsitoConsenso,
  type ModoConsenso,
} from "./cattura.js";
export {
  ispezionaSchede,
  cercaTesto,
  type EsitoIspezione as EsitoIspezioneSchede,
  type CampoInterno,
  type RisultatoTesto,
  type AntenatoTesto,
} from "./ispeziona.js";
export {
  estraiTestoPdf,
  scaricaPdf,
  leggiPdfLocale,
  analizzaPdf,
  giorniDaAggiornamento,
  type TestoPdf,
  type DocumentoScaricato,
  type EsitoAnalisiPdf,
} from "./pdf.js";
