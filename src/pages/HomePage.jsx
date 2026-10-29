import { useEffect, useState } from "react";
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
import ProductDetail from "../components/product/ProductDetail";
import FeatureProductShelf from "../components/home/FeatureProductShelf";

export default function HomePage(props) {
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const {
    t,
    language,
    categories,
    products,
    heroSlides,
    activeSlide,
    setActiveSlide,
    search,
    setSearch,
    searchOpen,
    setSearchOpen,
    favorites,
    compareIds,
    toggleCompare,
    viewedProducts,
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
    visibleProducts,
    toggleFavorite,
    addToCart,
    selectedProduct,
    onViewProduct,
    onBackToHome,
    showHome = true,
    navigate,
    pageContent,
  } = props;

  useEffect(() => {
    const updateHeader = () => setHeaderScrolled(window.scrollY > 24);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  return (
    <>
      <AnnouncementBar shipping={t.shipping} language={language} />
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
      />

      <CategoryNav
        categories={categories}
        language={language}
        activeCategory={activeCategory}
        mobileMenu={mobileMenu}
        setActiveCategory={setActiveCategory}
        setSearch={setSearch}
        setMobileMenu={setMobileMenu}
        setSortBy={setSortBy}
        selectCategory={selectCategory}
        t={t}
        navigate={navigate}
      />

      {!showHome ? (
        pageContent
      ) : selectedProduct ? (
        <ProductDetail
          product={selectedProduct}
          products={products}
          language={language}
          t={t}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          addToCart={addToCart}
          onBack={onBackToHome}
          onViewProduct={onViewProduct}
        />
      ) : (
        <div className="home-content">
          <HeroSection
            heroSlides={heroSlides}
            activeSlide={activeSlide}
            setActiveSlide={setActiveSlide}
            language={language}
            t={t}
            selectCategory={selectCategory}
          />

          <CategorySection
            categories={categories}
            language={language}
            activeCategory={activeCategory}
            selectCategory={selectCategory}
            setSortBy={setSortBy}
            t={t}
          />

          <ProductSection
            visibleProducts={visibleProducts}
            categories={categories}
            language={language}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            search={search}
            setSearch={setSearch}
            sortBy={sortBy}
            setSortBy={setSortBy}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            addToCart={addToCart}
            onViewProduct={onViewProduct}
            compareIds={compareIds}
            toggleCompare={toggleCompare}
            t={t}
          />

          <TrendingSection
            products={products}
            language={language}
            t={t}
            setActiveCategory={setActiveCategory}
            setSearch={setSearch}
            addToCart={addToCart}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            compareIds={compareIds}
            toggleCompare={toggleCompare}
            onViewProduct={onViewProduct}
          />

          <DealSection
            products={products}
            t={t}
            setSortBy={setSortBy}
            setActiveCategory={setActiveCategory}
            language={language}
            addToCart={addToCart}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            compareIds={compareIds}
            toggleCompare={toggleCompare}
            onViewProduct={onViewProduct}
          />

          <StyleSection t={t} language={language} selectCategory={selectCategory} />

          <NewArrivalsSection
            products={products}
            language={language}
            t={t}
            setSortBy={setSortBy}
            setActiveCategory={setActiveCategory}
            addToCart={addToCart}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            compareIds={compareIds}
            toggleCompare={toggleCompare}
            onViewProduct={onViewProduct}
          />

          <TrustedBrandsSection t={t} />
          <FeatureBanner t={t} />
          <ServiceSection t={t} />
          <FeatureProductShelf
            products={viewedProducts}
            title={language === "vi" ? "Sản phẩm bạn vừa xem" : "Recently viewed"}
            language={language}
            t={t}
            favorites={favorites}
            toggleFavorite={toggleFavorite}
            addToCart={addToCart}
            compareIds={compareIds}
            toggleCompare={toggleCompare}
            onViewProduct={onViewProduct}
          />
        </div>
      )}

      <Footer t={t} language={language} notify={notify} />
    </>
  );
}
