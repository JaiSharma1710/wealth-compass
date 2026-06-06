import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    quotes: {},
    message: "Live quotes are fetched only through market sync refresh jobs.",
  });
}
