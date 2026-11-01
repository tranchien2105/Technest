import { useCallback, useEffect, useState } from "react";
import { toggleId } from "../domain/cart";
import { readStored, writeStored } from "../domain/storage";

export function useProductLists(products, favoritesState, compareState) {
  const [favorites, setFavorites] = favoritesState;
  const [compareIds, setCompareIds] = compareState;
  const match = globalThis.location?.pathname.match(/^\/products\/(\d+)$/);
  const initialId = match && match[1];
  const [viewedIds, setViewedIds] = useState(() => {
    const saved = readStored("technest-viewed", []);
    return initialId
      ? [initialId, ...saved.filter((id) => String(id) !== initialId)].slice(0, 8).map(String)
      : saved.map(String);
  });
  useEffect(() => {
    writeStored("technest-viewed", viewedIds);
  }, [viewedIds]);
  const recordVisit = useCallback(
    (url) => {
      const path = new URL(url, "http://technest.local").pathname;
      const match = path.match(/^\/products\/(\d+)$/);
      const productId = match?.[1];
      const product = productId && products.find((item) => String(item.id) === productId);
      if (product)
        setViewedIds((current) =>
          [String(product.id), ...current.filter((id) => String(id) !== String(product.id))].slice(
            0,
            8,
          ),
        );
    },
    [products, setViewedIds],
  );
  return {
    favorites,
    compareIds,
    setCompareIds,
    recordVisit,
    favoriteProducts: products.filter((product) =>
      favorites.some((id) => String(id) === String(product.id)),
    ),
    viewedProducts: viewedIds
      .map((id) => products.find((product) => String(product.id) === String(id)))
      .filter(Boolean),
    toggleFavorite: (id) => setFavorites((current) => toggleId(current.map(String), String(id))),
    toggleCompare: (id) => setCompareIds((current) => toggleId(current.map(String), String(id), 3)),
  };
}
