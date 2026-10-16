/// <reference types="vite/client" />
/// <reference types="@rivetjs/kit/client" />
import { Meta, Title } from "@rivetjs/kit";
import { Font } from "@rivetjs/kit/font";
import probe from "../fonts/Probe-Regular.woff2?weight=100..900&font";
import styles from "./about.module.css";

export default function About() {
  return (
    <section>
      <Title>About</Title>
      <Meta name="description" content="About page" />
      <Font font={probe} preload />
      <h1 id="about" class={styles.title}>
        About
      </h1>
    </section>
  );
}
