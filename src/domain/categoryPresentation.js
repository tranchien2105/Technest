import { Headphones, Keyboard, Monitor, Mouse, Package } from "lucide-react";

const categoryIcons = {
  keyboards: Keyboard,
  mice: Mouse,
  monitors: Monitor,
  audio: Headphones,
  accessories: Package,
};

export function presentCategory(category) {
  return {
    ...category,
    en: category.nameEn || category.name,
    vi: category.name,
    icon: categoryIcons[category.id] || Package,
  };
}

export const allProductsCategory = {
  id: "all",
  en: "All products",
  vi: "Tất cả",
  icon: Package,
};
