import type { RequestHandler } from "express";
import { sendData } from "../../shared/response.js";
import type { AdminService } from "./admin.service.js";

export function createAdminController(service: AdminService) {
  const overview: RequestHandler = async (_request, response) => sendData(response, await service.overview());
  const inventory: RequestHandler = async (_request, response) => sendData(response, await service.inventoryList(response.locals.validated.query));
  const customers: RequestHandler = async (_request, response) => sendData(response, await service.customerList(response.locals.validated.query));
  return { overview, inventory, customers };
}
