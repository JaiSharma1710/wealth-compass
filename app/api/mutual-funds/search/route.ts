import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { verifyAuthToken } from "@/lib/auth";

export const runtime = "nodejs";

const MFAPI_BASE_URL = "https://api.mfapi.in";
const MAX_SEARCH_RESULTS = 10;
const FALLBACK_PAGE_SIZE = 1000;
const MAX_FALLBACK_PAGES = 50;

type MfApiSearchResult = {
  schemeCode: number;
  schemeName: string;
};

function normalizeOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const item = entry as Record<string, unknown>;
      const schemeCode = Number(item.schemeCode);
      const schemeName = String(item.schemeName || "").trim();

      if (!Number.isFinite(schemeCode) || schemeCode <= 0 || !schemeName) {
        return null;
      }

      return { schemeCode, schemeName } satisfies MfApiSearchResult;
    })
    .filter((entry): entry is MfApiSearchResult => Boolean(entry));
}

async function fetchMfApiJson(path: string) {
  const response = await fetch(`${MFAPI_BASE_URL}${path}`, {
    cache: "no-store",
    headers: {
      accept: "application/json",
      "user-agent": "wealth-compass/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`MFAPI returned ${response.status}.`);
  }

  return response.json();
}

async function searchFromMfApi(query: string) {
  const result = await fetchMfApiJson(`/mf/search?q=${encodeURIComponent(query)}`);
  return normalizeOptions(result).slice(0, MAX_SEARCH_RESULTS);
}

async function searchFromSchemeList(query: string) {
  const normalizedQuery = query.toLowerCase();
  const matches: MfApiSearchResult[] = [];

  for (
    let page = 0;
    page < MAX_FALLBACK_PAGES && matches.length < MAX_SEARCH_RESULTS;
    page += 1
  ) {
    const offset = page * FALLBACK_PAGE_SIZE;
    const result = await fetchMfApiJson(
      `/mf?limit=${FALLBACK_PAGE_SIZE}&offset=${offset}`
    );
    const options = normalizeOptions(result);

    if (!options.length) {
      break;
    }

    matches.push(
      ...options.filter((entry) =>
        entry.schemeName.toLowerCase().includes(normalizedQuery)
      )
    );
  }

  return matches.slice(0, MAX_SEARCH_RESULTS);
}

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return NextResponse.json({ options: [] satisfies MfApiSearchResult[] });
  }

  try {
    const options = await searchFromMfApi(query);
    return NextResponse.json({ options });
  } catch (error) {
    console.error("MFAPI search endpoint failed.", { query, error });
  }

  try {
    const options = await searchFromSchemeList(query);
    return NextResponse.json({ options });
  } catch (error) {
    console.error("MFAPI scheme-list fallback failed.", { query, error });
    return NextResponse.json(
      { message: "Unable to search mutual funds right now." },
      { status: 502 }
    );
  }
}
