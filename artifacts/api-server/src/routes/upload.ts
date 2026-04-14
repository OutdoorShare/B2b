import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import { randomBytes } from "crypto";
import ExcelJS from "exceljs";
import { Readable } from "stream";
import { objectStorageClient } from "../lib/objectStorage";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 MB
const ALLOWED_MIME    = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

// ── GCS helpers ───────────────────────────────────────────────────────────────

export async function uploadBufferToGCS(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<void> {
  const bucket = objectStorageClient.bucket(BUCKET_ID);
  const file = bucket.file(`uploads/${filename}`);
  await file.save(buffer, { contentType, resumable: false });
}

export async function downloadFromGCS(filename: string): Promise<{ stream: Readable; contentType: string } | null> {
  try {
    const bucket = objectStorageClient.bucket(BUCKET_ID);
    const file = bucket.file(`uploads/${filename}`);
    const [exists] = await file.exists();
    if (!exists) return null;
    const [metadata] = await file.getMetadata();
    const contentType = (metadata as any).contentType ?? "application/octet-stream";
    const stream = file.createReadStream();
    return { stream, contentType };
  } catch {
    return null;
  }
}

// ── Multer configs ────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES },
  fileFilter: (_req, file, cb) => {
    if ((ALLOWED_MIME as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type "${file.mimetype}". Allowed: ${ALLOWED_MIME.join(", ")}`));
    }
  },
});

const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".xlsx", ".csv"];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx and .csv files are allowed"));
    }
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

router.post("/upload/image", upload.single("file"), async (req, res) => {
  const logCtx = {
    route:       "POST /upload/image",
    environment: process.env.NODE_ENV ?? "development",
    ip:          req.ip ?? "unknown",
  };

  // ── Boundary 1: file must be present ─────────────────────────────────────
  if (!req.file) {
    console.warn("[upload] rejected: no file in request", logCtx);
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  // ── Boundary 2: MIME type (double-check after multer filter) ─────────────
  if (!(ALLOWED_MIME as readonly string[]).includes(req.file.mimetype)) {
    console.warn("[upload] rejected: disallowed mime type", {
      ...logCtx,
      mimetype: req.file.mimetype,
    });
    res.status(415).json({ error: `File type not allowed: ${req.file.mimetype}` });
    return;
  }

  // ── Boundary 3: file size (double-check after multer limit) ──────────────
  if (req.file.size > MAX_IMAGE_BYTES) {
    console.warn("[upload] rejected: file too large", {
      ...logCtx,
      sizeBytes: req.file.size,
      maxBytes:  MAX_IMAGE_BYTES,
    });
    res.status(413).json({ error: `File too large. Maximum size is ${MAX_IMAGE_BYTES / 1024 / 1024} MB` });
    return;
  }

  const ext      = path.extname(req.file.originalname).toLowerCase() || ".png";
  const filename = randomBytes(12).toString("hex") + ext;

  console.info("[upload] starting image upload", {
    ...logCtx,
    filename,
    mimetype:  req.file.mimetype,
    sizeBytes: req.file.size,
    original:  req.file.originalname,
  });

  try {
    await uploadBufferToGCS(req.file.buffer, filename, req.file.mimetype);

    const url = `/api/uploads/${filename}`;

    console.info("[upload] image upload succeeded", {
      ...logCtx,
      filename,
      url,
      sizeBytes: req.file.size,
    });

    res.json({ url, filename });
  } catch (err: any) {
    console.error("[upload] GCS upload failed", {
      ...logCtx,
      filename,
      errorMessage: err?.message ?? String(err),
      errorName:    err?.name,
    });
    res.status(500).json({ error: "Upload failed — please try again" });
  }
});

router.post("/upload/parse-spreadsheet", spreadsheetUpload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const wb = new ExcelJS.Workbook();
    const buf = req.file.buffer;

    if (ext === ".csv") {
      const stream = Readable.from(buf.toString("utf8"));
      await wb.csv.read(stream);
    } else {
      await wb.xlsx.load(buf);
    }

    const sheet = wb.worksheets[0];
    if (!sheet) {
      res.status(422).json({ error: "Spreadsheet has no sheets" });
      return;
    }

    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => {
        const v = cell.value;
        if (v == null) {
          cells.push("");
        } else if (typeof v === "object" && "richText" in (v as any)) {
          cells.push((v as any).richText.map((r: any) => r.text).join(""));
        } else if (typeof v === "object" && "result" in (v as any)) {
          cells.push(String((v as any).result ?? ""));
        } else {
          cells.push(String(v));
        }
      });
      rows.push(cells);
    });

    res.json({ rows });
  } catch (err: any) {
    res.status(422).json({ error: err.message ?? "Failed to parse spreadsheet" });
  }
});

export default router;
