// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/disclosure-group/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Apple, QrCode, Smartphone } from "lucide";
import { cn } from "tailwind-variants";
import { Button } from "@rivetjs/ui/button";
import { Disclosure } from "@rivetjs/ui/disclosure";
import { DisclosureGroup } from "@rivetjs/ui/disclosure-group";
import { Separator } from "@rivetjs/ui/separator";
import qrCodeImage from "../assets/qr-code.png?image";

export const head = { title: "DisclosureGroup: Usage" };

// #region demo
export function Basic() {
  // Rivet: a two-way signal replaces `useState` + `onExpandedChange={setExpandedKeys}`.
  const expandedKeys = signal(new Set<string | number>(["preview"]));

  return (
    <div class="w-full max-w-md">
      <div class="flex flex-col gap-4 bg-transparent p-4">
        <DisclosureGroup expandedKeys={expandedKeys}>
          <Disclosure aria-label="Preview Acme Mobile" id="preview">
            <Disclosure.Heading>
              <Button
                slot="trigger"
                variant={expandedKeys().has("preview") ? "secondary" : "tertiary"}
                class={cn("w-full border-none", {
                  "bg-transparent": !expandedKeys().has("preview"),
                })}
              >
                <div class="flex w-full items-center justify-start gap-2">
                  <Icon icon={QrCode} />
                  Preview Acme Mobile
                </div>
                <Disclosure.Indicator class="text-muted" />
              </Button>
            </Disclosure.Heading>
            <Disclosure.Content>
              <Disclosure.Body class="mx-2 flex flex-col items-center gap-2 p-4 text-center">
                <p class="text-sm text-muted">Scan this QR code with your camera app to preview the Acme mobile components.</p>
                <img alt="Expo Go QR Code" class="aspect-square w-full max-w-54 object-cover" src={qrCodeImage.src} />
                <p class="text-sm text-muted">Expo must be installed on your device.</p>
                <Button class="mt-4" variant="primary">
                  <Icon icon={Smartphone} />
                  Preview on Expo Go
                </Button>
              </Disclosure.Body>
            </Disclosure.Content>
          </Disclosure>
          <Separator class="my-2" />
          <Disclosure id="download">
            <Disclosure.Heading aria-label="Download Acme Mobile">
              <Button
                slot="trigger"
                variant={expandedKeys().has("download") ? "secondary" : "tertiary"}
                class={cn("w-full border-none", {
                  "bg-transparent": !expandedKeys().has("download"),
                })}
              >
                <div class="flex w-full items-center justify-start gap-2">
                  <Icon icon={Apple} />
                  Download App
                </div>
                <Disclosure.Indicator class="text-muted" />
              </Button>
            </Disclosure.Heading>
            <Disclosure.Content>
              <Disclosure.Body class="mx-2 flex flex-col items-center gap-2 p-4 text-center">
                <p class="text-sm text-muted">Download the Acme mobile app to explore our mobile components directly on your device.</p>
                <img alt="App Store QR Code" class="aspect-square w-full max-w-54 object-cover" src={qrCodeImage.src} />
                <p class="text-sm text-muted">Available on iOS and Android devices.</p>
                <Button class="mt-4" variant="primary">
                  <Icon icon={Apple} />
                  Download on App Store
                </Button>
              </Disclosure.Body>
            </Disclosure.Content>
          </Disclosure>
        </DisclosureGroup>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
