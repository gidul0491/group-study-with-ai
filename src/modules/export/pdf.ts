import path from "node:path";
import fs from "node:fs";
import { choiceMark, type SheetInput } from "./markdown";

const FONT_PATH = path.resolve(process.cwd(), "assets", "fonts", "NotoSansKR-Regular.ttf");

/** 문제지/답안지 PDF. 한글 폰트를 동봉해 서버에서 만든다. */
export async function buildPdf(input: SheetInput): Promise<Buffer> {
  const { default: PDFDocument } = await import("pdfkit");
  if (!fs.existsSync(FONT_PATH)) {
    throw new Error(`한글 폰트가 없습니다: ${FONT_PATH}`);
  }
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 52, right: 52 },
    info: { Title: `${input.title} ${input.roundNo}차시 ${input.withAnswers ? "답안지" : "문제지"}` },
  });
  doc.registerFont("kr", FONT_PATH);
  doc.font("kr");

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const ink = "#3a2e24";
  const soft = "#7a6a5a";
  const accent = "#c8683a";

  doc.fillColor(ink).fontSize(18).text(input.title, { width });
  doc.moveDown(0.2);
  doc.fillColor(soft).fontSize(11).text(`${input.roundNo}차시 · ${input.withAnswers ? "답안지" : "문제지"} · 총 ${input.questions.length}문제`, { width });
  doc.moveDown(0.8);
  doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.margins.left + width, doc.y).strokeColor("#d8c9b8").lineWidth(1).stroke();
  doc.moveDown(0.8);

  for (const q of input.questions) {
    const block = estimateHeight(doc, q, width, input.withAnswers);
    if (doc.y + Math.min(block, 220) > doc.page.height - doc.page.margins.bottom) doc.addPage();

    doc.fillColor(ink).fontSize(12).text(`${q.seq}. ${q.text}`, { width, lineGap: 2 });
    doc.moveDown(0.3);
    if (q.type === "MULTIPLE") {
      for (const c of q.choices) {
        const isAns = input.withAnswers && c.isAnswer;
        doc.fillColor(isAns ? accent : ink).fontSize(11).text(`${choiceMark(c.seq)} ${c.text}${isAns ? "  ✔" : ""}`, {
          width: width - 16,
          indent: 16,
          lineGap: 1,
        });
      }
    } else if (!input.withAnswers) {
      doc.fillColor(soft).fontSize(11).text("답: ______________________________", { width, indent: 16 });
    }
    if (input.withAnswers) {
      doc.moveDown(0.3);
      const answerLine =
        q.type === "MULTIPLE"
          ? `정답: ${q.choices.filter((c) => c.isAnswer).map((c) => choiceMark(c.seq)).join(", ")}`
          : `정답: ${q.answers[0] ?? ""}${q.answers.length > 1 ? `   (인정: ${q.answers.slice(1).join(", ")})` : ""}`;
      doc.fillColor(accent).fontSize(11).text(answerLine, { width, indent: 16 });
      doc.fillColor(soft).fontSize(10).text(`해설: ${q.explanation}`, { width, indent: 16, lineGap: 1 });
    }
    doc.moveDown(0.9);
  }

  doc.end();
  return done;
}

function estimateHeight(doc: PDFKit.PDFDocument, q: SheetInput["questions"][number], width: number, withAnswers: boolean): number {
  let h = doc.fontSize(12).heightOfString(`${q.seq}. ${q.text}`, { width }) + 8;
  if (q.type === "MULTIPLE") {
    for (const c of q.choices) h += doc.fontSize(11).heightOfString(c.text, { width: width - 16 }) + 2;
  } else {
    h += 16;
  }
  if (withAnswers) h += 20 + doc.fontSize(10).heightOfString(q.explanation, { width: width - 16 });
  return h + 12;
}
