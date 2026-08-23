import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { listCategories, listWarehouses } from '@/lib/services/catalogue';
import { listVendors } from '@/lib/services/vendors';
import { t } from '@/lib/i18n';
import { ProductForm } from '../product-form';

export const metadata: Metadata = { title: 'New product — GTS' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  await requirePermission('products.create');

  const [categories, vendors, warehouses, dict] = await Promise.all([
    listCategories(),
    listVendors(),
    listWarehouses(),
    t(),
  ]);
  const d = dict.catalogue.products;

  return (
    <Shell active="/products" domain="inventory">
      <main className="gts-page">
        <PageHead
          overline={d.new.overline}
          title={d.new.title}
          lede={d.new.lede}
        />
        <ProductForm
          mode="create"
          dict={d.form}
          categories={categories.map((c) => ({ id: c.id, nameEn: c.nameEn }))}
          vendors={vendors.map((v) => ({ id: v.id, nameEn: v.nameEn, code: v.code }))}
          warehouses={warehouses.map((w) => ({ id: w.id, nameEn: w.nameEn, code: w.code }))}
        />
      </main>
    </Shell>
  );
}
