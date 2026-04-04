import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const OS_GREEN = "#3ab549";

type VerifyState = "loading" | "success" | "already_verified" | "invalid" | "expired" | "error";

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<VerifyState>("loading");
  const [tenantName, setTenantName] = useState("");
  const [slug, setSlug] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setState("invalid");
      return;
    }

    fetch(`${BASE}/api/public/verify-email?token=${encodeURIComponent(token)}`)
      .then(async res => {
        const data = await res.json();
        if (data.alreadyVerified) {
          setState("already_verified");
          setTenantName(data.tenantName ?? "");
          setSlug(data.slug ?? "");
        } else if (res.ok && data.success) {
          setState("success");
          setTenantName(data.tenantName ?? "");
          setSlug(data.slug ?? "");
        } else if (res.status === 410) {
          setState("expired");
        } else if (res.status === 404) {
          setState("invalid");
        } else {
          setState("error");
        }
      })
      .catch(() => setState("error"));
  }, []);

  const handleResend = async () => {
    if (!resendEmail) return;
    setResendLoading(true);
    try {
      await fetch(`${BASE}/api/public/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      setResendSent(true);
    } catch {
      setResendSent(true);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center">
          <Link href="/get-started">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <img src="/outdoorshare-logo.png" alt="OutdoorShare" className="w-8 h-8 object-contain" />
              <span className="font-black text-lg tracking-tight text-gray-900">OutdoorShare</span>
            </div>
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="bg-white rounded-2xl border shadow-sm p-10 max-w-md w-full text-center space-y-6">

          {state === "loading" && (
            <>
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900">Verifying your email…</h1>
                <p className="text-muted-foreground text-sm mt-1">Just a moment.</p>
              </div>
            </>
          )}

          {(state === "success" || state === "already_verified") && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900">
                  {state === "already_verified" ? "Already verified!" : "Email verified!"}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {tenantName
                    ? `${tenantName}'s account is active and ready to use.`
                    : "Your email has been confirmed. Your account is active."}
                </p>
              </div>
              {slug && (
                <Link href={`/${slug}/admin`}>
                  <Button
                    className="w-full font-bold gap-2 text-white hover:opacity-90"
                    style={{ backgroundColor: OS_GREEN }}
                  >
                    Go to Admin Dashboard <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </>
          )}

          {state === "expired" && (
            <>
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-orange-500" />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900">Link expired</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  This verification link has expired (links are valid for 24 hours). Enter your email to get a new one.
                </p>
              </div>
              {!resendSent ? (
                <div className="space-y-3 text-left">
                  <input
                    type="email"
                    placeholder="you@company.com"
                    value={resendEmail}
                    onChange={e => setResendEmail(e.target.value)}
                    className="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <Button
                    className="w-full font-bold text-white hover:opacity-90"
                    style={{ backgroundColor: OS_GREEN }}
                    onClick={handleResend}
                    disabled={!resendEmail || resendLoading}
                  >
                    {resendLoading ? "Sending…" : "Resend Verification Email"}
                  </Button>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm text-green-700 font-medium">
                    If that email is registered, a new link has been sent. Check your inbox.
                  </p>
                </div>
              )}
            </>
          )}

          {(state === "invalid" || state === "error") && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                <XCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900">
                  {state === "invalid" ? "Invalid link" : "Something went wrong"}
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  {state === "invalid"
                    ? "This verification link is invalid or has already been used."
                    : "We couldn't verify your email. Please try again."}
                </p>
              </div>
              <Link href="/get-started">
                <Button variant="outline" className="w-full font-semibold">
                  Back to Sign In
                </Button>
              </Link>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
