// Long monthly price history (total-return adjusted) for the universe + NIFTY 50 index.
// Run: RESEARCH_FILE=research/fetch-prices.ts node research/run.mjs
import fs from "node:fs";
import path from "node:path";

import YahooFinance from "yahoo-finance2";

import { UNIVERSE } from "./universe";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey", "ripHistorical"] });
const dir = path.join(process.cwd(), "research/data/prices");

async function main() {
  fs.mkdirSync(dir, { recursive: true });
  const queue = [...UNIVERSE, "^NSEI"];
  const failed: string[] = [];

  async function worker() {
    for (let symbol = queue.shift(); symbol; symbol = queue.shift()) {
      try {
        const chart = await yf.chart(symbol, { period1: "2005-01-01", interval: "1mo" });
        const prices = chart.quotes
          .filter((quote) => typeof quote.close === "number")
          .map((quote) => ({ date: new Date(quote.date).toISOString().slice(0, 10), close: (quote.adjclose ?? quote.close) as number }));
        fs.writeFileSync(path.join(dir, `${symbol}.json`), JSON.stringify(prices));
      } catch (error) {
        failed.push(`${symbol}: ${error instanceof Error ? error.message.slice(0, 60) : error}`);
      }
    }
  }

  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(`prices: ${UNIVERSE.length + 1 - failed.length} ok`, failed);
}

main();
