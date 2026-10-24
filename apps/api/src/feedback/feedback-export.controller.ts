import {
  Controller, Get, Param, Patch, Query, Req,
  UseGuards, Body, Res,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ReviewFeedback } from "@priyomka/contracts";
import { reviewFeedbackSchema } from "@priyomka/contracts";
import { FeedbackService } from "./feedback.service";
import type { FeedbackExportRow } from "./feedback-export";
import { FeedbackExportGuard } from "./feedback-export.guard";

/**
 * Экспорт замечаний для исполнителя правок.
 *
 * Вход по Bearer-ключу: FEEDBACK_EXPORT_TOKEN + FEEDBACK_EXPORT_ORG.
 * Без ключа, неверный ключ, чужая организация — 404.
 *
 * Маршруты идут мимо SessionGuard; соседний страж сессии их не перехватывает.
 */
@Controller("feedback/export")
@UseGuards(FeedbackExportGuard)
export class FeedbackExportController {
  constructor(
    private readonly feedback: FeedbackService,
  ) {}

  /**
   * Перечень замечаний с подписями.
   *
   * До 5000 строк. Статусы через запятую: status=NEW,IN_WORK.
   */
  @Get()
  async list(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query("status") status?: string,
  ): Promise<void> {
    const orgId = process.env.FEEDBACK_EXPORT_ORG;
    if (!orgId) {
      return reply.code(404).send({ message: "not-found" });
    }
    const items = await this.feedback.exportList(
      orgId,
      status?.split(",").filter(Boolean),
    );

    reply.header("cache-control", "private, no-store");
    reply.header("x-robots-tag", "noindex");
    reply.send({ items, total: items.length });
  }

  /** Книга Excel. */
  @Get("book")
  async book(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const orgId = process.env.FEEDBACK_EXPORT_ORG;
    if (!orgId) {
      return reply.code(404).send({ message: "not-found" });
    }
    const buffer = await this.feedback.exportBook(orgId);

    reply.header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent("Замечания.xlsx")}`);
    reply.header("cache-control", "private, no-store");
    reply.header("x-robots-tag", "noindex");
    reply.send(buffer);
  }

  /** Снимок замечания. */
  @Get(":id/screenshot")
  async screenshot(
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
    @Param("id") id: string,
  ): Promise<void> {
    const orgId = process.env.FEEDBACK_EXPORT_ORG;
    if (!orgId) {
      return reply.code(404).send({ message: "not-found" });
    }
    const { data, type, name } = await this.feedback.exportScreenshot(orgId, id);

    reply.header("content-type", type);
    reply.header("x-content-type-options", "nosniff");
    reply.header("cache-control", "private, no-store");
    reply.header("x-robots-tag", "noindex");
    reply.header("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(name)}`);
    reply.send(data);
  }

  /**
   * Разбор замечания исполнителем.
   *
   * actorId = null: журнал не привязан к человеку.
   */
  @Patch(":id")
  async review(
    @Req() req: FastifyRequest,
    @Body() body: unknown,
    @Param("id") id: string,
  ): Promise<{ item: FeedbackExportRow }> {
    const parsed = reviewFeedbackSchema.parse(body);
    const orgId = process.env.FEEDBACK_EXPORT_ORG;
    if (!orgId) {
      throw new Error("not-found");
    }
    const item = await this.feedback.exportReview(orgId, id, parsed);
    return { item };
  }
}
