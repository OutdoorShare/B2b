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

    // ── Footer (signature page) ───────────────────────────────────────────────
    const pageHeight = doc.page.height;
    doc.moveTo(60, pageHeight - 50).lineTo(60 + PAGE_WIDTH, pageHeight - 50).strokeColor("#e0e0e0").lineWidth(1).stroke();
    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8)
      .text(`${opts.companyName} · Rental Agreement · Booking #${opts.bookingId}`, 60, pageHeight - 36, { width: PAGE_WIDTH, align: "center" });

    // ── Rental Rules Addendum ─────────────────────────────────────────────────
    if (opts.ruleInitials && opts.ruleInitials.length > 0) {
      doc.addPage();

      // Addendum header bar
      doc.rect(0, 0, doc.page.width, 64).fill(PRIMARY);
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(16)
        .text(opts.companyName, 60, 14);
      doc.fillColor("rgba(255,255,255,0.75)").font("Helvetica").fontSize(10)
        .text("Rental Rules Addendum  ·  Booking #" + opts.bookingId, 60, 36);

      // Subheading
      doc.fillColor(DARK).y = 84;
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(12)
        .text("Acknowledged Rental Rules", 60, 84);
      doc.moveDown(0.2);
      doc.moveTo(60, doc.y).lineTo(60 + PAGE_WIDTH, doc.y).strokeColor("#dddddd").lineWidth(1).stroke();
      doc.moveDown(0.3);
      doc.fillColor(MID_GRAY).font("Helvetica").fontSize(9)
        .text(
          `The renter (${opts.customerName}) confirmed the following rules by checking each box prior to signing the rental agreement for "${opts.listingTitle}".`,
          60, doc.y, { width: PAGE_WIDTH }
        );
      doc.moveDown(0.8);

      // Rule rows with checkboxes
      for (const rule of opts.ruleInitials) {
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
          // Continuation header
          doc.fillColor(MID_GRAY).font("Helvetica-Oblique").fontSize(8)
            .text(`Rental Rules Addendum (continued) · Booking #${opts.bookingId}`, 60, 30, { width: PAGE_WIDTH, align: "center" });
          doc.y = 60;
        }

        const rowTop = doc.y;
        const acknowledged = rule.initials === "✓" || rule.initials.length > 0;

        // Row background — green tint if acknowledged
        const rowBg = acknowledged ? "#f0fdf4" : "#fff7f7";
        const rowBorder = acknowledged ? "#bbf7d0" : "#fee2e2";
        doc.rect(60, rowTop, PAGE_WIDTH, 46).fill(rowBg).stroke(rowBorder);

        // Draw checkbox (square with checkmark if acknowledged)
        const cbX = 75;
        const cbY = rowTop + 13;
        const cbSize = 14;
        doc.rect(cbX, cbY, cbSize, cbSize).fill("#ffffff").stroke(acknowledged ? "#16a34a" : "#d1d5db");
        if (acknowledged) {
          // Draw checkmark
          doc.save();
          doc.moveTo(cbX + 2.5, cbY + 7)
            .lineTo(cbX + 5.5, cbY + 10.5)
            .lineTo(cbX + 11.5, cbY + 3.5)
            .stroke("#16a34a");
          doc.restore();
        }

        // Rule title
        const textX = cbX + cbSize + 10;
        const textW = PAGE_WIDTH - cbSize - 20;
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9.5)
          .text(rule.title, textX, rowTop + 8, { width: textW - 30 });

        // Fee badge on the right if present
        if (rule.fee > 0) {
          const feeText = `Fee: $${rule.fee.toFixed(2)}`;
          const feeX = 60 + PAGE_WIDTH - 90;
          doc.fillColor("#92400e").font("Helvetica").fontSize(8)
            .text(feeText, feeX, rowTop + 28, { width: 84, align: "right" });
        }

        // "Acknowledged" label
        doc.fillColor(acknowledged ? "#15803d" : "#dc2626").font("Helvetica").fontSize(7.5)
          .text(acknowledged ? "✓ Acknowledged" : "Not acknowledged", textX, rowTop + 30);

        doc.y = rowTop + 46 + 4;
      }

      doc.moveDown(1);
      doc.fillColor(MID_GRAY).font("Helvetica-Oblique").fontSize(7.5)
        .text(
          `Each rule above was acknowledged by ${opts.customerName} by checking the corresponding checkbox in the online booking flow prior to signing the rental agreement. This addendum is part of the rental agreement for Booking #${opts.bookingId}.`,
          60, doc.y, { width: PAGE_WIDTH }
        );

      // Addendum footer
      const addendumPageH = doc.page.height;
      doc.moveTo(60, addendumPageH - 50)
        .lineTo(60 + PAGE_WIDTH, addendumPageH - 50)
        .strokeColor("#e0e0e0").lineWidth(1).stroke();
      doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8)
        .text(
          `${opts.companyName} · Rental Rules Addendum · Booking #${opts.bookingId}`,
          60, addendumPageH - 36, { width: PAGE_WIDTH, align: "center" }
        );
    }

    doc.end();
    stream.on("finish", () => resolve(filename));
    stream.on("error", reject);
  });
}
