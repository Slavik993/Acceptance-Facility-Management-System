-- Файлы объекта (вкладка «Файлы», Э7, кандидат).
--
-- Новая таблица, миграция безоговорочна: существующих строк она не
-- трогает.
--
-- Загружает руководитель и прораб: договоры, доп. соглашения, сканы,
-- фотографии вне приёмки. Ключ файла собирает сервер, от клиента не
-- приходит. Тип определяется по первым байтам (SVG не принимается).
--
-- Хранится тем же порядком, что снимки чеков и фотоотчёта: ключ,
-- имя, тип, размер.

-- CreateTable
CREATE TABLE "project_files" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "uploadedById" UUID,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,

    CONSTRAINT "project_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_files_key_key" ON "project_files"("key");

-- CreateIndex
CREATE INDEX "project_files_projectId_uploadedAt_idx" ON "project_files"("projectId", "uploadedAt");

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_files" ADD CONSTRAINT "project_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
