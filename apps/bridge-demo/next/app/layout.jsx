// Next lane of apps/bridge-demo: the shell (layout, top bar) is a server component; nav + user menu are client
// components. Per-request rendering, like the Rivet lane.
import "../../site.css";
import { Nav } from "./nav.jsx";
import { UserMenu } from "./_client/user-menu.jsx";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ops dashboard" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <Nav prefetch={process.env.BD_PREFETCH !== "off"} />
          <div>
            <header className="top">
              <span>Acme Ops</span>
              <UserMenu name="Dana Kim" />
            </header>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
