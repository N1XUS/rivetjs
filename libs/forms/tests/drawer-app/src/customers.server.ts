// In-memory customers (per server process). Server-only: the page's loader and action import it.
export type Customer = { id: number; name: string; email: string };

const customers: Customer[] = [
  { id: 1, name: "Ada Lovelace", email: "ada@example.com" },
  { id: 2, name: "Grace Hopper", email: "grace@example.com" },
];
let next = 3;

export const list = (): Customer[] => customers.map((customer) => ({ ...customer }));
export const taken = (email: string): boolean => customers.some((customer) => customer.email === email.toLowerCase());
export function add(name: string, email: string): Customer {
  const customer = { id: next++, name, email: email.toLowerCase() };
  customers.push(customer);
  return customer;
}
