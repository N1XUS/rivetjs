import { Link } from "@rivetjs/router/client";

export const head = { title: "Other" };

export default function Other() {
  return (
    <section>
      <h1 id="other">Other</h1>
      <Link id="to-overlays" to="/overlays">
        Overlays
      </Link>
    </section>
  );
}
