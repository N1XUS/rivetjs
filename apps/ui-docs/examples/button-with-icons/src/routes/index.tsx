// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/with-icons.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Mail, Globe, Plus, Trash2 } from "lucide";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "Button: With Icons" };

// #region demo
export function WithIcons() {
  return (
    <div class="flex flex-wrap gap-3">
      <Button>
        <Icon icon={Globe} size={16} />
        Search
      </Button>
      <Button variant="secondary">
        <Icon icon={Plus} size={16} />
        Add Member
      </Button>
      <Button variant="tertiary">
        <Icon icon={Mail} size={16} />
        Email
      </Button>
      <Button variant="danger">
        <Icon icon={Trash2} size={16} />
        Delete
      </Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithIcons />
    </div>
  );
}
