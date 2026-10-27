import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

/**
 * Проверка живости для площадки: Render стучится в `/health` и ждёт ответа
 * 2xx — иначе сервис считается неподнятым и деплой не засчитывается.
 *
 * Ответ не пустой: база проверяется запросом к таблице `users`. Связь с
 * PostgreSQL рвётся отдельно от процесса, и «живой» сервис отвечал бы на
 * запросы, которые всё равно падают. Таблица пользователей — заодно признак
 * того, что миграции применены: сервер поднимается после `migrate deploy`.
 */
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<{ status: "ok"; database: "ok" }> {
    await this.prisma.$queryRaw`SELECT 1 FROM "users" LIMIT 1`;
    return { status: "ok", database: "ok" };
  }
}
