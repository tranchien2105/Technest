import ProductImage from "../common/ProductImage";
import { ArrowRight } from "lucide-react";
import { useBanners } from "../../hooks/useBanners";

export default function ManagedBanners({ position, bannerPreview, onSelectPlacement, selectedPlacement, previewStatuses = {}, limit = 6 }) {
  const { items, loading, error } = useBanners(position, { enabled: !bannerPreview });
  const banners = (bannerPreview?.[position] || items).slice(0, limit);
  if (!bannerPreview && loading) return <div className="catalog-feedback" role="status">Đang tải ưu đãi…</div>;
  if (!bannerPreview && error) return <p className="catalog-feedback" role="status">Không thể tải ưu đãi trang chủ.</p>;
  if (!banners.length && !onSelectPlacement) return null;
  return (
    <section
      className={`managed-banners managed-banners-${position.toLowerCase()}`}
      aria-label="Ưu đãi từ Technest"
    >
      {banners.map((b, index) => (
        <a key={b.id} href={onSelectPlacement ? undefined : b.link} onClick={onSelectPlacement ? (event) => { event.preventDefault(); onSelectPlacement(position); } : undefined} className={`${onSelectPlacement ? "banner-edit-target" : ""} ${selectedPlacement === position ? "is-banner-selected" : ""}`} data-banner-placement={position}>
          <ProductImage src={b.imageUrl} alt={b.title} loading="lazy" />
          <div>
            <h2>{b.title}</h2>
            {b.subtitle && <p>{b.subtitle}</p>}
          <span className="managed-banner-cta"><span>{b.buttonText}</span><ArrowRight size={16} aria-hidden="true" /></span>
          {previewStatuses[position]?.[index] && <em className="banner-preview-state">{previewStatuses[position][index]}</em>}
          </div>
        </a>
      ))}
      {onSelectPlacement && !banners.length && <button className={`managed-banner-empty banner-edit-target ${selectedPlacement === position ? "is-banner-selected" : ""}`} data-banner-placement={position} type="button" onClick={() => onSelectPlacement(position)}>+ Chọn banner cho {position === "HOME_PROMO" ? "ưu đãi giữa trang" : "khu vực cuối trang"}</button>}
    </section>
  );
}
