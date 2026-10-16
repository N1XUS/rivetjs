// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/typography/default.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Typography } from "@rivetjs/ui/typography";

export const head = { title: "Typography: Usage" };

// #region demo
export const Default = () => {
  return (
    <div class="flex max-w-xl flex-col gap-4">
      <Typography type="h1">Build better interfaces</Typography>
      <Typography type="h2">Typography that stays semantic</Typography>
      <Typography type="h3">Composable by default</Typography>
      <Typography type="h4">Small heading</Typography>
      <Typography>Rivet UI Typography uses the cdk Text as the primitive, with semantic typography types and render-prop polymorphism.</Typography>
      <Typography color="muted" type="body-sm">
        Smaller muted body copy for secondary descriptions.
      </Typography>
      <Typography type="code">npm install @rivetjs/ui</Typography>
    </div>
  );
};
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Default />
    </div>
  );
}
