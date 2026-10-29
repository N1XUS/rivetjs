// Rivet-authored Markdown demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Markdown, type MarkdownComponents } from "@rivetjs/ui/markdown";
import { ExternalLink } from "lucide";

export const head = { title: "Markdown: Custom components" };

// #region demo
const DOC = `### Release notes

Run \`rivet build\` before you deploy. The full list is in the [changelog](https://example.com/changelog).

Use \`rivet check\` in CI as well.`;

// Each override gets the default class, the node's attributes and the rendered children.
const components: MarkdownComponents = {
  h3: (props) => (
    <h3 class={props.class} data-custom="heading" id="release-notes">
      {props.children}
    </h3>
  ),
  a: (props) => (
    <a class={`${props.class} inline-flex items-center gap-1`} href={props.href} target={props.target} rel={props.rel} data-custom="link">
      {props.children}
      <Icon icon={ExternalLink} size={14} />
    </a>
  ),
  code: (props) => (
    <kbd class="rounded-md border border-border bg-surface-secondary px-1.5 py-0.5 font-mono text-xs" data-custom="code">
      {props.children}
    </kbd>
  ),
};

export function CustomComponents() {
  return <Markdown class="w-[28rem]" content={DOC} components={components} />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomComponents />
    </div>
  );
}
