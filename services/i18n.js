// services/i18n.js - Message localisation.
//
// Lookup falls back to English per *key*, not per locale, so a partially
// translated locale still works: translated keys render in that language and
// anything missing renders in English, rather than the whole locale failing.
import en from "../locales/en.js";
import hi from "../locales/hi.js";

const LOCALES = { en, hi };
export const DEFAULT_LOCALE = process.env.DEFAULT_LOCALE || "en";

export const SUPPORTED = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
];

export function isSupported(code) {
  return Object.prototype.hasOwnProperty.call(LOCALES, code);
}

export function normalizeLocale(code) {
  const c = String(code || "").toLowerCase().trim();
  return isSupported(c) ? c : DEFAULT_LOCALE;
}

/**
 * Translate a key.
 * @param {string} key    - key in the locale file
 * @param {string} locale - locale code
 * @param {object} params - passed to the entry when it's a function
 */
export function t(key, locale = DEFAULT_LOCALE, params = {}) {
  const table = LOCALES[normalizeLocale(locale)] || en;
  const entry = table[key] !== undefined ? table[key] : en[key];

  if (entry === undefined) {
    // Surfacing the key beats sending an empty message
    console.warn(`⚠️ Missing translation key: ${key}`);
    return key;
  }
  return typeof entry === "function" ? entry(params) : entry;
}

/** Bind a locale once: const _ = translator("hi"); _("welcome") */
export function translator(locale) {
  const loc = normalizeLocale(locale);
  return (key, params) => t(key, loc, params);
}

/**
 * Recognise a language request. Accepts the `language`/`lang`/`भाषा` command,
 * a numeric pick from the prompt, or the language named directly.
 * @returns {"prompt"|string|null} "prompt" to show the chooser, a locale code
 *          to switch immediately, or null if this isn't a language request.
 */
export function parseLanguageCommand(text) {
  const t0 = String(text || "").trim().toLowerCase();
  if (!t0) return null;

  if (/^(language|lang|भाषा)$/.test(t0)) return "prompt";

  const named = { english: "en", angrezi: "en", hindi: "hi", हिन्दी: "hi", हिंदी: "hi" };
  const m = t0.match(/^(?:language|lang|भाषा)\s+(.+)$/);
  if (m) {
    const want = m[1].trim();
    if (named[want]) return named[want];
    if (isSupported(want)) return want;
    return "prompt";
  }
  return null;
}

/** Map a reply to the language prompt ("1"/"2"/"english"/"hindi") to a locale. */
export function parseLanguageChoice(text) {
  const t0 = String(text || "").trim().toLowerCase();
  if (t0 === "1" || t0 === "english") return "en";
  if (t0 === "2" || t0 === "hindi" || t0 === "हिन्दी" || t0 === "हिंदी") return "hi";
  return null;
}
