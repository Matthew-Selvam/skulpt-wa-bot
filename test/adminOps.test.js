// test/adminOps.test.js - v1.6.0 admin/ops units that need no database:
// CSV parsing and the outreach template library.
import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv } from "../services/clientCsv.js";
import { selectTemplate, renderOutreach, listTemplates } from "../services/outreachTemplates.js";
import { Order } from "../models/Order.js";

test("orderRef is unique even within the same millisecond", () => {
  // Regression: the default was Date.now().toString(), and orderRef has a
  // unique index — two orders created in the same millisecond made the second
  // insert fail outright. Generating many refs in a tight loop reproduces it.
  const gen = Order.schema.path("orderRef").defaultValue;
  const refs = new Set();
  for (let i = 0; i < 5000; i++) refs.add(gen());
  assert.equal(refs.size, 5000, "generated refs must all be distinct");
});

test("parseCsv", async (t) => {
  await t.test("parses a simple file", () => {
    const rows = parseCsv("name,phone\nAcme,919000000001\nBeta,919000000002");
    assert.deepEqual(rows, [
      ["name", "phone"],
      ["Acme", "919000000001"],
      ["Beta", "919000000002"],
    ]);
  });

  await t.test("handles quoted fields containing commas", () => {
    // The case that breaks naive line.split(",")
    const rows = parseCsv('name,notes\n"Acme, Inc.","Prefers gold, not silver"');
    assert.deepEqual(rows[1], ["Acme, Inc.", "Prefers gold, not silver"]);
  });

  await t.test("handles escaped quotes", () => {
    const rows = parseCsv('name,notes\nAcme,"They said ""urgent"" twice"');
    assert.equal(rows[1][1], 'They said "urgent" twice');
  });

  await t.test("handles newlines inside quoted fields", () => {
    const rows = parseCsv('name,notes\nAcme,"line one\nline two"');
    assert.equal(rows.length, 2, "the embedded newline must not split the row");
    assert.equal(rows[1][1], "line one\nline two");
  });

  await t.test("handles CRLF line endings", () => {
    const rows = parseCsv("name,phone\r\nAcme,919000000001\r\n");
    assert.deepEqual(rows, [["name", "phone"], ["Acme", "919000000001"]]);
  });

  await t.test("ignores blank lines", () => {
    const rows = parseCsv("name,phone\n\nAcme,919000000001\n\n");
    assert.equal(rows.length, 2);
  });

  await t.test("handles a file with no trailing newline", () => {
    const rows = parseCsv("name,phone\nAcme,919000000001");
    assert.deepEqual(rows[1], ["Acme", "919000000001"]);
  });

  await t.test("returns empty for empty input", () => {
    assert.deepEqual(parseCsv(""), []);
    assert.deepEqual(parseCsv(null), []);
  });
});

test("outreach templates", async (t) => {
  const client = { name: "Acme Sports Club" };
  const date = "12 Sep 2026";

  await t.test("matches by explicit event type", () => {
    assert.equal(selectTemplate({ type: "birthday", name: "Founder's Day" }).id, "birthday");
    assert.equal(selectTemplate({ type: "tournament", name: "X" }).id, "tournament");
  });

  await t.test("falls back to matching the event name", () => {
    assert.equal(selectTemplate({ type: "", name: "Annual Sports Day" }).id, "tournament");
    assert.equal(selectTemplate({ type: "", name: "25th Anniversary Gala" }).id, "anniversary");
  });

  await t.test("unknown types get the generic template", () => {
    assert.equal(selectTemplate({ type: "zzz", name: "Something Else" }).id, "default");
    assert.equal(selectTemplate({}).id, "default");
  });

  await t.test("rendered text includes client, event and date", () => {
    for (const event of [
      { type: "birthday", name: "Founder's Birthday" },
      { type: "tournament", name: "Summer League" },
      { type: "", name: "Mystery Event" },
    ]) {
      const text = renderOutreach(client, event, date);
      assert.match(text, /Acme Sports Club/);
      assert.match(text, new RegExp(event.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(text, /12 Sep 2026/);
      // Every template must tell the customer how to reply
      assert.match(text, /\*yes\*/);
      assert.match(text, /\*no\*/);
    }
  });

  await t.test("listTemplates includes the default", () => {
    const ids = listTemplates();
    assert.ok(ids.includes("default"));
    assert.ok(ids.includes("tournament"));
  });
});
