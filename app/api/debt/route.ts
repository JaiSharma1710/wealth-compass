import { NextResponse } from "next/server";

import { getTokenFromRequest } from "@/lib/api-auth";
import { buildPublicUser, verifyAuthToken } from "@/lib/auth";
import { createDebtLoan, deleteDebtLoan, getDebtPageData } from "@/lib/debt";
import type { DebtLoanType } from "@/lib/debt.types";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

type DebtCreateBody = {
  name?: string;
  lender?: string;
  loanType?: DebtLoanType;
  principalAmount?: number | string;
  annualInterestRate?: number | string;
  durationMonths?: number | string;
  startDate?: string;
  emiPaymentDay?: number | string;
  plannedPrepaymentAmount?: number | string;
  note?: string;
};

async function getRequestUser(request: Request) {
  const session = await verifyAuthToken(getTokenFromRequest(request));

  if (!session?.sub) {
    return null;
  }

  await connectToDatabase();
  const user = await User.findById(session.sub).lean();

  return user ? buildPublicUser(user) : null;
}

export async function GET(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await getDebtPageData(user.id));
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as DebtCreateBody | null;

  try {
    await createDebtLoan(user.id, {
      name: body?.name || "",
      lender: body?.lender || "",
      loanType: body?.loanType || "standard",
      principalAmount: Number(String(body?.principalAmount || "").trim()),
      annualInterestRate: Number(String(body?.annualInterestRate || "0").trim()),
      durationMonths: Number(String(body?.durationMonths || "").trim()),
      startDate: body?.startDate || "",
      emiPaymentDay: Number(String(body?.emiPaymentDay || "").trim()),
      plannedPrepaymentAmount: Number(String(body?.plannedPrepaymentAmount || "0").trim()),
      note: body?.note || "",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create loan." },
      { status: 400 }
    );
  }

  return NextResponse.json(
    {
      message: "Loan created.",
      ...(await getDebtPageData(user.id)),
    },
    { status: 201 }
  );
}

export async function DELETE(request: Request) {
  const user = await getRequestUser(request);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const loanId = searchParams.get("loanId")?.trim() || "";

  if (!loanId) {
    return NextResponse.json({ message: "Loan ID is required." }, { status: 400 });
  }

  try {
    await deleteDebtLoan(user.id, loanId);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to delete loan." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    message: "Loan deleted.",
    ...(await getDebtPageData(user.id)),
  });
}
