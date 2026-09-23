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
  coverImage?: string;
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

export const guides: Guide[] = [
  {
    slug: "signal-discipline",
    no: "No. 07",
    title: "Signal Discipline",
    subtitle:
      "A field manual for making sharp decisions when your information is noisy, partial and rushed.",
    blurb:
      "Making sharp decisions when your information is noisy, partial and rushed.",
    problemStatement:
      "You're not short on information. You're short on a way to tell what matters.",
    price: 199,
    pageCount: 148,
    coverImage: "/images/book-cover-hero.webp",
    whatsInside: [
      {
        title: "The evidence ladder",
        description:
          "Rank every claim by how it was produced, before arguing about whether it's true.",
      },
      {
        title: "Five-minute premortem",
        description:
          "A short script that surfaces the failure modes your team is quietly avoiding naming.",
      },
      {
        title: "Confidence in writing",
        description:
          "State what you believe, how sure you are, and what would change your mind, in three lines.",
      },
      {
        title: "The reversal test",
        description:
          "A one-question check separating decisions worth debating from decisions worth simply making.",
      },
    ],
    faqs: [
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
    ],
  },
  {
    slug: "the-cost-of-being-early",
    no: "No. 06",
    title: "The Cost of Being Early",
    subtitle:
      "What the research actually says about timing a market, a career, or a launch.",
    blurb:
      "What the research actually says about timing a market, a career, or a launch.",
    problemStatement:
      "Being early feels like foresight. The data says it usually isn't.",
    price: 199,
    pageCount: 132,
    whatsInside: [
      {
        title: "The timing myth",
        description:
          "Why being first is remembered and being right is not — and how to tell them apart in your own decisions.",
      },
      {
        title: "The waiting cost model",
        description:
          "A simple way to price the cost of moving too soon against the cost of moving too late.",
      },
      {
        title: "Reading the market's patience",
        description:
          "Signals that tell you whether an audience, a market, or an organization is actually ready.",
      },
      {
        title: "The re-entry plan",
        description:
          "What to do when you've moved early and need a credible way back in without losing face.",
      },
    ],
    faqs: [
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
    ],
  },
  {
    slug: "small-teams-hard-calls",
    no: "No. 05",
    title: "Small Teams, Hard Calls",
    subtitle:
      "How groups of under twelve people decide well, and where they reliably fail.",
    blurb:
      "How groups of under twelve people decide well, and where they reliably fail.",
    problemStatement:
      "Small teams don't fail from bad ideas. They fail from bad decision processes.",
    price: 249,
    pageCount: 164,
    whatsInside: [
      {
        title: "The consensus trap",
        description:
          "Why seeking agreement from everyone quietly produces worse decisions than a clear owner would.",
      },
      {
        title: "The disagree-and-commit script",
        description:
          "A concrete way to close a debate without pretending everyone agrees.",
      },
      {
        title: "Decision rights, on paper",
        description:
          "A one-page format for who decides what, so it stops being renegotiated every time.",
      },
      {
        title: "The blast-radius check",
        description:
          "A quick test for whether a call deserves a meeting or just needs to be made.",
      },
    ],
    faqs: [
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
    ],
  },
  {
    slug: "reading-a-study-in-20-minutes",
    no: "No. 04",
    title: "Reading a Study in 20 Minutes",
    subtitle:
      "A practical method for judging a paper you are not qualified to referee.",
    blurb:
      "A practical method for judging a paper you are not qualified to referee.",
    problemStatement:
      "You don't need a PhD to catch a bad study. You need a checklist.",
    price: 149,
    pageCount: 120,
    whatsInside: [
      {
        title: "The five-question filter",
        description:
          "What to check first, before reading a single line of the results section.",
      },
      {
        title: "Sample size, honestly",
        description:
          "How to tell whether a study's sample can actually support its headline claim.",
      },
      {
        title: "Spotting a p-hacked result",
        description:
          "Common tells that a result was found rather than tested for.",
      },
      {
        title: "The one-paragraph verdict",
        description: "A format for writing down what a study does and doesn't show you, in three lines.",
      },
    ],
    faqs: [
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
    ],
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
