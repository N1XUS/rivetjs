// In-memory contacts (server-only: this module never reaches the browser). Restarting the server resets them.
export interface Contact {
  id: number;
  name: string;
  email: string;
  company: string;
}

const SEED: Omit<Contact, "id">[] = [
  { name: "Ada Brooks", email: "ada@northwind.example", company: "Northwind" },
  { name: "Bruno Diaz", email: "bruno@lumen.example", company: "Lumen Labs" },
  { name: "Chen Wei", email: "chen@harbor.example", company: "Harbor & Co" },
  { name: "Dana Okafor", email: "dana@fieldnote.example", company: "Fieldnote" },
  { name: "Elif Kaya", email: "elif@quarry.example", company: "Quarry" },
];

let contacts: Contact[] = SEED.map((c, i) => ({ id: i + 1, ...c }));
let next = contacts.length + 1;

export const listContacts = (): Contact[] => contacts.map((c) => ({ ...c }));
export const getContact = (id: number): Contact | undefined => contacts.find((c) => c.id === id);
/** The contact that already uses `email` (case-insensitive), other than `except`. */
export const emailTaken = (email: string, except?: number): boolean => contacts.some((c) => c.id !== except && c.email.toLowerCase() === email.toLowerCase());

export function createContact(input: Omit<Contact, "id">): Contact {
  const contact = { id: next++, ...input };
  contacts.push(contact);
  return contact;
}

export function updateContact(id: number, input: Omit<Contact, "id">): boolean {
  const contact = getContact(id);
  if (!contact) return false;
  Object.assign(contact, input);
  return true;
}

export function deleteContact(id: number): boolean {
  const before = contacts.length;
  contacts = contacts.filter((c) => c.id !== id);
  return contacts.length < before;
}
