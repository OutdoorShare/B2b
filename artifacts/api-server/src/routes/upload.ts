import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import ExcelJS from "exceljs";
import { Readable } from "stream";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".png";
    const name = randomBytes(12).toString("hex") + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
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

// Multer for spreadsheet uploads — xlsx and CSV only, 10 MB limit, memory storage
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

router.post("/upload/image", upload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const url = `/api/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// POST /upload/parse-spreadsheet — parse an .xlsx or .csv file server-side (no xlsx package)
// Returns { rows: string[][] } where the first row is headers.
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
