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
    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-lg overflow-hidden">
      <div className="px-3 py-1.5 border-b bg-muted/40">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          Existing Contacts
        </p>
      </div>
      <div className="max-h-52 overflow-y-auto">
        {suggestions.map((r, i) => (
          <button
            key={r.email}
            type="button"
            className={`w-full text-left px-3 py-2.5 flex items-start gap-3 hover:bg-accent transition-colors ${i === highlightIdx ? "bg-accent" : ""}`}
            onMouseEnter={() => setHighlightIdx(i)}
            onMouseDown={e => { e.preventDefault(); onSelect(r); }}
          >
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">
                {r.name.trim().charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold truncate">{r.name}</span>
                {r.bookingCount != null && r.bookingCount > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-px rounded-full shrink-0">
                    {r.bookingCount} booking{r.bookingCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-muted-foreground truncate">{r.email}</span>
                {r.phone && (
                  <span className="text-xs text-muted-foreground shrink-0">{r.phone}</span>
                )}
              </div>
            </div>
            <Check className="w-3.5 h-3.5 text-primary opacity-0 group-hover:opacity-100 shrink-0 mt-1" />
          </button>
        ))}
      </div>
    </div>
  );
}
