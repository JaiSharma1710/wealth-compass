import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, buildPublicUser, getAuthCookieOptions, signAuthToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

type SigninBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SigninBody | null;
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;

  if (!email || !password) {
    return NextResponse.json(
      { message: "Email and password are required." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    return NextResponse.json(
      { message: "Invalid email or password." },
      { status: 401 }
    );
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return NextResponse.json(
      { message: "Invalid email or password." },
      { status: 401 }
    );
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = await signAuthToken(user.id);
  const response = NextResponse.json({
    message: "Signin successful.",
    user: buildPublicUser(user.toObject()),
  });

  response.cookies.set(
    AUTH_COOKIE_NAME,
    token,
    getAuthCookieOptions()
  );

  return response;
}
