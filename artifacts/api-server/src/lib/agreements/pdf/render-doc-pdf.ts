/**
 * Renders a single agreement document (operator or platform) to PDF bytes
 * using PDFKit. Returns a Buffer containing the PDF.
 */

import PDFDocument from "pdfkit";

const PRIMARY    = "#1b4332";
const LIGHT_GRAY = "#f5f5f5";
const MID_GRAY   = "#666666";
const DARK       = "#111111";

function pageWidth(doc: InstanceType<typeof PDFDocument>) {
  return doc.page.width - 120;
}

function drawSectionHeader(doc: InstanceType<typeof PDFDocument>, title: string) {
  const pw = pageWidth(doc);
  if (doc.y > doc.page.height - 140) doc.addPage();
  doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(12).text(title, 60, doc.y);
  doc.moveDown(0.25);
  doc.moveTo(60, doc.y).lineTo(60 + pw, doc.y).strokeColor("#dddddd").lineWidth(1).stroke();
  doc.moveDown(0.5);
}

function stripInline(raw: string): string {
  return raw
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1");
}

function drawBody(doc: InstanceType<typeof PDFDocument>, text: string) {
  const pw = pageWidth(doc);
  const lines = text.split("\n");
  const pendingBullets: { prefix: string; body: string }[] = [];
  const bulletIndent = 86;
  const prefixCol = 70;

  const flushBullets = () => {
    if (!pendingBullets.length) return;
    for (const b of pendingBullets) {
      if (doc.y > doc.page.height - 60) doc.addPage();
      const bTop = doc.y;
      doc.fillColor(DARK).font("Helvetica").fontSize(9.5).lineGap(2);
      doc.text(b.prefix, prefixCol, bTop, { width: 14, lineBreak: false });
      doc.text(stripInline(b.body), bulletIndent, bTop, { width: pw - (bulletIndent - 60), align: "left" });
      doc.moveDown(0.2);
    }
    pendingBullets.length = 0;
    doc.moveDown(0.3);
  };

  for (const line of lines) {
    if (line.startsWith("### ")) {
      flushBullets();
      if (doc.y > doc.page.height - 80) doc.addPage();
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10)
        .text(stripInline(line.slice(4).trim()), 60, doc.y, { width: pw });
      doc.moveDown(0.4);
    } else if (line.startsWith("## ")) {
      flushBullets();
      drawSectionHeader(doc, stripInline(line.slice(3).trim()));
    } else if (line.startsWith("# ")) {
      flushBullets();
      if (doc.y > doc.page.height - 80) doc.addPage();
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(13)
        .text(stripInline(line.slice(2).trim()), 60, doc.y, { width: pw });
      doc.moveDown(0.6);
    } else if (/^---+$/.test(line.trim())) {
      flushBullets();
      doc.moveTo(60, doc.y).lineTo(60 + pw, doc.y).strokeColor("#dddddd").lineWidth(0.75).stroke();
      doc.moveDown(0.8);
    } else if (/^[-*] /.test(line)) {
      pendingBullets.push({ prefix: "\u2022", body: line.slice(2) });
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)?.[1] ?? "1";
      pendingBullets.push({ prefix: `${num}.`, body: line.replace(/^\d+\. /, "") });
    } else if (line.trim() === "") {
      flushBullets();
      doc.moveDown(0.5);
    } else {
      flushBullets();
      if (doc.y > doc.page.height - 60) doc.addPage();
      doc.fillColor(DARK).font("Helvetica").fontSize(9.5).lineGap(3)
        .text(stripInline(line.trim()), 60, doc.y, { width: pw, align: "justify" });
      doc.moveDown(0.3);
    }
  }
  flushBullets();
}

export interface DocPdfOptions {
  title: string;
  content: string;                      // Already rendered (Handlebars resolved)
  checkboxLabel?: string;
  accepted?: boolean;
  sourceType: "operator" | "platform";
  companyName: string;
  bookingId: number;
}

/** Render a single agreement document to PDF bytes. */
export function renderDocPdf(opts: DocPdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 60, size: "LETTER" });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pw = pageWidth(doc);

    // ── Header ──────────────────────────────────────────────────────────────
    const headerLabel = opts.sourceType === "platform" ? "OutdoorShare Platform Agreement" : "Rental Agreement";
    doc.rect(0, 0, doc.page.width, 64).fill(PRIMARY);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18).text(opts.companyName, 60, 16);
    doc.fillColor("rgba(255,255,255,0.72)").font("Helvetica").fontSize(10)
      .text(`${headerLabel}  ·  Booking #${opts.bookingId}`, 60, 38);

    doc.y = 86;

    // ── Title ────────────────────────────────────────────────────────────────
    drawSectionHeader(doc, opts.title);

    // ── Body ─────────────────────────────────────────────────────────────────
    if (opts.content) drawBody(doc, opts.content);

    // ── Checkbox acceptance note ──────────────────────────────────────────────
    if (opts.checkboxLabel) {
      doc.moveDown(0.5);
      const rowTop = doc.y;
      const cbSize = 12;
      doc.rect(60, rowTop, cbSize, cbSize)
        .fill("#ffffff").stroke(opts.accepted !== false ? "#16a34a" : "#d1d5db");
      if (opts.accepted !== false) {
        doc.save();
        doc.moveTo(62, rowTop + 6).lineTo(65, rowTop + 9.5).lineTo(71, rowTop + 3.5).stroke("#16a34a");
        doc.restore();
      }
      doc.fillColor(DARK).font("Helvetica").fontSize(9)
        .text(opts.checkboxLabel, 60 + cbSize + 8, rowTop + 1.5, { width: pw - cbSize - 10 });
      doc.moveDown(0.5);
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const ph = doc.page.height;
    doc.moveTo(60, ph - 50).lineTo(60 + pw, ph - 50).strokeColor("#e0e0e0").lineWidth(1).stroke();
    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8)
      .text(`${opts.companyName}  ·  ${opts.title}  ·  Booking #${opts.bookingId}`, 60, ph - 36, {
        width: pw, align: "center",
      });

    doc.end();
  });
}
