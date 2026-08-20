import type { Metadata } from 'next';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { listCategories } from '@/lib/services/catalogue';
import { listVendors } from '@/lib/services/vendors';
import { ProductForm } from '../product-form';

export const metadata: Metadata = { title: 'New product — GTS' };
export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  await requirePermission('products.create');

  const [categories, vendors] = await Promise.all([listCategories(), listVendors()]);

  return (
    <Shell active="/products" domain="inventory">
      <main className="gts-page">
        <PageHead
          overline="Operations"
          title="New product"
          lede="A product is a line in the catalogue, not stock on a shelf. Quantities arrive by receiving it into a warehouse."
        />
        <ProductForm
          mode="create"
          categories={categories.map((c) => ({ id: c.id, nameEn: c.nameEn }))}
          vendors={vendors.map((v) => ({ id: v.id, nameEn: v.nameEn, code: v.code }))}
        />
      </main>
    </Shell>
  );
}
