import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of service for Archivist.",
};

// LegalPage sets the body type size; globals.css has no heading rules, so the
// section headings are sized here to sit just above the surrounding copy.
const headingStyle = {
  fontSize: 18,
  marginTop: 32,
  marginBottom: 10,
} as const;

export default function TermsPage() {
  const support = (
    <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
  );

  return (
    <LegalPage title="Terms &amp; Conditions">
      <p style={{ color: "var(--gray-800)" }}>Last updated: 21 September 2026</p>
      <p>
        These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your use of
        archivist.in (the &ldquo;Website&rdquo;) and your purchase of guides from
        Archivist (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By
        using the Website or making a purchase, you agree to these Terms. If you
        do not agree, please do not use the Website.
      </p>

      <h2 style={headingStyle}>About Archivist</h2>
      <p>
        Archivist is an independent publisher of short digital guides. Our guides
        are sold as downloadable PDF files through this Website.
      </p>

      <h2 style={headingStyle}>Eligibility</h2>
      <p>
        You must be at least 18 years old to make a purchase. By placing an
        order, you confirm that the information you provide is accurate and that
        you are authorised to use the payment method.
      </p>

      <h2 style={headingStyle}>Purchases and payment</h2>
      <p>
        All prices are listed in Indian Rupees (INR) and include applicable
        taxes unless stated otherwise. Payments are processed securely by our
        third-party payment partner. We do not store your card, UPI or bank
        details.
      </p>
      <p>
        We may change prices at any time. The price shown at checkout is the
        price you pay.
      </p>

      <h2 style={headingStyle}>Delivery</h2>
      <p>
        After a successful payment, your guide is delivered by email and is also
        available through a download link shown on the confirmation page.
        Download links may be used a limited number of times. If you do not
        receive your guide, please contact us at {support}.
      </p>

      <h2 style={headingStyle}>Refunds</h2>
      <p>
        As our guides are digital products delivered instantly, all purchases are
        final and non-refundable, except in cases of duplicate payment or failed
        delivery. Please see our <a href="/refund-policy/">Refund Policy</a> for
        details.
      </p>

      <h2 style={headingStyle}>Licence and permitted use</h2>
      <p>
        When you buy a guide, you receive a personal, non-exclusive,
        non-transferable licence to read and use it for your own purposes.
      </p>
      <p>You may not:</p>
      <ul>
        <li>share, resell, distribute or publish the guide or its download link;</li>
        <li>upload the guide to any website, file-sharing service or group;</li>
        <li>
          copy, reproduce or modify the guide, in whole or in part, except for
          your personal use; or
        </li>
        <li>use the content to create competing products.</li>
      </ul>
      <p>
        We may disable download access if we detect misuse or unauthorised
        sharing.
      </p>

      <h2 style={headingStyle}>Intellectual property</h2>
      <p>
        All content on the Website and in our guides, including text, design,
        graphics and logos, is owned by Archivist or its licensors and is
        protected by copyright and other intellectual property laws.
      </p>

      <h2 style={headingStyle}>Information, not professional advice</h2>
      <p>
        Our guides are for general educational and informational purposes only.
        They do not constitute financial, legal, tax, investment or other
        professional advice. You are responsible for any decisions you make
        based on our content, and you should consult a qualified professional
        where appropriate.
      </p>

      <h2 style={headingStyle}>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Archivist will not be liable for
        any indirect, incidental or consequential loss arising from your use of
        the Website or our guides. Our total liability for any claim relating to
        a purchase is limited to the amount you paid for that guide.
      </p>

      <h2 style={headingStyle}>Acceptable use</h2>
      <p>
        You agree not to misuse the Website, including by attempting to gain
        unauthorised access, interfering with its operation, or using it for any
        unlawful purpose.
      </p>

      <h2 style={headingStyle}>Third-party services and links</h2>
      <p>
        The Website may use third-party services, such as payment gateways, and
        may contain links to other websites. We are not responsible for the
        content or practices of third parties.
      </p>

      <h2 style={headingStyle}>Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Changes will be posted on
        this page with an updated date. Continued use of the Website after
        changes means you accept the updated Terms.
      </p>

      <h2 style={headingStyle}>Governing law</h2>
      <p>
        These Terms are governed by the laws of India. Any disputes are subject
        to the exclusive jurisdiction of the courts at Chhatrapati
        Sambhajinagar (Aurangabad), Maharashtra.
      </p>

      <h2 style={headingStyle}>Contact us</h2>
      <p>For any questions about these Terms, write to us at {support}.</p>
    </LegalPage>
  );
}
