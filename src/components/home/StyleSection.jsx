import { ArrowRight } from "lucide-react";
import ProductImage from "../common/ProductImage";

export default function StyleSection({ t, language, selectCategory }) {
  return (
    <section className="home-style-section unified-section">
      <div className="section-heading">
        <div>
          <span className="section-kicker">
            {language === "vi" ? "TÌM CẢM HỨNG CHO GÓC SETUP" : "FIND YOUR SETUP INSPIRATION"}
          </span>
          <h2>{t.shopByMood}</h2>
          <p>{t.shopByMoodDesc}</p>
        </div>
      </div>
      <div className="setup-style-grid">
        <button
          className="setup-style-card setup-work"
          onClick={() => selectCategory("accessories")}
        >
          <ProductImage
            src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85"
            alt={t.setupWork}
            loading="lazy"
          />
          <span className="setup-style-overlay" />
          <span className="setup-style-copy">
            <small>01 / WORK</small>
            <strong>{t.setupWork}</strong>
            <em>
              {t.exploreMore} <ArrowRight size={15} />
            </em>
          </span>
        </button>
        <button
          className="setup-style-card setup-gaming"
          onClick={() => selectCategory("keyboards")}
        >
          <ProductImage
            src="https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=85"
            alt={t.setupGaming}
            loading="lazy"
          />
          <span className="setup-style-overlay" />
          <span className="setup-style-copy">
            <small>02 / PLAY</small>
            <strong>{t.setupGaming}</strong>
            <em>
              {t.exploreMore} <ArrowRight size={15} />
            </em>
          </span>
        </button>
        <button className="setup-style-card setup-audio" onClick={() => selectCategory("audio")}>
          <ProductImage
            src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85"
            alt={t.setupAudio}
            loading="lazy"
          />
          <span className="setup-style-overlay" />
          <span className="setup-style-copy">
            <small>03 / LISTEN</small>
            <strong>{t.setupAudio}</strong>
            <em>
              {t.exploreMore} <ArrowRight size={15} />
            </em>
          </span>
        </button>
      </div>
    </section>
  );
}
