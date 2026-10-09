export function setupRequest(setupCompleted: boolean): Response | null {
  if (setupCompleted) return new Response(null, { status: 404 });
  return null;
}
