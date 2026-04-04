import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { adminPath, getAdminSession } from "@/lib/admin-nav";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, XCircle,
  AlertCircle, Download, Loader2, ChevronRight, RotateCcw,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const COLUMN_MAP: Record<string, string> = {
  name: "name",
  product: "name",
  item: "name",
  title: "name",
  sku: "sku",
  "item #": "sku",
  vin: "serialNumber",
  hin: "serialNumber",
  "serial number": "serialNumber",
  serial: "serialNumber",
  "serial #": "serialNumber",
  serial_number: "serialNumber",
  "vehicle id number": "serialNumber",
  "hull id number": "serialNumber",
  "vin/hin": "serialNumber",
  "vin / hin": "serialNumber",
  "registration number": "serialNumber",
  vin_hin_serial: "serialNumber",
  "vin/hin/serial": "serialNumber",
  category: "category",
  "category name": "category",
  description: "description",
  desc: "description",
  status: "status",
  condition: "status",
  qty: "quantity",
  quantity: "quantity",
  stock: "quantity",
  count: "quantity",
  year: "year",
  "model year": "year",
  "yr": "year",
  brand: "brand",
  manufacturer: "brand",
  make: "brand",
  model: "model",
  specs: "specs",
  specifications: "specs",
  notes: "notes",
  "internal notes": "notes",
  "next maintenance": "nextMaintenanceDate",
  "maintenance date": "nextMaintenanceDate",
  "next service": "nextMaintenanceDate",
  "service date": "nextMaintenanceDate",
};

const REQUIRED_FIELDS = ["name"];

const FIELD_LABELS: Record<string, string> = {
  name: "Product Name",
  sku: "SKU / Item #",
  serialNumber: "VIN / HIN / Serial #",
  year: "Year",
  category: "Category",
  description: "Description",
  status: "Status",
  quantity: "Quantity",
  brand: "Brand",
  model: "Model",
  specs: "Specs",
  notes: "Notes",
  nextMaintenanceDate: "Next Maintenance",
};

interface ParsedRow {
  _rowIndex: number;
  _errors: string[];
  _warnings: string[];
  name?: string;
  sku?: string;
  serialNumber?: string;
  year?: string;
  category?: string;
  description?: string;
  status?: string;
  quantity?: string;
  brand?: string;
  model?: string;
  specs?: string;
  notes?: string;
  nextMaintenanceDate?: string;
  [key: string]: any;
}

const VALID_STATUS = ["available", "maintenance", "damaged", "reserved", "out_of_service"];

function buildFallbackName(row: ParsedRow): string {
  return [row.year?.trim(), row.brand?.trim(), row.model?.trim()]
    .filter(Boolean)
    .join(" ");
}

function validateRow(row: ParsedRow, categoryNames: Set<string>): ParsedRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.name?.trim()) {
    const fallback = buildFallbackName(row);
    if (fallback) {
      row = { ...row, name: fallback };
      warnings.push(`No name provided — using "${fallback}" from Make / Model`);
    } else {
      errors.push("Product name is required (or provide Make / Model)");
    }
  }

  if (row.quantity && row.quantity.trim() !== "") {
    const q = parseInt(row.quantity);
    if (isNaN(q) || q < 1) warnings.push("Quantity must be a positive integer — will default to 1");
  }

  if (row.status && !VALID_STATUS.includes(row.status.toLowerCase().replace(/\s/g, "_"))) {
    warnings.push(`Status "${row.status}" not recognized — will default to "available"`);
  }

  if (row.category && categoryNames.size > 0 && !categoryNames.has(row.category.toLowerCase().trim())) {
    warnings.push(`Category "${row.category}" not found — product will have no category`);
  }

  if (row.nextMaintenanceDate && row.nextMaintenanceDate.trim()) {
    const d = new Date(row.nextMaintenanceDate);
    if (isNaN(d.getTime())) warnings.push("Next Maintenance date is not a valid date — will be skipped");
  }

  return { ...row, _errors: errors, _warnings: warnings };
}

type Step = "upload" | "map" | "verify" | "result";

interface ImportResult {
  created: number;
  errors: { row: number; error: string }[];
  total: number;
}

export default function AdminInventoryImport() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [categoryNames, setCategoryNames] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawDataRows, setRawDataRows] = useState<any[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  const errorCount = parsedRows.filter(r => r._errors.length > 0).length;
  const warnCount = parsedRows.filter(r => r._warnings.length > 0 && r._errors.length === 0).length;
  const validCount = parsedRows.filter(r => r._errors.length === 0).length;

  const loadCategories = useCallback(async () => {
    try {
      const s = getAdminSession();
      const headers: Record<string, string> = s?.token ? { "x-admin-token": s.token } : {};
      const res = await fetch(`${BASE}/api/categories`, { headers });
      if (res.ok) {
        const cats = await res.json();
        setCategoryNames(new Set(cats.map((c: any) => c.name.toLowerCase())));
      }
    } catch { /* non-critical */ }
  }, []);

  const parseFile = useCallback(async (file: File) => {
    if (!file) return;
    setFileName(file.name);
    await loadCategories();

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = xlsxRead(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawRows: any[][] = xlsxUtils.sheet_to_json(sheet, { header: 1, defval: "" });

        if (rawRows.length < 2) {
          toast({ title: "File appears empty", description: "The spreadsheet needs at least a header row and one data row.", variant: "destructive" });
          return;
        }

        const headers: string[] = rawRows[0].map((h: any) => String(h ?? "").trim());
        const dataRows = rawRows.slice(1).filter(row => row.some((cell: any) => cell !== "" && cell != null));

        const initialMapping: Record<string, string> = {};
        headers.forEach(h => {
          initialMapping[h] = COLUMN_MAP[h.toLowerCase()] ?? "";
        });

        setRawHeaders(headers);
        setRawDataRows(dataRows);
        setColumnMapping(initialMapping);
        setStep("map");
      } catch {
        toast({ title: "Failed to parse file", description: "Make sure the file is a valid Excel (.xlsx, .xls) or CSV file.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  }, [loadCategories, toast]);

  const applyMapping = useCallback(() => {
    const parsed: ParsedRow[] = rawDataRows.map((row: any[], idx) => {
      const obj: ParsedRow = { _rowIndex: idx + 2, _errors: [], _warnings: [] };
      rawHeaders.forEach((header, colIdx) => {
        const field = columnMapping[header];
        if (field) {
          const val = row[colIdx] != null ? String(row[colIdx]).trim() : "";
          obj[field] = val;
        }
      });
      return validateRow(obj, categoryNames);
    });
    setParsedRows(parsed);
    setStep("verify");
  }, [rawHeaders, rawDataRows, columnMapping, categoryNames]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r._errors.length === 0);
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const s = getAdminSession();
      const token = s?.token;

      const payload = validRows.map(r => ({
        name: r.name,
        sku: r.sku || null,
        serialNumber: r.serialNumber || null,
        year: r.year ? parseInt(r.year) || null : null,
        category: r.category || null,
        description: r.description || null,
        status: r.status?.toLowerCase().replace(/\s/g, "_") || "available",
        quantity: r.quantity ? parseInt(r.quantity) || 1 : 1,
        brand: r.brand || null,
        model: r.model || null,
        specs: r.specs || null,
        notes: r.notes || null,
        nextMaintenanceDate: r.nextMaintenanceDate?.trim() || null,
      }));

      const res = await fetch(`${BASE}/api/products/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-admin-token": token } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok && res.status !== 207) {
        toast({ title: "Import failed", description: data.error ?? "Unknown error", variant: "destructive" });
        return;
      }
      setResult(data);
      setStep("result");
    } catch {
      toast({ title: "Connection error", description: "Please try again.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setFileName("");
    setResult(null);
    setRawHeaders([]);
    setRawDataRows([]);
    setColumnMapping({});
    setStep("upload");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadTemplate = async () => {
    const { utils, writeFile } = await import("xlsx");
    const headers = [
      "name", "sku", "vin_hin_serial", "category", "description", "status",
      "quantity", "brand", "model", "specs", "notes", "next_maintenance",
    ];
    const example = [
      "2022 Sea-Doo Spark", "SD-001", "YAMA1234567890AB", "Jet Ski",
      "Fun personal watercraft, great for beginners", "available",
      "2", "Sea-Doo", "Spark 90HP", "90HP engine, 3-seater",
      "Purchased 2022", "2025-06-01",
    ];
    const ws = utils.aoa_to_sheet([headers, example]);
    ws["!cols"] = headers.map(() => ({ wch: 22 }));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Inventory");
    writeFile(wb, "inventory-import-template.xlsx");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(adminPath("/inventory"))}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import Inventory</h1>
          <p className="text-muted-foreground text-sm">Upload an Excel or CSV file to create multiple products at once</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "map", "verify", "result"] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <span className={`font-medium ${step === s ? "text-foreground" : "text-muted-foreground"}`}>
              {i + 1}. {s === "upload" ? "Upload File" : s === "map" ? "Map Columns" : s === "verify" ? "Verify Data" : "Results"}
            </span>
          </div>
        ))}
      </div>

      {/* ── STEP 1: UPLOAD ── */}
      {step === "upload" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                  ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}`}
              >
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-semibold mb-1">Drop your spreadsheet here</p>
                <p className="text-muted-foreground text-sm mb-4">Supports .xlsx, .xls, and .csv files</p>
                <Button variant="outline" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  <Upload className="h-4 w-4 mr-2" />
                  Browse Files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                Supported column format
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </CardTitle>
              <CardDescription>
                Your spreadsheet's first row must be column headers. Flexible naming is accepted.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(FIELD_LABELS).map(([field, label]) => (
                  <div key={field} className="flex items-center gap-2 text-sm">
                    {REQUIRED_FIELDS.includes(field)
                      ? <Badge variant="destructive" className="text-xs px-1.5 py-0">required</Badge>
                      : <Badge variant="secondary" className="text-xs px-1.5 py-0">optional</Badge>
                    }
                    <span className="font-mono text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Status values: <span className="font-mono">available, maintenance, damaged, reserved, out_of_service</span> (defaults to available).
                Category must match an existing category name. Next Maintenance accepts any date format (e.g. 2025-06-01).
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── STEP 2: MAP COLUMNS ── */}
      {step === "map" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm w-fit">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{fileName}</span>
            <span className="text-muted-foreground">— {rawHeaders.length} column{rawHeaders.length !== 1 ? "s" : ""} detected</span>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Map Your Columns</CardTitle>
              <CardDescription>
                Assign each column from your spreadsheet to the matching field in the system.
                Recognized columns are pre-mapped — adjust any that don't look right, and ignore columns you don't need.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rawHeaders.map(header => {
                  const mapped = columnMapping[header] ?? "";
                  return (
                    <div key={header} className="flex items-center gap-3">
                      <div className="w-48 shrink-0 text-sm font-mono bg-muted rounded px-3 py-2 truncate" title={header}>
                        {header}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <select
                        value={mapped}
                        onChange={e => setColumnMapping(prev => ({ ...prev, [header]: e.target.value }))}
                        className="flex-1 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">— Ignore this column —</option>
                        {Object.entries(FIELD_LABELS).map(([field, label]) => (
                          <option key={field} value={field}>{label}{REQUIRED_FIELDS.includes(field) ? " *" : ""}</option>
                        ))}
                      </select>
                      {mapped && REQUIRED_FIELDS.includes(mapped) && (
                        <Badge variant="destructive" className="text-xs shrink-0">required</Badge>
                      )}
                      {mapped && !REQUIRED_FIELDS.includes(mapped) && (
                        <Badge variant="secondary" className="text-xs shrink-0">mapped</Badge>
                      )}
                      {!mapped && (
                        <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">ignored</Badge>
                      )}
                    </div>
                  );
                })}
              </div>

              {REQUIRED_FIELDS.some(f => !Object.values(columnMapping).includes(f)) && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800 mt-4">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Required fields not yet mapped:{" "}
                    {REQUIRED_FIELDS.filter(f => !Object.values(columnMapping).includes(f))
                      .map(f => FIELD_LABELS[f])
                      .join(", ")}. Rows missing these will be skipped.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" /> Upload different file
            </Button>
            <Button onClick={applyMapping}>
              Apply Mapping <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: VERIFY ── */}
      {step === "verify" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">— {parsedRows.length} rows</span>
            </div>
            <Badge className="bg-green-600 gap-1">
              <CheckCircle2 className="h-3 w-3" /> {validCount} valid
            </Badge>
            {warnCount > 0 && (
              <Badge variant="secondary" className="gap-1 text-yellow-700 bg-yellow-100 border-yellow-200">
                <AlertCircle className="h-3 w-3" /> {warnCount} warnings
              </Badge>
            )}
            {errorCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" /> {errorCount} errors
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={handleReset} className="ml-auto">
              <RotateCcw className="h-4 w-4 mr-1" /> Upload different file
            </Button>
          </div>

          {errorCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {errorCount} row{errorCount !== 1 ? "s" : ""} have errors and will be skipped.
                {validCount > 0 && ` The remaining ${validCount} valid rows will still be imported.`}
              </span>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Brand / Model</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row) => {
                      const hasError = row._errors.length > 0;
                      const hasWarn = row._warnings.length > 0 && !hasError;
                      return (
                        <TableRow
                          key={row._rowIndex}
                          className={hasError ? "bg-destructive/5" : hasWarn ? "bg-yellow-50/50" : ""}
                        >
                          <TableCell className="text-muted-foreground text-xs">{row._rowIndex}</TableCell>
                          <TableCell>
                            {hasError
                              ? <XCircle className="h-4 w-4 text-destructive" />
                              : hasWarn
                              ? <AlertCircle className="h-4 w-4 text-yellow-500" />
                              : <CheckCircle2 className="h-4 w-4 text-green-600" />
                            }
                          </TableCell>
                          <TableCell className="font-medium max-w-[160px] truncate">
                            {row.name || <span className="text-destructive italic">missing</span>}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {row.sku || "—"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.category
                              ? categoryNames.has(row.category.toLowerCase().trim())
                                ? <Badge variant="outline" className="text-xs">{row.category}</Badge>
                                : <span className="text-muted-foreground text-xs">{row.category} (unmatched)</span>
                              : <span className="text-muted-foreground text-xs">—</span>
                            }
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={row.status === "available" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {row.status || "available"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{row.quantity || "1"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {[row.brand, row.model].filter(Boolean).join(" ") || "—"}
                          </TableCell>
                          <TableCell className="max-w-[220px]">
                            {hasError && row._errors.map((e, i) => (
                              <Tooltip key={i}>
                                <TooltipTrigger>
                                  <span className="text-xs text-destructive block truncate">{e}</span>
                                </TooltipTrigger>
                                <TooltipContent>{e}</TooltipContent>
                              </Tooltip>
                            ))}
                            {hasWarn && row._warnings.map((w, i) => (
                              <Tooltip key={i}>
                                <TooltipTrigger>
                                  <span className="text-xs text-yellow-600 block truncate">{w}</span>
                                </TooltipTrigger>
                                <TooltipContent>{w}</TooltipContent>
                              </Tooltip>
                            ))}
                            {!hasError && !hasWarn && (
                              <span className="text-xs text-green-600">Ready</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleReset}>Cancel</Button>
            <Button disabled={validCount === 0 || importing} onClick={handleImport}>
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import {validCount} Product{validCount !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: RESULT ── */}
      {step === "result" && result && (
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            {result.created > 0
              ? <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
              : <XCircle className="h-16 w-16 text-destructive mx-auto" />
            }
            <div>
              <p className="text-2xl font-bold">
                {result.created} product{result.created !== 1 ? "s" : ""} created
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {result.total} row{result.total !== 1 ? "s" : ""} processed
                {result.errors.length > 0 && `, ${result.errors.length} skipped due to errors`}
              </p>
            </div>

            {result.errors.length > 0 && (
              <div className="text-left max-w-lg mx-auto bg-destructive/10 border border-destructive/20 rounded-lg p-4 space-y-1">
                <p className="text-sm font-semibold text-destructive mb-2">Skipped rows:</p>
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive">Row {e.row}: {e.error}</p>
                ))}
              </div>
            )}

            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Import Another File
              </Button>
              <Button onClick={() => setLocation(adminPath("/inventory"))}>
                View All Inventory
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
