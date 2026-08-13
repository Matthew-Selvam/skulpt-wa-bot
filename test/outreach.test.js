// test/outreach.test.js - reminder eligibility and reply classification.
//
// isEventDue encodes four interacting rules (send window, max count, spacing
// as the event approaches, and a cooldown between sends). Defaults come from
// env; these tests assume the defaults: REMINDER_DAYS_BEFORE=7,
// MAX_REMINDERS=2, REMINDER_COOLDOWN_DAYS=2.
import test from "node:test";
import assert from "node:assert/strict";
import { isEventDue, classifyResponse, sanitizePhone } from "../services/outreachService.js";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-08-13T12:00:00Z").getTime();

/** An event `daysAway` from NOW, with optional reminder history. */
const evt = (daysAway, over = {}) => ({
  name: "Annual Awards",
  date: new Date(NOW + daysAway * DAY),
  responded: false,
  reminder: { count: 0, lastSentAt: null },
  ...over,
});

test("send window", async (t) => {
  await t.test("event inside the 7-day window is due", () => {
    assert.equal(isEventDue(evt(5), NOW), true);
  });

  await t.test("event further out than 7 days is not due", () => {
    assert.equal(isEventDue(evt(10), NOW), false);
  });

  await t.test("event in the past is not due", () => {
    assert.equal(isEventDue(evt(-1), NOW), false);
  });

  await t.test("event today is still due", () => {
    assert.equal(isEventDue(evt(0), NOW), true);
  });
});

test("already-answered events are never re-sent", () => {
  assert.equal(isEventDue(evt(3, { responded: true }), NOW), false);
});

test("reminder count cap", async (t) => {
  await t.test("a second reminder is allowed once spacing is met", () => {
    // count=1 -> threshold = 7 - 1*2 = 5 days, and cooldown satisfied
    const e = evt(4, { reminder: { count: 1, lastSentAt: new Date(NOW - 3 * DAY) } });
    assert.equal(isEventDue(e, NOW), true);
  });

  await t.test("a third reminder is refused (MAX_REMINDERS=2)", () => {
    const e = evt(2, { reminder: { count: 2, lastSentAt: new Date(NOW - 5 * DAY) } });
    assert.equal(isEventDue(e, NOW), false);
  });
});

test("reminders tighten as the event approaches", async (t) => {
  // With count=1 the threshold drops to 5 days: a reminder is only due once
  // the event is within 5 days, even though the outer window is 7.
  await t.test("6 days out with one reminder sent is too early", () => {
    const e = evt(6, { reminder: { count: 1, lastSentAt: new Date(NOW - 10 * DAY) } });
    assert.equal(isEventDue(e, NOW), false);
  });

  await t.test("4 days out with one reminder sent is due", () => {
    const e = evt(4, { reminder: { count: 1, lastSentAt: new Date(NOW - 10 * DAY) } });
    assert.equal(isEventDue(e, NOW), true);
  });
});

test("cooldown between sends", async (t) => {
  await t.test("a reminder sent yesterday blocks another (cooldown 2 days)", () => {
    const e = evt(3, { reminder: { count: 1, lastSentAt: new Date(NOW - 1 * DAY) } });
    assert.equal(isEventDue(e, NOW), false);
  });

  await t.test("a reminder sent 3 days ago allows another", () => {
    const e = evt(3, { reminder: { count: 1, lastSentAt: new Date(NOW - 3 * DAY) } });
    assert.equal(isEventDue(e, NOW), true);
  });
});

test("missing reminder metadata is treated as never-sent", () => {
  const e = { name: "x", date: new Date(NOW + 3 * DAY), responded: false };
  assert.equal(isEventDue(e, NOW), true);
});

test("classifyResponse", async (t) => {
  await t.test("positive replies", () => {
    for (const s of ["yes", "Yes please", "yeah we need trophies", "sure", "interested", "we would like some"]) {
      assert.equal(classifyResponse(s), "positive", s);
    }
  });

  await t.test("negative replies", () => {
    for (const s of ["no", "No thanks", "nope", "not needed", "don't need"]) {
      assert.equal(classifyResponse(s), "negative", s);
    }
  });

  await t.test("ambiguous replies", () => {
    for (const s of ["maybe later", "call me", "hmm", ""]) {
      assert.equal(classifyResponse(s), "unknown", s);
    }
  });

  await t.test("negative takes precedence over an embedded positive word", () => {
    // "no thanks, we don't need any" contains "need" — must still read negative
    assert.equal(classifyResponse("no thanks, we don't need any"), "negative");
  });

  await t.test("handles null/undefined without throwing", () => {
    assert.equal(classifyResponse(null), "unknown");
    assert.equal(classifyResponse(undefined), "unknown");
  });
});

test("sanitizePhone strips non-digits", () => {
  assert.equal(sanitizePhone("+91 98765-43210"), "919876543210");
  assert.equal(sanitizePhone("919876543210@c.us"), "919876543210");
});
