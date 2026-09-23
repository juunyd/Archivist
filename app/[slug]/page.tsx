import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CtaButton } from "@/components/CtaButton";
import { FaqAccordion } from "@/components/FaqAccordion";
import { StickyBuyBar } from "@/components/StickyBuyBar";
import { getAllGuideSlugs, getGuideBySlug, guideDisclaimer } from "@/lib/guides";
import styles from "./page.module.css";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

const navLinks = [
  { href: "#inside", label: "What's inside" },
  { href: "#faq", label: "FAQ" },
];

const footerLinks = [
  { href: "/#shelf", label: "Collections" },
  { href: "/#standard", label: "Editorial standard" },
  { href: "#faq", label: "FAQ" },
];

export function generateStaticParams() {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

// No fallback: only slugs returned by generateStaticParams are built. There
// is no server to render anything else at request time in static export.
export const dynamicParams = false;

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return {};

  return {
    title: guide.title,
    description: guide.subtitle,
    openGraph: {
      title: guide.title,
      description: guide.subtitle,
      images: guide.coverImage ? [{ url: guide.coverImage }] : undefined,
    },
  };
}

const SENTINEL_ID = "hero-sentinel";

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  return (
    <>
      <Header navLinks={navLinks} />

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroGrid}>
            <div className={styles.heroMedia}>
              {guide.coverImage ? (
                <Image
                  src={guide.coverImage}
                  alt={guide.title}
                  width={1200}
                  height={628}
                  className={styles.cover}
                  priority
                />
              ) : (
                <div className={styles.coverPlaceholder}>Cover coming soon</div>
              )}
            </div>

            <div className={styles.heroText}>
              <h1 className={styles.title}>{guide.title}</h1>
              <p className={styles.subtitle}>{guide.subtitle}</p>

              <div className={styles.priceRow}>
                <span className={styles.price}>&#8377;{guide.price}</span>
                {guide.compareAtPrice && (
                  <span className={styles.compareAtPrice}>
                    &#8377;{guide.compareAtPrice}
                  </span>
                )}
              </div>

              <CtaButton guide={guide} />

              <div className={styles.trustBadges}>
                <span>&#10003; Instant delivery</span>
                <span>&#10003; Secure checkout</span>
                <span>&#10003; PDF</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div id={SENTINEL_ID} style={{ width: "100%", height: 1 }} />

      <section id="inside" className={styles.insideSection}>
        <div className={styles.insideInner}>
          <div className={styles.eyebrow}>The problem</div>
          <p className={styles.problemStatement}>{guide.problemStatement}</p>

          <div className={styles.insideEyebrow}>What&apos;s inside</div>
          <div className={styles.insideList}>
            {guide.whatsInside.map((item, index) => (
              <div key={item.title} className={styles.insideItem}>
                <span className={styles.insideItemNumber}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className={styles.insideItemTitle}>{item.title}</h3>
                  <p className={styles.insideItemBody}>{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <CtaButton guide={guide} align="center" className={styles.insideCta} />
        </div>
      </section>

      <section className={styles.disclaimerSection}>
        <p className={styles.disclaimerText}>{guideDisclaimer}</p>
      </section>

      <section id="faq" className={styles.faqSection}>
        <div className={styles.faqInner}>
          <h2 className={styles.faqHeading}>Questions</h2>
          <FaqAccordion items={guide.faqs} variant="bold" />
        </div>
      </section>

      <section id="buy" className={styles.buySection}>
        <div className={styles.buyInner}>
          <h2 className={styles.buyHeading}>Decide better by this time tomorrow.</h2>
          <p className={styles.buySub}>
            {guide.pageCount} pages, PDF, delivered the moment you check out.
          </p>
          <div className={styles.buyPrice}>&#8377;{guide.price}</div>
          <CtaButton guide={guide} align="center" className={styles.buyCta} />
        </div>
      </section>

      <Footer collectionsLinks={footerLinks} />

      <StickyBuyBar guide={guide} sentinelId={SENTINEL_ID} />
    </>
  );
}
