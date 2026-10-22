import { createHmac, timingSafeEqual } from "node:crypto";
const signature = (value, secret) =>
  createHmac("sha256", secret).update(value).digest("base64url");
export function signFlightTicket(identity, room, secret, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 32)
    throw Error("Realtime secret must contain at least 32 characters.");
  const payload = Buffer.from(
    JSON.stringify({
      aud: "tcentral-flight",
      identity,
      room,
      iat: now,
      exp: now + 30000,
    }),
  ).toString("base64url");
  return payload + "." + signature(payload, secret);
}
export function verifyFlightTicket(ticket, secret, now = Date.now()) {
  if (
    typeof ticket !== "string" ||
    ticket.length > 4096 ||
    typeof secret !== "string" ||
    secret.length < 32
  )
    throw Error("Invalid flight ticket.");
  const [payload, signed, extra] = ticket.split("."),
    expected = signature(payload || "", secret);
  if (
    extra ||
    !signed ||
    Buffer.byteLength(signed) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(signed), Buffer.from(expected))
  )
    throw Error("Invalid flight ticket.");
  const data = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (
    data.aud !== "tcentral-flight" ||
    !Number.isFinite(data.exp) ||
    data.exp <= now ||
    data.iat > now + 5000 ||
    data.exp - data.iat !== 30000 ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(data.room) ||
    typeof data.identity?.id !== "string" ||
    !data.identity.id.length ||
    data.identity.id.length > 200
  )
    throw Error("Expired or invalid flight ticket.");
  return data;
}
export function validServiceSecret(value, secret) {
  const expected = "Bearer " + secret;
  return (
    typeof value === "string" &&
    Buffer.byteLength(value) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  );
}
