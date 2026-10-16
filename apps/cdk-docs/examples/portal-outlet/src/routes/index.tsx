import { Outlet } from "../components/Outlet.tsx";

export const head = { title: "Portals and outlets" };

export default function Page() {
  return <Outlet />;
}
