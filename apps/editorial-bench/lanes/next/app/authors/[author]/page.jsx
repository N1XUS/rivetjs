import { byAuthor, load } from "../../../lib/site.js";
import { Teasers } from "../../teasers.jsx";

export const dynamicParams = false;
export function generateStaticParams() {
  return load().site.authors.map((a) => ({ author: a.slug }));
}
export async function generateMetadata({ params }) {
  const { author } = await params;
  const name = load().site.authors.find((a) => a.slug === author).name;
  return { title: name, description: `Stories by ${name}.` };
}

export default async function Author({ params }) {
  const { author } = await params;
  const { site, articles } = load();
  const name = site.authors.find((a) => a.slug === author).name;
  return (
    <main className="list">
      <h1>{name}</h1>
      <Teasers items={byAuthor(site, articles, author)} />
    </main>
  );
}
