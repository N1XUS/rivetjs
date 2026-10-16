// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/scroll-shadow/with-card.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { ScrollShadow } from "@rivetjs/ui/scroll-shadow";

export const head = { title: "ScrollShadow: With Card" };

// #region demo
export function WithCard() {
  return (
    <Card class="max-w-[400px]">
      <Card.Header>
        <Card.Title>Terms and Conditions</Card.Title>
        <Card.Description>Please review before proceeding</Card.Description>
      </Card.Header>
      <Card.Content class="p-0">
        <ScrollShadow class="h-[300px] px-4" size={80}>
          <div class="space-y-4">
            {Array.from({ length: 10 }).map(() => (
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam pulvinar risus non risus hendrerit venenatis. Pellentesque sit amet hendrerit
                risus, sed porttitor quam. Morbi accumsan cursus enim, sed ultricies sapien.
              </p>
            ))}
          </div>
        </ScrollShadow>
      </Card.Content>
      <Card.Footer class="mt-4 flex flex-row gap-2">
        <Button class="w-full" variant="secondary">
          Cancel
        </Button>
        <Button class="w-full">Accept</Button>
      </Card.Footer>
    </Card>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithCard />
    </div>
  );
}
