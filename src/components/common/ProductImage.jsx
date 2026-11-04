import { responsiveImage } from "../../utils/responsiveImage";
import { apiAssetUrl } from "../../api/apiClient";

const FALLBACK_IMAGE = "/images/technest-product-placeholder.svg";

export default function ProductImage({ src, alt = "", sizes, ...props }) {
  return (
    <img
      key={src || FALLBACK_IMAGE}
      src={apiAssetUrl(src) || FALLBACK_IMAGE}
      alt={alt}
      decoding="async"
      {...responsiveImage(src, sizes)}
      onError={(event) => {
        if (event.currentTarget.dataset.fallbackApplied) return;
        event.currentTarget.dataset.fallbackApplied = "true";
        event.currentTarget.removeAttribute("srcset");
        event.currentTarget.removeAttribute("sizes");
        event.currentTarget.src = FALLBACK_IMAGE;
      }}
      {...props}
    />
  );
}
