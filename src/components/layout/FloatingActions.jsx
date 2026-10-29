import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function FloatingActions({ language = "vi" }) {
  const [showTop, setShowTop] = useState(false);
  const vi = language === "vi";

  useEffect(() => {
    const updateScroll = () => setShowTop(window.scrollY > 320);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  const scrollToContact = () =>
    document.getElementById("footer")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="floating-actions">
      <button
        className="floating-action floating-contact"
        type="button"
        onClick={scrollToContact}
        aria-label={vi ? "Liên hệ Technest" : "Contact Technest"}
        title={vi ? "Liên hệ" : "Contact"}
      >
        <svg className="technest-mascot" viewBox="0 0 88 88" role="img" aria-hidden="true">
          <circle className="mascot-halo" cx="44" cy="44" r="42" />
          <path className="mascot-ear" d="M20 30 16 17l15 8m37 5 4-13-15 8" />
          <path
            className="mascot-body"
            d="M18 42c0-16 11-27 26-27s26 11 26 27v13c0 13-11 22-26 22S18 68 18 55V42Z"
          />
          <path
            className="mascot-face"
            d="M25 42c0-11 8-19 19-19s19 8 19 19v7c0 11-8 18-19 18s-19-7-19-18v-7Z"
          />
          <ellipse className="mascot-eye" cx="36" cy="43" rx="2.8" ry="4" />
          <ellipse className="mascot-eye" cx="52" cy="43" rx="2.8" ry="4" />
          <path className="mascot-smile" d="M37 53c4 4 10 4 14 0" />
          <path className="mascot-cheek" d="M28 49h4m24 0h4" />
          <path className="mascot-badge" d="M34 68h20v8H34z" />
          <text className="mascot-initials" x="44" y="74" textAnchor="middle">
            TN
          </text>
          <path className="mascot-spark" d="m73 27 2-5 2 5 5 2-5 2-2 5-2-5-5-2z" />
        </svg>
        <span className="mascot-label">{vi ? "Liên hệ" : "Contact"}</span>
      </button>
      {showTop && (
        <button
          className="floating-action floating-top"
          type="button"
          onClick={scrollToTop}
          aria-label={vi ? "Lên đầu trang" : "Back to top"}
          title={vi ? "Lên đầu trang" : "Back to top"}
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
}
