import type { RequestHandler } from "express";
import { sendData } from "../../shared/response.js";
import type { InventoryService } from "./inventory.service.js";

export function createInventoryController(service: InventoryService) {
  const adminGet: RequestHandler = async (_request, response) => {
    const { variantId } = response.locals.validated.params as { variantId: string };
    sendData(response, await service.adminStock(variantId));
  };
  const inbound: RequestHandler = async (_request, response) => {
    const { variantId } = response.locals.validated.params as { variantId: string };
    const body = response.locals.validated.body as {
      quantity: number;
      idempotencyKey?: string;
      reference?: { type: string; id: string };
    };
    sendData(response, await service.increaseStock(variantId, body.quantity, body));
  };
  const adjust: RequestHandler = async (_request, response) => {
    const { variantId } = response.locals.validated.params as { variantId: string };
    const body = response.locals.validated.body as {
      newQuantity: number;
      idempotencyKey?: string;
      reference?: { type: string; id: string };
    };
    sendData(response, await service.adjustStock(variantId, body.newQuantity, body));
  };
  const movementList: RequestHandler = async (_request, response) => {
    const { variantId } = response.locals.validated.params as { variantId: string };
    const { page, limit } = response.locals.validated.query as { page: number; limit: number };
    sendData(response, await service.movements(variantId, page, limit));
  };
  const publicBySku: RequestHandler = async (_request, response) => {
    const { sku } = response.locals.validated.params as { sku: string };
    sendData(response, await service.publicStockBySku(sku));
  };
  return { adminGet, inbound, adjust, movementList, publicBySku };
}
