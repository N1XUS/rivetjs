import { RadioGroup } from "@rivetjs/cdk/radio-group";

export const head = { title: "Disabled and read-only RadioGroup" };

const shipping = [
  { value: "post", label: "Post" },
  { value: "drone", label: "Drone", isDisabled: true },
  { value: "pickup", label: "Pickup" },
];

// #region demo
export default function Shipping() {
  return (
    <section class="m-4 grid max-w-md gap-4 text-sm">
      <RadioGroup id="ship" label="Shipping" items={shipping} defaultValue="post" />
      <RadioGroup id="ship-off" label="Disabled group" items={shipping} defaultValue="post" isDisabled />
      <RadioGroup id="ship-ro" label="Read-only group" items={shipping} defaultValue="post" isReadOnly />
    </section>
  );
}
// #endregion
