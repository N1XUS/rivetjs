import { highlight, languageLabel } from "@rivetjs/cdk/highlight";

export const head = { title: "Code block from tokens" };

// #region demo
const SAMPLES = [
  { id: "hl-ts", language: "ts", code: "const total = rows.length; // count\nexport function label(n: number) {\n  return `${n} rows`;\n}" },
  { id: "hl-css", language: "css", code: ".card {\n  color: #0360fa;\n  padding: 8px;\n}" },
];

function CodeBlock(props: { id: string; code: string; language: string }) {
  return (
    <figure class="code" id={props.id}>
      <figcaption>{languageLabel(props.language)}</figcaption>
      <pre>
        <code>
          {highlight(props.code, props.language).map((token) =>
            token.type === "plain" ? token.value : <span class={`tok-${token.type}`}>{token.value}</span>,
          )}
        </code>
      </pre>
    </figure>
  );
}

export default function Highlighting() {
  return (
    <div class="demo">
      {SAMPLES.map((sample) => (
        <CodeBlock id={sample.id} code={sample.code} language={sample.language} />
      ))}
    </div>
  );
}
// #endregion
