import { signal } from "@rivetjs/reactivity";
import { Motion } from "@rivetjs/motion";
import { Heart } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Motion gestures" };

// #region demo
export default function Gestures() {
  const likes = signal(0);
  return (
    <div class="m-4 flex items-center gap-4">
      <Motion.button
        id="like"
        type="button"
        class="flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2 font-semibold text-white outline-none"
        whileHover={{ scale: 1.06 }}
        whilePress={{ scale: 0.94 }}
        whileFocus={{ boxShadow: "0 0 0 3px rgb(244 63 94 / 0.45)" }}
        transition={{ duration: 0.15 }}
        // A successful press: pointer released over the button, or Enter / Space.
        onPress={() => likes.update((n) => n + 1)}
      >
        <Icon icon={Heart} />
        Like
      </Motion.button>
      <span id="likes" class="text-slate-700">
        {likes()} {likes() === 1 ? "like" : "likes"}
      </span>
    </div>
  );
}
// #endregion
