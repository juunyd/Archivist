import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Archivist.",
};

// LegalPage sets the body type size; globals.css has no heading rules, so the
// section headings are sized here to sit just above the surrounding copy.
const headingStyle = {
  fontSize: 18,
  marginTop: 32,
  marginBottom: 10,
} as const;

export default function ContactPage() {
  const support = (
    <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
  );

  return (
    <LegalPage title="Contact">
      <p>
        Questions about a book, your order or a download? Write to us and
        we&rsquo;ll get back to you.
      </p>
      <p>
        <strong>Email:</strong> {support}
      </p>
      <p>
        We usually reply within 24 to 48 hours, Monday to Saturday.
      </p>

      <h2 style={headingStyle}>Before you write</h2>
      <ul>
        <li>
          <strong>Didn&rsquo;t receive your book?</strong> Check your spam
          folder first, or request your download link again from the{" "}
          <a href="/download/">download page</a>.
        </li>
        <li>
          <strong>Charged twice or book not delivered?</strong> Include your
          order ID or the email you used at checkout, and we&rsquo;ll sort it
          out quickly.
        </li>
      </ul>
    </LegalPage>
  );
}
