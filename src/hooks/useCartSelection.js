import { useState } from "react";
import { cartTotal, reconcileSelection } from "../domain/cart";

export function useCartSelection(cart, setCart) {
  const ids = cart.map((item) => item.id);
  const signature = ids.join(",");
  const [selection, setSelection] = useState(() => ({ ids, previousIds: ids, signature }));
  let selectedCartIds = selection.ids;
  // Adjust only when cart membership changes; preserve deliberate deselection.
  if (selection.signature !== signature) {
    selectedCartIds = reconcileSelection(selection.ids, selection.previousIds, ids);
    setSelection({ ids: selectedCartIds, previousIds: ids, signature });
  }
  const setSelectedCartIds = (update) =>
    setSelection((current) => ({
      ...current,
      ids: typeof update === "function" ? update(current.ids) : update,
    }));
  const selectedCart = cart.filter((item) =>
    selectedCartIds.some((id) => String(id) === String(item.id)),
  );
  return {
    selectedCartIds,
    setSelectedCartIds,
    selectedCart,
    selectedSubtotal: cartTotal(selectedCart),
    removeSelected: () => {
      const selected = new Set(selectedCartIds);
      setCart((current) =>
        current.filter((item) => ![...selected].some((id) => String(id) === String(item.id))),
      );
      setSelectedCartIds([]);
    },
  };
}
