-- GTS — integrity constraints Prisma cannot express in the schema DSL.
--
-- These are the invariants that must hold even if application code has a
-- bug. Postgres is the last line of defence: an ISSUE that would drive a
-- warehouse negative, a payment for a negative amount, or a bill assigned
-- to neither a client nor a vendor must be rejected by the database
-- itself, not merely by the service that happens to be calling today.

/* ---------- Inventory: stock can never go negative ---------- */

ALTER TABLE "warehouse_stock"
  ADD CONSTRAINT "warehouse_stock_quantity_non_negative"
  CHECK ("quantity" >= 0);

ALTER TABLE "warehouse_stock"
  ADD CONSTRAINT "warehouse_stock_reserved_non_negative"
  CHECK ("reserved" >= 0);

-- Reserved stock is a subset of stock physically on hand. Committing
-- more to projects than exists in the building is not a business state.
ALTER TABLE "warehouse_stock"
  ADD CONSTRAINT "warehouse_stock_reserved_within_quantity"
  CHECK ("reserved" <= "quantity");

-- A ledger row of zero units is not a movement; it is noise that would
-- pollute every product statement.
ALTER TABLE "inventory_transactions"
  ADD CONSTRAINT "inventory_tx_quantity_non_zero"
  CHECK ("quantity" <> 0);

-- The running balance written on a ledger row is what the warehouse held
-- after that row. It cannot be negative, because the transaction that
-- wrote it should have been refused.
ALTER TABLE "inventory_transactions"
  ADD CONSTRAINT "inventory_tx_balance_non_negative"
  CHECK ("balanceAfter" >= 0);

-- A transfer moves stock between two DIFFERENT warehouses, and only a
-- transfer has a destination at all.
ALTER TABLE "inventory_transactions"
  ADD CONSTRAINT "inventory_tx_transfer_shape"
  CHECK (
    ("type" = 'TRANSFER' AND "destinationWarehouseId" IS NOT NULL
       AND "destinationWarehouseId" <> "warehouseId")
    OR
    ("type" <> 'TRANSFER' AND "destinationWarehouseId" IS NULL)
  );

-- Directional sanity: receiving adds, issuing and damaging remove.
-- ADJUSTMENT is deliberately unconstrained — correcting a stock count
-- is exactly the operation that may go either way.
ALTER TABLE "inventory_transactions"
  ADD CONSTRAINT "inventory_tx_direction"
  CHECK (
    ("type" IN ('RECEIVE', 'RETURN') AND "quantity" > 0)
    OR ("type" IN ('ISSUE', 'DAMAGE', 'PROJECT_ALLOCATION') AND "quantity" < 0)
    OR ("type" IN ('TRANSFER', 'ADJUSTMENT'))
  );

/* ---------- Project products: quantities are cumulative counts ---------- */

ALTER TABLE "project_products"
  ADD CONSTRAINT "project_products_non_negative"
  CHECK (
    "allocated" >= 0 AND "delivered" >= 0
    AND "returned" >= 0 AND "damaged" >= 0
  );

-- You cannot return or damage more than was ever delivered to the site.
-- This is the constraint that makes `remaining` meaningful.
ALTER TABLE "project_products"
  ADD CONSTRAINT "project_products_returns_within_delivered"
  CHECK ("returned" + "damaged" <= "delivered");

-- Nor deliver more than was allocated from the warehouse.
ALTER TABLE "project_products"
  ADD CONSTRAINT "project_products_delivered_within_allocated"
  CHECK ("delivered" <= "allocated");

/* ---------- Billing ---------- */

-- A bill is raised against exactly one counterparty. Both, or neither,
-- makes the receivable/payable ledgers meaningless.
ALTER TABLE "electronic_bills"
  ADD CONSTRAINT "bill_exactly_one_counterparty"
  CHECK (
    ("clientId" IS NOT NULL AND "vendorId" IS NULL)
    OR ("clientId" IS NULL AND "vendorId" IS NOT NULL)
  );

-- Receivables are issued to clients; payables arrive from vendors.
ALTER TABLE "electronic_bills"
  ADD CONSTRAINT "bill_direction_matches_counterparty"
  CHECK (
    ("direction" = 'RECEIVABLE' AND "clientId" IS NOT NULL)
    OR ("direction" = 'PAYABLE' AND "vendorId" IS NOT NULL)
  );

ALTER TABLE "electronic_bills"
  ADD CONSTRAINT "bill_due_not_before_issue"
  CHECK ("dueOn" >= "issuedOn");

ALTER TABLE "electronic_bills"
  ADD CONSTRAINT "bill_amounts_non_negative"
  CHECK (
    "subtotal" >= 0 AND "discount" >= 0 AND "net" >= 0
    AND "vatAmount" >= 0 AND "total" >= 0
    AND "whtAmount" >= 0 AND "paidAmount" >= 0
  );

-- A non-EGP document needs an exchange rate; the ETA requires it and
-- every EGP-denominated report depends on it.
ALTER TABLE "electronic_bills"
  ADD CONSTRAINT "bill_fx_rate_when_foreign"
  CHECK ("currency" = 'EGP' OR "exchangeRate" IS NOT NULL);

ALTER TABLE "bill_items"
  ADD CONSTRAINT "bill_item_quantity_positive"
  CHECK ("quantity" > 0);

ALTER TABLE "bill_items"
  ADD CONSTRAINT "bill_item_amounts_non_negative"
  CHECK ("unitPrice" >= 0 AND "discount" >= 0 AND "vatRate" >= 0);

-- A line discount cannot exceed the line itself.
ALTER TABLE "bill_items"
  ADD CONSTRAINT "bill_item_discount_within_line"
  CHECK ("discount" <= "quantity" * "unitPrice");

/* ---------- Payments ---------- */

ALTER TABLE "payments"
  ADD CONSTRAINT "payment_amount_positive"
  CHECK ("amount" > 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payment_wht_non_negative"
  CHECK ("whtDeducted" >= 0);

ALTER TABLE "payments"
  ADD CONSTRAINT "payment_exactly_one_counterparty"
  CHECK (
    ("clientId" IS NOT NULL AND "vendorId" IS NULL)
    OR ("clientId" IS NULL AND "vendorId" IS NOT NULL)
  );

/* ---------- Attendance: the geofence record ---------- */

-- Coordinates must be on Earth. A swapped lat/lng pair or a null-island
-- default is caught here rather than becoming a plausible-looking
-- distance in a report.
ALTER TABLE "attendance"
  ADD CONSTRAINT "attendance_coords_valid"
  CHECK (
    "checkInLat" BETWEEN -90 AND 90
    AND "checkInLng" BETWEEN -180 AND 180
    AND ("checkOutLat" IS NULL OR "checkOutLat" BETWEEN -90 AND 90)
    AND ("checkOutLng" IS NULL OR "checkOutLng" BETWEEN -180 AND 180)
  );

ALTER TABLE "attendance"
  ADD CONSTRAINT "attendance_distance_non_negative"
  CHECK ("distanceMetres" >= 0 AND "radiusAtCheckIn" > 0);

-- Nobody leaves before they arrive.
ALTER TABLE "attendance"
  ADD CONSTRAINT "attendance_checkout_after_checkin"
  CHECK ("checkOutAt" IS NULL OR "checkOutAt" >= "checkInAt");

ALTER TABLE "attendance"
  ADD CONSTRAINT "attendance_minutes_non_negative"
  CHECK ("minutesLate" >= 0 AND ("workedMinutes" IS NULL OR "workedMinutes" >= 0));

/* ---------- Project location: a fence with a real radius ---------- */

ALTER TABLE "project_locations"
  ADD CONSTRAINT "project_location_coords_valid"
  CHECK ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180);

-- A fence smaller than consumer GPS error locks out honest staff; one
-- larger than 5km is not a site boundary in any meaningful sense.
ALTER TABLE "project_locations"
  ADD CONSTRAINT "project_location_radius_sane"
  CHECK ("radiusMetres" BETWEEN 25 AND 5000);

/* ---------- Leave ---------- */

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_end_not_before_start"
  CHECK ("endsOn" >= "startsOn");

ALTER TABLE "leave_requests"
  ADD CONSTRAINT "leave_working_days_positive"
  CHECK ("workingDays" > 0);

ALTER TABLE "leave_balances"
  ADD CONSTRAINT "leave_balance_non_negative"
  CHECK ("entitled" >= 0 AND "taken" >= 0 AND "pending" >= 0);

/* ---------- Projects ---------- */

ALTER TABLE "projects"
  ADD CONSTRAINT "project_end_not_before_start"
  CHECK ("endsOn" IS NULL OR "startsOn" IS NULL OR "endsOn" >= "startsOn");

/* ---------- Employees ---------- */

ALTER TABLE "employees"
  ADD CONSTRAINT "employee_end_not_before_hire"
  CHECK ("endedOn" IS NULL OR "endedOn" >= "hiredOn");

/* ---------- Partial unique indexes ----------
   A soft-deleted record must not block a new one from reusing its
   natural key, but two LIVE records may never share one. Prisma's
   @unique cannot express "unique among the undeleted", so the plain
   unique indexes are replaced with partial ones here. */

DROP INDEX IF EXISTS "clients_code_key";
CREATE UNIQUE INDEX "clients_code_live_key"
  ON "clients" ("code") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "clients_trn_key";
CREATE UNIQUE INDEX "clients_trn_live_key"
  ON "clients" ("trn") WHERE "deletedAt" IS NULL AND "trn" IS NOT NULL;

DROP INDEX IF EXISTS "vendors_code_key";
CREATE UNIQUE INDEX "vendors_code_live_key"
  ON "vendors" ("code") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "vendors_trn_key";
CREATE UNIQUE INDEX "vendors_trn_live_key"
  ON "vendors" ("trn") WHERE "deletedAt" IS NULL AND "trn" IS NOT NULL;

DROP INDEX IF EXISTS "products_sku_key";
CREATE UNIQUE INDEX "products_sku_live_key"
  ON "products" ("sku") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "projects_code_key";
CREATE UNIQUE INDEX "projects_code_live_key"
  ON "projects" ("code") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "warehouses_code_key";
CREATE UNIQUE INDEX "warehouses_code_live_key"
  ON "warehouses" ("code") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "employees_code_key";
CREATE UNIQUE INDEX "employees_code_live_key"
  ON "employees" ("code") WHERE "deletedAt" IS NULL;

DROP INDEX IF EXISTS "users_email_key";
CREATE UNIQUE INDEX "users_email_live_key"
  ON "users" ("email") WHERE "deletedAt" IS NULL;

/* ---------- Reporting indexes ----------
   Written against the queries the account summaries actually run:
   "outstanding receivables by client", "overdue bills", "today's
   attendance for a project". */

CREATE INDEX "bills_outstanding_idx"
  ON "electronic_bills" ("direction", "status", "dueOn")
  WHERE "deletedAt" IS NULL AND "status" NOT IN ('PAID', 'CANCELLED', 'DRAFT');

CREATE INDEX "inventory_tx_product_warehouse_time_idx"
  ON "inventory_transactions" ("productId", "warehouseId", "occurredAt" DESC);

CREATE INDEX "notifications_unread_idx"
  ON "notifications" ("userId", "createdAt" DESC)
  WHERE "readAt" IS NULL;

CREATE INDEX "sessions_live_idx"
  ON "sessions" ("tokenHash", "expiresAt");
