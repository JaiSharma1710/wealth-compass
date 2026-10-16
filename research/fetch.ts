// Downloads fundamentals + monthly prices for the universe into research/data (cached).
// Run: npm run research:fetch   (pass --force to refetch)
import fs from "node:fs";
import path from "node:path";

import { fetchStockFundamentals } from "@/lib/stock-model/fetch";

import { UNIVERSE } from "./universe";

const dir = path.join(process.cwd(), "research/data");
const force = process.argv.includes("--force");

async function main() {
  fs.mkdirSync(dir, { recursive: true });
  const queue = [...UNIVERSE];
  const failed: string[] = [];
  let done = 0;

  async function worker() {
    for (let symbol = queue.shift(); symbol; symbol = queue.shift()) {
      const file = path.join(dir, `${symbol}.json`);
      if (!force && fs.existsSync(file)) { done += 1; continue; }
      try {
        const data = await fetchStockFundamentals(symbol, { priceFrom: "2016-01-01" });
        if (data.annual.length < 2) throw new Error(`only ${data.annual.length} annual periods`);
        fs.writeFileSync(file, JSON.stringify(data));
      } catch (error) {
        failed.push(`${symbol}: ${error instanceof Error ? error.message.slice(0, 80) : error}`);
      }
      done += 1;
      if (done % 10 === 0) console.log(`${done}/${UNIVERSE.length}`);
    }
  }

  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(`done. ${UNIVERSE.length - failed.length} ok, ${failed.length} failed`);
  failed.forEach((line) => console.log("  ", line));
}

main();
