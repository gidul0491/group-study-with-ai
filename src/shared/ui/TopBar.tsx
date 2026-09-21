import { Show, type JSX } from "solid-js";
import { A } from "@solidjs/router";
import { topBar, topBarTitle, buttonSmall } from "./layout.style";

export function TopBar(props: {
  title: string;
  back?: string;
  right?: JSX.Element;
}) {
  return (
    <header class={topBar}>
      <Show when={props.back}>
        <A class={buttonSmall} href={props.back!} aria-label="뒤로">
          ←
        </A>
      </Show>
      <div class={topBarTitle}>{props.title}</div>
      {props.right}
    </header>
  );
}
