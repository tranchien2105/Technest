import { Package, Sparkles, Wrench } from "lucide-react";

export default function CategoryNav({
  categories,
  language,
  activeCategory,
  mobileMenu,
  setActiveCategory,
  setSearch,
  setMobileMenu,
  setSortBy,
  selectCategory,
  t,
  navigate,
}) {
  const goHome = () => {
    setActiveCategory("all");
    setSearch("");
    setMobileMenu(false);
    navigate?.("/");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const showDeals = () => {
    setSortBy("priceLow");
    selectCategory("all");
  };

  return (
    <nav className={`category-nav ${mobileMenu ? "nav-open" : ""}`} aria-label="Main navigation">
      <button className="nav-home" onClick={goHome}>
        <Package size={17} /> {t.home}
      </button>
      {categories.slice(1).map((category) => {
        const Icon = category.icon;
        return (
          <button
            key={category.id}
            className={activeCategory === category.id ? "nav-selected" : ""}
            onClick={() => selectCategory(category.id)}
          >
            <Icon size={17} /> {category[language]}
          </button>
        );
      })}
      <button onClick={showDeals}>
        <Sparkles size={17} /> {t.sale}
      </button>
      <button onClick={() => navigate?.("/setup")}>
        <Wrench size={17} /> {language === "vi" ? "Tạo bộ setup" : "Build a setup"}
      </button>
    </nav>
  );
}
