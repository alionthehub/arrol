import { hashIp } from "@/lib/security/bytes";

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function clientIpHash(request: Request) {
  return hashIp(clientIp(request));
}

export function originAllowed(request: Request, expectedOrigin: string) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === expectedOrigin);
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function jsonError(status: number, error: string) {
  return Response.json(
    { error },
    { status, headers: { "cache-control": "no-store" } },
  );
}
