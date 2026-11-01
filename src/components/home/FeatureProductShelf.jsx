import ProductCard from "./ProductCard";
import HomeProductRail from "./HomeProductRail";

export default function FeatureProductShelf({
  products,
  title,
  language,
  t,
  favorites,
  toggleFavorite,
  addToCart,
  compareIds,
  toggleCompare,
  onViewProduct,
}) {
  if (!products?.length) return null;
  return (
    <section className="feature-product-shelf">
      <div className="section-heading">
        <h2>{title}</h2>
      </div>
      <HomeProductRail
        className="product-grid"
        language={language}
        label={language === "vi" ? "Sản phẩm vừa xem" : "Recently viewed products"}
      >
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            language={language}
            t={t}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            addToCart={addToCart}
            compareIds={compareIds}
            toggleCompare={toggleCompare}
            onViewProduct={onViewProduct}
          />
        ))}
      </HomeProductRail>
    </section>
  );
}
