/**
 * Every guide on the site, and the only place the marketing copy lives.
 *
 * PRICES ARE DUPLICATED ON PURPOSE, AND MUST BE KEPT IN SYNC BY HAND.
 *
 * `price` here is display only — it decides what a visitor reads on the page.
 * What a buyer is actually charged comes from `price_paise` in D1's `books`
 * table, looked up server-side by slug in the Worker's /api/create-order
 * route (worker/routes/create-order.ts). A tampered client can ask to buy a
 * slug, never to set a price.
 *
 * So changing a price is two steps, and doing only the first is a bug a
 * visitor sees as one number and pays another:
 *
 *   1. edit `price` below (rupees), and
 *   2. update the matching row in D1 (paise — rupees x 100), either by hand:
 *
 *      npx wrangler d1 execute archivist-db --remote \
 *        --command "UPDATE books SET price_paise = 24900 WHERE slug = '...'"
 *
 *      or by editing migrations/0004_seed_books.sql and applying a new
 *      migration — see that file's own header.
 *
 * The same goes for adding or removing a guide: a slug that is not in the
 * table with status = 'published' renders here but cannot be bought.
 *
 * "Guide" is the product name everywhere a visitor sees it. D1's table is
 * still `books` (column `book_slug` on `orders`), and R2's bucket is still
 * `archivist-book-files` — those were kept as-is during the rename so
 * migrations and deployed infra didn't need to move too.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

export interface WhatsInsideItem {
  title: string;
  description: string;
}

export interface Guide {
  slug: string;
  no: string;
  title: string;
  subtitle: string;
  blurb: string;
  problemStatement: string;
  /** Rupees, shown to the visitor. The charge comes from books.price_paise — see the file header. */
  price: number;
  /** Only set this when the guide genuinely has a "was" price to strike through. */
  compareAtPrice?: number;
  pageCount: number;
  coverImage: string;
  whatsInside: WhatsInsideItem[];
  faqs: FaqItem[];
}

/**
 * Paths that a guide slug must never collide with — everything else that
 * lives at the top level of the site. Checked below so a bad slug fails the
 * build loudly instead of silently shadowing (or being shadowed by) one of
 * these routes.
 */
export const RESERVED_TOP_LEVEL_PATHS = [
  "terms",
  "privacy",
  "refund-policy",
  "contact",
  "download",
  "thank-you",
  "api",
];

// Shared across every guide FAQ list, per our standing policy on format,
// delivery and refunds. Reused verbatim rather than restated per guide so
// the policy only has to be edited in one place.
const standardFaqs: FaqItem[] = [
  {
    question: "What format do I get?",
    answer:
      "A print-ready PDF, delivered to your inbox within a minute of checkout. Read it on a phone, laptop or tablet, or print it.",
  },
  {
    question: "What if I want a refund?",
    answer:
      "Digital files are delivered instantly, so purchases are not refundable. If you were charged twice, or the guide never arrived, write to hello@archivist.in and we will refund you in full.",
  },
  {
    question: "Is it a one-time payment?",
    answer:
      "Yes — one payment, no subscription. You get lifetime access including future editions.",
  },
  {
    question: "Can I get a receipt for expenses?",
    answer:
      "Yes, a receipt is emailed automatically and can be addressed to a company name at checkout.",
  },
];

export const guides: Guide[] = [
  {
    slug: "i-lost-money-in-fno",
    no: "No. 01",
    title: "I Lost Money in F&O. Now What.",
    subtitle: "A recovery guide for Indian retail traders, for the night a loss happens.",
    blurb:
      "A calm, honest guide for the night after a big F&O loss — what to do, and what to skip.",
    problemStatement:
      "You lost money trading F&O, and you don't know how to get through tonight, let alone tomorrow.",
    price: 299,
    pageCount: 44,
    coverImage: "/images/covers/i-lost-money-in-fno.png",
    whatsInside: [
      {
        title: "You are not the only one",
        description:
          "SEBI found that 93% of individual F&O traders lost money over FY22–FY24, with average losses of about ₹2 lakh — why that changes the story you tell about your own loss.",
      },
      {
        title: "Why losses hurt twice as much",
        description:
          "The psychology behind why a loss feels heavier than an equal gain feels good, and why that pushes you toward exactly the wrong decision.",
      },
      {
        title: "The cruel arithmetic of losses",
        description:
          "Why a 50% loss needs a 100% gain just to break even — and how that maths is what tempts people into the trade that finishes them off.",
      },
      {
        title: "The trap called \"one more trade\"",
        description:
          "The sunk-cost pull to win it back immediately, and the story of Jesse Livermore, one of history's greatest traders, who never learned to resist it.",
      },
      {
        title: "Looking at what actually happened",
        description:
          "A calm, no-blame way to review your trades and real costs, so the loss becomes a page of facts instead of a cloud of shame.",
      },
      {
        title: "If it hurts more than money",
        description:
          "What to do, and who to call, if the loss has moved past a financial problem — including a free, 24-hour national helpline.",
      },
    ],
    faqs: standardFaqs,
  },
  {
    slug: "the-revenge-trading-cure",
    no: "No. 02",
    title: "The Revenge Trading Cure",
    subtitle:
      "A small book about a single, expensive habit: the trade you place to erase the last one, and the brakes that stop it.",
    blurb:
      "The trade you place to erase the last loss — and the brakes that stop it before it costs you everything.",
    problemStatement:
      "A loss makes you want to trade again immediately, bigger, to make it disappear. That trade is usually the expensive one.",
    price: 299,
    pageCount: 61,
    coverImage: "/images/covers/the-revenge-trading-cure.png",
    whatsInside: [
      {
        title: "What revenge trading actually is",
        description:
          "The exact mechanism: a loss creates urgency, urgency pushes you to size up and abandon your process — and why that trader is not the one who made your plan.",
      },
      {
        title: "Why losses hurt twice as much",
        description:
          "Kahneman and Tversky's loss-aversion research, and the coefficient of 2.25 that explains why your account's red number feels heavier than it looks.",
      },
      {
        title: "The hot state and the cold state",
        description:
          "Why you cannot out-think tilt in the moment, and how to write rules while calm that the panicked version of you still has to obey.",
      },
      {
        title: "How to catch yourself in the act",
        description:
          "Nine concrete, observable warning signs of tilt — from creeping position size to hiding trades from your family — memorised before you need them.",
      },
      {
        title: "Building the brake",
        description:
          "Seven tools: the pre-written rule, the kill switch, the walk-away timer, the two-loss rule, the separate account, the checklist, and the if-then plan.",
      },
      {
        title: "When it is bigger than a bad day",
        description:
          "How to tell an ordinary bad afternoon apart from a compulsion that needs professional help — and where to find it, including a free national helpline.",
      },
    ],
    faqs: standardFaqs,
  },
  {
    slug: "should-i-quit-trading",
    no: "No. 03",
    title: "Should I Quit Trading? An Honest Test",
    subtitle:
      "A set of honest questions, and a way to read your own answers. The decision stays with you.",
    blurb:
      "Seven honest checkpoints to help you decide, calmly, whether to keep trading or walk away.",
    problemStatement:
      "You keep asking yourself whether to quit trading, and the answer depends on your mood that day.",
    price: 299,
    pageCount: 43,
    coverImage: "/images/covers/should-i-quit-trading.png",
    whatsInside: [
      {
        title: "Why this decision is so hard",
        description:
          "The research behind sunk cost, the Concorde fallacy, and status quo bias — the forces that quietly keep people trading past the point they'd choose to.",
      },
      {
        title: "The seven-checkpoint test",
        description:
          "A written test covering your real trading record, your process, the true cost of continuing, and whether you'd start again today, knowing what you know now.",
      },
      {
        title: "A bad stretch or a bad fit",
        description:
          "How to tell a rough patch that can be waited out apart from a structural mismatch with your capital, time, temperament, or family life.",
      },
      {
        title: "A break is not the same as an exit",
        description:
          "Two different doors — a defined, reversible pause versus stopping for good — and rules for choosing between them written in a calm state.",
      },
      {
        title: "When trading stops looking like trading",
        description:
          "The signs that this has become a compulsion rather than a decision, and where to turn, including a free, 24-hour national helpline.",
      },
    ],
    faqs: standardFaqs,
  },
  {
    slug: "the-comeback-plan",
    no: "No. 04",
    title: "The Comeback Plan",
    subtitle:
      "How to rebuild slowly, in a way you can check, after a loss has shaken your money, your confidence, and perhaps your home.",
    blurb:
      "A staged, checkable plan for rebuilding after a loss — small size first, growth only when earned.",
    problemStatement:
      "You've decided to keep trading. Now you need a plan that doesn't repeat the mistake that got you here.",
    price: 299,
    pageCount: 65,
    coverImage: "/images/covers/the-comeback-plan.png",
    whatsInside: [
      {
        title: "Small is not shameful",
        description:
          "Why trading at a small size after a loss is an instrument for cheap, useful mistakes — not a punishment, and not a step backward.",
      },
      {
        title: "The readiness check",
        description:
          "Seven conditions to answer honestly, in writing, before you place another trade — including whether any of the money is borrowed.",
      },
      {
        title: "The three-stage plan",
        description:
          "A calendar-based path from rebuilding your routine, to proving your process small, to earning the right to grow — with a gate to pass before each stage.",
      },
      {
        title: "The step-down rule",
        description:
          "A written trigger that shrinks your position size automatically when a drawdown starts, so the decision is made before you need to make it.",
      },
      {
        title: "The conversation at home",
        description:
          "How to rebuild trust with the people who watched you lose — one visible, honest week at a time, not one big promise.",
      },
      {
        title: "When the comeback isn't the answer",
        description:
          "The signs that call for a pause and professional support rather than another stage of the plan, including a free national helpline.",
      },
    ],
    faqs: standardFaqs,
  },
];

// Fails the build loudly rather than letting a guide slug silently shadow
// (or be shadowed by) a reserved top-level route once /books/[slug] is
// flattened to /[slug].
for (const guide of guides) {
  if ((RESERVED_TOP_LEVEL_PATHS as string[]).includes(guide.slug)) {
    throw new Error(
      `Guide slug "${guide.slug}" collides with a reserved top-level path (${RESERVED_TOP_LEVEL_PATHS.join(", ")}). Rename the guide's slug.`,
    );
  }
}

export function getGuideBySlug(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}

export function getAllGuideSlugs(): string[] {
  return guides.map((guide) => guide.slug);
}
