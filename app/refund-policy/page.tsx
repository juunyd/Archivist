import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Refund policy",
  description: "Refund policy for Archivist.",
};

export default function RefundPolicyPage() {
  const support = (
    <a href={`mailto:${siteConfig.contactEmail}`}>{siteConfig.contactEmail}</a>
  );

  return (
    <LegalPage title="Refund policy">
      <p>
        Archivist sells digital books. Every purchase is delivered instantly as
        a download link, which means the file is in your hands the moment the
        payment clears and cannot be returned. For that reason,{" "}
        <strong>purchases are not refundable</strong>.
      </p>
      <p>There are two exceptions, and we honour both in full:</p>
      <ul>
        <li>
          <strong>You were charged more than once</strong> for the same book.
          We refund the duplicate payment.
        </li>
        <li>
          <strong>The book was never delivered.</strong> If the download link
          never arrived and never worked, we refund the purchase.
        </li>
      </ul>
      <p>
        In either case, write to {support} with the email address you paid with
        and we will sort it out. If the problem is only that the email did not
        reach you, you do not need a refund — request the link again from the{" "}
        <a href="/download/">download page</a> and it will be sent to you.
      </p>
      <p>
        Refunds are returned to the original payment method. Razorpay usually
        takes five to seven working days to complete one.
      </p>
    </LegalPage>
  );
}
