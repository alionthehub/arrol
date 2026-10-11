export type AccessAuth = {
  session: boolean;
  bearer: boolean;
};

export type AccessDecision =
  | { type: "allow" }
  | { type: "redirect"; to: "/login" | "/today" }
  | { type: "unauthorized" };

function normalize(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isPublicPath(pathname: string) {
  const path = normalize(pathname);
  return (
    path === "/login" ||
    path === "/api/health" ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/api/setup/")
  );
}

/**
 * Optimistic gate used by the proxy. Login ceremony and the health check
 * are the only unauthenticated surfaces. API calls without a session cookie
 * or bearer token are rejected. Pages redirect to the login screen.
 * Scope checks and revocation happen in the route, against the database.
 */
export function decideAccess(pathname: string, auth: AccessAuth): AccessDecision {
  const path = normalize(pathname);
  if (
    path === "/api/health" ||
    path.startsWith("/api/auth/") ||
    path.startsWith("/api/setup/")
  ) {
    return { type: "allow" };
  }
  if (path === "/login") {
    return auth.session ? { type: "redirect", to: "/today" } : { type: "allow" };
  }
  if (path.startsWith("/api/")) {
    if (!auth.session && !auth.bearer) return { type: "unauthorized" };
    return { type: "allow" };
  }
  if (!auth.session) return { type: "redirect", to: "/login" };
  return { type: "allow" };
}
