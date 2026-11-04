import { useState } from "react";
import { Check, CheckCheck, Home, MapPin, Pencil, Phone, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { accountApi } from "../../api/accountClient";
import "./account-addresses.css";

export default function AccountAddresses({ addresses, setAddresses, language, loading, initialLoading, error, notice, runAction }) {
  const vi = language === "vi";
  const text = (vn, en) => vi ? vn : en;
  const [editor, setEditor] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const reload = async () => setAddresses(await accountApi.addresses());
  const sorted = [...addresses].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const openEditor = (address = {}) => { setDeleting(null); setEditor(address); };
  const submit = (event) => {
    event.preventDefault();
    if (loading) return;
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const payload = {
      recipientName: raw.recipientName.trim(), phone: raw.phone.trim(),
      addressLine: raw.addressLine.trim(), city: raw.city.trim(),
      district: raw.district.trim() || null, ward: raw.ward.trim() || null,
      label: raw.label.trim() || null, isDefault: raw.isDefault === "on",
    };
    void runAction(async () => {
      if (editor.id) await accountApi.updateAddress(editor.id, payload);
      else await accountApi.createAddress(payload);
      setEditor(null);
      await reload();
    }, text("Đã lưu địa chỉ giao hàng.", "Delivery address saved."));
  };

  return <section className="address-book">
    <header className="address-book-heading">
      <div><span className="address-book-eyebrow">DELIVERY ADDRESS</span><h2>{text("Sổ địa chỉ của bạn", "Your address book")}<span>{addresses.length}</span></h2><p>{text("Lưu địa chỉ để đặt hàng nhanh hơn trong lần mua tiếp theo.", "Save your delivery details for a faster checkout next time.")}</p></div>
      <button type="button" className="address-book-primary" disabled={loading || initialLoading || !!editor} onClick={() => openEditor()}><Plus size={17}/>{text("Thêm địa chỉ", "Add address")}</button>
    </header>
    {notice && <div className="address-book-notice" role="status"><CheckCheck size={17}/>{notice}</div>}

    {editor && <form key={editor.id || "new"} className="address-book-editor" onSubmit={submit} aria-label={text("Thông tin địa chỉ giao hàng", "Delivery address details")}>
      <header><span className="address-book-editor-icon"><MapPin size={20}/></span><div><h3>{editor.id ? text("Chỉnh sửa địa chỉ", "Edit address") : text("Thêm địa chỉ mới", "New delivery address")}</h3><p>{text("Thông tin chính xác giúp đơn hàng đến đúng nơi.", "Accurate details help us deliver to the right place.")}</p></div><button type="button" className="address-book-icon-button" disabled={loading} onClick={() => setEditor(null)} aria-label={text("Đóng form địa chỉ", "Close address form")}><X size={18}/></button></header>
      <fieldset disabled={loading}>
        <div className="address-book-fields">
          <label>{text("Họ tên người nhận", "Recipient name")} <span>*</span><input name="recipientName" required maxLength={200} autoComplete="shipping name" defaultValue={editor.recipientName || ""} placeholder={text("Nhập họ và tên", "Full name")}/></label>
          <label>{text("Số điện thoại", "Phone number")} <span>*</span><input type="tel" name="phone" required minLength={7} maxLength={30} pattern="\+?[0-9 \(\)\-]{7,30}" autoComplete="shipping tel" defaultValue={editor.phone || ""} placeholder={text("Số điện thoại nhận hàng", "Delivery phone number")}/></label>
          <label className="address-book-field-wide">{text("Địa chỉ chi tiết", "Street address")} <span>*</span><input name="addressLine" required minLength={3} maxLength={1000} autoComplete="shipping address-line1" defaultValue={editor.addressLine || ""} placeholder={text("Số nhà, tên đường, tòa nhà…", "House number, street, building…")}/></label>
          <label>{text("Tỉnh / Thành phố", "City / Province")} <span>*</span><input name="city" required maxLength={120} autoComplete="shipping address-level1" defaultValue={editor.city || ""} placeholder={text("Ví dụ: Hồ Chí Minh", "City or province")}/></label>
          <label>{text("Quận / Huyện", "District")}<input name="district" maxLength={120} autoComplete="shipping address-level2" defaultValue={editor.district || ""} placeholder={text("Nhập quận / huyện", "District")}/></label>
          <label>{text("Phường / Xã", "Ward")}<input name="ward" maxLength={120} autoComplete="shipping address-level3" defaultValue={editor.ward || ""} placeholder={text("Nhập phường / xã", "Ward")}/></label>
          <label>{text("Tên gợi nhớ", "Address label")}<input name="label" maxLength={60} defaultValue={editor.label || ""} placeholder={text("Nhà riêng, Công ty…", "Home, Office…")}/></label>
        </div>
        <label className="address-book-default-field"><input type="checkbox" name="isDefault" defaultChecked={!!editor.isDefault || !addresses.length}/><span><strong>{text("Đặt làm địa chỉ mặc định", "Use as default address")}</strong><small>{text("Tự động được chọn khi bạn thanh toán.", "Automatically selected at checkout.")}</small></span></label>
        <footer><span>{text("* Thông tin bắt buộc", "* Required fields")}</span><button type="button" className="address-book-secondary" onClick={() => setEditor(null)}>{text("Hủy", "Cancel")}</button><button type="submit" className="address-book-primary"><Check size={16}/>{loading ? text("Đang lưu…", "Saving…") : text("Lưu địa chỉ", "Save address")}</button></footer>
      </fieldset>
    </form>}

    {initialLoading ? <div className="address-book-grid" role="status" aria-label={text("Đang tải địa chỉ", "Loading addresses")}>{[0, 1].map((key) => <div key={key} className="address-book-skeleton"/>)}</div> : sorted.length ? <div className="address-book-grid">{sorted.map((address) => <article className={`address-book-card ${address.isDefault ? "is-default" : ""}`} key={address.id}>
      <div className="address-book-card-top"><span className="address-book-location-icon">{/nhà|home/i.test(address.label || "") ? <Home size={19}/> : <MapPin size={19}/>}</span><span className="address-book-label">{address.label || text("Địa chỉ giao hàng", "Delivery address")}</span>{address.isDefault && <span className="address-book-badge"><Check size={12}/>{text("Mặc định", "Default")}</span>}</div>
      <h3>{address.recipientName}</h3><div className="address-book-phone"><Phone size={13}/>{address.phone}</div>
      <p className="address-book-street">{address.addressLine}</p><p className="address-book-region">{[address.ward, address.district, address.city].filter(Boolean).join(", ")}</p>
      <footer><button type="button" disabled={loading} onClick={() => openEditor(address)}><Pencil size={13}/>{text("Chỉnh sửa", "Edit")}</button>{!address.isDefault && <button type="button" disabled={loading} onClick={() => void runAction(async () => { await accountApi.setDefaultAddress(address.id); await reload(); }, text("Đã cập nhật địa chỉ mặc định.", "Default address updated."))}>{text("Đặt mặc định", "Set default")}</button>}<button type="button" className="address-book-delete" disabled={loading} onClick={() => setDeleting(address.id)} aria-label={`${text("Xóa địa chỉ của", "Delete address for")} ${address.recipientName}`}><Trash2 size={14}/></button></footer>
      {deleting === address.id && <div className="address-book-confirm" role="group" aria-label={text("Xác nhận xóa địa chỉ", "Confirm address deletion")}><p>{text("Bạn muốn xóa địa chỉ này?", "Delete this address?")}</p><div><button type="button" disabled={loading} onClick={() => setDeleting(null)}>{text("Giữ lại", "Keep address")}</button><button type="button" disabled={loading} onClick={() => void runAction(async () => { await accountApi.deleteAddress(address.id); setDeleting(null); if (editor?.id === address.id) setEditor(null); await reload(); }, text("Đã xóa địa chỉ.", "Address deleted."))}>{loading ? text("Đang xóa…", "Deleting…") : text("Xóa địa chỉ", "Delete address")}</button></div></div>}
    </article>)}</div> : error ? <div className="address-book-empty"><MapPin size={30}/><h3>{text("Chưa tải được sổ địa chỉ", "Address book is unavailable")}</h3><button type="button" className="address-book-secondary" disabled={loading} onClick={() => void runAction(reload, "")}>{text("Thử lại", "Try again")}</button></div> : !editor && <div className="address-book-empty"><span><MapPin size={32}/></span><h3>{text("Đơn hàng tiếp theo sẽ giao đến đâu?", "Where should your next order go?")}</h3><p>{text("Thêm địa chỉ đầu tiên để mỗi lần đặt hàng đều thuận tiện hơn.", "Add your first address to make your next checkout easier.")}</p><button type="button" className="address-book-primary" disabled={loading} onClick={() => openEditor()}><Plus size={16}/>{text("Thêm địa chỉ đầu tiên", "Add your first address")}</button></div>}
    <div className="address-book-privacy"><ShieldCheck size={16}/><span>{text("Địa chỉ chỉ được sử dụng để giao hàng và hỗ trợ đơn hàng của bạn.", "Your address is used for delivery and order support.")}</span></div>
  </section>;
}
