export const dynamic = "force-dynamic";
import crypto from "crypto";
import { NextResponse } from "next/server";
import {
  getGoogleAuthBaseUrl,
  shouldUseSecureGoogleCookie,
} from "@/lib/googleAuthUrl";

function normalizeRedirectPath(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || /[\\\x00-\x1f\x7f]/.test(raw)) return "/";
  return raw;
}

export async function GET(request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID is required." },
      { status: 500 },
    );
  }

  const baseUrl = getGoogleAuthBaseUrl();
  const requestUrl = new URL(request.url);
  const requestHost = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    requestUrl.host
  )
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (requestHost !== new URL(baseUrl).host.toLowerCase()) {
    const canonical = new URL(requestUrl.pathname + requestUrl.search, baseUrl);
    return NextResponse.redirect(canonical);
  }

  const redirectPath = normalizeRedirectPath(
    requestUrl.searchParams.get("redirectTo"),
  );
  const redirectUri = `${baseUrl}/api/auth/google/callback`;
  const state = crypto.randomBytes(24).toString("hex");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email",
    prompt: "select_account",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  response.cookies.set({
    name: "google_auth_verifier",
    value: verifier,
    httpOnly: true,
    secure: shouldUseSecureGoogleCookie(baseUrl),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  response.cookies.set({
    name: "google_auth_state",
    value: state,
    httpOnly: true,
    secure: shouldUseSecureGoogleCookie(baseUrl),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set({
    name: "google_auth_return_to",
    value: redirectPath,
    httpOnly: true,
    secure: shouldUseSecureGoogleCookie(baseUrl),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
