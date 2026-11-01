import ProductCard from "../home/ProductCard";
export default function ProductGrid({
  items,
  language,
  t,
  favorites,
  toggleFavorite,
  addToCart,
  navigate,
  compareIds,
  toggleCompare,
}) {
  return (
    <div className="product-grid">
      {items.map((x) => (
        <ProductCard
          key={x.id}
          product={x}
          language={language}
          t={t}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          addToCart={addToCart}
          onViewProduct={(item) => navigate(`/products/${item.id}`)}
          compareIds={compareIds}
          toggleCompare={toggleCompare}
        />
      ))}
    </div>
  );
}
