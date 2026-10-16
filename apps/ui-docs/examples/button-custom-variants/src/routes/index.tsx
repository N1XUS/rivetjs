// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/button/custom-variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import type { ButtonProps } from "@rivetjs/ui/button";
import type { VariantProps } from "tailwind-variants";

import { splitProps } from "@rivetjs/runtime/props";
import { Button, buttonVariants } from "@rivetjs/ui/button";
import { tv } from "tailwind-variants";

export const head = { title: "Button: Adding custom variants" };

// #region demo
const myButtonVariants = tv({
  base: "text-md font-semibold shadow-md text-shadow-lg data-[pending=true]:opacity-40",
  defaultVariants: {
    radius: "full",
    variant: "primary",
  },
  extend: buttonVariants,
  variants: {
    radius: {
      full: "rounded-full",
      lg: "rounded-lg",
      md: "rounded-md",
      sm: "rounded-sm",
    },
    size: {
      lg: "h-12 px-8",
      md: "h-11 px-6",
      sm: "h-10 px-4",
      xl: "h-13 px-10",
    },
    variant: {
      primary: "text-white dark:bg-white/10 dark:text-white dark:hover:bg-white/15",
    },
  },
});

type MyButtonVariants = VariantProps<typeof myButtonVariants>;
export type MyButtonProps = Omit<ButtonProps, "class" | "size" | "variant"> & MyButtonVariants & { class?: string };

// Rivet: `splitProps` instead of a destructure (a destructure reads the props once).
function CustomButton(props: MyButtonProps) {
  const [local, rest] = splitProps(props, ["class", "radius", "variant"]);
  return <Button class={myButtonVariants({ class: local.class, radius: local.radius, variant: local.variant })} {...(rest as ButtonProps)} />;
}

export function CustomVariants() {
  return <CustomButton>Custom Button</CustomButton>;
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomVariants />
    </div>
  );
}
