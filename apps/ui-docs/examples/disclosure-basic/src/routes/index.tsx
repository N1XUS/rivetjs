// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/disclosure/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Apple, QrCode } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Disclosure } from "@rivetjs/ui/disclosure";
import qrCodeImage from "../assets/qr-code.png?image";

export const head = { title: "Disclosure: Usage" };

// #region demo
export function Basic() {
  // Rivet: a two-way signal replaces `useState` + `onExpandedChange={setIsExpanded}`.
  const isExpanded = signal(true);

  return (
    <div class="w-full max-w-md text-center">
      <Disclosure isExpanded={isExpanded}>
        <Disclosure.Heading>
          <Button slot="trigger" variant="secondary">
            <Icon icon={QrCode} />
            Preview Acme Mobile
            <Disclosure.Indicator />
          </Button>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body class="shadow-panel flex flex-col items-center rounded-3xl bg-surface p-4 text-center">
            <p class="text-sm text-muted">Scan this QR code with your camera app to preview the Acme mobile components.</p>
            <img alt="Expo Go QR Code" class="aspect-square w-full max-w-54 object-cover" src={qrCodeImage.src} />
            <p class="text-sm text-muted">Expo must be installed on your device.</p>
            <Button class="mt-4" variant="primary">
              <Icon icon={Apple} />
              Download on App Store
            </Button>
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
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
