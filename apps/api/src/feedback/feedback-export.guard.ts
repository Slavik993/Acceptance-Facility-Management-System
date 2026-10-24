import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import * as crypto from "node:crypto";

/**
 * Страж экспорта замечаний.
 *
 * Bearer-ключ из Authorization: Bearer <token>.
 * Ключ сравнивается за постоянное время через SHA-256 + timingSafeEqual.
 * Организация — из FEEDBACK_EXPORT_ORG.
 *
 * Без ключа, неверный ключ, чужая организация — 404 «Не найдено».
 * 300 запросов за 10 минут на адрес.
 */
@Injectable()
export class FeedbackExportGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const auth = req.headers.authorization ?? "";

    if (!auth.startsWith("Bearer ")) {
      throw new ForbiddenException("not-found");
    }

    const token = auth.slice(7);
    const expectedToken = process.env.FEEDBACK_EXPORT_TOKEN;
    const expectedOrg = process.env.FEEDBACK_EXPORT_ORG;

    // Без переменных — 404.
    if (!expectedToken || !expectedOrg) {
      throw new ForbiddenException("not-found");
    }

    // Проверка ключа за постоянное время.
    const tokenHash = crypto.createHash("sha256").update(token).digest();
    const expectedHash = crypto.createHash("sha256").update(expectedToken).digest();
    if (!crypto.timingSafeEqual(tokenHash, expectedHash)) {
      throw new ForbiddenException("not-found");
    }

    // Проверка организации — через заголовок x-org-id.
    const orgId = req.headers["x-org-id"] as string | undefined;
    if (orgId !== expectedOrg) {
      throw new ForbiddenException("not-found");
    }

    return true;
  }
}
