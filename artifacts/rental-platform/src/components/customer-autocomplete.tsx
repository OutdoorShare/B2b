import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAdminSession } from "@/lib/admin-nav";
import { User, Phone, Mail, Check } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Renter {
  name: string;
  email: string;
  phone: string | null;
  bookingCount?: number;
}

interface CustomerAutocompleteProps {
  name: string;
  email: string;
  phone: string;
  onChangeName: (v: string) => void;
  onChangeEmail: (v: string) => void;
  onChangePhone: (v: string) => void;
  autoFocusEmail?: boolean;
  emailHint?: React.ReactNode;
}

export function CustomerAutocomplete({
  name,
  email,
  phone,
  onChangeName,
  onChangeEmail,
  onChangePhone,
  autoFocusEmail,
  emailHint,
}: CustomerAutocompleteProps) {
  const [renters, setRenters] = useState<Renter[]>([]);
  const [suggestions, setSuggestions] = useState<Renter[]>([]);
  const [activeField, setActiveField] = useState<"name" | "email" | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [justSelected, setJustSelected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const session = getAdminSession();
    if (!session?.token) return;
    fetch(`${BASE}/api/admin/renters`, {
      headers: { "x-admin-token": session.token },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setRenters(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const filterRenters = useCallback((query: string) => {
    if (!query.trim() || query.trim().length < 2) { setSuggestions([]); return; }
    const q = query.toLowerCase();
    const matches = renters
      .filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.phone ?? "").includes(q)
      )
      .slice(0, 6);
    setSuggestions(matches);
    setHighlightIdx(0);
  }, [renters]);

  const handleSelect = (renter: Renter) => {
    setJustSelected(true);
    onChangeName(renter.name);
    onChangeEmail(renter.email);
    onChangePhone(renter.phone ?? "");
    setSuggestions([]);
    setActiveField(null);
    setTimeout(() => setJustSelected(false), 200);
  };

  const closeSuggestions = () => {
    setSuggestions([]);
    setActiveField(null);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeSuggestions();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && suggestions[highlightIdx]) { e.preventDefault(); handleSelect(suggestions[highlightIdx]); }
    else if (e.key === "Escape") { closeSuggestions(); }
  };

  const showDropdown = suggestions.length > 0 && activeField !== null;

  return (
    <div ref={containerRef} className="space-y-4" onKeyDown={handleKeyDown}>
      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="ca-email" className="flex items-center gap-1.5 text-sm font-semibold">
          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
          Email Address <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="ca-email"
            type="email"
            value={email}
            autoFocus={autoFocusEmail}
            placeholder="jane@example.com"
            className="h-10"
            onChange={e => {
              if (justSelected) return;
              onChangeEmail(e.target.value);
              setActiveField("email");
              filterRenters(e.target.value);
            }}
            onFocus={() => {
              if (email.trim().length >= 2) {
                setActiveField("email");
                filterRenters(email);
              }
            }}
          />
          {showDropdown && activeField === "email" && (
            <SuggestionDropdown
              suggestions={suggestions}
              highlightIdx={highlightIdx}
              onSelect={handleSelect}
              setHighlightIdx={setHighlightIdx}
            />
          )}
        </div>
        {emailHint && <p className="text-xs text-muted-foreground leading-relaxed">{emailHint}</p>}
      </div>

      {/* Name + Phone */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ca-name" className="flex items-center gap-1.5 text-sm font-semibold">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            Full Name <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <Input
              id="ca-name"
              value={name}
              placeholder="Jane Smith"
              onChange={e => {
                if (justSelected) return;
                onChangeName(e.target.value);
                setActiveField("name");
                filterRenters(e.target.value);
              }}
              onFocus={() => {
                if (name.trim().length >= 2) {
                  setActiveField("name");
                  filterRenters(name);
                }
              }}
            />
            {showDropdown && activeField === "name" && (
              <SuggestionDropdown
                suggestions={suggestions}
                highlightIdx={highlightIdx}
                onSelect={handleSelect}
                setHighlightIdx={setHighlightIdx}
              />
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ca-phone" className="flex items-center gap-1.5 text-sm font-semibold">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            Phone
          </Label>
          <Input
            id="ca-phone"
            type="tel"
            value={phone}
            placeholder="+1 (555) 000-0000"
            onChange={e => onChangePhone(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function SuggestionDropdown({
  suggestions,
  highlightIdx,
  onSelect,
  setHighlightIdx,
}: {
  suggestions: Renter[];
  highlightIdx: number;
  onSelect: (r: Renter) => void;
  setHighlightIdx: (i: number) => void;
}) {
  return (
    <div className="absolute z-50 top-full left-0 right-0 mt-1.5 bg-white dark:bg-zinc-900 border-2 border-border rounded-xl shadow-xl overflow-hidden">
      <div className="px-4 py-2 bg-muted border-b border-border flex items-center gap-2">
        <User className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold text-foreground">
          Existing contacts
        </p>
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-border">
        {suggestions.map((r, i) => (
          <button
            key={r.email}
            type="button"
            className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${i === highlightIdx ? "bg-primary/8 dark:bg-primary/15" : "hover:bg-muted/60"}`}
            onMouseEnter={() => setHighlightIdx(i)}
            onMouseDown={e => { e.preventDefault(); onSelect(r); }}
          >
            <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 border border-primary/20">
              <span className="text-sm font-bold text-primary leading-none">
                {r.name.trim().charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-foreground truncate">{r.name}</span>
                {r.bookingCount != null && r.bookingCount > 0 && (
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0">
                    {r.bookingCount}×
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{r.email}</span>
                {r.phone && (
                  <>
                    <span className="mx-1 opacity-40">·</span>
                    <Phone className="w-3 h-3 shrink-0" />
                    <span className="shrink-0">{r.phone}</span>
                  </>
                )}
              </div>
            </div>
            {i === highlightIdx && (
              <Check className="w-4 h-4 text-primary shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
