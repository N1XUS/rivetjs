// Rivet imperative portal lifecycle contracts for the Angular CDK port.
import { beforeEach, test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";
import { BasePortalOutlet, ComponentPortal, TemplatePortal, DomPortalOutlet, Portal, type PortalOutlet } from "@rivetjs/cdk/portal-outlet";

const dom = installDom();
beforeEach(() => dom.reset());
const outlet = () => {
  const host = document.createElement("div");
  document.body.append(host);
  return new DomPortalOutlet(host);
};

test("component portal forwards props and destroys its mounted view exactly once", () => {
  const host = outlet();
  const portal = new ComponentPortal(
    ({ text }: { text: string }) => {
      const element = document.createElement("span");
      element.textContent = text;
      return element;
    },
    { text: "Hello" },
  );
  const view = portal.attach(host);
  assert.equal(host instanceof BasePortalOutlet, true);
  assert.equal(portal.isAttached, true);
  assert.equal(host.hasAttached(), true);
  assert.equal(host.outletElement.textContent, "Hello");
  assert.equal(view.rootNodes.length, 1);
  assert.deepEqual(view.context, { text: "Hello" });
  let destroyed = 0;
  view.onDestroy(() => destroyed++);
  portal.detach();
  view.destroy();
  assert.equal(destroyed, 1);
  assert.equal(view.destroyed, true);
  assert.equal(host.hasAttached(), false);
  assert.equal(portal.isAttached, false);
  assert.equal(host.outletElement.textContent, "");
  host.dispose();
});

test("template portal accepts replacement context and clears it on detach", () => {
  const host = outlet();
  const portal = new TemplatePortal(({ name }: { name: string }) => name, { name: "original" });
  const view = portal.attach(host, { name: "replacement" });
  assert.equal(host.outletElement.textContent, "replacement");
  assert.deepEqual(view.context, { name: "replacement" });
  portal.detach();
  assert.equal(portal.context, undefined);
  assert.equal(view.destroyed, true);
  host.dispose();
});

test("portal lifecycle rejects missing hosts, duplicate attachments, unknown portals and disposed outlets", () => {
  const host = outlet();
  const portal = new TemplatePortal(() => "content");
  assert.throws(() => portal.detach(), /not attached/);
  assert.throws(() => portal.attach(null as unknown as PortalOutlet), /null PortalOutlet/);
  assert.throws(() => host.attach(null as unknown as Portal<unknown>), /Must provide a portal/);
  class UnsupportedPortal extends Portal<unknown> {}
  assert.throws(() => host.attach(new UnsupportedPortal()), /unknown Portal type/);
  portal.attach(host);
  assert.throws(() => new TemplatePortal(() => "other").attach(host), /already has a portal/);
  host.dispose();
  assert.equal(host.outletElement.isConnected, false);
  assert.throws(() => host.attach(new TemplatePortal(() => "late")), /already been disposed/);
});
