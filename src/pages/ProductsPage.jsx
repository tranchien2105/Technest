import BrandFilter from "../components/store/BrandFilter";
import { useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  PackageCheck,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import { tx } from "../utils/translate";
import { Empty } from "../components/store/PageElements";
import ProductGrid from "../components/store/ProductGrid";
import CurrencyInput from "../components/common/CurrencyInput";
import "./ProductsPage.css";

export default function ProductsPage({
  route,
  navigate,
  language,
  categories,
  visibleProducts = [],
  brands = [],
  brandCount,
  catalogLoading = false,
  catalogError = null,
  catalogPagination = null,
  catalogQuery = {},
  setCatalogQuery = () => {},
  activeCategory,
  setActiveCategory,
  sortBy,
  setSortBy,
  clearFilters,
  t,
  favorites,
  toggleFavorite,
  addToCart,
  compareIds,
  toggleCompare,
}) {
  const cardProps = {
    language,
    t,
    favorites,
    toggleFavorite,
    addToCart,
    navigate,
    compareIds,
    toggleCompare,
  };
  const { pathname: path } = new URL(route, "http://technest.local");
  const lang = language === "vi";
  const min = catalogQuery.minPrice || "";
  const max = catalogQuery.maxPrice || "";
  const [minDraft, setMinDraft] = useState(min);
  const [maxDraft, setMaxDraft] = useState(max);
  const filtered = visibleProducts;
  const selectedCategory = categories
    .slice(1)
    .flatMap((category) => [category, ...(category.children || [])])
    .find((category) => category.id === activeCategory);
  const categoryName = selectedCategory
    ? language === "vi"
      ? selectedCategory.name
      : selectedCategory.nameEn || selectedCategory.en || selectedCategory.name
    : brands.find((brand) => brand.id === catalogQuery.brand)?.name || "";
  const filterControls = (
    <div className="store-filters">
      <label>
        {tx("Category", "Danh mục", lang)}
        <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)}>
          <option value="all">{tx("All categories", "Tất cả danh mục", lang)}</option>
          {categories.slice(1).map((c) => (
            <optgroup key={c.id} label={c[language]}>
              <option value={c.id}>{c[language]} · {tx("All", "Tất cả", lang)}</option>
              {(c.children || []).map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <BrandFilter brands={brands} value={catalogQuery.brand || "all"} onChange={(value) => setCatalogQuery("brand", value)} language={language}/>
      <label>
        {tx("Min price", "Giá thấp nhất", lang)}
        <CurrencyInput
          key={`min-${min}`}
          value={minDraft}
          onValueChange={setMinDraft}
          onBlur={(event) => setCatalogQuery("minPrice", event.currentTarget.value.replace(/\D/g, ""))}
          placeholder="Giá thấp nhất"
        />
      </label>
      <label>
        {tx("Max price", "Giá cao nhất", lang)}
        <CurrencyInput
          key={`max-${max}`}
          value={maxDraft}
          onValueChange={setMaxDraft}
          onBlur={(event) => setCatalogQuery("maxPrice", event.currentTarget.value.replace(/\D/g, ""))}
          placeholder="Giá cao nhất"
        />
      </label>
      <label>
        {tx("Sort", "Sắp xếp", lang)}
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="recommended">{tx("Recommended", "Đề xuất", lang)}</option>
          <option value="newest">{tx("Newest", "Mới nhất", lang)}</option>
          <option value="priceLow">{tx("Price: low to high", "Giá: thấp đến cao", lang)}</option>
          <option value="priceHigh">{tx("Price: high to low", "Giá: cao đến thấp", lang)}</option>
        </select>
      </label>
      <button
        type="button"
        className="text-link"
        onClick={() => {
          setMinDraft("");
          setMaxDraft("");
          clearFilters();
        }}
      >
        {tx("Clear filters", "Xóa bộ lọc", lang)}
      </button>
    </div>
  );
  const cards = (items) => <ProductGrid {...cardProps} items={items} />;

  const q = new URL(route, "http://technest.local").searchParams.get("q") || "";
  const brandsCount = brandCount ?? brands.length;
  return (
    <section className={`store-page catalog-page${categoryName ? " catalog-page-category" : ""}`}>
      <div className="store-breadcrumb">
        <a href="/">{tx("Home", "Trang chủ", lang)}</a> /{" "}
        {path === "/search"
          ? `${tx("Search", "Tìm kiếm", lang)}: “${q}”`
          : categoryName || tx("Products", "Sản phẩm", lang)}
      </div>
      <header className="catalog-hero">
        <div className="catalog-hero-copy">
          <span className="section-kicker">{tx("TECHNEST STORE", "CỬA HÀNG TECHNEST", lang)}</span>
          <h1>
            {categoryName
              ? categoryName
              : path === "/search"
              ? `${tx("Results for", "Kết quả tìm kiếm cho", lang)} “${q}”`
              : tx("Find the right tech for you", "Chọn công nghệ phù hợp với bạn", lang)}
          </h1>
          <p>
            {categoryName
              ? tx(
                  `Browse our ${categoryName.toLowerCase()} selection and refine by brand or price.`,
                  `Khám phá sản phẩm ${categoryName.toLowerCase()} và lọc theo thương hiệu hoặc mức giá.`,
                  lang,
                )
              : path === "/search"
              ? tx(
                  "Explore matching products and refine your results below.",
                  "Khám phá sản phẩm phù hợp và tinh chỉnh kết quả bên dưới.",
                  lang,
                )
              : tx(
                  "Explore reliable devices, useful accessories and everyday essentials.",
                  "Khám phá thiết bị chính hãng, phụ kiện hữu ích và sản phẩm thiết yếu mỗi ngày.",
                  lang,
                )}
          </p>
          <a href="#catalog-results" className="catalog-hero-link">
            {tx("Browse products", "Xem sản phẩm", lang)} <ArrowRight size={15} />
          </a>
        </div>
        <div
          className="catalog-hero-highlights"
          aria-label={tx("Store highlights", "Thông tin cửa hàng", lang)}
        >
          <div>
            <span>
              <PackageCheck size={17} />
            </span>
            <strong>{tx("Genuine products", "Sản phẩm chính hãng", lang)}</strong>
            <small>{tx("Carefully selected", "Được tuyển chọn kỹ", lang)}</small>
          </div>
          <div>
            <span>
              <Tag size={17} />
            </span>
            <strong>{tx("Great value", "Giá tốt mỗi ngày", lang)}</strong>
            <small>{tx("Clear product pricing", "Giá bán minh bạch", lang)}</small>
          </div>
        </div>
      </header>
      <div className="catalog-summary">
        <div>
          <span className="catalog-summary-icon">
            <SlidersHorizontal size={17} />
          </span>
          <span>
            <strong>
              {catalogPagination?.total ?? filtered.length} {tx("products", "sản phẩm", lang)}
            </strong>
            <small>{tx("Ready to explore", "Đang có trong danh mục", lang)}</small>
          </span>
        </div>
        <div>
          <span className="catalog-summary-icon">
            <Tag size={17} />
          </span>
          <span>
            <strong>
              {brandsCount} {tx("brands", "thương hiệu", lang)}
            </strong>
            <small>{tx("Shop across trusted brands", "Lựa chọn từ nhiều thương hiệu", lang)}</small>
          </span>
        </div>
        <div className="catalog-summary-hint">
          <ArrowDownWideNarrow size={16} />{" "}
          {tx("Use filters to narrow your choice", "Dùng bộ lọc để tìm nhanh hơn", lang)}
        </div>
      </div>
      {filterControls}
      <div id="catalog-results" className="catalog-results-heading">
        <div>
          <span className="section-kicker">
            {tx("CURATED FOR YOU", "DÀNH RIÊNG CHO BẠN", lang)}
          </span>
          <h2>
            {categoryName
              ? tx(`Products in ${categoryName}`, `Sản phẩm ${categoryName.toLowerCase()}`, lang)
              : tx("Explore the collection", "Khám phá bộ sưu tập", lang)}
          </h2>
        </div>
        <span>
          {catalogPagination?.total ?? filtered.length} {tx("items", "sản phẩm", lang)}
        </span>
      </div>
      {catalogError && (
        <p className="catalog-feedback" role="status">
          {tx(
            "Catalog is temporarily unavailable. Please try again.",
            "Danh mục đang tạm thời không khả dụng. Vui lòng thử lại.",
            lang,
          )}
        </p>
      )}
      {catalogLoading ? (
        <div
          className="catalog-loading"
          aria-label={tx("Loading products", "Đang tải sản phẩm", lang)}
        >
          {Array.from({ length: 6 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      ) : filtered.length ? (
        cards(filtered)
      ) : (
        <Empty
          title={tx("No matching products", "Không tìm thấy sản phẩm phù hợp", lang)}
          text={tx(
            "Try another search or clear some filters.",
            "Hãy thử từ khóa khác hoặc xóa bớt bộ lọc.",
            lang,
          )}
          go={navigate}
          lang={lang}
        />
      )}
      {catalogPagination?.totalPages > 1 && (
        <CatalogPagination
          pagination={catalogPagination}
          onPageChange={(page) => setCatalogQuery("page", String(page))}
          language={language}
        />
      )}
    </section>
  );
}

function CatalogPagination({ pagination, onPageChange, language }) {
  const lang = language === "vi";
  const page = Number(pagination.page);
  const totalPages = Number(pagination.totalPages);
  const limit = Number(pagination.limit) || 24;
  const total = Number(pagination.total) || 0;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
  const firstItem = total ? (page - 1) * limit + 1 : 0;
  const lastItem = Math.min(page * limit, total);
  const jump = (nextPage) => {
    onPageChange(nextPage);
    document.getElementById("catalog-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav className="catalog-pagination" aria-label={tx("Product pages", "Trang sản phẩm", lang)}>
      <p className="catalog-pagination-count">
        {tx("Showing", "Đang xem", lang)} <strong>{firstItem}–{lastItem}</strong> {tx("of", "/", lang)} <strong>{total}</strong>
      </p>
      <div className="catalog-pagination-controls">
        <button type="button" className="catalog-page-step" disabled={page <= 1} onClick={() => jump(page - 1)}>
          {tx("Previous", "Trước", lang)}
        </button>
        {start > 1 && <>
          <button type="button" className="catalog-page-number" onClick={() => jump(1)}>1</button>
          {start > 2 && <span className="catalog-page-ellipsis" aria-hidden="true">…</span>}
        </>}
        {pages.map((number) => (
          <button
            key={number}
            type="button"
            className="catalog-page-number"
            aria-current={number === page ? "page" : undefined}
            onClick={() => jump(number)}
          >{number}</button>
        ))}
        {start + pages.length - 1 < totalPages && <>
          {start + pages.length < totalPages && <span className="catalog-page-ellipsis" aria-hidden="true">…</span>}
          <button type="button" className="catalog-page-number" onClick={() => jump(totalPages)}>{totalPages}</button>
        </>}
        <button type="button" className="catalog-page-step" disabled={page >= totalPages} onClick={() => jump(page + 1)}>
          {tx("Next", "Sau", lang)}
        </button>
      </div>
    </nav>
  );
}
