import { Heart, Menu, Search, ShoppingCart, UserRound, X } from "lucide-react";
import LanguageSwitch from "./LanguageSwitch";

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
  scrolled = false,
}) {
  const submitSearch = (event) => {
    event.preventDefault();
    const input = event.currentTarget.querySelector("input");
    const value = input?.value.trim();
    if (value) navigate?.(`/search?q=${encodeURIComponent(value)}`);
  };
  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <a className="brand" href="/" aria-label="Technest home">
        <span className="brand-mark" aria-hidden="true">
          <span>T</span>
          <i>N</i>
        </span>
        <span className="brand-name">
          Technest<span className="brand-dot">.</span>
        </span>
        <span className="brand-tagline">Better Tools. Brighter Days.</span>
      </a>
      <form
        className={`header-search ${searchOpen ? "search-visible" : ""}`}
        onSubmit={submitSearch}
      >
        <Search size={19} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.search}
          aria-label={t.search}
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear search">
            <X size={16} />
          </button>
        )}
      </form>
      <div className="header-actions">
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
        <button
          className="header-action account-action"
          onClick={() => navigate?.("/account")}
          aria-label={t.account}
        >
          <UserRound size={21} />
          <span>{t.account}</span>
        </button>
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
