import { tx } from "../utils/translate";
import { PageTitle } from "../components/store/PageElements";
import { Empty } from "../components/store/PageElements";
import ProductGrid from "../components/store/ProductGrid";

export default function FavoritesPage({
  navigate,
  language,
  products,
  favorites,
  t,
  toggleFavorite,
  addToCart,
  compareIds,
  toggleCompare,
  catalogLoading,
  catalogError,
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
  const lang = language === "vi";
  const cards = (items) => <ProductGrid {...cardProps} items={items} />;

  return (
    <section className="store-page">
      <PageTitle
        title={tx("Your favorites", "Sản phẩm yêu thích", lang)}
        desc={`${favorites.length} ${tx("saved products", "sản phẩm đã lưu", lang)}`}
      />
      {catalogError && favorites.length > 0 && (
        <p className="catalog-feedback" role="status">
          {tx(
            "Saved products could not be refreshed from the catalog. Try again when the API is available.",
            "Chưa thể đồng bộ sản phẩm đã lưu với danh mục. Hãy thử lại khi API hoạt động.",
            lang,
          )}
        </p>
      )}
      {catalogLoading && favorites.length > 0 && products.length === 0 && (
        <p className="catalog-feedback" role="status">
          {tx("Loading saved products…", "Đang tải sản phẩm đã lưu…", lang)}
        </p>
      )}
      {favorites.length ? (
        products.some((x) => favorites.some((id) => String(id) === String(x.id))) ?
          cards(products.filter((x) => favorites.some((id) => String(id) === String(x.id)))) :
          !catalogLoading && !catalogError && (
            <Empty
              title={tx("Saved products unavailable", "Sản phẩm đã lưu không còn khả dụng", lang)}
              text={tx("These products may have been removed from the catalog.", "Sản phẩm có thể đã bị gỡ khỏi danh mục.", lang)}
              go={navigate}
              lang={lang}
            />
          )
      ) : (
        <Empty
          title={tx("Nothing saved yet", "Chưa có sản phẩm yêu thích", lang)}
          text={tx(
            "Save products to find them here later.",
            "Lưu sản phẩm yêu thích để xem lại tại đây.",
            lang,
          )}
          go={navigate}
          lang={lang}
        />
      )}
    </section>
  );
}
