/**
 * Renders the signature page + acceptances summary as a PDF Buffer.
 * This is always the final page of the merged document.
 */

import PDFDocument from "pdfkit";

const PRIMARY    = "#1b4332";
const LIGHT_GRAY = "#f5f5f5";
const MID_GRAY   = "#666666";
const DARK       = "#111111";

export interface AcceptanceLine {
  checkboxLabel: string;
  accepted: boolean;
  type: "operator" | "platform";
}

export interface SignaturePageOptions {
  companyName:      string;
  bookingId:        number;
  signerName:       string;
  signedAt:         Date;
  signatureDataUrl: string;
  acceptances:      AcceptanceLine[];
  riders?:          string[];
  minors?:          string[];
  ipAddress?:       string;
}

function pageWidth(doc: InstanceType<typeof PDFDocument>) {
  return doc.page.width - 120;
}

export function renderSignaturePage(opts: SignaturePageOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 60, size: "LETTER" });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pw = pageWidth(doc);

    // ── Header ────────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 64).fill(PRIMARY);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(18).text(opts.companyName, 60, 16);
    doc.fillColor("rgba(255,255,255,0.72)").font("Helvetica").fontSize(10)
      .text(`Electronic Signature  ·  Booking #${opts.bookingId}`, 60, 38);

    doc.y = 86;

    // ── Acceptances summary ───────────────────────────────────────────────────
    if (opts.acceptances.length > 0) {
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(12).text("Accepted Agreements & Policies", 60, doc.y);
      doc.moveDown(0.3);
      doc.moveTo(60, doc.y).lineTo(60 + pw, doc.y).strokeColor("#dddddd").lineWidth(1).stroke();
      doc.moveDown(0.5);

      for (const acc of opts.acceptances) {
        if (doc.y > doc.page.height - 60) doc.addPage();
        const rowTop = doc.y;
        const cbX    = 60;
        const cbSize = 11;
        const textX  = cbX + cbSize + 8;
        const textW  = pw - cbSize - 10;

        doc.rect(cbX, rowTop, cbSize, cbSize)
          .fill("#ffffff").stroke(acc.accepted ? "#16a34a" : "#d1d5db");
        if (acc.accepted) {
          doc.save();
          doc.moveTo(cbX + 2, rowTop + 5.5)
            .lineTo(cbX + 4.5, rowTop + 8.5)
            .lineTo(cbX + 9.5, rowTop + 2.5)
            .stroke("#16a34a");
          doc.restore();
        }

        const typeTag = acc.type === "platform" ? " (OutdoorShare)" : "";
        doc.fillColor(DARK).font("Helvetica").fontSize(9)
          .text(`${acc.checkboxLabel}${typeTag}`, textX, rowTop + 1, { width: textW });
        doc.y += 5;
        doc.moveDown(0.3);
      }
      doc.moveDown(0.5);
    }

    // ── Riders / minors ───────────────────────────────────────────────────────
    if ((opts.riders?.length ?? 0) > 0 || (opts.minors?.length ?? 0) > 0) {
      if (doc.y > doc.page.height - 100) doc.addPage();
      doc.moveTo(60, doc.y).lineTo(60 + pw, doc.y).strokeColor("#dddddd").lineWidth(1).stroke();
      doc.moveDown(0.5);
      if (opts.riders?.length) {
        doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5).text("ADDITIONAL RIDERS", 60, doc.y);
        doc.fillColor(DARK).font("Helvetica").fontSize(9).text(opts.riders.join(", "), 60, doc.y + 13, { width: pw });
        doc.moveDown(1.5);
      }
      if (opts.minors?.length) {
        doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5).text("MINORS", 60, doc.y);
        doc.fillColor(DARK).font("Helvetica").fontSize(9).text(opts.minors.join(", "), 60, doc.y + 13, { width: pw });
        doc.moveDown(1.5);
      }
      doc.moveDown(0.5);
    }

    // ── Signature box ─────────────────────────────────────────────────────────
    if (doc.y > doc.page.height - 250) doc.addPage();
    doc.moveTo(60, doc.y).lineTo(60 + pw, doc.y).strokeColor("#dddddd").lineWidth(1).stroke();
    doc.moveDown(0.8);

    const sigBoxTop = doc.y;
    doc.rect(60, sigBoxTop, pw, 155).fill(LIGHT_GRAY).stroke("#cccccc");
    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8).text("SIGNATURE", 75, sigBoxTop + 10);

    try {
      const base64    = opts.signatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const imgBuffer = Buffer.from(base64, "base64");
      doc.image(imgBuffer, 75, sigBoxTop + 22, { width: pw - 30, height: 115, fit: [pw - 30, 115] });
    } catch {
      doc.fillColor(MID_GRAY).font("Helvetica-Oblique").fontSize(10)
        .text("[Signature image unavailable]", 75, sigBoxTop + 60);
    }

    const afterSig = sigBoxTop + 170;
    doc.moveTo(60, afterSig).lineTo(60 + pw, afterSig).strokeColor("#cccccc").lineWidth(1).stroke();

    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5).text("PRINTED NAME", 60, afterSig + 14);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11).text(opts.signerName, 60, afterSig + 26);

    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5).text("DATE SIGNED", 300, afterSig + 14);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(11)
      .text(
        opts.signedAt.toLocaleDateString("en-US", {
          year: "numeric", month: "long", day: "numeric",
          hour: "2-digit", minute: "2-digit",
        }),
        300, afterSig + 26,
      );

    if (opts.ipAddress) {
      doc.fillColor(MID_GRAY).font("Helvetica").fontSize(7.5)
        .text(`IP: ${opts.ipAddress}`, 60, afterSig + 48);
    }

    doc.y = afterSig + 62;
    doc.moveDown(0.5);
    doc.fillColor(MID_GRAY).font("Helvetica-Oblique").fontSize(8)
      .text(
        "By providing an electronic signature above, the signer confirms they have read, understood, and agree to all terms and conditions in this rental agreement. This electronic signature is legally binding.",
        60, doc.y, { width: pw, align: "center" }
      );

    // ── Footer ─────────────────────────────────────────────────────────────────
    const ph = doc.page.height;
    doc.moveTo(60, ph - 50).lineTo(60 + pw, ph - 50).strokeColor("#e0e0e0").lineWidth(1).stroke();
    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8)
      .text(`${opts.companyName}  ·  Rental Agreement  ·  Booking #${opts.bookingId}`, 60, ph - 36, {
        width: pw, align: "center",
      });

    doc.end();
  });
}
