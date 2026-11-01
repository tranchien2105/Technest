import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Eye, Monitor, Save, Smartphone, Undo2, Upload, X } from "lucide-react";
import HomePage from "../pages/HomePage";
import { adminApi } from "../api/adminClient";

const labels = {
  announcement: "Thanh thông báo",
  categories: "Danh mục sản phẩm",
  featured: "Sản phẩm nổi bật",
  deals: "Ưu đãi",
  campaigns: "Chiến dịch sản phẩm",
  "promotional-banners": "Banner giữa trang",
  style: "Gợi ý phong cách",
  trending: "Sản phẩm thịnh hành",
  "new-arrivals": "Sản phẩm mới",
  "trusted-brands": "Thương hiệu",
  "feature-banner": "Banner giới thiệu",
  services: "Dịch vụ Technest",
  "shopping-guide": "Hướng dẫn mua sắm",
  "bottom-banners": "Banner cuối trang",
  "popular-searches": "Tìm kiếm phổ biến",
};
const regionSelectors = {
  announcement: ".announcement-bar",
  categories: ".quick-categories",
  featured: ".product-section",
  deals: ".deal-feature",
  campaigns: ".home-campaigns",
  "promotional-banners": ".managed-banners-home_promo",
  style: ".home-style-section",
  trending: ".home-trending-section",
  "new-arrivals": ".home-new-section",
  "trusted-brands": ".trusted-brands",
  "feature-banner": ".feature-banner",
  services: ".service-section",
  "shopping-guide": ".home-shopping-guide",
  "bottom-banners": ".managed-banners-home_bottom",
  "popular-searches": ".home-popular-searches",
};
const defaultStyleCards = [
  { key: "work", eyebrow: "01 / WORK", title: "Góc làm việc tối giản", titleEn: "A calmer workspace", description: "Sắp xếp góc bàn gọn gàng, tập trung cho công việc mỗi ngày.", descriptionEn: "Create a tidy desk that helps you focus through the workday.", imageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=85", categorySlug: "accessories" },
  { key: "gaming", eyebrow: "02 / PLAY", title: "Góc gaming nổi bật", titleEn: "A standout gaming setup", description: "Chọn thiết bị phù hợp cho những giờ giải trí của bạn.", descriptionEn: "Find the right gear for your time away from work.", imageUrl: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=900&q=85", categorySlug: "keyboards" },
  { key: "audio", eyebrow: "03 / LISTEN", title: "Không gian âm thanh", titleEn: "A personal sound space", description: "Khám phá tai nghe và loa cho không gian nghe riêng.", descriptionEn: "Explore headphones and speakers for your own listening space.", imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85", categorySlug: "audio" },
];

export default function AdminHomepageCms({ previewProps, canWrite = true }) {
  const [draft, setDraft] = useState(null);
  const [published, setPublished] = useState(null);
  const [selected, setSelected] = useState("featured");
  const [device, setDevice] = useState("desktop");
  const [mode, setMode] = useState("edit");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [savedDraft, setSavedDraft] = useState(null);
  const previewShellRef = useRef(null);
  const [previewScale, setPreviewScale] = useState(1);
  const dirty = Boolean(draft && savedDraft && JSON.stringify(draft) !== JSON.stringify(savedDraft));
  const current = selected === "announcement" ? draft?.announcement : draft?.sections?.[selected];

  const load = useCallback(async (signal) => {
    try {
      const result = await adminApi.homepage({ signal });
      setDraft(result.draft);
      setSavedDraft(result.draft);
      setPublished(result.published);
      setError("");
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message || "Không tải được cấu hình trang chủ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);

  useEffect(() => {
    const warn = (event) => {
      if (dirty) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const chooseRegion = useCallback((event) => {
    if (mode !== "edit") return;
    const banner = event.target.closest("[data-banner-placement]");
    if (banner) {
      event.preventDefault();
      event.stopPropagation();
      previewProps.navigate?.("/admin/banners");
      window.setTimeout(() => window.dispatchEvent(new CustomEvent("technest:banner-location", { detail: { position: banner.dataset.bannerPlacement } })), 80);
      return;
    }
    const target = event.target.closest("[data-cms-section]");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    setSelected(target.dataset.cmsSection);
  }, [mode, previewProps]);

  const previewRef = useCallback((node) => {
    if (!node || mode !== "edit") return;
    Object.entries(regionSelectors).forEach(([key, selector]) => {
      node.querySelectorAll(selector).forEach((element) => {
        element.dataset.cmsSection = key;
        element.setAttribute("aria-label", `Chỉnh sửa: ${labels[key]}`);
        if (key === selected) element.dataset.cmsSelected = "true";
        else delete element.dataset.cmsSelected;
      });
    });
    node.querySelectorAll("[data-banner-placement]").forEach((element) => {
      element.setAttribute("title", `Chỉnh sửa banner tại ${element.dataset.bannerPlacement}`);
    });
  }, [mode, selected]);

  useEffect(() => {
    const shell = previewShellRef.current;
    if (!shell) return undefined;
    const baseWidth = device === "mobile" ? 390 : 1440;
    const measure = () => {
      setPreviewScale(Math.min(shell.clientWidth / baseWidth, 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(shell);
    return () => observer.disconnect();
  }, [device, mode]);

  const updateValue = (field, value) => {
    setDraft((valueNow) => selected === "announcement"
      ? { ...valueNow, announcement: { ...valueNow.announcement, [field]: value } }
      : { ...valueNow, sections: { ...valueNow.sections, [selected]: { ...valueNow.sections[selected], [field]: value } } });
  };
  const updateStyleCard = (index, field, value) => {
    setDraft((valueNow) => {
      const cards = [...(valueNow.sections.style.cards || defaultStyleCards)];
      cards[index] = { ...cards[index], [field]: value };
      return { ...valueNow, sections: { ...valueNow.sections, style: { ...valueNow.sections.style, cards } } };
    });
  };
  const moveSection = (direction) => {
    const order = [...draft.sectionOrder];
    const index = order.indexOf(selected);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= order.length) return;
    [order[index], order[next]] = [order[next], order[index]];
    setDraft((valueNow) => ({ ...valueNow, sectionOrder: order }));
  };
  const save = async (publish = false) => {
    if (!canWrite || !draft) return;
    setSaving(true); setError("");
    try {
      const saved = await adminApi.saveHomepageDraft(draft);
      setDraft(saved.draft || draft);
      setSavedDraft(saved.draft || draft);
      if (publish) {
        const result = await adminApi.publishHomepage();
        setPublished(result.published);
        setToast("Đã xuất bản nội dung trang chủ.");
      } else setToast("Đã lưu bản nháp. Khách hàng vẫn đang xem bản đã xuất bản.");
    } catch (failure) { setError(failure.message || "Không thể lưu cấu hình."); }
    finally { setSaving(false); }
  };
  const discard = async () => {
    if (dirty && !window.confirm("Hủy các thay đổi chưa lưu?")) return;
    setDraft(savedDraft);
    setError("");
  };

  const previewPropsWithDraft = useMemo(() => ({ ...previewProps, homepageConfig: draft, cmsEditable: mode === "edit", onCmsSelect: setSelected }), [previewProps, draft, mode]);

  if (loading) return <div className="admin-state">Đang tải cấu hình trang chủ…</div>;
  if (!draft) return <section className="admin-panel"><p className="admin-error">{error || "Chưa tải được cấu hình."}</p><button onClick={() => { setLoading(true); void load(); }}>Thử lại</button></section>;

  return <section className="admin-home-cms">
    <div className="admin-home-cms-toolbar">
      <div className="admin-home-cms-tabs"><button className={mode === "edit" ? "is-active" : ""} onClick={() => setMode("edit")}><Upload size={15}/> Chỉnh sửa</button><button className={mode === "preview" ? "is-active" : ""} onClick={() => setMode("preview")}><Eye size={15}/> Xem trước</button></div>
      <div className="admin-home-cms-actions"><span className={dirty ? "is-dirty" : ""}>{dirty ? "Chưa lưu" : "Bản nháp đã lưu"}</span><button onClick={() => setDevice("desktop")} className={device === "desktop" ? "is-active" : ""} aria-label="Xem desktop"><Monitor size={16}/></button><button onClick={() => setDevice("mobile")} className={device === "mobile" ? "is-active" : ""} aria-label="Xem mobile"><Smartphone size={16}/></button><button onClick={discard} disabled={!dirty || saving}><Undo2 size={15}/> Hủy</button><button onClick={() => void save(false)} disabled={!canWrite || !dirty || saving}><Save size={15}/> Lưu nháp</button><button className="is-publish" onClick={() => void save(true)} disabled={!canWrite || saving}><Check size={15}/> Xuất bản</button></div>
    </div>
    {error && <p className="admin-error" role="alert">{error}</p>}
    {toast && <p className="admin-home-cms-toast" role="status">{toast}<button onClick={() => setToast("")} aria-label="Đóng"><X size={14}/></button></p>}
    <div className={`admin-home-cms-workspace ${mode === "preview" ? "is-preview" : ""}`}>
      <div className="admin-home-cms-preview-shell" ref={previewShellRef}>
        <div className="admin-home-cms-preview-canvas" style={{ width: device === "mobile" ? 390 : 1440, zoom: previewScale }}>
          <div className={`admin-home-cms-preview ${device === "mobile" ? "is-mobile" : "is-desktop"}`} style={{ width: device === "mobile" ? 390 : 1440 }} ref={previewRef} onClickCapture={chooseRegion}>
            <HomePage {...previewPropsWithDraft} showHome />
          </div>
        </div>
      </div>
      {mode === "edit" && <aside className="admin-home-cms-editor">
        <div className="admin-home-cms-editor-heading"><div><span className="admin-eyebrow">CHỈNH SỬA TRANG CHỦ</span><h2>{labels[selected]}</h2></div><span>{dirty ? "Bản nháp" : "Đã lưu"}</span></div>
        <label className="admin-home-cms-field"><span>Chọn khu vực</span><select value={selected} onChange={(event) => setSelected(event.target.value)}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {selected === "announcement" ? <>
          <label className="admin-home-cms-toggle"><input type="checkbox" checked={current.visible} onChange={(event) => updateValue("visible", event.target.checked)}/> Hiển thị thanh thông báo</label>
          <label className="admin-home-cms-field"><span>Nội dung</span><input maxLength={180} value={current.text} onChange={(event) => updateValue("text", event.target.value)}/></label>
          <label className="admin-home-cms-field"><span>Liên kết đích</span><input value={current.href} onChange={(event) => updateValue("href", event.target.value)} placeholder="/products"/></label>
        </> : <>
          <label className="admin-home-cms-toggle"><input type="checkbox" checked={current.visible} onChange={(event) => updateValue("visible", event.target.checked)}/> Hiển thị section</label>
          {selected !== "categories" && <div className="admin-home-cms-order"><span>Thứ tự hiển thị</span><button type="button" onClick={() => moveSection(-1)} disabled={draft.sectionOrder.indexOf(selected) <= 1} aria-label="Đưa section lên"><ChevronUp size={16}/></button><small>{draft.sectionOrder.indexOf(selected) + 1} / {draft.sectionOrder.length}</small><button type="button" onClick={() => moveSection(1)} disabled={draft.sectionOrder.indexOf(selected) < 0 || draft.sectionOrder.indexOf(selected) === draft.sectionOrder.length - 1} aria-label="Đưa section xuống"><ChevronDown size={16}/></button></div>}
          {["featured", "deals", "trending", "new-arrivals", "style", "trusted-brands", "feature-banner", "shopping-guide", "popular-searches"].includes(selected) && <>
            {current.eyebrow !== undefined && <label className="admin-home-cms-field"><span>Nhãn nhỏ</span><input maxLength={80} value={current.eyebrow} onChange={(event) => updateValue("eyebrow", event.target.value)}/></label>}
            <label className="admin-home-cms-field"><span>Tiêu đề</span><input maxLength={120} value={current.title} onChange={(event) => updateValue("title", event.target.value)}/></label>
            {["featured", "deals", "trending", "new-arrivals", "style", "trusted-brands", "feature-banner"].includes(selected) && <label className="admin-home-cms-field"><span>Mô tả</span><textarea maxLength={500} rows={3} value={current.description} onChange={(event) => updateValue("description", event.target.value)}/></label>}
          </>}
          {current.ctaLabel !== undefined && <label className="admin-home-cms-field"><span>Nội dung nút</span><input maxLength={60} value={current.ctaLabel} onChange={(event) => updateValue("ctaLabel", event.target.value)}/></label>}
          {current.ctaUrl !== undefined && <label className="admin-home-cms-field"><span>Đường dẫn nút</span><input value={current.ctaUrl} onChange={(event) => updateValue("ctaUrl", event.target.value)}/></label>}
          {current.limit !== undefined && <label className="admin-home-cms-field"><span>Số lượng hiển thị</span><input type="number" min={1} max={24} value={current.limit} onChange={(event) => updateValue("limit", Number(event.target.value))}/></label>}
          {selected === "categories" && <label className="admin-home-cms-field"><span>Danh mục hiển thị (để trống là tất cả)</span><select multiple value={current.categorySlugs || []} onChange={(event) => updateValue("categorySlugs", [...event.target.selectedOptions].map((option) => option.value))}>{(previewProps.categories || []).filter((item) => item.id !== "all").map((item) => <option key={item.id} value={item.slug || item.id}>{item.vi || item.name || item.id}</option>)}</select></label>}
          {selected === "featured" && <label className="admin-home-cms-field"><span>Chọn sản phẩm cụ thể (để trống dùng sản phẩm nổi bật từ API)</span><select multiple value={current.productIds || []} onChange={(event) => updateValue("productIds", [...event.target.selectedOptions].map((option) => option.value))}>{(previewProps.catalog?.products || []).map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}</select></label>}
          {selected === "featured" && <label className="admin-home-cms-field"><span>Lọc thương hiệu (để trống là tất cả)</span><select multiple value={current.brandSlugs || []} onChange={(event) => updateValue("brandSlugs", [...event.target.selectedOptions].map((option) => option.value))}>{(previewProps.brands || []).map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>}
          {selected === "featured" && <label className="admin-home-cms-field"><span>Sắp xếp sản phẩm</span><select value={current.sort || "recommended"} onChange={(event) => updateValue("sort", event.target.value)}><option value="recommended">Đề xuất</option><option value="newest">Mới nhất</option><option value="priceLow">Giá thấp đến cao</option><option value="priceHigh">Giá cao đến thấp</option></select></label>}
          {selected === "style" && (current.cards || defaultStyleCards).map((card, index) => <details className="admin-home-cms-card-editor" key={card.key} open={index === 0}><summary>{card.eyebrow} · {card.title}</summary><div className="admin-home-cms-card-fields">
            <label className="admin-home-cms-field"><span>Nhãn</span><input maxLength={40} value={card.eyebrow} onChange={(event) => updateStyleCard(index, "eyebrow", event.target.value)}/></label>
            <label className="admin-home-cms-field"><span>Tiêu đề (Tiếng Việt)</span><input maxLength={100} value={card.title} onChange={(event) => updateStyleCard(index, "title", event.target.value)}/></label>
            <label className="admin-home-cms-field"><span>Title (English)</span><input maxLength={100} value={card.titleEn} onChange={(event) => updateStyleCard(index, "titleEn", event.target.value)}/></label>
            <label className="admin-home-cms-field"><span>Mô tả (Tiếng Việt)</span><textarea maxLength={240} rows={2} value={card.description} onChange={(event) => updateStyleCard(index, "description", event.target.value)}/></label>
            <label className="admin-home-cms-field"><span>Description (English)</span><textarea maxLength={240} rows={2} value={card.descriptionEn} onChange={(event) => updateStyleCard(index, "descriptionEn", event.target.value)}/></label>
            <label className="admin-home-cms-field"><span>URL hình ảnh</span><input type="url" maxLength={500} value={card.imageUrl} onChange={(event) => updateStyleCard(index, "imageUrl", event.target.value)}/></label>
            <label className="admin-home-cms-field"><span>Danh mục khi nhấn</span><select value={card.categorySlug} onChange={(event) => updateStyleCard(index, "categorySlug", event.target.value)}>{(previewProps.categories || []).filter((item) => item.id !== "all").map((item) => <option key={item.id} value={item.slug || item.id}>{item.vi || item.name || item.id}</option>)}</select></label>
          </div></details>)}
          {selected === "feature-banner" && <label className="admin-home-cms-field"><span>URL hình ảnh</span><input type="url" maxLength={500} value={current.imageUrl || ""} onChange={(event) => updateValue("imageUrl", event.target.value)}/></label>}
          {["featured", "trending", "new-arrivals", "deals"].includes(selected) && <p className="admin-home-cms-note">Tên, giá, khuyến mãi và tồn kho vẫn lấy từ dữ liệu Backend. Cấu hình này chỉ đổi cách hiển thị.</p>}
        </>}
        {selected === "featured" && <button className="admin-home-cms-secondary" onClick={() => window.location.assign("/admin/banners")}>Quản lý vị trí banner</button>}
        <p className="admin-home-cms-note">Bản nháp chỉ xuất hiện trong preview quản trị. Khách hàng tiếp tục xem bản đã xuất bản cho đến khi nhấn “Xuất bản”.</p>
        {published && <small>Cập nhật public: cấu hình đã xuất bản</small>}
      </aside>}
    </div>
  </section>;
}
