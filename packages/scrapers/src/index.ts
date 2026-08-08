export * from "./types.js";
export * from "./genericScraper.js";
export * from "./registry.js";
export * from "./parsing.js";
export { ispezionaRobots, consentito, USER_AGENT, type EsitoIspezione } from "./robots.js";
export { catturaPagina, proponiSelettori, type EsitoCattura, type CandidatoSelettore } from "./cattura.js";
export {
  ispezionaSchede,
  cercaTesto,
  type EsitoIspezione as EsitoIspezioneSchede,
  type CampoInterno,
  type RisultatoTesto,
  type AntenatoTesto,
} from "./ispeziona.js";
