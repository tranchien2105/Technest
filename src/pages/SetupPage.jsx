import { useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Headphones, Keyboard, Monitor, Mouse, Package, Plus, RotateCcw, Search, ShoppingCart, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { productUrl } from "../routing/productUrl";
import ProductImage from "../components/common/ProductImage";
import { formatPrice } from "../utils/formatCurrency";
import { cartTotal, canPurchaseStock, compareMoney } from "../domain/cart";
import "./SetupPage.css";

const groups = [
  { id: "monitors", vi: "Màn hình", en: "Monitor", icon: Monitor },
  { id: "keyboards", vi: "Bàn phím", en: "Keyboard", icon: Keyboard },
  { id: "mice", vi: "Chuột", en: "Mouse", icon: Mouse },
  { id: "audio", vi: "Âm thanh", en: "Audio", icon: Headphones },
  { id: "accessories", vi: "Phụ kiện", en: "Accessories", icon: Package },
];

export default function SetupPage({ navigate, language, categories = [], products = [], addToCart, catalogLoading, catalogError }) {
  const vi = language === "vi";
  const text = (vn, en) => vi ? vn : en;
  const [selection, setSelection] = useState({});
  const [activeGroup, setActiveGroup] = useState("monitors");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recommended");
  const chosen = groups.map((group) => products.find((item) => String(item.id) === String(selection[group.id]))).filter(Boolean);
  const total = cartTotal(chosen.map((item) => ({ ...item, quantity: 1 })));
  const currentGroup = groups.find((group) => group.id === activeGroup);
  const label = (group) => categories.find((category) => category.id === group.id)?.[language] || group[vi ? "vi" : "en"];
  const category = categories.find((item) => item.id === activeGroup);
  const categoryIds = new Set([activeGroup, ...(category?.children || []).map((item) => item.id)]);
  const options = products.filter((item) => categoryIds.has(item.category) && `${item.name} ${item.brand || ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  if (sort !== "recommended") options.sort((a, b) => compareMoney(a.price, b.price) * (sort === "low" ? 1 : -1));
  const chooseGroup = (id, scroll = false) => {
    setActiveGroup(id);
    setQuery("");
    if (scroll) document.getElementById("setup-product-picker")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };
  const remove = (id) => setSelection((current) => ({ ...current, [id]: "" }));
  const canAdd = chosen.length > 0 && chosen.every((item) => canPurchaseStock(item, 1));

  return <section className="store-page setup-builder-page setup-studio">
    <header className="setup-studio-hero">
      <div>
        <span className="setup-studio-eyebrow"><Sparkles size={15}/> TECHNEST SETUP STUDIO</span>
        <h1>{text("Góc bàn của bạn. Chất riêng của bạn.", "Your desk. Your own style.")}</h1>
        <p>{text("Ghép những thiết bị yêu thích thành một bộ setup của riêng mình. Chọn từng món, xem tổng tiền và sẵn sàng nâng cấp góc làm việc.", "Bring your favorite devices together. Pick your tools, see the total and build a workspace that feels like you.")}</p>
      </div>
      <div className="setup-studio-steps" aria-label={text("Các bước tạo bộ setup", "Setup steps")}>
        {[text("Chọn thiết bị", "Pick devices"), text("Ghép bộ setup", "Build your setup"), text("Thêm vào giỏ", "Add to cart")].map((step, index) => <span key={step}><b>{String(index + 1).padStart(2, "0")}</b>{step}</span>)}
      </div>
    </header>

    <div className="setup-studio-layout">
      <div className="setup-studio-workspace">
        <section className="setup-studio-preview" aria-label={text("Xem trước bố trí setup", "Setup layout preview")}>
          <div className="setup-studio-section-heading"><div><span className="setup-studio-eyebrow">SETUP PREVIEW</span><h2>{text("Bộ setup mang dấu ấn của bạn", "Your setup, coming together")}</h2><p className="setup-showcase-description">{text("Những thiết bị bạn chọn, trong cùng một góc nhìn.", "Your selected devices, all in one place.")}</p></div><span className="setup-studio-count"><span/>{chosen.length}/5 {text("thiết bị", "devices")}</span></div>
          <div className="setup-showcase">
            {groups.map(({ icon: Icon, ...group }) => {
              const item = chosen.find((product) => String(product.id) === String(selection[group.id]));
              return <article className={`setup-showcase-tile showcase-${group.id} ${item ? "is-selected" : ""}`} key={group.id}>
                <header><span><Icon size={14}/>{label(group)}</span>{item && <button type="button" onClick={() => chooseGroup(group.id, true)} aria-label={`${text("Đổi", "Change")} ${label(group)}`} title={text("Đổi thiết bị", "Change device")}><RotateCcw size={13}/></button>}</header>
                {item ? <a className="setup-showcase-product" href={productUrl(item)}><div className="setup-showcase-image"><ProductImage src={item.image} alt={item.name}/></div><div className="setup-showcase-product-info"><strong>{item.name}</strong><span>{formatPrice(item.price)}</span></div><span className="setup-showcase-detail-icon" aria-hidden="true"><ArrowUpRight size={15}/></span></a> : <button type="button" className="setup-showcase-empty" onClick={() => chooseGroup(group.id, true)}><span><Icon size={28}/></span><strong>{text("Chọn", "Choose")} {label(group).toLocaleLowerCase()}</strong><small><Plus size={12}/>{text("Thêm vào bộ setup", "Add to your setup")}</small></button>}
              </article>;
            })}
          </div>
          <div className="setup-showcase-footer"><span><Check size={13}/>{text("Chọn theo nhu cầu của bạn", "Choose what you need")}</span><span>{text("Có thể thay đổi từng thiết bị", "Swap any device along the way")}</span></div>
        </section>

        <section className="setup-studio-picker" id="setup-product-picker" aria-label={text("Chọn thiết bị", "Pick devices")}>
          <div className="setup-studio-section-heading"><div><span className="setup-studio-eyebrow">BUILD YOUR WAY</span><h2>{text("Chọn từng món. Ghép đúng gu.", "One device at a time.")}</h2></div><span className="setup-studio-picker-hint">{text("Mỗi danh mục chọn 1 sản phẩm", "One product per category")}</span></div>
          <div className="setup-studio-categories" role="group" aria-label={text("Danh mục thiết bị", "Device categories")}>
            {groups.map(({ icon: Icon, ...group }) => <button key={group.id} type="button" aria-pressed={activeGroup === group.id} className={activeGroup === group.id ? "is-active" : ""} onClick={() => chooseGroup(group.id)}><Icon size={19}/><span>{label(group)}</span>{selection[group.id] && <Check size={13} className="setup-studio-category-check"/>}</button>)}
          </div>
          <div className="setup-studio-picker-toolbar">
            <label className="setup-studio-search"><Search size={17}/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text("Tìm tên sản phẩm, thương hiệu…", "Search products or brands…")} aria-label={text("Tìm thiết bị trong danh mục", "Search devices in category")}/></label>
            <label className="setup-studio-sort"><SlidersHorizontal size={16}/><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={text("Sắp xếp sản phẩm", "Sort products")}><option value="recommended">{text("Đề xuất", "Recommended")}</option><option value="low">{text("Giá tăng dần", "Price: low to high")}</option><option value="high">{text("Giá giảm dần", "Price: high to low")}</option></select></label>
          </div>
          <div className="setup-studio-results-heading"><strong>{label(currentGroup)}</strong><span>{options.length} {text("lựa chọn", "options")}</span><a className="setup-studio-summary-jump" href="#setup-summary">{text("Xem bộ setup", "View setup")} ({chosen.length})<ArrowRight size={12}/></a></div>
          {catalogLoading ? <div className="setup-studio-products" role="status" aria-label={text("Đang tải thiết bị", "Loading devices")}>{[0, 1, 2].map((item) => <div className="setup-studio-skeleton" key={item}/>)}</div> : catalogError ? <div className="setup-studio-empty" role="alert"><Package size={28}/><h3>{text("Chưa tải được thiết bị", "Devices are unavailable")}</h3><p>{text("Kết nối có thể đang gián đoạn. Vui lòng tải lại trang để thử lại.", "Reload this page to try again.")}</p></div> : options.length ? <div className="setup-studio-products">{options.map((item) => {
            const selected = String(selection[activeGroup]) === String(item.id);
            const available = canPurchaseStock(item, 1);
            return <article key={item.id} className={`setup-studio-product ${selected ? "is-selected" : ""}`}>
              <button type="button" className="setup-studio-product-choice" aria-pressed={selected} disabled={!available} onClick={() => setSelection((current) => ({ ...current, [activeGroup]: selected ? "" : String(item.id) }))}>
                <div className="setup-studio-product-image"><ProductImage src={item.image} alt="" loading="lazy"/><span className="setup-studio-product-check">{selected ? <Check size={14}/> : <Plus size={14}/>}</span></div>
                <span className="setup-studio-product-brand">{item.brand || "TECHNEST"}</span><strong className="setup-studio-product-name">{item.name}</strong><b className="setup-studio-product-price">{formatPrice(item.price)}</b>
                <span className="setup-studio-select-label">{selected ? <><Check size={14}/>{text("Đã thêm vào setup", "Added to setup")}</> : available ? <><Plus size={14}/>{text("Chọn thiết bị", "Choose device")}</> : text("Hiện chưa thể mua", "Currently unavailable")}</span>
              </button>
              <a className="setup-studio-product-link" href={productUrl(item)}>{text("Thông tin sản phẩm", "Product details")}<ArrowUpRight size={13}/></a>
            </article>;
          })}</div> : <div className="setup-studio-empty"><Search size={28}/><h3>{text("Chưa tìm thấy thiết bị phù hợp", "No matching devices")}</h3><p>{query ? text("Thử tên khác hoặc bỏ từ khóa để xem các sản phẩm trong danh mục.", "Try another name or clear your search.") : text("Bạn có thể chọn danh mục khác để tiếp tục ghép bộ setup.", "Try another category to keep building your setup.")}</p>{query && <button type="button" onClick={() => setQuery("")}>{text("Xóa tìm kiếm", "Clear search")}</button>}</div>}
        </section>
      </div>

      <aside id="setup-summary" className="setup-studio-summary" aria-label={text("Tóm tắt bộ setup", "Setup summary")}>
        <div className="setup-studio-summary-heading"><span className="setup-studio-summary-icon"><ShoppingCart size={21}/></span><div><h2>{text("Bộ setup của bạn", "Your setup")}</h2><span>{chosen.length}/5 {text("danh mục đã chọn", "categories selected")}</span></div><button type="button" disabled={!chosen.length} onClick={() => setSelection({})} aria-label={text("Bỏ toàn bộ thiết bị đã chọn", "Reset selection")} title={text("Chọn lại từ đầu", "Start over")}><RotateCcw size={16}/></button></div>
        <div className="setup-studio-progress" aria-hidden="true">{groups.map((group) => <span key={group.id} className={selection[group.id] ? "is-filled" : ""}/>)}</div>
        <div className="setup-studio-summary-items">{groups.map(({ icon: Icon, ...group }) => {
          const item = chosen.find((product) => String(product.id) === String(selection[group.id]));
          return <div key={group.id} className={`setup-studio-summary-item ${item ? "is-selected" : ""}`}>
            {item ? <ProductImage src={item.image} alt=""/> : <span className="setup-studio-slot-icon"><Icon size={21}/></span>}
            <div><small>{label(group)}</small>{item ? <><strong>{item.name}</strong><b>{formatPrice(item.price)}</b></> : <button type="button" onClick={() => chooseGroup(group.id, true)}>{text("Chọn thiết bị", "Choose device")}<Plus size={12}/></button>}</div>
            {item && <button type="button" className="setup-studio-remove" onClick={() => remove(group.id)} aria-label={`${text("Bỏ", "Remove")} ${item.name}`}><X size={14}/></button>}
          </div>;
        })}</div>
        <div className="setup-studio-total" aria-live="polite"><span>{text("Tổng dự kiến", "Estimated total")}<small>{chosen.length} {text("sản phẩm · Mỗi loại 1 chiếc", "products · One of each")}</small></span><strong>{formatPrice(total)}</strong></div>
        <button type="button" className="setup-studio-add" disabled={!canAdd || catalogLoading} onClick={() => { chosen.forEach((item) => addToCart(item)); navigate("/cart"); }}><ShoppingCart size={17}/>{text("Thêm bộ setup vào giỏ", "Add setup to cart")}<ArrowRight size={17}/></button>
        <p className="setup-studio-summary-note">{text("Bạn có thể bỏ qua danh mục không cần. Giá và tồn kho được xác nhận khi thanh toán.", "Pick only what you need. Price and availability are confirmed at checkout.")}</p>
      </aside>
    </div>
  </section>;
}
