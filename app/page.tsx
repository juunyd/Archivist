import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GuideCard } from "@/components/GuideCard";
import { FaqAccordion } from "@/components/FaqAccordion";
import { guides } from "@/lib/guides";
import { editorialRules, homepageFaqs, siteConfig } from "@/lib/site";
import styles from "./page.module.css";

const navLinks = [
  { href: "#shelf", label: "Shelf" },
  { href: "#standard", label: "Standard" },
  { href: "#faq", label: "FAQ" },
];

const footerLinks = [
  { href: "#shelf", label: "Collections" },
  { href: "#standard", label: "Editorial standard" },
  { href: "#faq", label: "FAQ" },
];

export const metadata: Metadata = {
  title: "Archivist — Short, research-backed digital guides",
  description: siteConfig.description,
  openGraph: {
    title: "Archivist — Short, research-backed digital guides",
    description: siteConfig.description,
    url: siteConfig.url,
  },
};

export default function HomePage() {
  return (
    <>
      <Header navLinks={navLinks} />

      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          A shelf of
          <br />
          <em>solutions</em>&nbsp;to problems
        </h1>
        <div className={styles.heroSub}>
          <span className={styles.heroSubText}>
            One question per guide. Read it in a sitting.
          </span>
        </div>
      </section>

      <section id="shelf" className={styles.shelfSection}>
        <div className="container">
          <div className={styles.shelfHeader}>
            <h2 className={styles.shelfHeading}>The shelf</h2>
            <span className={styles.scrollHint}>Scroll &rarr;</span>
          </div>
        </div>
        <div className={styles.shelf}>
          {guides.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} />
          ))}
        </div>
      </section>

      <section id="standard" className={styles.standardSection}>
        <div className={styles.standardGrid}>
          <div>
            <div className={styles.standardEyebrow}>What&apos;s inside every guide</div>
            <p className={styles.standardLede}>
              Every Archivist guide follows the same format.
            </p>
          </div>
          <div>
            {editorialRules.map((rule) => (
              <div key={rule.n} className={styles.rule}>
                <span className={styles.ruleNumber}>{rule.n}</span>
                <div>
                  <h3 className={styles.ruleTitle}>{rule.title}</h3>
                  <p className={styles.ruleBody}>{rule.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.statementSection}>
        <div className={styles.statementInner}>
          <p className={styles.statementHeading}>
            Good information shouldn&apos;t be buried in noise.
          </p>
          <p className={styles.statementBody}>
            We turn research, data, and ideas into focused guides — clear
            enough to use, short enough to finish.
          </p>
        </div>
      </section>

      <section id="faq" className={styles.faqSection}>
        <div className={styles.faqGrid}>
          <h2 className={styles.faqHeading}>Questions</h2>
          <FaqAccordion items={homepageFaqs} />
        </div>
      </section>

      <Footer collectionsLinks={footerLinks} />
    </>
  );
}
