// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/typography/prose.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Typography } from "@rivetjs/ui/typography";

export const head = { title: "Typography: Prose" };

// #region demo
export const Prose = () => {
  return (
    <Typography.Prose class="flex max-w-xl flex-col gap-3">
      <h1>Prose title</h1>
      <p>Prose is for authored content where the markup is already semantic and Rivet UI applies the default typography rhythm.</p>
      <h2>Section title</h2>
      <p>
        Inline code like <code>render</code> receives the same code treatment as the Typography primitive.
      </p>
    </Typography.Prose>
  );
};
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Prose />
    </div>
  );
}
