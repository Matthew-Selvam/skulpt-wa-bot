// test/i18n.test.js - localisation and language switching.
import test from "node:test";
import assert from "node:assert/strict";
import {
  t,
  translator,
  normalizeLocale,
  isSupported,
  parseLanguageCommand,
  parseLanguageChoice,
  SUPPORTED,
} from "../services/i18n.js";
import en from "../locales/en.js";
import hi from "../locales/hi.js";
import { runConversation, ACTIONS } from "../services/conversationFlow.js";

test("locale resolution", async (t2) => {
  await t2.test("known locales pass through", () => {
    assert.equal(normalizeLocale("hi"), "hi");
    assert.equal(normalizeLocale("EN"), "en");
  });

  await t2.test("unknown locales fall back to the default", () => {
    assert.equal(normalizeLocale("fr"), "en");
    assert.equal(normalizeLocale(null), "en");
    assert.equal(normalizeLocale(""), "en");
  });

  await t2.test("isSupported reflects the shipped locales", () => {
    assert.ok(isSupported("en"));
    assert.ok(isSupported("hi"));
    assert.ok(!isSupported("fr"));
  });
});

test("translation lookup", async (t2) => {
  await t2.test("returns the localised string", () => {
    assert.equal(t("reset", "en"), en.reset);
    assert.equal(t("reset", "hi"), hi.reset);
    assert.notEqual(t("reset", "hi"), t("reset", "en"), "Hindi must actually differ");
  });

  await t2.test("interpolates params", () => {
    const out = t("trophyAdded", "en", { name: "Golden Trophy" });
    assert.match(out, /Golden Trophy/);
  });

  await t2.test("falls back per-key, not per-locale", () => {
    // A key present in English but missing from Hindi must render in English
    // rather than blanking out the whole message.
    const missing = Object.keys(en).find((k) => !(k in hi));
    if (missing) assert.equal(t(missing, "hi"), t(missing, "en"));
  });

  await t2.test("unknown key returns the key rather than empty", () => {
    assert.equal(t("no_such_key_xyz", "en"), "no_such_key_xyz");
  });

  await t2.test("translator binds a locale", () => {
    const _ = translator("hi");
    assert.equal(_("reset"), hi.reset);
  });
});

test("Hindi locale completeness", async (t2) => {
  await t2.test("covers every English key", () => {
    const missing = Object.keys(en).filter((k) => !(k in hi));
    assert.deepEqual(missing, [], `Hindi is missing keys: ${missing.join(", ")}`);
  });

  await t2.test("function-valued keys stay functions in Hindi", () => {
    // A mismatch here would throw at render time, not at load
    for (const key of Object.keys(en)) {
      if (typeof en[key] === "function" && key in hi) {
        assert.equal(typeof hi[key], "function", `${key} must be a function in Hindi`);
      }
    }
  });

  await t2.test("Hindi keeps English command keywords typable", () => {
    // The parser only recognises English commands, so they must survive
    // translation or the customer is told to type something that won't work.
    assert.match(hi.help, /\*browse\*/);
    assert.match(hi.help, /\*checkout\*/);
    assert.match(hi.reset, /\*browse\*/);
  });
});

test("language command parsing", async (t2) => {
  await t2.test("bare command opens the chooser", () => {
    assert.equal(parseLanguageCommand("language"), "prompt");
    assert.equal(parseLanguageCommand("lang"), "prompt");
    assert.equal(parseLanguageCommand("भाषा"), "prompt");
  });

  await t2.test("named language switches directly", () => {
    assert.equal(parseLanguageCommand("language hindi"), "hi");
    assert.equal(parseLanguageCommand("lang english"), "en");
    assert.equal(parseLanguageCommand("language hi"), "hi");
  });

  await t2.test("unrecognised language falls back to the chooser", () => {
    assert.equal(parseLanguageCommand("language klingon"), "prompt");
  });

  await t2.test("non-language text is ignored", () => {
    for (const s of ["browse", "hi", "checkout", "", null]) {
      assert.equal(parseLanguageCommand(s), null, JSON.stringify(s));
    }
  });

  await t2.test("'hi' the greeting is not mistaken for Hindi", () => {
    // Real risk: "hi" is both a greeting and the Hindi locale code
    assert.equal(parseLanguageCommand("hi"), null);
  });

  await t2.test("chooser replies map to locales", () => {
    assert.equal(parseLanguageChoice("1"), "en");
    assert.equal(parseLanguageChoice("2"), "hi");
    assert.equal(parseLanguageChoice("hindi"), "hi");
    assert.equal(parseLanguageChoice("nonsense"), null);
  });
});

// --- flow integration ---
const deps = {
  Trophy: { find: async () => [{ _id: "t1", name: "Golden Trophy", price: 1500, toObject() { return { _id: "t1", name: "Golden Trophy", price: 1500 }; } }] },
  Order: class { static async findById() { return null; } static find() { const c = { sort: () => c, limit: async () => [] }; return c; } },
  generateInvoice: async () => "/tmp/x.pdf",
  useLetterhead: false, letterheadPath: null, adminNumber: null,
};
const newSession = (over = {}) => ({
  step: "welcome", cart: [], customization: "", orderId: null, pendingImage: null,
  locale: null, awaitingLanguage: false, isGroup: false, groupId: null, userId: "919999999999", ...over,
});
const run = (text, session, extra = {}) =>
  runConversation({ text: text.toLowerCase(), rawText: text, session, deps, ...extra });
const texts = (a) => a.filter((x) => x.type === ACTIONS.TEXT).map((x) => x.body);

test("language switching in the flow", async (t2) => {
  await t2.test("'language' opens the chooser and waits", async () => {
    const s = newSession();
    const a = await run("language", s);
    assert.match(texts(a)[0], /English/);
    assert.equal(s.awaitingLanguage, true);
  });

  await t2.test("choosing 2 switches to Hindi and emits SET_LOCALE", async () => {
    const s = newSession({ awaitingLanguage: true });
    const a = await run("2", s);
    assert.equal(s.locale, "hi");
    assert.equal(s.awaitingLanguage, false);
    assert.ok(a.find((x) => x.type === ACTIONS.SET_LOCALE && x.locale === "hi"));
    assert.equal(texts(a)[0], hi.languageSet);
  });

  await t2.test("an invalid choice re-prompts rather than proceeding", async () => {
    const s = newSession({ awaitingLanguage: true });
    const a = await run("banana", s);
    assert.equal(s.awaitingLanguage, true, "must keep waiting");
    assert.match(texts(a)[0], /English/);
  });

  await t2.test("subsequent replies are in the chosen language", async () => {
    const s = newSession({ locale: "hi" });
    const a = await run("browse", s);
    assert.match(texts(a)[0], /उपलब्ध/, "catalog header should be Hindi");
  });

  await t2.test("'language hindi' switches without the chooser", async () => {
    const s = newSession();
    const a = await run("language hindi", s);
    assert.equal(s.locale, "hi");
    assert.equal(s.awaitingLanguage, false);
    assert.ok(a.find((x) => x.type === ACTIONS.SET_LOCALE));
  });

  await t2.test("language cannot hijack customization text", async () => {
    // "language" as engraving text must be recorded, not treated as a command
    const s = newSession({ step: "customization" });
    await run("Language Award 2026", s);
    assert.equal(s.customization, "Language Award 2026");
    assert.equal(s.step, "checkout");
  });

  await t2.test("group replies stay @-prefixed when localised", async () => {
    const s = newSession({ locale: "hi", isGroup: true });
    const a = await run("browse", s, { isGroup: true, mention: "919999999999" });
    assert.match(texts(a)[0], /^@919999999999 /);
  });
});

test("SUPPORTED lists both shipped locales", () => {
  assert.deepEqual(SUPPORTED.map((l) => l.code).sort(), ["en", "hi"]);
});
