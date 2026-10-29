// Rivet-authored Navbar demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Navbar } from "@rivetjs/ui/navbar";

export const head = { title: "Navbar: Positioning" };

// #region demo
const POSITIONS = ["static", "floating", "sticky"] as const;

export function Positioning() {
  return (
    <div class="flex flex-col gap-6 py-6">
      {POSITIONS.map((position) => (
        <Navbar aria-label={`${position} bar`} position={position}>
          <Navbar.Header>
            <span class="font-semibold capitalize">{position}</span>
            <Navbar.Spacer />
            <Navbar.Content>
              <Navbar.Item href={`#${position}-a`}>Docs</Navbar.Item>
              <Navbar.Item href={`#${position}-b`}>Blog</Navbar.Item>
            </Navbar.Content>
          </Navbar.Header>
        </Navbar>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <Positioning />
    </div>
  );
}
