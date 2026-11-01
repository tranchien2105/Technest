import { Plus, Trash2 } from "lucide-react";
import { attributeLabel, newAttributeField } from "./catalogEditor";

function AttributeRows({ fields, onChange, array = false }) {
  const update = (id, changes) => onChange(fields.map((field) => field.id === id ? { ...field, ...changes } : field));
  return <div className="admin-attribute-rows">
    {fields.map((field, index) => {
      const label = array ? `Giá trị ${index + 1}` : attributeLabel(field.key) || `Thông số ${index + 1}`;
      const group = field.kind === "object" || field.kind === "array";
      const name = array || field.fixedKey
        ? <span className="admin-attribute-name">{label}</span>
        : <label className="admin-attribute-name-input"><span>Tên thông số</span><input required aria-label={`Tên thông số ${index + 1}`} placeholder="Ví dụ: Kết nối" value={field.key} onChange={(event) => update(field.id, { key: event.target.value })}/></label>;
      const remove = <button type="button" className="admin-icon-button admin-attribute-remove" aria-label={`Xóa ${label}`} onClick={() => onChange(fields.filter((item) => item.id !== field.id))}><Trash2 size={16}/></button>;
      if (group) return <div className="admin-attribute-group" key={field.id}>
        <div className="admin-attribute-group-heading">{name}{remove}</div>
        <AttributeRows fields={field.children} array={field.kind === "array"} onChange={(children) => update(field.id, { children })}/>
        <button type="button" className="admin-add-attribute" onClick={() => update(field.id, { children: [...field.children, newAttributeField()] })}><Plus size={15}/>{field.kind === "array" ? "Thêm giá trị" : "Thêm thông số"}</button>
      </div>;
      return <div className="admin-attribute-row" key={field.id}>
        {name}
        <label className="admin-attribute-value"><span>Giá trị</span>{field.kind === "boolean"
          ? <select aria-label={`Giá trị ${label}`} value={String(field.value)} onChange={(event) => update(field.id, { value: event.target.value === "true" })}><option value="true">Có</option><option value="false">Không</option></select>
          : field.multiline ? <textarea rows="2" aria-label={`Giá trị ${label}`} value={field.value ?? ""} onChange={(event) => update(field.id, { value: event.target.value, kind: "string" })}/>
            : <input aria-label={`Giá trị ${label}`} type={field.kind === "number" ? "number" : "text"} step={field.kind === "number" ? "any" : undefined} placeholder="Nhập giá trị" value={field.value ?? ""} onChange={(event) => update(field.id, { value: event.target.value, kind: field.kind === "null" ? "string" : field.kind })}/>}
        </label>
        {remove}
      </div>;
    })}
  </div>;
}

export default function AdminAttributesEditor({ fields, onChange, title = "Thông số sản phẩm" }) {
  return <section className="admin-attributes-editor" aria-label={title}>
    <div className="admin-attributes-heading"><div><h3>{title}</h3><p>Điền tên và giá trị của từng thông số.</p></div><button type="button" className="admin-add-attribute" onClick={() => onChange([...fields, newAttributeField()])}><Plus size={15}/> Thêm thông số</button></div>
    {!fields.length && <p className="admin-attribute-empty">Chưa có thông số. Thêm thông tin như màu sắc, kết nối hoặc bảo hành.</p>}
    <AttributeRows fields={fields} onChange={onChange}/>
  </section>;
}
