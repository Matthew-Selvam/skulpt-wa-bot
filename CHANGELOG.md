# Changelog

All notable changes to TrophyBot are documented here.

This project follows a phased roadmap; each phase ships as a tagged version.

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
