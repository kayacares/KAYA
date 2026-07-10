import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { useApp } from "@/contexts/AppContext";
import { SHOPS } from "@/lib/mock-data";
import ShopCard from "@/components/features/ShopCard";
import AddRecipientSheet from "@/components/features/AddRecipientSheet";
import { ExternalLink, MapPin, Pencil, Phone, Trash2 } from "lucide-react";

export default function RecipientDetail() {
  const { id } = useParams();
  const { recipients, removeRecipient, orders } = useApp();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const recipient = recipients.find((r) => r.id === id);

  if (!recipient) {
    return (
      <>
        <TopBar back title="Not found" />
        <main className="container-app px-4">
          <p>Recipient not found.</p>
        </main>
      </>
    );
  }

  const past = orders.filter((o) => o.recipient.id === id);

  return (
    <>
      <TopBar back title={recipient.fullName} subtitle={recipient.relationship} />
      <main className="container-app px-4 pb-4">
        <section className="card-base p-5 mb-6 bg-charcoal-800 text-cream-50 border-charcoal-700 relative">
          <button
            onClick={() => setEditOpen(true)}
            className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-cream-50/10 hover:bg-mustard-400 hover:text-charcoal-900 text-cream-50 px-3 py-1.5 text-[11px] font-bold transition"
            aria-label="Edit address"
          >
            <Pencil size={11} /> Edit
          </button>
          <div className="flex items-start gap-4 pr-16">
            <div className="grid place-items-center w-16 h-16 rounded-2xl bg-mustard-400 text-charcoal-900 text-3xl">
              {recipient.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-mustard-400">
                {recipient.relationship}
              </div>
              <h2 className="display text-2xl font-semibold leading-tight">
                {recipient.fullName}
              </h2>
              <div className="mt-2 space-y-1.5 text-sm text-cream-100/80">
                <div className="flex items-start gap-1.5">
                  <MapPin size={14} className="mt-0.5 shrink-0" />
                  <div className="leading-snug min-w-0">
                    {recipient.townArea && (
                      <div>
                        <span className="font-semibold text-cream-50">
                          {recipient.townArea}
                        </span>
                        <span>, {recipient.city}</span>
                      </div>
                    )}
                    <div className={recipient.townArea ? "" : ""}>
                      {recipient.address}
                      {!recipient.townArea ? `, ${recipient.city}` : ""}
                    </div>
                    {recipient.closestLandmark && (
                      <div className="text-xs text-cream-100/70 mt-1">
                        <span className="font-semibold text-mustard-400">
                          Landmark:
                        </span>{" "}
                        {recipient.closestLandmark}
                      </div>
                    )}
                    {recipient.deliveryNotes && (
                      <div className="text-xs text-cream-100/70 mt-1">
                        <span className="font-semibold text-mustard-400">
                          Notes:
                        </span>{" "}
                        {recipient.deliveryNotes}
                      </div>
                    )}
                    {recipient.mapsLink && (
                      <a
                        href={recipient.mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-mustard-400 underline mt-1.5 font-semibold"
                      >
                        <ExternalLink size={11} /> Open in Google Maps
                      </a>
                    )}
                  </div>
                </div>
                <p className="flex items-center gap-1.5">
                  <Phone size={14} /> {recipient.phone}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h3 className="display text-2xl font-semibold mb-1">
            Send care to {recipient.fullName.split(" ")[0]}
          </h3>
          <p className="text-sm text-charcoal-400 mb-4">
            Choose a curated shop. Pricing in your currency.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SHOPS.map((s) => (
              <ShopCard key={s.id} recipientId={recipient.id} shop={s} />
            ))}
          </div>
        </section>

        {past.length > 0 && (
          <section className="mb-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-charcoal-400 mb-2">
              Past care
            </h3>
            <div className="space-y-2">
              {past.slice(0, 5).map((o) => (
                <button
                  key={o.id}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  className="card-base w-full p-4 flex items-center justify-between text-left hover:border-charcoal-400"
                >
                  <div>
                    <p className="font-semibold text-sm">
                      {o.items.length} items · {o.shopId}
                    </p>
                    <p className="text-xs text-charcoal-400">{o.status}</p>
                  </div>
                  <span className="display font-bold text-sm">
                    GH₵{o.totalGHS.toFixed(0)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <button
          onClick={() => {
            removeRecipient(recipient.id);
            navigate("/");
          }}
          className="btn-ghost w-full text-clay-600 mt-4"
        >
          <Trash2 size={16} /> Remove recipient
        </button>
      </main>

      <AddRecipientSheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        recipient={recipient}
      />
    </>
  );
}
