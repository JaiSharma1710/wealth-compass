"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";

import { displaySymbol } from "@/components/stocks-trade-sheets";
import { Badge, Card, EmptyState, Page, Segmented, Skeleton } from "@/components/ui/kit";
import { formatDate, formatRelativeTime } from "@/lib/format";

type NewsItem = { id: string; symbol: string; title: string; link: string; source: string; publishedAt: string };

function dayLabel(iso: string) {
  const key = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(date);
  const today = key(new Date());
  const yesterday = key(new Date(Date.now() - 86400000));
  const day = key(new Date(iso));
  return day === today ? "Today" : day === yesterday ? "Yesterday" : formatDate(iso);
}

export function NewsView() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [stocks, setStocks] = useState<Array<{ symbol: string; name: string }>>([]);
  const [filter, setFilter] = useState("all");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/news", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((result) => {
        setItems(result.items);
        setStocks(result.stocks);
      })
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => (items || []).filter((item) => filter === "all" || item.symbol === filter), [items, filter]);
  const groups = useMemo(() => {
    const map = new Map<string, NewsItem[]>();
    for (const item of visible) map.set(dayLabel(item.publishedAt), [...(map.get(dayLabel(item.publishedAt)) || []), item]);
    return [...map.entries()];
  }, [visible]);
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items || []) map.set(item.symbol, (map.get(item.symbol) || 0) + 1);
    return map;
  }, [items]);

  return (
    <Page>
      <div className="mb-4 overflow-hidden">
        <Segmented
          ariaLabel="Filter by stock"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All${items ? ` ${items.length}` : ""}` },
            ...stocks.filter((stock) => counts.get(stock.symbol)).map((stock) => ({
              value: stock.symbol,
              label: `${displaySymbol(stock.symbol)} ${counts.get(stock.symbol)}`,
            })),
          ]}
        />
      </div>

      {failed ? (
        <Card>
          <EmptyState icon={Newspaper} title="Couldn't load news" message="Please try again in a moment." />
        </Card>
      ) : !items ? (
        <Card className="space-y-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </Card>
      ) : !visible.length ? (
        <Card>
          <EmptyState icon={Newspaper} title="No recent news" message="Headlines for the stocks you hold appear here." />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([label, entries]) => (
            <Card key={label} padded={false}>
              <p className="border-b border-line px-4 py-2.5 text-xs font-semibold text-ink-2 sm:px-5">{label}</p>
              <ul className="divide-y divide-line">
                {entries.map((item) => (
                  <li key={item.id}>
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-5"
                    >
                      <Badge tone="brand" className="mt-0.5 shrink-0">
                        {displaySymbol(item.symbol)}
                      </Badge>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm text-ink">{item.title}</span>
                        <span className="text-xs text-ink-3">
                          {item.source} · {formatRelativeTime(item.publishedAt)}
                        </span>
                      </span>
                      <ExternalLink className="mt-1 size-3.5 shrink-0 text-ink-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </Page>
  );
}
