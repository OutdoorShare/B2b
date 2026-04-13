/**
 * Merges multiple PDF Buffers into one using pdf-lib.
 * Returns the merged PDF as a Buffer.
 */

import { PDFDocument } from "pdf-lib";

export async function mergePdfs(pdfBuffers: Buffer[]): Promise<Buffer> {
  if (pdfBuffers.length === 0) throw new Error("mergePdfs: no PDFs provided");
  if (pdfBuffers.length === 1) return pdfBuffers[0];

  const merged = await PDFDocument.create();

  for (const buf of pdfBuffers) {
    try {
      const src = await PDFDocument.load(buf);
      const pageIndices = src.getPageIndices();
      const copiedPages = await merged.copyPages(src, pageIndices);
      for (const page of copiedPages) merged.addPage(page);
    } catch (err) {
      // Skip malformed PDFs but log
      console.error("[mergePdfs] Failed to load one PDF, skipping:", err);
    }
  }

  const bytes = await merged.save();
  return Buffer.from(bytes);
}

/**
 * Stamp document metadata into the final PDF (author, title, subject, keywords).
 */
export async function stampMetadata(
  pdfBuffer: Buffer,
  meta: { title: string; author: string; subject: string; keywords?: string[] },
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBuffer);
  doc.setTitle(meta.title);
  doc.setAuthor(meta.author);
  doc.setSubject(meta.subject);
  if (meta.keywords?.length) doc.setKeywords(meta.keywords);
  doc.setCreationDate(new Date());
  doc.setModificationDate(new Date());
  const bytes = await doc.save();
  return Buffer.from(bytes);
}
