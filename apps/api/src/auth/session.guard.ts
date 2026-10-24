import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { AuthService } from "./auth.service";
import type { RequestUser } from "../common/current-user";

export const SESSION_COOKIE = "priyomka_session";

/** Dev-токен: работает только когда NODE_ENV !== 'production'. */
const DEV_TOKEN = "dev-session-token-12345";
const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEV_ORG_ID = "00000000-0000-0000-0000-000000000001";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: RequestUser }>();
    const token = request.cookies[SESSION_COOKIE];
    if (!token) {
      throw new UnauthorizedException({ message: "Войдите по ссылке, отправленной на почту." });
    }
    // Dev-режим: принимаем фиксированный токен
    if (token === DEV_TOKEN && process.env.NODE_ENV !== "production") {
      request.user = {
        id: DEV_USER_ID,
        role: "OWNER",
        name: "Руководитель",
        orgId: DEV_ORG_ID,
        orgName: "DOLGIY STUDIO",
        clientId: null,
      };
      return true;
    }
    const user = await this.auth.resolveSession(token);
    if (!user) {
      throw new UnauthorizedException({ message: "Сессия истекла. Запросите новую ссылку входа." });
    }
    request.user = user;
    return true;
  }
}
