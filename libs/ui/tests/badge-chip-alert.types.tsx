// Type-level tests, checked by `tsc -p libs/ui`: Badge / Chip / Alert keep HeroUI's generic parts + variant unions.
import { Alert } from "../src/components/alert/index.ts";
import { Badge } from "../src/components/badge/index.ts";
import { Chip } from "../src/components/chip/index.ts";

export const Wave = () => (
  <>
    <Badge.Anchor ref={(el: HTMLElement) => void el}>
      <Badge color="accent" placement="top-left" size="lg" variant="secondary" class="x">
        1
      </Badge>
    </Badge.Anchor>
    <Chip color="warning" size="sm" variant="tertiary" ref={(el: HTMLElement) => void el}>
      <Chip.Label>l</Chip.Label>
    </Chip>
    <Alert status="warning" ref={(el: HTMLElement) => void el}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title<"h4"> ref={(el: HTMLHeadingElement) => void el}>t</Alert.Title>
        <Alert.Description>d</Alert.Description>
      </Alert.Content>
    </Alert>
  </>
);

// @ts-expect-error bad chip color
export const BadColor = () => <Chip color="nope">x</Chip>;
// @ts-expect-error bad alert status
export const BadStatus = () => <Alert status="nope">x</Alert>;
