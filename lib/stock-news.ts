import "server-only";

import { connectToDatabase } from "@/lib/mongodb";
import { NewsCacheModel } from "@/lib/models/stock-research";
import { getStockNews } from "@/lib/services/yahoo-finance.service";

const CACHE_MS = 3 * 60 * 60 * 1000;

export type NewsItem = {
  id: string;
  symbol: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

function decode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/** Company name trimmed of legal suffixes, for news search. */
export function newsQueryName(name: string) {
  return name
    .replace(/\b(limited|ltd\.?|corporation|corp\.?|company|co\.?|india|\(india\))\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function googleNews(symbol: string, companyName: string): Promise<NewsItem[]> {
  const query = encodeURIComponent(`"${newsQueryName(companyName)}" share OR stock OR results when:30d`);
  const response = await fetch(`https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`, {
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) return [];

  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15).map((match) => {
    const item = match[1];
    const pick = (tag: string) => decode(item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || "");
    const rawTitle = pick("title");
    const source = pick("source") || "Google News";
    // Google appends " - Source" to titles.
    const title = rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -(source.length + 3)) : rawTitle;
    const date = new Date(pick("pubDate"));
    return {
      id: `g:${pick("guid") || pick("link")}`,
      symbol,
      title,
      link: pick("link"),
      source,
      publishedAt: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
    };
  });
}

async function yahooNews(symbol: string): Promise<NewsItem[]> {
  const items = await getStockNews(symbol).catch(() => []);
  return items.map((item) => ({
    id: `y:${item.id}`,
    symbol,
    title: item.title,
    link: item.link,
    source: item.publisher,
    publishedAt: item.publishedAt,
  }));
}

function dedupe(items: NewsItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 70);
    if (!item.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Recent headlines for one stock (Yahoo + Google News India), newest first, cached 3h. */
export async function getNewsForStock(symbol: string, companyName: string): Promise<NewsItem[]> {
  await connectToDatabase();

  const key = `news:${symbol.toUpperCase()}`;
  const cached = await NewsCacheModel.findOne({ key }).lean();

  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_MS) {
    return cached.items as NewsItem[];
  }

  const [google, yahoo] = await Promise.all([
    googleNews(symbol, companyName).catch(() => []),
    yahooNews(symbol),
  ]);
  const items = dedupe([...google, ...yahoo])
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 20);

  if (items.length || !cached) {
    await NewsCacheModel.updateOne({ key }, { $set: { key, items, fetchedAt: new Date() } }, { upsert: true });
    return items;
  }

  return cached.items as NewsItem[];
}
