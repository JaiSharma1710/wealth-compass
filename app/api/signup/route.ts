import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, buildPublicUser, getAuthCookieOptions, signAuthToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

type SignupBody = {
  fullName?: string;
  email?: string;
  password?: string;
  timezone?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SignupBody | null;
  const fullName = body?.fullName?.trim();
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  const timezone = body?.timezone?.trim();

  if (!fullName || !email || !password) {
    return NextResponse.json(
      { message: "Full name, email, and password are required." },
      { status: 400 }
    );
  }

  if (fullName.length < 2) {
    return NextResponse.json(
      { message: "Full name must be at least 2 characters long." },
      { status: 400 }
    );
  }

  if (!emailPattern.test(email)) {
    return NextResponse.json(
      { message: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { message: "Password must be at least 8 characters long." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const existingUser = await User.findOne({ email }).lean();
  if (existingUser) {
    return NextResponse.json(
      { message: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    fullName,
    email,
    passwordHash,
    lastLoginAt: new Date(),
    profile: {
      currency: "USD",
      timezone: timezone || "UTC",
    },
  });

  const token = await signAuthToken(user.id);
  const response = NextResponse.json(
    {
      message: "Signup successful.",
      user: buildPublicUser(user.toObject()),
    },
    { status: 201 }
  );

  response.cookies.set(
    AUTH_COOKIE_NAME,
    token,
    getAuthCookieOptions()
  );

  return response;
}
