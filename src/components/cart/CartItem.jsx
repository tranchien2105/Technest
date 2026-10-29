import { Minus, Plus, Trash2 } from "lucide-react";
import { formatPrice } from "../../utils/formatCurrency";
import ProductImage from "../common/ProductImage";

export default function CartItem({ item, onChangeQuantity, onRemove, t }) {
  return (
    <div className="drawer-product">
      <ProductImage src={item.image} alt={item.name} />
      <div className="drawer-product-info">
        <strong>{item.name}</strong>
        <span>{formatPrice(item.price)}</span>
        <div className="quantity-control">
          <button onClick={() => onChangeQuantity(item.id, -1)} aria-label="Decrease quantity">
            <Minus size={13} />
          </button>
          <span>{item.quantity}</span>
          <button onClick={() => onChangeQuantity(item.id, 1)} aria-label="Increase quantity">
            <Plus size={13} />
          </button>
        </div>
      </div>
      <button className="remove-item" onClick={() => onRemove(item.id)} aria-label={t.remove}>
        <Trash2 size={17} />
      </button>
    </div>
  );
}
