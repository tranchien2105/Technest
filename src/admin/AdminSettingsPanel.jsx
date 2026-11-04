import AdminSeoEditor from "./AdminSeoEditor";
import { useEffect, useState } from "react";
import { Save, Store, Truck, CreditCard } from "lucide-react";
import { adminApi } from "../api/adminClient";
import CurrencyInput from "../components/common/CurrencyInput";
import AdminLoadingSkeleton from "./AdminLoadingSkeleton";

const defaults = { storeName: "", supportEmail: "", supportPhone: "", standardShippingFee: "30000", freeShippingThreshold: "1000000", codEnabled: true };
export default function AdminSettingsPanel({ canWrite = true }) {
  const [settings, setSettings] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    adminApi.settings().then((data) => { if (active) setSettings(data); })
      .catch((failure) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const change = (event) => { const { name, value, checked, type } = event.target; setSettings((current) => ({ ...current, [name]: type === "checkbox" ? checked : value })); setSaved(false); };
  const changeCurrency = (name, value) => { setSettings((current) => ({ ...current, [name]: value })); setSaved(false); };
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(""); setSaved(false);
    try { setSettings(await adminApi.updateSettings({ storeName: settings.storeName, supportEmail: settings.supportEmail, supportPhone: settings.supportPhone,
      standardShippingFee: String(settings.standardShippingFee), freeShippingThreshold: String(settings.freeShippingThreshold), codEnabled: settings.codEnabled })); setSaved(true); }
    catch (failure) { setError(failure.message); }
    finally { setSaving(false); }
  };
  if (loading) return <AdminLoadingSkeleton variant="form" label="Đang tải cài đặt…" />;
  return <form className="admin-settings-form" onSubmit={submit}>
    <section className="admin-panel"><div className="admin-panel-heading"><div><span className="admin-settings-icon"><Store size={18}/></span><h2>Thông tin cửa hàng</h2><p>Thông tin liên hệ quản trị hiển thị cho nhân viên vận hành.</p></div></div><div className="admin-settings-fields"><label>Tên cửa hàng<input required maxLength="120" name="storeName" value={settings.storeName} onChange={change}/></label><label>Email hỗ trợ<input required type="email" name="supportEmail" value={settings.supportEmail} onChange={change}/></label><label>Số điện thoại hỗ trợ<input name="supportPhone" maxLength="30" value={settings.supportPhone} onChange={change}/></label></div></section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><span className="admin-settings-icon"><Truck size={18}/></span><h2>Giao hàng</h2><p>Phí và ngưỡng miễn phí được dùng trực tiếp khi tính xem trước checkout và tạo đơn.</p></div></div><div className="admin-settings-fields"><label>Phí giao hàng tiêu chuẩn (VND)<CurrencyInput required value={settings.standardShippingFee} onValueChange={(value) => changeCurrency("standardShippingFee", value)}/></label><label>Miễn phí giao hàng từ (VND)<CurrencyInput required value={settings.freeShippingThreshold} onValueChange={(value) => changeCurrency("freeShippingThreshold", value)}/></label></div></section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><span className="admin-settings-icon"><CreditCard size={18}/></span><h2>Thanh toán</h2><p>Phương thức COD hiện được hỗ trợ xuyên suốt hệ thống đơn hàng.</p></div></div><label className="admin-setting-toggle"><input type="checkbox" name="codEnabled" checked={settings.codEnabled} onChange={change}/><span><strong>Cho phép thanh toán khi nhận hàng (COD)</strong><small>Tắt lựa chọn này sẽ chặn xem trước checkout và tạo đơn COD mới.</small></span></label></section>
    <section className="admin-panel"><h2>SEO nội dung công khai</h2>{["home","products","flash-sale"].map(id=><div key={id}><h3>{id === "home" ? "Trang chủ" : id === "products" ? "Danh sách sản phẩm" : "Flash Sale"}</h3><AdminSeoEditor kind="pages" id={id} disabled={!canWrite || saving}/></div>)}</section>
    {error && <p className="admin-error" role="alert">{error}</p>}{saved && <p className="admin-success" role="status">Đã lưu cài đặt và cập nhật chính sách tính phí giao hàng.</p>}
    <button className="admin-primary-button" disabled={saving || !canWrite}><Save size={16}/>{saving ? "Đang lưu…" : "Lưu cài đặt"}</button>
  </form>;
}
