import { opsRequest } from "./operationsApi";
import AdminBulkActions from "./AdminBulkActions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Archive, Trash2, X, Save } from "lucide-react";
import AdminAttributesEditor from "./AdminAttributesEditor";
import AdminImageEditor from "./AdminImageEditor";
import { attributesToFields, fieldsToAttributes } from "./catalogEditor";
import ProductImage from "../components/common/ProductImage";
import AdminPagination, { AdminPageSize } from "./AdminPagination";
import AdminStatusBadge from "./AdminStatusBadge";
import { useAdminPageSize, useDebouncedValue } from "./useAdminList";
import { formatPrice } from "../utils/formatCurrency";
import { adminApi } from "../api/adminClient";

const emptyVariant = () => ({ sku: "", name: "Mặc định", price: "", compareAtPrice: "", status: "ACTIVE", initialStock: 0, editorId: crypto.randomUUID(), attributes: {}, attributeFields: attributesToFields({ color: "", warranty: "" }) });
const newProduct = () => ({ slug: "", name: "", description: "", categoryId: "", brandId: "", price: "", compareAtPrice: "", status: "ACTIVE", badge: "", isFeatured: false, isTrending: false, attributes: {}, attributeFields: attributesToFields({ specifications: {}, warranty: "" }), images: [], variants: [emptyVariant()] });
const emptyCategory = () => ({ name: "", nameEn: "", slug: "", parentCategoryId: "" });
const emptyBrand = () => ({ name: "", slug: "" });

export default function AdminCatalogPanel({ kind, canWrite = true }) {
  const [selected,setSelected]=useState([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useAdminPageSize(kind);
  const [filters, setFilters] = useState({ categoryId: "", brandId: "", stock: "", minPrice: "", maxPrice: "", sort: "newest", usage: "", level: "" });
  const debouncedQuery = useDebouncedValue(query.trim());
  const debouncedMin = useDebouncedValue(filters.minPrice);
  const debouncedMax = useDebouncedValue(filters.maxPrice);
  const updateFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const clearFilters = () => { setQuery(""); setStatus(""); setFilters({ categoryId: "", brandId: "", stock: "", minPrice: "", maxPrice: "", sort: "newest", usage: "", level: "" }); setPage(1); };
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [references, setReferences] = useState({ categories: [], brands: [] });
  const queryString = useMemo(() => {
    const values = { page, limit, q: debouncedQuery, ...(kind === "products"
      ? { status, categoryId: filters.categoryId, brandId: filters.brandId, stock: filters.stock, minPrice: debouncedMin, maxPrice: debouncedMax, sort: filters.sort }
      : { usage: filters.usage, ...(kind === "categories" ? { level: filters.level } : {}) }) };
    return new URLSearchParams(Object.entries(values).filter(([, value]) => value !== "")).toString();
  }, [page, limit, debouncedQuery, status, kind, filters, debouncedMin, debouncedMax]);

  const load = useCallback(async (signal) => {
    setLoading(true); setError("");
    try {
      const result = await (kind === "products" ? adminApi.products(queryString, { signal }) : kind === "categories" ? adminApi.categories(queryString, { signal }) : adminApi.brands(queryString, { signal }));
      if (!signal.aborted) {
        setData(result);setSelected([]);
        if (page > Math.max(1, result.pagination.totalPages)) setPage(Math.max(1, result.pagination.totalPages));
      }
    } catch (failure) { if (!signal.aborted) setError(failure.message); }
    finally { if (!signal.aborted) setLoading(false); }
  }, [kind, queryString, page]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, revision]);
  useEffect(() => {
    const controller = new AbortController();
    const all = async (fetcher) => {
      const first = await fetcher("page=1&limit=500", { signal: controller.signal });
      const items = [...first.items];
      for (let page = 2; page <= first.pagination.totalPages; page++) items.push(...(await fetcher(`page=${page}&limit=500`, { signal: controller.signal })).items);
      return items;
    };
    (kind === "products" ? opsRequest("products/references", {signal:controller.signal}) : Promise.all([all(adminApi.categories), all(adminApi.brands)]).then(([categories,brands])=>({categories,brands})))
      .then((data) => { if (!controller.signal.aborted) setReferences(data); })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [kind]);

  const editRow = async (row) => {
    setError("");
    try {
      if (kind === "products") {
        const product = await adminApi.product(row.id);
        setEditor({ id: product.id, draft: { ...product, compareAtPrice: product.compareAtPrice || "", badge: product.badge || "", attributeFields: attributesToFields(product.attributes || {}), images: product.images.map((image) => ({ ...image, editorId: crypto.randomUUID(), altText: image.altText || "" })), variants: product.variants.map((variant) => ({ ...variant, price: variant.price || "", compareAtPrice: variant.compareAtPrice || "", initialStock: 0, editorId: crypto.randomUUID(), attributeFields: attributesToFields(variant.attributes || {}) })) } });
      } else if (kind === "categories") setEditor({ id: row.id, draft: { ...row, parentCategoryId: row.parentCategoryId || "" } });
      else setEditor({ id: row.id, draft: { name: row.name, slug: row.slug } });
    } catch (failure) { setError(failure.message); }
  };

  const startCreate = () => setEditor({ id: null, draft: kind === "products" ? newProduct() : kind === "categories" ? emptyCategory() : emptyBrand() });
  const save = async (event) => {
    event.preventDefault(); if (!editor) return;
    setSaving(true); setError("");
    try {
      const draft = editor.draft;
      if (kind === "products") {
        const body = { slug: draft.slug, name: draft.name, description: draft.description, categoryId: draft.categoryId, brandId: draft.brandId, price: draft.price,
          compareAtPrice: draft.compareAtPrice || null, status: draft.status, badge: draft.badge || null, isFeatured: draft.isFeatured, isTrending: draft.isTrending,
          attributes: fieldsToAttributes(draft.attributeFields, draft.attributes), compatibleWith: draft.compatibleWith || [],
          images: draft.images.map((image) => ({ url: image.url.trim(), altText: image.altText.trim() || draft.name })),
          variants: draft.variants.map((variant) => ({ id: variant.id, sku: variant.sku, name: variant.name, price: variant.price || undefined, compareAtPrice: variant.compareAtPrice || null,
            status: variant.status || "ACTIVE", initialStock: Number(variant.initialStock || 0), attributes: fieldsToAttributes(variant.attributeFields, variant.attributes) })) };
        await adminApi.saveProduct(body, editor.id);
      } else if (kind === "categories") await adminApi.saveCategory({ ...draft, parentCategoryId: draft.parentCategoryId || null }, editor.id);
      else await adminApi.saveBrand(draft, editor.id);
      setEditor(null); setMessage("Đã lưu thay đổi."); setRevision((value) => value + 1);
    } catch (failure) { setError(failure.message); }
    finally { setSaving(false); }
  };

  const remove = async (row) => {
    const product = kind === "products";
    const label = product ? "ẩn sản phẩm này" : "xóa mục này";
    if (!window.confirm(`Bạn muốn ${label}?`)) return;
    setError("");
    try {
      if (kind === "products") await adminApi.archiveProduct(row.id);
      else if (kind === "categories") await adminApi.deleteCategory(row.id);
      else await adminApi.deleteBrand(row.id);
      setMessage(product ? "Đã lưu trữ sản phẩm." : "Đã xóa mục."); setRevision((value) => value + 1);
    } catch (failure) { setError(failure.message); }
  };

  const updateDraft = (key, value) => setEditor((current) => ({ ...current, draft: { ...current.draft, [key]: value } }));
  const updateVariant = (index, changes) => setEditor((current) => ({ ...current, draft: { ...current.draft,
    variants: current.draft.variants.map((variant, i) => i === index ? { ...variant, ...changes } : variant) } }));
  const title = kind === "products" ? "Sản phẩm" : kind === "categories" ? "Danh mục" : "Thương hiệu";
  const rows = data?.items || [];

  const hasFilters = Boolean(query || status || Object.entries(filters).some(([key, value]) => value && !(key === "sort" && value === "newest")));
  return <section className="admin-panel admin-table-panel" aria-busy={loading}>
    <div className="admin-panel-heading"><div><h2>Danh sách {title.toLowerCase()}</h2><p>{kind === "products" ? "Theo dõi giá bán, phiên bản và lượng hàng có thể bán." : "Sắp xếp danh mục và thương hiệu trong cửa hàng."}</p></div><div className="admin-heading-actions"><span className="admin-count">{(data?.pagination?.total ?? 0).toLocaleString("vi-VN")} mục</span><AdminPageSize limit={limit} onChange={(size) => { setLimit(size); setPage(1); }}/><button disabled={!canWrite} className="admin-primary-button" onClick={startCreate}><Plus size={17}/> Thêm {title.toLowerCase()}</button></div></div>
    <div className="admin-filter-bar">
      <label className="admin-filter-field admin-filter-search"><span>Tìm kiếm</span><span className="admin-search"><Search size={18}/><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={kind === "products" ? "Tên sản phẩm, SKU hoặc thương hiệu…" : `Tên hoặc slug ${title.toLowerCase()}…`} aria-label={`Tìm ${title.toLowerCase()}`}/></span></label>
      {kind === "products" ? <>
        <label className="admin-filter-field"><span>Trạng thái</span><select aria-label="Trạng thái sản phẩm" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option><option value="ACTIVE">Đang bán</option><option value="INACTIVE">Tạm ẩn</option><option value="ARCHIVED">Đã lưu trữ</option></select></label>
        <label className="admin-filter-field"><span>Danh mục</span><select aria-label="Danh mục" value={filters.categoryId} onChange={(event) => updateFilter("categoryId", event.target.value)}><option value="">Tất cả danh mục</option>{references.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label className="admin-filter-field"><span>Thương hiệu</span><select aria-label="Thương hiệu" value={filters.brandId} onChange={(event) => updateFilter("brandId", event.target.value)}><option value="">Tất cả thương hiệu</option>{references.brands.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label className="admin-filter-field"><span>Tồn kho</span><select aria-label="Tồn kho" value={filters.stock} onChange={(event) => updateFilter("stock", event.target.value)}><option value="">Tất cả tồn kho</option><option value="in">Còn hàng</option><option value="low">Sắp hết (1–5)</option><option value="out">Hết hàng</option></select></label>
        <label className="admin-filter-field"><span>Giá từ (₫)</span><input type="number" min="0" step="1000" placeholder="0" value={filters.minPrice} onChange={(event) => updateFilter("minPrice", event.target.value)}/></label>
        <label className="admin-filter-field"><span>Giá đến (₫)</span><input type="number" min="0" step="1000" placeholder="Không giới hạn" value={filters.maxPrice} onChange={(event) => updateFilter("maxPrice", event.target.value)}/></label>
        <label className="admin-filter-field"><span>Sắp xếp</span><select aria-label="Sắp xếp" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}><option value="newest">Mới nhất</option><option value="oldest">Cũ nhất</option><option value="name">Tên A–Z</option><option value="priceAsc">Giá tăng dần</option><option value="priceDesc">Giá giảm dần</option></select></label>
      </> : <>
        <label className="admin-filter-field"><span>Sản phẩm liên kết</span><select aria-label="Sản phẩm liên kết" value={filters.usage} onChange={(event) => updateFilter("usage", event.target.value)}><option value="">Tất cả</option><option value="used">Đã có sản phẩm</option><option value="unused">Chưa có sản phẩm</option></select></label>
        {kind === "categories" && <label className="admin-filter-field"><span>Cấp danh mục</span><select aria-label="Cấp danh mục" value={filters.level} onChange={(event) => updateFilter("level", event.target.value)}><option value="">Tất cả cấp</option><option value="root">Danh mục gốc</option><option value="child">Danh mục con</option></select></label>}
      </>}
      {hasFilters && <button className="admin-reset-filters" onClick={clearFilters}><X size={15}/> Xóa bộ lọc</button>}
    </div>
    {kind === "products" && canWrite && <AdminBulkActions ids={selected} references={references} onClear={()=>setSelected([])} onComplete={()=>{setSelected([]);setMessage("Đã cập nhật sản phẩm đã chọn.");setRevision(v=>v+1);}}/>}
    {error && <p className="admin-error" role="alert">{error}</p>}{message && <p className="admin-success" role="status">{message}<button onClick={() => setMessage("")}>Đóng</button></p>}
    {loading && <div className="admin-loading-line" role="status">Đang tải dữ liệu…</div>}
    {!rows.length && !loading ? <div className="admin-empty">Không tìm thấy {title.toLowerCase()} phù hợp. Hãy thử đổi bộ lọc.</div> : <div className="admin-table-wrap"><table className={`admin-table admin-${kind}-table`}><thead><tr>{kind === "products" && canWrite && <th className="admin-select-cell"><input type="checkbox" aria-label="Chọn tất cả sản phẩm trong trang" checked={rows.length>0&&selected.length===rows.length} onChange={e=>setSelected(e.target.checked?rows.map(r=>r.id):[])}/></th>}{kind === "products" ? <><th scope="col">Sản phẩm</th><th scope="col">Danh mục / Thương hiệu</th><th scope="col">Phiên bản</th><th scope="col">Giá bán</th><th scope="col">Có thể bán</th><th scope="col">Trạng thái</th></> : kind === "categories" ? <><th scope="col">Tên danh mục</th><th scope="col">Slug</th><th scope="col">Danh mục cha</th><th scope="col">Sản phẩm</th></> : <><th scope="col">Thương hiệu</th><th scope="col">Slug</th><th scope="col">Sản phẩm</th><th scope="col">Ngày tạo</th></>}<th scope="col" className="admin-actions-heading">Thao tác</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{kind === "products" && canWrite && <td className="admin-select-cell"><input type="checkbox" aria-label={`Chọn ${row.name}`} checked={selected.includes(row.id)} onChange={e=>setSelected(e.target.checked?[...selected,row.id]:selected.filter(id=>id!==row.id))}/></td>}
      {kind === "products" ? <><td><div className="admin-product-info"><ProductImage key={row.image} src={row.image} alt={row.name} loading="lazy"/><span><strong>{row.name}</strong><small>#{row.id} · {row.slug}</small></span></div></td><td><span>{row.category}</span><small>{row.brand}</small></td><td>{row.skuCount} SKU</td><td className="admin-price-cell">{formatPrice(row.price)}</td><td><span className={`admin-stock ${row.available <= 5 ? "is-low" : ""}`}>{row.available.toLocaleString("vi-VN")}</span></td><td><AdminStatusBadge status={row.status} label={row.status === "ACTIVE" ? "Đang bán" : undefined}/></td></> : kind === "categories" ? <><td><strong>{row.name}</strong><small>{row.nameEn}</small></td><td className="admin-slug-cell">{row.slug}</td><td>{row.parentName || "Danh mục gốc"}</td><td>{row.productCount}</td></> : <><td><strong>{row.name}</strong></td><td className="admin-slug-cell">{row.slug}</td><td>{row.productCount}</td><td>{new Date(row.createdAt).toLocaleDateString("vi-VN")}</td></>}
      <td><div className="admin-row-actions"><button disabled={!canWrite} onClick={() => void editRow(row)} aria-label={`Sửa ${row.name || row.slug}`}><Pencil size={15}/> Sửa</button><button disabled={!canWrite} onClick={() => void remove(row)} aria-label={`${kind === "products" ? "Lưu trữ" : "Xóa"} ${row.name || row.slug}`}>{kind === "products" ? <Archive size={15}/> : <Trash2 size={15}/>} {kind === "products" ? "Lưu trữ" : "Xóa"}</button></div></td>
    </tr>)}</tbody></table></div>}
    <AdminPagination showPageSize={false} pagination={data?.pagination} limit={limit} onLimitChange={(size) => { setLimit(size); setPage(1); }} onPageChange={setPage} loading={loading}/>
    {editor && <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}><form className={`admin-editor-modal ${kind === "products" ? "admin-product-editor-modal" : ""}`} onSubmit={save} aria-label={`Biểu mẫu ${title}`}>
      <header><div><small>{editor.id ? "CHỈNH SỬA" : "TẠO MỚI"}</small><h2>{editor.id ? "Cập nhật" : "Thêm"} {title.toLowerCase()}</h2></div><button type="button" className="admin-icon-button" onClick={() => setEditor(null)} aria-label="Đóng"><X size={18}/></button></header>
      <div className="admin-editor-fields">
        {kind === "products" ? <>
          <label>Tên sản phẩm<input required minLength="2" maxLength="220" value={editor.draft.name} onChange={(event) => updateDraft("name", event.target.value)}/></label>
          <label>Slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={editor.draft.slug} onChange={(event) => updateDraft("slug", event.target.value)}/></label>
          <label>Danh mục<select required value={editor.draft.categoryId} onChange={(event) => updateDraft("categoryId", event.target.value)}><option value="">Chọn danh mục</option>{references.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label>Thương hiệu<select required value={editor.draft.brandId} onChange={(event) => updateDraft("brandId", event.target.value)}><option value="">Chọn thương hiệu</option>{references.brands.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label>Giá bán (VND)<input required inputMode="numeric" pattern="[0-9]+" value={editor.draft.price} onChange={(event) => updateDraft("price", event.target.value)}/></label>
          <label>Giá gốc (VND)<input inputMode="numeric" pattern="[0-9]*" value={editor.draft.compareAtPrice || ""} onChange={(event) => updateDraft("compareAtPrice", event.target.value)}/></label>
          <label>Trạng thái<select value={editor.draft.status} onChange={(event) => updateDraft("status", event.target.value)}><option value="ACTIVE">Đang bán</option><option value="INACTIVE">Tạm ẩn</option><option value="ARCHIVED">Đã lưu trữ</option></select></label>
          <label>Nhãn sản phẩm<input maxLength="24" value={editor.draft.badge || ""} onChange={(event) => updateDraft("badge", event.target.value)}/></label>
          <label className="admin-editor-wide">Mô tả<textarea rows="3" value={editor.draft.description} onChange={(event) => updateDraft("description", event.target.value)}/></label>
          <div className="admin-editor-wide"><AdminImageEditor images={editor.draft.images} onChange={(images) => updateDraft("images", images)}/></div>
          <div className="admin-editor-wide"><AdminAttributesEditor fields={editor.draft.attributeFields} onChange={(fields) => updateDraft("attributeFields", fields)}/></div>
          <div className="admin-editor-wide admin-variant-editor"><div className="admin-variant-heading"><div><strong>Phiên bản / SKU</strong><p>Mỗi phiên bản có mã hàng, giá và thông số riêng.</p></div><button type="button" onClick={() => updateDraft("variants", [...editor.draft.variants, emptyVariant()])}><Plus size={15}/> Thêm phiên bản</button></div>
            {editor.draft.variants.map((variant, index) => <section className="admin-variant-card" key={variant.editorId} aria-label={`Phiên bản ${index + 1}`}>
              <div className="admin-variant-card-heading"><strong>Phiên bản {index + 1}{variant.name ? ` · ${variant.name}` : ""}</strong><button type="button" className="admin-icon-button admin-attribute-remove" disabled={editor.draft.variants.length <= 1} onClick={() => updateDraft("variants", editor.draft.variants.filter((_, i) => i !== index))} aria-label={`Xóa phiên bản ${index + 1}`}><Trash2 size={16}/></button></div>
              <div className="admin-variant-fields">
                <label>Mã SKU<input required value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })}/></label>
                <label>Tên phiên bản<input required value={variant.name} onChange={(event) => updateVariant(index, { name: event.target.value })}/></label>
                <label>Giá bán riêng (₫)<input inputMode="numeric" pattern="[0-9]*" placeholder="Dùng giá sản phẩm nếu bỏ trống" value={variant.price || ""} onChange={(event) => updateVariant(index, { price: event.target.value })}/></label>
                <label>Giá gốc (₫)<input inputMode="numeric" pattern="[0-9]*" value={variant.compareAtPrice || ""} onChange={(event) => updateVariant(index, { compareAtPrice: event.target.value })}/></label>
                {!variant.id ? <label>Tồn kho ban đầu<input type="number" min="0" value={variant.initialStock || 0} onChange={(event) => updateVariant(index, { initialStock: event.target.value })}/></label> : <label>Trạng thái<select aria-label={`Trạng thái phiên bản ${index + 1}`} value={variant.status} onChange={(event) => updateVariant(index, { status: event.target.value })}><option value="ACTIVE">Đang bán</option><option value="INACTIVE">Tạm ẩn</option><option value="ARCHIVED">Đã lưu trữ</option></select></label>}
              </div>
              <AdminAttributesEditor title="Thông số phiên bản" fields={variant.attributeFields} onChange={(fields) => updateVariant(index, { attributeFields: fields })}/>
            </section>)}
          </div>
          <label><input type="checkbox" checked={editor.draft.isFeatured} onChange={(event) => updateDraft("isFeatured", event.target.checked)}/> Nổi bật</label>
          <label><input type="checkbox" checked={editor.draft.isTrending} onChange={(event) => updateDraft("isTrending", event.target.checked)}/> Thịnh hành</label>
        </> : kind === "categories" ? <>
          <label>Tên danh mục<input required value={editor.draft.name} onChange={(event) => updateDraft("name", event.target.value)}/></label>
          <label>Tên tiếng Anh<input value={editor.draft.nameEn} onChange={(event) => updateDraft("nameEn", event.target.value)}/></label>
          <label>Slug<input required value={editor.draft.slug} onChange={(event) => updateDraft("slug", event.target.value)}/></label>
          <label>Danh mục cha<select value={editor.draft.parentCategoryId} onChange={(event) => updateDraft("parentCategoryId", event.target.value)}><option value="">Danh mục gốc</option>{references.categories.filter((item) => item.id !== editor.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        </> : <><label>Tên thương hiệu<input required value={editor.draft.name} onChange={(event) => updateDraft("name", event.target.value)}/></label><label>Slug<input required value={editor.draft.slug} onChange={(event) => updateDraft("slug", event.target.value)}/></label></>}
      </div>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <footer><button type="button" onClick={() => setEditor(null)}>Hủy</button><button className="admin-primary-button" disabled={saving}><Save size={16}/>{saving ? "Đang lưu…" : "Lưu thay đổi"}</button></footer>
    </form></div>}
  </section>;
}
