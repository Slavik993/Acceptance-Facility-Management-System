import { Injectable, NotFoundException } from "@nestjs/common";
import type { ProjectFile } from "@priyomka/contracts";
import { PrismaService } from "../prisma.service";
import { FileStorage } from "../common/file-storage";
import { AuditService } from "../common/audit.service";
import type { RequestUser } from "../common/current-user";
import { projectScope } from "../common/project-scope";
import { formatDay } from "@priyomka/domain";

/**
 * Файлы объекта (вкладка «Файлы», Э7, кандидат).
 *
 * Загружает руководитель и прораб. Все роли видят файлы объекта.
 * Ключ файла собирает сервер, от клиента не приходит.
 */
@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly audit: AuditService,
  ) {}

  private async projectOf(user: RequestUser, code: string) {
    const project = await this.prisma.project.findFirst({
      where: { ...projectScope(user), code },
      select: { id: true, code: true },
    });
    if (!project) {
      throw new NotFoundException({ message: `Объект ${code} не найден или недоступен.` });
    }
    return project;
  }

  /** Список файлов объекта. */
  async list(user: RequestUser, code: string): Promise<ProjectFile[]> {
    const project = await this.projectOf(user, code);
    const rows = await this.prisma.projectFile.findMany({
      where: { projectId: project.id },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        fileName: true,
        contentType: true,
        byteSize: true,
        uploadedAt: true,
        description: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      contentType: row.contentType,
      byteSize: row.byteSize,
      uploadedAt: row.uploadedAt.toISOString(),
      description: row.description,
    }));
  }

  /** Загрузка файла. */
  async upload(
    user: RequestUser,
    code: string,
    input: { fileName: string; contentType: string; buffer: Buffer; description?: string | null },
  ): Promise<ProjectFile[]> {
    const project = await this.projectOf(user, code);

    // Ключ уникален в пределах объекта.
    const key = `${project.code}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await this.storage.put(key, input.buffer, input.contentType);

    await this.prisma.$transaction(async (tx) => {
      const file = await tx.projectFile.create({
        data: {
          projectId: project.id,
          key,
          fileName: input.fileName,
          contentType: input.contentType,
          byteSize: input.buffer.byteLength,
          uploadedById: user.id,
          description: input.description ?? null,
        },
        select: {
          id: true,
          fileName: true,
          contentType: true,
          byteSize: true,
          uploadedAt: true,
          description: true,
        },
      });

      await this.audit.record({
        orgId: user.orgId,
        actorId: user.id,
        entity: "ProjectFile",
        entityId: file.id,
        field: "файл загружен",
        oldValue: null,
        newValue: `${input.fileName}: ${formatDay(file.uploadedAt.toISOString().slice(0, 10))}`,
      }, tx);
    });

    return this.list(user, code);
  }

  /** Ссылка на файл (отдаёт бинарник). */
  async get(user: RequestUser, code: string, fileId: string): Promise<{
    fileName: string;
    contentType: string;
    storageKey: string;
  }> {
    const project = await this.projectOf(user, code);
    const file = await this.prisma.projectFile.findFirst({
      where: { id: fileId, projectId: project.id },
      select: { key: true, fileName: true, contentType: true },
    });
    if (!file) {
      throw new NotFoundException({ message: "Файл не найден." });
    }
    return { fileName: file.fileName, contentType: file.contentType, storageKey: file.key };
  }

  /** Содержимое файла: метаданные и тело из хранилища. */
  async content(user: RequestUser, code: string, fileId: string): Promise<{
    fileName: string;
    contentType: string;
    body: Buffer;
  }> {
    const meta = await this.get(user, code, fileId);
    return { ...meta, body: await this.storage.get(meta.storageKey) };
  }

  /** Удаление файла. */
  async remove(user: RequestUser, code: string, fileId: string): Promise<ProjectFile[]> {
    const project = await this.projectOf(user, code);
    const file = await this.prisma.projectFile.findFirst({
      where: { id: fileId, projectId: project.id },
      select: { key: true, fileName: true },
    });
    if (!file) {
      throw new NotFoundException({ message: "Файл не найден." });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.projectFile.delete({ where: { id: fileId } });
      await this.audit.record({
        orgId: user.orgId,
        actorId: user.id,
        entity: "ProjectFile",
        entityId: fileId,
        field: "файл удалён",
        oldValue: file.fileName,
        newValue: null,
      }, tx);
    });
    /* Файл из хранилища убирается после записи: сирота в хранилище
       невидима (строки нет), а пропавший файл при живой строке
       читался бы как ошибка сервера. */
    await this.storage.remove(file.key);

    return this.list(user, code);
  }
}
