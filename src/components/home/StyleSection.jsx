import { ArrowRight, Sparkles } from "lucide-react";
import ProductImage from "../common/ProductImage";

export default function StyleSection({ t, language, selectCategory, cms }) {
  const fallbackCards = [
    { key: "work", eyebrow: "01 / WORK", title: t.setupWork, titleEn: "A calmer workspace", description: "Sắp xếp góc bàn gọn gàng, tập trung cho công việc mỗi ngày.", descriptionEn: "Create a tidy desk that helps you focus through the workday.", imageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85", categorySlug: "accessories", className: "setup-work" },
    { key: "gaming", eyebrow: "02 / PLAY", title: t.setupGaming, titleEn: "A standout gaming setup", description: "Chọn thiết bị phù hợp cho những giờ giải trí của bạn.", descriptionEn: "Find the right gear for your time away from work.", imageUrl: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=85", categorySlug: "keyboards", className: "setup-gaming" },
    { key: "audio", eyebrow: "03 / LISTEN", title: t.setupAudio, titleEn: "A personal sound space", description: "Khám phá tai nghe và loa cho không gian nghe riêng.", descriptionEn: "Explore headphones and speakers for your own listening space.", imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85", categorySlug: "audio", className: "setup-audio" },
  ];
  const cards = cms?.cards || fallbackCards;
  return (
    <section className="home-style-section unified-section">
      <div className="setup-intro-panel">
        <div className="setup-intro-copy">
          <span className="section-kicker">
            {cms?.eyebrow ?? (language === "vi" ? "TÌM CẢM HỨNG CHO GÓC SETUP" : "FIND YOUR SETUP INSPIRATION")}
          </span>
          <h2>{cms?.title ?? t.shopByMood}</h2>
          <p>{cms?.description ?? t.shopByMoodDesc}</p>
        </div>
        <a className="setup-builder-promo" href="/setup">
          <span className="setup-builder-promo-icon">
            <Sparkles size={18} />
          </span>
          <span className="setup-builder-promo-copy">
            <small>TECHNEST SETUP STUDIO</small>
            <strong>
              {language === "vi" ? "Tự ghép bộ setup của bạn" : "Build your own setup"}
            </strong>
            <em>
              {language === "vi" ? "Chọn thiết bị, xem tổng chi phí" : "Choose gear and see the total"}
            </em>
          </span>
          <span className="setup-builder-fact">
            <strong>5</strong>
            <small>{language === "vi" ? "nhóm thiết bị" : "gear categories"}</small>
          </span>
          <ArrowRight size={18} />
        </a>
      </div>
      <div className="setup-style-grid">
        {cards.map((card, index) => (
          <button className={`setup-style-card ${card.className || `setup-${card.key}`}`} key={card.key} onClick={() => selectCategory(card.categorySlug)}>
            <ProductImage src={card.imageUrl} alt={language === "vi" ? card.title : card.titleEn} loading="lazy" />
            <span className="setup-style-overlay" />
            <span className="setup-style-copy">
              <small>{card.eyebrow || `0${index + 1}`}</small>
              <strong>{language === "vi" ? card.title : card.titleEn}</strong>
              <span className="setup-style-description">{language === "vi" ? card.description : card.descriptionEn}</span>
              <em>{cms?.ctaLabel ?? t.exploreMore} <ArrowRight size={15} /></em>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
