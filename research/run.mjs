// Runs a research TypeScript file with the app's "@/" path alias (file from RESEARCH_FILE).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@/": `${root}/` } });
await jiti.import(path.resolve(root, process.env.RESEARCH_FILE));
