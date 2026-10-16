// Rivet-authored Markdown demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Markdown } from "@rivetjs/ui/markdown";

export const head = { title: "Markdown: Usage" };

// #region demo
const DOC = `## Packing list

You need **three things** and *one* optional extra. See the [weather service](https://example.com/forecast).

- [x] Rain jacket
- [x] Walking shoes
- [ ] Power bank

| Day | High | Low |
| --- | ---: | --: |
| Sat | 18 ° | 9 ° |
| Sun | 16 ° | 8 ° |

> Trains fill up on Friday evenings: book early.

\`\`\`json
{ "city": "Annecy", "nights": 2 }
\`\`\``;

export function Basic() {
  return <Markdown class="w-[32rem]" content={DOC} />;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
