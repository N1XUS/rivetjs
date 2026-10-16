// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/card/default.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { CircleDollarSign } from "lucide";
import { Card } from "@rivetjs/ui/card";
import { Link } from "@rivetjs/ui/link";

export const head = { title: "Card: Usage" };

// #region demo
export function Default() {
  return (
    <Card class="w-[400px]">
      <Icon icon={CircleDollarSign} size={16} aria-label="Dollar sign icon" class="text-primary size-6" role="img" />
      <Card.Header>
        <Card.Title>Become an Acme Creator!</Card.Title>
        <Card.Description>Visit the Acme Creator Hub to sign up today and start earning credits from your fans and followers.</Card.Description>
      </Card.Header>
      <Card.Footer>
        <Link aria-label="Go to Acme Creator Hub (opens in new tab)" href="https://rivetjs.dev" rel="noopener noreferrer" target="_blank">
          Creator Hub
          <Link.Icon aria-hidden="true" />
        </Link>
      </Card.Footer>
    </Card>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Default />
    </div>
  );
}
