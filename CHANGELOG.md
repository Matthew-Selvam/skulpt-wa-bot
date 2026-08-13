# Changelog

All notable changes to TrophyBot are documented here.

This project follows a phased roadmap; each phase ships as a tagged version.

## [1.4.0] - 2026-08-13

Phase 4 of the phased roadmap: tests, rate limiting, structured logging.

### Added

- **A real test suite — 53 tests, `npm test`.** Uses Node's built-in
  `node:test`, so no new test framework dependency.
  - `test/conversationFlow.test.js` (23) — every state transition, intent
    shortcuts, edge cases, and group vs DM formatting. Possible because
    v1.3.0 made the flow return actions instead of sending.
  - `test/outreach.test.js` (23) — the reminder cadence rules (send window,
    max count, spacing as the event approaches, cooldown between sends) and
    reply classification, including that a negative reply containing a
    positive word ("no thanks, we don't need any") still reads negative.
  - `test/security.test.js` (7) — webhook HMAC validation: correct signature
    accepted, tampered body and wrong secret rejected, malformed signatures
    rejected rather than thrown, and re-serialized JSON *not* validating
    (the reason raw bytes are required).
- **Rate limiting** on `/admin` (100 requests / 15 min) and `/webhook`
  (600 / min), tunable via `ADMIN_RATE_LIMIT` and `WEBHOOK_RATE_LIMIT`.
  The webhook limiter returns 200 rather than 429 when tripped — Meta treats
  429 as a failure and retries harder, which would worsen a burst.
  `trust proxy` is enabled so the limiter sees real client IPs behind Render's
  proxy instead of counting every request against one address.
- **Structured logging** (`utils/logger.js`, pino): one JSON object per line
  in production so Render's log viewer can filter by level and field, pretty
  and colorized in development. Credentials are redacted wherever they appear
  in a logged object — access tokens, webhook secrets, admin password,
  `Authorization` and `X-Hub-Signature-256` headers.

### Changed

- Moved the eleven ad-hoc `test-*.js` scripts from the repo root into
  `scripts/manual/`. They are one-off probes run directly with `node`, not
  tests, and their names made the repo look like it had a test suite when
  `npm test` was still `echo 'No tests specified'`.
- Exported `isEventDue` from `services/outreachService.js` so the reminder
  cadence can be tested directly.

### Fixed

- Removed an unreachable `customization` entry from the step-aware fallback
  table in `conversationFlow.js` — that step consumes any text as the
  engraving, so its fallback could never fire.

### Known quirk (documented, not changed)

The greeting/help/status checks run *before* the customization capture, so a
customer cannot engrave text starting with "hi", "help", "status", etc. — the
bot answers the greeting instead and stays stuck waiting for customization.
This has been the behavior in all three original implementations. It is now
pinned by a test so that changing it is a deliberate decision rather than an
accident.

## [1.3.0] - 2026-08-13

Phase 3 of the phased roadmap: consolidation. Behavior-preserving refactor.

### Changed

- **The conversation state machine now exists once, not three times.**
  `bot.js`, `services/messageHandler.js`, and `bot-handler.js` each carried a
  near-identical copy of the welcome → browse → customization → checkout →
  payment flow. That duplication is exactly how the deployed path ended up
  missing working invoice delivery and delivery tracking (both fixed in
  v1.1.0) — a fix applied to one copy never reached the others.

  Added `services/conversationFlow.js` as the single implementation. It returns
  a list of *actions* (`text`, `document`, `notify-admin`, `delivery-tracking`)
  rather than sending anything itself, so it is transport-agnostic and testable
  without a network or database. The three entry points are now thin adapters
  that translate their own message format in and execute actions with their own
  transport (Cloud API upload-then-send, or whatsapp-web.js `MessageMedia`).

  Net effect: ~1190 lines of triplicated logic became ~570 lines of adapters
  plus one 231-line shared flow.
- **Removed the two duplicate invoice generators** in `bot.js` and
  `bot-handler.js`; all paths now use `utils/invoiceGenerator.js`, which was
  already the most complete version (writes to `invoices/`, includes the
  company name).
- **Removed the duplicate inline Mongoose models** in `bot.js`, which shadowed
  the shared `models/Trophy.js` and `models/Order.js` with slightly different
  schemas.

### Fixed

- `config.js` had `USE_LETTERHEAD: process.env.USE_LETTERHEAD === "true" || true`
  — always `true`, so the env var was silently ignored. Still defaults to true,
  but `USE_LETTERHEAD=false` now actually disables the letterhead.
- A bare numeric-selection check (`!isNaN(text)`) treated an empty message as
  trophy number 0, indexing `trophies[-1]`. Empty input is now rejected.

### Added

- **The deployed path now notifies the admin when an order is paid.** `bot.js`
  and `messageHandler.js` already did this; `bot-handler.js` — the one Render
  actually runs — did not. Unifying the flow closed that gap. Requires
  `ADMIN_NUMBER` to be set; without it, nothing is sent.

### Verified

37 flow-level checks covering every state transition, all intent shortcuts
(greeting/help/status), edge cases (invalid selection, reset, browse-after-done,
step-aware fallbacks), and group vs DM @-mention formatting. Plus a 13-check
end-to-end run driving a complete order — hi → browse → select → customize →
checkout → pay — through the real `botHandler` against a real MongoDB, with
only Meta's Graph API stubbed: confirms the invoice uploads as media and sends
by ID (not `link`), the admin is notified, the order is marked paid, and the
session persists at `step=done` with cart and orderId intact.

## [1.2.0] - 2026-08-13

Phase 2 of the phased roadmap: persistent sessions.

### Fixed

- **Sessions no longer disappear on restart or redeploy.** Conversation state
  (`bot-handler.js`, the deployed webhook path) lived in a process-local
  `Map`, so every Render restart silently dropped every order in progress —
  a customer mid-checkout would suddenly be back at "welcome" with an empty
  cart. Replaced with `models/Session.js`, a MongoDB collection keyed by the
  same identifier the Map used (`chatId`, or `${chatId}_${userId}` in a
  group), with a 24h sliding-TTL index so abandoned sessions still expire.
  Added `services/sessionStore.js` (`getSession`/`saveSession`) as the
  replacement API — same shape callers already relied on
  (`step`/`cart`/`customization`/`orderId`/...), so `bot-handler.js`'s
  conversation logic itself didn't need to change, only where state lives.

### Verified

Two independent Node processes sharing only a MongoDB URI — simulating a
real restart, not just an in-process mock: process A advances a session
through welcome → browse → customization → checkout → payment and exits;
process B (fresh process, fresh connection) loads the same session and
confirms every field survived, then finishes the flow. Also confirmed the
TTL index and the unique constraint on the session key are actually present
on the collection. `mongodb-memory-server` (devDependency) provided the
throwaway MongoDB instance — an isolated `mongod` binary, no Docker.

## [1.1.0] - 2026-08-10

Fixes to the deployed webhook path (`webhook-server.js` + `bot-handler.js`).
All four issues were live in production.

### Fixed

- **Invoice delivery was silently failing.** The payment handler passed a local
  filesystem path where the WhatsApp Cloud API requires a publicly reachable
  URL (`document.link`), so customers never received their invoice PDF.
  Added `uploadMedia()` and `sendDocumentFromFile()` to `whatsapp-api-client.js`,
  which upload the file and send it by media ID. `sendMessage()` now detects
  local paths and routes them through the upload flow.
- **Delivery tracking never fired.** `mockDeliveryUpdates` was implemented but
  never called from the deployed payment branch, so the status updates promised
  in the order confirmation ("Delivery tracking will start soon") never arrived.
  Now started after payment, independent of invoice success.
- **Webhook signature validation was dead code.** `middlewares/security.js`
  only checked that a signature *header existed* — the actual HMAC comparison
  was commented out while still logging "Signature validated successfully".
  Restored, and corrected to hash the raw request body rather than a
  re-serialized copy of the parsed JSON (which never round-trips). `app.js`
  now captures `rawBody`.

### Security

- **Admin dashboard no longer falls back to a default password.** Previously
  `ADMIN_PASSWORD` defaulted to `"changeme"`, so an unconfigured deployment
  exposed a working admin panel. With no password set, `/admin` and
  `/admin/api/*` now return 503 instead.
- **`/admin` page itself is gated.** Only `/admin/api/*` was protected before;
  the HTML shell was publicly reachable.
- **Webhook signature enforcement now defaults on in production**
  (`NODE_ENV=production`). Opt out with `ENFORCE_WEBHOOK_SIGNATURE=false`.
- Fixed a potential crash in the admin auth comparison: `timingSafeEqual`
  throws on length-mismatched buffers, which a short `Authorization` header
  could trigger.

### Changed

- `mockDeliveryUpdates(userId, send, prefix)` now takes an injected sender
  instead of importing the transport directly. This removed a circular
  dependency (`whatsappUtils` → `messageHandler` → `whatsappUtils`) and lets
  both entry points share one implementation. The timer is `unref()`'d so
  pending demo updates don't hold the process open.

## [1.0.0] - 2026-08-08

Initial release: WhatsApp order flow, PDF invoices, group @-mention support,
client management, recurring event outreach, and admin dashboard.
