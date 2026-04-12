import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import { randomBytes } from "crypto";
import ExcelJS from "exceljs";
import { Readable } from "stream";
import { objectStorageClient } from "../lib/objectStorage";

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID!;

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

const memStorage = multer.memoryStorage();

const upload = multer({
  storage: memStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (jpg, png, webp, gif)"));
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

const router: IRouter = Router();

router.post("/upload/image", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  try {
    const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
    const filename = randomBytes(12).toString("hex") + ext;
    await uploadBufferToGCS(req.file.buffer, filename, req.file.mimetype);
    const url = `/api/uploads/${filename}`;
    res.json({ url, filename });
  } catch (err: any) {
    console.error("[upload] GCS upload failed:", err);
    res.status(500).json({ error: "Upload failed" });
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
