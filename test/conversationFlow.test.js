// test/conversationFlow.test.js - the order state machine.
//
// conversationFlow returns actions instead of sending, so the whole flow is
// testable with stub models and no network or database.
import test from "node:test";
import assert from "node:assert/strict";
import { runConversation, ACTIONS } from "../services/conversationFlow.js";

const TROPHIES = [
  { _id: "t1", name: "Golden Trophy", price: 1500, toObject() { return { _id: this._id, name: this.name, price: this.price }; } },
  { _id: "t2", name: "Silver Medal", price: 800, toObject() { return { _id: this._id, name: this.name, price: this.price }; } },
];

/** Fresh stub deps per test so saved orders don't leak between cases. */
function makeDeps() {
  const saved = [];
  class FakeOrder {
    constructor(fields) {
      Object.assign(this, fields);
      this._id = "order123";
      this.createdAt = new Date("2026-08-13T00:00:00Z");
    }
    async save() {
      this.status = this.status || "pending";
      if (!saved.includes(this)) saved.push(this);
      return this;
    }
    static async findById(id) {
      return saved.find((o) => String(o._id) === String(id)) || null;
    }
  }
  return {
    saved,
    deps: {
      Trophy: { find: async () => TROPHIES },
      Order: FakeOrder,
      generateInvoice: async (order) => `/tmp/invoice_${order._id}.pdf`,
      useLetterhead: false,
      letterheadPath: null,
      adminNumber: "919000000000",
    },
  };
}

const newSession = (over = {}) => ({
  step: "welcome",
  cart: [],
  customization: "",
  orderId: null,
  isGroup: false,
  groupId: null,
  userId: "919999999999",
  ...over,
});

const run = (text, session, deps, extra = {}) =>
  runConversation({ text: text.toLowerCase(), rawText: text, session, deps, ...extra });

const texts = (acts) => acts.filter((a) => a.type === ACTIONS.TEXT).map((a) => a.body);

test("full order: welcome -> browse -> select -> customize -> checkout -> pay", async (t) => {
  const { deps, saved } = makeDeps();
  const s = newSession();

  await t.test("browse lists the catalog and advances", async () => {
    const a = await run("browse", s, deps);
    assert.match(texts(a)[0], /Golden Trophy/);
    assert.match(texts(a)[0], /1500/);
    assert.equal(s.step, "browse");
  });

  await t.test("numeric selection adds a plain object to the cart", async () => {
    const a = await run("1", s, deps);
    assert.equal(s.cart.length, 1);
    assert.equal(s.cart[0].name, "Golden Trophy");
    // Must be plain — the cart round-trips through MongoDB
    assert.equal(typeof s.cart[0].toObject, "undefined");
    assert.equal(s.step, "customization");
    assert.match(texts(a)[0], /added to cart/);
  });

  await t.test("customization is captured verbatim, preserving case", async () => {
    await run("Best Employee 2026", s, deps);
    assert.equal(s.customization, "Best Employee 2026");
    assert.equal(s.step, "checkout");
  });

  await t.test("checkout creates the order and shows the total", async () => {
    const a = await run("checkout", s, deps);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].total, 1500);
    assert.equal(s.orderId, "order123");
    assert.match(texts(a)[0], /₹1500/);
    assert.equal(s.step, "payment");
  });

  await t.test("pay emits invoice, admin notice, and delivery tracking", async () => {
    const a = await run("pay", s, deps);

    const doc = a.find((x) => x.type === ACTIONS.DOCUMENT);
    assert.ok(doc, "expected a document action");
    assert.match(doc.path, /invoice_order123/);
    assert.equal(doc.filename, "Invoice_order123.pdf");

    assert.ok(a.find((x) => x.type === ACTIONS.NOTIFY_ADMIN), "expected admin notice");
    assert.ok(a.find((x) => x.type === ACTIONS.DELIVERY_TRACKING), "expected tracking");

    assert.equal(saved[0].status, "paid");
    assert.equal(s.step, "done");
  });
});

test("intent shortcuts answer without advancing state", async (t) => {
  const { deps } = makeDeps();

  await t.test("greeting", async () => {
    const s = newSession({ step: "browse" });
    const a = await run("hi", s, deps);
    assert.match(texts(a)[0], /Welcome to TrophyBot/);
    assert.equal(s.step, "browse", "greeting must not change step");
  });

  await t.test("help", async () => {
    const s = newSession({ step: "browse" });
    const a = await run("help", s, deps);
    assert.match(texts(a)[0], /\*browse\*/);
    assert.match(texts(a)[0], /\*reset\*/);
    assert.equal(s.step, "browse");
  });

  await t.test("status with no order", async () => {
    const s = newSession();
    const a = await run("status", s, deps);
    assert.match(texts(a)[0], /No active orders/);
  });

  await t.test("status with an existing order", async () => {
    const { deps: d, saved } = makeDeps();
    const s = newSession({ step: "checkout", cart: [{ name: "x", price: 42 }] });
    await run("checkout", s, d); // create an order to look up
    const a = await run("track", s, d);
    assert.match(texts(a)[0], /order123/);
    assert.equal(saved.length, 1);
  });
});

test("edge cases", async (t) => {
  const { deps } = makeDeps();

  await t.test("invalid trophy number is rejected", async () => {
    const s = newSession({ step: "browse" });
    const a = await run("99", s, deps);
    assert.match(texts(a)[0], /Invalid choice/);
    assert.equal(s.cart.length, 0);
  });

  await t.test("empty message is not treated as a trophy selection", async () => {
    // Regression: !isNaN("") is true, which indexed trophies[-1]
    const s = newSession({ step: "browse" });
    await run("", s, deps);
    assert.equal(s.cart.length, 0);
    assert.equal(s.step, "browse");
  });

  await t.test("browse after a completed order starts fresh", async () => {
    const s = newSession({ step: "done", cart: [{ name: "old", price: 1 }], customization: "old" });
    const a = await run("browse", s, deps);
    assert.equal(s.cart.length, 0, "stale cart must be cleared");
    assert.equal(s.customization, "");
    assert.equal(s.step, "browse");
    assert.match(texts(a)[0], /Golden Trophy/);
  });

  await t.test("reset clears cart and returns to welcome", async () => {
    const s = newSession({ step: "checkout", cart: [{ name: "x", price: 5 }] });
    await run("reset", s, deps);
    assert.equal(s.cart.length, 0);
    assert.equal(s.step, "welcome");
  });

  await t.test("fallback text is step-aware", async () => {
    // Note: "customization" is absent deliberately — that step consumes any
    // text as the engraving, so its fallback is unreachable by design.
    const cases = [
      ["welcome", /\*browse\*/],
      ["browse", /\*number\*/],
      ["checkout", /\*checkout\*/],
      ["payment", /\*pay\*/],
    ];
    for (const [step, expected] of cases) {
      // "zzz" must not match any command regex for this to exercise the fallback
      const s = newSession({ step });
      const a = await run("zzz", s, deps);
      assert.match(texts(a)[0], expected, `fallback for step=${step}`);
    }
  });

  await t.test("customization step accepts arbitrary text", async () => {
    const s = newSession({ step: "customization" });
    await run("zzz", s, deps);
    assert.equal(s.customization, "zzz");
    assert.equal(s.step, "checkout");
  });

  await t.test("KNOWN QUIRK: greeting-like engraving text is intercepted", async () => {
    // Pre-existing behavior in all three original implementations: the
    // greeting/help/status checks run before the customization capture, so a
    // customer cannot engrave text starting with "hi", "help", "status", etc.
    // Pinned here so a future change to the ordering is a deliberate decision.
    const s = newSession({ step: "customization" });
    const a = await run("Hello Team 2026", s, deps);
    assert.match(texts(a)[0], /Welcome to TrophyBot/);
    assert.equal(s.customization, "", "engraving text was swallowed by the greeting branch");
    assert.equal(s.step, "customization", "still stuck waiting for customization");
  });
});

test("group vs DM formatting", async (t) => {
  const { deps } = makeDeps();

  await t.test("group replies @-mention the user", async () => {
    const s = newSession({ isGroup: true, groupId: "123@g.us" });
    const a = await run("help", s, deps, { isGroup: true, mention: "919999999999" });
    assert.match(texts(a)[0], /@919999999999/);
  });

  await t.test("DM replies do not @-mention", async () => {
    const s = newSession();
    const a = await run("help", s, deps, { isGroup: false, mention: "919999999999" });
    assert.doesNotMatch(texts(a)[0], /@919999999999/);
  });
});

test("admin notice is skipped when ADMIN_NUMBER is unset", async () => {
  const { deps } = makeDeps();
  deps.adminNumber = undefined;
  const s = newSession({ step: "checkout", cart: [{ name: "x", price: 10 }] });
  await run("checkout", s, deps);
  const a = await run("pay", s, deps);
  assert.equal(a.find((x) => x.type === ACTIONS.NOTIFY_ADMIN), undefined);
  // tracking should still start
  assert.ok(a.find((x) => x.type === ACTIONS.DELIVERY_TRACKING));
});
