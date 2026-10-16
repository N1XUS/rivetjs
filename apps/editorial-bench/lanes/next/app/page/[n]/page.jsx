import { load, pageCount, pageItems } from "../../../lib/site.js";
import { ListPage } from "../../teasers.jsx";

export const dynamicParams = false;
export function generateStaticParams() {
  const { site, articles } = load();
  return Array.from({ length: pageCount(site, articles) - 1 }, (_, i) => ({ n: String(i + 2) }));
}
export async function generateMetadata({ params }) {
  const { n } = await params;
  return { title: `Latest, page ${n}`, description: "Latest stories from The Daily Fixture." };
}

export default async function Page({ params }) {
  const n = Number((await params).n);
  const { site, articles } = load();
  return <ListPage n={n} pages={pageCount(site, articles)} items={pageItems(site, articles, n)} />;
}
