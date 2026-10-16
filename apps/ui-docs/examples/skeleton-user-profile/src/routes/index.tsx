// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/skeleton/user-profile.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Skeleton } from "@rivetjs/ui/skeleton";

export const head = { title: "Skeleton: User Profile" };

// #region demo
export function UserProfile() {
  return (
    <div class="flex items-center gap-3">
      <Skeleton class="h-10 w-10 shrink-0 rounded-full" />
      <div class="flex-1 space-y-2">
        <Skeleton class="h-3 w-36 rounded-lg" />
        <Skeleton class="h-3 w-24 rounded-lg" />
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <UserProfile />
    </div>
  );
}
