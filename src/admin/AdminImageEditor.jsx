import { useState } from "react";
import { uploadImages } from "./operationsApi";
import { ArrowUp, ArrowDown, ImagePlus, Trash2 } from "lucide-react";
import ProductImage from "../components/common/ProductImage";
import { useDebouncedValue } from "./useAdminList";

function ImagePreview({ url, alt }) {
  const source = useDebouncedValue(url.trim());
  return <ProductImage key={source} src={source} alt={alt}/>;
}

export default function AdminImageEditor({ images, onChange }) {
  const [uploading,setUploading]=useState(false),[uploadError,setUploadError]=useState("");
  const upload=async(files)=>{if(uploading)return;setUploadError("");if(files.length>10||images.length+files.length>20){setUploadError("Tối đa 10 ảnh/lượt và 20 ảnh/sản phẩm.");return;}setUploading(true);try{const saved=await uploadImages(files);onChange([...images,...saved.map(img=>({...img,editorId:crypto.randomUUID()}))]);}catch(e){setUploadError(e.message);}finally{setUploading(false);}};
  const update = (index, changes) => onChange(images.map((image, i) => i === index ? { ...image, ...changes } : image));
  const move = (index, direction) => {
    const next = [...images];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  };
  return <section className="admin-image-editor" aria-label="Ảnh sản phẩm">
    <div className="admin-attributes-heading"><div><h3>Ảnh sản phẩm</h3><p>Ảnh đầu tiên là ảnh đại diện. Dùng nút mũi tên để đổi thứ tự.</p></div><button type="button" className="admin-add-attribute" disabled={images.length >= 20} onClick={() => onChange([...images, { editorId: crypto.randomUUID(), url: "", altText: "" }])}><ImagePlus size={16}/> Thêm ảnh</button></div>
    <label className="admin-upload-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void upload([...e.dataTransfer.files]);}}><ImagePlus size={24}/><strong>{uploading?"Đang tối ưu và tải ảnh…":"Kéo thả ảnh vào đây hoặc chọn từ máy"}</strong><span>JPEG, PNG, WebP, AVIF · tối đa 8 MB/ảnh · 10 ảnh/lượt</span><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" disabled={uploading} onChange={e=>{void upload([...e.target.files]);e.target.value="";}}/></label>{uploadError&&<p className="admin-error" role="alert">{uploadError}</p>}
    {!images.length && <p className="admin-attribute-empty">Chưa có ảnh. Thêm đường dẫn ảnh để xem trước.</p>}
    <div className="admin-image-editor-list">{images.map((image, index) => <div className="admin-image-editor-row" key={image.editorId}>
      <div className="admin-image-editor-preview"><ImagePreview url={image.url} alt={image.altText || `Ảnh ${index + 1}`}/>{index === 0 && <span>Ảnh đại diện</span>}</div>
      <div className="admin-image-editor-fields"><label>Đường dẫn ảnh {index + 1}<input required inputMode="url" placeholder="https://… hoặc /images/…" value={image.url} onChange={(event) => update(index, { url: event.target.value })}/></label><label>Mô tả ảnh<input maxLength="220" placeholder="Ví dụ: Mặt trước sản phẩm" value={image.altText} onChange={(event) => update(index, { altText: event.target.value })}/></label></div>
      <div className="admin-image-editor-actions"><button type="button" className="admin-icon-button" disabled={index === 0} aria-label={`Đưa ảnh ${index + 1} lên trước`} onClick={() => move(index, -1)}><ArrowUp size={16}/></button><button type="button" className="admin-icon-button" disabled={index === images.length - 1} aria-label={`Đưa ảnh ${index + 1} xuống sau`} onClick={() => move(index, 1)}><ArrowDown size={16}/></button><button type="button" className="admin-icon-button admin-attribute-remove" aria-label={`Xóa ảnh ${index + 1}`} onClick={() => onChange(images.filter((_, i) => i !== index))}><Trash2 size={16}/></button></div>
    </div>)}</div>
  </section>;
}
