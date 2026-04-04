import { adminPath } from "@/lib/admin-nav";
import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { getGetListingsQueryKey, useGetCategories } from "@workspace/api-client-react";
import { read as xlsxRead, utils as xlsxUtils } from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Download,
  Loader2,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Column mapping: spreadsheet header (case-insensitive) → internal field name
const COLUMN_MAP: Record<string, string> = {
  title: "title",
  name: "title",
  description: "description",
  desc: "description",
  category: "category",
  "category name": "category",
  price: "pricePerDay",
  "price per day": "pricePerDay",
  price_per_day: "pricePerDay",
  priceperday: "pricePerDay",
  "price/day": "pricePerDay",
  "weekly price": "pricePerWeek",
  "price per week": "pricePerWeek",
  price_per_week: "pricePerWeek",
  "hourly price": "pricePerHour",
  "price per hour": "pricePerHour",
  price_per_hour: "pricePerHour",
  deposit: "depositAmount",
  "deposit amount": "depositAmount",
  deposit_amount: "depositAmount",
  qty: "quantity",
  quantity: "quantity",
  stock: "quantity",
  status: "status",
  brand: "brand",
  model: "model",
  condition: "condition",
  location: "location",
  weight: "weight",
  dimensions: "dimensions",
  size: "dimensions",
  requirements: "requirements",
  "age restriction": "ageRestriction",
  age_restriction: "ageRestriction",
  "min age": "ageRestriction",
  "included items": "includedItems",
  included_items: "includedItems",
  accessories: "includedItems",
};

const REQUIRED_FIELDS = ["title", "description", "pricePerDay"];

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  category: "Category",
  pricePerDay: "Price/Day",
  pricePerWeek: "Price/Week",
  pricePerHour: "Price/Hour",
  depositAmount: "Deposit",
  quantity: "Qty",
  status: "Status",
  brand: "Brand",
  model: "Model",
  condition: "Condition",
  location: "Location",
  weight: "Weight",
  dimensions: "Dimensions",
  requirements: "Requirements",
  ageRestriction: "Min Age",
  includedItems: "Included Items",
};

interface ParsedRow {
  _rowIndex: number;
  _errors: string[];
  _warnings: string[];
  title?: string;
  description?: string;
  category?: string;
  pricePerDay?: string;
  pricePerWeek?: string;
  pricePerHour?: string;
  depositAmount?: string;
  quantity?: string;
  status?: string;
  brand?: string;
  model?: string;
  condition?: string;
  location?: string;
  weight?: string;
  dimensions?: string;
  requirements?: string;
  ageRestriction?: string;
  includedItems?: string;
  [key: string]: any;
}

function validateRow(row: ParsedRow, categoryNames: Set<string>): ParsedRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!row.title?.trim()) errors.push("Title is required");
  if (!row.description?.trim()) errors.push("Description is required");

  if (!row.pricePerDay || row.pricePerDay.trim() === "") {
    errors.push("Price/Day is required");
  } else {
    const p = parseFloat(row.pricePerDay);
    if (isNaN(p) || p < 0) errors.push("Price/Day must be a positive number");
  }

  if (row.pricePerWeek && row.pricePerWeek !== "") {
    if (isNaN(parseFloat(row.pricePerWeek))) warnings.push("Price/Week is not a valid number — will be skipped");
  }
  if (row.pricePerHour && row.pricePerHour !== "") {
    if (isNaN(parseFloat(row.pricePerHour))) warnings.push("Price/Hour is not a valid number — will be skipped");
  }
  if (row.depositAmount && row.depositAmount !== "") {
    if (isNaN(parseFloat(row.depositAmount))) warnings.push("Deposit is not a valid number — will be skipped");
  }

  if (row.category && categoryNames.size > 0 && !categoryNames.has(row.category.toLowerCase().trim())) {
    warnings.push(`Category "${row.category}" not found — listing will have no category`);
  }

  const validStatus = ["active", "inactive", "draft"];
  if (row.status && !validStatus.includes(row.status.toLowerCase())) {
    warnings.push(`Status "${row.status}" not recognized — will default to "active"`);
  }

  const validCondition = ["excellent", "good", "fair"];
  if (row.condition && !validCondition.includes(row.condition.toLowerCase())) {
    warnings.push(`Condition "${row.condition}" not recognized — will default to "good"`);
  }

  return { ...row, _errors: errors, _warnings: warnings };
}

type Step = "upload" | "map" | "verify" | "result";

interface ImportResult {
  created: number;
  errors: { row: number; error: string }[];
  total: number;
}

export default function AdminListingsImport() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useGetCategories();
  const categoryNames = new Set(
    (categories ?? []).map((c: any) => c.name.toLowerCase())
  );
  const categoryNamesDisplay = new Set(
    (categories ?? []).map((c: any) => c.name.toLowerCase())
  );

  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawDataRows, setRawDataRows] = useState<any[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  const errorCount = parsedRows.filter(r => r._errors.length > 0).length;
  const warnCount = parsedRows.filter(r => r._warnings.length > 0 && r._errors.length === 0).length;
  const validCount = parsedRows.filter(r => r._errors.length === 0).length;

  const parseFile = useCallback((file: File) => {
    if (!file) return;
    setFileName(file.name);

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
      } catch (err) {
        toast({ title: "Failed to parse file", description: "Make sure the file is a valid Excel (.xlsx, .xls) or CSV file.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  }, [toast]);

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
      return validateRow(obj, categoryNamesDisplay);
    });
    const detectedFields = [...new Set(Object.values(columnMapping).filter(f => f && FIELD_LABELS[f]))];
    setDetectedColumns(detectedFields);
    setParsedRows(parsed);
    setStep("verify");
  }, [rawHeaders, rawDataRows, columnMapping, categoryNamesDisplay]);

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
      const payload = validRows.map(r => ({
        title: r.title,
        description: r.description,
        category: r.category,
        pricePerDay: r.pricePerDay,
        pricePerWeek: r.pricePerWeek || null,
        pricePerHour: r.pricePerHour || null,
        depositAmount: r.depositAmount || null,
        quantity: r.quantity,
        status: r.status?.toLowerCase() || "active",
        brand: r.brand,
        model: r.model,
        condition: r.condition?.toLowerCase() || null,
        location: r.location,
        weight: r.weight,
        dimensions: r.dimensions,
        requirements: r.requirements,
        ageRestriction: r.ageRestriction,
        includedItems: r.includedItems,
      }));

      const apiBase = `${BASE}/api`;
      const raw = localStorage.getItem("admin_session");
      const token = raw ? JSON.parse(raw)?.token : null;

      const res = await fetch(`${apiBase}/listings/bulk`, {
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
      queryClient.invalidateQueries({ queryKey: getGetListingsQueryKey() });
    } catch {
      toast({ title: "Connection error", description: "Please try again.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setParsedRows([]);
    setDetectedColumns([]);
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
      "title", "description", "category", "price_per_day", "price_per_week",
      "price_per_hour", "deposit_amount", "quantity", "status", "brand",
      "model", "condition", "location", "weight", "dimensions",
      "requirements", "age_restriction", "included_items",
    ];
    const example = [
      "2022 Sea-Doo Spark",
      "Fun and nimble personal watercraft, perfect for beginners.",
      "Jet Ski",
      "199", "999", "", "500", "2", "active",
      "Sea-Doo", "Spark 90HP", "excellent",
      "Lake Powell Marina", "400 lbs", "122\" x 45\" x 42\"",
      "Valid driver license required", "18", "Life jacket, safety lanyard",
    ];
    const ws = utils.aoa_to_sheet([headers, example]);
    ws["!cols"] = headers.map(() => ({ wch: 20 }));
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Listings");
    writeFile(wb, "listings-import-template.xlsx");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(adminPath("/listings"))}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Import Listings</h1>
          <p className="text-muted-foreground text-sm">Upload an Excel or CSV file to create multiple listings at once</p>
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
                className={`
                  border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
                  ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"}
                `}
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
                Required column format
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </CardTitle>
              <CardDescription>
                Your spreadsheet's first row must be column headers. These are the supported columns — flexible naming is accepted.
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
                Category names are matched to your existing categories (e.g. "Jet Ski", "RV"). 
                Status: active / inactive / draft. Condition: excellent / good / fair.
                For "Included Items", separate multiple items with commas.
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
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-sm">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">— {parsedRows.length} rows</span>
            </div>
            <Badge variant="default" className="bg-green-600 gap-1">
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

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price/Day</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Status</TableHead>
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
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {row.title || <span className="text-destructive italic">missing</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.category
                              ? categoryNamesDisplay.has(row.category.toLowerCase().trim())
                                ? <Badge variant="outline" className="text-xs">{row.category}</Badge>
                                : <span className="text-muted-foreground text-xs">{row.category} (unmatched)</span>
                              : <span className="text-muted-foreground text-xs">—</span>
                            }
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.pricePerDay
                              ? <>${parseFloat(row.pricePerDay).toFixed(2)}</>
                              : <span className="text-destructive italic text-xs">missing</span>
                            }
                          </TableCell>
                          <TableCell className="text-sm">{row.quantity || "1"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                row.status === "active" ? "default"
                                : row.status === "draft" ? "secondary"
                                : "outline"
                              }
                              className="text-xs"
                            >
                              {row.status || "active"}
                            </Badge>
                          </TableCell>
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

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleReset}>
              Cancel
            </Button>
            <Button
              disabled={validCount === 0 || importing}
              onClick={handleImport}
            >
              {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import {validCount} Listing{validCount !== 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: RESULT ── */}
      {step === "result" && result && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-4">
              {result.created > 0
                ? <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
                : <XCircle className="h-16 w-16 text-destructive mx-auto" />
              }
              <div>
                <p className="text-2xl font-bold">
                  {result.created} listing{result.created !== 1 ? "s" : ""} created
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
                <Button onClick={() => setLocation(adminPath("/listings"))}>
                  View All Listings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
