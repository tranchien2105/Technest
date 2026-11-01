import type { RequestHandler } from "express";
import { sendData } from "../../shared/response.js";
import { AppError } from "../../shared/errors.js";
import type { AdminCatalogService } from "./admin.catalog.service.js";

async function write<T>(operation: Promise<T>): Promise<T> {
  try { return await operation; }
  catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505")
      throw new AppError(409, "CATALOG_VALUE_EXISTS", "Slug, SKU, or name already exists.");
    if (error && typeof error === "object" && "code" in error && error.code === "23503")
      throw new AppError(409, "CATALOG_REFERENCE_IN_USE", "This catalog item is still referenced by products.");
    throw error;
  }
}

export function createAdminCatalogController(service: AdminCatalogService, notify: (userId: string, notification: NonNullable<Awaited<ReturnType<AdminCatalogService["setCustomerStatus"]>>["notification"]>) => void = () => {}) {
  const productList: RequestHandler = async (_request, response) => sendData(response, await service.productList(response.locals.validated.query));
  const productDetail: RequestHandler = async (_request, response) => sendData(response, await service.productDetail(response.locals.validated.params.id));
  const productCreate: RequestHandler = async (_request, response) => sendData(response, await write(service.saveProduct(response.locals.validated.body)), 201);
  const productUpdate: RequestHandler = async (_request, response) => sendData(response, await write(service.saveProduct(response.locals.validated.body, response.locals.validated.params.id)));
  const productArchive: RequestHandler = async (_request, response) => sendData(response, await service.productArchive(response.locals.validated.params.id));
  const brandList: RequestHandler = async (_request, response) => sendData(response, await service.brandList(response.locals.validated.query));
  const brandCreate: RequestHandler = async (_request, response) => sendData(response, await write(service.saveBrand(response.locals.validated.body)), 201);
  const brandUpdate: RequestHandler = async (_request, response) => sendData(response, await write(service.saveBrand(response.locals.validated.body, response.locals.validated.params.id)));
  const brandDelete: RequestHandler = async (_request, response) => sendData(response, await write(service.removeBrand(response.locals.validated.params.id)));
  const categoryList: RequestHandler = async (_request, response) => sendData(response, await service.categoryList(response.locals.validated.query));
  const categoryCreate: RequestHandler = async (_request, response) => sendData(response, await write(service.saveCategory(response.locals.validated.body)), 201);
  const categoryUpdate: RequestHandler = async (_request, response) => sendData(response, await write(service.saveCategory(response.locals.validated.body, response.locals.validated.params.id)));
  const categoryDelete: RequestHandler = async (_request, response) => sendData(response, await write(service.removeCategory(response.locals.validated.params.id)));
  const customerDetail: RequestHandler = async (_request, response) => sendData(response, await service.customerDetail(response.locals.validated.params.id));
  const customerStatus: RequestHandler = async (_request, response) => {
    const result = await service.setCustomerStatus(response.locals.validated.params.id, response.locals.validated.body.status);
    if (result.notification) notify(result.id, result.notification);
    sendData(response, { id: result.id, status: result.status });
  };
  return { productList, productDetail, productCreate, productUpdate, productArchive, brandList, brandCreate, brandUpdate, brandDelete,
    categoryList, categoryCreate, categoryUpdate, categoryDelete, customerDetail, customerStatus };
}
