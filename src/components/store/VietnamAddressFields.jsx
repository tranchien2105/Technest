import { useEffect, useState } from "react";
import { changeVietnamAddress, findVietnamArea, initialVietnamAddress, loadVietnamAreas } from "../../domain/vietnamAddress";
import { tx } from "../../utils/translate";

export default function VietnamAddressFields({ address, language }) {
  const lang = language === "vi";
  const [selection, setSelection] = useState(() => initialVietnamAddress(address));
  const [snapshot, setSnapshot] = useState(null);
  const [retry, setRetry] = useState(0);
  const mode = selection.mode;
  useEffect(() => {
    let active = true;
    loadVietnamAreas(mode).then((areas) => {
      if (active) setSnapshot({ mode, areas });
    }).catch(() => {
      if (active) setSnapshot({ mode, areas: [], error: true });
    });
    return () => { active = false; };
  }, [mode, retry]);

  const loading = snapshot?.mode !== mode;
  const failed = !loading && snapshot.error;
  const provinces = loading ? [] : snapshot.areas;
  const province = findVietnamArea(provinces, selection.city);
  const districts = province?.districts || [];
  const district = findVietnamArea(districts, selection.district);
  const wards = mode === "legacy" ? district?.wards || [] : province?.wards || [];
  const ward = findVietnamArea(wards, selection.ward);
  const noWards = mode === "legacy" && district && !wards.length;
  const change = (field, value) => setSelection((current) => changeVietnamAddress(current, field, value));
  const savedOption = (value, match) => !loading && !failed && value && !match
    ? <option value={value}>{value} {tx("(saved address)", "(địa chỉ đã lưu)", lang)}</option>
    : null;

  return <>
    <label className="checkout-field checkout-field-full">
      {tx("Address format", "Loại địa chỉ", lang)}
      <select value={mode} aria-describedby="checkout-address-help" onChange={(event) => change("mode", event.target.value)}>
        <option value="current">{tx("Current address (34 provinces / cities)", "Địa chỉ hiện hành (34 tỉnh / thành phố)", lang)}</option>
        <option value="legacy">{tx("Old address (with district)", "Địa chỉ cũ (có quận / huyện)", lang)}</option>
      </select>
    </label>
    <p id="checkout-address-help" className="checkout-address-help checkout-field-full">
      {mode === "current"
        ? tx("Choose your province / city, then your ward, commune or special administrative region.", "Chọn tỉnh / thành phố và phường / xã / đặc khu theo địa chỉ hiện hành.", lang)
        : tx("Use the province, district and ward names before July 2025.", "Chọn tên tỉnh / thành phố, quận / huyện và phường / xã trước tháng 7/2025.", lang)}
    </p>
    {failed && <p className="catalog-feedback checkout-field-full" role="alert">
      {tx("Could not load the address list.", "Chưa tải được danh sách địa chỉ.", lang)}{" "}
      <button type="button" onClick={() => setRetry((value) => value + 1)}>{tx("Try again", "Thử lại", lang)}</button>
    </p>}
    <label className="checkout-field">
      {tx("Province / city", "Tỉnh / thành phố", lang)}
      <select name="city" value={loading || failed ? "" : province?.name || selection.city} required aria-busy={loading} onChange={(event) => change("city", event.target.value)}>
        <option value="">{loading ? tx("Loading addresses…", "Đang tải địa chỉ…", lang) : tx("Select province / city", "Chọn tỉnh / thành phố", lang)}</option>
        {savedOption(selection.city, province)}
        {provinces.map((area) => <option key={area.code} value={area.name}>{area.fullName}</option>)}
      </select>
    </label>
    {mode === "legacy" && <label className="checkout-field">
      {tx("District (old address)", "Quận / huyện (địa chỉ cũ)", lang)}
      <select name="district" value={loading ? "" : district?.name || selection.district} required disabled={loading || failed || !selection.city} onChange={(event) => change("district", event.target.value)}>
        <option value="">{tx("Select district", "Chọn quận / huyện", lang)}</option>
        {savedOption(selection.district, district)}
        {districts.map((area) => <option key={area.code} value={area.name}>{area.name}</option>)}
      </select>
    </label>}
    <label className={`checkout-field${mode === "legacy" ? " checkout-field-full" : ""}`}>
      {tx("Ward / commune / special region", "Phường / xã / đặc khu", lang)}
      <select name="ward" value={loading ? "" : ward?.name || selection.ward} required={!noWards} disabled={loading || failed || !selection.city || (mode === "legacy" && !selection.district) || noWards} onChange={(event) => change("ward", event.target.value)}>
        <option value="">{noWards ? tx("No subordinate wards / communes", "Không có phường / xã trực thuộc", lang) : tx("Select ward / commune", "Chọn phường / xã / đặc khu", lang)}</option>
        {savedOption(selection.ward, ward)}
        {wards.map((area) => <option key={area.code} value={area.name}>{area.name}</option>)}
      </select>
    </label>
  </>;
}
