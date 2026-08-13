// services/outreachTemplates.js - Reminder wording per event type.
//
// `Client.events[].type` already existed on the model but was never used —
// every event got the same generic reminder. A sports tournament and a
// retirement gathering warrant different wording.
//
// Types are matched loosely (case-insensitive, substring) so an admin typing
// "Annual Sports Day" still lands on the tournament template.

const TEMPLATES = [
  {
    id: "birthday",
    match: /birthday|bday/i,
    build: (c, e, date) =>
      `🎂 Hi ${c.name}!\n\nWe noticed *${e.name}* is coming up on *${date}*.\n\nPlanning to mark the occasion with a personalised trophy or keepsake? 🏆\n\nReply *yes* to see our collection, or *no* if you're all set.`,
  },
  {
    id: "anniversary",
    match: /anniversar|jubilee/i,
    build: (c, e, date) =>
      `🎉 Hi ${c.name}!\n\n*${e.name}* is approaching on *${date}* — congratulations!\n\nWould you like commemorative awards to mark the milestone? 🏆\n\nReply *yes* to browse, or *no* if you're sorted.`,
  },
  {
    id: "tournament",
    match: /tournament|sports|match|championship|league|meet/i,
    build: (c, e, date) =>
      `🏅 Hi ${c.name}!\n\n*${e.name}* is coming up on *${date}*.\n\nWill you be needing trophies or medals for the winners? We can engrave them with your event name and categories.\n\nReply *yes* to browse, or *no* if you're all set.`,
  },
  {
    id: "graduation",
    match: /graduation|convocation|farewell|valedict/i,
    build: (c, e, date) =>
      `🎓 Hi ${c.name}!\n\n*${e.name}* is on *${date}*.\n\nWould you like personalised awards or mementos for the occasion? 🏆\n\nReply *yes* to see options, or *no* if you're covered.`,
  },
  {
    id: "corporate",
    match: /awards?|annual day|appreciation|recognition|conference|gala/i,
    build: (c, e, date) =>
      `🏆 Hi ${c.name}!\n\n*${e.name}* is coming up on *${date}*.\n\nWill you be needing awards or trophies for your recipients? We can customise them with categories and names.\n\nReply *yes* to browse, or *no* if you're all set.`,
  },
];

/** The original generic wording — used when nothing more specific matches. */
const DEFAULT_TEMPLATE = {
  id: "default",
  build: (c, e, date) =>
    `👋 Hi ${c.name}!\n\nThis is a friendly reminder that your *${e.name}* is coming up on *${date}*.\n\nWill you be needing any trophies or awards for your event? 🏆\n\nReply *yes* to browse our collection, or *no* if you're all set.`,
};

/**
 * Pick a template for an event. Matches on `event.type` first (the explicit
 * field), then falls back to the event name, then to the generic wording.
 */
export function selectTemplate(event) {
  const haystack = `${event?.type || ""} ${event?.name || ""}`.trim();
  if (haystack) {
    const hit = TEMPLATES.find((t) => t.match.test(haystack));
    if (hit) return hit;
  }
  return DEFAULT_TEMPLATE;
}

/** Render the reminder text for a client/event pair. */
export function renderOutreach(client, event, formattedDate) {
  return selectTemplate(event).build(client, event, formattedDate);
}

/** Template ids, for the admin UI. */
export function listTemplates() {
  return [...TEMPLATES.map((t) => t.id), DEFAULT_TEMPLATE.id];
}
