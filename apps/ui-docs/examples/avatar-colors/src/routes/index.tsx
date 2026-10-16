// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/avatar/colors.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Avatar } from "@rivetjs/ui/avatar";

export const head = { title: "Avatar: Colors" };

// #region demo
export function Colors() {
  return (
    <div class="flex items-center gap-4">
      <Avatar color="default">
        <Avatar.Fallback>DF</Avatar.Fallback>
      </Avatar>
      <Avatar color="accent">
        <Avatar.Fallback>AC</Avatar.Fallback>
      </Avatar>
      <Avatar color="success">
        <Avatar.Fallback>SC</Avatar.Fallback>
      </Avatar>
      <Avatar color="warning">
        <Avatar.Fallback>WR</Avatar.Fallback>
      </Avatar>
      <Avatar color="danger">
        <Avatar.Fallback>DG</Avatar.Fallback>
      </Avatar>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Colors />
    </div>
  );
}
