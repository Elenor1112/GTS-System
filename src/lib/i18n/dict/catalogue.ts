/**
 * Catalogue: products, storage (warehouses) and vendors.
 *
 * Covers `src/app/products/`, `src/app/storage/` and `src/app/vendors/` —
 * the inventory and supply side of the system. `txLabel` is shared by all
 * three modules' ledger tables (product page, warehouse page, and both
 * their print sheets), which all label the same `InventoryTransaction`
 * `type` enum identically.
 */
export interface CatalogueDict {
  catalogue: {
    txLabel: {
      RECEIVE: string;
      ISSUE: string;
      TRANSFER: string;
      RETURN: string;
      DAMAGE: string;
      ADJUSTMENT: string;
      PROJECT_ALLOCATION: string;
    };
    products: {
      list: {
        overline: string;
        title: string;
        countOne: string;
        countOther: string;
        lowSuffix: string;
        newProduct: string;
        searchLabel: string;
        searchPlaceholder: string;
        categoryLabel: string;
        anyCategory: string;
        warehouseLabel: string;
        anyWarehouse: string;
        onlyLowStock: string;
        filter: string;
        clear: string;
        caption: string;
        colProduct: string;
        colCategory: string;
        colVendor: string;
        colCost: string;
        colSale: string;
        colOnHand: string;
        colFree: string;
        marginSuffix: string;
        reorderAtPrefix: string;
        reservedSuffix: string;
        emptyLowTitle: string;
        emptyLowBody: string;
        emptyFilteredTitle: string;
        emptyFilteredBody: string;
        emptyTitle: string;
        emptyBody: string;
      };
      form: {
        skuLabel: string;
        skuHint: string;
        nameEnLabel: string;
        nameArLabel: string;
        unitLabel: string;
        unitHint: string;
        categoryLabel: string;
        uncategorised: string;
        vendorLabel: string;
        noneOption: string;
        brandLabel: string;
        gpcCodeLabel: string;
        gpcCodeHint: string;
        costPriceLabel: string;
        costPriceHint: string;
        salePriceLabel: string;
        salePriceHint: string;
        vatRateLabel: string;
        vatRateHint: string;
        reorderLevelLabel: string;
        reorderLevelHint: string;
        warehouseLabel: string;
        warehouseHint: string;
        warehousePlaceholder: string;
        openingQuantityLabel: string;
        openingQuantityHint: string;
        binLocationLabel: string;
        binLocationHint: string;
        cancel: string;
        createProduct: string;
        saveChanges: string;
      };
      new: {
        overline: string;
        title: string;
        lede: string;
      };
      edit: {
        title: string;
        lede: string;
      };
      detail: {
        counted: string;
        edit: string;
        print: string;
        onHand: string;
        low: string;
        reserved: string;
        reorderLevel: string;
        costPrice: string;
        salePrice: string;
        valueAtCost: string;
        vat: string;
        preferredVendor: string;
        stockByWarehouse: string;
        colWarehouse: string;
        colBin: string;
        colQuantity: string;
        colReserved: string;
        colAvailable: string;
        emptyStockTitle: string;
        emptyStockBody: string;
        onProjects: string;
        colProject: string;
        colAllocated: string;
        colDelivered: string;
        colReturned: string;
        colDamaged: string;
        movementHistory: string;
        colDate: string;
        colReference: string;
        colType: string;
        colBalanceAfter: string;
        colBy: string;
        emptyMovementsTitle: string;
        emptyMovementsBody: string;
      };
      print: {
        backToProduct: string;
        sheetOverline: string;
        stockByWarehouse: string;
        noStock: string;
        colWarehouse: string;
        colBin: string;
        colQuantity: string;
        colReserved: string;
        movementHistory: string;
        noMovements: string;
        colDate: string;
        colRef: string;
        colType: string;
        colWarehouse2: string;
        colQty: string;
        colBalance: string;
        producedBy: string;
      };
    };
    warehouses: {
      list: {
        overline: string;
        title: string;
        countOne: string;
        countOther: string;
        unitsSuffix: string;
        newWarehouse: string;
        noAddress: string;
        colProducts: string;
        colUnits: string;
        reservedForProjects: string;
        openInMaps: string;
        emptyTitle: string;
        emptyBody: string;
      };
      form: {
        codeLabel: string;
        codeHint: string;
        nameEnLabel: string;
        nameArLabel: string;
        governorateLabel: string;
        notRecorded: string;
        addressLabel: string;
        capacityLabel: string;
        capacityHint: string;
        latitudeLabel: string;
        latitudeHint: string;
        longitudeLabel: string;
        cancel: string;
        createWarehouse: string;
        saveChanges: string;
      };
      new: {
        overline: string;
        title: string;
        lede: string;
      };
      edit: {
        title: string;
        lede: string;
      };
      detail: {
        noAddress: string;
        openInMaps: string;
        edit: string;
        print: string;
        inactiveNotice: string;
        products: string;
        unitsOnHand: string;
        reserved: string;
        valueAtCost: string;
        capacity: string;
        stockOnHand: string;
        colSku: string;
        colProduct: string;
        colBin: string;
        colQuantity: string;
        colReserved: string;
        colAvailable: string;
        colValueAtCost: string;
        low: string;
        emptyStockTitle: string;
        emptyStockBody: string;
        recentMovements: string;
        colDate: string;
        colReference: string;
        colType: string;
        colProduct2: string;
        colBalanceAfter: string;
        colBy: string;
        emptyMovementsTitle: string;
        emptyMovementsBody: string;
      };
      print: {
        backToWarehouse: string;
        sheetOverline: string;
        stockOnFloor: string;
        nothingStocked: string;
        colProduct: string;
        colBin: string;
        colQuantity: string;
        colReserved: string;
        colValueAtCost: string;
        recentMovements: string;
        noMovements: string;
        colDate: string;
        colRef: string;
        colType: string;
        colProduct2: string;
        colQty: string;
        producedBy: string;
      };
    };
    vendors: {
      list: {
        overline: string;
        title: string;
        countOne: string;
        countOther: string;
        payableSuffix: string;
        newVendor: string;
        searchLabel: string;
        searchPlaceholder: string;
        fieldLabel: string;
        allFields: string;
        governorateLabel: string;
        allGovernorates: string;
        includeArchived: string;
        search: string;
        clear: string;
        caption: string;
        colVendor: string;
        colTaxNumber: string;
        colGovernorate: string;
        colField: string;
        colProducts: string;
        colPayable: string;
        colOverdue: string;
        archivedSuffix: string;
        total: string;
        emptySearchTitle: string;
        emptySearchBody: string;
        emptyTitle: string;
        emptyBody: string;
      };
      form: {
        codeLabel: string;
        codeHint: string;
        nameEnLabel: string;
        nameArLabel: string;
        trnLabel: string;
        trnHint: string;
        commercialRegLabel: string;
        commercialRegHint: string;
        governorateLabel: string;
        governoratePlaceholder: string;
        fieldLabel: string;
        fieldPlaceholder: string;
        fieldOtherPlaceholder: string;
        addressLabel: string;
        contactNameLabel: string;
        contactPhoneLabel: string;
        contactEmailLabel: string;
        paymentTermsLabel: string;
        paymentTermsHint: string;
        notesLabel: string;
        creating: string;
        saving: string;
        createVendor: string;
        saveChanges: string;
        cancel: string;
      };
      new: {
        overline: string;
        title: string;
        lede: string;
      };
      edit: {
        editPrefix: string;
      };
      detail: {
        recordBill: string;
        edit: string;
        printStatement: string;
        account: string;
        billedByThem: string;
        paid: string;
        payable: string;
        overdue: string;
        paymentTerms: string;
        daysSuffix: string;
        supplied: string;
        colProduct: string;
        colReceived: string;
        colReturned: string;
        colNet: string;
        catalogue: string;
        colCost: string;
        colSale: string;
        colOnHand: string;
        colReorderAt: string;
        bills: string;
        emptyBillsTitle: string;
        emptyBillsBody: string;
        colNumber: string;
        colIssued: string;
        colDue: string;
        colStatus: string;
        colTotal: string;
        colOutstanding: string;
        daysLateSuffix: string;
        settled: string;
        activity: string;
        emptyActivityTitle: string;
        emptyActivityBody: string;
      };
      print: {
        backToVendor: string;
        statementOverline: string;
        billedToDate: string;
        paid: string;
        outstanding: string;
        overdue: string;
        openBills: string;
        nothingOutstanding: string;
        colBill: string;
        colIssued: string;
        colDue: string;
        colTotal: string;
        colOutstanding: string;
        colOverdue: string;
        producedBy: string;
      };
    };
  };
}

export const en: CatalogueDict = {
  catalogue: {
    txLabel: {
      RECEIVE: 'Received',
      ISSUE: 'Issued',
      TRANSFER: 'Transfer',
      RETURN: 'Returned',
      DAMAGE: 'Damaged',
      ADJUSTMENT: 'Adjustment',
      PROJECT_ALLOCATION: 'Allocated',
    },
    products: {
      list: {
        overline: 'Catalogue',
        title: 'Products',
        countOne: 'product',
        countOther: 'products',
        lowSuffix: 'at or below the reorder level',
        newProduct: 'New product',
        searchLabel: 'Search products',
        searchPlaceholder: 'Name, SKU or brand',
        categoryLabel: 'Category',
        anyCategory: 'Any category',
        warehouseLabel: 'Warehouse',
        anyWarehouse: 'Any warehouse',
        onlyLowStock: 'Only low stock',
        filter: 'Filter',
        clear: 'Clear',
        caption: 'The product catalogue with stock on hand',
        colProduct: 'Product',
        colCategory: 'Category',
        colVendor: 'Vendor',
        colCost: 'Cost',
        colSale: 'Sale',
        colOnHand: 'On hand',
        colFree: 'Free',
        marginSuffix: '% margin',
        reorderAtPrefix: 'reorder at',
        reservedSuffix: 'reserved',
        emptyLowTitle: 'Nothing is below its reorder level',
        emptyLowBody: 'Every product with a reorder level set is above it.',
        emptyFilteredTitle: 'No product matches',
        emptyFilteredBody: 'Try a different search, or clear the filter.',
        emptyTitle: 'No products yet',
        emptyBody:
          'A product is what you receive into a warehouse, allocate to a project and put on a bill.',
      },
      form: {
        skuLabel: 'SKU',
        skuHint: 'Assigned automatically. Change it here if you need a different code.',
        nameEnLabel: 'Name (English)',
        nameArLabel: 'Name (Arabic)',
        unitLabel: 'Unit',
        unitHint: 'How it is counted — each, m, kg, roll',
        categoryLabel: 'Category',
        uncategorised: 'Uncategorised',
        vendorLabel: 'Preferred vendor',
        noneOption: 'None',
        brandLabel: 'Brand',
        gpcCodeLabel: 'GPC code',
        gpcCodeHint: 'Egyptian e-invoicing item code, if the item has one',
        costPriceLabel: 'Cost price (EGP)',
        costPriceHint: 'What you pay. Drives stock valuation.',
        salePriceLabel: 'Sale price (EGP)',
        salePriceHint: 'What you charge. Used to price bill lines.',
        vatRateLabel: 'VAT rate (%)',
        vatRateHint: '14 is the Egyptian standard rate. Zero-rated and exempt goods take 0.',
        reorderLevelLabel: 'Reorder level',
        reorderLevelHint: 'Stock at or below this raises the low-stock flag.',
        warehouseLabel: 'Warehouse',
        warehouseHint: 'Where this product is stocked',
        warehousePlaceholder: 'Select a warehouse',
        openingQuantityLabel: 'Opening quantity',
        openingQuantityHint: 'Posts a receipt into the warehouse above. Leave blank to start at zero.',
        binLocationLabel: 'Bin location',
        binLocationHint: 'Shelf or bin, if the opening quantity is more than zero',
        cancel: 'Cancel',
        createProduct: 'Create product',
        saveChanges: 'Save changes',
      },
      new: {
        overline: 'Operations',
        title: 'New product',
        lede: 'A product is a line in the catalogue. Pick where it lives, and an opening quantity posts a receipt into that warehouse.',
      },
      edit: {
        title: 'Edit product',
        lede: 'Changing a price here affects future bills only. Lines already drafted keep the price they were written at.',
      },
      detail: {
        counted: 'Counted in',
        edit: 'Edit',
        print: 'Print',
        onHand: 'On hand',
        low: 'low',
        reserved: 'Reserved',
        reorderLevel: 'Reorder level',
        costPrice: 'Cost price',
        salePrice: 'Sale price',
        valueAtCost: 'Value at cost',
        vat: 'VAT',
        preferredVendor: 'Preferred vendor:',
        stockByWarehouse: 'Stock by warehouse',
        colWarehouse: 'Warehouse',
        colBin: 'Bin',
        colQuantity: 'Quantity',
        colReserved: 'Reserved',
        colAvailable: 'Available',
        emptyStockTitle: 'Not in stock anywhere',
        emptyStockBody:
          'This product exists in the catalogue but no units have been received into a warehouse.',
        onProjects: 'On projects',
        colProject: 'Project',
        colAllocated: 'Allocated',
        colDelivered: 'Delivered',
        colReturned: 'Returned',
        colDamaged: 'Damaged',
        movementHistory: 'Movement history',
        colDate: 'Date',
        colReference: 'Reference',
        colType: 'Type',
        colBalanceAfter: 'Balance after',
        colBy: 'By',
        emptyMovementsTitle: 'No movements',
        emptyMovementsBody: 'This product has never moved.',
      },
      print: {
        backToProduct: 'Back to the product',
        sheetOverline: 'Product sheet',
        stockByWarehouse: 'Stock by warehouse',
        noStock: 'No stock recorded.',
        colWarehouse: 'Warehouse',
        colBin: 'Bin',
        colQuantity: 'Quantity',
        colReserved: 'Reserved',
        movementHistory: 'Movement history',
        noMovements: 'No movements recorded.',
        colDate: 'Date',
        colRef: 'Ref',
        colType: 'Type',
        colWarehouse2: 'Warehouse',
        colQty: 'Qty',
        colBalance: 'Balance',
        producedBy: 'Produced by GTS on',
      },
    },
    warehouses: {
      list: {
        overline: 'Operations',
        title: 'Warehouses',
        countOne: 'warehouse',
        countOther: 'warehouses',
        unitsSuffix: 'units on hand',
        newWarehouse: 'New warehouse',
        noAddress: 'No address recorded',
        colProducts: 'Products',
        colUnits: 'Units',
        reservedForProjects: 'reserved for project allocations',
        openInMaps: 'Open in Google Maps',
        emptyTitle: 'No warehouses',
        emptyBody: 'A warehouse is where stock physically sits. Create one before receiving anything.',
      },
      form: {
        codeLabel: 'Warehouse code',
        codeHint: 'Assigned automatically. Change it here if you need a different reference.',
        nameEnLabel: 'Name (English)',
        nameArLabel: 'Name (Arabic)',
        governorateLabel: 'Governorate',
        notRecorded: 'Not recorded',
        addressLabel: 'Address',
        capacityLabel: 'Capacity (m³)',
        capacityHint: 'Nominal volume, used for the utilisation gauge. Leave blank if not measured.',
        latitudeLabel: 'Latitude',
        latitudeHint: 'Optional. Enables the map link and geofenced attendance.',
        longitudeLabel: 'Longitude',
        cancel: 'Cancel',
        createWarehouse: 'Create warehouse',
        saveChanges: 'Save changes',
      },
      new: {
        overline: 'Operations',
        title: 'New warehouse',
        lede: 'A warehouse is where stock physically sits. Nothing can be received until one exists, and every ledger row names the building it moved through.',
      },
      edit: {
        title: 'Edit warehouse',
        lede: 'Changing these details does not move any stock. Quantities are the ledger’s business.',
      },
      detail: {
        noAddress: 'No address recorded',
        openInMaps: 'Open in Google Maps',
        edit: 'Edit',
        print: 'Print',
        inactiveNotice: 'This warehouse is no longer in use.',
        products: 'Products',
        unitsOnHand: 'Units on hand',
        reserved: 'Reserved',
        valueAtCost: 'Value at cost',
        capacity: 'Capacity',
        stockOnHand: 'Stock on hand',
        colSku: 'SKU',
        colProduct: 'Product',
        colBin: 'Bin',
        colQuantity: 'Quantity',
        colReserved: 'Reserved',
        colAvailable: 'Available',
        colValueAtCost: 'Value at cost',
        low: 'low',
        emptyStockTitle: 'Nothing in stock',
        emptyStockBody:
          'No product has been received into this warehouse yet, or everything received has since been issued.',
        recentMovements: 'Recent movements',
        colDate: 'Date',
        colReference: 'Reference',
        colType: 'Type',
        colProduct2: 'Product',
        colBalanceAfter: 'Balance after',
        colBy: 'By',
        emptyMovementsTitle: 'No movements',
        emptyMovementsBody: 'Nothing has moved through this warehouse yet.',
      },
      print: {
        backToWarehouse: 'Back to the warehouse',
        sheetOverline: 'Warehouse sheet',
        stockOnFloor: 'Stock on the floor',
        nothingStocked: 'Nothing currently stocked.',
        colProduct: 'Product',
        colBin: 'Bin',
        colQuantity: 'Quantity',
        colReserved: 'Reserved',
        colValueAtCost: 'Value at cost',
        recentMovements: 'Recent movements',
        noMovements: 'No movements recorded.',
        colDate: 'Date',
        colRef: 'Ref',
        colType: 'Type',
        colProduct2: 'Product',
        colQty: 'Qty',
        producedBy: 'Produced by GTS on',
      },
    },
    vendors: {
      list: {
        overline: 'Supply',
        title: 'Vendors',
        countOne: 'vendor',
        countOther: 'vendors',
        payableSuffix: 'payable',
        newVendor: 'New vendor',
        searchLabel: 'Search vendors',
        searchPlaceholder: 'Name, code or tax number',
        fieldLabel: 'Field',
        allFields: 'All fields',
        governorateLabel: 'Governorate',
        allGovernorates: 'All governorates',
        includeArchived: 'Include archived',
        search: 'Search',
        clear: 'Clear',
        caption: 'Vendors and what is payable to each',
        colVendor: 'Vendor',
        colTaxNumber: 'Tax number',
        colGovernorate: 'Governorate',
        colField: 'Field',
        colProducts: 'Products',
        colPayable: 'Payable',
        colOverdue: 'Overdue',
        archivedSuffix: 'archived',
        total: 'Total',
        emptySearchTitle: 'No vendor matches that search',
        emptySearchBody: 'Try a shorter search, or clear the filter.',
        emptyTitle: 'No vendors yet',
        emptyBody: 'A vendor supplies the products you receive into your warehouses and bills you for them.',
      },
      form: {
        codeLabel: 'Vendor code',
        codeHint: 'Assigned automatically. Change it here if you need a different reference.',
        nameEnLabel: 'Name (English)',
        nameArLabel: 'Name (Arabic)',
        trnLabel: 'Tax registration number',
        trnHint: '9 digits, issued by the Egyptian Tax Authority',
        commercialRegLabel: 'Commercial register',
        commercialRegHint: 'Issued by GAFI',
        governorateLabel: 'Governorate',
        governoratePlaceholder: 'Select a governorate',
        fieldLabel: 'Field',
        fieldPlaceholder: 'Select a field',
        fieldOtherPlaceholder: 'Describe their field',
        addressLabel: 'Address',
        contactNameLabel: 'Contact name',
        contactPhoneLabel: 'Contact phone',
        contactEmailLabel: 'Contact email',
        paymentTermsLabel: 'Payment terms (days)',
        paymentTermsHint: 'Applied to the due date when a bill is raised',
        notesLabel: 'Notes',
        creating: 'Creating…',
        saving: 'Saving…',
        createVendor: 'Create vendor',
        saveChanges: 'Save changes',
        cancel: 'Cancel',
      },
      new: {
        overline: 'Relationships',
        title: 'New vendor',
        lede: 'A vendor supplies the products you receive into your warehouses. Their tax registration number is what makes the bills they send you deductible.',
      },
      edit: {
        editPrefix: 'Edit',
      },
      detail: {
        recordBill: 'Record a bill',
        edit: 'Edit',
        printStatement: 'Print statement',
        account: 'Account',
        billedByThem: 'Billed by them',
        paid: 'Paid',
        payable: 'Payable',
        overdue: 'Overdue',
        paymentTerms: 'Payment terms',
        daysSuffix: 'days',
        supplied: 'Supplied',
        colProduct: 'Product',
        colReceived: 'Received',
        colReturned: 'Returned',
        colNet: 'Net',
        catalogue: 'Catalogue',
        colCost: 'Cost',
        colSale: 'Sale',
        colOnHand: 'On hand',
        colReorderAt: 'Reorder at',
        bills: 'Bills',
        emptyBillsTitle: 'No bills',
        emptyBillsBody: 'Nothing has been billed by this vendor yet.',
        colNumber: 'Number',
        colIssued: 'Issued',
        colDue: 'Due',
        colStatus: 'Status',
        colTotal: 'Total',
        colOutstanding: 'Outstanding',
        daysLateSuffix: 'days late',
        settled: 'settled',
        activity: 'Activity',
        emptyActivityTitle: 'Nothing has happened yet',
        emptyActivityBody: 'Receipts, bills and payments appear here as they occur.',
      },
      print: {
        backToVendor: 'Back to the vendor',
        statementOverline: 'Account statement · as of',
        billedToDate: 'Billed to date',
        paid: 'Paid',
        outstanding: 'Outstanding',
        overdue: 'Overdue',
        openBills: 'Open bills',
        nothingOutstanding: 'Nothing outstanding.',
        colBill: 'Bill',
        colIssued: 'Issued',
        colDue: 'Due',
        colTotal: 'Total',
        colOutstanding: 'Outstanding',
        colOverdue: 'Overdue',
        producedBy: 'Produced by',
      },
    },
  },
};

export const ar: CatalogueDict = {
  catalogue: {
    txLabel: {
      RECEIVE: 'استلام',
      ISSUE: 'صرف',
      TRANSFER: 'تحويل',
      RETURN: 'مرتجع',
      DAMAGE: 'تالف',
      ADJUSTMENT: 'تسوية',
      PROJECT_ALLOCATION: 'تخصيص',
    },
    products: {
      list: {
        overline: 'الكتالوج',
        title: 'المنتجات',
        countOne: 'منتج',
        countOther: 'منتجات',
        lowSuffix: 'عند أو أقل من حد إعادة الطلب',
        newProduct: 'منتج جديد',
        searchLabel: 'بحث في المنتجات',
        searchPlaceholder: 'الاسم أو رمز الصنف أو العلامة التجارية',
        categoryLabel: 'الفئة',
        anyCategory: 'أي فئة',
        warehouseLabel: 'المخزن',
        anyWarehouse: 'أي مخزن',
        onlyLowStock: 'المخزون المنخفض فقط',
        filter: 'تصفية',
        clear: 'مسح',
        caption: 'كتالوج المنتجات مع المخزون المتاح',
        colProduct: 'المنتج',
        colCategory: 'الفئة',
        colVendor: 'المورد',
        colCost: 'التكلفة',
        colSale: 'البيع',
        colOnHand: 'المتاح',
        colFree: 'الحر',
        marginSuffix: '% هامش الربح',
        reorderAtPrefix: 'إعادة الطلب عند',
        reservedSuffix: 'محجوز',
        emptyLowTitle: 'لا يوجد صنف عند أو أقل من حد إعادة الطلب',
        emptyLowBody: 'كل منتج له حد إعادة طلب محدد يتجاوزه حالياً.',
        emptyFilteredTitle: 'لا يوجد منتج مطابق',
        emptyFilteredBody: 'جرّب بحثاً مختلفاً، أو امسح عوامل التصفية.',
        emptyTitle: 'لا توجد منتجات بعد',
        emptyBody:
          'المنتج هو ما تستلمه في مخزن، وتخصصه لمشروع، وتضيفه إلى فاتورة.',
      },
      form: {
        skuLabel: 'رمز الصنف',
        skuHint: 'يُخصَّص تلقائيًا. يمكنك تغييره هنا إذا احتجت رمزًا مختلفًا.',
        nameEnLabel: 'الاسم (بالإنجليزية)',
        nameArLabel: 'الاسم (بالعربية)',
        unitLabel: 'الوحدة',
        unitHint: 'طريقة العد — قطعة، متر، كيلوجرام، لفة',
        categoryLabel: 'الفئة',
        uncategorised: 'بدون فئة',
        vendorLabel: 'المورد المفضل',
        noneOption: 'لا يوجد',
        brandLabel: 'العلامة التجارية',
        gpcCodeLabel: 'رمز GPC',
        gpcCodeHint: 'رمز الصنف في نظام الفوترة الإلكترونية المصري، إن وُجد',
        costPriceLabel: 'سعر التكلفة (جنيه مصري)',
        costPriceHint: 'ما تدفعه. يحدد تقييم المخزون.',
        salePriceLabel: 'سعر البيع (جنيه مصري)',
        salePriceHint: 'ما تتقاضاه. يُستخدم لتسعير بنود الفواتير.',
        vatRateLabel: 'نسبة ضريبة القيمة المضافة (%)',
        vatRateHint: '14% هي النسبة القياسية في مصر. السلع الخاضعة لنسبة صفر والمعفاة تأخذ 0.',
        reorderLevelLabel: 'حد إعادة الطلب',
        reorderLevelHint: 'المخزون عند هذا الحد أو أقل منه يُظهر علامة انخفاض المخزون.',
        warehouseLabel: 'المخزن',
        warehouseHint: 'أين يُخزَّن هذا المنتج',
        warehousePlaceholder: 'اختر مخزناً',
        openingQuantityLabel: 'الكمية الافتتاحية',
        openingQuantityHint: 'يسجل إيصال استلام في المخزن أعلاه. اتركه فارغاً للبدء من صفر.',
        binLocationLabel: 'موقع الرف',
        binLocationHint: 'الرف أو الصندوق، إذا كانت الكمية الافتتاحية أكبر من صفر',
        cancel: 'إلغاء',
        createProduct: 'إنشاء منتج',
        saveChanges: 'حفظ التغييرات',
      },
      new: {
        overline: 'العمليات',
        title: 'منتج جديد',
        lede: 'المنتج هو سطر في الكتالوج. اختر مكان تواجده، والكمية الافتتاحية تسجل إيصال استلام في ذلك المخزن.',
      },
      edit: {
        title: 'تعديل المنتج',
        lede: 'تغيير السعر هنا يؤثر على الفواتير المستقبلية فقط. البنود المُعدة مسبقاً تحتفظ بالسعر الذي كُتبت به.',
      },
      detail: {
        counted: 'يُعد بوحدة',
        edit: 'تعديل',
        print: 'طباعة',
        onHand: 'المتاح',
        low: 'منخفض',
        reserved: 'محجوز',
        reorderLevel: 'حد إعادة الطلب',
        costPrice: 'سعر التكلفة',
        salePrice: 'سعر البيع',
        valueAtCost: 'القيمة بسعر التكلفة',
        vat: 'ضريبة القيمة المضافة',
        preferredVendor: 'المورد المفضل:',
        stockByWarehouse: 'المخزون حسب المخزن',
        colWarehouse: 'المخزن',
        colBin: 'الرف',
        colQuantity: 'الكمية',
        colReserved: 'المحجوز',
        colAvailable: 'المتاح',
        emptyStockTitle: 'غير متوفر في أي مكان',
        emptyStockBody:
          'هذا المنتج موجود في الكتالوج لكن لم يتم استلام أي وحدات منه في أي مخزن.',
        onProjects: 'في المشاريع',
        colProject: 'المشروع',
        colAllocated: 'المخصص',
        colDelivered: 'المسلَّم',
        colReturned: 'المرتجع',
        colDamaged: 'التالف',
        movementHistory: 'سجل الحركة',
        colDate: 'التاريخ',
        colReference: 'المرجع',
        colType: 'النوع',
        colBalanceAfter: 'الرصيد بعد الحركة',
        colBy: 'بواسطة',
        emptyMovementsTitle: 'لا توجد حركات',
        emptyMovementsBody: 'لم يتحرك هذا المنتج مطلقاً.',
      },
      print: {
        backToProduct: 'العودة إلى المنتج',
        sheetOverline: 'كشف المنتج',
        stockByWarehouse: 'المخزون حسب المخزن',
        noStock: 'لا يوجد مخزون مسجل.',
        colWarehouse: 'المخزن',
        colBin: 'الرف',
        colQuantity: 'الكمية',
        colReserved: 'المحجوز',
        movementHistory: 'سجل الحركة',
        noMovements: 'لا توجد حركات مسجلة.',
        colDate: 'التاريخ',
        colRef: 'المرجع',
        colType: 'النوع',
        colWarehouse2: 'المخزن',
        colQty: 'الكمية',
        colBalance: 'الرصيد',
        producedBy: 'صادر عن GTS بتاريخ',
      },
    },
    warehouses: {
      list: {
        overline: 'العمليات',
        title: 'المخازن',
        countOne: 'مخزن',
        countOther: 'مخازن',
        unitsSuffix: 'وحدة متاحة',
        newWarehouse: 'مخزن جديد',
        noAddress: 'لا يوجد عنوان مسجل',
        colProducts: 'المنتجات',
        colUnits: 'الوحدات',
        reservedForProjects: 'محجوز لتخصيصات المشاريع',
        openInMaps: 'فتح في خرائط جوجل',
        emptyTitle: 'لا توجد مخازن',
        emptyBody: 'المخزن هو المكان الذي يوجد فيه المخزون فعلياً. أنشئ واحداً قبل استلام أي شيء.',
      },
      form: {
        codeLabel: 'رمز المخزن',
        codeHint: 'يُخصَّص تلقائيًا. يمكنك تغييره هنا إذا احتجت مرجعًا مختلفًا.',
        nameEnLabel: 'الاسم (بالإنجليزية)',
        nameArLabel: 'الاسم (بالعربية)',
        governorateLabel: 'المحافظة',
        notRecorded: 'غير مسجل',
        addressLabel: 'العنوان',
        capacityLabel: 'السعة (م³)',
        capacityHint: 'الحجم الاسمي، يُستخدم لمقياس الاستغلال. اتركه فارغاً إن لم يكن مقاساً.',
        latitudeLabel: 'خط العرض',
        latitudeHint: 'اختياري. يُفعّل رابط الخريطة وتسجيل الحضور بالموقع الجغرافي.',
        longitudeLabel: 'خط الطول',
        cancel: 'إلغاء',
        createWarehouse: 'إنشاء مخزن',
        saveChanges: 'حفظ التغييرات',
      },
      new: {
        overline: 'العمليات',
        title: 'مخزن جديد',
        lede: 'المخزن هو المكان الذي يوجد فيه المخزون فعلياً. لا يمكن استلام أي شيء قبل إنشاء مخزن، وكل سطر في سجل الحركة يذكر المبنى الذي مرّ به.',
      },
      edit: {
        title: 'تعديل المخزن',
        lede: 'تغيير هذه التفاصيل لا يحرك أي مخزون. الكميات هي شأن سجل الحركة.',
      },
      detail: {
        noAddress: 'لا يوجد عنوان مسجل',
        openInMaps: 'فتح في خرائط جوجل',
        edit: 'تعديل',
        print: 'طباعة',
        inactiveNotice: 'هذا المخزن لم يعد قيد الاستخدام.',
        products: 'المنتجات',
        unitsOnHand: 'الوحدات المتاحة',
        reserved: 'المحجوز',
        valueAtCost: 'القيمة بسعر التكلفة',
        capacity: 'السعة',
        stockOnHand: 'المخزون المتاح',
        colSku: 'رمز الصنف',
        colProduct: 'المنتج',
        colBin: 'الرف',
        colQuantity: 'الكمية',
        colReserved: 'المحجوز',
        colAvailable: 'المتاح',
        colValueAtCost: 'القيمة بسعر التكلفة',
        low: 'منخفض',
        emptyStockTitle: 'لا يوجد مخزون',
        emptyStockBody:
          'لم يتم استلام أي منتج في هذا المخزن بعد، أو تم صرف كل ما تم استلامه.',
        recentMovements: 'الحركات الأخيرة',
        colDate: 'التاريخ',
        colReference: 'المرجع',
        colType: 'النوع',
        colProduct2: 'المنتج',
        colBalanceAfter: 'الرصيد بعد الحركة',
        colBy: 'بواسطة',
        emptyMovementsTitle: 'لا توجد حركات',
        emptyMovementsBody: 'لم يتحرك شيء عبر هذا المخزن بعد.',
      },
      print: {
        backToWarehouse: 'العودة إلى المخزن',
        sheetOverline: 'كشف المخزن',
        stockOnFloor: 'المخزون في المخزن',
        nothingStocked: 'لا يوجد مخزون حالياً.',
        colProduct: 'المنتج',
        colBin: 'الرف',
        colQuantity: 'الكمية',
        colReserved: 'المحجوز',
        colValueAtCost: 'القيمة بسعر التكلفة',
        recentMovements: 'الحركات الأخيرة',
        noMovements: 'لا توجد حركات مسجلة.',
        colDate: 'التاريخ',
        colRef: 'المرجع',
        colType: 'النوع',
        colProduct2: 'المنتج',
        colQty: 'الكمية',
        producedBy: 'صادر عن GTS بتاريخ',
      },
    },
    vendors: {
      list: {
        overline: 'التوريد',
        title: 'الموردون',
        countOne: 'مورد',
        countOther: 'موردون',
        payableSuffix: 'مستحق الدفع',
        newVendor: 'مورد جديد',
        searchLabel: 'بحث في الموردين',
        searchPlaceholder: 'الاسم أو الرمز أو الرقم الضريبي',
        fieldLabel: 'المجال',
        allFields: 'كل المجالات',
        governorateLabel: 'المحافظة',
        allGovernorates: 'كل المحافظات',
        includeArchived: 'تضمين المؤرشفين',
        search: 'بحث',
        clear: 'مسح',
        caption: 'الموردون والمبالغ المستحقة الدفع لكل منهم',
        colVendor: 'المورد',
        colTaxNumber: 'الرقم الضريبي',
        colGovernorate: 'المحافظة',
        colField: 'المجال',
        colProducts: 'المنتجات',
        colPayable: 'المستحق',
        colOverdue: 'المتأخر',
        archivedSuffix: 'مؤرشف',
        total: 'الإجمالي',
        emptySearchTitle: 'لا يوجد مورد مطابق لهذا البحث',
        emptySearchBody: 'جرّب بحثاً أقصر، أو امسح عوامل التصفية.',
        emptyTitle: 'لا يوجد موردون بعد',
        emptyBody: 'المورد يزودك بالمنتجات التي تستلمها في مخازنك ويصدر لك فواتير بها.',
      },
      form: {
        codeLabel: 'رمز المورد',
        codeHint: 'يُخصَّص تلقائيًا. يمكنك تغييره هنا إذا احتجت مرجعًا مختلفًا.',
        nameEnLabel: 'الاسم (بالإنجليزية)',
        nameArLabel: 'الاسم (بالعربية)',
        trnLabel: 'الرقم الضريبي',
        trnHint: '9 أرقام، صادر عن مصلحة الضرائب المصرية',
        commercialRegLabel: 'السجل التجاري',
        commercialRegHint: 'صادر عن الهيئة العامة للاستثمار (GAFI)',
        governorateLabel: 'المحافظة',
        governoratePlaceholder: 'اختر محافظة',
        fieldLabel: 'المجال',
        fieldPlaceholder: 'اختر مجالاً',
        fieldOtherPlaceholder: 'صف مجال عمله',
        addressLabel: 'العنوان',
        contactNameLabel: 'اسم جهة الاتصال',
        contactPhoneLabel: 'هاتف جهة الاتصال',
        contactEmailLabel: 'البريد الإلكتروني لجهة الاتصال',
        paymentTermsLabel: 'شروط السداد (بالأيام)',
        paymentTermsHint: 'يُطبَّق على تاريخ الاستحقاق عند إصدار الفاتورة',
        notesLabel: 'ملاحظات',
        creating: 'جارٍ الإنشاء…',
        saving: 'جارٍ الحفظ…',
        createVendor: 'إنشاء مورد',
        saveChanges: 'حفظ التغييرات',
        cancel: 'إلغاء',
      },
      new: {
        overline: 'العلاقات',
        title: 'مورد جديد',
        lede: 'المورد يزودك بالمنتجات التي تستلمها في مخازنك. رقمه الضريبي هو ما يجعل الفواتير التي يرسلها لك قابلة للخصم.',
      },
      edit: {
        editPrefix: 'تعديل',
      },
      detail: {
        recordBill: 'تسجيل فاتورة',
        edit: 'تعديل',
        printStatement: 'طباعة كشف الحساب',
        account: 'الحساب',
        billedByThem: 'الفواتير الصادرة منهم',
        paid: 'المدفوع',
        payable: 'المستحق',
        overdue: 'المتأخر',
        paymentTerms: 'شروط السداد',
        daysSuffix: 'يوم',
        supplied: 'التوريدات',
        colProduct: 'المنتج',
        colReceived: 'المستلم',
        colReturned: 'المرتجع',
        colNet: 'الصافي',
        catalogue: 'الكتالوج',
        colCost: 'التكلفة',
        colSale: 'البيع',
        colOnHand: 'المتاح',
        colReorderAt: 'إعادة الطلب عند',
        bills: 'الفواتير',
        emptyBillsTitle: 'لا توجد فواتير',
        emptyBillsBody: 'لم يصدر هذا المورد أي فاتورة بعد.',
        colNumber: 'الرقم',
        colIssued: 'الإصدار',
        colDue: 'الاستحقاق',
        colStatus: 'الحالة',
        colTotal: 'الإجمالي',
        colOutstanding: 'المتبقي',
        daysLateSuffix: 'يوم تأخير',
        settled: 'مسدد',
        activity: 'النشاط',
        emptyActivityTitle: 'لم يحدث شيء بعد',
        emptyActivityBody: 'تظهر هنا الإيصالات والفواتير والمدفوعات فور حدوثها.',
      },
      print: {
        backToVendor: 'العودة إلى المورد',
        statementOverline: 'كشف حساب · اعتباراً من',
        billedToDate: 'المفوتر حتى الآن',
        paid: 'المدفوع',
        outstanding: 'المتبقي',
        overdue: 'المتأخر',
        openBills: 'الفواتير المفتوحة',
        nothingOutstanding: 'لا يوجد مبلغ مستحق.',
        colBill: 'الفاتورة',
        colIssued: 'الإصدار',
        colDue: 'الاستحقاق',
        colTotal: 'الإجمالي',
        colOutstanding: 'المتبقي',
        colOverdue: 'المتأخر',
        producedBy: 'صادر عن',
      },
    },
  },
};
