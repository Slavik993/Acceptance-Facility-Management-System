import {
  Body, Controller, Get, Param, Patch, Post, Query,
  UseGuards,
} from "@nestjs/common";
import type { FeedbackRow, FeedbackDigest, ReviewFeedback } from "@priyomka/contracts";
import { reviewFeedbackSchema } from "@priyomka/contracts";
import { prepareFeedback, type FeedbackInput } from "@priyomka/domain";
import { FeedbackService } from "./feedback.service";
import { SessionGuard } from "../auth/session.guard";
import { Roles, RolesGuard } from "../common/roles.guard";
import type { RequestUser } from "../common/current-user";
import { CurrentUser } from "../common/current-user";

/**
 * Замечания о платформе: приём, разбор, книга, снимок.
 *
 * Приём — у четырёх ролей. Перечень, разбор, книга, снимок — уровню
 * руководителя: бухгалтер наследует по правилу стража.
 */
@Controller("feedback")
@UseGuards(SessionGuard, RolesGuard)
export class FeedbackController {
  constructor(
    private readonly feedback: FeedbackService,
  ) {}

  /**
   * Приём замечания от любого вошедшего.
   *
   * JSON: поля kind, text, route, section, objectCode, tab, width.
   */
  @Post()
  @Roles("OWNER", "FOREMAN", "ACCOUNTANT", "CLIENT")
  async accept(
    @CurrentUser() user: RequestUser,
    @Body() body: Record<string, unknown>,
  ): Promise<{ ok: true }> {
    const input: FeedbackInput = {
      kind: body.kind,
      text: body.text,
      route: body.route,
      section: body.section,
      objectCode: body.objectCode,
      tab: body.tab,
      width: body.width,
    };

    return this.feedback.accept(user, input);
  }

  /** Перечень замечаний организации. */
  @Get()
  @Roles("OWNER")
  list(
    @CurrentUser() user: RequestUser,
    @Query("status") status?: string,
    @Query("severity") severity?: string,
    @Query("kind") kind?: string,
    @Query("page") page?: string,
  ): Promise<{ rows: FeedbackRow[]; total: number }> {
    return this.feedback.list(user, status, severity, kind, Number(page) || 1);
  }

  /** Плитки сводки. */
  @Get("digest")
  @Roles("OWNER")
  digest(@CurrentUser() user: RequestUser): Promise<FeedbackDigest> {
    return this.feedback.digest(user);
  }

  /** Разбор замечания. */
  @Patch(":id")
  @Roles("OWNER")
  review(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ): Promise<FeedbackRow> {
    return this.feedback.review(user, id, reviewFeedbackSchema.parse(body));
  }

  /** Книга Excel. */
  @Get("book")
  @Roles("OWNER")
  async book(@CurrentUser() user: RequestUser): Promise<{ buffer: Buffer; filename: string }> {
    const buffer = await this.feedback.book(user);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    return {
      buffer,
      filename: `Замечания_${date}.xlsx`,
    };
  }

  /** Снимок замечания. */
  @Get(":id/screenshot")
  @Roles("OWNER")
  async screenshot(
    @CurrentUser() user: RequestUser,
    @Param("id") id: string,
  ): Promise<{ data: Buffer; type: string; name: string }> {
    return this.feedback.screenshot(user, id);
  }
}
