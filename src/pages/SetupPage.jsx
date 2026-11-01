import { useState } from "react";
import { ArrowRight } from "lucide-react";
import ProductImage from "../components/common/ProductImage";
import { formatPrice } from "../utils/formatCurrency";
import { tx } from "../utils/translate";
import { PageTitle } from "../components/store/PageElements";
import { cartTotal } from "../domain/cart";

export default function SetupPage({ navigate, language, categories, products, addToCart }) {
  const lang = language === "vi";
  const [setupSelection, setSetupSelection] = useState({});

  const setupCategories = ["monitors", "keyboards", "mice", "audio", "accessories"];
  const chosenSetup = setupCategories
    .map((category) =>
      products.find((item) => String(item.id) === String(setupSelection[category])),
    )
    .filter(Boolean);
  const setupTotal = cartTotal(chosenSetup.map((item) => ({ ...item, quantity: 1 })));
  return (
    <section className="store-page setup-builder-page">
      <PageTitle
        eyebrow="TECHNEST SETUP STUDIO"
        title={tx("Build your setup", "Tạo bộ setup của bạn", lang)}
        desc={tx(
          "Pick the tools you need and see your setup come together.",
          "Chọn thiết bị bạn cần và xem tổng chi phí cho góc setup.",
          lang,
        )}
      />
      <section
        className="setup-preview-panel"
        aria-label={tx("Live setup preview", "Xem trước bộ setup", lang)}
      >
        <div className="setup-preview-heading">
          <div>
            <span className="section-kicker">{tx("LIVE PREVIEW", "XEM TRỰC TIẾP", lang)}</span>
            <h2>{tx("Your desk, your setup", "Góc bàn làm việc của bạn", lang)}</h2>
          </div>
          <span>
            {tx(
              "The preview updates as you choose products",
              "Hình minh họa thay đổi theo sản phẩm bạn chọn",
              lang,
            )}
          </span>
        </div>
        <div className="setup-scene-stage">
          <img
            className="setup-scene-image"
            src="/images/technest-setup-scene.svg"
            alt=""
            aria-hidden="true"
          />
          {chosenSetup.length ? (
            chosenSetup.map((item) => (
              <button
                type="button"
                className={`setup-scene-hotspot scene-hotspot-${item.category}`}
                key={item.id}
                onClick={() => navigate(`/products/${item.id}`)}
                aria-label={tx(
                  `${item.name}, ${formatPrice(item.price)}. Open product details.`,
                  `${item.name}, ${formatPrice(item.price)}. Mở chi tiết sản phẩm.`,
                  lang,
                )}
              >
                <span className="setup-scene-tooltip">
                  <strong>{item.name}</strong>
                  <b>{formatPrice(item.price)}</b>
                  <small>{item.description}</small>
                </span>
              </button>
            ))
          ) : (
            <div className="setup-scene-empty">
              {tx(
                "Select a product to highlight its place in your setup.",
                "Chọn sản phẩm để làm sáng vị trí của món đồ trên bàn.",
                lang,
              )}
            </div>
          )}
        </div>
        <p className="setup-preview-caption">
          {tx(
            "Hover over a highlighted item to see its details. Click to open the product page.",
            "Rê chuột lên món đang sáng để xem thông tin. Nhấn để mở trang chi tiết sản phẩm.",
            lang,
          )}
        </p>
      </section>
      <div className="setup-builder-grid">
        <div className="setup-choices">
          {setupCategories.map((category) => {
            const options = products.filter((item) => item.category === category);
            const selected = options.find(
              (item) => String(item.id) === String(setupSelection[category]),
            );
            return (
              <label className="setup-choice-card" key={category}>
                <span className="section-kicker">
                  {categories.find((item) => item.id === category)?.[language] || category}
                </span>
                <select
                  value={selected?.id || ""}
                  onChange={(event) =>
                    setSetupSelection((current) => ({
                      ...current,
                      [category]: event.target.value,
                    }))
                  }
                >
                  <option value="">{tx("Skip this category", "Bỏ qua danh mục này", lang)}</option>
                  {options.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {formatPrice(item.price)}
                    </option>
                  ))}
                </select>
                {selected && (
                  <div className="setup-choice-product">
                    <ProductImage src={selected.image} alt="" />
                    <span>{selected.name}</span>
                    <strong>{formatPrice(selected.price)}</strong>
                  </div>
                )}
              </label>
            );
          })}
        </div>
        <aside className="setup-summary-card">
          <h2>{tx("Your setup", "Bộ setup của bạn", lang)}</h2>
          {chosenSetup.length ? (
            chosenSetup.map((item) => (
              <p key={item.id}>
                <span>{item.name}</span>
                <strong>{formatPrice(item.price)}</strong>
              </p>
            ))
          ) : (
            <p>
              {tx(
                "Choose a few products to get started.",
                "Hãy chọn sản phẩm để bắt đầu ghép bộ.",
                lang,
              )}
            </p>
          )}
          <p className="setup-total">
            <span>{tx("Estimated total", "Tổng dự kiến", lang)}</span>
            <strong>{formatPrice(setupTotal)}</strong>
          </p>
          <button
            className="primary-button"
            disabled={!chosenSetup.length}
            onClick={() => {
              chosenSetup.forEach((item) => addToCart(item));
              navigate("/cart");
            }}
          >
            {tx("Add setup to cart", "Thêm bộ setup vào giỏ", lang)} <ArrowRight size={16} />
          </button>
        </aside>
      </div>
    </section>
  );
}
