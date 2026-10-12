/** Estimated fund category, guessed from keywords in the scheme name. */
const RULES: Array<[string, RegExp]> = [
  ["ELSS / Tax saver", /\b(elss|tax\s*saver|tax\s*saving)\b/i],
  ["Gold / Silver", /\b(gold|silver)\b/i],
  ["Small cap", /small\s*cap/i],
  ["Mid cap", /mid\s*cap/i],
  ["Large & Mid cap", /large\s*(&|and)\s*mid/i],
  ["Large cap", /(large\s*cap|bluechip|blue\s*chip|top\s*100)/i],
  ["Index fund", /(index|nifty|sensex)/i],
  ["ETF", /\betf\b/i],
  ["Flexi / Multi cap", /(flexi|multi\s*cap|focused|value|contra)/i],
  ["Debt / Liquid", /(liquid|debt|bond|gilt|overnight|money\s*market|duration|credit|corporate)/i],
  ["Hybrid", /(hybrid|balanced|arbitrage|asset\s*allocation|equity\s*savings)/i],
  ["Sectoral / Thematic", /(pharma|technology|infra|banking|financial|consumption|opportunit|thematic|psu|manufactur|digital|energy|auto)/i],
];

export function estimateFundCategory(schemeName: string): string {
  for (const [label, pattern] of RULES) {
    if (pattern.test(schemeName)) return label;
  }
  return "Other / Unclassified";
}

export function shortSchemeName(name: string): string {
  return name
    .replace(/\s*-\s*(direct|regular)\s*(plan)?/i, "")
    .replace(/\s*-?\s*(growth|idcw|dividend)\s*(option|plan)?/gi, "")
    .replace(/\s*-\s*$/, "")
    .trim();
}
