import type { RequestHandler } from "express";
import type { createCatalogService } from "./catalog.service.js";
import { AppError } from "../../shared/errors.js";
import { sendData } from "../../shared/response.js";
import type { ListProductsQuery, ListBrandsQuery } from "./catalog.schemas.js";

type CatalogService = ReturnType<typeof createCatalogService>;

export function createCatalogController(service: CatalogService) {
  const list: RequestHandler = async (_request, response) => {
    const query = response.locals.validated?.query as ListProductsQuery;
    sendData(response, await service.productsList(query));
  };
  const detail: RequestHandler = async (_request, response) => {
    const { id } = response.locals.validated?.params as { id: string };
    const product = await service.productById(id);
    if (!product) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    sendData(response, product);
  };
  const categories: RequestHandler = async (_request, response) => {
    sendData(response, await service.categoriesList());
  };
  const brands: RequestHandler = async (_request, response) => {
    const query = response.locals.validated.query as ListBrandsQuery;
    const result = await service.brandsList(query);
    sendData(response, query.paginated === "1" ? result : Array.isArray(result) ? result : result.items);
  };
  return { list, detail, categories, brands };
}
