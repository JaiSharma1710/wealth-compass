import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { buildPublicUser, verifyAuthToken } from "@/lib/auth";
import {
  buildPortfolioReport,
  getPortfolioReportFilename,
  renderPortfolioReportPdf,
  renderPortfolioReportXls,
} from "@/lib/portfolio-report";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.sub).lean();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");

  if (format !== "xls" && format !== "pdf") {
    return NextResponse.json({ message: "Unsupported report format." }, { status: 400 });
  }

  const safeUser = buildPublicUser(user);
  const report = await buildPortfolioReport(safeUser);
  const filename = getPortfolioReportFilename(safeUser, format);

  if (format === "pdf") {
    return new Response(renderPortfolioReportPdf(report), {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "application/pdf",
      },
    });
  }

  return new Response(renderPortfolioReportXls(report), {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
    },
  });
}
