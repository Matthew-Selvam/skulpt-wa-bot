// test/delivery.test.js - delivery provider selection and status mapping.
//
// The Porter integration was written without access to Porter's docs or a
// sandbox, so what's pinned here is the behaviour that must hold regardless of
// the exact wire format: the mock stays active unless Porter is configured,
// unknown statuses aren't mistaken for success, and a dispatch failure still
// leaves the customer acknowledged.
import test from "node:test";
import assert from "node:assert/strict";
import http from "http";
import { normalizeStatus } from "../services/delivery/porterProvider.js";
import { statusText, TERMINAL } from "../services/delivery/index.js";

test("Porter status normalization", async (t) => {
  await t.test("maps known Porter statuses onto our vocabulary", () => {
    assert.equal(normalizeStatus("accepted"), "assigned");
    assert.equal(normalizeStatus("live"), "picked_up");
    assert.equal(normalizeStatus("ended"), "delivered");
    assert.equal(normalizeStatus("cancelled"), "cancelled");
  });

  await t.test("is case- and separator-insensitive", () => {
    assert.equal(normalizeStatus("IN TRANSIT"), "in_transit");
    assert.equal(normalizeStatus("in-transit"), "in_transit");
    assert.equal(normalizeStatus("Pickup Complete"), "picked_up");
  });

  await t.test("unknown statuses become 'unknown', never 'delivered'", () => {
    // The dangerous failure: an unrecognised status being read as success and
    // telling the customer their order arrived when it hasn't.
    for (const s of ["something_new", "", null, undefined, "42"]) {
      assert.equal(normalizeStatus(s), "unknown", JSON.stringify(s));
    }
  });

  await t.test("only genuinely final states are terminal", () => {
    assert.ok(TERMINAL.has("delivered"));
    assert.ok(TERMINAL.has("cancelled"));
    for (const s of ["placed", "assigned", "picked_up", "in_transit", "unknown"]) {
      assert.ok(!TERMINAL.has(s), `${s} must not stop polling`);
    }
  });

  await t.test("every status has customer-facing text", () => {
    for (const s of ["placed", "assigned", "picked_up", "in_transit", "delivered", "cancelled", "unknown"]) {
      assert.equal(typeof statusText(s), "string");
      assert.ok(statusText(s).length > 0);
    }
  });
});

test("provider selection is fail-safe", async (t) => {
  // activeProvider() reads env at module load, so these run in child processes
  const run = async (env) => {
    const { execFileSync } = await import("node:child_process");
    return execFileSync(
      "node",
      ["-e", `import("./services/delivery/index.js").then(m => console.log(m.activeProvider()))`],
      { env: { ...process.env, ...env }, cwd: process.cwd(), encoding: "utf8" }
    ).trim();
  };

  await t.test("no API key -> mock, even when Porter is requested", async () => {
    // The important one: a half-configured deployment must not silently stop
    // dispatching. It degrades to the previous mock behaviour instead.
    assert.equal(await run({ DELIVERY_PROVIDER: "porter", PORTER_API_KEY: "" }), "mock");
  });

  await t.test("auto + no key -> mock", async () => {
    assert.equal(await run({ DELIVERY_PROVIDER: "auto", PORTER_API_KEY: "" }), "mock");
  });

  await t.test("auto + key -> porter", async () => {
    assert.equal(await run({ DELIVERY_PROVIDER: "auto", PORTER_API_KEY: "test-key" }), "porter");
  });

  await t.test("explicit mock wins even with a key present", async () => {
    assert.equal(await run({ DELIVERY_PROVIDER: "mock", PORTER_API_KEY: "test-key" }), "mock");
  });
});

test("createDelivery against a stub Porter", async (t) => {
  const requests = [];
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      requests.push({
        url: req.url,
        method: req.method,
        auth: req.headers["x-api-key"],
        body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null,
      });
      res.setHeader("Content-Type", "application/json");
      if (req.url.includes("/cancel")) return res.end(JSON.stringify({ ok: true }));
      if (req.method === "POST") {
        return res.end(JSON.stringify({ order_id: "PORTER123", tracking_url: "https://track/PORTER123" }));
      }
      res.end(JSON.stringify({ status: "live" }));
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;

  // Fresh module instance bound to the stub.
  // Must be ASYNC: execFileSync would block this process's event loop, and the
  // stub server above lives here — the child's request would never be served.
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  const script = `
    const p = await import("./services/delivery/porterProvider.js");
    const created = await p.createDelivery(
      { _id: "o1", orderRef: "REF1", customization: "Champion" },
      { pickup: { a: 1 }, drop: { b: 2 } }
    );
    const status = await p.getDeliveryStatus("PORTER123");
    console.log(JSON.stringify({ created, status }));
    process.exit(0); // don't linger on the keep-alive socket
  `;
  const { stdout } = await execFileAsync("node", ["--input-type=module", "-e", script], {
    env: {
      ...process.env,
      PORTER_API_KEY: "stub-key",
      PORTER_API_URL: `http://127.0.0.1:${port}`,
    },
    cwd: process.cwd(),
  });
  const { created, status } = JSON.parse(stdout.trim().split("\n").pop());

  await t.test("dispatch returns the delivery id and tracking url", () => {
    assert.equal(created.success, true);
    assert.equal(created.deliveryId, "PORTER123");
    assert.equal(created.trackingUrl, "https://track/PORTER123");
  });

  await t.test("dispatch sends the API key and an idempotent request id", () => {
    const post = requests.find((r) => r.method === "POST");
    assert.equal(post.auth, "stub-key");
    assert.equal(post.body.request_id, "REF1", "orderRef makes retries idempotent");
  });

  await t.test("status is normalized, not passed through raw", () => {
    assert.equal(status.success, true);
    assert.equal(status.status, "picked_up");
    assert.equal(status.rawStatus, "live");
  });

  server.close();
});

test("createDelivery without an API key fails cleanly", async () => {
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync(
    "node",
    ["--input-type=module", "-e", `
      const p = await import("./services/delivery/porterProvider.js");
      console.log(JSON.stringify(await p.createDelivery({ _id: "x" }, {})));
    `],
    { env: { ...process.env, PORTER_API_KEY: "" }, cwd: process.cwd(), encoding: "utf8" }
  );
  const res = JSON.parse(out.trim().split("\n").pop());
  assert.equal(res.success, false);
  assert.match(res.error, /PORTER_API_KEY/);
});
