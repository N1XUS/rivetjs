// Type-level tests, checked by `tsc -p libs/ui`: Link / Button / CloseButton take the cdk part props + HeroUI variants.
import { Button } from "../src/components/button/index.ts";
import { CloseButton } from "../src/components/close-button/index.ts";
import { Link } from "../src/components/link/index.ts";

export const Controls = () => (
  <>
    <Button variant="danger-soft" size="sm" isIconOnly fullWidth isDisabled={() => false} isPending={() => true} onPress={(e) => void e.pointerType}>
      {({ isPending }) => (isPending() ? "…" : "go")}
    </Button>
    <Button render={(props) => <a {...(props as {})} href="#" />}>a</Button>
    <CloseButton variant="default" onPress={() => {}} />
    <Link href="/x" target="_blank" class={({ isHovered }) => (isHovered() ? "a" : "b")}>
      l <Link.Icon class="i" />
    </Link>
  </>
);

// @ts-expect-error bad button variant
export const BadVariant = () => <Button variant="nope">x</Button>;
// @ts-expect-error bad button size
export const BadSize = () => <Button size="xl">x</Button>;
