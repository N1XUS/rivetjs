// Rivet-authored CodeBlock demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { CodeBlock } from "@rivetjs/ui/code-block";

export const head = { title: "CodeBlock: Usage" };

// #region demo
const CODE = `import { signal } from "@rivetjs/reactivity";

export function Counter() {
  const count = signal(0);
  // Handlers resume on first click: nothing runs at load.
  return <button onClick={() => count.set(count() + 1)}>Clicked {count()} times</button>;
}`;

export function Basic() {
  return (
    <CodeBlock class="w-[34rem]">
      <CodeBlock.Header>
        <CodeBlock.Language language="tsx" />
        <CodeBlock.CopyButton code={CODE} />
      </CodeBlock.Header>
      <CodeBlock.Code code={CODE} language="tsx" />
    </CodeBlock>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
