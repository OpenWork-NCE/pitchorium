import { notFound } from 'next/navigation';

/** Any unknown path of a locale renders the localised not-found page. */
export default function CatchAll() {
  notFound();
}
