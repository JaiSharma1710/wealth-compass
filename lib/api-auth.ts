import { AUTH_COOKIE_NAME } from "@/lib/auth";

export function getTokenFromRequest(request: Request) {
  return request.headers.get("cookie")
    ? request.headers
        .get("cookie")
        ?.split(";")
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
        ?.split("=")[1]
    : null;
}
