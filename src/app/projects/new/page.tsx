import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { db } from '@/lib/db';
import { listClients } from '@/lib/services/clients';
import { t } from '@/lib/i18n';
import { ProjectForm } from '../project-form';
import type { StockOption } from '../[id]/materials-form';

export const metadata: Metadata = { title: 'New project — GTS' };
export const dynamic = 'force-dynamic';

export default async function NewProjectPage() {
  const actor = await requirePermission('projects.create');

  const canSetLocation = can(actor, 'projects.location');
  const canAssign = can(actor, 'projects.assign');
  const canMoveStock = can(actor, 'inventory.manage');

  const [clients, dict, employees, stockRows] = await Promise.all([
    listClients(),
    t(),
    canAssign
      ? db.employee.findMany({
          where: { deletedAt: null, isActive: true },
          select: { id: true, code: true, nameEn: true, jobTitleEn: true },
          orderBy: { nameEn: 'asc' },
        })
      : [],
    canMoveStock
      ? db.warehouseStock.findMany({
          where: {
            quantity: { gt: 0 },
            warehouse: { deletedAt: null, isActive: true },
            product: { deletedAt: null, isActive: true },
          },
          select: {
            quantity: true,
            reserved: true,
            warehouse: { select: { id: true, code: true, nameEn: true } },
            product: { select: { id: true, sku: true, nameEn: true, unit: true, salePrice: true } },
          },
        })
      : [],
  ]);
  const d = dict.operations.projects.newPage;

  // Same flattening the project detail page does: one entry per product,
  // carrying only the warehouses that actually hold it and have units free.
  const stockByProduct = new Map<string, StockOption>();
  for (const row of stockRows) {
    const available = row.quantity.minus(row.reserved);
    if (available.lessThanOrEqualTo(0)) continue;

    let entry = stockByProduct.get(row.product.id);
    if (!entry) {
      entry = {
        id: row.product.id,
        sku: row.product.sku,
        nameEn: row.product.nameEn,
        unit: row.product.unit,
        salePrice: row.product.salePrice.toString(),
        warehouses: [],
      };
      stockByProduct.set(row.product.id, entry);
    }
    entry.warehouses.push({
      id: row.warehouse.id,
      code: row.warehouse.code,
      nameEn: row.warehouse.nameEn,
      available: available.toString(),
    });
  }
  const stockOptions = [...stockByProduct.values()].sort((a, b) => a.nameEn.localeCompare(b.nameEn));

  return (
    <Shell active="/projects" domain="projects">
      <main className="max-w-7xl mx-auto px-4 md:px-8 space-y-6">
        <PageHead
          overline={d.overline}
          title={d.title}
          lede={d.lede}
        />
        <div className="bg-surface rounded-lg border border-line shadow-raised p-6">
          <ProjectForm
            mode="create"
            clients={clients.map((c) => ({ id: c.id, code: c.code, nameEn: c.nameEn }))}
            dict={dict.operations.projects.form}
            canSetLocation={canSetLocation}
            locationDict={dict.operations.projects.location}
            canAssign={canAssign}
            employees={employees}
            assignDict={dict.operations.projects.assign}
            canMoveStock={canMoveStock}
            products={stockOptions}
            materialsDict={dict.operations.projects.materials}
          />
        </div>
      </main>
    </Shell>
  );
}
