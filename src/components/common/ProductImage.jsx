const FALLBACK_IMAGE = "/images/technest-product-placeholder.svg";

export default function ProductImage({ src, alt = "", ...props }) {
  return (
    <img
      src={src || FALLBACK_IMAGE}
      alt={alt}
      onError={(event) => {
        if (event.currentTarget.dataset.fallbackApplied) return;
        event.currentTarget.dataset.fallbackApplied = "true";
        event.currentTarget.src = FALLBACK_IMAGE;
      }}
      {...props}
    />
  );
}
