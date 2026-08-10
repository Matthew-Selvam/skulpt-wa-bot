# Changelog

All notable changes to TrophyBot are documented here.

This project follows a phased roadmap; each phase ships as a tagged version.

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
