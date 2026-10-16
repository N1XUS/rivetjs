// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/dropdown/with-custom-submenu-indicator.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { ArrowRight, ChevronRight } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "Dropdown: With Custom Submenu Indicator" };

// #region demo
export function WithCustomSubmenuIndicator() {
  return (
    <Dropdown>
      <Button aria-label="Menu" variant="secondary">
        Share
      </Button>
      <Dropdown.Menu onAction={(key) => console.log(`Selected: ${key}`)}>
        <Dropdown.Item id="copy-link">Copy Link</Dropdown.Item>
        <Dropdown.Item id="facebook">Facebook</Dropdown.Item>
        <Dropdown.SubmenuTrigger>
          <Dropdown.Item id="share" textValue="Share">
            <Label>More options</Label>
            <Dropdown.SubmenuIndicator>
              <Icon icon={ArrowRight} size={16} class="size-3.5 text-muted" />
            </Dropdown.SubmenuIndicator>
          </Dropdown.Item>
          <Dropdown.Menu>
            <Dropdown.Item id="whatsapp">WhatsApp</Dropdown.Item>
            <Dropdown.Item id="telegram">Telegram</Dropdown.Item>
            <Dropdown.SubmenuTrigger>
              <Dropdown.Item id="email" textValue="Email">
                <Label>Email</Label>
                <Dropdown.SubmenuIndicator>
                  {/* Rivet: lucide `ChevronRight` (upstream: the same chevron as an inline svg). */}
                  <Icon class="size-3.5 text-muted" icon={ChevronRight} />
                </Dropdown.SubmenuIndicator>
              </Dropdown.Item>
              <Dropdown.Menu>
                <Dropdown.Item id="work">Work email</Dropdown.Item>
                <Dropdown.Item id="personal">Personal email</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.SubmenuTrigger>
            <Dropdown.Item id="discord">Discord</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.SubmenuTrigger>
        <Dropdown.SubmenuTrigger>
          <Dropdown.Item id="other" textValue="Other">
            <Label>Other (default indicator)</Label>
            <Dropdown.SubmenuIndicator />
          </Dropdown.Item>
          <Dropdown.Menu>
            <Dropdown.Item id="sms">SMS</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.SubmenuTrigger>
      </Dropdown.Menu>
    </Dropdown>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithCustomSubmenuIndicator />
    </div>
  );
}
