-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Moscow',
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "phone" TEXT,
    "email" TEXT,
    "requisites" TEXT,
    "logoKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CONTRACT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "document_templates_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_clauses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    CONSTRAINT "document_clauses_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "document_templates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "estimate_blueprints" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceCode" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "estimate_blueprints_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "estimate_blueprints_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "blueprint_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blueprintId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "blueprint_sections_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "estimate_blueprints" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "blueprint_sections_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "blueprint_sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "blueprint_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blueprintId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "qty" BIGINT NOT NULL,
    "unitPrice" BIGINT NOT NULL,
    "unitWage" BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT "blueprint_items_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "estimate_blueprints" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "blueprint_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "blueprint_sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "blueprint_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "clientId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "lastSeenAt" DATETIME,
    CONSTRAINT "users_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isCompany" BOOLEAN NOT NULL DEFAULT false,
    "requisites" TEXT,
    "paymentGraceDays" INTEGER,
    CONSTRAINT "clients_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "foremanId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "waitingFor" TEXT,
    "startedAt" DATETIME,
    "deadline" DATETIME,
    "keysCount" INTEGER NOT NULL DEFAULT 0,
    "supervisionShare" INTEGER NOT NULL DEFAULT 1200,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "projects_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "projects_foremanId_fkey" FOREIGN KEY ("foremanId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    CONSTRAINT "units_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "supervisionShare" INTEGER NOT NULL DEFAULT 1200,
    "declaredWorksTotal" BIGINT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "estimates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "estimate_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estimateId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "sourceRow" INTEGER,
    CONSTRAINT "estimate_sections_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "estimate_sections_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "estimate_sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "estimate_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estimateId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "qty" BIGINT NOT NULL,
    "unitPrice" BIGINT NOT NULL,
    "unitWage" BIGINT NOT NULL DEFAULT 0,
    "sourceRow" INTEGER,
    "roomId" TEXT,
    "removedAt" DATETIME,
    CONSTRAINT "estimate_items_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "estimate_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "estimate_sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "estimate_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "estimate_items_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "measure_rooms" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "other_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estimateId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "unitPrice" BIGINT NOT NULL,
    "sourceRow" INTEGER,
    CONSTRAINT "other_expenses_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "other_expenses_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "estimate_imports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "estimateId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedById" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "positions" INTEGER NOT NULL,
    "sectionsTotal" INTEGER NOT NULL,
    "computedWorksTotal" BIGINT NOT NULL,
    "declaredWorksTotal" BIGINT,
    "worksTotalDelta" BIGINT,
    "report" JSONB NOT NULL,
    CONSTRAINT "estimate_imports_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BRIGADE',
    "defaultRate" BIGINT,
    CONSTRAINT "workers_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "actorId" TEXT,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "measure_rooms" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "set" TEXT NOT NULL DEFAULT 'INITIAL',
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "floorArea" BIGINT NOT NULL,
    "floorPerimeter" BIGINT NOT NULL,
    "ceilingPerimeter" BIGINT NOT NULL,
    "height" BIGINT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "measure_rooms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "measure_openings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "area" BIGINT NOT NULL,
    "reveal" BIGINT NOT NULL,
    CONSTRAINT "measure_openings_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "measure_rooms" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "measure_plans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "set" TEXT NOT NULL DEFAULT 'INITIAL',
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "measure_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "measure_plans_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "work_stages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startsOn" DATETIME NOT NULL,
    "endsOn" DATETIME NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "sectionId" TEXT,
    "brigadeId" TEXT,
    CONSTRAINT "work_stages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "work_stages_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "estimate_sections" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "work_stages_brigadeId_fkey" FOREIGN KEY ("brigadeId") REFERENCES "workers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "acceptance_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "brigadeId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,
    "trancheId" TEXT,
    CONSTRAINT "acceptance_batches_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "acceptance_batches_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "estimate_sections" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "acceptance_batches_brigadeId_fkey" FOREIGN KEY ("brigadeId") REFERENCES "workers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "acceptance_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "acceptance_batches_trancheId_fkey" FOREIGN KEY ("trancheId") REFERENCES "tranches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "acceptances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "qty" BIGINT NOT NULL,
    "reason" TEXT,
    "reversesId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acceptances_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "acceptance_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "acceptances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "estimate_items" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "acceptances_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "acceptances_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "acceptances" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "wage_accruals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "acceptanceId" TEXT NOT NULL,
    "brigadeId" TEXT NOT NULL,
    "unitWage" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "wage_accruals_acceptanceId_fkey" FOREIGN KEY ("acceptanceId") REFERENCES "acceptances" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "wage_accruals_brigadeId_fkey" FOREIGN KEY ("brigadeId") REFERENCES "workers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "acceptance_photos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "acceptance_photos_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "acceptance_batches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "acceptance_photos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "material_expenses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "kind" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "reimbursable" BOOLEAN NOT NULL DEFAULT true,
    "seller" TEXT NOT NULL,
    "spentAt" DATETIME NOT NULL,
    "sectionId" TEXT,
    "note" TEXT,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedById" TEXT,
    "confirmedAt" DATETIME,
    CONSTRAINT "material_expenses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "material_expenses_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "estimate_sections" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "material_expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "material_expenses_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tranches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "paidAt" DATETIME,
    "signedAt" DATETIME,
    "signedScanKey" TEXT,
    "signedScanType" TEXT,
    "signedScanAt" DATETIME,
    "comment" TEXT,
    "createdById" TEXT,
    CONSTRAINT "tranches_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tranches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tranche_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trancheId" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "paidOn" DATETIME NOT NULL,
    "reason" TEXT,
    "reversalOfId" TEXT,
    "comment" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tranche_payments_trancheId_fkey" FOREIGN KEY ("trancheId") REFERENCES "tranches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tranche_payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tranche_payments_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "tranche_payments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "repair_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ratePerSqm" BIGINT NOT NULL,
    "spread" INTEGER NOT NULL DEFAULT 1500,
    "order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "repair_types_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "note" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'FIRST_CONTACT',
    "outcome" TEXT NOT NULL DEFAULT 'OPEN',
    "lostReason" TEXT,
    "lostAt" DATETIME,
    "anonymizedAt" DATETIME,
    "repairTypeId" TEXT,
    "area" BIGINT,
    "rateSnapshot" BIGINT,
    "spreadSnapshot" INTEGER,
    "clientId" TEXT,
    "projectId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "leads_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "leads_repairTypeId_fkey" FOREIGN KEY ("repairTypeId") REFERENCES "repair_types" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leads_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lead_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueOn" DATETIME NOT NULL,
    "doneAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_tasks_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lead_tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "routeTemplate" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "objectCode" TEXT,
    "tab" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "viewportWidth" INTEGER,
    "screenshotKey" TEXT,
    "screenshotType" TEXT,
    "screenshotSize" INTEGER,
    "severityAuto" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "resolvedAt" DATETIME,
    CONSTRAINT "feedback_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "project_files" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    CONSTRAINT "project_files_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "project_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "document_templates_orgId_name_key" ON "document_templates"("orgId", "name");

-- CreateIndex
CREATE INDEX "document_clauses_templateId_order_idx" ON "document_clauses"("templateId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_blueprints_orgId_name_key" ON "estimate_blueprints"("orgId", "name");

-- CreateIndex
CREATE INDEX "blueprint_sections_blueprintId_order_idx" ON "blueprint_sections"("blueprintId", "order");

-- CreateIndex
CREATE INDEX "blueprint_items_blueprintId_order_idx" ON "blueprint_items"("blueprintId", "order");

-- CreateIndex
CREATE INDEX "blueprint_items_sectionId_order_idx" ON "blueprint_items"("sectionId", "order");

-- CreateIndex
CREATE INDEX "users_orgId_role_idx" ON "users"("orgId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_orgId_email_key" ON "users"("orgId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_orgId_code_key" ON "clients"("orgId", "code");

-- CreateIndex
CREATE INDEX "projects_orgId_status_idx" ON "projects"("orgId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "projects_orgId_code_key" ON "projects"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "units_orgId_code_key" ON "units"("orgId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_projectId_version_key" ON "estimates"("projectId", "version");

-- CreateIndex
CREATE INDEX "estimate_sections_estimateId_order_idx" ON "estimate_sections"("estimateId", "order");

-- CreateIndex
CREATE INDEX "estimate_items_estimateId_order_idx" ON "estimate_items"("estimateId", "order");

-- CreateIndex
CREATE INDEX "estimate_items_sectionId_order_idx" ON "estimate_items"("sectionId", "order");

-- CreateIndex
CREATE INDEX "estimate_items_roomId_idx" ON "estimate_items"("roomId");

-- CreateIndex
CREATE INDEX "other_expenses_estimateId_order_idx" ON "other_expenses"("estimateId", "order");

-- CreateIndex
CREATE INDEX "estimate_imports_estimateId_importedAt_idx" ON "estimate_imports"("estimateId", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "workers_orgId_name_key" ON "workers"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_purpose_idx" ON "auth_tokens"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "audit_log_orgId_entity_entityId_idx" ON "audit_log"("orgId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_orgId_at_idx" ON "audit_log"("orgId", "at");

-- CreateIndex
CREATE INDEX "measure_rooms_projectId_set_order_idx" ON "measure_rooms"("projectId", "set", "order");

-- CreateIndex
CREATE UNIQUE INDEX "measure_rooms_projectId_set_name_key" ON "measure_rooms"("projectId", "set", "name");

-- CreateIndex
CREATE UNIQUE INDEX "measure_openings_roomId_kind_key" ON "measure_openings"("roomId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "measure_plans_storageKey_key" ON "measure_plans"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "measure_plans_projectId_set_key" ON "measure_plans"("projectId", "set");

-- CreateIndex
CREATE INDEX "work_stages_projectId_startsOn_idx" ON "work_stages"("projectId", "startsOn");

-- CreateIndex
CREATE UNIQUE INDEX "work_stages_projectId_name_key" ON "work_stages"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "work_stages_sectionId_key" ON "work_stages"("sectionId");

-- CreateIndex
CREATE INDEX "acceptance_batches_projectId_createdAt_idx" ON "acceptance_batches"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "acceptance_batches_trancheId_idx" ON "acceptance_batches"("trancheId");

-- CreateIndex
CREATE UNIQUE INDEX "acceptances_reversesId_key" ON "acceptances"("reversesId");

-- CreateIndex
CREATE INDEX "acceptances_itemId_idx" ON "acceptances"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "wage_accruals_acceptanceId_key" ON "wage_accruals"("acceptanceId");

-- CreateIndex
CREATE INDEX "wage_accruals_brigadeId_createdAt_idx" ON "wage_accruals"("brigadeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "acceptance_photos_storageKey_key" ON "acceptance_photos"("storageKey");

-- CreateIndex
CREATE INDEX "acceptance_photos_batchId_idx" ON "acceptance_photos"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "material_expenses_storageKey_key" ON "material_expenses"("storageKey");

-- CreateIndex
CREATE INDEX "material_expenses_projectId_spentAt_idx" ON "material_expenses"("projectId", "spentAt");

-- CreateIndex
CREATE INDEX "tranches_projectId_status_idx" ON "tranches"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tranches_projectId_number_key" ON "tranches"("projectId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "tranche_payments_reversalOfId_key" ON "tranche_payments"("reversalOfId");

-- CreateIndex
CREATE INDEX "tranche_payments_trancheId_paidOn_idx" ON "tranche_payments"("trancheId", "paidOn");

-- CreateIndex
CREATE UNIQUE INDEX "repair_types_orgId_name_key" ON "repair_types"("orgId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "leads_projectId_key" ON "leads"("projectId");

-- CreateIndex
CREATE INDEX "leads_orgId_stage_idx" ON "leads"("orgId", "stage");

-- CreateIndex
CREATE INDEX "leads_outcome_anonymizedAt_lostAt_idx" ON "leads"("outcome", "anonymizedAt", "lostAt");

-- CreateIndex
CREATE UNIQUE INDEX "leads_orgId_number_key" ON "leads"("orgId", "number");

-- CreateIndex
CREATE INDEX "lead_tasks_leadId_idx" ON "lead_tasks"("leadId");

-- CreateIndex
CREATE INDEX "feedback_orgId_status_createdAt_idx" ON "feedback"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "feedback_orgId_createdAt_idx" ON "feedback"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "project_files_key_key" ON "project_files"("key");

-- CreateIndex
CREATE INDEX "project_files_projectId_uploadedAt_idx" ON "project_files"("projectId", "uploadedAt");
