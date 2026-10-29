// Rivet-authored Navbar demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Navbar } from "@rivetjs/ui/navbar";
import { Hexagon } from "lucide";

export const head = { title: "Navbar: Compact" };

// #region demo
export function Compact() {
  return (
    <Navbar aria-label="Main" size="sm" height="3rem">
      <Navbar.Header>
        <Navbar.Brand>
          <Icon icon={Hexagon} size={22} />
          <span class="font-semibold">Northwind</span>
        </Navbar.Brand>
        <Navbar.Content>
          <Navbar.Item href="#inbox" isCurrent>
            Inbox
          </Navbar.Item>
          <Navbar.Item href="#sent">Sent</Navbar.Item>
          <Navbar.Item href="#archive">Archive</Navbar.Item>
        </Navbar.Content>
      </Navbar.Header>
    </Navbar>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="min-h-dvh">
      <Compact />
    </div>
  );
}
