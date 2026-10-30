import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import type { User } from "../src/server/service.server.ts";

// These are application-service policies, not automatic framework guarantees.
describe("operations application-service", { concurrent: false, shuffle: false }, () => {
  let directory: string | undefined;
  let s: typeof import("../src/server/service.server.ts");
  let alice: User;
  let bob: User;
  let viewer: User;
  let previousDatabase: string | undefined;
  beforeAll(async () => {
    previousDatabase = process.env.OPERATIONS_DB;
    directory = await mkdtemp(join(tmpdir(), "rivet-operations-business-"));
    process.env.OPERATIONS_DB = join(directory, "db.sqlite");
    s = await import("../src/server/service.server.ts");
    const authenticatedAlice = s.authenticate("alice@alpha.test", "demo-pass-2026");
    const authenticatedBob = s.authenticate("bob@beta.test", "demo-pass-2026");
    const authenticatedViewer = s.authenticate("viewer@alpha.test", "demo-pass-2026");
    assert.ok(authenticatedAlice);
    assert.ok(authenticatedBob);
    assert.ok(authenticatedViewer);
    alice = authenticatedAlice;
    bob = authenticatedBob;
    viewer = authenticatedViewer;
  });
  afterAll(async () => {
    try {
      s?.closeDatabase();
    } finally {
      if (previousDatabase === undefined) delete process.env.OPERATIONS_DB;
      else process.env.OPERATIONS_DB = previousDatabase;
      if (directory) await rm(directory, { recursive: true, force: true });
    }
  });
  it("valid-login-and-wrong-password", () => {
    assert.equal(alice.tenant, "alpha");
    assert.equal(s.authenticate("alice@alpha.test", "wrong"), null);
  });
  it("unknown-user-and-sql-injection-login", () => {
    assert.equal(s.authenticate("missing@alpha.test", "anything"), null);
    assert.equal(s.authenticate("' OR 1=1--", "anything"), null);
  });
  it("session-generated-and-revoked-server-side", () => {
    const token = s.createSession(alice);
    assert.equal(s.sessionUser(token)?.id, alice.id);
    s.revokeSession(token);
    assert.equal(s.sessionUser(token), null);
  });
  it("expired-session-rejected", () => {
    const token = s.createSession(alice, -1);
    assert.equal(s.sessionUser(token), null);
  });
  it("cross-tenant-ticket-read-hidden", () => {
    assert.equal(s.ticketFor(bob, "alpha-1"), null);
  });
  it("cross-tenant-ticket-write-denied", () => {
    assert.throws(
      () => s.updateTicket(bob, "alpha-1", { version: 0, status: "closed" }),
      (error: unknown) => error instanceof s.Fault && error.status === 404,
    );
  });
  it("viewer-cannot-mutate-ticket", () => {
    assert.throws(
      () => s.updateTicket(viewer, "alpha-1", { version: 0, status: "closed" }),
      (error: unknown) => error instanceof s.Fault && error.status === 403,
    );
  });
  it("optimistic-version-conflict", () => {
    const t = s.ticketFor(alice, "alpha-1");
    assert.ok(t);
    const next = s.updateTicket(alice, t.id, { version: t.version, status: "pending" });
    assert.equal(next.version, t.version + 1);
    assert.throws(
      () => s.updateTicket(alice, t.id, { version: t.version, status: "closed" }),
      (error: unknown) => error instanceof s.Fault && error.status === 409,
    );
  });
  it("mass-assignment-tenant-and-role-denied", () => {
    assert.throws(
      () => s.updateTicket(alice, "alpha-1", { version: 1, tenant: "beta", role: "admin" }),
      (error: unknown) => error instanceof s.Fault && error.status === 400,
    );
  });
  it("cart-computes-prices-from-server-catalog", () => {
    const c = s.cartFor(alice);
    const next = s.setCart(alice, { version: c.version, sku: "sku-1", quantity: 2 });
    const product = s.productFor("sku-1");
    assert.ok(product);
    assert.equal(next.subtotal, 2 * product.price);
  });
  it("cart-price-tampering-rejected", () => {
    const c = s.cartFor(alice);
    assert.throws(
      () => s.setCart(alice, { version: c.version, sku: "sku-1", quantity: 2, price: 1 }),
      (error: unknown) => error instanceof s.Fault && error.status === 400,
    );
  });
  it("negative-and-fractional-quantities-denied", () => {
    for (const quantity of [-1, 0.5, 100000])
      assert.throws(
        () => s.setCart(alice, { version: s.cartFor(alice).version, sku: "sku-1", quantity }),
        (error: unknown) => error instanceof s.Fault && error.status === 400,
      );
  });
  it("checkout-is-idempotent-and-clears-cart", () => {
    const c = s.cartFor(alice);
    const a = s.checkout(alice, { version: c.version, key: "unit-checkout" }),
      b = s.checkout(alice, { version: c.version, key: "unit-checkout" });
    assert.equal(a.id, b.id);
    assert.equal(s.cartFor(alice).items.length, 0);
  });
  it("order-cannot-be-read-across-users", () => {
    const order = s.ordersFor(alice)[0];
    assert.equal(s.orderFor(bob, order.id), null);
  });
  it("draft-conflict-does-not-overwrite-text", () => {
    const d = s.draftFor(alice);
    s.saveDraft(alice, { version: d.version, title: "First", body: "Keep me" });
    assert.throws(
      () => s.saveDraft(alice, { version: d.version, title: "Second", body: "Overwrite" }),
      (error: unknown) => error instanceof s.Fault && error.status === 409,
    );
    assert.equal(s.draftFor(alice).body, "Keep me");
  });
  it("public-article-filter-and-pagination", () => {
    const page = s.articlePage({ q: "security", page: 1 });
    assert.ok(page.total > 0);
    assert.ok(page.items.every((a) => a.title.toLowerCase().includes("security")));
  });
  it("event-feed-is-tenant-scoped", () => {
    s.addMessage(alice, "alpha-1", "alpha-private");
    assert.ok(s.eventsFor(alice, 0).some((e) => e.body.includes("alpha-private")));
    assert.ok(!s.eventsFor(bob, 0).some((e) => e.body.includes("alpha-private")));
  });
  it("upload-traversal-and-active-content-denied", () => {
    for (const filename of ["../../secret.txt", "evil.html", "evil.svg", "a\\b.txt"])
      assert.throws(
        () => s.addFile(alice, "alpha-1", filename, "text/plain", Buffer.from("x")),
        (error: unknown) => error instanceof s.Fault && error.status === 400,
      );
  });
  it("attachment-is-tenant-scoped", () => {
    const f = s.addFile(alice, "alpha-1", "note.txt", "text/plain", Buffer.from("safe"));
    assert.equal(s.fileFor(bob, f.id), null);
    assert.equal(s.fileFor(alice, f.id)?.name, "note.txt");
  });
  it("return-path-rejects-controls-and-external-origins", () => {
    for (const value of ["/\t/attacker.invalid", "/\n/attacker.invalid", "//attacker.invalid", "/\\attacker.invalid", "https://attacker.invalid"])
      assert.equal(s.nextPath(value), "/desk");
    assert.equal(s.nextPath("/desk/editor?mode=preview"), "/desk/editor?mode=preview");
  });
});
