"use client";

import { useId, useState } from "react";
import type { FaqItem } from "@/lib/catalogue";

interface FaqAccordionProps {
  items: FaqItem[];
  /** "bold" matches the landing page's heavier trigger weight + bottom-rule dividers. */
  variant?: "default" | "bold";
}

export function FaqAccordion({ items, variant = "default" }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  return (
    <div className={`faq faq--${variant}`}>
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-button-${index}`;

        return (
          <div key={item.question} className="faq__item">
            <h3 className="faq__heading">
              <button
                type="button"
                id={buttonId}
                className="faq__trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenIndex(isOpen ? null : index)}
              >
                <span>{item.question}</span>
                <span className="faq__sign" aria-hidden="true">
                  {isOpen ? "−" : "+"}
                </span>
              </button>
            </h3>
            <p
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className="faq__answer"
              style={{ display: isOpen ? "block" : "none" }}
            >
              {item.answer}
            </p>
          </div>
        );
      })}
    </div>
  );
}
