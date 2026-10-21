# Community legal documents — review record

Draft revision: `2026-10-19-draft.2`, October 19, 2026. Not an effective date.

The user confirmed Michael Rybaltowicz, operator name Central Synaptic Intelligence Systems, and B.C. They also confirmed a 19+ minimum age and voluntary support only, with no cash redemption of credits or seeds. The draft identifies an individual operating under that name in British Columbia, Canada; it does not invent a corporation, registration number, charitable status or street address. The contact email comes from the existing site: BrainandBodyai@gmail.com.

The drafts are in `lib/legalContent.js`. A complete readable copy is in [COMMUNITY-LEGAL-DRAFT.md](COMMUNITY-LEGAL-DRAFT.md), generated with `node scripts/export-legal-documents.mjs`. `/legal` links the Terms and conditions, Privacy policy, EULA, Multiplayer and community policy, and Support and payments policy. The same content appears in the access review panel. All documents are visibly marked as drafts pending final adoption and legal review.

## Decisions and deployment evidence needed before adoption

| Item | Current position | Required follow-through |
| --- | --- | --- |
| Operator | User-confirmed individual, operating name and BC location | Confirm any business registration, service address and required disclosures. Do not describe the name as a corporation without evidence. |
| Minimum age | User-confirmed 19+, with no parental-permission exception; higher applicable requirements still apply | Access screen requires a 19+ declaration. Review eligibility enforcement with counsel; the local declaration is not independent age verification or an API-level eligibility control. |
| Contributions | User confirmed voluntary support only, with no cash redemption; checkout describes voluntary PayPal support | Audit any server VIP packages or future paid benefits separately. Clear purchase disclosures and consumer cancellation rights must match actual benefits. |
| Privacy law | Operator is based in BC; users and providers may be elsewhere | Counsel should assess BC PIPA, PIPEDA where applicable, and other laws that apply to the actual audience/processing. Do not assume a BC governing-law clause displaces mandatory rights elsewhere. |
| Sensitive seed text | Optional free text can reveal beliefs or other sensitive information | Review necessity, permitted content, valid consent and collection notice at the feature. Implement any required explicit consent before sensitive processing; a general agreement gate is insufficient. |
| Data inventory and access | Source audit below; live production configuration not verified | Verify deployed provider list, database grants/RLS, service-role access, host logging, backups, encryption settings and incident handling. Retire old public/cached responses that may contain unnecessary author fields. |
| Analytics | Vercel client analytics mounts in the root layout; server events can run in production | Review actual event payloads and provider settings, lawful basis, required consent/opt-out signals and retention. The document-review acknowledgement does not toggle analytics. |
| Retention | No universal automatic retention/deletion schedule in the source | Approve category-specific periods and triggers for accounts, seeds, posts, reports, logs, payments and backups; implement and verify disposal. Query/display limits are not retention limits. |
| International transfers | Host, database, identity, payment and email regions depend on configuration | Record actual regions, provider roles and contractual safeguards; add the verified details to the notice. |
| Privacy requests | Direct email/support review, not automated erasure | Assign a responsible person, track receipt and applicable deadlines, verify ownership proportionately, search records by all relevant provider/account keys, redact third-party data, and record reasons for retention or refusal. Do not request passwords or session cookies. |
| Deletion and seeds | Account association and Unix epoch are game metadata | Include seed text, intelligence profile, derived binding hashes, request IDs and linked ledgers in review; keep only records with a valid ongoing need. Time binding is not an exemption from privacy rights. |
| Moderation | Reports persist with severity/status; support review is available | Establish an accessible human review/appeal workflow, access controls for evidence, staff-conflict handling and emergency escalation. Do not promise constant monitoring or a fixed outcome. |
| Agreement records | Browser-local acknowledgement includes a revision, timestamp and 19+ declaration | This is not a server-held agreement tied to an account. If enforceable account acceptance is required, implement and review authenticated evidence, notice and reacceptance without blocking legal/contact/report routes. |
| Final approval | Comprehensive review drafts, not legal certification | Have qualified counsel review the confirmed facts and implemented practices. Approve an effective date, archive the approved revision, communicate changes and remove draft status only when justified. |

No blanket no-refund rule, compulsory arbitration, class-action waiver, claim of permanent seed storage, blanket ban on lawful reverse engineering, tax-deductibility claim or unverified encryption-at-rest promise is included.

## Source audit supporting the drafts

| Feature | Source and observed behavior |
| --- | --- |
| Steam/Google authentication | `app/api/auth/*/callback/route.js`, `lib/auth/resolveGameAuthContext.js`: provider identity/profile, Google email/verification, encrypted HttpOnly seven-day session cookies. Google transient state cookies expire after ten minutes. |
| Guest identity | `lib/guestPilotIdentity.js`, `app/api/multiplayer/connect/route.js`: opaque session cookie and derived roster ID, not anonymous infrastructure access. |
| Multiplayer | `lib/authoritativeMultiplayerStore.js`, `lib/durableMultiplayerStore.js`: shared pilot identity, flight state, signatures and weapons. Same-room knowledge is not a password-protected private space. |
| Seeds | `lib/server/prayerSeedRecords.js`, `lib/server/prayerSeedRepository.js`: account association, intelligence UUID, user text, server epoch/timestamp, signature, request ID and SHA-256 binding. Production storage requires configured server database access. No automatic expiry or self-service deletion is asserted. |
| Board | `lib/hubPosts.js`, `app/api/hub-posts/route.js`: public posts with stored author data. This update adds an explicit public-response allowlist and removes automatic email-as-display-name fallbacks. Internal author email/account IDs are not returned by the board API. User-written names/text can still contain identifying information. |
| Contact/reporting | `app/api/contact/route.js`, `app/api/report-player/route.js`, `lib/contact.js`: optional form persistence, direct email fallback, report evidence and optional recognized Steam reporter. A mailto draft is not sent by the page. |
| Payments | `lib/server/donationStore.js`, PayPal capture/webhook routes: Steam-linked references, amount/currency/status and provider response objects, which can contain payer contact details. No in-site subscription cancellation or tax receipt is promised. |
| Browser records | `components/ConsentGate.js`, `components/StableSystemWorld.js`, presence/panel helpers: local acknowledgement, progress/presence/preferences and graphics quality. Clearing site storage does not erase server data or cancel recurring billing. |
| Telemetry | `app/layout.js`, `lib/server/vercelTelemetry.js`: Vercel analytics and operational events, independent of access-screen acknowledgement. |

## Maintaining the documents

Edit `lib/legalContent.js`, then verify the full-page documents and the access review panel. Keep page routes, document links and checkout disclosures consistent. Update `LEGAL_REVISION` when material text changes and preserve the adopted versions in version control. The access panel treats older or unversioned local acknowledgements as requiring review. The privacy checkbox says “I have read” rather than purporting to collect blanket processing consent.

Contact, reporting and legal pages must remain available without agreement. Verify mobile readability, section anchors, keyboard navigation, current-revision acknowledgement and stale-revision re-review. Verify the public board response contains no private author authentication fields using a fixture with a Google email and account ID.
