import { productUrl as getProductUrl } from "../../routing/productUrl";
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
      {items.map((x, index) => (
        <ProductCard
          key={x.id}
          priority={index === 0}
          product={x}
          language={language}
          t={t}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          addToCart={addToCart}
          onViewProduct={(item) => navigate(getProductUrl(item))}
          compareIds={compareIds}
          toggleCompare={toggleCompare}
        />
      ))}
    </div>
  );
}
