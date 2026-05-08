import { NextResponse } from "next/server";

import { getCountryOptions } from "@/lib/countries";

export const runtime = "nodejs";

export async function GET() {
  const countries = await getCountryOptions();

  return NextResponse.json({
    countries,
  });
}
