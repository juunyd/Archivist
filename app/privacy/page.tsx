import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: "Privacy policy for Archivist.",
};

// LegalPage sets the body type size; globals.css has no heading rules, so the
// section headings are sized here to sit just above the surrounding copy.
const headingStyle = {
  fontSize: 18,
  marginTop: 32,
  marginBottom: 10,
} as const;

export default function PrivacyPage() {
  const support = (
    <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
  );

  return (
    <LegalPage title="Privacy Policy">
      <p style={{ color: "var(--gray-800)" }}>Last updated: 21 September 2026</p>
      <p>
        This Privacy Policy explains how Archivist (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects, uses and protects your
        information when you visit archivist.in (the &ldquo;Website&rdquo;) or
        purchase our books. By using the Website, you agree to the practices
        described in this policy.
      </p>

      <h2 style={headingStyle}>Information we collect</h2>
      <p>
        We collect information you provide to us, such as your email address
        when you buy a book, and any details you share when you contact us.
      </p>
      <p>
        When you make a payment, our payment partner may collect your name,
        phone number and email address to process the transaction. We do not
        collect or store your card, UPI or bank account details.
      </p>
      <p>
        We also automatically collect basic technical information, such as your
        IP address, browser and device type, and how you use the Website.
      </p>

      <h2 style={headingStyle}>How we use your information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>process your order and deliver your book;</li>
        <li>send you your download link and order-related emails;</li>
        <li>respond to your questions and support requests;</li>
        <li>prevent fraud and misuse of our Website and products;</li>
        <li>improve our Website, products and marketing; and</li>
        <li>comply with legal and regulatory requirements.</li>
      </ul>
      <p>
        We may also send you updates about new books. You can unsubscribe from
        these at any time.
      </p>

      <h2 style={headingStyle}>Sharing your information</h2>
      <p>We do not sell or rent your personal information.</p>
      <p>
        We share information only with trusted third-party service providers who
        help us operate our business, such as payment gateways, hosting, storage
        and email providers, and only to the extent needed to provide their
        services. We may also disclose information if required by law or to
        protect our rights.
      </p>

      <h2 style={headingStyle}>Cookies</h2>
      <p>
        We use cookies and similar technologies to operate the Website,
        understand how it is used, and measure the performance of our
        advertising. You can control cookies through your browser settings.
      </p>

      <h2 style={headingStyle}>Data security</h2>
      <p>
        We take reasonable measures to protect your information from
        unauthorised access, loss or misuse. However, no method of transmission
        or storage over the internet is completely secure.
      </p>

      <h2 style={headingStyle}>Data retention</h2>
      <p>
        We keep your information for as long as needed to fulfil the purposes
        described in this policy, unless a longer period is required or
        permitted by law.
      </p>

      <h2 style={headingStyle}>Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal
        information, or withdraw your consent, by writing to {support}. Some
        information may need to be retained where required by law.
      </p>

      <h2 style={headingStyle}>Children</h2>
      <p>
        Our Website and books are intended for users aged 18 and above. We do
        not knowingly collect information from children.
      </p>

      <h2 style={headingStyle}>Third-party links</h2>
      <p>
        Our Website may contain links to other websites. We are not responsible
        for the privacy practices of those websites.
      </p>

      <h2 style={headingStyle}>Changes to this policy</h2>
      <p>
        We may update this policy from time to time. Any changes will be posted
        on this page with an updated date.
      </p>

      <h2 style={headingStyle}>Contact us</h2>
      <p>
        For any questions about this Privacy Policy, write to us at {support}.
      </p>

      <h2 style={headingStyle}>Grievance Officer</h2>
      <p>
        For any complaints regarding your personal information, write to our
        Grievance Officer at {support}. We will respond within 30 days.
      </p>
    </LegalPage>
  );
}
