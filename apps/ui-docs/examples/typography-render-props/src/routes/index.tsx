// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/typography/render-props.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Typography } from "@rivetjs/ui/typography";

export const head = { title: "Typography: Render Props" };

// #region demo
// Rivet: the render function receives the element's attributes with `children` included; spread them onto the element.
export const RenderProps = () => {
  return (
    <div class="flex max-w-xl flex-col gap-4">
      <Typography render={(domProps) => <h2 {...domProps} />} type="h1">
        H1 visual style, h2 semantic element
      </Typography>
      <Typography render={(domProps) => <span {...domProps} />}>
        The render prop can swap the underlying element while preserving Rivet UI props and styles.
      </Typography>
    </div>
  );
};
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderProps />
    </div>
  );
}
