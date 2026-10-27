import { timingSafeEqual } from "node:crypto";
export class RequestBodyError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
export async function readTextBounded(request, limit = 32768) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit))
    throw new RequestBodyError("Request body exceeds the permitted size.", 413);
  if (!request.body)
    throw new RequestBodyError("A JSON body is required.", 400);
  const reader = request.body.getReader(),
    parts = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        void reader.cancel().catch(() => {});
        throw new RequestBodyError(
          "Request body exceeds the permitted size.",
          413,
        );
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts).toString("utf8");
}
export function safeSecretMatches(supplied, expected) {
  if (
    typeof expected !== "string" ||
    expected.length < 32 ||
    typeof supplied !== "string" ||
    supplied.length !== expected.length
  )
    return false;
  const left = Buffer.from(supplied),
    right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function isMaintenanceRequest(request) {
  const bearer = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  return [process.env.MAINTENANCE_API_SECRET, process.env.CRON_SECRET].some(
    (secret) =>
      safeSecretMatches(bearer, secret) ||
      safeSecretMatches(request.headers.get("x-cron-secret"), secret),
  );
}

export async function readJsonBounded(request, limit = 32768) {
  const text = await readTextBounded(request, limit);
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestBodyError("Invalid JSON body.", 400);
  }
}
