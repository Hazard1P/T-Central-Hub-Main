function securityHeaders({ https = false } = {}) {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    {
      key: "Content-Security-Policy",
      value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'",
    },
  ];
  if (https)
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=31536000",
    });
  return headers;
}
module.exports = { securityHeaders };
