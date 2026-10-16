// Validate all content without writing anything: frontmatter, Markdown features, glossary terms,
// example ids, API symbols and internal links. Prints pages that still hold placeholders.
//   node libs/docs-kit/cli.ts check-content apps/docs          # all pages
//   node libs/docs-kit/cli.ts check-content apps/docs --strict # also fail on TODO-CONTENT placeholders and localhost/127.0.0.1 links
import { generateContent } from "./content/generate.ts";

/** CLI: `docs-kit check-content <app root> [--strict]`. */
export async function checkContentCommand(root: string, args: string[]): Promise<void> {
  try {
    const { pages, todo, localLinks } = await generateContent(root, { dryRun: true });
    console.log(`content: ${pages.length} pages OK, ${todo.length} placeholder page(s)`);
    if (todo.length) console.log("  " + todo.join("\n  "));
    if (localLinks.length) console.log(`hard-coded local links (use site:<name>/<path>):\n  ` + localLinks.join("\n  "));
    if ((todo.length || localLinks.length) && args.includes("--strict")) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
