import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

type PasswordUpdateBody = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
};

export async function PATCH(request: Request) {
  const token = request.headers.get("cookie")
    ? request.headers
      .get("cookie")
      ?.split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
      ?.split("=")[1]
    : null;

  const session = await verifyAuthToken(token);
  if (!session?.sub) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as PasswordUpdateBody | null;
  const currentPassword = body?.currentPassword || "";
  const newPassword = body?.newPassword || "";
  const confirmPassword = body?.confirmPassword || "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json(
      { message: "Current password, new password, and confirm password are required." },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { message: "New password must be at least 8 characters long." },
      { status: 400 }
    );
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { message: "New password and confirm password must match." },
      { status: 400 }
    );
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { message: "New password must be different from the current password." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const user = await User.findById(session.sub).select("+passwordHash");
  if (!user) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    return NextResponse.json(
      { message: "Current password is incorrect." },
      { status: 401 }
    );
  }

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();

  return NextResponse.json({
    message: "Password updated successfully.",
  });
}
