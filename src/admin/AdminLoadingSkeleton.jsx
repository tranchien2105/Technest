export default function AdminLoadingSkeleton({ variant = "panel", label = "Đang tải dữ liệu…" }) {
  return (
    <div className={`admin-loading-skeleton is-${variant}`} role="status" aria-label={label}>
      {variant === "dashboard" && <div className="admin-skeleton-metrics">{Array.from({ length: 4 }, (_, index) => <span key={index} />)}</div>}
      {variant === "form" && <div className="admin-skeleton-form-head"><span /><span /></div>}
      <div className="admin-skeleton-panel">
        <i />
        <i />
        <i />
        <i />
        {variant !== "form" && <i />}
      </div>
    </div>
  );
}
