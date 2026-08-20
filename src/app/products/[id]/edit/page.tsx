import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { Shell, PageHead } from '@/components/shell';
import { requirePermission } from '@/lib/auth';
import { productDetail, listCategories } from '@/lib/services/catalogue';
import { listVendors } from '@/lib/services/vendors';
import { ProductForm } from '../../product-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit product — GTS' };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('products.edit');
  const { id } = await params;

  const [product, categories, vendors] = await Promise.all([
    productDetail(id),
    listCategories(),
    listVendors(),
  ]);
  if (!product) notFound();

  return (
    <Shell active="/products" domain="inventory">
      <main className="gts-page">
        <PageHead
          overline={`Product · ${product.sku}`}
          title="Edit product"
          lede="Changing a price here affects future bills only. Lines already drafted keep the price they were written at."
        />
        <ProductForm
          mode="edit"
          categories={categories.map((c) => ({ id: c.id, nameEn: c.nameEn }))}
          vendors={vendors.map((v) => ({ id: v.id, nameEn: v.nameEn, code: v.code }))}
          values={{
            id: product.id,
            sku: product.sku,
            nameEn: product.nameEn,
            nameAr: product.nameAr,
            categoryId: product.categoryId,
            vendorId: product.vendorId,
            brand: product.brand,
            unit: product.unit,
            gpcCode: product.gpcCode,
            // Decimal → string, not → number: routing a price through a
            // JS float is how 10.10 becomes 10.099999999999999.
            costPrice: product.costPrice.toString(),
            salePrice: product.salePrice.toString(),
            vatRate: product.vatRate.toString(),
            reorderLevel: product.reorderLevel?.toString() ?? '0',
          }}
        />
      </main>
    </Shell>
  );
}
