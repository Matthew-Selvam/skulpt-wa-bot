// test/customerFeatures.test.js - v1.5.0 customer-facing features:
// order history, reorder, cancel, reference photos, delivery estimate.
import test from "node:test";
import assert from "node:assert/strict";
import { runConversation, ACTIONS } from "../services/conversationFlow.js";

const TROPHIES = [
  { _id: "t1", name: "Golden Trophy", price: 1500, toObject() { return { _id: this._id, name: this.name, price: this.price }; } },
  { _id: "t2", name: "Silver Medal", price: 800, toObject() { return { _id: this._id, name: this.name, price: this.price }; } },
];

/**
 * Stub Order model with a seedable history. `find()` returns a chainable
 * sort/limit like Mongoose, filtered by userId.
 */
function makeDeps(history = []) {
  const saved = [...history];
  class FakeOrder {
    constructor(fields) {
      Object.assign(this, fields);
      this._id = `order${saved.length + 1}`;
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
    static find(query) {
      const rows = saved.filter((o) => o.userId === query.userId);
      const chain = {
        sort: () => chain,
        limit: (n) => Promise.resolve(rows.slice().reverse().slice(0, n)),
        then: (res) => Promise.resolve(rows).then(res),
      };
      return chain;
    }
  }
  return {
    saved,
    deps: {
      Trophy: { find: async () => TROPHIES },
      Order: FakeOrder,
      generateInvoice: async (o) => `/tmp/invoice_${o._id}.pdf`,
      useLetterhead: false,
      letterheadPath: null,
      adminNumber: "919000000000",
    },
  };
}

const USER = "919999999999";
const newSession = (over = {}) => ({
  step: "welcome", cart: [], customization: "", orderId: null,
  pendingImage: null, isGroup: false, groupId: null, userId: USER, ...over,
});
const run = (text, session, deps, extra = {}) =>
  runConversation({ text: text.toLowerCase(), rawText: text, session, deps, ...extra });
const texts = (a) => a.filter((x) => x.type === ACTIONS.TEXT).map((x) => x.body);

/** A past order belonging to USER. */
const pastOrder = (over = {}) => ({
  _id: "past1", userId: USER, items: [{ name: "Golden Trophy", price: 1500 }],
  total: 1500, customization: "Champion 2025", status: "paid",
  createdAt: new Date("2026-01-15T00:00:00Z"), ...over,
});

test("order history", async (t) => {
  await t.test("shows a friendly message when there are no past orders", async () => {
    const { deps } = makeDeps();
    const s = newSession();
    const a = await run("history", s, deps);
    assert.match(texts(a)[0], /No past orders/);
  });

  await t.test("lists past orders with status and total", async () => {
    const { deps } = makeDeps([pastOrder()]);
    const s = newSession();
    const a = await run("history", s, deps);
    assert.match(texts(a)[0], /Golden Trophy/);
    assert.match(texts(a)[0], /1500/);
    assert.match(texts(a)[0], /paid/);
  });

  await t.test("does not leak other customers' orders", async () => {
    const { deps } = makeDeps([pastOrder({ userId: "918888888888", items: [{ name: "SECRET", price: 1 }] })]);
    const s = newSession();
    const a = await run("history", s, deps);
    assert.doesNotMatch(texts(a)[0], /SECRET/);
    assert.match(texts(a)[0], /No past orders/);
  });

  await t.test("'my orders' reaches history, not current-order status", async () => {
    // Regression: STATUS_RE previously matched "my orders" via its "my order"
    // alternative, so history was unreachable by that phrasing.
    const { deps } = makeDeps([pastOrder()]);
    const s = newSession();
    const a = await run("my orders", s, deps);
    assert.match(texts(a)[0], /recent orders/i);
  });
});

test("reorder", async (t) => {
  await t.test("copies a past order into the cart at checkout", async () => {
    const { deps } = makeDeps([pastOrder()]);
    const s = newSession();
    const a = await run("reorder 1", s, deps);
    assert.equal(s.cart.length, 1);
    assert.equal(s.cart[0].name, "Golden Trophy");
    assert.equal(s.customization, "Champion 2025");
    assert.equal(s.step, "checkout");
    assert.match(texts(a)[0], /Reordering/);
  });

  await t.test("rejects an out-of-range index", async () => {
    const { deps } = makeDeps([pastOrder()]);
    const s = newSession();
    const a = await run("reorder 9", s, deps);
    assert.match(texts(a)[0], /No such order/);
    assert.equal(s.cart.length, 0);
  });

  await t.test("a reordered cart can be checked out", async () => {
    const { deps, saved } = makeDeps([pastOrder()]);
    const s = newSession();
    await run("reorder 1", s, deps);
    await run("checkout", s, deps);
    assert.equal(s.step, "payment");
    assert.equal(saved.at(-1).total, 1500);
  });
});

test("cancel", async (t) => {
  await t.test("cancels an unpaid order and clears the session", async () => {
    const { deps, saved } = makeDeps();
    const s = newSession({ step: "checkout", cart: [{ name: "x", price: 10 }] });
    await run("checkout", s, deps);
    const orderId = s.orderId;

    const a = await run("cancel", s, deps);
    assert.match(texts(a)[0], /cancelled/i);
    assert.equal(saved.find((o) => o._id === orderId).status, "cancelled");
    assert.equal(s.step, "welcome");
    assert.equal(s.cart.length, 0);
    assert.equal(s.orderId, null);
  });

  await t.test("refuses to cancel an already-paid order", async () => {
    const { deps, saved } = makeDeps();
    const s = newSession({ step: "checkout", cart: [{ name: "x", price: 10 }] });
    await run("checkout", s, deps);
    await run("pay", s, deps);

    const a = await run("cancel", s, deps);
    assert.match(texts(a)[0], /already paid/i);
    assert.equal(saved.at(-1).status, "paid", "must stay paid");
  });

  await t.test("cancel with nothing in progress is handled gracefully", async () => {
    const { deps } = makeDeps();
    const s = newSession();
    const a = await run("cancel", s, deps);
    assert.match(texts(a)[0], /Nothing to cancel/);
  });
});

test("reference photo", async (t) => {
  await t.test("is attached to the order at checkout", async () => {
    const { deps, saved } = makeDeps();
    const s = newSession({
      step: "checkout",
      cart: [{ name: "x", price: 10 }],
      pendingImage: { data: Buffer.from("fake-png-bytes").toString("base64"), contentType: "image/png" },
    });
    await run("checkout", s, deps);

    const order = saved.at(-1);
    assert.ok(Buffer.isBuffer(order.referenceImage.data), "stored as a Buffer");
    assert.equal(order.referenceImage.data.toString(), "fake-png-bytes");
    assert.equal(order.referenceImage.contentType, "image/png");
    assert.equal(s.pendingImage, null, "cleared once persisted");
  });

  await t.test("order summary mentions the attached image", async () => {
    const { deps } = makeDeps();
    const s = newSession({
      step: "checkout",
      cart: [{ name: "x", price: 10 }],
      pendingImage: { data: Buffer.from("z").toString("base64"), contentType: "image/jpeg" },
    });
    const a = await run("checkout", s, deps);
    assert.match(texts(a)[0], /Reference image attached/);
  });

  await t.test("orders without a photo are unaffected", async () => {
    const { deps, saved } = makeDeps();
    const s = newSession({ step: "checkout", cart: [{ name: "x", price: 10 }] });
    await run("checkout", s, deps);
    assert.ok(!saved.at(-1).referenceImage?.data);
  });
});

test("delivery estimate appears at checkout, before payment", async () => {
  const { deps } = makeDeps();
  const s = newSession({ step: "checkout", cart: [{ name: "x", price: 10 }] });
  const a = await run("checkout", s, deps);
  assert.match(texts(a)[0], /Estimated delivery/);
  // Should be a real future date string, not "Invalid Date"
  assert.doesNotMatch(texts(a)[0], /Invalid Date/);
});

test("help text advertises the new commands", async () => {
  const { deps } = makeDeps();
  const s = newSession();
  const a = await run("help", s, deps);
  for (const cmd of [/\*history\*/, /\*reorder/, /\*cancel\*/, /photo/]) {
    assert.match(texts(a)[0], cmd);
  }
});
