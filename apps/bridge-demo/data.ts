// Seeded demo data shared by both lanes (deterministic: same bytes on every build and request).
export type Status = "paid" | "pending" | "refunded" | "failed";
export interface Order {
  id: string;
  customer: string;
  email: string;
  status: Status;
  total: number;
  items: number;
  date: string;
}

const FIRST = ["Ada", "Ben", "Cleo", "Dev", "Eli", "Fay", "Gus", "Hana", "Ivo", "Jun", "Kai", "Lea", "Max", "Nia", "Oto", "Pia"];
const LAST = ["Stone", "Rivera", "Okafor", "Novak", "Lind", "Kaur", "Ishii", "Hale", "Garcia", "Fox", "Evans", "Diaz"];
const STATUSES: Status[] = ["paid", "paid", "paid", "pending", "refunded", "failed"];

let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T>(list: readonly T[]) => list[Math.floor(random() * list.length)]!;

export const orders: Order[] = Array.from({ length: 500 }, (_, i) => {
  const first = pick(FIRST);
  const last = pick(LAST);
  const day = 1 + Math.floor(random() * 28);
  const month = 1 + Math.floor(random() * 12);
  return {
    id: "ORD-" + String(10001 + i),
    customer: first + " " + last,
    email: (first + "." + last).toLowerCase() + "@example.com",
    status: pick(STATUSES),
    total: Math.round(random() * 90000 + 1500) / 100,
    items: 1 + Math.floor(random() * 6),
    date: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
});

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const revenue = MONTHS.map((month, i) => {
  const inMonth = orders.filter((order) => Number(order.date.slice(5, 7)) === i + 1);
  const sum = (status: Status) => Math.round(inMonth.filter((o) => o.status === status).reduce((total, o) => total + o.total, 0));
  return { month, paid: sum("paid"), refunded: sum("refunded") };
});

const paid = orders.filter((order) => order.status === "paid");
export const kpis = [
  { label: "Revenue", value: "$" + Math.round(paid.reduce((total, o) => total + o.total, 0)).toLocaleString("en-US") },
  { label: "Orders", value: orders.length.toLocaleString("en-US") },
  { label: "Avg. order", value: "$" + (paid.reduce((total, o) => total + o.total, 0) / paid.length).toFixed(2) },
  { label: "Refund rate", value: ((orders.filter((o) => o.status === "refunded").length / orders.length) * 100).toFixed(1) + "%" },
];
export const recent = [...orders].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);

export const NAV = [
  { href: "/", label: "Overview" },
  { href: "/orders", label: "Orders" },
  { href: "/orders/new", label: "New order" },
];
