import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

export interface RuleInitialEntry {
  ruleId: number;
  title: string;
  description?: string;
  fee: number;
  initials: string;
  initialedAt: string;
}

// ── v2 multi-section types ─────────────────────────────────────────────────
export interface AgreementSection {
  title: string;
  content: string;
}

export interface AcceptanceEntry {
  checkboxLabel: string;
  accepted: boolean;
  type: "operator" | "platform" | "rule";
}

export interface AgreementPdfOptions {
  bookingId: number;
  companyName: string;
  customerName: string;
  customerEmail: string;
  listingTitle: string;
  startDate: string;
  endDate: string;
  // v1 compat
  agreementText?: string;
  // v2 multi-section
  sections?: AgreementSection[];
  acceptances?: AcceptanceEntry[];
  additionalRiders?: string[];
  minors?: string[];
  // shared
  signerName: string;
  signedAt: Date;
  signatureDataUrl: string;
  ruleInitials?: RuleInitialEntry[];
  serialNumber?: string | null;
  estimatedValue?: string | number | null;
}

// ── Helper: draw section header ────────────────────────────────────────────
function drawSectionHeader(
  doc: InstanceType<typeof PDFDocument>,
  title: string,
  color: string,
  pageWidth: number,
) {
  if (doc.y > doc.page.height - 140) doc.addPage();
  doc.fillColor(color).font("Helvetica-Bold").fontSize(12).text(title, 60, doc.y);
  doc.moveDown(0.25);
  doc.moveTo(60, doc.y)
    .lineTo(60 + pageWidth, doc.y)
    .strokeColor("#dddddd")
    .lineWidth(1)
    .stroke();
  doc.moveDown(0.5);
}

// ── Helper: draw body text ─────────────────────────────────────────────────
function drawBody(
  doc: InstanceType<typeof PDFDocument>,
  text: string,
  pageWidth: number,
  dark: string,
) {
  const paragraphs = text.split("\n\n").filter(Boolean);
  for (const para of paragraphs) {
    if (doc.y > doc.page.height - 100) doc.addPage();
    doc.fillColor(dark).font("Helvetica").fontSize(9.5).lineGap(3)
      .text(para.trim(), 60, doc.y, { width: pageWidth, align: "justify" });
    doc.moveDown(0.8);
  }
}

export async function generateAgreementPdf(opts: AgreementPdfOptions): Promise<string> {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const filename = `agreement-${opts.bookingId}-${randomBytes(6).toString("hex")}.pdf`;
  const filepath = path.join(UPLOADS_DIR, filename);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 60, size: "LETTER" });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);

    const PRIMARY    = "#1b4332";
    const LIGHT_GRAY = "#f5f5f5";
    const MID_GRAY   = "#666666";
    const DARK       = "#111111";
    const PAGE_WIDTH = doc.page.width - 120;

    // ── Header bar ───────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 72).fill(PRIMARY);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20)
      .text(opts.companyName, 60, 22);
    doc.fillColor("rgba(255,255,255,0.75)").font("Helvetica").fontSize(11)
      .text("Rental Agreement", 60, 46);
    doc.fillColor(DARK).moveDown(3);

    // ── Booking Info box ─────────────────────────────────────────────────────
    const infoTop    = 92;
    const hasSerial  = !!opts.serialNumber;
    const hasValue   = opts.estimatedValue != null && opts.estimatedValue !== "";
    const hasRiders  = (opts.additionalRiders?.length ?? 0) > 0;
    const hasMinors  = (opts.minors?.length ?? 0) > 0;
    const extraRows  = (hasSerial || hasValue ? 1 : 0) + (hasRiders || hasMinors ? 1 : 0);
    const infoHeight = 90 + extraRows * 36;

    doc.rect(60, infoTop, PAGE_WIDTH, infoHeight).fill(LIGHT_GRAY).stroke("#e0e0e0");

    const col1x = 75;
    const col2x = 300;

    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5);
    doc.text("CUSTOMER", col1x, infoTop + 12);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(opts.customerName, col1x, infoTop + 24);
    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5).text(opts.customerEmail, col1x, infoTop + 38);

    doc.text("RENTAL ITEM", col2x, infoTop + 12);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(opts.listingTitle, col2x, infoTop + 24);
    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5)
      .text(`${opts.startDate}  →  ${opts.endDate}`, col2x, infoTop + 38);

    doc.text("BOOKING #", col1x, infoTop + 58);
    doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(String(opts.bookingId), col1x, infoTop + 70);

    if (hasSerial) {
      doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5).text("VIN / HIN / SERIAL #", col2x, infoTop + 58);
      doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(opts.serialNumber!, col2x, infoTop + 70);
    }
    if (hasValue) {
      const valueDisplay = `$${parseFloat(String(opts.estimatedValue)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (hasSerial) {
        doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5).text("ESTIMATED VALUE", col1x, infoTop + 82);
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(valueDisplay, col1x, infoTop + 94);
      } else {
        doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5).text("ESTIMATED VALUE", col2x, infoTop + 58);
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(10).text(valueDisplay, col2x, infoTop + 70);
      }
    }
    if (hasRiders || hasMinors) {
      const riderRow = infoTop + 90 + (hasSerial || hasValue ? 36 : 0) - 18;
      if (hasRiders) {
        doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5).text("ADDITIONAL RIDERS", col1x, riderRow);
        doc.fillColor(DARK).font("Helvetica").fontSize(8.5)
          .text((opts.additionalRiders ?? []).join(", "), col1x, riderRow + 12);
      }
      if (hasMinors) {
        doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5).text("MINORS", col2x, riderRow);
        doc.fillColor(DARK).font("Helvetica").fontSize(8.5)
          .text((opts.minors ?? []).join(", "), col2x, riderRow + 12);
      }
    }

    // ── Agreement sections ───────────────────────────────────────────────────
    doc.y = infoTop + infoHeight + 20;

    if (opts.sections && opts.sections.length > 0) {
      // v2 path — render each section
      for (const section of opts.sections) {
        drawSectionHeader(doc, section.title, PRIMARY, PAGE_WIDTH);
        if (section.content) {
          drawBody(doc, section.content, PAGE_WIDTH, DARK);
        }
        doc.moveDown(0.5);
      }
    } else if (opts.agreementText) {
      // v1 fallback
      drawSectionHeader(doc, "Terms & Conditions", PRIMARY, PAGE_WIDTH);
      drawBody(doc, opts.agreementText, PAGE_WIDTH, DARK);
    }

    // ── Rental Rules (v1 ruleInitials body section) ─────────────────────────
    if (opts.ruleInitials && opts.ruleInitials.length > 0) {
      if (doc.y > doc.page.height - 150) doc.addPage();
      doc.moveDown(0.5);
      doc.moveTo(60, doc.y).lineTo(60 + PAGE_WIDTH, doc.y).strokeColor("#dddddd").lineWidth(1).stroke();
      doc.moveDown(0.5);
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(11)
        .text("RENTAL RULES & POLICIES", 60, doc.y);
      doc.moveDown(0.3);
      doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5)
        .text(
          `The following rules apply specifically to the rental of "${opts.listingTitle}". The renter must acknowledge each rule prior to signing.`,
          60, doc.y, { width: PAGE_WIDTH }
        );
      doc.moveDown(0.6);
      for (let idx = 0; idx < opts.ruleInitials.length; idx++) {
        const rule = opts.ruleInitials[idx];
        if (doc.y > doc.page.height - 80) doc.addPage();
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9.5)
          .text(`${idx + 1}. ${rule.title}`, 60, doc.y, { width: PAGE_WIDTH - 80 });
        if (rule.description) {
          doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8.5)
            .text(rule.description, 75, doc.y, { width: PAGE_WIDTH - 30 });
        }
        if (rule.fee > 0) {
          doc.fillColor("#92400e").font("Helvetica").fontSize(8)
            .text(`Violation fee: $${rule.fee.toFixed(2)}`, 75, doc.y);
        }
        doc.moveDown(0.5);
      }
      doc.moveDown(0.3);
      doc.fillColor(DARK).font("Helvetica-Oblique").fontSize(8.5)
        .text(
          "By signing this agreement, the renter confirms they have read, understood, and agree to all rules and policies listed above.",
          60, doc.y, { width: PAGE_WIDTH }
        );
    }

    // ── Acceptances summary (v2) ──────────────────────────────────────────────
    if (opts.acceptances && opts.acceptances.length > 0) {
      if (doc.y > doc.page.height - 200) doc.addPage();
      doc.moveDown(1);
      doc.moveTo(60, doc.y).lineTo(60 + PAGE_WIDTH, doc.y).strokeColor("#dddddd").lineWidth(1).stroke();
      doc.moveDown(0.5);
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(11)
        .text("ACCEPTED AGREEMENTS & POLICIES", 60, doc.y);
      doc.moveDown(0.5);

      for (const acc of opts.acceptances) {
        if (doc.y > doc.page.height - 60) doc.addPage();
        const rowTop = doc.y;
        const cbX    = 60;
        const cbSize = 11;
        const textX  = cbX + cbSize + 8;
        const textW  = PAGE_WIDTH - cbSize - 10;

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

        doc.fillColor(DARK).font("Helvetica").fontSize(9)
          .text(acc.checkboxLabel, textX, rowTop + 1, { width: textW });
        doc.y = doc.y + 5;
        doc.moveDown(0.3);
      }
    }

    // ── Signature page ───────────────────────────────────────────────────────
    doc.addPage();
    doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(13).text("Electronic Signature", 60, 60);
    doc.moveDown(0.3);
    doc.moveTo(60, doc.y).lineTo(60 + PAGE_WIDTH, doc.y).strokeColor("#dddddd").lineWidth(1).stroke();
    doc.moveDown(1);

    const sigBoxTop = doc.y;
    doc.rect(60, sigBoxTop, PAGE_WIDTH, 160).fill(LIGHT_GRAY).stroke("#cccccc");
    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8).text("SIGNATURE", 75, sigBoxTop + 10);

    try {
      const base64    = opts.signatureDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const imgBuffer = Buffer.from(base64, "base64");
      doc.image(imgBuffer, 75, sigBoxTop + 22, { width: PAGE_WIDTH - 30, height: 120, fit: [PAGE_WIDTH - 30, 120] });
    } catch {
      doc.fillColor(MID_GRAY).font("Helvetica-Oblique").fontSize(10)
        .text("[Signature image unavailable]", 75, sigBoxTop + 60);
    }

    doc.moveDown(0.5);
    const afterSig = sigBoxTop + 175;
    doc.moveTo(60, afterSig).lineTo(60 + PAGE_WIDTH, afterSig).strokeColor("#cccccc").lineWidth(1).stroke();

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

    doc.moveDown(4);
    doc.fillColor(MID_GRAY).font("Helvetica-Oblique").fontSize(8)
      .text(
        "By providing an electronic signature above, the signer confirms they have read, understood, and agree to all terms and conditions in this rental agreement. This electronic signature is legally binding.",
        60, doc.y, { width: PAGE_WIDTH, align: "center" }
      );

    const pageH = doc.page.height;
    doc.moveTo(60, pageH - 50).lineTo(60 + PAGE_WIDTH, pageH - 50).strokeColor("#e0e0e0").lineWidth(1).stroke();
    doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8)
      .text(`${opts.companyName} · Rental Agreement · Booking #${opts.bookingId}`, 60, pageH - 36, { width: PAGE_WIDTH, align: "center" });

    // ── Rules addendum (v1 compatibility) ─────────────────────────────────────
    if (opts.ruleInitials && opts.ruleInitials.length > 0) {
      doc.addPage();
      doc.rect(0, 0, doc.page.width, 64).fill(PRIMARY);
      doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(16).text(opts.companyName, 60, 14);
      doc.fillColor("rgba(255,255,255,0.75)").font("Helvetica").fontSize(10)
        .text("Rental Rules Addendum  ·  Booking #" + opts.bookingId, 60, 36);

      doc.fillColor(DARK);
      doc.fillColor(PRIMARY).font("Helvetica-Bold").fontSize(12).text("Acknowledged Rental Rules", 60, 84);
      doc.moveDown(0.2);
      doc.moveTo(60, doc.y).lineTo(60 + PAGE_WIDTH, doc.y).strokeColor("#dddddd").lineWidth(1).stroke();
      doc.moveDown(0.3);
      doc.fillColor(MID_GRAY).font("Helvetica").fontSize(9)
        .text(
          `The renter (${opts.customerName}) confirmed the following rules by checking each box prior to signing the rental agreement for "${opts.listingTitle}".`,
          60, doc.y, { width: PAGE_WIDTH }
        );
      doc.moveDown(0.8);

      for (const rule of opts.ruleInitials) {
        if (doc.y > doc.page.height - 100) {
          doc.addPage();
          doc.fillColor(MID_GRAY).font("Helvetica-Oblique").fontSize(8)
            .text(`Rental Rules Addendum (continued) · Booking #${opts.bookingId}`, 60, 30, { width: PAGE_WIDTH, align: "center" });
          doc.y = 60;
        }
        const rowTop      = doc.y;
        const acknowledged = rule.initials === "✓" || rule.initials.length > 0;
        const rowBg        = acknowledged ? "#f0fdf4" : "#fff7f7";
        const rowBorder    = acknowledged ? "#bbf7d0" : "#fee2e2";
        doc.rect(60, rowTop, PAGE_WIDTH, 46).fill(rowBg).stroke(rowBorder);
        const cbX = 75; const cbY = rowTop + 13; const cbSize = 14;
        doc.rect(cbX, cbY, cbSize, cbSize).fill("#ffffff").stroke(acknowledged ? "#16a34a" : "#d1d5db");
        if (acknowledged) {
          doc.save();
          doc.moveTo(cbX + 2.5, cbY + 7)
            .lineTo(cbX + 5.5, cbY + 10.5)
            .lineTo(cbX + 11.5, cbY + 3.5)
            .stroke("#16a34a");
          doc.restore();
        }
        const textX = cbX + cbSize + 10;
        const textW = PAGE_WIDTH - cbSize - 20;
        doc.fillColor(DARK).font("Helvetica-Bold").fontSize(9.5)
          .text(rule.title, textX, rowTop + 8, { width: textW - 30 });
        if (rule.fee > 0) {
          const feeX = 60 + PAGE_WIDTH - 90;
          doc.fillColor("#92400e").font("Helvetica").fontSize(8)
            .text(`Fee: $${rule.fee.toFixed(2)}`, feeX, rowTop + 28, { width: 84, align: "right" });
        }
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
      const addH = doc.page.height;
      doc.moveTo(60, addH - 50).lineTo(60 + PAGE_WIDTH, addH - 50).strokeColor("#e0e0e0").lineWidth(1).stroke();
      doc.fillColor(MID_GRAY).font("Helvetica").fontSize(8)
        .text(`${opts.companyName} · Rental Rules Addendum · Booking #${opts.bookingId}`, 60, addH - 36, { width: PAGE_WIDTH, align: "center" });
    }

    doc.end();
    stream.on("finish", () => resolve(filename));
    stream.on("error", reject);
  });
}
