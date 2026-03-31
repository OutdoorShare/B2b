import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  TrendingUp,
  RefreshCw,
  CreditCard,
  DollarSign,
  Building2,
} from "lucide-react";

function getAdminToken(): string {
  try {
    const raw = localStorage.getItem("admin_session");
    if (raw) {
      const s = JSON.parse(raw);
      if (s?.token) return s.token;
    }
  } catch { /* ignore */ }
  return "";
}

const api = (path: string, opts?: RequestInit) =>
  fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": getAdminToken(),
      ...(opts?.headers ?? {}),
    },
  });

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

type WalletData = {
  connected: boolean;
  balance: { available: number; pending: number; currency: string } | null;
  payouts: { id: string; amount: number; currency: string; status: string; arrivalDate: string; description?: string | null }[];
  transactions: { id: number; customerName: string; listingTitle: string; startDate: string; endDate: string; gross: number; platformFee: number; net: number; status: string; createdAt: string }[];
  feePercent: number;
};

function payoutStatusBadge(s: string) {
  if (s === "paid") return <Badge className="bg-emerald-100 text-emerald-700 border-0">Paid</Badge>;
  if (s === "pending") return <Badge className="bg-amber-100 text-amber-700 border-0">Pending</Badge>;
  if (s === "in_transit") return <Badge className="bg-blue-100 text-blue-700 border-0">In transit</Badge>;
  if (s === "failed") return <Badge className="bg-red-100 text-red-700 border-0">Failed</Badge>;
  return <Badge variant="secondary">{s}</Badge>;
}

export default function AdminWallet() {
  const { toast } = useToast();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingStripe, setOpeningStripe] = useState(false);
  const [onboarding, setOnboarding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api("/stripe/wallet");
      if (res.ok) setData(await res.json());
      else toast({ title: "Failed to load wallet data", variant: "destructive" });
    } catch {
      toast({ title: "Network error loading wallet", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openStripeDashboard = async () => {
    setOpeningStripe(true);
    try {
      const res = await api("/stripe/connect/dashboard", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        window.open(url, "_blank");
      } else {
        toast({ title: "Could not open Stripe dashboard", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setOpeningStripe(false);
    }
  };

  const startOnboarding = async () => {
    setOnboarding(true);
    try {
      const res = await api("/stripe/connect/onboard", { method: "POST" });
      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      } else {
        toast({ title: "Could not start Stripe setup", variant: "destructive" });
        setOnboarding(false);
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
      setOnboarding(false);
    }
  };

  const totalGross = data?.transactions.reduce((s, t) => s + t.gross, 0) ?? 0;
  const totalFees = data?.transactions.reduce((s, t) => s + t.platformFee, 0) ?? 0;
  const totalNet = data?.transactions.reduce((s, t) => s + t.net, 0) ?? 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6 text-emerald-600" />
            My Wallet
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your payout account and view your earnings breakdown
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-1.5">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stripe Connect status card */}
      {loading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : data?.connected ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-emerald-900">Stripe account connected</p>
                <p className="text-sm text-emerald-700">
                  Your payout account is active. Manage your bank account and payout schedule directly in Stripe.
                </p>
              </div>
            </div>
            <Button
              onClick={openStripeDashboard}
              disabled={openingStripe}
              className="shrink-0 bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50 gap-1.5 shadow-sm"
            >
              {openingStripe ? "Opening…" : "Manage Payout Details"}
              <ExternalLink className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-100 p-2.5">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-900">No payout account connected</p>
                <p className="text-sm text-amber-700">
                  Connect your Stripe account to receive payouts from bookings.
                </p>
              </div>
            </div>
            <Button
              onClick={startOnboarding}
              disabled={onboarding}
              className="shrink-0 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {onboarding ? "Redirecting…" : "Set Up Payouts"}
              <ArrowUpRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Balance cards */}
      {data?.connected && data.balance && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Available</p>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-emerald-600">{fmt(data.balance.available)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ready to pay out</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending</p>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-amber-600">{fmt(data.balance.pending)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Processing (2–7 days)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Earned</p>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold">{fmt(totalNet)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">All paid bookings</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Earnings summary */}
      {(data?.transactions.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              Earnings Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Gross Revenue</p>
                <p className="text-xl font-bold">{fmt(totalGross)}</p>
              </div>
              <div className="rounded-lg bg-red-50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Platform Fees</p>
                <p className="text-xl font-bold text-red-600">−{fmt(totalFees)}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-4">
                <p className="text-xs text-muted-foreground mb-1">Your Earnings</p>
                <p className="text-xl font-bold text-emerald-600">{fmt(totalNet)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            Paid Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (data?.transactions.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No paid transactions yet. Completed bookings will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">Listing</th>
                    <th className="text-left px-4 py-3 font-medium">Renter</th>
                    <th className="text-left px-4 py-3 font-medium">Rental Period</th>
                    <th className="text-right px-4 py-3 font-medium">Gross</th>
                    <th className="text-right px-4 py-3 font-medium">Platform Fee</th>
                    <th className="text-right px-4 py-3 font-medium text-emerald-700">Your Earnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data?.transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(t.createdAt)}</td>
                      <td className="px-4 py-3 font-medium max-w-[160px] truncate">{t.listingTitle}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.customerName}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">
                        {t.startDate} → {t.endDate}
                      </td>
                      <td className="px-4 py-3 text-right">{fmt(t.gross)}</td>
                      <td className="px-4 py-3 text-right text-red-600">−{fmt(t.platformFee)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(t.net)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-slate-50 font-semibold text-sm">
                    <td colSpan={4} className="px-4 py-3 text-muted-foreground">Totals ({data?.transactions.length} transactions)</td>
                    <td className="px-4 py-3 text-right">{fmt(totalGross)}</td>
                    <td className="px-4 py-3 text-right text-red-600">−{fmt(totalFees)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600">{fmt(totalNet)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payout history */}
      {data?.connected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              Payout History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data.payouts.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No payouts yet. Your first payout will appear here once funds are transferred to your bank.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="text-left px-4 py-3 font-medium">Arrival Date</th>
                      <th className="text-left px-4 py-3 font-medium">Description</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-right px-4 py-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.payouts.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(p.arrivalDate)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{p.description ?? "Automatic payout"}</td>
                        <td className="px-4 py-3">{payoutStatusBadge(p.status)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{fmt(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
