// Rivet v0 (2024-era): a web-components runtime. Decorators, class fields, tagged templates.
// Shipped 6.9 KB gzipped. "The original 5 KB hypothesis was missed."
import { RivetComponent, customElement, html, input, model, output } from "@rivetjs/core";
import styles from "./counter.scss?inline";

@customElement({ tag: "rv-counter", styles: [styles] })
export class Counter extends RivetComponent {
  readonly step = input(1);
  readonly value = model(0);
  readonly activated = output<number>();

  change(direction: number): void {
    this.value.update((n) => n + direction * this.step());
    this.activated.emit(this.value());
  }

  render() {
    return html`<div class="controls">
      <button part="button" aria-label="Decrease" @click=${() => this.change(-1)}>−</button
      ><strong part="value">${this.value}</strong
      ><button part="button" aria-label="Increase" @click=${() => this.change(1)}>+</button>
    </div>`;
  }
}
