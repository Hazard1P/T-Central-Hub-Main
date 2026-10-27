import { NextResponse } from "next/server";
import { getRequestBaseUrl } from "./lib/runtimeConfig";
export function middleware(request) {
  const headers = { "Cache-Control": "private, no-store" };
  const size = request.headers.get("content-length"),
    limit =
      request.nextUrl.pathname === "/api/donations/paypal/webhook"
        ? 262144
        : 65536;
  if (size && (!/^\d+$/.test(size) || Number(size) > limit))
    return NextResponse.json(
      { ok: false, error: "Request body is too large." },
      { status: 413, headers },
    );
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method),
    externalWebhook =
      request.nextUrl.pathname === "/api/donations/paypal/webhook";
  if (mutation && !externalWebhook) {
    const origin = request.headers.get("origin");
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && origin !== new URL(getRequestBaseUrl(request)).origin)
    )
      return NextResponse.json(
        { ok: false, error: "Same-origin requests required." },
        { status: 403, headers },
      );
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: "/api/:path*" };
