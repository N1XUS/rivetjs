import { DatabaseSync } from "node:sqlite";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { safeRedirect } from "@rivetjs/router";

export interface User {
  id: string;
  tenant: string;
  name: string;
  email: string;
  role: string;
}
export interface Product {
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  description: string;
}
export interface Cart {
  version: number;
  items: { product: Product; quantity: number }[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  coupon: string;
}
export interface Order {
  id: string;
  user: string;
  items: Cart["items"];
  total: number;
  created: string;
}
export interface Ticket {
  id: string;
  tenant: string;
  title: string;
  status: string;
  version: number;
  owner: string;
}
export interface Message {
  id: string;
  ticket: string;
  author: string;
  body: string;
  created: string;
}
export interface Draft {
  tenant: string;
  title: string;
  body: string;
  version: number;
}
export interface Article {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  body: string;
}
export class Fault extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const path = resolve(process.env.OPERATIONS_DB ?? ".artifacts/operations.sqlite");
mkdirSync(dirname(path), { recursive: true });
const registry = globalThis as unknown as Record<symbol, DatabaseSync>;
const key = Symbol.for("rivet.lab.real-sites.database");
const db = (registry[key] ??= new DatabaseSync(path));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,tenant TEXT,name TEXT,email TEXT UNIQUE,role TEXT,hash TEXT);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user TEXT,expires INTEGER);
CREATE TABLE IF NOT EXISTS products(sku TEXT PRIMARY KEY,name TEXT,category TEXT,price INTEGER,stock INTEGER,description TEXT);
CREATE TABLE IF NOT EXISTS carts(user TEXT PRIMARY KEY,version INTEGER,data TEXT,coupon TEXT);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user TEXT,key TEXT,data TEXT,UNIQUE(user,key));
CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY,tenant TEXT,title TEXT,status TEXT,version INTEGER,owner TEXT);
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,ticket TEXT,author TEXT,body TEXT,created TEXT);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,tenant TEXT,ticket TEXT,body TEXT);
CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,tenant TEXT,ticket TEXT,name TEXT,type TEXT,data BLOB);
CREATE TABLE IF NOT EXISTS drafts(tenant TEXT PRIMARY KEY,title TEXT,body TEXT,version INTEGER);`);
const digest = (password: string) => scryptSync(password, "rivet-local-synthetic-fixture", 32);
const fixtureHash = digest("demo-pass-2026").toString("hex");
for (const [id, tenant, name, email, role] of [
  ["alice", "alpha", "Alice Morgan", "alice@alpha.test", "agent"],
  ["bob", "beta", "Bob Chen", "bob@beta.test", "agent"],
  ["viewer", "alpha", "Olivia Read", "viewer@alpha.test", "viewer"],
  ["admin", "alpha", "Sam Admin", "admin@alpha.test", "admin"],
  ["editor", "alpha", "Jules Editor", "editor@alpha.test", "editor"],
])
  db.prepare("INSERT OR IGNORE INTO users VALUES(?,?,?,?,?,?)").run(id, tenant, name, email, role, fixtureHash);
const names = ["Canvas field bag", "Studio notebook", "Travel tumbler", "Desk organizer", "Workshop apron", "Mechanical pencil", "Merino cap", "Portable lamp"];
for (let i = 1; i <= 24; i++)
  db.prepare("INSERT OR IGNORE INTO products VALUES(?,?,?,?,?,?)").run(
    `sku-${i}`,
    `${names[(i - 1) % names.length]} ${Math.ceil(i / 8)}`,
    ["Equipment", "Workspace", "Wear"][(i - 1) % 3],
    1499 + i * 125,
    i === 24 ? 1 : 25,
    `Made for everyday work. Durable materials, considered details, and a two-year repair promise.`,
  );
for (const tenant of ["alpha", "beta"]) {
  for (let i = 1; i <= 6; i++)
    db.prepare("INSERT OR IGNORE INTO tickets VALUES(?,?,?,?,?,?)").run(
      `${tenant}-${i}`,
      tenant,
      `${["Cannot access workspace", "Invoice adjustment", "Export request", "Sync interrupted", "New teammate setup", "Account review"][i - 1]}`,
      i === 2 ? "pending" : "open",
      0,
      tenant === "alpha" ? "alice" : "bob",
    );
  db.prepare("INSERT OR IGNORE INTO drafts VALUES(?,?,?,?)").run(tenant, "October operations update", "A private working draft for the team.", 0);
}
const userView = (row: any): User => ({ id: row.id, tenant: row.tenant, name: row.name, email: row.email, role: row.role });
export function authenticate(email: string, password: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE email=?").get(email) as any;
  const expected = Buffer.from(row?.hash ?? fixtureHash, "hex"),
    actual = digest(password);
  return timingSafeEqual(expected, actual) && row ? userView(row) : null;
}
export function createSession(user: User, seconds = 3600): string {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(token, user.id, Date.now() + seconds * 1000);
  return token;
}
export function sessionUser(token: string | undefined): User | null {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const row = db.prepare("SELECT u.* FROM users u JOIN sessions s ON s.user=u.id WHERE s.token=? AND s.expires>?").get(token, Date.now()) as any;
  return row ? userView(row) : null;
}
export function revokeSession(token: string | undefined) {
  if (token) db.prepare("DELETE FROM sessions WHERE token=?").run(token);
}
export function requireUser(token: string | undefined): User {
  const user = sessionUser(token);
  if (!user) throw new Fault(401, "Sign in required");
  return user;
}
export function requireRole(user: User, roles: string[]) {
  if (!roles.includes(user.role)) throw new Fault(403, "Your role cannot perform this action");
}
function fields(value: unknown, allowed: string[]): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Fault(400, "Object required");
  const body = value as Record<string, any>;
  for (const k of Object.keys(body)) if (!allowed.includes(k)) throw new Fault(400, `Unexpected field: ${k}`);
  return body;
}
function text(value: unknown, max: number) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Fault(400, "Invalid text");
  return value;
}
function version(actual: number, input: unknown) {
  if (!Number.isInteger(input) || input !== actual) throw new Fault(409, "This record changed in another tab. Reload before saving.");
}
export function catalog(q = "", category = "All", sort = "name"): Product[] {
  const rows = db.prepare("SELECT * FROM products").all() as unknown as Product[];
  return rows
    .filter((p) => (category === "All" || p.category === category) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sort === "price" ? a.price - b.price : a.name.localeCompare(b.name)));
}
export function productFor(sku: string): Product | null {
  return (db.prepare("SELECT * FROM products WHERE sku=?").get(sku) as unknown as Product) ?? null;
}
export function cartFor(user: User): Cart {
  const row = db.prepare("SELECT * FROM carts WHERE user=?").get(user.id) as any;
  const quantities: Record<string, number> = row ? JSON.parse(row.data) : {};
  const items = Object.entries(quantities).map(([sku, quantity]) => ({ product: productFor(sku)!, quantity }));
  const subtotal = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    discount = row?.coupon === "DEMO10" ? Math.floor(subtotal / 10) : 0,
    shipping = subtotal === 0 || subtotal - discount >= 10000 ? 0 : 500;
  return { version: row?.version ?? 0, items, subtotal, discount, shipping, total: subtotal - discount + shipping, coupon: row?.coupon ?? "" };
}
export function setCart(user: User, input: unknown) {
  const body = fields(input, ["version", "sku", "quantity", "coupon"]),
    cart = cartFor(user);
  version(cart.version, body.version);
  if (typeof body.sku !== "string" || !productFor(body.sku)) throw new Fault(404, "Product not found");
  if (!Number.isInteger(body.quantity) || body.quantity < 0 || body.quantity > 20) throw new Fault(400, "Quantity must be between 0 and 20");
  if (body.coupon !== undefined && !["", "DEMO10"].includes(body.coupon)) throw new Fault(400, "Unknown promotion code");
  const quantities = Object.fromEntries(cart.items.map((i) => [i.product.sku, i.quantity]));
  if (body.quantity === 0) delete quantities[body.sku];
  else quantities[body.sku] = body.quantity;
  db.prepare("INSERT INTO carts VALUES(?,?,?,?) ON CONFLICT(user) DO UPDATE SET version=excluded.version,data=excluded.data,coupon=excluded.coupon").run(
    user.id,
    cart.version + 1,
    JSON.stringify(quantities),
    body.coupon ?? cart.coupon,
  );
  return cartFor(user);
}
export function checkout(user: User, input: unknown): Order {
  const body = fields(input, ["version", "key"]);
  text(body.key, 120);
  db.exec("BEGIN IMMEDIATE");
  try {
    const previous = db.prepare("SELECT data FROM orders WHERE user=? AND key=?").get(user.id, body.key) as any;
    if (previous) {
      db.exec("COMMIT");
      return JSON.parse(previous.data) as Order;
    }
    const cart = cartFor(user);
    version(cart.version, body.version);
    if (!cart.items.length) throw new Fault(400, "Your cart is empty");
    for (const item of cart.items) {
      const p = productFor(item.product.sku)!;
      if (p.stock < item.quantity) throw new Fault(409, `${p.name} has insufficient stock`);
    }
    for (const item of cart.items) db.prepare("UPDATE products SET stock=stock-? WHERE sku=?").run(item.quantity, item.product.sku);
    const order = { id: randomUUID(), user: user.id, items: cart.items, total: cart.total, created: new Date().toISOString() };
    db.prepare("INSERT INTO orders VALUES(?,?,?,?)").run(order.id, user.id, body.key, JSON.stringify(order));
    db.prepare("INSERT INTO carts VALUES(?,?,?,?) ON CONFLICT(user) DO UPDATE SET version=excluded.version,data=excluded.data,coupon=excluded.coupon").run(
      user.id,
      cart.version + 1,
      "{}",
      "",
    );
    db.exec("COMMIT");
    return order;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
export function ordersFor(user: User): Order[] {
  return db
    .prepare("SELECT data FROM orders WHERE user=? ORDER BY rowid DESC")
    .all(user.id)
    .map((r: any) => JSON.parse(r.data));
}
export function orderFor(user: User, id: string): Order | null {
  const row = db.prepare("SELECT data FROM orders WHERE user=? AND id=?").get(user.id, id) as any;
  return row ? JSON.parse(row.data) : null;
}
export function ticketsFor(user: User, q = "", status = "all") {
  return (db.prepare("SELECT * FROM tickets WHERE tenant=? ORDER BY id").all(user.tenant) as unknown as Ticket[]).filter(
    (t) => t.title.toLowerCase().includes(q.toLowerCase()) && (status === "all" || t.status === status),
  );
}
export function ticketFor(user: User, id: string): Ticket | null {
  return (db.prepare("SELECT * FROM tickets WHERE id=? AND tenant=?").get(id, user.tenant) as unknown as Ticket) ?? null;
}
export function updateTicket(user: User, id: string, input: unknown) {
  const current = ticketFor(user, id);
  if (!current) throw new Fault(404, "Ticket not found");
  requireRole(user, ["agent", "admin"]);
  const body = fields(input, ["version", "title", "status"]);
  version(current.version, body.version);
  if (body.title !== undefined) text(body.title, 200);
  if (body.status !== undefined && !["open", "pending", "closed"].includes(body.status)) throw new Fault(400, "Invalid status");
  db.prepare("UPDATE tickets SET title=?,status=?,version=version+1 WHERE id=? AND tenant=?").run(
    body.title ?? current.title,
    body.status ?? current.status,
    id,
    user.tenant,
  );
  return ticketFor(user, id)!;
}
export function messagesFor(user: User, id: string): Message[] {
  if (!ticketFor(user, id)) throw new Fault(404, "Ticket not found");
  return db.prepare("SELECT * FROM messages WHERE ticket=? ORDER BY rowid").all(id) as unknown as Message[];
}
export function addMessage(user: User, id: string, body: unknown) {
  if (!ticketFor(user, id)) throw new Fault(404, "Ticket not found");
  requireRole(user, ["agent", "admin"]);
  const message = { id: randomUUID(), ticket: id, author: user.name, body: text(body, 4000), created: new Date().toISOString() };
  db.prepare("INSERT INTO messages VALUES(?,?,?,?,?)").run(message.id, id, user.name, message.body, message.created);
  db.prepare("INSERT INTO events(tenant,ticket,body) VALUES(?,?,?)").run(user.tenant, id, JSON.stringify(message));
  return message;
}
export function eventsFor(user: User, after: number) {
  return db.prepare("SELECT * FROM events WHERE tenant=? AND id>? ORDER BY id LIMIT 100").all(user.tenant, after) as {
    id: number;
    tenant: string;
    ticket: string;
    body: string;
  }[];
}
export function draftFor(user: User): Draft {
  return db.prepare("SELECT * FROM drafts WHERE tenant=?").get(user.tenant) as unknown as Draft;
}
export function saveDraft(user: User, input: unknown): Draft {
  requireRole(user, ["agent", "editor", "admin"]);
  const body = fields(input, ["version", "title", "body"]),
    current = draftFor(user);
  version(current.version, body.version);
  text(body.title, 200);
  if (typeof body.body !== "string" || body.body.length > 100000) throw new Fault(400, "Invalid draft body");
  db.prepare("UPDATE drafts SET title=?,body=?,version=version+1 WHERE tenant=?").run(body.title, body.body, user.tenant);
  return draftFor(user);
}
export function addFile(user: User, ticket: string, name: string, type: string, data: Uint8Array) {
  if (!ticketFor(user, ticket)) throw new Fault(404, "Ticket not found");
  requireRole(user, ["agent", "admin"]);
  if (!/^[A-Za-z0-9 _.-]+\.(txt|md)$/.test(name) || name.includes("..") || !["text/plain", "text/markdown"].includes(type) || data.byteLength > 65536)
    throw new Fault(400, "Only small plain-text attachments with safe filenames are accepted");
  const file = { id: randomUUID(), tenant: user.tenant, ticket, name, type };
  db.prepare("INSERT INTO files VALUES(?,?,?,?,?,?)").run(file.id, user.tenant, ticket, name, type, Buffer.from(data));
  return file;
}
export function filesFor(user: User, ticket: string) {
  if (!ticketFor(user, ticket)) throw new Fault(404, "Ticket not found");
  return db.prepare("SELECT id,name,type FROM files WHERE tenant=? AND ticket=?").all(user.tenant, ticket) as { id: string; name: string; type: string }[];
}
export function fileFor(user: User, id: string) {
  return (
    (db.prepare("SELECT * FROM files WHERE tenant=? AND id=?").get(user.tenant, id) as {
      id: string;
      tenant: string;
      ticket: string;
      name: string;
      type: string;
      data: Uint8Array;
    }) ?? null
  );
}
const articles: Article[] = Array.from({ length: 36 }, (_, i) => ({
  slug: `dispatch-${i + 1}`,
  title: `${["Security", "Design", "Engineering"][i % 3]} notes: ${["A quieter workspace", "Trust across teams", "Tools that last", "The monthly field guide"][i % 4]} ${i + 1}`,
  category: ["Security", "Design", "Engineering"][i % 3],
  excerpt: "Practical observations from teams building dependable digital products.",
  body: `Good tools make their behavior understandable. This edition follows a team from the first sketch to a reliable launch.\n\nPermissions, durable state, and clear recovery paths are part of the product experience. Article ${i + 1}.`,
}));
export function articlePage(input: { q?: string; page?: number; category?: string }) {
  const filtered = articles.filter(
    (a) =>
      (!input.q || a.title.toLowerCase().includes(input.q.toLowerCase())) && (!input.category || input.category === "All" || a.category === input.category),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 6)),
    page = Math.max(1, Math.min(pages, Math.floor(input.page ?? 1) || 1));
  return { items: filtered.slice((page - 1) * 6, page * 6), page, pages, total: filtered.length, q: input.q ?? "", category: input.category ?? "All" };
}
export function articleFor(slug: string) {
  return articles.find((a) => a.slug === slug) ?? null;
}
export function nextPath(value: string | null) {
  return safeRedirect(value, "/desk");
}
export function closeDatabase() {
  db.close();
  delete registry[key];
}
