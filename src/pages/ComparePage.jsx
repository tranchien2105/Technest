import { productUrl as getProductUrl } from "../routing/productUrl";
import { ArrowRight } from "lucide-react";
import ProductImage from "../components/common/ProductImage";
import { formatPrice } from "../utils/formatCurrency";
import { tx } from "../utils/translate";
import { PageTitle } from "../components/store/PageElements";
import { Empty } from "../components/store/PageElements";

export default function ComparePage({
  navigate,
  language,
  categories,
  products,
  compareIds,
  toggleCompare,
  addToCart,
  catalogLoading,
  catalogError,
}) {
  const lang = language === "vi";

  const compared = products.filter((item) =>
    compareIds.some((id) => String(id) === String(item.id)),
  );
  const rows = [
    [tx("Brand", "Thương hiệu", lang), (item) => item.brand],
    [
      tx("Category", "Danh mục", lang),
      (item) => categories.find((c) => c.id === item.category)?.[language] || item.category,
    ],
    [
      tx("Variant / SKU", "Phiên bản / SKU", lang),
      (item) => item.variants?.[0]?.sku || tx("Standard", "Tiêu chuẩn", lang),
    ],
    [tx("Highlights", "Mô tả", lang), (item) => item.description],
  ];
  return (
    <section className="store-page">
      <PageTitle
        title={tx("Compare products", "So sánh sản phẩm", lang)}
        desc={tx(
          "Choose up to three products to compare their key details.",
          "Chọn tối đa ba sản phẩm để so sánh thông tin chính.",
          lang,
        )}
      />
      {catalogError && compareIds.length > 0 && (
        <p className="catalog-feedback" role="status">
          {tx(
            "Compared products could not be refreshed from the catalog. Try again when the API is available.",
            "Chưa thể đồng bộ sản phẩm so sánh với danh mục. Hãy thử lại khi API hoạt động.",
            lang,
          )}
        </p>
      )}
      {catalogLoading && compareIds.length > 0 && compared.length === 0 && (
        <p className="catalog-feedback" role="status">
          {tx("Loading compared products…", "Đang tải sản phẩm so sánh…", lang)}
        </p>
      )}
      {compared.length ? (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead>
              <tr>
                <th>{tx("Product details", "Thông tin sản phẩm", lang)}</th>
                {compared.map((item) => (
                  <th key={item.id}>
                    <button className="compare-remove" onClick={() => toggleCompare(item.id)}>
                      {tx("Remove", "Bỏ chọn", lang)} ×
                    </button>
                    <ProductImage src={item.image} alt={item.name} />
                    <a href={getProductUrl(item)}>{item.name}</a>
                    <strong>{formatPrice(item.price)}</strong>
                    <button className="primary-button" onClick={() => addToCart(item)}>
                      {tx("Add to cart", "Thêm vào giỏ", lang)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, getValue]) => (
                <tr key={label}>
                  <th>{label}</th>
                  {compared.map((item) => (
                    <td key={item.id}>{getValue(item)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : compareIds.length > 0 && (catalogLoading || catalogError) ? null : (
        <Empty
          title={tx("Nothing to compare yet", "Chưa có sản phẩm để so sánh", lang)}
          text={tx(
            "Add products from their cards, then compare them here.",
            "Chọn biểu tượng cân trên thẻ sản phẩm rồi quay lại đây để xem bảng so sánh.",
            lang,
          )}
          go={navigate}
          lang={lang}
        />
      )}
      <button className="outline-button" onClick={() => navigate("/products")}>
        {tx("Browse products", "Xem sản phẩm", lang)} <ArrowRight size={16} />
      </button>
    </section>
  );
}
