import { useState } from "react";
import { Download, Mail, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { SuperAdminLayout } from "@/components/layout/superadmin-layout";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function getToken() { return localStorage.getItem("superadmin_token") ?? ""; }

export default function SuperAdminExport() {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch(`${BASE}/api/superadmin/export/inventory`, {
        headers: { "x-superadmin-token": getToken() },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Download failed" }));
        throw new Error(err.error ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().split("T")[0];
      a.download = `outdoorshare-export-${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded", description: "Check your downloads folder." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Download failed", description: err.message });
    } finally {
      setDownloading(false);
    }
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    if (!email.includes("@")) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${BASE}/api/superadmin/export/inventory/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-superadmin-token": getToken(),
        },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      setEmailSent(true);
      toast({ title: "Export sent!", description: `The spreadsheet was emailed to ${email}.` });
    } catch (err: any) {
      setEmailError(err.message ?? "Failed to send export email.");
      toast({ variant: "destructive", title: "Email failed", description: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <SuperAdminLayout>
      <div className="p-6 max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Export Data</h1>
          <p className="text-slate-400 mt-1 text-sm">
            Download or email a full Excel workbook with all inventory and listings across every company.
          </p>
        </div>

        {/* What's included */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            What's included
          </div>
          <ul className="space-y-2 text-sm text-slate-400">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              <span>
                <strong className="text-slate-200">Inventory sheet</strong> — every product from the Products table,
                including SKU, serial number, estimated value, maintenance dates, and status, grouped by company.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
              <span>
                <strong className="text-slate-200">Listings sheet</strong> — every storefront listing across all companies,
                including pricing (daily, weekly, hourly, deposit), condition, location, and linked product ID.
              </span>
            </li>
          </ul>
        </div>

        {/* Download card */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Download to device</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              Generates the workbook instantly and saves it to your downloads folder.
            </p>
          </div>
          <Button
            onClick={handleDownload}
            disabled={downloading}
            className="w-full sm:w-auto gap-2 text-white font-semibold"
            style={{ background: "#3ab549" }}
          >
            {downloading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            ) : (
              <><Download className="w-4 h-4" /> Download Excel (.xlsx)</>
            )}
          </Button>
        </div>

        {/* Email card */}
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Send by email</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              The workbook will be attached to an email sent from OutdoorShare's platform account.
            </p>
          </div>

          {emailSent ? (
            <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-emerald-300 font-medium text-sm">Export sent!</p>
                <p className="text-emerald-400/70 text-xs">
                  Check <strong>{email}</strong> — the spreadsheet should arrive within a minute.
                </p>
              </div>
              <button
                className="ml-auto text-xs text-emerald-400 hover:text-emerald-300 underline"
                onClick={() => { setEmailSent(false); setEmail(""); }}
              >
                Send again
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmail} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="export-email" className="text-slate-300 text-sm">
                  Recipient email address
                </Label>
                <Input
                  id="export-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
                {emailError && (
                  <p className="flex items-center gap-1.5 text-xs text-red-400">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {emailError}
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={sending || !email}
                variant="outline"
                className="gap-2 border-slate-600 text-slate-200 hover:bg-slate-800"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                ) : (
                  <><Mail className="w-4 h-4" /> Send Export</>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </SuperAdminLayout>
  );
}
