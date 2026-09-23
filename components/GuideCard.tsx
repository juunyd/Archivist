import Link from "next/link";
import type { Guide } from "@/lib/guides";

interface GuideCardProps {
  guide: Guide;
}

export function GuideCard({ guide }: GuideCardProps) {
  return (
    <Link href={`/${guide.slug}`} className="book-card">
      <div className="book-card__cover">
        <span className="book-card__no">{guide.no}</span>
        <span className="book-card__price">&#8377;{guide.price}</span>
      </div>
      <div>
        <h3 className="book-card__title">{guide.title}</h3>
        <p className="book-card__blurb">{guide.blurb}</p>
      </div>
    </Link>
  );
}
