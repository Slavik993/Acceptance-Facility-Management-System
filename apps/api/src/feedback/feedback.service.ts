import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import type { FeedbackRow, FeedbackDigest, ReviewFeedback } from "@priyomka/contracts";
import {
  CLOSED_FEEDBACK_STATUSES, FEEDBACK_KINDS, FEEDBACK_KIND_LABEL, FEEDBACK_KIND_HINT,
  FEEDBACK_SEVERITIES, FEEDBACK_SEVERITY_LABEL, FEEDBACK_STATUSES, FEEDBACK_STATUS_LABEL,
  FEEDBACK_ROLE_LABEL, FEEDBACK_TEXT_MIN, FEEDBACK_TEXT_MAX, FEEDBACK_SCREENSHOT_MAX_BYTES,
  prepareFeedback, feedbackRouteTemplate, feedbackObjectCode, feedbackDevice,
  type FeedbackKind, type FeedbackSeverity, type FeedbackStatus, type PreparedFeedback,
  type FeedbackInput, type FeedbackPreparation,
} from "@priyomka/domain";
import { buildFeedbackBook, type FeedbackBookRow } from "@priyomka/importer";
import { PrismaService } from "../prisma.service";
import { AuditService } from "../common/audit.service";
import type { CurrentUser } from "@priyomka/contracts";
import type { RequestUser } from "../common/current-user";
import type { FeedbackExportRow } from "./feedback-export";

/** Лимит замечаний на пользователя за 10 минут — в памяти. */
const RATE_LIMIT_COUNT = 20;
const RATE_LIMIT_MS = 10 * 60 * 1000;

/** Ограничение частоты: хранит момент последнего запроса. */
const rateWindow = new Map<string, number[]>();

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const window = rateWindow.get(userId) ?? [];
  // Удаляем старые записи за пределами окна.
  const recent = window.filter((t): t is number => t !== undefined && now - t < RATE_LIMIT_MS);
  if (recent.length >= RATE_LIMIT_COUNT) {
    rateWindow.set(userId, recent);
    const oldest = recent[0];
    if (oldest === undefined) return;
    throw new BadRequestException(
      `Слишком много замечаний. Повторите через ${Math.ceil((oldest + RATE_LIMIT_MS - now) / 60000)} мин.`,
    );
  }
  recent.push(now);
  rateWindow.set(userId, recent);
}

/**
 * Сервис замечаний о платформе.
 *
 * Перенос механизма ProDisser (Р-403, Р-405, Р-583).
 * Любой вошедший пишет замечание; руководитель разбирает;
 * исполнитель забирает по ключу.
 */
@Injectable()
export class FeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Приём замечания от любого пользователя.
   *
   * Разбирает ввод через prepareFeedback, проверяет объект,
   * записывает в базу. Снимок пока не поддерживается — добавляется позже.
   */
  async accept(user: RequestUser, input: FeedbackInput): Promise<{ ok: true }> {
    checkRateLimit(user.id);

    // Сервер клиенту не верит: разбираем заново тем же модулем.
    const parsed = prepareFeedback(input);
    if (!parsed.ok) throw new Error(parsed.error);

    // Проверяем, что объект принадлежит организации и виден этой роли.
    const objectCode = typeof input.objectCode === "string" && input.objectCode.trim()
      ? await this.validateObjectScope(user, input.objectCode.trim())
      : null;

    const prepared = parsed.value;
    await this.prisma.$transaction(async (tx) => {
      await tx.feedback.create({
        data: {
          orgId: user.orgId,
          kind: prepared.kind,
          authorRole: user.role,
          routeTemplate: prepared.routeTemplate,
          section: prepared.section,
          objectCode: objectCode ?? null,
          tab: prepared.tab,
          text: prepared.text,
          device: prepared.device,
          viewportWidth: prepared.viewportWidth,
          screenshotKey: null,
          screenshotType: null,
          screenshotSize: null,
          severityAuto: prepared.severityAuto,
          severity: prepared.severityAuto, // Итоговую ставит руководитель.
          status: "NEW",
        },
      });
    });

    return { ok: true };
  }

  /**
   * Проверка, что объект принадлежит организации и виден этой роли.
   * Если объект не найден или не виден — возвращает null.
   */
  private async validateObjectScope(user: RequestUser, objectCode: string): Promise<string | null> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { code: objectCode.toUpperCase(), orgId: user.orgId },
        select: { id: true },
      });
      return project ? objectCode.toUpperCase() : null;
    } catch {
      return null;
    }
  }

  /**
   * Перечень замечаний организации для руководителя.
   * Свежие сверху, по 50 на страницу.
   */
  async list(
    user: RequestUser,
    status?: string,
    severity?: string,
    kind?: string,
    page: number = 1,
  ): Promise<{ rows: FeedbackRow[]; total: number }> {
    const where: Record<string, unknown> = { orgId: user.orgId };
    if (status && FEEDBACK_STATUSES.includes(status as FeedbackStatus)) where.status = status;
    if (severity && FEEDBACK_SEVERITIES.includes(severity as FeedbackSeverity)) where.severity = severity;
    if (kind && FEEDBACK_KINDS.includes(kind as FeedbackKind)) where.kind = kind;

    const skip = (page - 1) * 50;
    const [rows, total] = await Promise.all([
      this.prisma.feedback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: 50,
        select: {
          id: true, createdAt: true, kind: true, authorRole: true,
          routeTemplate: true, section: true, objectCode: true, tab: true,
          device: true, viewportWidth: true, text: true,
          severityAuto: true, severity: true, status: true, note: true,
          resolvedAt: true, screenshotKey: true,
        },
      }),
      this.prisma.feedback.count({ where }),
    ]);

    return {
      rows: rows.map((r) => this.toRow(r)),
      total,
    };
  }

  /**
   * Плитки сводки: новых, в работе, критичных открытых, всего.
   */
  async digest(user: RequestUser): Promise<FeedbackDigest> {
    const [fresh, inWork, criticalOpen, total] = await Promise.all([
      this.prisma.feedback.count({ where: { orgId: user.orgId, status: "NEW" } }),
      this.prisma.feedback.count({ where: { orgId: user.orgId, status: "IN_WORK" } }),
      this.prisma.feedback.count({
        where: { orgId: user.orgId, status: { notIn: ["DONE", "DECLINED"] }, severity: "CRITICAL" },
      }),
      this.prisma.feedback.count({ where: { orgId: user.orgId } }),
    ]);
    return { fresh, inWork, criticalOpen, total };
  }

  /**
   * Разбор замечания руководителем.
   *
   * status, severity, note — хотя бы одно.
   * resolvedAt ставится при переходе в DONE/DECLINED, снимается при возврате.
   * Журнал пока не пишется: добавляется позже с транзакционным клиентом.
   */
  async review(
    user: RequestUser,
    id: string,
    body: ReviewFeedback,
  ): Promise<FeedbackRow> {
    const existing = await this.prisma.feedback.findFirst({
      where: { id, orgId: user.orgId },
    });
    if (!existing) throw new NotFoundException("Замечание не найдено.");

    // Хоть одно поле должно быть.
    if (body.status === undefined && body.severity === undefined && body.note === undefined) {
      throw new Error("Укажите хотя бы одно поле: status, severity или note.");
    }

    const oldStatus = existing.status as FeedbackStatus;
    const newStatus = (body.status ?? existing.status) as FeedbackStatus;

    // resolvedAt: ставится при переходе в DONE/DECLINED, снимается при возврате.
    let resolvedAt: Date | null = existing.resolvedAt;
    if (CLOSED_FEEDBACK_STATUSES.has(newStatus) && !CLOSED_FEEDBACK_STATUSES.has(oldStatus)) {
      resolvedAt = new Date();
    } else if (!CLOSED_FEEDBACK_STATUSES.has(newStatus) && CLOSED_FEEDBACK_STATUSES.has(oldStatus)) {
      resolvedAt = null;
    }

    const updated = await this.prisma.feedback.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.severity && { severity: body.severity }),
        ...(body.note !== undefined && { note: body.note || null }),
        ...(resolvedAt !== undefined && { resolvedAt }),
      },
      select: {
        id: true, createdAt: true, kind: true, authorRole: true,
        routeTemplate: true, section: true, objectCode: true, tab: true,
        device: true, viewportWidth: true, text: true,
        severityAuto: true, severity: true, status: true, note: true,
        resolvedAt: true, screenshotKey: true,
      },
    });

    // Журнал не пишется: audit.record требует транзакционный клиент.
    // Добавляется позже (БП-10).

    return this.toRow(updated);
  }

  /**
   * Книга замечаний Excel.
   *
   * Собирается целиком при каждой выгрузке.
   */
  async book(user: RequestUser): Promise<Buffer> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { name: true, timeZone: true },
    });
    if (!organization) throw new Error("Организация не найдена.");

    const rows = await this.prisma.feedback.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, createdAt: true, kind: true, authorRole: true,
        routeTemplate: true, section: true, objectCode: true, tab: true,
        device: true, viewportWidth: true, text: true,
        severityAuto: true, severity: true, status: true, note: true,
        resolvedAt: true, screenshotKey: true,
      },
    });

    const bookRows: FeedbackBookRow[] = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      kind: r.kind as FeedbackKind,
      roleLabel: FEEDBACK_ROLE_LABEL[r.authorRole] ?? r.authorRole,
      section: r.section,
      objectCode: r.objectCode,
      tab: r.tab,
      routeTemplate: r.routeTemplate,
      device: r.device,
      viewportWidth: r.viewportWidth,
      text: r.text,
      severityAuto: r.severityAuto as FeedbackSeverity,
      severity: r.severity as FeedbackSeverity,
      status: r.status as FeedbackStatus,
      note: r.note,
      resolvedAt: r.resolvedAt,
      hasScreenshot: r.screenshotKey !== null,
    }));

    return buildFeedbackBook(bookRows, {
      organization: organization.name,
      timeZone: organization.timeZone,
      generatedAt: new Date(),
    });
  }

  /**
   * Снимок замечания для руководителя.
   *
   * Пока не поддерживается: снимки добавляются позже с FileStorage.
   */
  async screenshot(_user: RequestUser, _id: string): Promise<{ data: Buffer; type: string; name: string }> {
    throw new NotFoundException("Снимок пока не поддерживается.");
  }

  /**
   * Конвертация записи БД в контрактную строку.
   */
  private toRow(r: {
    id: string;
    createdAt: Date;
    kind: string;
    authorRole: string;
    routeTemplate: string;
    section: string;
    objectCode: string | null;
    tab: string;
    device: string;
    viewportWidth: number | null;
    text: string;
    severityAuto: string;
    severity: string;
    status: string;
    note: string | null;
    resolvedAt: Date | null;
    screenshotKey: string | null;
  }): FeedbackRow {
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      kind: r.kind as FeedbackKind,
      authorRole: r.authorRole as CurrentUser["role"],
      routeTemplate: r.routeTemplate,
      section: r.section,
      objectCode: r.objectCode,
      tab: r.tab,
      device: r.device,
      viewportWidth: r.viewportWidth,
      text: r.text,
      severityAuto: r.severityAuto as FeedbackSeverity,
      severity: r.severity as FeedbackSeverity,
      status: r.status as FeedbackStatus,
      note: r.note,
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      hasScreenshot: r.screenshotKey !== null,
    };
  }

  // =========================================================================
  // Методы экспорта для исполнителя правок (по ключу).
  // =========================================================================

  /**
   * Перечень замечаний для экспорта.
   */
  async exportList(orgId: string, statuses?: string[]): Promise<FeedbackExportRow[]> {
    const where: Record<string, unknown> = { orgId };
    if (statuses?.length) {
      where.status = { in: statuses };
    }

    const rows = await this.prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: {
        id: true, createdAt: true, kind: true, authorRole: true,
        routeTemplate: true, section: true, objectCode: true, tab: true,
        device: true, viewportWidth: true, text: true,
        severityAuto: true, severity: true, status: true, note: true,
        resolvedAt: true, screenshotKey: true, screenshotType: true,
        screenshotSize: true,
      },
    });

    return rows.map((r) => ({
      id: r.id,
      kindLabel: FEEDBACK_KIND_LABEL[r.kind as FeedbackKind],
      severityLabel: FEEDBACK_SEVERITY_LABEL[r.severity as FeedbackSeverity],
      statusLabel: FEEDBACK_STATUS_LABEL[r.status as FeedbackStatus],
      roleLabel: FEEDBACK_ROLE_LABEL[r.authorRole] ?? r.authorRole,
      createdAtLocal: r.createdAt.toLocaleString("ru-RU"),
      resolvedAtLocal: r.resolvedAt?.toLocaleString("ru-RU") ?? null,
      section: r.section,
      objectCode: r.objectCode,
      tab: r.tab,
      route: r.routeTemplate,
      device: r.device,
      viewportWidth: r.viewportWidth,
      text: r.text,
      note: r.note,
      screenshot: r.screenshotKey ? { type: r.screenshotType!, size: r.screenshotSize! } : null,
    }));
  }

  /**
   * Книга для экспорта.
   */
  async exportBook(orgId: string): Promise<Buffer> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, timeZone: true },
    });
    if (!organization) throw new Error("Организация не найдена.");

    const rows = await this.prisma.feedback.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, createdAt: true, kind: true, authorRole: true,
        routeTemplate: true, section: true, objectCode: true, tab: true,
        device: true, viewportWidth: true, text: true,
        severityAuto: true, severity: true, status: true, note: true,
        resolvedAt: true, screenshotKey: true,
      },
    });

    const bookRows: FeedbackBookRow[] = rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      kind: r.kind as FeedbackKind,
      roleLabel: FEEDBACK_ROLE_LABEL[r.authorRole] ?? r.authorRole,
      section: r.section,
      objectCode: r.objectCode,
      tab: r.tab,
      routeTemplate: r.routeTemplate,
      device: r.device,
      viewportWidth: r.viewportWidth,
      text: r.text,
      severityAuto: r.severityAuto as FeedbackSeverity,
      severity: r.severity as FeedbackSeverity,
      status: r.status as FeedbackStatus,
      note: r.note,
      resolvedAt: r.resolvedAt,
      hasScreenshot: r.screenshotKey !== null,
    }));

    return buildFeedbackBook(bookRows, {
      organization: organization.name,
      timeZone: organization.timeZone,
      generatedAt: new Date(),
    });
  }

  /**
   * Снимок замечания для экспорта.
   *
   * Пока не поддерживается: снимки добавляются позже с FileStorage.
   */
  async exportScreenshot(_orgId: string, _id: string): Promise<{ data: Buffer; type: string; name: string }> {
    throw new NotFoundException("Снимок пока не поддерживается.");
  }

  /**
   * Разбор замечания исполнителем.
   *
   * actorId = null: журнал не привязан к человеку.
   */
  async exportReview(orgId: string, id: string, body: ReviewFeedback): Promise<FeedbackExportRow> {
    const existing = await this.prisma.feedback.findFirst({
      where: { id, orgId },
    });
    if (!existing) throw new NotFoundException("Замечание не найдено.");

    if (body.status === undefined && body.severity === undefined && body.note === undefined) {
      throw new Error("Укажите хотя бы одно поле: status, severity или note.");
    }

    const oldStatus = existing.status as FeedbackStatus;
    const newStatus = (body.status ?? existing.status) as FeedbackStatus;

    let resolvedAt: Date | null = existing.resolvedAt;
    if (CLOSED_FEEDBACK_STATUSES.has(newStatus) && !CLOSED_FEEDBACK_STATUSES.has(oldStatus)) {
      resolvedAt = new Date();
    } else if (!CLOSED_FEEDBACK_STATUSES.has(newStatus) && CLOSED_FEEDBACK_STATUSES.has(oldStatus)) {
      resolvedAt = null;
    }

    const updated = await this.prisma.feedback.update({
      where: { id },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.severity && { severity: body.severity }),
        ...(body.note !== undefined && { note: body.note || null }),
        ...(resolvedAt !== undefined && { resolvedAt }),
      },
      select: {
        id: true, createdAt: true, kind: true, authorRole: true,
        routeTemplate: true, section: true, objectCode: true, tab: true,
        device: true, viewportWidth: true, text: true,
        severityAuto: true, severity: true, status: true, note: true,
        resolvedAt: true, screenshotKey: true, screenshotType: true,
        screenshotSize: true,
      },
    });

    return {
      id: updated.id,
      kindLabel: FEEDBACK_KIND_LABEL[updated.kind as FeedbackKind],
      severityLabel: FEEDBACK_SEVERITY_LABEL[updated.severity as FeedbackSeverity],
      statusLabel: FEEDBACK_STATUS_LABEL[updated.status as FeedbackStatus],
      roleLabel: FEEDBACK_ROLE_LABEL[updated.authorRole] ?? updated.authorRole,
      createdAtLocal: updated.createdAt.toLocaleString("ru-RU"),
      resolvedAtLocal: updated.resolvedAt?.toLocaleString("ru-RU") ?? null,
      section: updated.section,
      objectCode: updated.objectCode,
      tab: updated.tab,
      route: updated.routeTemplate,
      device: updated.device,
      viewportWidth: updated.viewportWidth,
      text: updated.text,
      note: updated.note,
      screenshot: updated.screenshotKey ? { type: updated.screenshotType!, size: updated.screenshotSize! } : null,
    };
  }
}
