import "reflect-metadata";
import { Logger, NotFoundException } from "@nestjs/common";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { FilesService } from "./files.service";
import type { RequestUser } from "../common/current-user";

/**
 * Файлы объекта (вкладка «Файлы», Э7, кандидат).
 *
 * Свойства, которые стенд проверять может только здесь: ключ
 * файла собирает сервер — от клиента не приходит; удаление
 * уносит и строку, и файл хранилища, и пишет журнал; чужой
 * объект и чужой файл — отказ, а не пустота.
 */

const USER: RequestUser = {
  id: "пользователь",
  role: "OWNER",
  name: "Роман Дементьев",
  orgId: "орг",
  orgName: "DOLGIY STUDIO",
  clientId: null,
};

const ФАЙЛЫ = [
  {
    id: "файл-старый",
    fileName: "Смета.jpg",
    contentType: "image/jpeg",
    byteSize: 100,
    uploadedAt: new Date("2026-09-08T10:15:00.000Z"),
    description: "Исходный файл сметы",
  },
  {
    id: "файл-свежий",
    fileName: "Акт.png",
    contentType: "image/png",
    byteSize: 200,
    uploadedAt: new Date("2026-10-01T14:20:00.000Z"),
    description: null,
  },
];

function стенд() {
  const созданные: Record<string, unknown>[] = [];
  const удалённые: string[] = [];
  const журнал: Record<string, unknown>[] = [];
  const положено: { ключ: string; размер: number }[] = [];
  const снято: string[] = [];

  const tx = {
    projectFile: {
      create: vi.fn(({ data, select }: { data: Record<string, unknown>; select: Record<string, true> }) => {
        созданные.push({ ...data, select });
        return Promise.resolve({
          id: "файл-новый",
          fileName: data.fileName,
          contentType: data.contentType,
          byteSize: data.byteSize,
          uploadedAt: new Date("2026-10-13T12:00:00.000Z"),
          description: data.description ?? null,
        });
      }),
      delete: vi.fn(({ where }: { where: { id: string } }) => {
        удалённые.push(where.id);
        return Promise.resolve({ count: 1 });
      }),
    },
    auditLog: {
      create: vi.fn(({ data }: { data: Record<string, unknown> }) => {
        журнал.push(data);
        return Promise.resolve({});
      }),
    },
  };

  const prisma = {
    project: {
      findFirst: vi.fn((): Promise<{ id: string; code: string } | null> =>
        Promise.resolve({ id: "объект-99", code: "R-99" })),
    },
    projectFile: {
      findMany: vi.fn(() => Promise.resolve(ФАЙЛЫ)),
      findFirst: vi.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(ФАЙЛЫ.find((файл) => файл.id === where.id)
          ? { key: `R-99/${where.id}`, fileName: "Смета.jpg", contentType: "image/jpeg" }
          : null)),
    },
    $transaction: vi.fn((работа: (клиент: typeof tx) => Promise<void>) => работа(tx)),
  };

  const storage = {
    put: vi.fn((ключ: string, тело: Buffer) => {
      положено.push({ ключ, размер: тело.byteLength });
      return Promise.resolve();
    }),
    get: vi.fn(() => Promise.resolve(Buffer.from("содержимое"))),
    remove: vi.fn((ключ: string) => {
      снято.push(ключ);
      return Promise.resolve();
    }),
  };

  const audit = {
    record: vi.fn((запись: Record<string, unknown>, клиент: unknown) => {
      expect(клиент).toBe(tx);
      журнал.push(запись);
      return Promise.resolve();
    }),
  };

  const служба = new FilesService(prisma as never, storage, audit);
  return { служба, prisma, tx, положено, снято, удалённые, журнал };
}

describe("файлы объекта", () => {
  beforeAll(() => { Logger.overrideLogger(false); });

  it("список: файлы объекта, свежие сверху, датой строкой", async () => {
    const { служба, prisma } = стенд();
    const файлы = await служба.list(USER, "R-99");
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { orgId: "орг", code: "R-99" },
      select: { id: true, code: true },
    });
    expect(файлы).toHaveLength(2);
    expect(файлы[0]?.id).toBe("файл-старый");
    expect(файлы[0]?.uploadedAt).toBe("2026-09-08T10:15:00.000Z");
    expect(файлы[1]?.description).toBeNull();
  });

  it("список: чужой объект — отказ, а не пустой список", async () => {
    const { служба, prisma } = стенд();
    prisma.project.findFirst.mockResolvedValueOnce(null);
    await expect(служба.list(USER, "R-00")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("загрузка: ключ собирает сервер, буфер ложится в хранилище, строка — в транзакции с журналом", async () => {
    const { служба, положено, журнал } = стенд();
    const буфер = Buffer.from([0xff, 0xd8, 0xff, 0xe1]);
    const файлы = await служба.upload(USER, "R-99", {
      fileName: "Снимок фасада.webp",
      contentType: "image/webp",
      buffer: буфер,
      description: "До начала работ",
    });
    /* Ключ начинается с кода объекта и не содержит имени файла:
       то, что назвал клиент, не становится путём на диске. */
    expect(положено).toHaveLength(1);
    expect(положено[0]?.ключ.startsWith("R-99/")).toBe(true);
    expect(положено[0]?.ключ).not.toContain("Снимок фасада");
    expect(положено[0]?.размер).toBe(4);
    expect(файлы).toHaveLength(2);
    expect(журнал[0]).toMatchObject({
      orgId: "орг",
      actorId: "пользователь",
      entity: "ProjectFile",
      field: "файл загружен",
      oldValue: null,
    });
    expect(String(журнал[0]?.newValue)).toContain("Снимок фасада.webp");
  });

  it("загрузка: описание необязательно — пусто, а не строка «undefined»", async () => {
    const { служба } = стенд();
    const файлы = await служба.upload(USER, "R-99", {
      fileName: "Фото.jpg",
      contentType: "image/jpeg",
      buffer: Buffer.from("снимок"),
    });
    expect(файлы).toHaveLength(2);
  });

  it("ссылка: отдаёт ключ хранилища и имя; файл другого объекта — отказ", async () => {
    const { служба } = стенд();
    const фото = await служба.get(USER, "R-99", "файл-свежий");
    expect(фото).toEqual({
      fileName: "Смета.jpg",
      contentType: "image/jpeg",
      storageKey: "R-99/файл-свежий",
    });
    await expect(служба.get(USER, "R-99", "чужой")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("содержимое: тело из хранилища рядом с метаданными", async () => {
    const { служба } = стенд();
    const фото = await служба.content(USER, "R-99", "файл-свежий");
    expect(фото.contentType).toBe("image/jpeg");
    expect(фото.body.toString()).toBe("содержимое");
  });

  it("удаление: строка и файл хранилища уносятся вместе, журнал называет файл", async () => {
    const { служба, удалённые, снято, журнал } = стенд();
    const файлы = await служба.remove(USER, "R-99", "файл-старый");
    expect(удалённые).toEqual(["файл-старый"]);
    expect(снято).toEqual(["R-99/файл-старый"]);
    expect(файлы).toHaveLength(2);
    expect(журнал[0]).toMatchObject({
      entity: "ProjectFile",
      entityId: "файл-старый",
      field: "файл удалён",
      oldValue: "Смета.jpg",
      newValue: null,
    });
  });

  it("удаление: неизвестный файл — отказ, хранилище не трогается", async () => {
    const { служба, снято } = стенд();
    await expect(служба.remove(USER, "R-99", "чужой")).rejects.toBeInstanceOf(NotFoundException);
    expect(снято).toHaveLength(0);
  });
});
