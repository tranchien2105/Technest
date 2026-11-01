import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Monitor,
  Pencil,
  Plus,
  Save,
  Smartphone,
  X,
} from "lucide-react";
import HomePage from "../../pages/HomePage";
import AdminOperationsPanel from "../AdminOperationsPanel";
import { opsRequest } from "../operationsApi";
import ProductImage from "../../components/common/ProductImage";

const PLACEMENTS = [
  {
    key: "HOME_HERO",
    name: "Hero Slider chính",
    description: "Slider lớn phía trái đầu trang.",
    capacity: 100,
    ratio: "16:9",
    responsive: "Giữ làm slider trên mobile",
  },
  {
    key: "HOME_HERO_RIGHT_TOP",
    name: "Hero bên phải · Trên",
    description: "Thẻ banner nhỏ phía trên bên phải Hero.",
    capacity: 100,
    ratio: "4:3",
    responsive: "Ẩn trên mobile theo bố cục Homepage hiện tại",
  },
  {
    key: "HOME_HERO_RIGHT_BOTTOM",
    name: "Hero bên phải · Dưới",
    description: "Thẻ banner nhỏ phía dưới bên phải Hero.",
    capacity: 100,
    ratio: "4:3",
    responsive: "Ẩn trên mobile theo bố cục Homepage hiện tại",
  },
  {
    key: "HOME_PROMO",
    name: "Ưu đãi giữa trang",
    description: "Các banner chương trình sau nhóm sản phẩm đầu trang.",
    capacity: 100,
    ratio: "2:1",
    responsive: "Tự xếp theo breakpoint Homepage",
  },
  {
    key: "HOME_BOTTOM",
    name: "Banner cuối trang",
    description: "Banner ở gần cuối nội dung Homepage.",
    capacity: 100,
    ratio: "2:1",
    responsive: "Tự xếp theo breakpoint Homepage",
  },
  {
    key: "HOME_SETUP_STUDIO",
    name: "Setup Studio · Banner dọc",
    description: "Banner dọc bên trái khu vực chọn sản phẩm theo danh mục.",
    capacity: 100,
    ratio: "3:4",
    responsive: "Giữ tỷ lệ dọc và xếp trước danh sách sản phẩm trên mobile",
  },
];
const nameFor = (key) => PLACEMENTS.find((item) => item.key === key)?.name || key;
const getScheduleState = (banner) => {
  if (!banner?.active) return "Đang tắt";
  const now = Date.now();
  if (banner.startsAt && new Date(banner.startsAt).getTime() > now) return "Chưa đến lịch";
  if (banner.endsAt && new Date(banner.endsAt).getTime() <= now) return "Đã hết hạn";
  return "Đang hiển thị";
};
const emptyDraft = () => Object.fromEntries(PLACEMENTS.map(({ key }) => [key, []]));

export default function AdminBannerManagement({ canWrite, previewProps }) {
  const [tab, setTab] = useState("visual");
  const [device, setDevice] = useState("desktop");
  const [banners, setBanners] = useState([]);
  const [pickerItems, setPickerItems] = useState([]);
  const [pickerTotalPages, setPickerTotalPages] = useState(1);
  const [published, setPublished] = useState(emptyDraft);
  const [draft, setDraft] = useState(emptyDraft);
  const [selected, setSelected] = useState("HOME_HERO");
  const [selectedBannerId, setSelectedBannerId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerStatus, setPickerStatus] = useState("");
  const [pickerPlacement, setPickerPlacement] = useState("");
  const [pickerPage, setPickerPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [refresh, setRefresh] = useState(0);
  const previewRef = useRef(null);
  const currentTarget = useRef(null);

  const load = useCallback(async (signal) => {
    try {
      const result = await opsRequest("banners/placements", { signal });
      const currentPlacements = result?.placements || emptyDraft();
      const rows = Object.values(currentPlacements).flat();
      const assignments = emptyDraft();
      rows
        .filter((row) => assignments[row.position])
        .sort((a, b) => a.sortOrder - b.sortOrder || String(a.id).localeCompare(String(b.id)))
        .forEach((row) => assignments[row.position].push(String(row.id)));
      setBanners(rows);
      setPublished(assignments);
      setDraft(assignments);
      setError("");
    } catch (failure) {
      if (failure.name !== "AbortError")
        setError(failure.message || "Không tải được dữ liệu banner.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => load(controller.signal), 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, refresh]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(published);
  const byId = useMemo(
    () => new Map(banners.map((banner) => [String(banner.id), banner])),
    [banners],
  );
  const pickerPages = pickerTotalPages;
  const selectedItems = (draft[selected] || []).map((id) => byId.get(id)).filter(Boolean);
  const selectedBanner = byId.get(selectedBannerId) || selectedItems[0];

  useEffect(() => {
    const warn = (event) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const locate = async (event) => {
      const { position, id } = event.detail || {};
      setTab("visual");
      setSelected(PLACEMENTS.some((item) => item.key === position) ? position : "HOME_HERO");
      setSelectedBannerId(String(id || ""));
      if (!position) {
        setPickerOpen(true);
        setPickerPlacement("UNASSIGNED");
      }
      if (id) {
        try {
          const banner = await opsRequest(`banners/${id}`);
          setBanners((current) => [
            ...new Map([...current, banner].map((row) => [String(row.id), row])).values(),
          ]);
        } catch (failure) {
          setError(failure.message || "Không tải được banner.");
        }
      }
      currentTarget.current = position;
    };
    window.addEventListener("technest:banner-location", locate);
    return () => window.removeEventListener("technest:banner-location", locate);
  }, []);
  useEffect(() => {
    if (tab !== "visual" || !currentTarget.current) return;
    const element = previewRef.current?.querySelector(
      `[data-banner-placement="${currentTarget.current}"]`,
    );
    element?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    currentTarget.current = null;
  }, [tab, refresh]);
  useEffect(() => {
    if (!pickerOpen) return undefined;
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(pickerPage), limit: "12" });
    if (pickerSearch.trim()) query.set("q", pickerSearch.trim());
    if (pickerStatus) query.set("status", pickerStatus);
    if (pickerPlacement) query.set("type", pickerPlacement);
    opsRequest(`banners?${query}`, { signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        setPickerItems(result?.items || []);
        setPickerTotalPages(result?.pagination?.totalPages || 1);
        setBanners((current) => {
          const merged = new Map(current.map((banner) => [String(banner.id), banner]));
          (result?.items || []).forEach((banner) => merged.set(String(banner.id), banner));
          return [...merged.values()];
        });
      })
      .catch((failure) => {
        if (failure.name !== "AbortError") setError(failure.message);
      });
    return () => controller.abort();
  }, [pickerOpen, pickerPage, pickerSearch, pickerStatus, pickerPlacement, refresh]);
  useEffect(() => {
    const refreshBanners = () => setRefresh((value) => value + 1);
    window.addEventListener("technest:banners-changed", refreshBanners);
    return () => window.removeEventListener("technest:banners-changed", refreshBanners);
  }, []);

  const selectPlacement = (key) => {
    setSelected(key);
    setSelectedBannerId("");
  };
  const addBanner = (banner) => {
    const id = String(banner.id);
    setDraft((current) => {
      const next = Object.fromEntries(
        Object.entries(current).map(([key, ids]) => [key, ids.filter((value) => value !== id)]),
      );
      const ids = next[selected] || [];
      if (ids.length >= PLACEMENTS.find((item) => item.key === selected).capacity) {
        if (selected !== "HOME_HERO") next[selected] = [id];
        else return current;
      } else next[selected] = [...ids, id];
      return next;
    });
    setSelectedBannerId(id);
    setPickerOpen(false);
  };
  const removeBanner = (id) => {
    setDraft((current) => ({
      ...current,
      [selected]: current[selected].filter((value) => value !== id),
    }));
    if (selectedBannerId === id) setSelectedBannerId("");
  };
  const moveBanner = (index, direction) => {
    setDraft((current) => {
      const ids = [...current[selected]];
      const target = index + direction;
      if (target < 0 || target >= ids.length) return current;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      return { ...current, [selected]: ids };
    });
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await opsRequest("banners/placements", { method: "PUT", body: { placements: draft } });
      await load();
      setToast(
        "Đã lưu sơ đồ banner. Homepage sẽ tải cấu hình mới ở lần truy cập/refetch tiếp theo.",
      );
    } catch (failure) {
      setError(failure.message || "Không lưu được sơ đồ banner.");
    } finally {
      setSaving(false);
    }
  };
  const cancel = () => {
    setDraft(published);
    setSelectedBannerId("");
  };
  const beginCreate = () => {
    if (dirty && !window.confirm("Bỏ các thay đổi sơ đồ chưa lưu để thêm banner?")) return;
    setDraft(published);
    setTab("list");
    window.setTimeout(() => window.dispatchEvent(new Event("technest:banner-create")), 50);
  };
  const editBanner = (banner) => {
    if (dirty && !window.confirm("Bỏ thay đổi sơ đồ chưa lưu để sửa nội dung banner?")) return;
    if (dirty) setDraft(published);
    setSelectedBannerId(String(banner.id));
    setTab("list");
    window.setTimeout(
      () => window.dispatchEvent(new CustomEvent("technest:banner-edit", { detail: banner })),
      50,
    );
  };
  const renderProps = {
    ...previewProps,
    showHome: true,
    bannerPreview: Object.fromEntries(
      PLACEMENTS.map(({ key }) => [
        key,
        (draft[key] || [])
          .map((id) => byId.get(id))
          .filter((banner) => banner && banner.active && (!banner.startsAt || new Date(banner.startsAt).getTime() <= Date.now()) && (!banner.endsAt || new Date(banner.endsAt).getTime() > Date.now()))
          .slice(0, 10),
      ]),
    ),
    previewStatuses: Object.fromEntries(
      PLACEMENTS.map(({ key }) => [
        key,
        (draft[key] || []).map((id) => getScheduleState(byId.get(id))),
      ]),
    ),
    onSelectPlacement: selectPlacement,
    selectedPlacement: selected,
    navigate: () => {},
    selectCategory: () => {},
    setDrawer: () => {},
    setSearch: () => {},
    setSearchOpen: () => {},
    setMobileMenu: () => {},
    setLanguage: () => {},
    notify: () => {},
    addToCart: () => {},
    toggleFavorite: () => {},
    toggleCompare: () => {},
    onViewProduct: () => {},
  };

  return (
    <section className="admin-panel admin-banner-management">
      <header className="admin-panel-heading admin-banner-heading">
        <div>
          <h2>
            <ImagePlus size={20} /> Banner quảng cáo
          </h2>
          <p>Chọn trực tiếp vị trí trên Homepage Technest để sắp xếp và xem trước banner.</p>
        </div>
        {canWrite && (
          <button className="admin-primary-button" onClick={beginCreate}>
            <Plus size={16} /> Thêm banner
          </button>
        )}
      </header>
      <div className="admin-banner-tabs" role="tablist" aria-label="Chế độ quản lý banner">
        <button
          role="tab"
          aria-selected={tab === "visual"}
          className={tab === "visual" ? "is-active" : ""}
          onClick={() => {
            if (dirty && !window.confirm("Hủy các thay đổi chưa lưu?")) return;
            setDraft(published);
            setTab("visual");
            setRefresh((value) => value + 1);
          }}
        >
          Sơ đồ website {dirty && <span className="admin-banner-unsaved">Chưa lưu</span>}
        </button>
        <button
          role="tab"
          aria-selected={tab === "list"}
          className={tab === "list" ? "is-active" : ""}
          onClick={() => {
            if (dirty && !window.confirm("Hủy các thay đổi chưa lưu?")) return;
            setDraft(published);
            setTab("list");
          }}
        >
          Danh sách banner
        </button>
        {tab === "visual" && (
          <div className="admin-banner-device">
            <button
              className={device === "desktop" ? "is-active" : ""}
              onClick={() => setDevice("desktop")}
              aria-label="Xem desktop"
            >
              <Monitor size={17} />
            </button>
            <button
              className={device === "mobile" ? "is-active" : ""}
              onClick={() => setDevice("mobile")}
              aria-label="Xem mobile"
            >
              <Smartphone size={17} />
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {toast && (
        <p className="admin-success" role="status">
          {toast}
          <button onClick={() => setToast("")}>Đóng</button>
        </p>
      )}
      {tab === "list" ? (
        <AdminOperationsPanel kind="banners" canWrite={canWrite} />
      ) : (
        <>
          <div className="admin-banner-workspace">
            <div
              className={`admin-banner-preview-scroll ${device === "mobile" ? "is-mobile" : ""}`}
              ref={previewRef}
            >
              {loading ? (
                <div className="admin-state">Đang tải sơ đồ banner…</div>
              ) : error ? (
                <div className="admin-state admin-error">{error}</div>
              ) : (
                <div
                  className={`banner-store-preview ${device === "mobile" ? "preview-mobile" : "preview-desktop"}`}
                  style={{ "--banner-preview-width": device === "mobile" ? "390px" : "1280px" }}
                >
                  <main className="technest banner-preview-home">
                    <HomePage
                      {...renderProps}
                      bannerPreview={renderProps.bannerPreview}
                      onSelectPlacement={selectPlacement}
                    />
                  </main>
                </div>
              )}
            </div>
            <aside className="admin-banner-editor">
              <div className="admin-banner-editor-heading">
                <span className="admin-eyebrow">VỊ TRÍ HOMEPAGE</span>
                <h3>{nameFor(selected)}</h3>
                <p>{PLACEMENTS.find((item) => item.key === selected)?.description}</p>
              </div>
              <div className="admin-banner-placement-select">
                {PLACEMENTS.map(({ key, name }) => (
                  <button
                    key={key}
                    className={selected === key ? "is-active" : ""}
                    onClick={() => selectPlacement(key)}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="admin-banner-slot-meta">
                <span>
                  Sức chứa{" "}
                  <strong>
                    {draft[selected]?.length || 0}/
                    {PLACEMENTS.find((item) => item.key === selected)?.capacity}
                  </strong>
                </span>
                <span>
                  Tỷ lệ khuyến nghị{" "}
                  <strong>{PLACEMENTS.find((item) => item.key === selected)?.ratio}</strong>
                </span>
                <small>{PLACEMENTS.find((item) => item.key === selected)?.responsive}</small>
              </div>
              <div className="admin-banner-assigned-list">
                {!selectedItems.length && (
                  <div className="admin-empty">Chưa gán banner cho vị trí này.</div>
                )}
                {selectedItems.map((banner, index) => (
                  <article
                    className={`admin-banner-assigned ${selectedBanner?.id === banner.id ? "is-selected" : ""}`}
                    key={banner.id}
                    onClick={() => setSelectedBannerId(String(banner.id))}
                  >
                    <ProductImage src={banner.imageUrl} alt={banner.title} />
                    <div>
                      <strong>{banner.title}</strong>
                      <small>
                        {getScheduleState(banner)} · Thứ tự {index + 1}
                      </small>
                    </div>
                    {selected === "HOME_HERO" && (
                      <div className="admin-banner-reorder">
                        <button
                          disabled={!index}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveBanner(index, -1);
                          }}
                          aria-label="Di chuyển lên"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          disabled={index === selectedItems.length - 1}
                          onClick={(event) => {
                            event.stopPropagation();
                            moveBanner(index, 1);
                          }}
                          aria-label="Di chuyển xuống"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                    <button
                      className="admin-icon-button"
                      title="Sửa nội dung banner"
                      aria-label={`Sửa ${banner.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        editBanner(banner);
                      }}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="admin-icon-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeBanner(String(banner.id));
                      }}
                      aria-label="Bỏ gán banner"
                    >
                      <X size={16} />
                    </button>
                  </article>
                ))}
              </div>
              {selectedBanner && (
                <div className="admin-banner-detail">
                  <ProductImage src={selectedBanner.imageUrl} alt={selectedBanner.title} />
                  <div>
                    <strong>{selectedBanner.title}</strong>
                    <p>{selectedBanner.subtitle || "Không có mô tả"}</p>
                    <small>
                      {selectedBanner.buttonText} · {selectedBanner.link}
                    </small>
                    <small>
                      {getScheduleState(selectedBanner)} ·{" "}
                      {selectedBanner.startsAt
                        ? new Date(selectedBanner.startsAt).toLocaleString("vi-VN")
                        : "Không giới hạn ngày bắt đầu"}{" "}
                      →{" "}
                      {selectedBanner.endsAt
                        ? new Date(selectedBanner.endsAt).toLocaleString("vi-VN")
                        : "Không giới hạn ngày kết thúc"}
                    </small>
                    <button onClick={() => editBanner(selectedBanner)}>Sửa nội dung banner</button>
                  </div>
                </div>
              )}
              {canWrite && (
                <div className="admin-banner-editor-actions">
                  <button
                    className="admin-secondary-button"
                    onClick={() => setPickerOpen((value) => !value)}
                  >
                    <Plus size={15} /> Chọn banner
                  </button>
                  <div>
                    <button
                      className="admin-secondary-button"
                      disabled={!dirty || saving}
                      onClick={cancel}
                    >
                      <X size={15} /> Hủy
                    </button>
                    <button
                      className="admin-primary-button"
                      disabled={!dirty || saving}
                      onClick={save}
                    >
                      <Save size={15} />
                      {saving ? "Đang lưu…" : "Lưu thay đổi"}
                    </button>
                  </div>
                </div>
              )}
              {pickerOpen && (
                <div className="admin-banner-picker">
                  <header>
                    <strong>Chọn banner</strong>
                    <button
                      className="admin-icon-button"
                      onClick={() => setPickerOpen(false)}
                      aria-label="Đóng"
                    >
                      <X size={17} />
                    </button>
                  </header>
                  <input
                    value={pickerSearch}
                    onChange={(event) => setPickerSearch(event.target.value)}
                    placeholder="Tìm theo tiêu đề…"
                    aria-label="Tìm banner"
                  />
                  <div className="admin-banner-picker-filters">
                    <select
                      value={pickerStatus}
                      onChange={(event) => setPickerStatus(event.target.value)}
                    >
                      <option value="">Mọi trạng thái</option>
                      <option value="ACTIVE">Đang bật</option>
                      <option value="INACTIVE">Đang tắt</option>
                    </select>
                    <select
                      value={pickerPlacement}
                      onChange={(event) => setPickerPlacement(event.target.value)}
                    >
                      <option value="">Mọi vị trí</option>
                      <option value="UNASSIGNED">Chưa sử dụng</option>
                      {PLACEMENTS.map(({ key, name }) => (
                        <option key={key} value={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-banner-picker-list">
                    {pickerItems.map((banner) => {
                      const assignedHere = draft[selected]?.includes(String(banner.id));
                      const capacity = PLACEMENTS.find((item) => item.key === selected).capacity;
                      const full =
                        capacity > 1 && !assignedHere && (draft[selected]?.length || 0) >= capacity;
                      return (
                        <button
                          key={banner.id}
                          disabled={!canWrite || full}
                          className={assignedHere ? "is-selected" : ""}
                          onClick={() => addBanner(banner)}
                        >
                          <ProductImage src={banner.imageUrl} alt={banner.title} />
                          <span>
                            <strong>{banner.title}</strong>
                            <small>
                              {banner.position ? nameFor(banner.position) : "Chưa sử dụng"} ·{" "}
                              {getScheduleState(banner)}
                            </small>
                            <small>
                              {banner.startsAt
                                ? new Date(banner.startsAt).toLocaleDateString("vi-VN")
                                : "Ngay"}{" "}
                              –{" "}
                              {banner.endsAt
                                ? new Date(banner.endsAt).toLocaleDateString("vi-VN")
                                : "Không thời hạn"}
                            </small>
                          </span>
                          {assignedHere ? <Check size={17} /> : <ChevronDown size={17} />}
                        </button>
                      );
                    })}
                    {!pickerItems.length && (
                      <div className="admin-empty">Không tìm thấy banner phù hợp.</div>
                    )}
                  </div>
                  <footer>
                    <span>
                      {pickerItems.length} banner · Trang {pickerPage}/{pickerPages}
                    </span>
                    <div>
                      <button
                        disabled={pickerPage <= 1}
                        onClick={() => setPickerPage((page) => page - 1)}
                        aria-label="Trang trước"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span>
                        {pickerPage}/{pickerPages}
                      </span>
                      <button
                        disabled={pickerPage >= pickerPages}
                        onClick={() => setPickerPage((page) => page + 1)}
                        aria-label="Trang sau"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </footer>
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
