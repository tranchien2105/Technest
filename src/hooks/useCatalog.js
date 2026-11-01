import { useEffect, useState } from "react";
import { apiGet, normalizeProduct } from "../api/apiClient";
import { allProductsCategory, presentCategory } from "../domain/categoryPresentation";
import { updateRouteQuery } from "../routing/navigation";

const initialData = {
  products: [],
  featuredProducts: [],
  trendingProducts: [],
  dealProducts: [],
  newArrivalProducts: [],
  detailProduct: null,
  pagination: null,
  loading: false,
  error: null,
  routeKey: null,
};

function listUrl(params = {}) {
  const query = new URLSearchParams({ limit: "24", ...params });
  return `/products?${query}`;
}

function normalizeList(data) {
  return {
    items: Array.isArray(data?.items) ? data.items.map(normalizeProduct) : [],
    pagination: data?.pagination || null,
  };
}

export function useCatalog({ route, navigate, productIds = [] }) {
  const url = new URL(route, "http://technest.local");
  const listing = ["/products", "/search"].includes(url.pathname);
  const home = url.pathname === "/";
  const setup = url.pathname === "/setup";
  const productId = /^\/products\/(\d+)$/.exec(url.pathname)?.[1] || null;
  const idsKey = [
    ...new Set(productIds.map(String).filter((id) => /^\d+$/.test(id) && id !== productId)),
  ]
    .sort()
    .join(",");
  const routeKey = `${url.pathname}${url.search}|${idsKey}`;
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [data, setData] = useState(initialData);
  const queryState = Object.fromEntries(url.searchParams);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiGet("/categories", { signal: controller.signal }),
      apiGet("/brands", { signal: controller.signal }),
    ])
      .then(([categoryData, brandData]) => {
        setCategories(
          Array.isArray(categoryData)
            ? [allProductsCategory, ...categoryData.map(presentCategory)]
            : [allProductsCategory],
        );
        setBrands(Array.isArray(brandData) ? brandData : []);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setCategories([]);
          setBrands([]);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const routeUrl = new URL(route, "http://technest.local");
    const save = (next) => setData({ ...initialData, ...next, routeKey, loading: false });
    const load = async () => {
      try {
        const selectionsPromise = idsKey
          ? apiGet(listUrl({ ids: idsKey, limit: "100" }), { signal }).then(normalizeList)
          : Promise.resolve({ items: [], pagination: null });
        if (home) {
          const [requests, selectedResult] = await Promise.all([
            Promise.allSettled([
              apiGet(listUrl({ featured: "1", limit: "24", sort: "recommended" }), { signal }),
              apiGet(listUrl({ trending: "1", limit: "24", sort: "recommended" }), { signal }),
              apiGet(listUrl({ sale: "1", limit: "24", sort: "priceLow" }), { signal }),
              apiGet(listUrl({ sort: "newest", limit: "24" }), { signal }),
              apiGet(listUrl({ sort: "recommended", limit: "100" }), { signal }),
            ]),
            Promise.allSettled([selectionsPromise]),
          ]);
          if (signal.aborted) return;
          const lists = requests.map((request) =>
            request.status === "fulfilled"
              ? normalizeList(request.value)
              : { items: [], pagination: null },
          );
          const errors = requests
            .filter((request) => request.status === "rejected")
            .map((request) => request.reason);
          if (selectedResult[0].status === "rejected") errors.push(selectedResult[0].reason);
          const selected =
            selectedResult[0].status === "fulfilled" ? selectedResult[0].value.items : [];
          const all = [
            ...new Map(
              [...lists.flatMap((list) => list.items), ...selected].map((product) => [
                product.id,
                product,
              ]),
            ).values(),
          ];
          save({
            products: all,
            featuredProducts: lists[0].items,
            trendingProducts: lists[1].items,
            dealProducts: lists[2].items,
            newArrivalProducts: lists[3].items,
            error: errors[0] || null,
          });
          return;
        }

        if (listing) {
          const params = new URLSearchParams();
          const q = routeUrl.searchParams.get("q");
          if (q) params.set("q", q);
          for (const key of ["category", "brand", "minPrice", "maxPrice", "sort", "sale", "page"])
            if (routeUrl.searchParams.has(key)) params.set(key, routeUrl.searchParams.get(key));
          params.set("limit", "24");
          const [listResult, selectedResult] = await Promise.allSettled([
            apiGet(`/products?${params}`, { signal }).then(normalizeList),
            selectionsPromise,
          ]);
          if (!signal.aborted) {
            const result =
              listResult.status === "fulfilled"
                ? listResult.value
                : { items: [], pagination: null };
            const selected =
              selectedResult.status === "fulfilled" ? selectedResult.value.items : [];
            save({
              products: [
                ...new Map(
                  [...result.items, ...selected].map((product) => [product.id, product]),
                ).values(),
              ],
              pagination: result.pagination,
              error:
                listResult.status === "rejected"
                  ? listResult.reason
                  : selectedResult.status === "rejected"
                    ? selectedResult.reason
                    : null,
            });
          }
          return;
        }

        if (productId) {
          const [detailResult, selectedResult] = await Promise.allSettled([
            apiGet(`/products/${productId}`, { signal }).then(normalizeProduct),
            selectionsPromise,
          ]);
          if (detailResult.status === "rejected") throw detailResult.reason;
          const product = detailResult.value;
          const [recommendationsResult] = await Promise.allSettled([
            apiGet(listUrl({ category: product.category, limit: "8", sort: "recommended" }), {
              signal,
            }).then(normalizeList),
          ]);
          if (!signal.aborted) {
            const related =
              recommendationsResult.status === "fulfilled"
                ? recommendationsResult.value.items.filter((item) => item.id !== product.id)
                : [];
            const selected =
              selectedResult.status === "fulfilled" ? selectedResult.value.items : [];
            save({
              detailProduct: product,
              products: [
                ...new Map(
                  [product, ...related, ...selected].map((item) => [item.id, item]),
                ).values(),
              ],
              error:
                recommendationsResult.status === "rejected"
                  ? recommendationsResult.reason
                  : selectedResult.status === "rejected"
                    ? selectedResult.reason
                    : null,
            });
          }
          return;
        }

        if (setup) {
          const [allProducts, selectedResult] = await Promise.allSettled([
            apiGet(listUrl({ limit: "100", sort: "recommended" }), { signal }).then(normalizeList),
            selectionsPromise,
          ]);
          if (!signal.aborted) {
            const all = allProducts.status === "fulfilled" ? allProducts.value.items : [];
            const selected =
              selectedResult.status === "fulfilled" ? selectedResult.value.items : [];
            save({
              products: [...new Map([...all, ...selected].map((item) => [item.id, item])).values()],
              error:
                allProducts.status === "rejected"
                  ? allProducts.reason
                  : selectedResult.status === "rejected"
                    ? selectedResult.reason
                    : null,
            });
          }
          return;
        }

        if (idsKey) {
          const result = await selectionsPromise;
          if (!signal.aborted) save({ products: result.items });
          return;
        }
        if (!signal.aborted) save({});
      } catch (error) {
        if (!signal.aborted) save({ error });
      }
    };
    void load();
    return () => controller.abort();
  }, [route, routeKey, home, listing, productId, setup, idsKey]);

  const activeCategory = listing ? url.searchParams.get("category") || "all" : "all";
  const sortBy = url.searchParams.get("sort") || "recommended";
  const setQuery = (key, value) => {
    navigate(updateRouteQuery(route, { [key]: value, page: null }));
  };
  const setActiveCategory = (category) => setQuery("category", category);
  const setSortBy = (sort) => setQuery("sort", sort);
  const clearFilters = () =>
    navigate(
      updateRouteQuery(route, {
        category: null,
        brand: null,
        minPrice: null,
        maxPrice: null,
        sale: null,
        sort: null,
        page: null,
      }),
    );

  return {
    ...data,
    loading: data.routeKey !== routeKey,
    categories,
    brands,
    activeCategory,
    sortBy,
    setActiveCategory,
    setSortBy,
    setQuery,
    clearFilters,
    visibleProducts: data.products,
    queryState,
  };
}
