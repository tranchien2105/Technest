import ProductCard from "./ProductCard";

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
      <div className="product-grid">
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
      </div>
    </section>
  );
}
