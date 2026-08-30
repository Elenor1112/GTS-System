-- DropIndex
DROP INDEX "inventory_tx_product_warehouse_time_idx";

-- DropIndex
DROP INDEX "sessions_live_idx";

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "field" TEXT;

-- RenameIndex
ALTER INDEX "clients_code_live_key" RENAME TO "clients_code_key";

-- RenameIndex
ALTER INDEX "clients_trn_live_key" RENAME TO "clients_trn_key";

-- RenameIndex
ALTER INDEX "employees_code_live_key" RENAME TO "employees_code_key";

-- RenameIndex
ALTER INDEX "products_sku_live_key" RENAME TO "products_sku_key";

-- RenameIndex
ALTER INDEX "projects_code_live_key" RENAME TO "projects_code_key";

-- RenameIndex
ALTER INDEX "users_email_live_key" RENAME TO "users_email_key";

-- RenameIndex
ALTER INDEX "vendors_code_live_key" RENAME TO "vendors_code_key";

-- RenameIndex
ALTER INDEX "vendors_trn_live_key" RENAME TO "vendors_trn_key";

-- RenameIndex
ALTER INDEX "warehouses_code_live_key" RENAME TO "warehouses_code_key";
