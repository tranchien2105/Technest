import { useRef, useState } from "react";
import { cartTotal } from "../domain/cart";
import { checkoutItems, consumeOrderItems } from "../domain/checkout";
import { ordersApi } from "../api/ordersClient";

export function useCheckout({ route, cart, setCart, setOrders, navigate }) {
  const checkoutCart = checkoutItems(cart, route);
  const pending = useRef(false);
  const retry = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  return {
    applyVoucher: async (form, code) => {
      const customer=Object.fromEntries(new FormData(form));setError("");
      try { const quote=await ordersApi.preview({items:checkoutCart.map(i=>({variantId:String(i.variantId),quantity:i.quantity})),shippingAddress:{fullName:customer.name||"Khách hàng",phone:customer.phone||"0900000000",address:customer.address||"Đang cập nhật",city:customer.city||"Hồ Chí Minh"},...(code.trim()?{voucherCode:code.trim().toUpperCase()}: {})});setPreview({...quote,voucherCode:code.trim().toUpperCase()});return true;} catch(e){setError(e.message);setPreview(null);return false;}
    },
    checkoutCart, checkoutSubtotal: preview?.subtotal ?? cartTotal(checkoutCart), submitting, error, preview,
    submitOrder: async (form) => {
      if (pending.current || !checkoutCart.length) return;
      pending.current = true; setSubmitting(true); setError("");
      try {
        const customer = Object.fromEntries(new FormData(form));
        const body = {
          items: checkoutCart.map((item) => ({ variantId: String(item.variantId), quantity: item.quantity })),
          shippingAddress: { fullName: customer.name, phone: customer.phone, address: customer.address, city: customer.city, district: customer.district, ward: customer.ward },
          paymentMethod: "COD",
          ...(customer.voucherCode?.trim()?{voucherCode:customer.voucherCode.trim().toUpperCase()}:{}),
        };
        const fingerprint = JSON.stringify(body);
        // Keep the key across network errors and reloads until a successful response.
        const stored = sessionStorage.getItem("technest-checkout-retry");
        try { retry.current = stored ? JSON.parse(stored) : retry.current; } catch { /* discard invalid retry metadata */ }
        if (retry.current?.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() };
        sessionStorage.setItem("technest-checkout-retry", JSON.stringify(retry.current));
        const quoted = retry.current.attempted ? null : await ordersApi.preview(body);
        if (quoted) setPreview(quoted);
        if (quoted?.warnings.length) throw new Error("Một sản phẩm không đủ tồn kho. Vui lòng cập nhật giỏ hàng.");
        retry.current.attempted = true;
        sessionStorage.setItem("technest-checkout-retry", JSON.stringify(retry.current));
        const order = await ordersApi.create(body, retry.current.key);
        sessionStorage.removeItem("technest-checkout-retry"); retry.current = null;
        setOrders((current) => [order, ...current.filter((item) => item.id !== order.id)]);
        setCart((current) => consumeOrderItems(current, checkoutCart));
        navigate(`/order-success/${order.id}`);
      } catch (failure) { setError(failure.message); }
      finally { pending.current = false; setSubmitting(false); }
    },
  };
}
