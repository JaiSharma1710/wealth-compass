import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET environment variable.");
}

const secret = new TextEncoder().encode(JWT_SECRET);
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export const AUTH_COOKIE_NAME = "wealth-compass-token";

type SessionPayload = JWTPayload & {
  sub: string;
  type: "auth";
};

type PublicUserSource = {
  _id: { toString(): string } | string;
  fullName: string;
  email: string;
  role: string;
  profile?:
    | {
      username?: string;
      currency?: string;
      timezone?: string;
      dateOfBirth?: string;
      presentAddress?: string;
      permanentAddress?: string;
      city?: string;
      postalCode?: string;
      country?: string;
      banks?: string[];
    }
    | null;
  createdAt?: Date | null;
  lastLoginAt?: Date | null;
};

export type SafeUser = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  profile: {
    username: string;
    currency: string;
    timezone: string;
    dateOfBirth: string;
    presentAddress: string;
    permanentAddress: string;
    city: string;
    postalCode: string;
    country: string;
    banks: string[];
  };
  createdAt: string;
  lastLoginAt: string | null;
};

export function getDefaultUsername(fullName: string, email?: string) {
  const nameBased = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");

  if (nameBased) {
    return nameBased;
  }

  return (email || "")
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "")
    .slice(0, 50);
}

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_DURATION_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export async function signAuthToken(userId: string) {
  return new SignJWT({ type: "auth" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyAuthToken(token?: string | null) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, secret);

    if (!payload.sub || payload.type !== "auth") {
      return null;
    }

    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function buildPublicUser(user: PublicUserSource): SafeUser {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    profile: {
      username: user.profile?.username || getDefaultUsername(user.fullName, user.email),
      currency: user.profile?.currency || "USD",
      timezone: user.profile?.timezone || "UTC",
      dateOfBirth: user.profile?.dateOfBirth || "",
      presentAddress: user.profile?.presentAddress || "",
      permanentAddress: user.profile?.permanentAddress || "",
      city: user.profile?.city || "",
      postalCode: user.profile?.postalCode || "",
      country: user.profile?.country || "",
      banks: Array.isArray(user.profile?.banks)
        ? user.profile.banks.filter((bank) => typeof bank === "string")
        : [],
    },
    createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
  };
}

export const getSession = cache(async () => {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  const payload = await verifyAuthToken(token);

  if (!payload?.sub) {
    return null;
  }

  return { userId: payload.sub };
});

export const getCurrentUser = cache(async () => {
  const session = await getSession();

  if (!session?.userId) {
    return null;
  }

  await connectToDatabase();
  const user = await User.findById(session.userId).lean();

  if (!user) {
    return null;
  }

  return buildPublicUser(user);
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function redirectIfAuthenticated() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }
}
