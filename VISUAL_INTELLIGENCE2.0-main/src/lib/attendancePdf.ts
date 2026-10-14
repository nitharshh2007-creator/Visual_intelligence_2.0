// Renders the printable A4 attendance sheet. Server-side only (used by
// /api/admin/attendance); jsPDF runs in Node without a browser.

import { jsPDF } from "jspdf";
import { eventDetails } from "@/data/event";
import { paginate, type AttendanceData } from "./attendance";

export const ATTENDANCE_FILENAME = "Visual_Intelligence_2.0_Attendance_Sheet.pdf";

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const FOOTER_SPACE = 8;
const CONTENT_BOTTOM = PAGE_H - MARGIN - FOOTER_SPACE;
const FIRST_HEADER_H = 36;
const RUNNING_HEADER_H = 8;
const TABLE_HEAD_H = 11;
const MIN_ROW_H = 8;
const FONT_SIZE = 9;
const LINE_H = 3.9;
const PAD_X = 1.6;

const COLUMNS = [
  { label: "S. No.", width: 13, align: "center" as const },
  { label: "Team Name", width: 50, align: "left" as const },
  { label: "Team Code", width: 28, align: "left" as const },
  { label: "Member Name", width: 60, align: "left" as const },
  { label: "Registration Number", width: 35, align: "left" as const },
]; // 186 mm = A4 width minus 12 mm margins

// jsPDF's built-in Helvetica only encodes Latin-1; one character outside it
// garbles the whole string. Map common typography to ASCII and make anything
// else a visible "?" so no name silently disappears. Latin-1 (é, ñ, …) and
// ASCII registration numbers pass through unchanged.
const TYPOGRAPHY: Record<string, string> = {
  "\u2018": "'", "\u2019": "'", "\u201A": "'", "\u201C": '"', "\u201D": '"', "\u201E": '"',
  "\u2013": "-", "\u2014": "-", "\u2212": "-", "\u2026": "...", "\u00A0": " ", "\u202F": " ", "\u2009": " ", "\u200B": "",
};
export function pdfSafe(text: string): string {
  return text
    .normalize("NFC")
    .replace(/[\u2018\u2019\u201A\u201C\u201D\u201E\u2013\u2014\u2212\u2026\u00A0\u202F\u2009\u200B]/g, (c) => TYPOGRAPHY[c])
    .replace(/[^\u0000-\u00FF]/gu, "?");
}

export interface RenderOptions {
  generatedAt: Date;
  compress?: boolean;
  /** Header values; default to the event details in src/data/event.ts. */
  date?: string;
  session?: string;
}

function formatGenerated(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d) + " IST";
}

export function renderAttendancePdf(data: AttendanceData, opts: RenderOptions): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: opts.compress ?? true });
  doc.setProperties({ title: "Visual Intelligence 2.0 - Attendance Sheet", creator: "Visual Intelligence 2.0 admin" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FONT_SIZE);

  // Wrap every text cell (names and reg numbers are never truncated) and
  // size each row to its tallest cell.
  const wrap = (text: string, col: number) => doc.splitTextToSize(pdfSafe(text), COLUMNS[col].width - PAD_X * 2) as string[];
  const cells = data.teams.map((t) =>
    (t.members.length ? t.members : [null]).map((m) =>
      m
        ? [[String(m.serial)], wrap(t.name, 1), wrap(t.code, 2), wrap(m.name, 3), wrap(m.regNo, 4)]
        : [["-"], wrap(t.name, 1), wrap(t.code, 2), wrap("(no registered members)", 3), []]
    )
  );
  const heights = cells.map((rows) => rows.map((r) => Math.max(MIN_ROW_H, Math.max(...r.map((l) => l.length)) * LINE_H + 3)));

  const firstSpace = CONTENT_BOTTOM - (MARGIN + FIRST_HEADER_H + TABLE_HEAD_H);
  const nextSpace = CONTENT_BOTTOM - (MARGIN + RUNNING_HEADER_H + TABLE_HEAD_H);
  const pages = paginate(heights, firstSpace, nextSpace);

  const drawTableHead = (y: number) => {
    doc.setFillColor(40, 16, 22);
    doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, TABLE_HEAD_H, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let x = MARGIN;
    for (const c of COLUMNS) {
      const lines = doc.splitTextToSize(c.label, c.width - PAD_X * 2) as string[];
      const top = y + TABLE_HEAD_H / 2 - ((lines.length - 1) * 3.2) / 2 + 1;
      lines.forEach((ln, i) =>
        doc.text(ln, c.align === "center" ? x + c.width / 2 : x + PAD_X, top + i * 3.2, { align: c.align })
      );
      x += c.width;
    }
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FONT_SIZE);
    return y + TABLE_HEAD_H;
  };

  pages.forEach((rows, pageIndex) => {
    if (pageIndex > 0) doc.addPage();
    let y = MARGIN;
    if (pageIndex === 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("VISUAL INTELLIGENCE 2.0", PAGE_W / 2, y + 7, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text("IEEE event attendance sheet", PAGE_W / 2, y + 13, { align: "center" });
      doc.setFontSize(10);
      doc.text(pdfSafe(`Date: ${opts.date ?? eventDetails.date}`), MARGIN, y + 23);
      doc.text(pdfSafe(`Session / Round: ${opts.session ?? eventDetails.time}`), MARGIN + 82, y + 23);
      doc.setFont("helvetica", "bold");
      doc.text(`Total teams: ${data.totalTeams}`, MARGIN, y + 31);
      doc.text(`Total registered members: ${data.totalMembers}`, MARGIN + 82, y + 31);
      doc.setFont("helvetica", "normal");
      y += FIRST_HEADER_H;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(90, 90, 90);
      doc.text("Visual Intelligence 2.0 - Attendance Sheet", MARGIN, y + 4);
      doc.setTextColor(20, 20, 20);
      y += RUNNING_HEADER_H;
    }
    doc.setFontSize(FONT_SIZE);
    y = drawTableHead(y);

    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.2);
    rows.forEach((row) => {
      const content = cells[row.teamIndex][row.memberIndex];
      if (row.teamIndex % 2 === 1) {
        doc.setFillColor(244, 241, 241);
        doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, row.height, "F");
      }
      let x = MARGIN;
      content.forEach((lines, col) => {
        const c = COLUMNS[col];
        doc.rect(x, y, c.width, row.height, "S");
        lines.forEach((ln, i) =>
          doc.text(ln, c.align === "center" ? x + c.width / 2 : x + PAD_X, y + 4.6 + i * LINE_H, { align: c.align })
        );
        x += c.width;
      });
      // Heavier rule where a new team starts.
      if (row.memberIndex === 0) {
        doc.setLineWidth(0.6);
        doc.setDrawColor(60, 60, 60);
        doc.line(MARGIN, y, PAGE_W - MARGIN, y);
        doc.setLineWidth(0.2);
        doc.setDrawColor(150, 150, 150);
      }
      y += row.height;
    });
  });

  const total = doc.getNumberOfPages();
  const generated = pdfSafe(`Generated on ${formatGenerated(opts.generatedAt)}`);
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(generated, MARGIN, PAGE_H - MARGIN);
    doc.text(`Page ${p} of ${total}`, PAGE_W - MARGIN, PAGE_H - MARGIN, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
