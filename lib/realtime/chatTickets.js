import { createHmac, timingSafeEqual } from "node:crypto";
const signature = (payload, secret) =>
  createHmac("sha256", secret).update(payload).digest("base64url");
export function signChatTicket(identity, secret, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 32)
    throw Error("Chat service is not configured.");
  const payload = Buffer.from(
    JSON.stringify({
      aud: "tcentral-community-chat",
      identity,
      iat: now,
      exp: now + 30000,
    }),
  ).toString("base64url");
  return payload + "." + signature(payload, secret);
}
export function verifyChatTicket(ticket, secret, now = Date.now()) {
  if (
    typeof ticket !== "string" ||
    ticket.length > 4096 ||
    typeof secret !== "string" ||
    secret.length < 32
  )
    throw Error("Invalid chat ticket.");
  const [payload, signed, extra] = ticket.split("."),
    expected = signature(payload || "", secret);
  if (
    extra ||
    !signed ||
    Buffer.byteLength(signed) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(signed), Buffer.from(expected))
  )
    throw Error("Invalid chat ticket.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (
    data.aud !== "tcentral-community-chat" ||
    !Number.isFinite(data.iat) ||
    !Number.isFinite(data.exp) ||
    data.exp <= now ||
    data.iat > now + 5000 ||
    data.exp - data.iat !== 30000 ||
    typeof data.identity?.id !== "string" ||
    data.identity.id.length < 1 ||
    data.identity.id.length > 200
  )
    throw Error("Expired or invalid chat ticket.");
  return data;
}
