/** Dashboard, notifications and reports: the overview screens. */
export interface OverviewDict {
  overview: {
  dashboard: {
    netPosition: string;
    yourWorkspace: string;
    goodMorning: string;
    receivable: string;
    payable: string;
    overdue: string;
    activeProjectsSummary: string;
    activeProjectsSummaryPlural: string;
    railHint: string;
    receiptsTwelveMonths: string;
    thisMonth: string;
    noReceiptsYet: string;
    billedThisMonth: string;
    collected: string;
    outstanding: string;
    activeProjects: string;
    allProjects: string;
    noActiveProjects: string;
    createProjectHint: string;
    budgetBilled: string;
    noBudgetSet: string;
    needsAttention: string;
    nothingNeedsYou: string;
    nothingNeedsYouBody: string;
    storage: string;
    all: string;
    noWarehouses: string;
    createWarehouseHint: string;
    productsInStock: string;
    productInStock: string;
    onSiteToday: string;
    nobodyAssigned: string;
    nobodyAssignedBody: string;
    weekend: string;
    weekendBody: string;
    present: string;
    late: string;
    notIn: string;
    expectedOnSite: string;
    workingDayNotStarted: string;
  };
  notifications: {
    yourWorkspace: string;
    title: string;
    unread: string;
    allRead: string;
    unreadOnly: string;
    apply: string;
    markAllRead: string;
    marking: string;
    nothingUnread: string;
    nothingUnreadBody: string;
    nothingYet: string;
    nothingYetBody: string;
  };
  reports: {
    system: string;
    title: string;
    lede: string;
    print: string;
    tabs: {
      financial: string;
      inventory: string;
      projects: string;
      attendance: string;
    };
    from: string;
    to: string;
    apply: string;
    invoicedInPeriod: string;
    billedOut: string;
    purchased: string;
    grossMargin: string;
    invoicedNote: string;
    invoicedNoteStrong: string;
    cashMovedInPeriod: string;
    collected: string;
    paidOut: string;
    netCash: string;
    cashNote: string;
    cashNoteEm: string;
    vatStandardRate: string;
    vatCharged: string;
    vatPaidOnPurchases: string;
    netVatPosition: string;
    withheldAtSource: string;
    vatNote: string;
    byMonth: string;
    month: string;
    billed: string;
    productMovement: string;
    noProducts: string;
    nothingToReport: string;
    stockMovementCaption: string;
    product: string;
    received: string;
    issued: string;
    returned: string;
    damaged: string;
    adjusted: string;
    onHandNow: string;
    projectPosition: string;
    noProjects: string;
    project: string;
    status: string;
    budget: string;
    materials: string;
    days: string;
    percentBilled: string;
    attendance: string;
    noEmployees: string;
    attendanceCaption: string;
    employee: string;
    daysOnSite: string;
    late: string;
    minutesLate: string;
    hoursWorked: string;
    notCheckedOut: string;
  };
  };
}

export const en: OverviewDict = {
  overview: {
  dashboard: {
    netPosition: 'Net position',
    yourWorkspace: 'Your workspace',
    goodMorning: 'Good morning',
    receivable: 'Receivable',
    payable: 'payable',
    overdue: 'overdue',
    activeProjectsSummary: 'active project',
    activeProjectsSummaryPlural: 'active projects',
    railHint: 'Your assigned sites and leave are in the rail.',
    receiptsTwelveMonths: 'Receipts · 12 months',
    thisMonth: 'this month',
    noReceiptsYet: 'No payments recorded yet. The receipts trend appears once money starts arriving.',
    billedThisMonth: 'Billed this month',
    collected: 'Collected',
    outstanding: 'Outstanding',
    activeProjects: 'Active projects',
    allProjects: 'All projects',
    noActiveProjects: 'No active projects',
    createProjectHint: 'Create one to begin tracking work.',
    budgetBilled: 'budget billed',
    noBudgetSet: 'No budget set',
    needsAttention: 'Needs attention',
    nothingNeedsYou: 'Nothing needs you',
    nothingNeedsYouBody: 'No overdue bills, no low stock, nothing waiting on your approval.',
    storage: 'Storage',
    all: 'All',
    noWarehouses: 'No warehouses',
    createWarehouseHint: 'Create one to start receiving stock.',
    productsInStock: 'products in stock',
    productInStock: 'product in stock',
    onSiteToday: 'On site today',
    nobodyAssigned: 'Nobody assigned',
    nobodyAssignedBody: 'Assign employees to an active project to track attendance.',
    weekend: 'Weekend',
    weekendBody: 'Friday and Saturday are the rest days. Attendance resumes on Sunday.',
    present: 'Present',
    late: 'Late',
    notIn: 'Not in',
    expectedOnSite: 'expected on site today',
    workingDayNotStarted: 'the working day has not started yet',
  },
  notifications: {
    yourWorkspace: 'Your workspace',
    title: 'Notifications',
    unread: 'unread',
    allRead: 'Everything here has been read.',
    unreadOnly: 'Unread only',
    apply: 'Apply',
    markAllRead: 'Mark all read',
    marking: 'Marking…',
    nothingUnread: 'Nothing unread',
    nothingUnreadBody: 'You have read everything.',
    nothingYet: 'Nothing yet',
    nothingYetBody: 'Leave requests, bill approvals, overdue invoices and low stock appear here.',
  },
  reports: {
    system: 'System',
    title: 'Reports',
    lede: 'Computed from the transaction tables at the moment you open them. Nothing here is cached, so nothing here can disagree with the ledger.',
    print: 'Print',
    tabs: {
      financial: 'financial',
      inventory: 'inventory',
      projects: 'projects',
      attendance: 'attendance',
    },
    from: 'From',
    to: 'To',
    apply: 'Apply',
    invoicedInPeriod: 'Invoiced in the period',
    billedOut: 'Billed out',
    purchased: 'Purchased',
    grossMargin: 'Gross margin',
    invoicedNote: 'By issue date. Gross margin is billed minus purchased — it is',
    invoicedNoteStrong: 'not',
    cashMovedInPeriod: 'Cash moved in the period',
    collected: 'Collected',
    paidOut: 'Paid out',
    netCash: 'Net cash',
    cashNote: 'By receipt date, so these settle invoices from this period',
    cashNoteEm: 'and earlier ones',
    vatStandardRate: 'VAT · standard rate',
    vatCharged: 'VAT charged',
    vatPaidOnPurchases: 'VAT paid on purchases',
    netVatPosition: 'Net VAT position',
    withheldAtSource: 'Withheld at source',
    vatNote: 'A positive net position is owed to the Egyptian Tax Authority for the period. Withholding is separate: buyers deduct it from payments and remit it on our behalf, so it reduces cash received rather than what was invoiced.',
    byMonth: 'By month',
    month: 'Month',
    billed: 'Billed',
    productMovement: 'Product movement',
    noProducts: 'No products',
    nothingToReport: 'Nothing to report on.',
    stockMovementCaption: 'Stock movement in the period, and the level now',
    product: 'Product',
    received: 'Received',
    issued: 'Issued',
    returned: 'Returned',
    damaged: 'Damaged',
    adjusted: 'Adjusted',
    onHandNow: 'On hand now',
    projectPosition: 'Project position',
    noProjects: 'No projects',
    project: 'Project',
    status: 'Status',
    budget: 'Budget',
    materials: 'Materials',
    days: 'Days',
    percentBilled: 'billed',
    attendance: 'Attendance',
    noEmployees: 'No employees',
    attendanceCaption: 'Days attended in the period, and lateness',
    employee: 'Employee',
    daysOnSite: 'Days on site',
    late: 'Late',
    minutesLate: 'Minutes late',
    hoursWorked: 'Hours worked',
    notCheckedOut: 'not checked out',
  },
  },
};

export const ar: OverviewDict = {
  overview: {
  dashboard: {
    netPosition: 'صافي المركز المالي',
    yourWorkspace: 'مساحة عملك',
    goodMorning: 'صباح الخير',
    receivable: 'مستحق القبض',
    payable: 'مستحق الدفع',
    overdue: 'متأخر',
    activeProjectsSummary: 'مشروع نشط',
    activeProjectsSummaryPlural: 'مشاريع نشطة',
    railHint: 'مواقعك المسندة وإجازاتك موجودة في القائمة الجانبية.',
    receiptsTwelveMonths: 'المقبوضات · ١٢ شهرًا',
    thisMonth: 'هذا الشهر',
    noReceiptsYet: 'لا توجد مدفوعات مسجلة بعد. سيظهر اتجاه المقبوضات بمجرد وصول الأموال.',
    billedThisMonth: 'الفواتير هذا الشهر',
    collected: 'المحصّل',
    outstanding: 'المستحق',
    activeProjects: 'المشاريع النشطة',
    allProjects: 'جميع المشاريع',
    noActiveProjects: 'لا توجد مشاريع نشطة',
    createProjectHint: 'أنشئ مشروعًا لبدء تتبع العمل.',
    budgetBilled: 'من الميزانية مفوتر',
    noBudgetSet: 'لم تُحدَّد ميزانية',
    needsAttention: 'يحتاج إلى انتباه',
    nothingNeedsYou: 'لا شيء يحتاج إليك',
    nothingNeedsYouBody: 'لا فواتير متأخرة، ولا مخزون منخفض، ولا شيء ينتظر موافقتك.',
    storage: 'المخازن',
    all: 'الكل',
    noWarehouses: 'لا توجد مخازن',
    createWarehouseHint: 'أنشئ مخزنًا لبدء استلام البضائع.',
    productsInStock: 'منتجات في المخزون',
    productInStock: 'منتج في المخزون',
    onSiteToday: 'الحضور في الموقع اليوم',
    nobodyAssigned: 'لم يُسنَد أحد',
    nobodyAssignedBody: 'أسنِد الموظفين إلى مشروع نشط لتتبع الحضور.',
    weekend: 'عطلة نهاية الأسبوع',
    weekendBody: 'الجمعة والسبت هما يوما الراحة. يُستأنف تسجيل الحضور يوم الأحد.',
    present: 'حاضر',
    late: 'متأخر',
    notIn: 'غير حاضر',
    expectedOnSite: 'متوقَّع حضورهم في الموقع اليوم',
    workingDayNotStarted: 'لم يبدأ يوم العمل بعد',
  },
  notifications: {
    yourWorkspace: 'مساحة عملك',
    title: 'الإشعارات',
    unread: 'غير مقروء',
    allRead: 'تمت قراءة كل شيء هنا.',
    unreadOnly: 'غير المقروء فقط',
    apply: 'تطبيق',
    markAllRead: 'تعليم الكل كمقروء',
    marking: 'جارٍ التعليم…',
    nothingUnread: 'لا يوجد غير مقروء',
    nothingUnreadBody: 'لقد قرأت كل شيء.',
    nothingYet: 'لا شيء بعد',
    nothingYetBody: 'تظهر هنا طلبات الإجازة وموافقات الفواتير والفواتير المتأخرة والمخزون المنخفض.',
  },
  reports: {
    system: 'النظام',
    title: 'التقارير',
    lede: 'تُحسب من جداول العمليات لحظة فتحها. لا شيء هنا مخزَّن مؤقتًا، لذا لا يمكن أن يتعارض أي شيء هنا مع دفتر الحسابات.',
    print: 'طباعة',
    tabs: {
      financial: 'مالي',
      inventory: 'المخزون',
      projects: 'المشاريع',
      attendance: 'الحضور',
    },
    from: 'من',
    to: 'إلى',
    apply: 'تطبيق',
    invoicedInPeriod: 'المفوتر خلال الفترة',
    billedOut: 'المفوتر الصادر',
    purchased: 'المشتريات',
    grossMargin: 'إجمالي الهامش',
    invoicedNote: 'حسب تاريخ الإصدار. إجمالي الهامش هو المفوتر مطروحًا منه المشتريات — وهو',
    invoicedNoteStrong: 'ليس',
    cashMovedInPeriod: 'النقدية المتحركة خلال الفترة',
    collected: 'المحصّل',
    paidOut: 'المدفوع',
    netCash: 'صافي النقدية',
    cashNote: 'حسب تاريخ الاستلام، لذا فهي تسوّي فواتير من هذه الفترة',
    cashNoteEm: 'وفترات سابقة',
    vatStandardRate: 'ضريبة القيمة المضافة · السعر الأساسي',
    vatCharged: 'ضريبة القيمة المضافة المحصَّلة',
    vatPaidOnPurchases: 'ضريبة القيمة المضافة المدفوعة على المشتريات',
    netVatPosition: 'صافي مركز ضريبة القيمة المضافة',
    withheldAtSource: 'المحتجز من المنبع',
    vatNote: 'المركز الصافي الموجب مستحق لمصلحة الضرائب المصرية عن الفترة. الاستقطاع منفصل: يخصمه المشترون من المدفوعات ويوردونه نيابة عنا، لذا فهو يقلل النقدية المحصَّلة لا قيمة ما تم فوترته.',
    byMonth: 'حسب الشهر',
    month: 'الشهر',
    billed: 'المفوتر',
    productMovement: 'حركة المنتجات',
    noProducts: 'لا توجد منتجات',
    nothingToReport: 'لا يوجد ما يُعرض.',
    stockMovementCaption: 'حركة المخزون خلال الفترة، والمستوى الحالي',
    product: 'المنتج',
    received: 'الوارد',
    issued: 'المنصرف',
    returned: 'المرتجع',
    damaged: 'التالف',
    adjusted: 'التسوية',
    onHandNow: 'المتوفر حاليًا',
    projectPosition: 'موقف المشاريع',
    noProjects: 'لا توجد مشاريع',
    project: 'المشروع',
    status: 'الحالة',
    budget: 'الميزانية',
    materials: 'المواد',
    days: 'الأيام',
    percentBilled: 'مفوتر',
    attendance: 'الحضور',
    noEmployees: 'لا يوجد موظفون',
    attendanceCaption: 'أيام الحضور خلال الفترة، والتأخير',
    employee: 'الموظف',
    daysOnSite: 'أيام الحضور في الموقع',
    late: 'متأخر',
    minutesLate: 'دقائق التأخير',
    hoursWorked: 'ساعات العمل',
    notCheckedOut: 'لم يسجّل الانصراف',
  },
  },
};
