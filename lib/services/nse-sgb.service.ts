import "server-only";

const NSE_BASE_URL = "https://www.nseindia.com";
const NSE_SGB_API_URL = `${NSE_BASE_URL}/api/sovereign-gold-bonds`;

type NseSgbRow = {
  symbol?: unknown;
  ltP?: unknown;
  chn?: unknown;
  per?: unknown;
  prevClose?: unknown;
  issue_price?: unknown;
  maturityDate?: unknown;
};

type NseSgbResponse = {
  timestamp?: string;
  data?: NseSgbRow[];
};

export type SovereignGoldBondQuote = {
  symbol: string;
  lastPrice: number;
  change: number | null;
  changePercent: number | null;
  previousClose: number | null;
  issuePrice: number | null;
  maturityDate: string;
  fetchedAt: string;
};

function getNseHeaders(cookie?: string) {
  return {
    accept: "application/json,text/plain,*/*",
    "accept-language": "en-IN,en;q=0.9",
    cookie: cookie || "",
    referer: `${NSE_BASE_URL}/market-data/sovereign-gold-bond`,
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
  };
}

function parseNumber(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function getCookieHeader(headers: Headers) {
  const setCookie = headers.get("set-cookie") || "";

  return setCookie
    .split(",")
    .map((cookie) => cookie.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

export function normalizeSovereignGoldBondResponse(
  response: NseSgbResponse,
  fallbackFetchedAt = new Date().toISOString()
) {
  const fetchedAt = response.timestamp || fallbackFetchedAt;

  return (response.data || [])
    .map((row) => {
      const symbol = String(row.symbol || "").trim().toUpperCase();
      const lastPrice = parseNumber(row.ltP);

      if (!symbol || lastPrice == null || lastPrice <= 0) {
        return null;
      }

      return {
        symbol,
        lastPrice,
        change: parseNumber(row.chn),
        changePercent: parseNumber(row.per),
        previousClose: parseNumber(row.prevClose),
        issuePrice: parseNumber(row.issue_price),
        maturityDate: String(row.maturityDate || "").trim(),
        fetchedAt,
      } satisfies SovereignGoldBondQuote;
    })
    .filter((quote): quote is SovereignGoldBondQuote => Boolean(quote))
    .sort((left, right) => left.symbol.localeCompare(right.symbol));
}

export async function fetchSovereignGoldBonds() {
  let cookie = "";

  try {
    const homeResponse = await fetch(NSE_BASE_URL, {
      cache: "no-store",
      headers: getNseHeaders(),
    });
    cookie = getCookieHeader(homeResponse.headers);
  } catch {
    cookie = "";
  }

  const response = await fetch(NSE_SGB_API_URL, {
    cache: "no-store",
    headers: getNseHeaders(cookie),
  });

  if (!response.ok) {
    throw new Error(`NSE SGB API returned ${response.status}.`);
  }

  const data = (await response.json()) as NseSgbResponse;
  return normalizeSovereignGoldBondResponse(data);
}

export async function getSovereignGoldBondQuoteMap() {
  const quotes = await fetchSovereignGoldBonds();
  return new Map(quotes.map((quote) => [quote.symbol, quote]));
}
