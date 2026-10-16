// Ported from angular/components src/cdk/a11y/aria-describer/aria-describer.spec.ts and
// aria-reference.spec.ts, MIT, © Google LLC. TestBed fixture → body template + new AriaDescriber.
import "./dom.ts";
import { describe, it, beforeEach, afterEach } from "vitest";
import assert from "node:assert/strict";
import { AriaDescriber, CDK_DESCRIBEDBY_HOST_ATTRIBUTE, addAriaReferencedId, getAriaReferenceIds, removeAriaReferencedId } from "../a11y/aria-describer.ts";

describe("AriaReference", () => {
  let testElement: HTMLElement | null;
  beforeEach(() => {
    testElement = document.createElement("div");
    document.body.appendChild(testElement);
  });
  afterEach(() => testElement?.remove());

  function expectIds(attr: string, ids: string[]) {
    const value = testElement!.getAttribute(attr);
    assert.deepEqual(getAriaReferenceIds(testElement!, attr), ids);
    if (ids.length) assert.equal(value, ids.join(" "));
    else assert.ok(!value);
  }

  it("should be able to append/remove aria reference IDs", () => {
    addAriaReferencedId(testElement!, "aria-describedby", "reference_1");
    expectIds("aria-describedby", ["reference_1"]);
    addAriaReferencedId(testElement!, "aria-describedby", "reference_2");
    expectIds("aria-describedby", ["reference_1", "reference_2"]);
    removeAriaReferencedId(testElement!, "aria-describedby", "reference_1");
    expectIds("aria-describedby", ["reference_2"]);
    removeAriaReferencedId(testElement!, "aria-describedby", "reference_2");
    expectIds("aria-describedby", []);
  });

  it("should trim whitespace when adding/removing reference IDs", () => {
    addAriaReferencedId(testElement!, "aria-describedby", "    reference_1   ");
    addAriaReferencedId(testElement!, "aria-describedby", "    reference_2   ");
    expectIds("aria-describedby", ["reference_1", "reference_2"]);
    removeAriaReferencedId(testElement!, "aria-describedby", "   reference_1   ");
    expectIds("aria-describedby", ["reference_2"]);
    removeAriaReferencedId(testElement!, "aria-describedby", "   reference_2   ");
    expectIds("aria-describedby", []);
  });

  it("should ignore empty string", () => {
    addAriaReferencedId(testElement!, "aria-describedby", "  ");
    expectIds("aria-describedby", []);
  });

  it("should not add the same reference id if it already exists", () => {
    addAriaReferencedId(testElement!, "aria-describedby", "reference_1");
    addAriaReferencedId(testElement!, "aria-describedby", "reference_1");
    assert.deepEqual(getAriaReferenceIds(testElement!, "aria-describedby"), ["reference_1"]);
  });

  it("should retrieve ids that are delimited by extra whitespace", () => {
    testElement!.setAttribute("aria-describedby", "reference_1      reference_2");
    assert.deepEqual(getAriaReferenceIds(testElement!, "aria-describedby"), ["reference_1", "reference_2"]);
  });
});

describe("AriaDescriber", () => {
  let ariaDescriber: AriaDescriber;
  let root: HTMLElement;
  const component = {
    get element1() {
      return root.querySelector("[data-el='1']")!;
    },
    get element2() {
      return root.querySelector("[data-el='2']")!;
    },
    get element3() {
      return root.querySelector("[data-el='3']")!;
    },
    get element4() {
      return root.querySelector("[data-el='4']")!;
    },
  };

  function createFixture() {
    root = document.createElement("div");
    root.innerHTML = `
      <div data-el="1"></div>
      <div data-el="2"></div>
      <div data-el="3"></div>
      <div data-el="4" aria-describedby="existing-aria-describedby1 existing-aria-describedby2"></div>
      <div id="description-with-existing-id">Hello</div>
      <div description-without-id>Hey</div>`;
    document.body.appendChild(root);
    ariaDescriber = new AriaDescriber();
  }
  afterEach(() => {
    ariaDescriber?.destroy();
    root?.remove();
  });

  it("should initialize without the message container", () => {
    createFixture();
    assert.equal(getMessagesContainer(), null);
  });

  it("should be able to create a message element", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "My Message");
    expectMessages(["My Message"]);
  });

  it("should be able to describe using an element", () => {
    createFixture();
    const descriptionNode = root.querySelector("#description-with-existing-id") as HTMLElement;
    ariaDescriber.describe(component.element1, descriptionNode);
    expectMessage(component.element1, "Hello");
  });

  it("should hide the message container", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "My Message");
    assert.ok(getMessagesContainer()!.classList.contains("cdk-visually-hidden"));
  });

  it("should have visibility hidden", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "My Message");
    assert.equal((getMessagesContainer() as HTMLElement).style.visibility, "hidden");
  });

  it("should not register empty strings", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "");
    assert.equal(getMessageElements(), null);
  });

  it("should not register non-string values", () => {
    createFixture();
    assert.doesNotThrow(() => ariaDescriber.describe(component.element1, null!));
    assert.equal(getMessageElements(), null);
  });

  it("should not throw when trying to remove non-string value", () => {
    createFixture();
    assert.doesNotThrow(() => ariaDescriber.removeDescription(component.element1, null!));
  });

  it("should de-dupe a message registered multiple times", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "My Message");
    ariaDescriber.describe(component.element2, "My Message");
    ariaDescriber.describe(component.element3, "My Message");
    expectMessages(["My Message"]);
    expectMessage(component.element1, "My Message");
    expectMessage(component.element2, "My Message");
    expectMessage(component.element3, "My Message");
  });

  it("should de-dupe a message registered multiple via an element node", () => {
    createFixture();
    const descriptionNode = root.querySelector("#description-with-existing-id") as HTMLElement;
    ariaDescriber.describe(component.element1, descriptionNode);
    ariaDescriber.describe(component.element2, descriptionNode);
    ariaDescriber.describe(component.element3, descriptionNode);
    expectMessage(component.element1, "Hello");
    expectMessage(component.element2, "Hello");
    expectMessage(component.element3, "Hello");
  });

  it("should be able to register multiple messages", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "First Message");
    ariaDescriber.describe(component.element2, "Second Message");
    expectMessages(["First Message", "Second Message"]);
    expectMessage(component.element1, "First Message");
    expectMessage(component.element2, "Second Message");
  });

  it("should be able to unregister messages", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "My Message");
    expectMessages(["My Message"]);
    ariaDescriber.describe(component.element2, "My Message");
    expectMessages(["My Message"]);
    ariaDescriber.removeDescription(component.element1, "My Message");
    assert.ok(!component.element1.hasAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE));
    expectMessages(["My Message"]);
    ariaDescriber.removeDescription(component.element2, "My Message");
    assert.ok(!component.element2.hasAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE));
    assert.equal(getMessagesContainer(), null);
  });

  it("should not remove nodes that were set as messages when unregistering", () => {
    createFixture();
    const descriptionNode = root.querySelector("#description-with-existing-id") as HTMLElement;
    assert.equal(document.body.contains(descriptionNode), true);
    assert.equal(getMessagesContainer(), null);
    ariaDescriber.describe(component.element1, descriptionNode);
    expectMessage(component.element1, "Hello");
    assert.equal(getMessagesContainer(), null);
    ariaDescriber.removeDescription(component.element1, descriptionNode);
    assert.equal(document.body.contains(descriptionNode), true);
  });

  it("should keep nodes set as descriptions inside their original position in the DOM", () => {
    createFixture();
    const descriptionNode = root.querySelector("#description-with-existing-id") as HTMLElement;
    const initialParent = descriptionNode.parentNode;
    assert.ok(initialParent);
    ariaDescriber.describe(component.element1, descriptionNode);
    expectMessage(component.element1, "Hello");
    assert.equal(descriptionNode.parentNode, initialParent);
    ariaDescriber.removeDescription(component.element1, descriptionNode);
    assert.equal(descriptionNode.parentNode, initialParent);
  });

  it("should be able to unregister messages while having others registered", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "Persistent Message");
    ariaDescriber.describe(component.element2, "My Message");
    expectMessages(["Persistent Message", "My Message"]);
    ariaDescriber.describe(component.element3, "My Message");
    expectMessages(["Persistent Message", "My Message"]);
    ariaDescriber.removeDescription(component.element2, "My Message");
    expectMessages(["Persistent Message", "My Message"]);
    ariaDescriber.removeDescription(component.element3, "My Message");
    expectMessages(["Persistent Message"]);
  });

  it("should be able to append to an existing list of aria describedby", () => {
    createFixture();
    ariaDescriber.describe(component.element4, "My Message");
    expectMessages(["My Message"]);
    expectMessage(component.element4, "My Message");
  });

  it("should be able to handle multiple regisitrations of the same message to an element", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "My Message");
    ariaDescriber.describe(component.element1, "My Message");
    expectMessages(["My Message"]);
    expectMessage(component.element1, "My Message");
  });

  it("should not throw when attempting to describe a non-element node", () => {
    createFixture();
    const node = document.createComment("Not an element node") as unknown as Element;
    assert.doesNotThrow(() => ariaDescriber.describe(node, "This looks like an element"));
  });

  it("should clear any pre-existing containers coming in from the server", () => {
    createFixture();
    const extraContainer = document.createElement("div");
    extraContainer.classList.add("cdk-describedby-message-container");
    extraContainer.setAttribute("platform", "server");
    document.body.appendChild(extraContainer);
    ariaDescriber.describe(component.element1, "Hello");
    assert.equal(document.querySelectorAll(".cdk-describedby-message-container").length, 1);
    extraContainer.remove();
  });

  it("should not clear any pre-existing containers coming from the browser", () => {
    createFixture();
    const extraContainer = document.createElement("div");
    extraContainer.classList.add("cdk-describedby-message-container");
    document.body.appendChild(extraContainer);
    ariaDescriber.describe(component.element1, "Hello");
    assert.equal(document.querySelectorAll(".cdk-describedby-message-container").length, 2);
    extraContainer.remove();
  });

  it("should not describe messages that match up with the aria-label of the element", () => {
    createFixture();
    component.element1.setAttribute("aria-label", "Hello");
    ariaDescriber.describe(component.element1, "Hello");
    ariaDescriber.describe(component.element1, "Hi");
    expectMessages(["Hi"]);
  });

  it("should assign an id to the description element, if it does not have one", () => {
    createFixture();
    const descriptionNode = root.querySelector("[description-without-id]") as HTMLElement;
    assert.ok(!descriptionNode.getAttribute("id"));
    ariaDescriber.describe(component.element1, descriptionNode);
    assert.ok(descriptionNode.getAttribute("id"));
  });

  it("should not overwrite the existing id of the description element", () => {
    createFixture();
    const descriptionNode = root.querySelector("#description-with-existing-id") as HTMLElement;
    assert.equal(descriptionNode.id, "description-with-existing-id");
    ariaDescriber.describe(component.element1, descriptionNode);
    assert.equal(descriptionNode.id, "description-with-existing-id");
  });

  it("should not remove pre-existing description nodes on destroy", () => {
    createFixture();
    const descriptionNode = root.querySelector("#description-with-existing-id") as HTMLElement;
    assert.equal(document.body.contains(descriptionNode), true);
    ariaDescriber.describe(component.element1, descriptionNode);
    expectMessage(component.element1, "Hello");
    assert.equal(component.element1.hasAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE), true);
    ariaDescriber.destroy();
    assert.equal(component.element1.hasAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE), false);
    assert.equal(document.body.contains(descriptionNode), true);
  });

  it("should remove the aria-describedby attribute if there are no more messages", () => {
    createFixture();
    const element = component.element1;
    assert.equal(element.hasAttribute("aria-describedby"), false);
    ariaDescriber.describe(component.element1, "Message");
    assert.equal(element.hasAttribute("aria-describedby"), true);
    ariaDescriber.removeDescription(component.element1, "Message");
    assert.equal(element.hasAttribute("aria-describedby"), false);
  });

  it("should be able to register the same message with different roles", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "My Message", "tooltip");
    ariaDescriber.describe(component.element2, "My Message", "button");
    ariaDescriber.describe(component.element3, "My Message", "presentation");
    expectMessages(["tooltip/My Message", "button/My Message", "presentation/My Message"]);
    expectMessage(component.element1, "tooltip/My Message");
    expectMessage(component.element2, "button/My Message");
    expectMessage(component.element3, "presentation/My Message");
  });

  it("should de-dupe a message if it has been registered with the same role", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "My Message", "tooltip");
    ariaDescriber.describe(component.element2, "My Message", "tooltip");
    ariaDescriber.describe(component.element3, "My Message", "tooltip");
    expectMessages(["tooltip/My Message"]);
    expectMessage(component.element1, "tooltip/My Message");
    expectMessage(component.element2, "tooltip/My Message");
    expectMessage(component.element3, "tooltip/My Message");
  });

  it("should be able to unregister messages with a particular role", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "My Message", "tooltip");
    expectMessages(["tooltip/My Message"]);
    ariaDescriber.describe(component.element2, "My Message", "tooltip");
    expectMessages(["tooltip/My Message"]);
    ariaDescriber.removeDescription(component.element1, "My Message", "tooltip");
    assert.ok(!component.element1.hasAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE));
    expectMessages(["tooltip/My Message"]);
    ariaDescriber.removeDescription(component.element2, "My Message", "tooltip");
    assert.ok(!component.element2.hasAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE));
    assert.equal(getMessagesContainer(), null);
  });

  it("should not remove element if it is registered with same text, but different role", () => {
    createFixture();
    ariaDescriber.describe(component.element1, "My Message", "tooltip");
    ariaDescriber.describe(component.element2, "My Message", "button");
    expectMessages(["tooltip/My Message", "button/My Message"]);
    ariaDescriber.removeDescription(component.element2, "My Message", "button");
    expectMessages(["tooltip/My Message"]);
    ariaDescriber.removeDescription(component.element1, "My Message", "tooltip");
    assert.equal(getMessageElements(), null);
  });
});

function getMessagesContainer(): Element | null {
  return document.querySelector(".cdk-describedby-message-container");
}

function getMessageElements(): Element[] | null {
  const messagesContainer = getMessagesContainer();
  return messagesContainer ? Array.prototype.slice.call(messagesContainer.children) : null;
}

function expectMessages(messages: string[]) {
  const messageElements = getMessageElements();
  assert.ok(messageElements);
  assert.equal(messages.length, messageElements.length);
  messages.forEach((message, i) => {
    const element = messageElements[i]!;
    const role = element.getAttribute("role");
    assert.equal((role ? role + "/" : "") + element.textContent, message);
  });
}

function expectMessage(el: Element, message: string) {
  const ariaDescribedBy = el.getAttribute("aria-describedby");
  assert.ok(ariaDescribedBy != null);
  assert.ok(el.getAttribute(CDK_DESCRIBEDBY_HOST_ATTRIBUTE) != null);
  const messages = ariaDescribedBy.split(" ").map((referenceId) => {
    const messageElement = document.getElementById(referenceId);
    const role = messageElement?.getAttribute("role");
    const prefix = role ? role + "/" : "";
    return messageElement ? prefix + messageElement.textContent : "";
  });
  assert.ok(messages.includes(message), `${JSON.stringify(messages)} should contain ${message}`);
}
