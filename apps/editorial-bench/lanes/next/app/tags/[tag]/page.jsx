import { byTag, load } from "../../../lib/site.js";
import { Teasers } from "../../teasers.jsx";

export const dynamicParams = false;
export function generateStaticParams() {
  return load().site.tags.map((tag) => ({ tag }));
}
export async function generateMetadata({ params }) {
  const { tag } = await params;
  return { title: `Tag: ${tag}`, description: `Stories tagged ${tag}.` };
}

export default async function Tag({ params }) {
  const { tag } = await params;
  const { site, articles } = load();
  return (
    <main className="list">
      <h1>Tag: {tag}</h1>
      <Teasers items={byTag(site, articles, tag)} />
    </main>
  );
}
