import { productUrl as getProductUrl } from "../../routing/productUrl";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Heart, MapPin, Menu, Search, ShoppingCart, UserRound, X } from "lucide-react";
import { apiGet, normalizeProduct } from "../../api/apiClient";
import ProductImage from "../common/ProductImage";
import { formatPrice } from "../../utils/formatCurrency";
import LanguageSwitch from "./LanguageSwitch";
import { useNotifications } from "../../hooks/notificationsContext";

const deliveryCities = [
  { id: "hcm", vi: "Hồ Chí Minh", en: "Ho Chi Minh City" },
  { id: "hanoi", vi: "Hà Nội", en: "Hanoi" },
  { id: "danang", vi: "Đà Nẵng", en: "Da Nang" },
  { id: "haiphong", vi: "Hải Phòng", en: "Hai Phong" },
  { id: "cantho", vi: "Cần Thơ", en: "Can Tho" },
  { id: "binhduong", vi: "Bình Dương", en: "Binh Duong" },
];

export default function Header({
  language,
  setLanguage,
  search,
  setSearch,
  searchOpen,
  setSearchOpen,
  favorites,
  cartCount,
  mobileMenu,
  setMobileMenu,
  t,
  navigate,
  authUser,
  onLogout,
  scrolled = false,
}) {
  const [suggestionResult, setSuggestionResult] = useState({
    query: "",
    status: "idle",
    products: [],
  });
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const searchContainerRef = useRef(null);
  const locationRef = useRef(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const { unreadCount } = useNotifications();
  const [deliveryCityId, setDeliveryCityId] = useState(() => {
    try {
      const storedCity = globalThis.localStorage?.getItem("technest-delivery-city");
      return deliveryCities.some((city) => city.id === storedCity) ? storedCity : "hcm";
    } catch {
      return "hcm";
    }
  });
  const deliveryCity =
    deliveryCities.find((city) => city.id === deliveryCityId) || deliveryCities[0];
  const normalizedSearch = search.trim();
  const suggestions = suggestionResult.query === normalizedSearch ? suggestionResult.products : [];
  const suggestionState =
    normalizedSearch.length < 2
      ? "idle"
      : suggestionResult.query === normalizedSearch
        ? suggestionResult.status
        : "loading";

  useEffect(() => {
    if (normalizedSearch.length < 2) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams({ q: normalizedSearch, limit: "5" });
      apiGet(`/products?${query}`, { signal: controller.signal })
        .then((data) => {
          if (controller.signal.aborted) return;
          const products = Array.isArray(data?.items) ? data.items.map(normalizeProduct) : [];
          setSuggestionResult({
            query: normalizedSearch,
            products,
            status: products.length ? "results" : "empty",
          });
        })
        .catch((error) => {
          if (error?.name === "AbortError") return;
          setSuggestionResult({ query: normalizedSearch, products: [], status: "error" });
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedSearch]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (!searchContainerRef.current?.contains(event.target)) setSuggestionsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    const closeLocationMenu = (event) => {
      if (!locationRef.current?.contains(event.target)) setLocationOpen(false);
      if (event.key === "Escape") setLocationOpen(false);
    };
    document.addEventListener("mousedown", closeLocationMenu);
    document.addEventListener("keydown", closeLocationMenu);
    return () => {
      document.removeEventListener("mousedown", closeLocationMenu);
      document.removeEventListener("keydown", closeLocationMenu);
    };
  }, []);

  useEffect(() => {
    const closeAccountMenu = (event) => {
      if (event.key === "Escape" || !accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", closeAccountMenu);
    document.addEventListener("keydown", closeAccountMenu);
    return () => {
      document.removeEventListener("mousedown", closeAccountMenu);
      document.removeEventListener("keydown", closeAccountMenu);
    };
  }, []);

  useEffect(() => {
    try {
      globalThis.localStorage?.setItem("technest-delivery-city", deliveryCityId);
    } catch {
      // Keep the in-memory selection when browser storage is unavailable.
    }
  }, [deliveryCityId]);

  const accountLabel = authUser?.fullName?.trim() || authUser?.email?.split("@")[0] || t.account;
  const submitSearch = (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector("input");
    const value = input?.value.trim();
    if (value) navigate?.(`/search?q=${encodeURIComponent(value)}`);
  };
  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <a className="brand" href="/" aria-label="Technest. Better Tools. Brighter Days. — Home">
        <span className="brand-mark" aria-hidden="true">
          <span>T</span>
          <i>N</i>
        </span>
        <span className="brand-name">
          Technest<span className="brand-dot">.</span>
        </span>
        <span className="brand-tagline">Better Tools. Brighter Days.</span>
      </a>
      <div className="header-search-container" ref={searchContainerRef}>
        <form
          className={`header-search ${searchOpen ? "search-visible" : ""}`}
          onSubmit={submitSearch}
          role="search"
        >
          <Search size={19} />
          <input
            value={search}
            onFocus={() => setSuggestionsOpen(true)}
            onChange={(event) => {
              setSearch(event.target.value);
              setSuggestionsOpen(true);
              setActiveSuggestion(-1);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") { setSuggestionsOpen(false); setActiveSuggestion(-1); }
              if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length) {
                event.preventDefault();
                setSuggestionsOpen(true);
                const direction = event.key === "ArrowDown" ? 1 : -1;
                setActiveSuggestion((current) => current < 0 ? (direction > 0 ? 0 : suggestions.length - 1) : (current + direction + suggestions.length) % suggestions.length);
              }
              if (event.key === "Enter" && suggestionsOpen && suggestions[activeSuggestion]) {
                event.preventDefault();
                navigate?.(getProductUrl(suggestions[activeSuggestion]));
                setSuggestionsOpen(false);
                setActiveSuggestion(-1);
              }
            }}
            placeholder={t.search}
            aria-label={t.search}
            role="combobox"
            aria-expanded={suggestionsOpen && normalizedSearch.length >= 2}
            aria-controls={suggestionsOpen && normalizedSearch.length >= 2 ? "header-search-suggestions" : undefined}
            aria-activedescendant={suggestionsOpen && suggestions[activeSuggestion] ? `search-suggestion-${suggestions[activeSuggestion].id}` : undefined}
            aria-autocomplete="list"
          />
          {search && (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setSearch("");
                setSuggestionsOpen(false);
              }}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </form>
        {suggestionsOpen && normalizedSearch.length >= 2 && (
          <div
            className="header-search-suggestions"
            aria-live="polite"
          >
            <div role="listbox" id="header-search-suggestions" aria-label={language === "vi" ? "Gợi ý sản phẩm" : "Product suggestions"}>
            {suggestionState === "loading" && (
              <p className="search-suggestion-message" role="option" aria-disabled="true" aria-selected="false">
                {language === "vi" ? "Đang tìm sản phẩm…" : "Searching products…"}
              </p>
            )}
            {suggestionState === "empty" && (
              <p className="search-suggestion-message" role="option" aria-disabled="true" aria-selected="false">
                {language === "vi"
                  ? "Không tìm thấy sản phẩm phù hợp."
                  : "No matching products found."}
              </p>
            )}
            {suggestionState === "error" && (
              <p className="search-suggestion-message" role="option" aria-disabled="true" aria-selected="false">
                {language === "vi"
                  ? "Chưa thể tải gợi ý. Nhấn Enter để tìm kiếm."
                  : "Suggestions are unavailable. Press Enter to search."}
              </p>
            )}
            {suggestions.map((product, index) => (
              <a
                className="search-suggestion-item"
                href={getProductUrl(product)}
                key={product.id}
                id={`search-suggestion-${product.id}`}
                role="option"
                aria-selected={activeSuggestion === index}
                onMouseEnter={() => setActiveSuggestion(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setSuggestionsOpen(false)}
              >
                <ProductImage src={product.image} alt="" loading="lazy" />
                <span className="search-suggestion-copy">
                  <strong>{product.name}</strong>
                  <small>{product.brand}</small>
                </span>
                <strong className="search-suggestion-price">
                  {product.price == null ? "—" : formatPrice(product.price)}
                </strong>
              </a>
            ))}
            </div>
            {suggestionState === "results" && (
              <button
                className="search-suggestion-all"
                type="button"
                onClick={() => {
                  navigate?.(`/search?q=${encodeURIComponent(normalizedSearch)}`);
                  setSuggestionsOpen(false);
                }}
              >
                {language === "vi"
                  ? `Xem tất cả kết quả cho “${normalizedSearch}”`
                  : `See all results for “${normalizedSearch}”`}
              </button>
            )}
          </div>
        )}
      </div>
      <div className="header-actions">
        <div className="header-location" ref={locationRef}>
          <button
            className="header-location-trigger"
            type="button"
            aria-expanded={locationOpen}
            aria-haspopup="listbox"
            aria-label={
              language === "vi"
                ? `Khu vực giao hàng: ${deliveryCity.vi}`
                : `Delivery area: ${deliveryCity.en}`
            }
            onClick={() => setLocationOpen((open) => !open)}
          >
            <MapPin size={17} />
            <span className="header-location-name">{deliveryCity[language]}</span>
            <ChevronDown size={14} />
          </button>
          {locationOpen && (
            <div
              className="header-location-menu"
              role="listbox"
              aria-label={language === "vi" ? "Chọn khu vực" : "Choose a delivery area"}
            >
              <strong>
                {language === "vi" ? "Chọn khu vực giao hàng" : "Choose delivery area"}
              </strong>
              {deliveryCities.map((city) => (
                <button
                  key={city.id}
                  type="button"
                  role="option"
                  aria-selected={deliveryCityId === city.id}
                  className={deliveryCityId === city.id ? "is-selected" : ""}
                  onClick={() => {
                    setDeliveryCityId(city.id);
                    setLocationOpen(false);
                  }}
                >
                  <MapPin size={15} /> {city[language]}
                </button>
              ))}
            </div>
          )}
        </div>
        <LanguageSwitch language={language} setLanguage={setLanguage} />
        <button
          className="header-action"
          onClick={() => navigate?.("/favorites")}
          aria-label={t.favorites}
        >
          <span className="header-action-icon">
            <Heart size={21} />
            {favorites.length > 0 && <i className="count-bubble">{favorites.length}</i>}
          </span>
          <span>{t.favorites}</span>
        </button>
        <div className="header-account-menu" ref={accountMenuRef}>
          <button
            className="header-action account-action"
            onClick={() => authUser ? setAccountMenuOpen((open) => !open) : navigate?.("/account")}
            aria-label={authUser ? `${accountLabel} · ${t.account}` : t.account}
            title={authUser ? `${accountLabel} · ${t.account}` : t.account}
            aria-expanded={authUser ? accountMenuOpen : undefined}
            aria-haspopup={authUser ? "menu" : undefined}
          >
            <span className="header-action-icon account-icon-wrap">
              <UserRound size={21} />
              {authUser && <i className="account-signed-in-dot" aria-hidden="true" />}
              {authUser && unreadCount > 0 && <i className="notification-count-bubble" aria-label={`${unreadCount} thông báo chưa đọc`}>{unreadCount > 9 ? "9+" : unreadCount}</i>}
            </span>
            <span>{accountLabel}</span>
          </button>
          {authUser && accountMenuOpen && <div className="header-account-dropdown" role="menu">
            {[
              ["/account", "Tổng quan"], ["/account/orders", "Đơn hàng"],
              ["/account/notifications", `Thông báo${unreadCount ? ` (${unreadCount})` : ""}`],
              ["/account/profile", "Hồ sơ"], ["/account/addresses", "Địa chỉ"], ["/account/security", "Bảo mật"],
            ].map(([url, label]) => <button role="menuitem" type="button" key={url} onClick={() => { setAccountMenuOpen(false); navigate?.(url, true); }}>{label}</button>)}
            <button role="menuitem" type="button" className="account-menu-logout" onClick={() => { setAccountMenuOpen(false); onLogout?.(); }}>Đăng xuất</button>
          </div>}
        </div>
        <button
          className="header-action cart-action"
          onClick={() => navigate?.("/cart")}
          aria-label={`${t.cart}: ${cartCount}`}
        >
          <span className="header-action-icon">
            <ShoppingCart size={22} />
            {cartCount > 0 && <i className="count-bubble">{cartCount}</i>}
          </span>
          <span>{t.cart}</span>
        </button>
        <button
          className="mobile-search-button"
          onClick={() => setSearchOpen((value) => !value)}
          aria-label={t.search}
        >
          <Search size={21} />
        </button>
        <button
          className="mobile-menu-button"
          onClick={() => setMobileMenu((value) => !value)}
          aria-label="Toggle navigation"
        >
          {mobileMenu ? <X size={23} /> : <Menu size={23} />}
        </button>
      </div>
    </header>
  );
}
