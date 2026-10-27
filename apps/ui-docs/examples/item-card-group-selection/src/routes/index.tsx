// Rivet-authored ItemCardGroup demo (Rivet addition; collection mode on the cdk GridList, own demo content).
import type { Selection as Keys } from "@rivetjs/cdk/collections/types";
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroupCollection } from "@rivetjs/ui/item-card-group-collection";
import { Building2, DatabaseBackup, KeyRound, Rocket, ShieldCheck, Users } from "lucide";

export const head = { title: "ItemCardGroup: Selection" };

// #region demo
const PLANS = [
  { id: "studio", name: "Studio", detail: "1 seat · 10 GB", icon: Rocket },
  { id: "team", name: "Team", detail: "10 seats · 200 GB", icon: Users },
  { id: "enterprise", name: "Enterprise", detail: "Unlimited seats · SSO", icon: Building2 },
];

const ADDONS = [
  { id: "backup", name: "Daily backups", detail: "Kept for 30 days", icon: DatabaseBackup },
  { id: "sso", name: "Single sign-on", detail: "SAML and OIDC", icon: KeyRound },
  { id: "audit", name: "Audit log", detail: "Every change, exportable", icon: ShieldCheck },
];

export function Selection() {
  const plan = signal<Keys>(new Set(["studio"]));
  const addons = signal<Keys>(new Set());
  const planName = () => {
    const keys = plan();
    const id = keys === "all" ? "" : [...keys][0];
    return PLANS.find((p) => p.id === id)?.name ?? "None";
  };
  const addonCount = () => {
    const keys = addons();
    return keys === "all" ? ADDONS.length : keys.size;
  };
  return (
    <div class="flex w-full max-w-md flex-col gap-6">
      <div class="flex flex-col gap-2">
        <ItemCardGroupCollection id="icg-plans" aria-label="Plan" selectionMode="single" disallowEmptySelection selectedKeys={plan}>
          {PLANS.map((p) => (
            <ItemCard id={p.id} textValue={p.name}>
              <ItemCard.Icon>
                <Icon icon={p.icon} size={18} />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title>{p.name}</ItemCard.Title>
                <ItemCard.Description>{p.detail}</ItemCard.Description>
              </ItemCard.Content>
            </ItemCard>
          ))}
        </ItemCardGroupCollection>
        <p id="icg-plan" class="text-sm text-muted">
          Plan: {planName()}
        </p>
      </div>
      <div class="flex flex-col gap-2">
        <ItemCardGroupCollection id="icg-addons" aria-label="Add-ons" variant="secondary" selectionMode="multiple" selectedKeys={addons}>
          {ADDONS.map((a) => (
            <ItemCard id={a.id} textValue={a.name}>
              <ItemCard.Icon>
                <Icon icon={a.icon} size={18} />
              </ItemCard.Icon>
              <ItemCard.Content>
                <ItemCard.Title>{a.name}</ItemCard.Title>
                <ItemCard.Description>{a.detail}</ItemCard.Description>
              </ItemCard.Content>
              <ItemCard.Action>
                <Checkbox slot="selection">
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                </Checkbox>
              </ItemCard.Action>
            </ItemCard>
          ))}
        </ItemCardGroupCollection>
        <p id="icg-addon-count" class="text-sm text-muted">
          {addonCount()} add-ons
        </p>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <Selection />
    </div>
  );
}
