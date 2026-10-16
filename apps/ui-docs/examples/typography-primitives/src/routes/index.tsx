// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/typography/primitives.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Typography } from "@rivetjs/ui/typography";

export const head = { title: "Typography: Primitives" };

// #region demo
export const Primitives = () => {
  return (
    <div class="flex max-w-xl flex-col gap-4">
      <Typography.Heading level={1}>Dashboard</Typography.Heading>
      <Typography.Paragraph>
        Convenience primitives are thin wrappers over Typography, so you can choose explicit composition without learning a second styling system.
      </Typography.Paragraph>
      <Typography.Paragraph color="muted" size="sm">
        Paragraph supports base, sm, and xs sizes.
      </Typography.Paragraph>
      <Typography.Code>Typography.Code</Typography.Code>
    </div>
  );
};
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Primitives />
    </div>
  );
}
