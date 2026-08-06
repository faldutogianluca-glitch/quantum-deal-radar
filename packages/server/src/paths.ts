import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// dist/paths.js -> packages/server/dist -> ../../../ -> radice del repo
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const DATA_DIR = join(REPO_ROOT, "data");

mkdirSync(DATA_DIR, { recursive: true });

// QDR_DB_PATH permette ai test di puntare a un DB temporaneo isolato invece
// di quello di sviluppo in data/.
export const DB_PATH = process.env.QDR_DB_PATH ?? join(DATA_DIR, "quantum-deal-radar.db");
