import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import ProductImage from "../common/ProductImage";
import { formatPrice } from "../../utils/formatCurrency";
import { tx } from "../../utils/translate";
import { shippingFee } from "../../domain/checkout";
import { addMoney, multiplyMoney } from "../../domain/cart";
import { accountApi } from "../../api/accountClient";
const VN_AREAS = {
  "Hồ Chí Minh": {
    "Quận 1": ["Bến Nghé", "Bến Thành", "Đa Kao"],
    "Quận 3": ["Phường 1", "Phường 2", "Phường 3"],
    "Bình Thạnh": ["Phường 1", "Phường 2", "Phường 25"],
    "TP. Thủ Đức": ["Thảo Điền", "An Phú", "Hiệp Bình Chánh"],
  },
  "Hà Nội": {
    "Ba Đình": ["Phúc Xá", "Trúc Bạch", "Vĩnh Phúc"],
    "Hoàn Kiếm": ["Hàng Bạc", "Hàng Bông", "Tràng Tiền"],
    "Cầu Giấy": ["Dịch Vọng", "Mai Dịch", "Nghĩa Tân"],
    "Đống Đa": ["Cát Linh", "Láng Hạ", "Ô Chợ Dừa"],
  },
  "Đà Nẵng": {
    "Hải Châu": ["Hải Châu I", "Hải Châu II", "Thạch Thang"],
    "Thanh Khê": ["An Khê", "Chính Gián", "Vĩnh Trung"],
    "Sơn Trà": ["An Hải Bắc", "An Hải Đông", "Mân Thái"],
  },
  "Cần Thơ": {
    "Ninh Kiều": ["An Hòa", "An Khánh", "Tân An"],
    "Bình Thủy": ["An Thới", "Bình Thủy", "Long Hòa"],
    "Cái Răng": ["Ba Láng", "Hưng Phú", "Lê Bình"],
  },
  "Hải Phòng": {
    "Hồng Bàng": ["Hoàng Văn Thụ", "Minh Khai", "Phan Bội Châu"],
    "Lê Chân": ["An Biên", "Cát Dài", "Trại Cau"],
    "Ngô Quyền": ["Cầu Đất", "Đằng Giang", "Lạch Tray"],
  },
};

export default function CheckoutForm({ cart, subtotal, submitOrder, language, authenticated = false, submitting = false, error = "", preview, applyVoucher }) {
  const [voucher,setVoucher]=useState(""),[voucherBusy,setVoucherBusy]=useState(false);
  const lang = language === "vi";
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState("");
  const [profile, setProfile] = useState(null);
  const [addressLoadError, setAddressLoadError] = useState("");
  const formRef = useRef(null);
  const districts = province ? Object.keys(VN_AREAS[province]) : [];
  const wards = district ? VN_AREAS[province]?.[district] || [] : [];
  const shipping = preview?.shippingFee ?? shippingFee(subtotal);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    Promise.all([accountApi.addresses(), accountApi.profile()]).then(([addresses, user]) => {
      if (!active) return;
      setSavedAddresses(Array.isArray(addresses) ? addresses : []);
      setProfile(user);
      const preferred = addresses?.find((address) => address.isDefault);
      if (preferred) setSelectedAddress(preferred.id);
    }).catch((error) => { if (active) setAddressLoadError(error.message); });
    return () => { active = false; };
  }, [authenticated]);

  useEffect(() => {
    const address = savedAddresses.find((item) => item.id === selectedAddress);
    const form = formRef.current;
    if (!address || !form) return;
    for (const [field, value] of Object.entries({ name: address.recipientName, phone: address.phone, address: address.addressLine, city: address.city, district: address.district || "", ward: address.ward || "" })) {
      const control = form.elements.namedItem(field);
      if (!control) continue;
      if (control instanceof HTMLSelectElement && value && !Array.from(control.options).some((option) => option.value === value)) control.add(new Option(value, value));
      control.value = value;
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, [savedAddresses, selectedAddress]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (authenticated && form.elements.namedItem("saveAddress")?.checked && !selectedAddress) {
      const data = Object.fromEntries(new FormData(form));
      try {
        await accountApi.createAddress({ recipientName: data.name, phone: data.phone, addressLine: data.address, city: data.city, district: data.district || null, ward: data.ward || null, isDefault: savedAddresses.length === 0 });
      } catch (error) {
        event.preventDefault(); setAddressLoadError(error.message); return;
      }
    }
    await submitOrder(form);
  };
  return (
    <form ref={formRef} className="checkout-layout checkout-form-layout" onSubmit={handleSubmit}>
      <div className="checkout-form-column">
        {error && <p role="alert" className="catalog-feedback">{error}</p>}
        <section className="checkout-panel">
          <div className="checkout-section-heading">
            <span>01</span>
            <div>
              <h2>{tx("Contact information", "Thông tin liên hệ", lang)}</h2>
              <p>
                {tx(
                  "Where can we reach you about this order?",
                  "Technest sẽ liên hệ với bạn về đơn hàng này.",
                  lang,
                )}
              </p>
            </div>
          </div>
          <div className="checkout-field-grid">
            {authenticated && <>
              {savedAddresses.length > 0 && <label className="checkout-field checkout-field-full">{tx("Saved delivery address", "Địa chỉ đã lưu", lang)}<select value={selectedAddress} onChange={(event) => setSelectedAddress(event.target.value)}><option value="">{tx("Enter a different address", "Nhập địa chỉ khác", lang)}</option>{savedAddresses.map((address) => <option value={address.id} key={address.id}>{address.label || address.recipientName} — {address.addressLine}, {address.city}</option>)}</select></label>}
              {addressLoadError && <p className="catalog-feedback" role="status">{addressLoadError}</p>}
            </>}
            <label className="checkout-field checkout-field-full">
              {tx("Full name", "Họ và tên", lang)}
              <input
                name="name"
                required
                defaultValue={profile?.fullName || ""}
                autoComplete="name"
                placeholder={tx("Enter your full name", "Nhập họ và tên", lang)}
              />
            </label>
            <label className="checkout-field">
              {tx("Email", "Email", lang)}
              <input
                type="email"
                name="email"
                required
                defaultValue={profile?.email || ""}
                autoComplete="email"
                placeholder="name@example.com"
              />
            </label>
            <label className="checkout-field">
              {tx("Phone number", "Số điện thoại", lang)}
              <input
                type="tel"
                name="phone"
                required
                defaultValue={profile?.phone || ""}
                autoComplete="tel"
                placeholder="09xx xxx xxx"
              />
            </label>
          </div>
        </section>
        <section className="checkout-panel">
          <div className="checkout-section-heading">
            <span>02</span>
            <div>
              <h2>{tx("Delivery address", "Địa chỉ giao hàng", lang)}</h2>
              <p>
                {tx(
                  "Choose your province, district and ward.",
                  "Chọn tỉnh/thành, quận/huyện và phường/xã.",
                  lang,
                )}
              </p>
            </div>
          </div>
          <div className="checkout-field-grid">
            <label className="checkout-field checkout-field-full">
              {tx("Street address", "Địa chỉ cụ thể", lang)}
              <input
                name="address"
                required
                autoComplete="street-address"
                placeholder={tx(
                  "House number, street, building…",
                  "Số nhà, tên đường, tòa nhà…",
                  lang,
                )}
              />
            </label>
            {authenticated && <label className="checkout-field checkout-field-full"><input type="checkbox" name="saveAddress" /> {tx("Save this address to my account", "Lưu địa chỉ này vào tài khoản", lang)}</label>}
            <label className="checkout-field">
              {tx("Province / city", "Tỉnh / thành phố", lang)}
              <select
                name="city"
                value={province}
                required
                onChange={(event) => {
                  setProvince(event.target.value);
                  setDistrict("");
                }}
              >
                <option value="">
                  {tx("Select province / city", "Chọn tỉnh / thành phố", lang)}
                </option>
                {Object.keys(VN_AREAS).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkout-field">
              {tx("District", "Quận / huyện", lang)}
              <select
                name="district"
                value={district}
                required
                disabled={!province}
                onChange={(event) => setDistrict(event.target.value)}
              >
                <option value="">{tx("Select district", "Chọn quận / huyện", lang)}</option>
                {districts.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkout-field checkout-field-full">
              {tx("Ward", "Phường / xã", lang)}
              <select name="ward" required disabled={!district}>
                <option value="">{tx("Select ward", "Chọn phường / xã", lang)}</option>
                {wards.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
        <section className="checkout-panel">
          <div className="checkout-section-heading">
            <span>03</span>
            <div>
              <h2>{tx("Delivery and payment", "Giao hàng và thanh toán", lang)}</h2>
              <p>
                {tx(
                  "Choose how you would like to receive and pay.",
                  "Chọn cách nhận hàng và thanh toán phù hợp.",
                  lang,
                )}
              </p>
            </div>
          </div>
          <div className="checkout-choice-grid">
            <label className="checkout-choice">
              <input
                type="radio"
                name="delivery"
                value={lang ? "Giao hàng tiêu chuẩn" : "Standard delivery"}
                defaultChecked
              />
              <span>
                <strong>{tx("Standard delivery", "Giao hàng tiêu chuẩn", lang)}</strong>
                <small>{tx("2–4 business days", "Dự kiến 2–4 ngày làm việc", lang)}</small>
              </span>
              <b>{shipping ? formatPrice(shipping) : tx("Free", "Miễn phí", lang)}</b>
            </label>
            <label className="checkout-choice">
              <input
                type="radio"
                name="payment"
                value={lang ? "Thanh toán khi nhận hàng" : "Cash on delivery"}
                defaultChecked
              />
              <span>
                <strong>{tx("Cash on delivery", "Thanh toán khi nhận hàng", lang)}</strong>
                <small>
                  {tx("Pay when your order arrives", "Thanh toán khi nhận được hàng", lang)}
                </small>
              </span>
            </label>

          </div>
        </section>
        <button className="primary-button checkout-submit" type="submit" disabled={submitting}>
          {tx("Place order", "Đặt hàng", lang)} <ArrowRight size={17} />
        </button>
      </div>
      <aside className="checkout-summary-card">
        <div className="checkout-summary-heading">
          <div>
            <span className="section-kicker">TECHNEST</span>
            <h2>{tx("Your order", "Đơn hàng của bạn", lang)}</h2>
          </div>
          <span className="checkout-item-count">
            {cart.reduce((count, item) => count + item.quantity, 0)} {tx("items", "món", lang)}
          </span>
        </div>
        <div className="checkout-summary-items">
          {cart.map((item) => (
            <div className="checkout-summary-item" key={item.id}>
              <ProductImage src={item.image} alt="" />
              <div>
                <strong>{item.name}</strong>
                <span>
                  {item.quantity} × {formatPrice(item.price)}
                </span>
              </div>
              <b>{formatPrice(multiplyMoney(item.price, item.quantity))}</b>
            </div>
          ))}
        </div>
        <div className="checkout-voucher"><label htmlFor="checkout-voucher">Mã giảm giá</label><div><input id="checkout-voucher" name="voucherCode" maxLength="40" value={voucher} onChange={e=>setVoucher(e.target.value.toUpperCase())} placeholder="Nhập mã ưu đãi"/><button type="button" disabled={voucherBusy||submitting} onClick={async()=>{setVoucherBusy(true);try{await applyVoucher(formRef.current,voucher);}finally{setVoucherBusy(false);}}}>{voucherBusy?"Đang kiểm tra…":"Áp dụng"}</button></div>{preview?.voucherCode&&preview.voucherCode===voucher.trim()&&<small>Đã áp dụng {preview.voucherCode}</small>}</div>
        <div className="checkout-summary-totals">
          <p>
            <span>{tx("Subtotal", "Tạm tính", lang)}</span>
            <strong>{formatPrice(subtotal)}</strong>
          </p>
          <p>
            <span>{tx("Shipping", "Phí giao hàng", lang)}</span>
            <strong>{shipping ? formatPrice(shipping) : tx("Free", "Miễn phí", lang)}</strong>
          </p>
          {preview?.voucherCode===voucher.trim()&&Number(preview?.discountAmount)>0&&<p><span>Giảm giá</span><strong>−{formatPrice(preview.discountAmount)}</strong></p>}
          <p className="checkout-grand-total">
            <span>{tx("Total", "Tổng thanh toán", lang)}</span>
            <strong>{formatPrice(preview?.voucherCode===voucher.trim() ? preview.totalAmount : addMoney(subtotal, shipping))}</strong>
          </p>
        </div>
        <p className="checkout-summary-note">
          {tx(
            "Shipping is free on orders over 1,000,000₫.",
            "Miễn phí giao hàng cho đơn từ 1.000.000₫.",
            lang,
          )}
        </p>
      </aside>
    </form>
  );
}
