import { load, pageCount, pageItems } from "../lib/site.js";
import { ListPage } from "./teasers.jsx";

export const metadata = { title: "Latest", description: "Latest stories from The Daily Fixture." };

export default function Home() {
  const { site, articles } = load();
  return <ListPage n={1} pages={pageCount(site, articles)} items={pageItems(site, articles, 1)} />;
}
