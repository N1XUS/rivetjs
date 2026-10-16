// Rivet-authored PromptSuggestion demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Chip } from "@rivetjs/ui/chip";
import { PromptSuggestion } from "@rivetjs/ui/prompt-suggestion";

export const head = { title: "PromptSuggestion: Cards" };

// #region demo
const CARDS = [
  { title: "Draft a launch email", description: "Announce a feature to existing customers.", tags: ["Writing"], meta: "1 min" },
  { title: "Review a pull request", description: "Paste a diff and get a checklist of risks.", tags: ["Code"], meta: "3 min" },
  { title: "Plan a sprint", description: "Turn a backlog into a two-week plan.", tags: ["Planning", "Team"], meta: "5 min" },
  { title: "Compare two offers", description: "Weigh salary, equity and commute.", tags: ["Career"], meta: "2 min" },
];

export function Cards() {
  return (
    <PromptSuggestion variant="card" class="w-[36rem]">
      <PromptSuggestion.Header>
        <PromptSuggestion.Title>Start with a template</PromptSuggestion.Title>
        <PromptSuggestion.Description>Each one opens a prepared prompt you can edit.</PromptSuggestion.Description>
      </PromptSuggestion.Header>
      <PromptSuggestion.Items>
        {CARDS.map((card) => (
          <PromptSuggestion.Item>
            <PromptSuggestion.ItemTitle>{card.title}</PromptSuggestion.ItemTitle>
            <PromptSuggestion.ItemDescription>{card.description}</PromptSuggestion.ItemDescription>
            <PromptSuggestion.ItemFooter>
              <PromptSuggestion.ItemTags>
                {card.tags.map((tag) => (
                  <Chip size="sm">{tag}</Chip>
                ))}
              </PromptSuggestion.ItemTags>
              <PromptSuggestion.ItemMeta>{card.meta}</PromptSuggestion.ItemMeta>
            </PromptSuggestion.ItemFooter>
          </PromptSuggestion.Item>
        ))}
      </PromptSuggestion.Items>
    </PromptSuggestion>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Cards />
    </div>
  );
}
