import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ProjectFile } from "@priyomka/contracts";
import { FilesService } from "./files.service";
import { detectImageType, ALLOWED_IMAGE_TYPES } from "../measure/image-type";
import { SessionGuard } from "../auth/session.guard";
import { Roles, RolesGuard } from "../common/roles.guard";
import { CurrentUser, type RequestUser } from "../common/current-user";

/**
 * Вкладка «Файлы» объекта (Э7, кандидат).
 *
 * Загружает руководитель и прораб. Все роли видят файлы объекта.
 * Файл и описание приходят одним многочастным запросом.
 */

const MAX_FILE_BYTES = 10 * 1024 * 1024;

/**
 * Разбор запроса: часть `attachment` — файл, часть
 * `description` — описание.
 */
async function readFileUpload(
  request: FastifyRequest,
): Promise<{ description: string | null; fileName: string; buffer: Buffer }> {
  let description: string | null = null;
  let file: { fileName: string; buffer: Buffer } | null = null;

  for await (const part of request.parts()) {
    if (part.type === "file") {
      const buffer = await part.toBuffer();
      if (buffer.byteLength > MAX_FILE_BYTES) {
        throw new BadRequestException({
          message: `Файл больше ${String(MAX_FILE_BYTES / 1024 / 1024)} МБ.`,
        });
      }
      file = { fileName: part.filename, buffer };
      continue;
    }
    if (part.fieldname === "description") {
      description = String(part.value) || null;
    }
  }

  if (file === null) {
    throw new BadRequestException({
      message: "Прикрепите файл: без него загрузка невозможна.",
    });
  }
  return { description, ...file };
}

@Controller("projects/:code/files")
@UseGuards(SessionGuard, RolesGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  /** Список файлов объекта. */
  @Get()
  list(@CurrentUser() user: RequestUser, @Param("code") code: string): Promise<ProjectFile[]> {
    return this.files.list(user, code);
  }

  /** Загрузка файла. */
  @Post()
  @Roles("OWNER", "FOREMAN")
  async upload(
    @CurrentUser() user: RequestUser,
    @Param("code") code: string,
    @Req() request: FastifyRequest,
  ): Promise<ProjectFile[]> {
    const { description, fileName, buffer } = await readFileUpload(request);

    // Тип определяется по содержимому, а не по расширению.
    const contentType = detectImageType(buffer);
    if (contentType === null) {
      throw new BadRequestException({
        message: `Принимается изображением: ${ALLOWED_IMAGE_TYPES.join(", ")}. `
          + "Тип определяется по содержимому файла.",
      });
    }

    return this.files.upload(user, code, { fileName, contentType, buffer, description });
  }

  /** Ссылка на файл (отдаёт бинарник). */
  @Get(":id/file")
  async serve(
    @CurrentUser() user: RequestUser,
    @Param("code") code: string,
    @Param("id") id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Buffer> {
    const photo = await this.files.content(user, code, id);
    void reply
      .header("content-type", photo.contentType)
      .header("x-content-type-options", "nosniff")
      .header("cache-control", "private, no-cache")
      .header("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(photo.fileName)}`);
    return photo.body;
  }

  /** Удаление файла. */
  @Delete(":id")
  @Roles("OWNER", "FOREMAN")
  remove(
    @CurrentUser() user: RequestUser,
    @Param("code") code: string,
    @Param("id") id: string,
  ): Promise<ProjectFile[]> {
    return this.files.remove(user, code, id);
  }
}
