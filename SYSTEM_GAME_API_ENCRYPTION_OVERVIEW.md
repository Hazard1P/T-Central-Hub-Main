# Encryption and application security

The implemented security baseline is documented in [docs/SECURITY-BASELINE.md](docs/SECURITY-BASELINE.md), with review findings and verification in [docs/SECURITY-REVIEW.md](docs/SECURITY-REVIEW.md).

- Session and receipt envelopes use AES-256-GCM with random 96-bit nonces, HKDF-SHA256 purpose separation, authenticated version/key IDs and protected expiry metadata.
- Google and Steam login cookies use different purposes and server-enforced seven-day lifetimes. Legacy login cookies require a fresh sign-in.
- Private Prayer Seed text supports field encryption under a separate data keyring. Existing plaintext records require an explicit migration; account IDs and searchable metadata remain indexed behind server-only database permissions.
- Flight/chat tickets use separate audiences, short lifetimes and HMAC-SHA256 signatures. Signatures and hashes are not encryption. Public network traffic requires HTTPS/WSS supplied by hosting.
- Authorization, private database grants, same-origin checks, bounded request parsing, owner/maintenance controls and dependency updates complement encryption.

The application does not implement quantum security, encrypted physics, asymmetric route verification or automatic encryption of every database column. A source change cannot establish the security of production hosting, backups, credentials or operational access. Deployment and key-management steps remain necessary.
