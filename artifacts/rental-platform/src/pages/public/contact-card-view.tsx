import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { MapPin, Phone, Mail, FileText, Shirt, ShoppingBag, Truck, Lightbulb } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PublicCard {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  specialInstructions: string | null;
  prepWhatToWear: string | null;
  prepWhatToBring: string | null;
  prepVehicleTowRating: string | null;
  prepAdditionalTips: string | null;
  tenantSlug: string | null;
  businessName: string | null;
  businessLogoUrl: string | null;
  businessPrimaryColor: string | null;
}

function Section({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}18` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{value}</p>
      </div>
    </div>
  );
}

export default function ContactCardView() {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<PublicCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${BASE}/api/public/contact-cards/${id}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setCard)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const accentColor = card?.businessPrimaryColor || "#3ab549";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-xl font-bold text-gray-800">Contact card not found</p>
          <p className="text-sm text-gray-500">This link may be invalid or the card may have been removed.</p>
        </div>
      </div>
    );
  }

  const hasPrepGuide = !!(card.prepWhatToWear || card.prepWhatToBring || card.prepVehicleTowRating || card.prepAdditionalTips);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white py-10 px-6 text-center" style={{ background: `linear-gradient(135deg, #1a2332 0%, #243040 100%)` }}>
        {card.businessLogoUrl ? (
          <img
            src={card.businessLogoUrl.startsWith("http") ? card.businessLogoUrl : `${BASE}${card.businessLogoUrl}`}
            alt={card.businessName ?? ""}
            className="h-14 object-contain mx-auto mb-4"
          />
        ) : (
          <p className="text-lg font-black tracking-tight mb-4" style={{ color: accentColor }}>
            {card.businessName ?? "Your Rental Company"}
          </p>
        )}
        <h1 className="text-2xl font-black">{card.name}</h1>
        <p className="text-sm text-gray-400 mt-1">Rental Contact Card</p>
      </div>

      {/* Accent bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: accentColor }} />

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-8 space-y-3">
        {card.address && (
          <Section icon={MapPin} label="Pickup Location" value={card.address} color={accentColor} />
        )}
        {card.phone && (
          <a href={`tel:${card.phone}`} className="block">
            <Section icon={Phone} label="Phone" value={card.phone} color={accentColor} />
          </a>
        )}
        {card.email && (
          <a href={`mailto:${card.email}`} className="block">
            <Section icon={Mail} label="Email" value={card.email} color={accentColor} />
          </a>
        )}
        {card.specialInstructions && (
          <Section icon={FileText} label="Special Instructions" value={card.specialInstructions} color={accentColor} />
        )}

        {hasPrepGuide && (
          <div className="mt-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5" style={{ color: accentColor }} />
                Preparation Guide
              </span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>
            <div className="space-y-3">
              {card.prepWhatToWear && (
                <Section icon={Shirt} label="What to Wear" value={card.prepWhatToWear} color={accentColor} />
              )}
              {card.prepWhatToBring && (
                <Section icon={ShoppingBag} label="What to Bring" value={card.prepWhatToBring} color={accentColor} />
              )}
              {card.prepVehicleTowRating && (
                <Section icon={Truck} label="Vehicle / Tow Rating" value={card.prepVehicleTowRating} color={accentColor} />
              )}
              {card.prepAdditionalTips && (
                <Section icon={Lightbulb} label="Additional Tips" value={card.prepAdditionalTips} color={accentColor} />
              )}
            </div>
          </div>
        )}

        {!card.address && !card.phone && !card.email && !card.specialInstructions && !hasPrepGuide && (
          <div className="text-center py-12 text-gray-400 text-sm">No details have been added to this card yet.</div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center pb-10 pt-4">
        <p className="text-xs text-gray-300">
          Powered by{" "}
          <a href="https://myoutdoorshare.com" className="font-semibold" style={{ color: accentColor }}>
            OutdoorShare
          </a>
        </p>
      </div>
    </div>
  );
}
