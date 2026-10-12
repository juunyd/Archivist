import Image from "next/image";
import type { Guide } from "@/lib/catalog";

interface BonusCardProps {
  bonus: NonNullable<Guide["bonus"]>;
}

/** Advertises a guide's free bonus PDF. Only rendered when guide.bonus exists — see app/[slug]/page.tsx. */
export function BonusCard({ bonus }: BonusCardProps) {
  return (
    <div className="bonus-card-wrap">
      <div className="bonus-card">
        <span className="bonus-card__tag">Free</span>
        <div className="bonus-card__media">
          <Image
            src={bonus.coverImage}
            alt={`${bonus.title} cover`}
            width={160}
            height={160}
            className="bonus-card__cover"
          />
        </div>
        <div className="bonus-card__body">
          <p className="bonus-card__title">{bonus.title}</p>
          {bonus.description && <p className="bonus-card__description">{bonus.description}</p>}
        </div>
      </div>
      <p className="bonus-card__caption">Included free with your purchase</p>
    </div>
  );
}
