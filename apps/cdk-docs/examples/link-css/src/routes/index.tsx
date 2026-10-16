import { Link } from "@rivetjs/cdk/link";

export const head = { title: "Link with plain CSS" };

// #region demo
export default function CssLinks() {
  return (
    <nav class="demo" aria-label="Steps">
      <Link href="#cart">Cart</Link>
      <Link id="css-l-now" href="#shipping" aria-current="step">
        Shipping
      </Link>
      <Link href="#pay" isDisabled>
        Payment
      </Link>
    </nav>
  );
}
// #endregion
