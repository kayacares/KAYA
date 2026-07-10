import { useEffect, useState } from "react";
import { Quote } from "lucide-react";

interface Testimonial {
  quote: string;
  name: string;
  city: string;
  recipient: string;
  flag: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Mom opened the door, saw the rice and oil, and called me crying. KAYA brings my care home.",
    name: "Yaa M.",
    city: "Brooklyn, NY",
    recipient: "Sending to Mom in East Legon",
    flag: "🇺🇸",
  },
  {
    quote:
      "Diapers arrived the same day I ordered. My sister couldn't believe it — that's care, not commerce.",
    name: "Kojo A.",
    city: "London, UK",
    recipient: "Sending to baby Kwesi",
    flag: "🇬🇧",
  },
  {
    quote:
      "Sent Grandma flowers for her birthday. She sent back a voice note thanking KAYA by name.",
    name: "Efua B.",
    city: "Toronto, CA",
    recipient: "Sending to Grandma Nana",
    flag: "🇨🇦",
  },
];

export default function TestimonialStrip() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % TESTIMONIALS.length);
    }, 6500);
    return () => clearInterval(id);
  }, []);

  const t = TESTIMONIALS[index];

  return (
    <div className="rounded-2xl bg-cream-50/10 backdrop-blur-md border border-cream-50/20 p-4 shadow-lg">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid place-items-center w-8 h-8 rounded-full bg-mustard-400 text-charcoal-900 shrink-0"
        >
          <Quote size={14} strokeWidth={2.5} />
        </span>
        <div className="min-w-0">
          <p
            key={index}
            className="text-sm leading-relaxed text-cream-50 animate-fade-in-up drop-shadow"
          >
            "{t.quote}"
          </p>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-cream-100/90">
            <span aria-hidden className="text-base">
              {t.flag}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-cream-50 truncate">
                {t.name} · {t.city}
              </p>
              <p className="truncate">{t.recipient}</p>
            </div>
          </div>
        </div>
      </div>
      <div
        className="flex gap-1 mt-3 justify-center"
        role="tablist"
        aria-label="Testimonial pagination"
      >
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Show testimonial ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1 rounded-full transition-all ${
              i === index ? "w-6 bg-mustard-400" : "w-1.5 bg-cream-50/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
