import { flashCampaignStatus, flashSaleProductUrl } from "../../domain/flashSale";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Flame } from "lucide-react";
import { flashSalesApi } from "../../api/flashSalesClient";
import { formatPrice } from "../../utils/formatCurrency";
import { useHorizontalWheel } from "../../hooks/useHorizontalWheel";
import ProductImage from "../common/ProductImage";
import { apiEventSource } from "../../api/apiClient";
import "./home-flash-sale.css";

function campaignStatus(campaign, now) {
  return flashCampaignStatus(campaign, now);
}

function FlashSaleCountdown({ campaign, offset, status, onStatusChange }) {
  const [now, setNow] = useState(() => Date.now());
  const nextStatus = campaignStatus(campaign, now + offset);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (nextStatus !== status) onStatusChange(nextStatus);
  }, [nextStatus, status, onStatusChange]);
  const target = new Date(status === "UPCOMING" ? campaign.startsAt : campaign.endsAt).getTime();
  const remaining = Math.max(0, target - (now + offset));
  const timer = `${String(Math.floor(remaining / 3_600_000)).padStart(2,"0")}:${String(Math.floor(remaining % 3_600_000 / 60_000)).padStart(2,"0")}:${String(Math.floor(remaining % 60_000 / 1000)).padStart(2,"0")}`;
  return <div className="home-flash-clock"><small>{status === "UPCOMING" ? "MỞ BÁN SAU" : "KẾT THÚC SAU"}</small><strong>{timer}</strong></div>;
}

export default function HomeFlashSaleSection({ navigate, cms = {} }) {
  const [campaign, setCampaign] = useState(null);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState("UPCOMING");
  const railRef = useRef(null);
  useHorizontalWheel(railRef, Boolean(campaign && cms.visible !== false));
  const dragRef = useRef({ pointerId: null, startX: 0, scrollLeft: 0, moved: false });
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = () => flashSalesApi.list({ signal: controller.signal }).then((data) => {
      if (!active) return;
      const serverOffset = new Date(data.serverNow).getTime() - Date.now();
      const nextCampaign = (data.campaigns || []).find((item) => ["ACTIVE", "SCHEDULED"].includes(item.status) && item.items.length) || null;
      setOffset(serverOffset);
      setCampaign(nextCampaign);
      if (nextCampaign) setStatus(campaignStatus(nextCampaign, Date.now() + serverOffset));
    }).catch(() => {});
    void load();
    const poll = setInterval(load, 20_000);
    const events = apiEventSource("/flash-sales/events");
    ["flash-sale:campaign-started", "flash-sale:campaign-ended", "flash-sale:item-updated", "flash-sale:campaign-updated"].forEach((name) => events.addEventListener(name, load));
    events.onopen = load;
    return () => { active = false; controller.abort(); clearInterval(poll); events.close(); };
  }, []);
  const updateStatus = useCallback((next) => setStatus((current) => current === next ? current : next), []);
  if (!campaign || cms.visible === false) return null;
  if (status === "ENDED") return null;
  const railItems = campaign.items;
  const handleRailPointerDown = (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, scrollLeft: railRef.current.scrollLeft, moved: false };
  };
  const handleRailPointerMove = (event) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(deltaX) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      setIsDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    railRef.current.scrollLeft = drag.scrollLeft - deltaX;
    event.preventDefault();
  };
  const finishRailPointer = (event) => {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    dragRef.current = { pointerId: null, startX: 0, scrollLeft: 0, moved: false };
    setIsDragging(false);
  };
  const preventClickAfterDrag = (event) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  };
  return <section className={`home-flash-sale ${status === "ACTIVE" ? "is-live" : "is-upcoming"}`} aria-label="Flash Sale đang diễn ra">
    <div className="home-flash-heading"><div className="home-flash-heading-copy"><div className="home-flash-kicker-row"><span className="home-flash-kicker"><Flame size={17}/> TECHNEST FLASH SALE</span><span className={`home-flash-live-state ${status === "ACTIVE" ? "is-live" : "is-upcoming"}`}><i/>{status === "ACTIVE" ? "HOT · ĐANG MỞ BÁN" : "SẮP MỞ BÁN"}</span></div><h2>{cms.title || campaign.name}</h2>{(cms.description || campaign.description) && <p>{cms.description || campaign.description}</p>}</div><FlashSaleCountdown campaign={campaign} offset={offset} status={status} onStatusChange={updateStatus}/><button onClick={() => navigate("/flash-sale")}>{cms.ctaLabel || "Xem tất cả"} <ArrowRight size={16}/></button></div>
    <div ref={railRef} className={`home-flash-rail${railItems.length < 4 ? " is-short" : ""}${isDragging ? " is-dragging" : ""}`} role="region" tabIndex={0} aria-label="Sản phẩm Flash Sale, kéo hoặc cuộn ngang để xem thêm" onPointerDown={handleRailPointerDown} onPointerMove={handleRailPointerMove} onPointerUp={finishRailPointer} onPointerCancel={finishRailPointer} onClickCapture={preventClickAfterDrag}>{railItems.map((item) => {
      const percent = Math.min(100, Math.round(((item.soldQuantity + item.reservedQuantity) / Math.max(1, item.quota)) * 100));
      const availableQuantity = Math.min(item.stockAvailable, item.availableQuantity);
      const nearlySoldOut = availableQuantity > 0 && availableQuantity <= Math.max(3, Math.ceil(item.quota * 0.2));
      const productUrl = flashSaleProductUrl(item);
      return (
        <a key={item.id} className="home-flash-card" href={productUrl} onClick={(event) => { event.preventDefault(); navigate(productUrl); }}>
          <div className="home-flash-image">
            <ProductImage src={item.image} alt={item.name} loading="lazy" />
            <span className="home-flash-image-tag"><Flame size={13} /> DEAL HOT</span>
            <span className="home-flash-badge">-{item.discountPercent}%</span>
          </div>
          <div className="home-flash-card-body">
            <div className="home-flash-product-meta"><span>{item.variantName || "Ưu đãi giới hạn"}</span><span className={nearlySoldOut ? "is-low-stock" : ""}>{availableQuantity > 0 ? `Còn ${availableQuantity} suất` : "Đã hết suất"}</span></div>
            <span className="home-flash-name">{item.name}</span>
            <div className="home-flash-price"><strong>{formatPrice(item.flashPrice)}</strong><del>{formatPrice(item.originalPrice)}</del></div>
            <div className="home-flash-savings">Tiết kiệm {formatPrice(Math.max(0, Number(item.originalPrice) - Number(item.flashPrice)))}</div>
            <div className="home-flash-stock-heading"><span>Đã bán {item.soldQuantity} · Đang giữ {item.reservedQuantity}</span><strong>{percent}% quota</strong></div>
            <div className="home-flash-progress" role="progressbar" aria-label={`Đã bán ${percent}% quota ${item.name}`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percent}%` }} /></div>
            <div className="home-flash-limit">Tối đa {item.perCustomerLimit} sản phẩm / khách</div>
          </div>
        </a>
      );
    })}</div>
  </section>;
}
