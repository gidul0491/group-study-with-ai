import { Title } from "@solidjs/meta";
import { action, redirect, useSubmission } from "@solidjs/router";
import { createEffect, createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { TopBar } from "@shared/ui/TopBar";
import {
  page,
  card,
  cardTitle,
  field,
  fieldLabel,
  textInput,
  textArea,
  buttonPrimary,
  buttonSecondary,
  buttonSmall,
  buttonBlock,
  errorText,
  muted,
  stack,
  rowBetween,
  rowWrap,
  tabs,
  tab,
  tabActive,
  badge,
} from "@shared/ui/layout.style";
import { describeError } from "@shared/lib/errors";
import { isoToLocalInput } from "@shared/lib/time";
import { style } from "som-style/solid";
import { theme } from "@style/theme.js";

const dropZone = style({
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.4rem",
    padding: "1rem",
    borderRadius: "0.75rem",
    border: `2px dashed ${theme.borderStrong}`,
    background: theme.surfaceMuted,
    textAlign: "center",
  },
});

const dropZoneActive = dropZone.extend({
  base: { borderColor: theme.primary, background: theme.mark },
});

const createExamAction = action(async (form: FormData) => {
  "use server";
  const { createExam, parseTimes } = await import("@modules/exam/exam.controller");
  const { extractPdfText, tidy } = await import("@modules/exam/source-text");
  const { badRequest } = await import("@shared/lib/errors");
  let examId: number;
  try {
    const count = Number(form.get("sourceCount") ?? 0);
    const sources = [];
    for (let i = 0; i < count; i++) {
      const mode = String(form.get(`s${i}.mode`) ?? "text");
      let kind: "MD" | "PDF" | "TEXT" = "TEXT";
      let fileName: string | null = null;
      let content = "";
      if (mode === "file") {
        const file = form.get(`s${i}.file`);
        if (!(file instanceof File) || file.size === 0) throw badRequest(`자료 ${i + 1}: 파일을 선택하세요.`);
        fileName = file.name;
        if (/\.pdf$/i.test(file.name)) {
          kind = "PDF";
          content = await extractPdfText(new Uint8Array(await file.arrayBuffer()), file.name);
        } else {
          kind = /\.(md|markdown)$/i.test(file.name) ? "MD" : "TEXT";
          content = tidy(await file.text());
        }
      } else {
        content = tidy(String(form.get(`s${i}.text`) ?? ""));
      }
      sources.push({
        kind,
        fileName,
        content,
        shortCount: Number(form.get(`s${i}.short`) ?? 0),
        multipleCount: Number(form.get(`s${i}.multiple`) ?? 0),
        choiceCount: Number(form.get(`s${i}.choices`) ?? 4),
        maxAnswerCount: Number(form.get(`s${i}.maxAnswers`) ?? 1),
      });
    }
    const result = createExam({
      title: String(form.get("title") ?? ""),
      commonPrompt: String(form.get("commonPrompt") ?? ""),
      sources,
      ...parseTimes(form),
    });
    examId = result.examId;
  } catch (e) {
    return { error: describeError(e).message };
  }
  throw redirect(`/admin/exams/${examId}`);
}, "createExam");

type SourceDraft = {
  mode: "file" | "text";
  file: File | null;
  short: number;
  multiple: number;
  choices: number;
  maxAnswers: number;
};

function newDraft(file: File | null = null): SourceDraft {
  return { mode: "file", file, short: 0, multiple: 1, choices: 4, maxAnswers: 1 };
}

const ACCEPT = /\.(md|markdown|pdf|txt)$/i;

function defaultTimes() {
  const start = new Date();
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 7 * 24 * 3_600_000);
  return { start: isoToLocalInput(start.toISOString()), end: isoToLocalInput(end.toISOString()) };
}

export default function NewExam() {
  const [sources, setSources] = createStore<SourceDraft[]>([newDraft()]);
  const [dragOver, setDragOver] = createSignal<number | null>(null);
  const submission = useSubmission(createExamAction);
  const times = defaultTimes();
  const [rejected, setRejected] = createSignal<string | null>(null);

  /**
   * 파일 여러 개를 받으면 첫 파일은 i번 자료에 넣고, 나머지는 자료 카드를 새로 만들어 넣는다.
   * i번 자료에 이미 파일이 있으면 전부 새 카드로 간다.
   */
  const addFiles = (i: number, list: FileList | File[] | undefined | null) => {
    const files = Array.from(list ?? []);
    const bad = files.filter((f) => !ACCEPT.test(f.name)).map((f) => f.name);
    setRejected(bad.length ? `md·pdf·txt만 넣을 수 있어요: ${bad.join(", ")}` : null);
    const ok = files.filter((f) => ACCEPT.test(f.name));
    if (ok.length === 0) return;
    let rest = ok;
    if (!sources[i].file) {
      setSources(i, { mode: "file", file: ok[0] });
      rest = ok.slice(1);
    }
    if (rest.length) setSources((prev) => [...prev, ...rest.map((f) => newDraft(f))]);
  };

  return (
    <>
      <Title>새 시험지</Title>
      <TopBar title="새 시험지" back="/admin" />
      <main class={page}>
        <form action={createExamAction} method="post" enctype="multipart/form-data" class={stack}>
          <div class={card}>
            <div class={stack}>
              <div class={field}>
                <label class={fieldLabel} for="title">
                  제목
                </label>
                <input id="title" name="title" class={textInput} required maxLength={100} placeholder="예: 3주차 운영체제" />
              </div>
              <div class={field}>
                <label class={fieldLabel} for="commonPrompt">
                  공통 프롬프트 (선택)
                </label>
                <textarea
                  id="commonPrompt"
                  name="commonPrompt"
                  class={textArea}
                  placeholder="예: 개념의 정의보다 왜 그런지를 묻는 문제 위주로. 용어는 영어 원어를 함께 표기."
                />
              </div>
            </div>
          </div>

          <div class={rowBetween}>
            <div class={cardTitle} style={{ "margin-bottom": "0" }}>
              자료 ({sources.length})
            </div>
            <button
              type="button"
              class={buttonSmall}
              onClick={() => setSources(sources.length, newDraft())}
            >
              + 자료 추가
            </button>
          </div>
          <input type="hidden" name="sourceCount" value={sources.length} />

          <For each={sources}>
            {(s, i) => (
              <div
                class={card}
                style={{ "border-color": dragOver() === i() ? "var(--som-theme-primary)" : undefined }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(i());
                }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(null);
                  addFiles(i(), e.dataTransfer?.files);
                }}
              >
                <div class={stack}>
                  <div class={rowBetween}>
                    <span class={badge}>자료 {i() + 1}</span>
                    <Show when={sources.length > 1}>
                      <button
                        type="button"
                        class={buttonSmall}
                        onClick={() => setSources((list) => list.filter((_, idx) => idx !== i()))}
                      >
                        삭제
                      </button>
                    </Show>
                  </div>
                  <input type="hidden" name={`s${i()}.mode`} value={s.mode} />
                  <div class={tabs}>
                    <button
                      type="button"
                      class={s.mode === "file" ? tabActive : tab}
                      onClick={() => setSources(i(), "mode", "file")}
                    >
                      파일 (md·pdf·txt)
                    </button>
                    <button
                      type="button"
                      class={s.mode === "text" ? tabActive : tab}
                      onClick={() => setSources(i(), "mode", "text")}
                    >
                      텍스트 붙여넣기
                    </button>
                  </div>
                  <div style={{ display: s.mode === "file" ? "block" : "none" }}>
                    <FileSlot
                      index={i()}
                      file={s.file}
                      dragging={dragOver() === i()}
                      onFiles={(list) => addFiles(i(), list)}
                      onClear={() => setSources(i(), "file", null)}
                    />
                  </div>
                  <div style={{ display: s.mode === "text" ? "block" : "none" }}>
                    <textarea
                      name={`s${i()}.text`}
                      class={textArea}
                      placeholder="자료 텍스트를 붙여넣으세요 (최대 100,000자)"
                      maxLength={100000}
                    />
                  </div>
                  <div class={rowWrap}>
                    <NumberField label="주관식" name={`s${i()}.short`} value={s.short} min={0} max={30}
                      onInput={(v) => setSources(i(), "short", v)} />
                    <NumberField label="객관식" name={`s${i()}.multiple`} value={s.multiple} min={0} max={30}
                      onInput={(v) => setSources(i(), "multiple", v)} />
                  </div>
                  <Show when={s.multiple > 0}>
                    <div class={rowWrap}>
                      <NumberField label="보기 개수" name={`s${i()}.choices`} value={s.choices} min={2} max={6}
                        onInput={(v) => setSources(i(), { choices: v, maxAnswers: Math.min(s.maxAnswers, v) })} />
                      <NumberField label="최대 복수정답" name={`s${i()}.maxAnswers`} value={s.maxAnswers} min={1} max={s.choices}
                        onInput={(v) => setSources(i(), "maxAnswers", v)} />
                    </div>
                  </Show>
                </div>
              </div>
            )}
          </For>

          <div class={card}>
            <div class={stack}>
              <div class={cardTitle}>시험 기간과 제한시간</div>
              <div class={field}>
                <label class={fieldLabel} for="startsAt">
                  시작 시각
                </label>
                <input id="startsAt" name="startsAt" type="datetime-local" class={textInput} value={times.start} required />
              </div>
              <div class={field}>
                <label class={fieldLabel} for="endsAt">
                  종료 시각
                </label>
                <input id="endsAt" name="endsAt" type="datetime-local" class={textInput} value={times.end} required />
              </div>
              <div class={rowWrap}>
                <NumberField label="개인풀이 제한(분)" name="soloLimitMin" value={30} min={1} max={600} />
                <NumberField label="협력풀이 제한(분)" name="groupLimitMin" value={30} min={1} max={600} />
              </div>
              <p class={muted}>제한시간이 지나거나 종료 시각이 되면 자동으로 제출됩니다.</p>
            </div>
          </div>

          <Show when={rejected()}>
            <p class={errorText}>{rejected()}</p>
          </Show>
          <Show when={submission.result?.error}>
            <p class={errorText}>{submission.result?.error}</p>
          </Show>
          <button type="submit" class={`${buttonPrimary} ${buttonBlock}`} disabled={submission.pending}>
            {submission.pending ? "자료 읽는 중…" : "출제 시작"}
          </button>
          <p class={muted}>출제는 자료마다 순서대로 진행되며, 다음 화면에서 진행 상황을 볼 수 있습니다.</p>
        </form>
      </main>
    </>
  );
}

function NumberField(props: {
  label: string;
  name: string;
  value: number;
  min: number;
  max: number;
  onInput?: (v: number) => void;
}) {
  return (
    <div class={field} style={{ flex: "1", "min-width": "7rem" }}>
      <label class={fieldLabel}>{props.label}</label>
      <input
        type="number"
        name={props.name}
        class={textInput}
        value={props.value}
        min={props.min}
        max={props.max}
        inputmode="numeric"
        required
        onInput={(e) => props.onInput?.(Number(e.currentTarget.value))}
      />
    </div>
  );
}

/**
 * 파일 자리. 실제 <input type="file">은 숨기고(폼 제출에는 포함) 스토어의 File을 동기화한다.
 */
function FileSlot(props: {
  index: number;
  file: File | null;
  dragging: boolean;
  onFiles: (list: FileList | null) => void;
  onClear: () => void;
}) {
  let input!: HTMLInputElement;
  createEffect(() => {
    const dt = new DataTransfer();
    if (props.file) dt.items.add(props.file);
    input.files = dt.files;
  });
  return (
    <div class={props.dragging ? dropZoneActive : dropZone}>
      <input
        ref={input}
        type="file"
        name={`s${props.index}.file`}
        accept=".md,.markdown,.pdf,.txt,text/markdown,text/plain,application/pdf"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          props.onFiles(e.currentTarget.files);
        }}
      />
      <Show
        when={props.file}
        fallback={
          <>
            <div style={{ "font-size": "1.6rem" }}>📄</div>
            <p class={muted}>여기로 파일을 끌어다 놓거나</p>
            <button type="button" class={buttonSecondary} onClick={() => input.click()}>
              파일 선택
            </button>
            <p class={muted} style={{ "font-size": "0.8rem" }}>md · pdf · txt, 여러 개면 자료가 자동으로 추가돼요</p>
          </>
        }
      >
        {(f) => (
          <div class={rowBetween} style={{ width: "100%" }}>
            <div style={{ "min-width": "0" }}>
              <div style={{ "font-weight": "600", overflow: "hidden", "text-overflow": "ellipsis", "white-space": "nowrap" }}>
                {f().name}
              </div>
              <div class={muted}>{(f().size / 1024).toFixed(0)} KB</div>
            </div>
            <div class={rowWrap} style={{ "flex-shrink": "0" }}>
              <button type="button" class={buttonSmall} onClick={() => input.click()}>
                바꾸기
              </button>
              <button type="button" class={buttonSmall} onClick={props.onClear}>
                제거
              </button>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
