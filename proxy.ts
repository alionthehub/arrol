import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/security/constants";
import { readSessionCookie } from "@/lib/security/cookie";
import { decideAccess } from "@/lib/security/guard";

function hasSession(request: NextRequest) {
  const secret = process.env.ARROL_SESSION_SECRET ?? "";
  return readSessionCookie(request.cookies.get(SESSION_COOKIE)?.value, secret) !== null;
}

function hasBearer(request: NextRequest) {
  return /^Bearer\s+\S+/i.test(request.headers.get("authorization") ?? "");
}

export function proxy(request: NextRequest) {
  const decision = decideAccess(request.nextUrl.pathname, {
    session: hasSession(request),
    bearer: hasBearer(request),
  });
  if (decision.type === "unauthorized") {
    return NextResponse.json(
      { error: "ACCESS DENIED" },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }
  if (decision.type === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
