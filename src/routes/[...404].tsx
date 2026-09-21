import { Title } from "@solidjs/meta";
import { HttpStatusCode } from "@solidjs/start";
import { centerBox, heading, muted, buttonSecondary } from "@shared/ui/layout.style";

export default function NotFound() {
  return (
    <main class={centerBox}>
      <Title>페이지 없음</Title>
      <HttpStatusCode code={404} />
      <h1 class={heading}>페이지를 찾을 수 없어요</h1>
      <p class={muted}>주소가 잘못되었거나 링크가 닫혔을 수 있어요.</p>
      <a class={buttonSecondary} href="/">
        처음으로
      </a>
    </main>
  );
}
