// Rivet-authored ChainOfThought demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { ChainOfThought } from "@rivetjs/ui/chain-of-thought";

export const head = { title: "ChainOfThought: Usage" };

// #region demo
export function Basic() {
  return (
    <ChainOfThought class="w-96">
      <ChainOfThought.Trigger>Thought for 4 seconds</ChainOfThought.Trigger>
      <ChainOfThought.Content>
        <ChainOfThought.Steps>
          <ChainOfThought.Step label="Read the question">A weekend trip from Lyon, under 300 km, by train.</ChainOfThought.Step>
          <ChainOfThought.Step label="List candidates">Annecy, Dijon, Grenoble and Geneva fit the distance.</ChainOfThought.Step>
          <ChainOfThought.Step label="Pick one">Annecy: direct trains, lake walks, weekend market.</ChainOfThought.Step>
        </ChainOfThought.Steps>
      </ChainOfThought.Content>
    </ChainOfThought>
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
