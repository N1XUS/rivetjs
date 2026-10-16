import { Announce } from "../components/Announce.tsx";

export const head = { title: "Overlay service: global position" };

export default function Page() {
  return (
    <section class="m-4 grid justify-items-start gap-3 text-sm">
      <Announce />
    </section>
  );
}
