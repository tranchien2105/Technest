import { Sparkles } from "lucide-react";

export default function CategorySection({
  categories,
  language,
  activeCategory,
  selectCategory,
  setSortBy,
  t,
}) {
  const showDeals = () => {
    setSortBy("priceLow");
    selectCategory("all");
  };
  return (
    <section className="quick-categories" aria-label="Product categories">
      {categories.map((category) => {
        const Icon = category.icon;
        return (
          <button
            key={category.id}
            className={`quick-category ${activeCategory === category.id ? "quick-active" : ""}`}
            onClick={() => selectCategory(category.id)}
          >
            <span className="quick-category-image">
              <Icon size={26} strokeWidth={1.7} />
            </span>
            <span>{category[language]}</span>
          </button>
        );
      })}
      <button className="quick-category" onClick={showDeals}>
        <span className="quick-category-image">
          <Sparkles size={26} />
        </span>
        <span>{t.sale}</span>
      </button>
    </section>
  );
}
