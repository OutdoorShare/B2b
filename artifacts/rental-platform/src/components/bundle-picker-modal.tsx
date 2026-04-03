import { useState, useMemo } from "react";
import { X, Search, Plus, Minus, ShoppingBag, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type BundleItem = {
  listingId: number;
  title: string;
  qty: number;
  pricePerDay: number;
  days: number;
  subtotal: number;
  imageUrl?: string;
  categoryName?: string;
};

type AvailableListing = {
  id: number;
  title: string;
  pricePerDay: number | string;
  imageUrls?: string[];
  categoryName?: string | null;
  quantity?: number;
  status?: string;
};

interface BundlePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  listings: AvailableListing[];
  excludeListingId?: number;
  bundleItems: BundleItem[];
  onChange: (items: BundleItem[]) => void;
  days: number;
  bundleDiscountPercent: number;
}

export default function BundlePickerModal({
  isOpen,
  onClose,
  listings,
  excludeListingId,
  bundleItems,
  onChange,
  days,
  bundleDiscountPercent,
}: BundlePickerModalProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return listings.filter(l => {
      if (l.id === excludeListingId) return false;
      if (l.status && l.status !== "active") return false;
      if (!q) return true;
      return l.title.toLowerCase().includes(q) ||
        (l.categoryName ?? "").toLowerCase().includes(q);
    });
  }, [listings, excludeListingId, search]);

  function getSelected(listingId: number): BundleItem | undefined {
    return bundleItems.find(i => i.listingId === listingId);
  }

  function addItem(listing: AvailableListing) {
    const price = parseFloat(String(listing.pricePerDay));
    const item: BundleItem = {
      listingId: listing.id,
      title: listing.title,
      qty: 1,
      pricePerDay: price,
      days,
      subtotal: price * days,
      imageUrl: listing.imageUrls?.[0],
      categoryName: listing.categoryName ?? undefined,
    };
    onChange([...bundleItems, item]);
  }

  function removeItem(listingId: number) {
    onChange(bundleItems.filter(i => i.listingId !== listingId));
  }

  function changeQty(listingId: number, delta: number) {
    onChange(bundleItems.map(i => {
      if (i.listingId !== listingId) return i;
      const newQty = Math.max(1, i.qty + delta);
      return { ...i, qty: newQty, subtotal: i.pricePerDay * newQty * days };
    }));
  }

  const bundleSubtotal = bundleItems.reduce((s, i) => s + i.subtotal, 0);
  const discountAmount = bundleDiscountPercent > 0 && bundleItems.length > 0
    ? bundleSubtotal * (bundleDiscountPercent / 100) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base leading-none">Build a Bundle</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Add more items to your order</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Discount badge */}
        {bundleDiscountPercent > 0 && (
          <div className="mx-5 mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2 shrink-0">
            <Tag className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-800 font-medium">
              Bundle discount: <span className="font-bold">{bundleDiscountPercent}% off</span> the entire order when you add items
            </p>
          </div>
        )}

        {/* Search */}
        <div className="px-5 py-3 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
              autoFocus
            />
          </div>
        </div>

        {/* Listing list */}
        <div className="overflow-y-auto flex-1 px-5 pb-2 space-y-2">
          {filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-8 text-sm">No listings found.</p>
          )}
          {filtered.map(listing => {
            const selected = getSelected(listing.id);
            const price = parseFloat(String(listing.pricePerDay));
            return (
              <div
                key={listing.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                  selected ? "border-primary/50 bg-primary/5" : "border-border bg-background hover:bg-muted/30"
                }`}
              >
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-muted shrink-0">
                  {listing.imageUrls?.[0] ? (
                    <img src={listing.imageUrls[0]} alt={listing.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-snug truncate">{listing.title}</p>
                  {listing.categoryName && (
                    <p className="text-xs text-muted-foreground">{listing.categoryName}</p>
                  )}
                  <p className="text-sm font-bold text-primary mt-0.5">
                    ${price.toFixed(2)}/day
                    {days > 1 && <span className="font-normal text-muted-foreground text-xs ml-1">× {days} days = ${(price * days).toFixed(2)}</span>}
                  </p>
                </div>

                {/* Controls */}
                {selected ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => changeQty(listing.id, -1)}
                      className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-5 text-center font-bold text-sm">{selected.qty}</span>
                    <button
                      onClick={() => changeQty(listing.id, 1)}
                      className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-primary" />
                    </button>
                    <button
                      onClick={() => removeItem(listing.id)}
                      className="w-7 h-7 rounded-full bg-destructive/10 flex items-center justify-center hover:bg-destructive/20 transition-colors ml-1"
                    >
                      <X className="w-3.5 h-3.5 text-destructive" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addItem(listing)}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer summary + confirm */}
        <div className="border-t px-5 py-4 shrink-0 space-y-3">
          {bundleItems.length > 0 ? (
            <div className="space-y-1.5 text-sm">
              {bundleItems.map(item => (
                <div key={item.listingId} className="flex justify-between text-muted-foreground">
                  <span className="truncate mr-2">{item.title} × {item.qty}</span>
                  <span className="shrink-0">${item.subtotal.toFixed(2)}</span>
                </div>
              ))}
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-700 font-semibold">
                  <span>Bundle discount ({bundleDiscountPercent}%)</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground pt-1 border-t">
                <span>Bundle add-ons subtotal</span>
                <span>${(bundleSubtotal - discountAmount).toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">This amount is added to your main item's total.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center">No items added yet — search and add gear above.</p>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={onClose} className="flex-1" disabled={bundleItems.length === 0}>
              {bundleItems.length > 0
                ? `Confirm ${bundleItems.length} item${bundleItems.length > 1 ? "s" : ""}`
                : "No items added"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
