// services/sessionStore.js - MongoDB-backed replacement for the in-memory
// session Map. Keeps the same shape callers already relied on ({ step, cart,
// customization, orderId, isGroup, groupId, userId }) so call sites barely
// change; the difference is state now survives a process restart.
import { Session } from "../models/Session.js";

function defaults() {
  return {
    step: "welcome",
    cart: [],
    customization: "",
    orderId: null,
    pendingImage: null,
    locale: null,
    awaitingLanguage: false,
    isGroup: false,
    groupId: null,
    userId: null,
  };
}

/**
 * Load a session by key, creating it with `init` merged over the defaults
 * if it doesn't exist yet.
 * @returns {Promise<{session: object, created: boolean}>}
 */
export async function getSession(key, init = {}) {
  const existing = await Session.findOne({ key });
  if (existing) {
    return { session: existing.toObject(), created: false };
  }
  const doc = await Session.create({ key, ...defaults(), ...init });
  return { session: doc.toObject(), created: true };
}

/**
 * Persist a session object (the one returned by getSession, mutated in place
 * by the caller) back to the store.
 */
export async function saveSession(key, session) {
  const { _id, __v, key: _k, ...fields } = session;
  await Session.findOneAndUpdate(
    { key },
    { $set: { ...fields, updatedAt: new Date() } },
    { upsert: true }
  );
}
