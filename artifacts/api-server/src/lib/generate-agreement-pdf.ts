import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

export interface RuleInitialEntry {
  ruleId: number;
  title: string;
  fee: number;
  initials: string;
  initialedAt: string;
}

export interface AgreementPdfOptions {
  bookingId: number;
  companyName: string;
  customerName: string;
  customerEmail: string;
  listingTitle: string;
  startDate: string;
  endDate: string;
  agreementText: string;
  signerName: string;
  signedAt: Date;
  signatureDataUrl: string;
  ruleInitials?: RuleInitialEntry[];
}

export async function generateAgreementPdf(opts: AgreementPdfOptions): Promise<string> {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const filename = `agreement-${opts.bookingId}-${randomBytes(6).toString("hex")}.pdf`;
  const filepath = path.join(UPLOADS_DIR, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: "LETTER" });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    const PRIMARY = "#1b4332";
    const LIGHT_GRAY = "#f5f5f5";
    const MID_GRAY = "#666666";
    const DARK = "#111111";
    const PAGE_WIDTH = doc.page.width - 120;

    // ── Header bar ───────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 72).fill(PRIMARY);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20)
      .text(opts.companyName, 60, 22);
    doc.fillColor("rgba(255,255,255,0.75)").font("Helvetica").fontSize(11)
      .text("Rental Agreement", 60, 46);

    doc.fillColor(DARK).moveDown(3);

    // ── Booking Info box ─────────────────────────────────────────────────────
    const infoTop = 92;
    doc.rect(60, infoTop, PAGE_WIDTH, 90).fill(LIGHT_GRAY).stroke("#e0e0e0");

    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5);
    const col1x = 75;
    const col2x = 300;

    doc.text("CUSTOMER", col1x, infoTop + 12);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10)
      .text(opts.customerName, col1x, infoTop + 24);
    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5)
      .text(opts.customerEmail, col1x, infoTop + 38);

    doc.text("RENTAL ITEM", col2x, infoTop + 12);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10)
      .text(opts.listingTitle, col2x, infoTop + 24);
    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5)
      .text(`${opts.startDate}  →  ${opts.endDate}`, col2x, infoTop + 38);

    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5)
      .text("BOOKING #", col1x, infoTop + 58);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10)
      .text(String(opts.bookingId), col1x, infoTop + 70);

    // ── Agreement Title ──────────────────────────────────────────────────────
    doc.moveDown(0.5);
    doc.y = infoTop + 110;
    doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(13)
      .text("Terms & Conditions", 60);
    doc.moveDown(0.3);
    doc.moveTo(60, doc.y).lineTo(60 + PAGE_WIDTH, doc.y).strokeColor("#dddddd").lineWidth(1).stroke();
    doc.moveDown(0.5);

    // ── Agreement Body ───────────────────────────────────────────────────────
    doc.fillColor(DARK).font("Helvetica").fontSize(9.5).lineGap(3);
    const paragraphs = opts.agreementText.split("\n\n").filter(Boolean);
    for (const para of paragraphs) {
      doc.text(para, 60, doc.y, { width: PAGE_WIDTH, align: "justify" });
      doc.moveDown(0.8);
    }

    // ── Rental Rules & Initials ──────────────────────────────────────────────
    if (opts.ruleInitials && opts.ruleInitials.length > 0) {
      doc.moveDown(0.5);
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(13).text("Rental Rules & Acknowledgments", 60);
      doc.moveDown(0.3);
      doc.moveTo(60, doc.y).lineTo(60 + PAGE_WIDTH, doc.y).strokeColor("#dddddd").lineWidth(1).stroke();
      doc.moveDown(0.5);

      for (const rule of opts.ruleInitials) {
        // Check if we need a new page
        if (doc.y > doc.page.height - 120) doc.addPage();

        const rowTop = doc.y;
        const rowHeight = 44;

        // Rule row background
        doc.rect(60, rowTop, PAGE_WIDTH, rowHeight).fill(LIGHT_GRAY).stroke("#e8e8e8");

        // Initials box on the right
        const initialsBoxW = 56;
        const initialsBoxX = 60 + PAGE_WIDTH - initialsBoxW - 10;
        doc.rect(initialsBoxX, rowTop + 6, initialsBoxW, rowHeight - 12).fill("#ffffff").stroke("#cccccc");
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(14)
          .text(rule.initials, initialsBoxX, rowTop + 13, { width: initialsBoxW, align: "center" });

        // Rule text
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9).text(rule.title, 75, rowTop + 8, { width: PAGE_WIDTH - initialsBoxW - 30 });
        if (rule.fee > 0) {
          doc.fillColor("#92400e").font("Helvetica").fontSize(8)
            .text(`Violation fee: $${rule.fee.toFixed(2)}`, 75, rowTop + 22);
        }

        doc.y = rowTop + rowHeight + 4;
      }

      doc.moveDown(0.5);
      doc.fillColor(MID_GRAY).font("Helvetica-Oblique").fontSize(7.5)
        .text("Each rule above was initialed by the renter, confirming they read and accepted the stated terms.", 60, doc.y, { width: PAGE_WIDTH });
      doc.moveDown(1);
    }

    // ── Signature section ────────────────────────────────────────────────────
    doc.addPage();

    doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(13).text("Electronic Signature", 60, 60);
    doc.moveDown(0.3);
    doc.moveTo(60, doc.y).lineTo(60 + PAGE_WIDTH, doc.y).strokeColor("#dddddd").lineWidth(1).stroke();
    doc.moveDown(1);

    // Signature box
    const sigBoxTop = doc.y;
    doc.rect(60, sigBoxTop, PAGE_WIDTH, 160).fill(LIGHT_GRAY).stroke("#cccccc");

    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8).text("SIGNATURE", 75, sigBoxTop + 10);

    // Embed the drawn signature image
    try {
      const base64 = opts.signatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const imgBuffer = Buffer.from(base64, "base64");
      doc.image(imgBuffer, 75, sigBoxTop + 22, { width: PAGE_WIDTH - 30, height: 120, fit: [PAGE_WIDTH - 30, 120] });
    } catch {
      doc.fillColor(MID_GRAY).font("Helvetica-Oblique").fontSize(10)
        .text("[Signature image unavailable]", 75, sigBoxTop + 60);
    }

    doc.moveDown(0.5);
    const afterSig = sigBoxTop + 175;

    // Divider line under sig box
    doc.moveTo(60, afterSig).lineTo(60 + PAGE_WIDTH, afterSig).strokeColor("#cccccc").lineWidth(1).stroke();

    // Printed name + date row
    const leftX = 60;
    const midX = 300;

    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5)
      .text("PRINTED NAME", leftX, afterSig + 14);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
      .text(opts.signerName, leftX, afterSig + 26);

    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5)
      .text("DATE SIGNED", midX, afterSig + 14);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
      .text(opts.signedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }), midX, afterSig + 26);

    // Legal notice
    doc.moveDown(4);
    doc.fillColor(MID_GRAY).font("Helvetica-Oblique").fontSize(8)
      .text(
        "By providing an electronic signature above, the signer confirms they have read, understood, and agree to all terms and conditions in this rental agreement. This electronic signature is legally binding.",
        60, doc.y, { width: PAGE_WIDTH, align: "center" }
      );

    // ── Footer ───────────────────────────────────────────────────────────────
    const pageHeight = doc.page.height;
    doc.moveTo(60, pageHeight - 50).lineTo(60 + PAGE_WIDTH, pageHeight - 50).strokeColor("#e0e0e0").lineWidth(1).stroke();
    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8)
      .text(`${opts.companyName} · Rental Agreement · Booking #${opts.bookingId}`, 60, pageHeight - 36, { width: PAGE_WIDTH, align: "center" });

    doc.end();
    stream.on("finish", () => resolve(filename));
    stream.on("error", reject);
  });
}
