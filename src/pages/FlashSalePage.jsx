import { flashCampaignStatus, flashSaleProductUrl } from "../domain/flashSale";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, Flame, ShoppingBag } from "lucide-react";
import { flashSalesApi } from "../api/flashSalesClient";
import { formatPrice } from "../utils/formatCurrency";
import ProductImage from "../components/common/ProductImage";
import { apiEventSource } from "../api/apiClient";
import "./FlashSalePage.css";

function countdown(target, offset, now) {
  const ms = Math.max(0, new Date(target).getTime() - (now + offset));
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${days ? `${days} ngày ` : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function SaleItem({ item, campaign, addToCart, notify, navigate }) {
  const unavailable = campaign.status !== "ACTIVE" || item.availableQuantity <= 0 || item.stockAvailable <= 0;
  const soldPercent = Math.min(100, Math.round(((item.soldQuantity + item.reservedQuantity) / Math.max(1, item.quota)) * 100));
  const buy = () => {
    const availableQuantity = Math.min(item.stockAvailable, item.availableQuantity, item.perCustomerLimit);
    const product = { id: item.productId, variantId: item.variantId, defaultVariantId: item.variantId, name: item.name, image: item.image, price: item.flashPrice, oldPrice: item.originalPrice, flashSalePrice: item.flashPrice, flashSaleItemId: item.id, flashSaleAvailableQuantity: availableQuantity, stockStatus: availableQuantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK", availableQuantity, variants: [{ id: item.variantId, sku: item.sku, price: item.flashPrice, availableQuantity, stockStatus: availableQuantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK" }] };
    if (!addToCart(product, 1)) return;
    notify("Đã thêm ưu đãi Flash Sale vào giỏ hàng.");
  };
  return <article className="flash-item-card">
    <button className="flash-item-image" onClick={() => navigate(flashSaleProductUrl(item))} aria-label={item.name}><ProductImage src={item.image} alt={item.name} loading="lazy" /></button>
    <div className="flash-item-body"><span className="flash-item-discount">-{item.discountPercent}%</span><button className="flash-item-name" onClick={() => navigate(flashSaleProductUrl(item))}>{item.name}</button><small>{item.variantName} · {item.sku}</small>
      <div className="flash-item-price"><strong>{formatPrice(item.flashPrice)}</strong><del>{formatPrice(item.originalPrice)}</del></div>
      <div className="flash-progress"><span><i style={{ width: `${soldPercent}%` }} /></span><small>Đã bán {item.soldQuantity} · Còn {item.availableQuantity}</small></div>
      <button className="flash-buy-button" disabled={unavailable} onClick={buy}><ShoppingBag size={16}/>{campaign.status === "UPCOMING" ? "Sắp mở bán" : campaign.status === "PAUSED" ? "Tạm dừng" : item.availableQuantity <= 0 ? "Đã hết lượt" : item.stockAvailable <= 0 ? "Hết hàng" : campaign.status === "ENDED" ? "Đã kết thúc" : "Thêm vào giỏ"}</button>
    </div>
  </article>;
}

function FlashSaleSkeleton() {
  return (
    <div className="flash-loading-grid" role="status" aria-label="Đang tải chương trình Flash Sale">
      {Array.from({ length: 4 }, (_, index) => <article key={index}><span /><i /><i /><i /></article>)}
    </div>
  );
}

export default function FlashSalePage({ navigate, addToCart, notify }) {
  const [state, setState] = useState({ loading: true, error: "", campaigns: [], serverOffset: 0 });
  const [tick, setTick] = useState(0);
  const [retryVersion, setRetryVersion] = useState(0);
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const load = () => flashSalesApi.list({ signal: controller.signal }).then((data) => {
      setTick(Date.now());
      if (mounted) setState({ loading: false, error: "", campaigns: data.campaigns || [], serverOffset: new Date(data.serverNow).getTime() - Date.now() });
    }).catch((error) => { if (mounted && error.name !== "AbortError") setState((old) => ({ ...old, loading: false, error: error.message })); });
    void load();
    const poll = window.setInterval(() => void load(), 20_000);
    const clock = window.setInterval(() => setTick(Date.now()), 1000);
    const events = apiEventSource("/flash-sales/events");
    ["flash-sale:campaign-started", "flash-sale:campaign-ended", "flash-sale:item-updated", "flash-sale:campaign-updated"].forEach((name) => events.addEventListener(name, () => void load()));
    events.onopen = () => void load();
    return () => { mounted = false; controller.abort(); clearInterval(poll); clearInterval(clock); events.close(); };
  }, [retryVersion]);
  const campaigns = useMemo(() => state.campaigns.map((campaign) => ({ ...campaign, status: flashCampaignStatus(campaign, tick + state.serverOffset) })), [state.campaigns, state.serverOffset, tick]);
  return <main className="flash-page"><button className="flash-back" onClick={() => navigate("/")}><ArrowLeft size={16}/> Về trang chủ</button>
    <header className="flash-page-header"><div><span><Flame size={18}/> TECHNEST FLASH SALE</span><h1>Ưu đãi chớp nhoáng</h1><p>Số lượng giới hạn, giá ưu đãi được xác nhận tại bước đặt hàng.</p></div><button onClick={() => navigate("/products")}>Khám phá sản phẩm <ArrowRight size={16}/></button></header>
    {state.loading ? <FlashSaleSkeleton /> : state.error ? <div className="flash-page-state flash-error" role="alert">{state.error}<button type="button" onClick={() => { setState((current) => ({ ...current, loading: true, error: "" })); setRetryVersion((version) => version + 1); }}>Thử lại</button></div> : !campaigns.length ? <div className="flash-empty"><Clock3 size={26}/><h2>Chưa có chương trình Flash Sale</h2><p>Quay lại sau để xem các ưu đãi sắp diễn ra.</p></div> : campaigns.map((campaign) => <section className="flash-campaign" key={campaign.id}>
      <div className="flash-campaign-heading"><div><span className={`flash-status is-${campaign.status.toLowerCase()}`}>{campaign.status === "ACTIVE" ? "ĐANG DIỄN RA" : campaign.status === "UPCOMING" ? "SẮP DIỄN RA" : campaign.status}</span><h2>{campaign.name}</h2><p>{campaign.description}</p></div><div className="flash-timer"><small>{campaign.status === "UPCOMING" ? "BẮT ĐẦU SAU" : campaign.status === "ACTIVE" ? "KẾT THÚC SAU" : "ĐÃ KẾT THÚC"}</small><strong>{campaign.status === "ENDED" ? "00:00:00" : countdown(campaign.status === "UPCOMING" ? campaign.startsAt : campaign.endsAt, state.serverOffset, tick)}</strong><span>{new Date(campaign.startsAt).toLocaleString("vi-VN")} – {new Date(campaign.endsAt).toLocaleString("vi-VN")}</span></div></div>
      <div className="flash-item-grid">{campaign.items.map((item) => <SaleItem key={item.id} item={item} campaign={campaign} addToCart={addToCart} notify={notify} navigate={navigate}/>)}</div>
    </section>)}
  </main>;
}
