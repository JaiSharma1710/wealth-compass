import { NextResponse } from "next/server";

import { AUTH_COOKIE_NAME, buildPublicUser, verifyAuthToken } from "@/lib/auth";
import { findCountryOption } from "@/lib/countries";
import { findCurrencyOption } from "@/lib/currencies";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/user";

export const runtime = "nodejs";

type ProfileUpdateBody = {
  fullName?: string;
  email?: string;
  username?: string;
  currency?: string;
  timezone?: string;
  dateOfBirth?: string;
  presentAddress?: string;
  permanentAddress?: string;
  city?: string;
  postalCode?: string;
  country?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

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

  const body = (await request.json().catch(() => null)) as ProfileUpdateBody | null;

  const fullName = body?.fullName?.trim();
  const email = body?.email?.trim().toLowerCase();
  const username = body?.username?.trim();
  const currency = body?.currency?.trim().toUpperCase();
  const timezone = body?.timezone?.trim();
  const dateOfBirth = body?.dateOfBirth?.trim() || "";
  const presentAddress = body?.presentAddress?.trim() || "";
  const permanentAddress = body?.permanentAddress?.trim() || "";
  const city = body?.city?.trim() || "";
  const postalCode = body?.postalCode?.trim() || "";
  const country = body?.country?.trim() || "";

  if (!fullName || !email || !username || !currency || !timezone) {
    return NextResponse.json(
      { message: "Full name, username, email, currency, and timezone are required." },
      { status: 400 }
    );
  }

  if (fullName.length < 2) {
    return NextResponse.json(
      { message: "Full name must be at least 2 characters long." },
      { status: 400 }
    );
  }

  if (username.length < 2) {
    return NextResponse.json(
      { message: "Username must be at least 2 characters long." },
      { status: 400 }
    );
  }

  if (!emailPattern.test(email)) {
    return NextResponse.json(
      { message: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  if (currency.length !== 3) {
    return NextResponse.json(
      { message: "Currency must be a 3-letter code." },
      { status: 400 }
    );
  }

  if (dateOfBirth && !datePattern.test(dateOfBirth)) {
    return NextResponse.json(
      { message: "Date of birth must be a valid date." },
      { status: 400 }
    );
  }

  const resolvedCountry = country ? await findCountryOption(country) : null;
  const resolvedCurrency = await findCurrencyOption(currency);

  if (country && !resolvedCountry) {
    return NextResponse.json(
      { message: "Please select a valid country." },
      { status: 400 }
    );
  }

  if (!resolvedCurrency) {
    return NextResponse.json(
      { message: "Please select a valid currency." },
      { status: 400 }
    );
  }

  await connectToDatabase();

  const existingEmailUser = await User.findOne({
    _id: { $ne: session.sub },
    email,
  }).lean();

  const user = await User.findById(session.sub);
  if (!user) {
    return NextResponse.json({ message: "User not found." }, { status: 404 });
  }

  if (email !== user.email.toLowerCase()) {
    return NextResponse.json(
      { message: "Email cannot be changed from settings." },
      { status: 400 }
    );
  }

  if (existingEmailUser) {
    return NextResponse.json(
      { message: "An account with this email already exists." },
      { status: 409 }
    );
  }

  if (!user.profile) {
    user.profile = {
      username: "",
      currency: "USD",
      timezone: "UTC",
      dateOfBirth: "",
      presentAddress: "",
      permanentAddress: "",
      city: "",
      postalCode: "",
      country: "",
    };
  }

  user.fullName = fullName;
  user.email = email;
  user.profile.username = username;
  user.profile.currency = resolvedCurrency.code;
  user.profile.timezone = timezone;
  user.profile.dateOfBirth = dateOfBirth;
  user.profile.presentAddress = presentAddress;
  user.profile.permanentAddress = permanentAddress;
  user.profile.city = city;
  user.profile.postalCode = postalCode;
  user.profile.country = resolvedCountry?.code || "";

  await user.save();

  return NextResponse.json({
    message: "Profile updated successfully.",
    user: buildPublicUser(user.toObject()),
  });
}
