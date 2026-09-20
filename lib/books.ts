export interface FaqItem {
  question: string;
  answer: string;
}

export interface WhatsInsideItem {
  title: string;
  description: string;
}

export interface Book {
  slug: string;
  no: string;
  title: string;
  subtitle: string;
  blurb: string;
  problemStatement: string;
  price: number;
  /** Only set this when the book genuinely has a "was" price to strike through. */
  compareAtPrice?: number;
  pageCount: number;
  coverImage?: string;
  whatsInside: WhatsInsideItem[];
  faqs: FaqItem[];
}

export const books: Book[] = [
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
          "A print-ready PDF and an EPUB for e-readers, delivered to your inbox within a minute of checkout.",
      },
      {
        question: "What if I want a refund?",
        answer:
          "Reply to the delivery email within 30 days for a full refund. You keep the files.",
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
          "A print-ready PDF and an EPUB for e-readers, delivered to your inbox within a minute of checkout.",
      },
      {
        question: "What if I want a refund?",
        answer:
          "Reply to the delivery email within 30 days for a full refund. You keep the files.",
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
          "A print-ready PDF and an EPUB for e-readers, delivered to your inbox within a minute of checkout.",
      },
      {
        question: "What if I want a refund?",
        answer:
          "Reply to the delivery email within 30 days for a full refund. You keep the files.",
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
          "A print-ready PDF and an EPUB for e-readers, delivered to your inbox within a minute of checkout.",
      },
      {
        question: "What if I want a refund?",
        answer:
          "Reply to the delivery email within 30 days for a full refund. You keep the files.",
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

export function getBookBySlug(slug: string): Book | undefined {
  return books.find((book) => book.slug === slug);
}

export function getAllBookSlugs(): string[] {
  return books.map((book) => book.slug);
}
