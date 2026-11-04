import { selectFeaturedProducts } from "../domain/homepageSelection";
import { Fragment, useEffect, useState } from "react";
import AnnouncementBar from "../components/layout/AnnouncementBar";
import Header from "../components/layout/Header";
import CategoryNav from "../components/layout/CategoryNav";
import Footer from "../components/layout/Footer";
import HeroSection from "../components/home/HeroSection";
import CategorySection from "../components/home/CategorySection";
import ProductSection from "../components/home/ProductSection";
import TrendingSection from "../components/home/TrendingSection";
import DealSection from "../components/home/DealSection";
import StyleSection from "../components/home/StyleSection";
import NewArrivalsSection from "../components/home/NewArrivalsSection";
import TrustedBrandsSection from "../components/home/TrustedBrandsSection";
import FeatureBanner from "../components/home/FeatureBanner";
import ServiceSection from "../components/home/ServiceSection";
import HomeShoppingGuide from "../components/home/HomeShoppingGuide";
import HomeCampaignBanners from "../components/home/HomeCampaignBanners";
import HomePopularSearches from "../components/home/HomePopularSearches";
import ManagedBanners from "../components/home/ManagedBanners";
import HomeFlashSaleSection from "../components/home/HomeFlashSaleSection";

export default function HomePage(props) {
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const {
    t,
    language,
    categories,
    catalog,
    search,
    setSearch,
    searchOpen,
    setSearchOpen,
    favorites,
    compareIds,
    toggleCompare,
    cartCount,
    setDrawer,
    mobileMenu,
    setMobileMenu,
    notify,
    activeCategory,
    setActiveCategory,
    setSortBy,
    sortBy,
    selectCategory,
    toggleFavorite,
    addToCart,
    onViewProduct,
    showHome = true,
    navigate,
    pageContent,
    bannerPreview,
    onSelectPlacement,
    selectedPlacement,
    previewStatuses,
    homepageConfig,
  } = props;
  const cmsSections = homepageConfig?.sections || {};
  const section = (key) => cmsSections[key] || { visible: true };
  const homeCategories = (cmsSections.categories?.categorySlugs?.length
    ? categories.filter((category) => cmsSections.categories.categorySlugs.includes(category.slug || category.id))
    : categories).slice(0, cmsSections.categories?.limit || categories.length);
  const configuredFeaturedProducts = selectFeaturedProducts(catalog.products, catalog.featuredProducts, cmsSections.featured);

  useEffect(() => {
    const updateHeader = () => setHeaderScrolled(window.scrollY > 24);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  const sectionNodes = {
    categories: section("categories").visible !== false ? <CategorySection categories={homeCategories} language={language} activeCategory={activeCategory} selectCategory={selectCategory} navigate={navigate} t={t} /> : null,
    featured: section("featured").visible !== false && configuredFeaturedProducts.length > 0 ? <ProductSection visibleProducts={configuredFeaturedProducts} categories={categories} language={language} activeCategory={activeCategory} setActiveCategory={setActiveCategory} search={search} setSearch={setSearch} sortBy={sortBy} setSortBy={setSortBy} favorites={favorites} toggleFavorite={toggleFavorite} addToCart={addToCart} onViewProduct={onViewProduct} compareIds={compareIds} toggleCompare={toggleCompare} dealProducts={catalog.dealProducts} cms={section("featured")} t={t} /> : null,
    deals: section("deals").visible !== false && catalog.dealProducts.length > 0 ? <DealSection products={catalog.dealProducts.slice(0, section("deals").limit || 6)} t={t} language={language} addToCart={addToCart} favorites={favorites} toggleFavorite={toggleFavorite} compareIds={compareIds} toggleCompare={toggleCompare} onViewProduct={onViewProduct} cms={section("deals")} /> : null,
    "flash-sale": section("flash-sale").visible !== false ? <HomeFlashSaleSection navigate={navigate} cms={section("flash-sale")} /> : null,
    campaigns: section("campaigns").visible !== false ? <HomeCampaignBanners products={catalog.products} categories={categories} language={language} t={t} favorites={favorites} toggleFavorite={toggleFavorite} addToCart={addToCart} compareIds={compareIds} toggleCompare={toggleCompare} onViewProduct={onViewProduct} bannerPreview={bannerPreview} onSelectPlacement={onSelectPlacement} selectedPlacement={selectedPlacement} previewStatuses={previewStatuses} cms={section("campaigns")} /> : null,
    "promotional-banners": section("promotional-banners").visible !== false ? <ManagedBanners position="HOME_PROMO" bannerPreview={bannerPreview} onSelectPlacement={onSelectPlacement} selectedPlacement={selectedPlacement} previewStatuses={previewStatuses} limit={section("promotional-banners").limit || 3} /> : null,
    style: section("style").visible !== false ? <StyleSection t={t} language={language} selectCategory={selectCategory} cms={section("style")} /> : null,
    trending: section("trending").visible !== false && catalog.trendingProducts.length > 0 ? <TrendingSection products={catalog.trendingProducts.slice(0, section("trending").limit || 8)} language={language} t={t} addToCart={addToCart} favorites={favorites} toggleFavorite={toggleFavorite} compareIds={compareIds} toggleCompare={toggleCompare} onViewProduct={onViewProduct} cms={section("trending")} /> : null,
    "new-arrivals": section("new-arrivals").visible !== false && catalog.newArrivalProducts.length > 0 ? <NewArrivalsSection products={catalog.newArrivalProducts.slice(0, section("new-arrivals").limit || 8)} language={language} t={t} addToCart={addToCart} favorites={favorites} toggleFavorite={toggleFavorite} compareIds={compareIds} toggleCompare={toggleCompare} onViewProduct={onViewProduct} cms={section("new-arrivals")} /> : null,
    "trusted-brands": section("trusted-brands").visible !== false ? <TrustedBrandsSection brands={props.brands} t={t} language={language} cms={section("trusted-brands")} /> : null,
    "feature-banner": section("feature-banner").visible !== false ? <FeatureBanner t={t} cms={section("feature-banner")} cmsEditable={props.cmsEditable} onCmsSelect={props.onCmsSelect} /> : null,
    services: section("services").visible !== false ? <ServiceSection t={t} /> : null,
    "shopping-guide": section("shopping-guide").visible !== false ? <HomeShoppingGuide language={language} cms={section("shopping-guide")} /> : null,
    "bottom-banners": section("bottom-banners").visible !== false ? <ManagedBanners position="HOME_BOTTOM" bannerPreview={bannerPreview} onSelectPlacement={onSelectPlacement} selectedPlacement={selectedPlacement} previewStatuses={previewStatuses} limit={section("bottom-banners").limit || 6} /> : null,
    "popular-searches": section("popular-searches").visible !== false ? <HomePopularSearches language={language} navigate={navigate} setSearch={setSearch} cms={section("popular-searches")} /> : null,
  };
  // Pin Flash Sale directly below the hero so it stays visible even when an older
  // CMS configuration does not contain this newly added section key.
  const flashSaleNode = sectionNodes["flash-sale"];
  const configuredOrder = homepageConfig?.sectionOrder || Object.keys(sectionNodes);
  const orderedSectionNodes = [...new Set([...configuredOrder, ...Object.keys(sectionNodes)])]
    .filter((key) => key !== "flash-sale")
    .filter((key) => sectionNodes[key])
    .map((key) => <Fragment key={key}>{sectionNodes[key]}</Fragment>);

  return (
    <>
      <AnnouncementBar shipping={t.shipping} language={language} config={homepageConfig?.announcement} />
      <Header
        scrolled={headerScrolled}
        language={language}
        setLanguage={props.setLanguage}
        search={search}
        setSearch={setSearch}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        favorites={favorites}
        cartCount={cartCount}
        setDrawer={setDrawer}
        mobileMenu={mobileMenu}
        setMobileMenu={setMobileMenu}
        t={t}
        notify={notify}
        navigate={navigate}
        authUser={props.authUser}
        onLogout={props.onLogout}
      />

      <CategoryNav
        categories={categories}
        language={language}
        activeCategory={activeCategory}
        mobileMenu={mobileMenu}
        setActiveCategory={setActiveCategory}
        setSearch={setSearch}
        setMobileMenu={setMobileMenu}
        selectCategory={selectCategory}
        t={t}
        navigate={navigate}
      />

      {!showHome ? (
        pageContent
      ) : (
        <div className="home-content">
            <HeroSection
              language={language}
              t={t}
              selectCategory={selectCategory}
              bannerPreview={bannerPreview}
              onSelectPlacement={onSelectPlacement}
              selectedPlacement={selectedPlacement}
              previewStatuses={previewStatuses}
            />

            {flashSaleNode && <Fragment key="flash-sale-pinned">{flashSaleNode}</Fragment>}

            {catalog.loading && (
              <div
                className="catalog-loading home-catalog-loading"
                aria-label={language === "vi" ? "Đang tải sản phẩm" : "Loading products"}
              >
                {Array.from({ length: 4 }, (_, index) => (
                  <span key={index} />
                ))}
              </div>
            )}
            {catalog.error && (
              <p className="catalog-feedback" role="status">
                {language === "vi"
                  ? "Chưa thể tải danh mục sản phẩm. Các mục sản phẩm sẽ xuất hiện khi kết nối Backend hoạt động."
                  : "The product catalog could not be loaded. Product sections will appear when the Backend is available."}
              </p>
            )}

            {orderedSectionNodes}
        </div>
      )}

      <Footer t={t} language={language} notify={notify} />
    </>
  );
}
