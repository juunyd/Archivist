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
    title: "One question per book",
    body: "Every guide is built around a single problem. If the subject needs two books, it becomes two books.",
  },
  {
    n: "02",
    title: "Evidence in the open",
    body: "Claims are cited in the text. Two outside reviewers with subject experience read each manuscript and can block it.",
  },
  {
    n: "03",
    title: "No padding",
    body: "A guide runs only as long as the subject requires. Nothing is stretched to hit a page count.",
  },
];

export const homepageFaqs = [
  {
    question: "What is an Archivist guide?",
    answer:
      "A short, focused digital book built around a specific question, problem, or subject. Written to be read in one sitting rather than stretched to a predetermined length.",
  },
  {
    question: "Who reviews the books?",
    answer:
      "Two outside reviewers with relevant subject experience read each manuscript before publication and can block it. They are named in the front matter of the book they reviewed.",
  },
  {
    question: "What format are the books?",
    answer:
      "PDF and EPUB, delivered by email within a minute of checkout. One payment, lifetime access, including later editions of the same title.",
  },
  {
    question: "Can I get a refund?",
    answer:
      "Yes. Reply to the delivery email within 30 days for a full refund, and keep the files.",
  },
];
