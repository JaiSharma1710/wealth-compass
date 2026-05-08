import { NextResponse } from "next/server";

import { getCurrencyOptions } from "@/lib/currencies";

export const runtime = "nodejs";

export async function GET() {
  const currencies = await getCurrencyOptions();

  return NextResponse.json({
    currencies,
  });
}
