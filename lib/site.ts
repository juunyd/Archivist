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
    question: "What is an Archivist book?",
    answer:
      "A short, focused digital book built around one specific problem. Around 40 to 60 pages, written to be read in a single sitting.",
  },
  {
    question: "What format are the books?",
    answer:
      "A print-ready PDF, delivered to your email within a minute of checkout. You can read it on a phone, laptop or tablet, or print it.",
  },
  {
    question: "How do I get the book after paying?",
    answer:
      "The download link is emailed to you immediately, and also shown on the confirmation page. The link keeps working, so you can download the book again whenever you need it.",
  },
  {
    question: "I didn't receive my email. What now?",
    answer:
      "Check your spam folder first. You can also request the link again from our download page, or write to hello@archivist.in and we'll send it to you.",
  },
  {
    question: "Can I get a refund?",
    answer:
      "Because the books are delivered instantly as digital files, purchases are not refundable. If you were charged twice, or the book was never delivered, write to hello@archivist.in and we'll refund you in full.",
  },
  {
    question: "Do I get future updates of the book?",
    answer:
      "Yes. If a book is revised, the same download link gives you the latest edition at no extra cost.",
  },
  {
    question: "Who writes the books?",
    answer:
      "Archivist is an independent Indian publisher. Each book is researched and written in-house, with sources named in the text.",
  },
];
