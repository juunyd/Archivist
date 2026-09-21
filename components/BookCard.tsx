import Link from "next/link";
import type { Book } from "@/lib/catalogue";

interface BookCardProps {
  book: Book;
}

export function BookCard({ book }: BookCardProps) {
  return (
    <Link href={`/books/${book.slug}`} className="book-card">
      <div className="book-card__cover">
        <span className="book-card__no">{book.no}</span>
        <span className="book-card__price">&#8377;{book.price}</span>
      </div>
      <div>
        <h3 className="book-card__title">{book.title}</h3>
        <p className="book-card__blurb">{book.blurb}</p>
      </div>
    </Link>
  );
}
