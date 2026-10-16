// Type-level tests, checked by `tsc -p libs/ui`: Typography parts and variant unions.
import { Typography } from "../src/components/typography/index.ts";

export const Text = () => (
  <>
    <Typography type="body-xs" color="muted" weight="semibold" align="end" truncate>
      t
    </Typography>
    <Typography.Heading level={2} class="x">
      h
    </Typography.Heading>
    <Typography.Paragraph size="sm">p</Typography.Paragraph>
    <Typography.Code>c</Typography.Code>
    <Typography.Prose id="p1" onClick={(e) => void e.currentTarget.tagName}>
      x
    </Typography.Prose>
  </>
);

// @ts-expect-error bad type
export const BadType = () => <Typography type="h7">x</Typography>;
// @ts-expect-error bad heading level
export const BadLevel = () => <Typography.Heading level={7}>x</Typography.Heading>;
