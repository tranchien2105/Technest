import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, CalendarClock, Check, ChevronDown, Clock3, Flame, Plus, RefreshCw, Search, X } from "lucide-react";
import { apiGet } from "../api/apiClient";
import { flashSalesApi } from "../api/flashSalesClient";
import { formatPrice } from "../utils/formatCurrency";
import ProductImage from "../components/common/ProductImage";
import CurrencyInput from "../components/common/CurrencyInput";

const localDate = (value) => { const date = new Date(new Date(value).toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" })); return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}T${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`; };
const localDateToIso = (value) => new Date(`${value}:00+07:00`).toISOString();
const emptyForm = () => ({ name: "", description: "", startsAt: localDate(Date.now()+3_600_000), endsAt: localDate(Date.now()+7_200_000) });
const statuses = ["", "DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "ENDED", "CANCELLED"];
const statusLabels = { DRAFT: "Bản nháp", SCHEDULED: "Sắp diễn ra", ACTIVE: "Đang hoạt động", PAUSED: "Tạm dừng", ENDED: "Đã kết thúc", CANCELLED: "Đã hủy" };
const lockedStatuses = new Set(["DRAFT", "PAUSED", "ENDED", "CANCELLED"]);
const campaignStatusAt = (campaign, now) => {
  if (lockedStatuses.has(campaign.status)) return campaign.status;
  if (now < Date.parse(campaign.startsAt)) return "SCHEDULED";
  if (now >= Date.parse(campaign.endsAt)) return "ENDED";
  return "ACTIVE";
};
const countdownText = (milliseconds) => {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  return `${hours}:${minutes}:${String(seconds % 60).padStart(2, "0")}`;
};
const currentTime = () => Date.now();
const dateTimeText = (value) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
const variantImage = (variant) => {
  const images = variant?.product?.images || [];
  return images.find((image) => String(image.variantId) === String(variant.id))?.url
    || images.find((image) => !image.variantId)?.url
    || images[0]?.url
    || variant?.product?.image
    || "";
};

function FlashSaleTimeInput({ value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const valid = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
  const [hours, minutes] = valid ? value.split(":") : ["12", "00"];

  return <div className="flash-admin-time-control">
    <input type="text" required inputMode="numeric" autoComplete="off" maxLength="5" pattern="([01][0-9]|2[0-3]):[0-5][0-9]" placeholder="14:30" aria-label={`${label}, giờ 24 giờ`} value={value} onChange={(event) => onChange(event.target.value.replace(/[^0-9:]/g, "").slice(0, 5))} />
    <button type="button" className="flash-admin-time-picker-toggle" aria-label={`Mở bộ chọn giờ cho ${label}`} aria-expanded={open} onClick={() => setOpen((current) => !current)}><Clock3 size={15}/><span>Chọn giờ</span></button>
    {open && <div className="flash-admin-time-picker" role="group" aria-label={`Chọn giờ cho ${label}`}>
      <label>Giờ<select value={hours} onChange={(event) => onChange(`${event.target.value}:${minutes}`)}>{Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0")).map((hour) => <option key={hour} value={hour}>{hour}</option>)}</select></label>
      <label>Phút<select value={minutes} onChange={(event) => onChange(`${hours}:${event.target.value}`)}>{Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0")).map((minute) => <option key={minute} value={minute}>{minute}</option>)}</select></label>
      <button type="button" onClick={() => setOpen(false)}>Xong</button>
    </div>}
  </div>;
}

export default function AdminFlashSalesPanel({ canWrite }) {
  const [campaigns, setCampaigns] = useState([]);
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [saleItems, setSaleItems] = useState([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState([]);
  const [variantQuery, setVariantQuery] = useState("");
  const [showVariantOptions, setShowVariantOptions] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [serverOffset, setServerOffset] = useState(0);
  const [clientNow, setClientNow] = useState(0);
  const refreshRef = useRef(null);
  const syncCampaigns = (data, requestedAt, receivedAt) => {
    const serverNow = data.find((campaign) => campaign.serverNow)?.serverNow;
    if (serverNow) setServerOffset(Date.parse(serverNow) - ((requestedAt + receivedAt) / 2));
    setCampaigns(data);
  };
  const refresh = useCallback(async () => {
    const requestedAt = currentTime();
    const data = await flashSalesApi.adminList(filter || undefined);
    syncCampaigns(data, requestedAt, currentTime());
  }, [filter]);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => {
    let active = true;
    const requestedAt = currentTime();
    flashSalesApi.adminList(filter || undefined).then((data) => { if (active) syncCampaigns(data, requestedAt, currentTime()); }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [filter]);
  useEffect(() => { const timer = window.setInterval(() => setClientNow(currentTime()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const now = currentTime() + serverOffset;
    const nextBoundary = campaigns.reduce((nearest, campaign) => {
      if (lockedStatuses.has(campaign.status)) return nearest;
      const boundary = now < Date.parse(campaign.startsAt) ? Date.parse(campaign.startsAt) : Date.parse(campaign.endsAt);
      return boundary > now && (nearest === null || boundary < nearest) ? boundary : nearest;
    }, null);
    if (nextBoundary === null) return undefined;
    const timer = window.setTimeout(() => { void refreshRef.current?.().catch((e) => setError(e.message)); }, Math.max(50, nextBoundary - now + 150));
    return () => window.clearTimeout(timer);
  }, [campaigns, serverOffset]);
  useEffect(() => { const controller = new AbortController(); apiGet("/products?limit=100", { signal: controller.signal }).then((data) => setProducts(data.items || [])).catch(() => {}); return () => controller.abort(); }, []);
  const activeVariants = products.flatMap((product) => (product.variants || []).filter((variant) => variant.status === "ACTIVE").map((variant) => ({ ...variant, product })));
  const filteredVariants = activeVariants.filter((variant) => `${variant.product.name} ${variant.name} ${variant.sku}`.toLocaleLowerCase("vi").includes(variantQuery.trim().toLocaleLowerCase("vi")));
  const openCreate = () => { setEditing(null); setForm(emptyForm()); setSaleItems([]); setSelectedVariantIds([]); setVariantQuery(""); setShowVariantOptions(false); setShowForm(true); setError(""); };
  const openEdit = (campaign) => { setEditing(campaign); setSaleItems(campaign.items.map((item)=>({variantId:String(item.variantId),flashPrice:String(item.flashPrice),quota:String(item.quota),perCustomerLimit:String(item.perCustomerLimit),sortOrder:item.sortOrder}))); setSelectedVariantIds([]); setVariantQuery(""); setShowVariantOptions(false); setForm({ ...emptyForm(), name: campaign.name, description: campaign.description || "", startsAt: localDate(campaign.startsAt), endsAt: localDate(campaign.endsAt) }); setShowForm(true); setError(""); };
  const addSelectedVariants = () => {
    const existing = new Set(saleItems.map((item) => String(item.variantId)));
    const additions = selectedVariantIds.filter((id) => !existing.has(String(id))).map((id) => ({
      variantId: String(id), flashPrice: "", quota: "10", perCustomerLimit: "1", sortOrder: saleItems.length,
    }));
    if (!additions.length) return;
    setSaleItems((items) => [...additions, ...items].map((item, index) => ({ ...item, sortOrder: index })));
    setSelectedVariantIds([]); setVariantQuery(""); setShowVariantOptions(false); setError("");
  };
  const updateSaleItem = (variantId, key, value) => setSaleItems((items) => items.map((item) => String(item.variantId) === String(variantId) ? { ...item, [key]: value } : item));
  const updateSchedulePart = (key, part, value) => setForm((current) => {
    const [date = "", time = ""] = (current[key] || "").split("T");
    const nextDate = part === "date" ? value : date;
    const nextTime = part === "time" ? value : time;
    return { ...current, [key]: nextDate ? `${nextDate}T${nextTime}` : "" };
  });
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const validSchedule = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/;
      if (!validSchedule.test(form.startsAt) || !validSchedule.test(form.endsAt)) throw new Error("Nhập giờ theo định dạng 24 giờ, ví dụ 14:30.");
      if (Date.parse(localDateToIso(form.startsAt)) >= Date.parse(localDateToIso(form.endsAt))) throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu.");
      if (!saleItems.length) throw new Error("Campaign cần ít nhất một sản phẩm.");
      const items = saleItems.map((item) => {
        const variant = activeVariants.find((entry) => String(entry.id) === String(item.variantId));
        const flashPrice = Number(item.flashPrice);
        const quota = Number(item.quota);
        const perCustomerLimit = Number(item.perCustomerLimit);
        const originalPrice = Number(variant?.price || variant?.product.price);
        if (!variant || !Number.isSafeInteger(flashPrice) || flashPrice <= 0 || flashPrice >= originalPrice) throw new Error(`Giá Flash Sale của ${variant?.product.name || "sản phẩm"} phải lớn hơn 0 và thấp hơn giá hiện tại.`);
        if (!Number.isSafeInteger(quota) || quota < 0) throw new Error(`Quota của ${variant.product.name} phải là số nguyên từ 0 trở lên.`);
        if (!Number.isSafeInteger(perCustomerLimit) || perCustomerLimit < 1) throw new Error(`Giới hạn mỗi khách của ${variant.product.name} phải từ 1 trở lên.`);
        return { ...item, flashPrice, quota, perCustomerLimit };
      });
      if (editing) await flashSalesApi.adminUpdate(editing.id, { name: form.name, description: form.description, startsAt: localDateToIso(form.startsAt), endsAt: localDateToIso(form.endsAt), items });
      else {
        await flashSalesApi.adminCreate({ name: form.name, description: form.description, startsAt: localDateToIso(form.startsAt), endsAt: localDateToIso(form.endsAt), status: "SCHEDULED", items });
      }
      setShowForm(false); await refresh();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const setStatus = async (campaign, status) => { setBusy(true); setError(""); try { await flashSalesApi.adminUpdate(campaign.id, { status }); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const cancel = async (campaign) => { if (!window.confirm(`Hủy campaign “${campaign.name}”?`)) return; setBusy(true); try { await flashSalesApi.adminCancel(campaign.id); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const totals = campaigns.reduce((sum,c)=>({quota:sum.quota+c.items.reduce((x,i)=>x+i.quota,0),sold:sum.sold+c.items.reduce((x,i)=>x+i.soldQuantity,0),reserved:sum.reserved+c.items.reduce((x,i)=>x+i.reservedQuantity,0)}),{quota:0,sold:0,reserved:0});
  return <div className="flash-admin"><div className="flash-admin-toolbar"><div><h2><Flame size={20}/> Flash Sale Campaigns</h2><p>Trạng thái được tính theo lịch chạy; giá và quota được xác thực trong checkout.</p></div><div><select aria-label="Lọc trạng thái campaign" value={filter} onChange={(e)=>setFilter(e.target.value)}>{statuses.map((status)=><option key={status} value={status}>{status ? statusLabels[status] : "Tất cả trạng thái"}</option>)}</select><button onClick={()=>void refresh()}><RefreshCw size={15}/> Làm mới</button>{canWrite&&<button className="flash-admin-primary" onClick={openCreate}><Plus size={16}/> Tạo campaign</button>}</div></div>
    {error&&<div className="flash-admin-error">{error}</div>}
    <div className="flash-admin-metrics"><article><Activity/><small>Tổng quota</small><strong>{totals.quota}</strong></article><article><Flame/><small>Đã bán</small><strong>{totals.sold}</strong></article><article><CalendarClock/><small>Đang giữ</small><strong>{totals.reserved}</strong></article></div>
    <div className="flash-admin-list">
      {campaigns.filter((campaign) => !filter || campaignStatusAt(campaign, clientNow + serverOffset) === filter).map((campaign) => {
        const quota = campaign.items.reduce((total, item) => total + item.quota, 0);
        const sold = campaign.items.reduce((total, item) => total + item.soldQuantity, 0);
        const reserved = campaign.items.reduce((total, item) => total + item.reservedQuantity, 0);
        const effectiveStatus = campaignStatusAt(campaign, clientNow + serverOffset);
        const statusLabel = statusLabels[effectiveStatus] || effectiveStatus;
        const countdownTarget = effectiveStatus === "ACTIVE" ? Date.parse(campaign.endsAt) : effectiveStatus === "SCHEDULED" ? Date.parse(campaign.startsAt) : null;
        const countdownLabel = effectiveStatus === "ACTIVE" ? "KẾT THÚC SAU" : "BẮT ĐẦU SAU";
        return (
          <article key={campaign.id} className="flash-admin-campaign">
            <div className="flash-admin-campaign-main">
              <div className="flash-admin-campaign-icon"><Flame /></div>
              <div className="flash-admin-campaign-heading">
                <div className="flash-admin-status-row">
                  <span className={`flash-status is-${effectiveStatus.toLowerCase()}`}>{statusLabel}</span>
                  <span className={`flash-admin-live-state is-${effectiveStatus.toLowerCase()}`}><i />{effectiveStatus === "ACTIVE" ? "ĐANG DIỄN RA" : effectiveStatus === "SCHEDULED" ? "CHƯA ĐẾN GIỜ" : effectiveStatus === "ENDED" ? "ĐÃ HẾT THỜI GIAN" : effectiveStatus === "PAUSED" ? "ĐANG TẠM DỪNG" : effectiveStatus === "CANCELLED" ? "ĐÃ HỦY" : "CHƯA KÍCH HOẠT"}</span>
                </div>
                <h3>{campaign.name}</h3>
                {countdownTarget !== null && <div className={`flash-admin-countdown is-${effectiveStatus.toLowerCase()}`}><Clock3 size={15}/><span>{countdownLabel}</span><strong>{countdownText(countdownTarget - (clientNow + serverOffset))}</strong></div>}
                <div className="flash-admin-timeline">
                  <span className="flash-admin-timeline-caption">GIỜ VIỆT NAM · UTC+7</span>
                  <span><small>BẮT ĐẦU</small><strong>{dateTimeText(campaign.startsAt)}</strong></span>
                  <span className="flash-admin-timeline-arrow" aria-hidden="true">→</span>
                  <span><small>KẾT THÚC</small><strong>{dateTimeText(campaign.endsAt)}</strong></span>
                </div>
              </div>
            </div>
            <div className="flash-admin-stats">
              <span><b>{campaign.items.length}</b>Sản phẩm</span><span><b>{campaign.orderCount}</b>Đơn hàng</span><span><b>{quota}</b>Quota</span><span><b>{sold}</b>Đã bán</span><span><b>{reserved}</b>Đang giữ</span><span><b>{formatPrice(campaign.revenue)}</b>Doanh thu đã thanh toán</span>
            </div>
            <div className="flash-admin-actions">
              {canWrite && <><button onClick={() => openEdit(campaign)}>Sửa</button>{effectiveStatus === "PAUSED" ? <button onClick={() => void setStatus(campaign, Date.parse(campaign.startsAt) > clientNow + serverOffset ? "SCHEDULED" : "ACTIVE")}>Tiếp tục</button> : !["ENDED", "CANCELLED"].includes(effectiveStatus) && <button onClick={() => void setStatus(campaign, "PAUSED")}>Tạm dừng</button>}{effectiveStatus !== "CANCELLED" && <button className="is-danger" onClick={() => void cancel(campaign)}>Hủy</button>}</>}
            </div>
            <div className="flash-admin-items">
              {campaign.items.slice().sort((a, b) => b.soldQuantity - a.soldQuantity).map((item) => (
                <div key={item.id}><ProductImage src={item.image} alt="" /><span>{item.name}<small>{item.variantName} · {item.sku}</small></span><strong>{formatPrice(item.flashPrice)}</strong><small>{item.soldQuantity}/{item.quota} bán</small></div>
              ))}
            </div>
            {campaign.orders?.length > 0 && <div className="flash-admin-orders"><strong>Đơn hàng gần đây</strong>{campaign.orders.map((order) => <div key={order.id}><b>{order.orderNumber}</b><span>{order.status} · {order.paymentStatus}</span><small>{dateTimeText(order.createdAt)}</small><strong>{formatPrice(order.amount)}</strong></div>)}</div>}
          </article>
        );
      })}
      {!campaigns.length && <div className="flash-admin-empty">Chưa có campaign nào trong bộ lọc này.</div>}
    </div>
    {showForm&&<div className="admin-modal-backdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)setShowForm(false);}}><form className="admin-editor-modal flash-admin-form" onSubmit={save}><header><div><small>FLASH SALE</small><h2>{editing?"Sửa campaign":"Tạo campaign"}</h2></div><button type="button" className="admin-icon-button" onClick={()=>setShowForm(false)}><X size={18}/></button></header><label>Tên campaign<input required minLength="2" maxLength="160" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label>Mô tả<textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></label><p className="flash-admin-timezone-note">Thời gian bắt đầu và kết thúc sử dụng giờ Việt Nam (UTC+7).</p><div className="flash-admin-form-row flash-admin-schedule-row">{[["startsAt", "Bắt đầu"], ["endsAt", "Kết thúc"]].map(([key, label]) => <fieldset className="flash-admin-schedule-field" key={key}><legend>{label}</legend><label>Ngày<input type="date" required value={form[key].slice(0, 10)} onChange={(event) => updateSchedulePart(key, "date", event.target.value)} /></label><div className="flash-admin-time-field"><span>Giờ (24h)</span><FlashSaleTimeInput value={form[key].slice(11, 16)} label={label.toLowerCase()} onChange={(value) => updateSchedulePart(key, "time", value)} /></div></fieldset>)}</div><div className="flash-admin-product-picker"><label htmlFor="flash-sale-variant-search">Chọn sản phẩm / biến thể</label><div className="flash-admin-product-combobox"><div className="flash-admin-picker-input"><Search size={17} aria-hidden="true"/><input id="flash-sale-variant-search" type="search" role="combobox" aria-label="Tìm sản phẩm hoặc SKU" aria-autocomplete="list" aria-expanded={showVariantOptions} aria-controls="flash-sale-variant-options" placeholder="Tìm tên sản phẩm, biến thể hoặc SKU…" value={variantQuery} onFocus={()=>setShowVariantOptions(true)} onChange={(event)=>{setVariantQuery(event.target.value);setShowVariantOptions(true);}} onKeyDown={(event)=>{if(event.key==="Escape")setShowVariantOptions(false);if(event.key==="ArrowDown"&&showVariantOptions){event.preventDefault();document.querySelector("#flash-sale-variant-options button")?.focus();}}} onBlur={()=>setShowVariantOptions(false)}/><button type="button" aria-label={showVariantOptions?"Đóng danh sách sản phẩm":"Mở danh sách sản phẩm"} aria-haspopup="listbox" onMouseDown={(event)=>event.preventDefault()} onClick={()=>setShowVariantOptions((open)=>!open)}><ChevronDown size={17}/></button></div>{showVariantOptions&&<div className="flash-admin-picker-results" id="flash-sale-variant-options" role="listbox" aria-multiselectable="true">{filteredVariants.length?filteredVariants.map((variant)=>{const id=String(variant.id);const alreadyAdded=saleItems.some((item)=>String(item.variantId)===id);const checked=selectedVariantIds.includes(id);return <button type="button" role="option" aria-selected={checked} aria-disabled={alreadyAdded} disabled={alreadyAdded} key={id} onMouseDown={(event)=>event.preventDefault()} onClick={()=>setSelectedVariantIds((ids)=>ids.includes(id)?ids.filter((selectedId)=>selectedId!==id):[...ids,id])}><span className={`flash-admin-option-check ${checked?"is-checked":""}`}>{checked&&<Check size={13}/>}</span><ProductImage className="flash-admin-picker-thumbnail" src={variantImage(variant)} alt="" loading="lazy"/><span className="flash-admin-option-details"><strong>{variant.product.name}</strong><small>{variant.name} · SKU {variant.sku}</small></span><b>{alreadyAdded?"Đã thêm":formatPrice(Number(variant.price||variant.product.price))}</b></button>}):<p>Không tìm thấy sản phẩm hoặc biến thể phù hợp.</p>}</div>}</div>{selectedVariantIds.length>0&&<div className="flash-admin-selection-action"><span>Đã chọn <strong>{selectedVariantIds.length}</strong> biến thể</span><button type="button" onClick={addSelectedVariants}><Plus size={15}/> Thêm {selectedVariantIds.length} sản phẩm</button></div>}</div>{saleItems.length>0&&<section className="flash-admin-config-items" aria-label="Sản phẩm trong campaign"><h3>Sản phẩm trong campaign <span>({saleItems.length})</span></h3><p>Chỉnh giá Flash Sale, quota và giới hạn riêng cho từng biến thể.</p>{saleItems.map((saleItem)=>{const variant=activeVariants.find((entry)=>String(entry.id)===String(saleItem.variantId));const originalPrice=Number(variant?.price||variant?.product.price||0);const flashPrice=Number(saleItem.flashPrice)||0;const saving=originalPrice-flashPrice;const discount=originalPrice>0&&saving>0?Math.round((saving/originalPrice)*100):0;return <article className="flash-admin-config-item" key={saleItem.variantId}><div className="flash-admin-config-product"><ProductImage className="flash-admin-picker-thumbnail is-selected" src={variantImage(variant)} alt=""/><span><strong>{variant?.product.name||`Sản phẩm #${saleItem.variantId}`}</strong><small>{variant?.name||"Biến thể"} · SKU {variant?.sku||saleItem.variantId}</small><div className="flash-admin-price-compare"><span><small>GIÁ GỐC</small><del>{formatPrice(originalPrice)}</del></span><span className="is-sale"><small>GIÁ FLASH SALE</small><strong>{formatPrice(flashPrice)}</strong></span>{saving>0?<em>Tiết kiệm {formatPrice(saving)} · −{discount}%</em>:<em className="is-hint">Nhập giá thấp hơn giá gốc</em>}</div></span><button type="button" aria-label={`Gỡ ${variant?.product.name||"sản phẩm"} khỏi campaign`} onClick={()=>setSaleItems((items)=>items.filter((item)=>String(item.variantId)!==String(saleItem.variantId)))}><X size={16}/></button></div><div className="flash-admin-config-fields"><label>Giá Flash Sale (₫)<CurrencyInput required value={saleItem.flashPrice} onValueChange={(value)=>updateSaleItem(saleItem.variantId,"flashPrice",value)}/></label><label>Quota<input type="number" min="0" step="1" required value={saleItem.quota} onChange={(event)=>updateSaleItem(saleItem.variantId,"quota",event.target.value)}/></label><label>Giới hạn / khách<input type="number" min="1" step="1" required value={saleItem.perCustomerLimit} onChange={(event)=>updateSaleItem(saleItem.variantId,"perCustomerLimit",event.target.value)}/></label></div></article>})}</section>}<footer><button type="button" onClick={()=>setShowForm(false)}>Đóng</button><button type="submit" className="admin-primary-button flash-admin-primary" disabled={busy}>{busy?"Đang lưu…":"Lưu campaign"}</button></footer></form></div>}
  </div>;
}
