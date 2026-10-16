import { starters } from "virtual:docs/starters";
import { site } from "virtual:docs/site";

const LABELS: Record<string, string> = {
  "starter-static": "static site",
  "starter-server": "server app",
  "starter-minimal": "minimal app",
};

// Module scope on purpose: an inline arrow inside `x.find(arrow) ?? fallback` in a component body is
// registered by the compiler as a resumable closure (the whole expression, a string here), which
// fails at render ("Invalid value used as weak map key").
const firstFile = (files: Record<string, string>) => Object.keys(files).find((file) => file.startsWith("src/routes/index")) ?? "package.json";

/** "Try in browser": posts a starter template to StackBlitz (a plain form; no JavaScript needed). */
export function StarterButton({ template }: { template: string }) {
  const files = starters[template] ?? {};
  const first = firstFile(files);
  return (
    <form class="starter-form" method="post" action={"https://stackblitz.com/run?file=" + encodeURIComponent(first)} target="_blank">
      <input type="hidden" name="project[title]" value={`${site.name} ${LABELS[template] ?? template}`} />
      <input type="hidden" name="project[description]" value={`${site.name} starter: ${template}`} />
      <input type="hidden" name="project[template]" value="node" />
      {Object.entries(files).map(([path, contents]) => (
        <input type="hidden" name={"project[files][" + path + "]"} value={contents} />
      ))}
      <button
        type="submit"
        class="stackblitz-button"
        title={`Opens templates/${template} in StackBlitz. It installs @rivetjs/* from npm (${site.packageVersion}), which works once the packages are published.`}
      >
        Try the {LABELS[template] ?? template} in StackBlitz
      </button>
    </form>
  );
}
