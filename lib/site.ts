export const siteConfig = {
  name: "Archivist",
  description:
    "Short, research-backed digital books. One question per book, read in a sitting.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://archivist.in",
  contactEmail: "hello@archivist.in",
};

export const editorialRules = [
  {
    n: "01",
    title: "Built around your actual problem",
    body: "Not a topic overview. One real problem, worked through end to end, with the decision you have to make and the trade-offs behind it.",
  },
  {
    n: "02",
    title: "Frameworks, not theory",
    body: "Concepts broken into simple frameworks, worked examples with real numbers, and templates you can use the same week.",
  },
  {
    n: "03",
    title: "Written for people who are short on time",
    body: "40 to 60 pages. Finish it in one sitting, on your phone, and know what to do next.",
  },
];

export const homepageFaqs = [
  {
    question: "What is an Archivist guide?",
    answer:
      "A short, focused digital book built around a specific question, problem, or subject. Written to be read in one sitting rather than stretched to a predetermined length.",
  },
  {
    question: "What format are the books?",
    answer:
      "A print-ready PDF, delivered by email within a minute of checkout. One payment, lifetime access, including later editions of the same title.",
  },
  {
    question: "Can I get a refund?",
    answer:
      "Yes. Reply to the delivery email within 30 days for a full refund, and keep the files.",
  },
];
