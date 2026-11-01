import type { RequestHandler } from "express";
import { AppError } from "../../shared/errors.js";
import { sendData } from "../../shared/response.js";
import type { AccountService } from "./account.service.js";

const userId = (response: Parameters<RequestHandler>[1]) => {
  const user = response.locals.user as { id: number } | undefined;
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  return user.id;
};

export function createAccountController(service: AccountService, notify: (userId: string, notification: NonNullable<Awaited<ReturnType<AccountService["updateProfile"]>>["notification"]>) => void = () => {}) {
  const profile: RequestHandler = async (_request, response) => sendData(response, await service.profile(userId(response)));
  const updateProfile: RequestHandler = async (_request, response) => {
    const id = userId(response);
    const { notification, ...profile } = await service.updateProfile(id, response.locals.validated.body);
    if (notification) notify(String(id), notification);
    sendData(response, profile);
  };
  const addresses: RequestHandler = async (_request, response) => sendData(response, await service.listAddresses(userId(response)));
  const createAddress: RequestHandler = async (_request, response) => sendData(response, await service.createAddress(userId(response), response.locals.validated.body), 201);
  const updateAddress: RequestHandler = async (_request, response) => {
    const { id } = response.locals.validated.params as { id: string };
    sendData(response, await service.updateAddress(userId(response), id, response.locals.validated.body));
  };
  const setDefaultAddress: RequestHandler = async (_request, response) => {
    const { id } = response.locals.validated.params as { id: string };
    sendData(response, await service.setDefault(userId(response), id));
  };
  const deleteAddress: RequestHandler = async (_request, response) => {
    const { id } = response.locals.validated.params as { id: string };
    sendData(response, await service.deleteAddress(userId(response), id));
  };
  const changePassword: RequestHandler = async (_request, response) => {
    const { currentPassword, newPassword } = response.locals.validated.body;
    const id = userId(response);
    const { notification, ...result } = await service.changePassword(id, currentPassword, newPassword);
    if (notification) notify(String(id), notification);
    sendData(response, result);
  };
  const sessions: RequestHandler = async (_request, response) => sendData(response, await service.listSessions(userId(response)));
  const revokeSession: RequestHandler = async (_request, response) => {
    const { id } = response.locals.validated.params as { id: string };
    sendData(response, await service.revokeSession(userId(response), id));
  };
  return { profile, updateProfile, addresses, createAddress, updateAddress, setDefaultAddress, deleteAddress, changePassword, sessions, revokeSession };
}
