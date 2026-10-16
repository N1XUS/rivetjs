import { Link } from "@rivetjs/cdk/link";

export const head = { title: "Link with Tailwind" };

// #region demo
const link =
  "rounded text-teal-700 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-teal-500 " +
  "data-[current]:font-semibold data-[current]:text-slate-900 data-[current]:no-underline " +
  "data-[disabled]:cursor-not-allowed data-[disabled]:text-slate-400 data-[pressed]:opacity-70";

export default function TailwindLinks() {
  return (
    <nav class="m-4 flex gap-4 text-sm" aria-label="Main">
      <Link id="tw-l-home" class={link} href="#home" aria-current="page">
        Home
      </Link>
      <Link class={link} href="#pricing">
        Pricing
      </Link>
      <Link id="tw-l-off" class={link} href="#beta" isDisabled>
        Beta
      </Link>
    </nav>
  );
}
// #endregion
