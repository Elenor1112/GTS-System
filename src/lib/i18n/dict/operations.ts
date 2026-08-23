/** Projects and Clients — the operational and relationship modules. */
export interface OperationsDict {
  operations: {
  projects: {
    list: {
      overline: string;
      title: string;
      newProject: string;
      searchLabel: string;
      searchPlaceholder: string;
      statusLabel: string;
      anyStatus: string;
      filter: string;
      clear: string;
      caption: string;
      colProject: string;
      colClient: string;
      colStatus: string;
      colSite: string;
      colEnds: string;
      colTeam: string;
      colBilled: string;
      colOfBudget: string;
      noSitePinned: string;
      siteFence: string;
      noBudget: string;
      startsFrom: string;
      emptyNoMatchTitle: string;
      emptyNoneTitle: string;
      emptyNoMatchBody: string;
      emptyNoneBody: string;
      unpinnedWarning: string;
      overdueSuffix: string;
      leftSuffix: string;
      count_one: string;
      count_other: string;
    };
    form: {
      codeLabel: string;
      codeHint: string;
      nameEnLabel: string;
      nameArLabel: string;
      clientLabel: string;
      clientPlaceholder: string;
      statusLabel: string;
      budgetLabel: string;
      budgetHint: string;
      startsOnLabel: string;
      endsOnLabel: string;
      notesLabel: string;
      cancel: string;
      createProject: string;
      saveChanges: string;
      statusPlanning: string;
      statusActive: string;
      statusOnHold: string;
      statusCompleted: string;
      statusCancelled: string;
    };
    newPage: {
      overline: string;
      title: string;
      lede: string;
    };
    editPage: {
      title: string;
      lede: string;
    };
    detail: {
      edit: string;
      print: string;
      siteLocationTitle: string;
      noLocationWarning: string;
      address: string;
      coordinates: string;
      checkInRadius: string;
      navigate: string;
      openInMaps: string;
      pinPermissionHint: string;
      teamTitle: string;
      colEmployee: string;
      colRoleOnSite: string;
      colAssigned: string;
      colToday: string;
      released: string;
      notIn: string;
      emptyTeamTitle: string;
      emptyTeamBody: string;
      materialsTitle: string;
      colProduct: string;
      colAllocated: string;
      colDelivered: string;
      colReturned: string;
      colDamaged: string;
      colInTransit: string;
      colOnSite: string;
      emptyMaterialsTitle: string;
      emptyMaterialsBody: string;
      financialTitle: string;
      figureBudget: string;
      figureBilled: string;
      figureCollected: string;
      figureOutstanding: string;
      figureMaterialsOnSite: string;
      figureLabourToDate: string;
      notSet: string;
      overBudgetBy: string;
      budgetRemaining: string;
      attendanceDay_one: string;
      attendanceDay_other: string;
    };
    location: {
      successMessage: string;
      addressLabel: string;
      addressPlaceholder: string;
      governorateLabel: string;
      governoratePlaceholder: string;
      siteTypeLabel: string;
      siteTypeHint: string;
      siteTypeOffice: string;
      siteTypeWarehouse: string;
      siteTypeSite: string;
      siteTypeYard: string;
      latitudeLabel: string;
      longitudeLabel: string;
      radiusLabel: string;
      radiusHint: string;
      findingYou: string;
      useMyPosition: string;
      checkPinOnMap: string;
      moveSiteBoundary: string;
      setSiteLocation: string;
      saving: string;
    };
    assign: {
      allAssigned: string;
      assignedWithLocation: string;
      assignedWithoutLocation: string;
      employeeLabel: string;
      employeePlaceholder: string;
      roleOnSiteLabel: string;
      roleOnSitePlaceholder: string;
      assigning: string;
      assign: string;
      release: string;
      releaseAria: string;
    };
    materials: {
      closedNotice: string;
      noStockNotice: string;
      allocatedMessage: string;
      productLabel: string;
      productPlaceholder: string;
      fromWarehouseLabel: string;
      selectWarehouse: string;
      chooseProductFirst: string;
      quantityLabel: string;
      freeSuffix: string;
      agreedPriceLabel: string;
      agreedPricePlaceholder: string;
      allocating: string;
      allocate: string;
      deliver: string;
      return: string;
      deliverQuantityLabel: string;
      deliverHelp: string;
      referenceLabel: string;
      referencePlaceholder: string;
      recording: string;
      recordDelivery: string;
      deliveredMessage: string;
      cancel: string;
      returnQuantityLabel: string;
      returnHelp: string;
      writeOffAgainst: string;
      backInto: string;
      reasonLabel: string;
      reasonDamagedPlaceholder: string;
      reasonSurplusPlaceholder: string;
      damagedLabel: string;
      writeOff: string;
      returnToStock: string;
      writtenOffMessage: string;
      returnedMessage: string;
    };
    print: {
      backToProject: string;
      sheetOverline: string;
      client: string;
      dates: string;
      site: string;
      noSitePinned: string;
      budget: string;
      billed: string;
      teamTitle: string;
      colEmployee: string;
      colRoleOnSite: string;
      colAssigned: string;
      noOneAssigned: string;
      materialsTitle: string;
      colProduct: string;
      colAllocated: string;
      colDelivered: string;
      colReturned: string;
      colRemaining: string;
      noMaterials: string;
      producedBy: string;
    };
  };
  clients: {
    list: {
      overline: string;
      title: string;
      newClient: string;
      searchLabel: string;
      searchPlaceholder: string;
      includeArchived: string;
      search: string;
      clear: string;
      caption: string;
      colClient: string;
      colTaxNumber: string;
      colGovernorate: string;
      colProjects: string;
      colOutstanding: string;
      colOverdue: string;
      archived: string;
      total: string;
      emptyNoMatchTitle: string;
      emptyNoneTitle: string;
      emptyNoMatchBody: string;
      emptyNoneBody: string;
      outstandingSuffix: string;
      count_one: string;
      count_other: string;
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
      addressLabel: string;
      contactNameLabel: string;
      contactPhoneLabel: string;
      contactEmailLabel: string;
      paymentTermsLabel: string;
      paymentTermsHint: string;
      creditLimitLabel: string;
      creditLimitHint: string;
      notesLabel: string;
      creating: string;
      saving: string;
      createClient: string;
      saveChanges: string;
      cancel: string;
    };
    newPage: {
      overline: string;
      title: string;
      lede: string;
    };
    editPage: {
      editTitle: string;
    };
    detail: {
      newProject: string;
      newBill: string;
      edit: string;
      printStatement: string;
      accountTitle: string;
      figureBilledToDate: string;
      figureCollected: string;
      figureWithheld: string;
      figureOutstanding: string;
      figureOverdue: string;
      ageingTitle: string;
      ageingCurrent: string;
      ageing1to30: string;
      ageing31to60: string;
      ageing61to90: string;
      ageingOver90: string;
      creditLimit: string;
      overLimit: string;
      paymentTerms: string;
      projectsTitle: string;
      emptyProjectsTitle: string;
      emptyProjectsBody: string;
      colProject: string;
      colStatus: string;
      colSite: string;
      colTeam: string;
      colBudget: string;
      notPinned: string;
      goodsTitle: string;
      goodsCaption: string;
      colProduct: string;
      colDelivered: string;
      colReturned: string;
      colDamaged: string;
      colRetained: string;
      billsTitle: string;
      emptyBillsTitle: string;
      emptyBillsBody: string;
      colNumber: string;
      colIssued: string;
      colDue: string;
      colTotal: string;
      colOutstanding: string;
      settled: string;
      daysLate: string;
      activityTitle: string;
      emptyActivityTitle: string;
      emptyActivityBody: string;
    };
    print: {
      backToClient: string;
      statementOverline: string;
      billedToDate: string;
      collected: string;
      outstanding: string;
      overdue: string;
      openBillsTitle: string;
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

export const en: OperationsDict = {
  operations: {
  projects: {
    list: {
      overline: 'Operations',
      title: 'Projects',
      newProject: 'New project',
      searchLabel: 'Search projects',
      searchPlaceholder: 'Project, code or client',
      statusLabel: 'Status',
      anyStatus: 'Any status',
      filter: 'Filter',
      clear: 'Clear',
      caption: 'Projects, their sites and budget consumption',
      colProject: 'Project',
      colClient: 'Client',
      colStatus: 'Status',
      colSite: 'Site',
      colEnds: 'Ends',
      colTeam: 'Team',
      colBilled: 'Billed',
      colOfBudget: 'Of budget',
      noSitePinned: 'No site pinned',
      siteFence: 'm fence',
      noBudget: 'no budget',
      startsFrom: 'from',
      emptyNoMatchTitle: 'No project matches',
      emptyNoneTitle: 'No projects yet',
      emptyNoMatchBody: 'Try a different search, or clear the filter.',
      emptyNoneBody: 'A project carries a client, a site location, the people assigned to it and the materials allocated to it.',
      unpinnedWarning: 'active without a pinned site, so nobody can check in there',
      overdueSuffix: 'd overdue',
      leftSuffix: 'd left',
      count_one: 'project',
      count_other: 'projects',
    },
    form: {
      codeLabel: 'Project code',
      codeHint: 'Your own reference, e.g. PRJ-2026-014',
      nameEnLabel: 'Name (English)',
      nameArLabel: 'Name (Arabic)',
      clientLabel: 'Client',
      clientPlaceholder: 'Choose a client',
      statusLabel: 'Status',
      budgetLabel: 'Budget (EGP)',
      budgetHint: 'Optional. Leave blank if not yet agreed.',
      startsOnLabel: 'Starts on',
      endsOnLabel: 'Ends on',
      notesLabel: 'Notes',
      cancel: 'Cancel',
      createProject: 'Create project',
      saveChanges: 'Save changes',
      statusPlanning: 'Planning',
      statusActive: 'Active',
      statusOnHold: 'On hold',
      statusCompleted: 'Completed',
      statusCancelled: 'Cancelled',
    },
    newPage: {
      overline: 'Delivery',
      title: 'New project',
      lede: 'A project is the unit everything else hangs off — the employees on site, the stock allocated to it, and the bills raised against it.',
    },
    editPage: {
      title: 'Edit project',
      lede: 'The site location is set from the project page, not here — it carries its own permission because attendance is checked against it.',
    },
    detail: {
      edit: 'Edit',
      print: 'Print',
      siteLocationTitle: 'Site location',
      noLocationWarning: 'This project has no site location. Nobody assigned to it can check in until one is pinned — attendance is judged against these coordinates.',
      address: 'Address',
      coordinates: 'Coordinates',
      checkInRadius: 'Check-in radius',
      navigate: 'Navigate',
      openInMaps: 'Open in Google Maps',
      pinPermissionHint: 'Ask an administrator to pin this site.',
      teamTitle: 'Team',
      colEmployee: 'Employee',
      colRoleOnSite: 'Role on site',
      colAssigned: 'Assigned',
      colToday: 'Today',
      released: 'released',
      notIn: 'not in',
      emptyTeamTitle: 'Nobody assigned',
      emptyTeamBody: 'Assign the people working on this site so they can record attendance here.',
      materialsTitle: 'Materials',
      colProduct: 'Product',
      colAllocated: 'Allocated',
      colDelivered: 'Delivered',
      colReturned: 'Returned',
      colDamaged: 'Damaged',
      colInTransit: 'In transit',
      colOnSite: 'On site',
      emptyMaterialsTitle: 'Nothing allocated',
      emptyMaterialsBody: 'Stock allocated to this project from a warehouse appears here, with what has been delivered, returned and written off.',
      financialTitle: 'Financial position',
      figureBudget: 'Budget',
      figureBilled: 'Billed',
      figureCollected: 'Collected',
      figureOutstanding: 'Outstanding',
      figureMaterialsOnSite: 'Materials on site',
      figureLabourToDate: 'Labour to date',
      notSet: 'not set',
      overBudgetBy: 'Over budget by ',
      budgetRemaining: 'Budget remaining ',
      attendanceDay_one: 'attendance day recorded',
      attendanceDay_other: 'attendance days recorded',
    },
    location: {
      successMessage: 'Site location saved. Anyone assigned to this project can now check in within the radius below.',
      addressLabel: 'Site address',
      addressPlaceholder: 'Palm Hills New Cairo, Third Settlement, Cairo',
      governorateLabel: 'Governorate',
      governoratePlaceholder: 'Select a governorate',
      siteTypeLabel: 'Site type',
      siteTypeHint: 'Sets a sensible default radius',
      siteTypeOffice: 'Office',
      siteTypeWarehouse: 'Warehouse',
      siteTypeSite: 'Site',
      siteTypeYard: 'Yard',
      latitudeLabel: 'Latitude',
      longitudeLabel: 'Longitude',
      radiusLabel: 'Check-in radius (metres)',
      radiusHint: 'Between 25m and 5km. Too tight and GPS drift locks out honest staff.',
      findingYou: 'Finding you…',
      useMyPosition: 'Use my current position',
      checkPinOnMap: 'Check this pin on the map',
      moveSiteBoundary: 'Move the site boundary',
      setSiteLocation: 'Set the site location',
      saving: 'Saving…',
    },
    assign: {
      allAssigned: 'Every active employee is already assigned to this project.',
      assignedWithLocation: 'Assigned. They can check in at this site from the Attendance screen.',
      assignedWithoutLocation: 'Assigned — but this project has no site location, so they cannot check in yet. Set the location above.',
      employeeLabel: 'Employee',
      employeePlaceholder: 'Select an employee',
      roleOnSiteLabel: 'Role on site',
      roleOnSitePlaceholder: 'Site foreman',
      assigning: 'Assigning…',
      assign: 'Assign',
      release: 'Release',
      releaseAria: 'Release {name} from this project',
    },
    materials: {
      closedNotice: 'This project is closed. Stock can no longer be allocated to it.',
      noStockNotice: 'No warehouse is holding stock. Receive stock into a warehouse before allocating it to a site.',
      allocatedMessage: 'Allocated. The units have left the warehouse and are now against this project — record the delivery once they reach the site.',
      productLabel: 'Product',
      productPlaceholder: 'Select a product',
      fromWarehouseLabel: 'From warehouse',
      selectWarehouse: 'Select a warehouse',
      chooseProductFirst: 'Choose a product first',
      quantityLabel: 'Quantity',
      freeSuffix: 'free',
      agreedPriceLabel: 'Agreed price',
      agreedPricePlaceholder: 'catalogue',
      allocating: 'Allocating…',
      allocate: 'Allocate',
      deliver: 'Deliver',
      return: 'Return',
      deliverQuantityLabel: 'Deliver',
      deliverHelp: 'of {product} in transit.',
      referenceLabel: 'Reference',
      referencePlaceholder: 'Delivery note no.',
      recording: 'Recording…',
      recordDelivery: 'Record delivery',
      deliveredMessage: 'Delivery recorded against the client statement.',
      cancel: 'Cancel',
      returnQuantityLabel: 'Quantity',
      returnHelp: 'of {product} still on site.',
      writeOffAgainst: 'Write off against',
      backInto: 'Back into',
      reasonLabel: 'Reason',
      reasonDamagedPlaceholder: 'Crushed in transit',
      reasonSurplusPlaceholder: 'Surplus to requirement',
      damagedLabel: 'Damaged — write off rather than restock',
      writeOff: 'Write off',
      returnToStock: 'Return to stock',
      writtenOffMessage: 'Written off — the ledger keeps the loss rather than restocking the units.',
      returnedMessage: 'Returned. The units are back on the shelf and available again.',
    },
    print: {
      backToProject: 'Back to the project',
      sheetOverline: 'Project sheet',
      client: 'Client',
      dates: 'Dates',
      site: 'Site',
      noSitePinned: 'No site pinned',
      budget: 'Budget',
      billed: 'Billed',
      teamTitle: 'Team',
      colEmployee: 'Employee',
      colRoleOnSite: 'Role on site',
      colAssigned: 'Assigned',
      noOneAssigned: 'No one currently assigned.',
      materialsTitle: 'Materials',
      colProduct: 'Product',
      colAllocated: 'Allocated',
      colDelivered: 'Delivered',
      colReturned: 'Returned',
      colRemaining: 'Remaining',
      noMaterials: 'No materials allocated.',
      producedBy: 'Produced by GTS on',
    },
  },
  clients: {
    list: {
      overline: 'Relationships',
      title: 'Clients',
      newClient: 'New client',
      searchLabel: 'Search clients',
      searchPlaceholder: 'Name, code or tax number',
      includeArchived: 'Include archived',
      search: 'Search',
      clear: 'Clear',
      caption: 'Clients, with outstanding and overdue balances',
      colClient: 'Client',
      colTaxNumber: 'Tax number',
      colGovernorate: 'Governorate',
      colProjects: 'Projects',
      colOutstanding: 'Outstanding',
      colOverdue: 'Overdue',
      archived: 'archived',
      total: 'Total',
      emptyNoMatchTitle: 'No client matches that search',
      emptyNoneTitle: 'No clients yet',
      emptyNoMatchBody: 'Try a shorter search, or clear the filter to see everyone.',
      emptyNoneBody: 'A client owns projects, receives goods and is billed. Create the first one to begin.',
      outstandingSuffix: 'outstanding',
      count_one: 'client',
      count_other: 'clients',
    },
    form: {
      codeLabel: 'Client code',
      codeHint: 'Your own reference, e.g. CL-006',
      nameEnLabel: 'Name (English)',
      nameArLabel: 'Name (Arabic)',
      trnLabel: 'Tax registration number',
      trnHint: '9 digits, issued by the Egyptian Tax Authority',
      commercialRegLabel: 'Commercial register',
      commercialRegHint: 'Issued by GAFI',
      governorateLabel: 'Governorate',
      governoratePlaceholder: 'Select a governorate',
      addressLabel: 'Address',
      contactNameLabel: 'Contact name',
      contactPhoneLabel: 'Contact phone',
      contactEmailLabel: 'Contact email',
      paymentTermsLabel: 'Payment terms (days)',
      paymentTermsHint: 'Applied to the due date when a bill is raised',
      creditLimitLabel: 'Credit limit (EGP)',
      creditLimitHint: '0 means no limit',
      notesLabel: 'Notes',
      creating: 'Creating…',
      saving: 'Saving…',
      createClient: 'Create client',
      saveChanges: 'Save changes',
      cancel: 'Cancel',
    },
    newPage: {
      overline: 'Relationships',
      title: 'New client',
      lede: 'A client owns projects, receives goods and is billed. The tax registration number is what makes their invoices valid.',
    },
    editPage: {
      editTitle: 'Edit',
    },
    detail: {
      newProject: 'New project',
      newBill: 'New bill',
      edit: 'Edit',
      printStatement: 'Print statement',
      accountTitle: 'Account',
      figureBilledToDate: 'Billed to date',
      figureCollected: 'Collected',
      figureWithheld: 'Withheld at source',
      figureOutstanding: 'Outstanding',
      figureOverdue: 'Overdue',
      ageingTitle: 'Ageing',
      ageingCurrent: 'Current',
      ageing1to30: '1–30 days',
      ageing31to60: '31–60 days',
      ageing61to90: '61–90 days',
      ageingOver90: 'Over 90 days',
      creditLimit: 'Credit limit',
      overLimit: 'Over limit',
      paymentTerms: 'payment terms',
      projectsTitle: 'Projects',
      emptyProjectsTitle: 'No projects',
      emptyProjectsBody: 'A project is where work, people, materials and bills come together for this client.',
      colProject: 'Project',
      colStatus: 'Status',
      colSite: 'Site',
      colTeam: 'Team',
      colBudget: 'Budget',
      notPinned: 'Not pinned',
      goodsTitle: 'Goods',
      goodsCaption: 'Products delivered to this client, and what came back',
      colProduct: 'Product',
      colDelivered: 'Delivered',
      colReturned: 'Returned',
      colDamaged: 'Damaged',
      colRetained: 'Retained',
      billsTitle: 'Bills',
      emptyBillsTitle: 'No bills',
      emptyBillsBody: 'Nothing has been billed to this client yet.',
      colNumber: 'Number',
      colIssued: 'Issued',
      colDue: 'Due',
      colTotal: 'Total',
      colOutstanding: 'Outstanding',
      settled: 'settled',
      daysLate: 'days late',
      activityTitle: 'Activity',
      emptyActivityTitle: 'Nothing has happened yet',
      emptyActivityBody: 'Projects, bills, payments and goods movements appear here as they occur.',
    },
    print: {
      backToClient: 'Back to the client',
      statementOverline: 'Account statement · as of',
      billedToDate: 'Billed to date',
      collected: 'Collected',
      outstanding: 'Outstanding',
      overdue: 'Overdue',
      openBillsTitle: 'Open bills',
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

export const ar: OperationsDict = {
  operations: {
  projects: {
    list: {
      overline: 'العمليات',
      title: 'المشاريع',
      newProject: 'مشروع جديد',
      searchLabel: 'البحث في المشاريع',
      searchPlaceholder: 'اسم المشروع أو الكود أو العميل',
      statusLabel: 'الحالة',
      anyStatus: 'أي حالة',
      filter: 'تصفية',
      clear: 'مسح',
      caption: 'المشاريع ومواقعها ونسبة استهلاك الميزانية',
      colProject: 'المشروع',
      colClient: 'العميل',
      colStatus: 'الحالة',
      colSite: 'الموقع',
      colEnds: 'الانتهاء',
      colTeam: 'الفريق',
      colBilled: 'المفوتر',
      colOfBudget: 'من الميزانية',
      noSitePinned: 'لم يُحدَّد الموقع',
      siteFence: 'م نطاق',
      noBudget: 'لا توجد ميزانية',
      startsFrom: 'من',
      emptyNoMatchTitle: 'لا يوجد مشروع مطابق',
      emptyNoneTitle: 'لا توجد مشاريع بعد',
      emptyNoMatchBody: 'جرّب بحثًا مختلفًا، أو امسح عوامل التصفية.',
      emptyNoneBody: 'يضم المشروع عميلًا وموقعًا وأفرادًا مُسندين إليه ومواد مخصصة له.',
      unpinnedWarning: 'نشط دون تحديد موقع، فلا يمكن لأحد تسجيل الحضور هناك',
      overdueSuffix: 'يوم تأخير',
      leftSuffix: 'يوم متبقٍ',
      count_one: 'مشروع',
      count_other: 'مشاريع',
    },
    form: {
      codeLabel: 'كود المشروع',
      codeHint: 'مرجعك الخاص، مثال: PRJ-2026-014',
      nameEnLabel: 'الاسم (إنجليزي)',
      nameArLabel: 'الاسم (عربي)',
      clientLabel: 'العميل',
      clientPlaceholder: 'اختر عميلًا',
      statusLabel: 'الحالة',
      budgetLabel: 'الميزانية (جنيه مصري)',
      budgetHint: 'اختياري. اتركه فارغًا إذا لم يُتفق عليه بعد.',
      startsOnLabel: 'تاريخ البدء',
      endsOnLabel: 'تاريخ الانتهاء',
      notesLabel: 'ملاحظات',
      cancel: 'إلغاء',
      createProject: 'إنشاء مشروع',
      saveChanges: 'حفظ التغييرات',
      statusPlanning: 'التخطيط',
      statusActive: 'نشط',
      statusOnHold: 'متوقف مؤقتًا',
      statusCompleted: 'مكتمل',
      statusCancelled: 'ملغى',
    },
    newPage: {
      overline: 'التنفيذ',
      title: 'مشروع جديد',
      lede: 'المشروع هو الوحدة التي يرتبط بها كل شيء آخر — الموظفون في الموقع، والمخزون المخصص له، والفواتير الصادرة عليه.',
    },
    editPage: {
      title: 'تعديل المشروع',
      lede: 'يُحدَّد موقع الموقع من صفحة المشروع، وليس هنا — فله صلاحية مستقلة لأن الحضور يُحتسب بناءً عليه.',
    },
    detail: {
      edit: 'تعديل',
      print: 'طباعة',
      siteLocationTitle: 'موقع الموقع',
      noLocationWarning: 'لا يوجد موقع محدد لهذا المشروع. لا يمكن لأي شخص مُسند إليه تسجيل الحضور حتى يُحدَّد الموقع — يُحتسب الحضور بناءً على هذه الإحداثيات.',
      address: 'العنوان',
      coordinates: 'الإحداثيات',
      checkInRadius: 'نطاق تسجيل الحضور',
      navigate: 'التنقل',
      openInMaps: 'فتح في خرائط جوجل',
      pinPermissionHint: 'اطلب من أحد المسؤولين تحديد هذا الموقع.',
      teamTitle: 'الفريق',
      colEmployee: 'الموظف',
      colRoleOnSite: 'الدور في الموقع',
      colAssigned: 'تاريخ الإسناد',
      colToday: 'اليوم',
      released: 'أُنهي في',
      notIn: 'لم يحضر',
      emptyTeamTitle: 'لا يوجد أحد مُسند',
      emptyTeamBody: 'أسند الأشخاص العاملين في هذا الموقع حتى يتمكنوا من تسجيل الحضور هنا.',
      materialsTitle: 'المواد',
      colProduct: 'المنتج',
      colAllocated: 'المخصص',
      colDelivered: 'المُسلَّم',
      colReturned: 'المُرتجَع',
      colDamaged: 'التالف',
      colInTransit: 'قيد النقل',
      colOnSite: 'في الموقع',
      emptyMaterialsTitle: 'لا يوجد مخصص',
      emptyMaterialsBody: 'يظهر هنا المخزون المخصص لهذا المشروع من مخزن، مع ما تم تسليمه وإرجاعه وإعدامه.',
      financialTitle: 'الموقف المالي',
      figureBudget: 'الميزانية',
      figureBilled: 'المفوتر',
      figureCollected: 'المحصَّل',
      figureOutstanding: 'المستحق',
      figureMaterialsOnSite: 'المواد في الموقع',
      figureLabourToDate: 'تكلفة العمالة حتى الآن',
      notSet: 'غير محدد',
      overBudgetBy: 'تجاوز الميزانية بمقدار ',
      budgetRemaining: 'المتبقي من الميزانية ',
      attendanceDay_one: 'يوم حضور مسجل',
      attendanceDay_other: 'أيام حضور مسجلة',
    },
    location: {
      successMessage: 'تم حفظ موقع الموقع. يمكن الآن لأي شخص مُسند إلى هذا المشروع تسجيل الحضور ضمن النطاق أدناه.',
      addressLabel: 'عنوان الموقع',
      addressPlaceholder: 'بالم هيلز القاهرة الجديدة، التجمع الثالث، القاهرة',
      governorateLabel: 'المحافظة',
      governoratePlaceholder: 'اختر محافظة',
      siteTypeLabel: 'نوع الموقع',
      siteTypeHint: 'يحدد نطاقًا افتراضيًا مناسبًا',
      siteTypeOffice: 'مكتب',
      siteTypeWarehouse: 'مخزن',
      siteTypeSite: 'موقع عمل',
      siteTypeYard: 'ساحة',
      latitudeLabel: 'خط العرض',
      longitudeLabel: 'خط الطول',
      radiusLabel: 'نطاق تسجيل الحضور (بالمتر)',
      radiusHint: 'بين 25 مترًا و5 كيلومترات. النطاق الضيق جدًا يجعل انحراف GPS يمنع الموظفين الصادقين من الحضور.',
      findingYou: 'جارٍ تحديد موقعك…',
      useMyPosition: 'استخدام موقعي الحالي',
      checkPinOnMap: 'تحقق من هذا الموقع على الخريطة',
      moveSiteBoundary: 'نقل حدود الموقع',
      setSiteLocation: 'تحديد موقع الموقع',
      saving: 'جارٍ الحفظ…',
    },
    assign: {
      allAssigned: 'كل موظف نشط مُسند بالفعل إلى هذا المشروع.',
      assignedWithLocation: 'تم الإسناد. يمكنهم تسجيل الحضور في هذا الموقع من شاشة الحضور.',
      assignedWithoutLocation: 'تم الإسناد — لكن هذا المشروع بلا موقع محدد، لذا لا يمكنهم تسجيل الحضور بعد. حدد الموقع أعلاه.',
      employeeLabel: 'الموظف',
      employeePlaceholder: 'اختر موظفًا',
      roleOnSiteLabel: 'الدور في الموقع',
      roleOnSitePlaceholder: 'رئيس عمال الموقع',
      assigning: 'جارٍ الإسناد…',
      assign: 'إسناد',
      release: 'إنهاء',
      releaseAria: 'إنهاء إسناد {name} من هذا المشروع',
    },
    materials: {
      closedNotice: 'هذا المشروع مغلق. لم يعد بالإمكان تخصيص مخزون له.',
      noStockNotice: 'لا يوجد مخزون في أي مخزن. استلم مخزونًا في أحد المخازن قبل تخصيصه لموقع.',
      allocatedMessage: 'تم التخصيص. غادرت الوحدات المخزن وأصبحت الآن مخصصة لهذا المشروع — سجّل التسليم عند وصولها إلى الموقع.',
      productLabel: 'المنتج',
      productPlaceholder: 'اختر منتجًا',
      fromWarehouseLabel: 'من المخزن',
      selectWarehouse: 'اختر مخزنًا',
      chooseProductFirst: 'اختر منتجًا أولًا',
      quantityLabel: 'الكمية',
      freeSuffix: 'متاح',
      agreedPriceLabel: 'السعر المتفق عليه',
      agreedPricePlaceholder: 'سعر الكتالوج',
      allocating: 'جارٍ التخصيص…',
      allocate: 'تخصيص',
      deliver: 'تسليم',
      return: 'إرجاع',
      deliverQuantityLabel: 'تسليم',
      deliverHelp: 'من {product} قيد النقل.',
      referenceLabel: 'المرجع',
      referencePlaceholder: 'رقم إذن التسليم',
      recording: 'جارٍ التسجيل…',
      recordDelivery: 'تسجيل التسليم',
      deliveredMessage: 'تم تسجيل التسليم في كشف حساب العميل.',
      cancel: 'إلغاء',
      returnQuantityLabel: 'الكمية',
      returnHelp: 'من {product} لا تزال في الموقع.',
      writeOffAgainst: 'الإعدام مقابل',
      backInto: 'الإرجاع إلى',
      reasonLabel: 'السبب',
      reasonDamagedPlaceholder: 'تلف أثناء النقل',
      reasonSurplusPlaceholder: 'فائض عن الحاجة',
      damagedLabel: 'تالف — إعدام بدلًا من إعادة التخزين',
      writeOff: 'إعدام',
      returnToStock: 'إرجاع إلى المخزون',
      writtenOffMessage: 'تم الإعدام — يحتفظ السجل بالخسارة بدلًا من إعادة تخزين الوحدات.',
      returnedMessage: 'تم الإرجاع. عادت الوحدات إلى الرف وأصبحت متاحة مرة أخرى.',
    },
    print: {
      backToProject: 'العودة إلى المشروع',
      sheetOverline: 'كشف المشروع',
      client: 'العميل',
      dates: 'التواريخ',
      site: 'الموقع',
      noSitePinned: 'لم يُحدَّد الموقع',
      budget: 'الميزانية',
      billed: 'المفوتر',
      teamTitle: 'الفريق',
      colEmployee: 'الموظف',
      colRoleOnSite: 'الدور في الموقع',
      colAssigned: 'تاريخ الإسناد',
      noOneAssigned: 'لا يوجد أحد مُسند حاليًا.',
      materialsTitle: 'المواد',
      colProduct: 'المنتج',
      colAllocated: 'المخصص',
      colDelivered: 'المُسلَّم',
      colReturned: 'المُرتجَع',
      colRemaining: 'المتبقي',
      noMaterials: 'لا توجد مواد مخصصة.',
      producedBy: 'صادر عن GTS بتاريخ',
    },
  },
  clients: {
    list: {
      overline: 'العلاقات',
      title: 'العملاء',
      newClient: 'عميل جديد',
      searchLabel: 'البحث في العملاء',
      searchPlaceholder: 'الاسم أو الكود أو الرقم الضريبي',
      includeArchived: 'تضمين المؤرشفين',
      search: 'بحث',
      clear: 'مسح',
      caption: 'العملاء، مع الأرصدة المستحقة والمتأخرة',
      colClient: 'العميل',
      colTaxNumber: 'الرقم الضريبي',
      colGovernorate: 'المحافظة',
      colProjects: 'المشاريع',
      colOutstanding: 'المستحق',
      colOverdue: 'المتأخر',
      archived: 'مؤرشف',
      total: 'الإجمالي',
      emptyNoMatchTitle: 'لا يوجد عميل مطابق لهذا البحث',
      emptyNoneTitle: 'لا يوجد عملاء بعد',
      emptyNoMatchBody: 'جرّب بحثًا أقصر، أو امسح عوامل التصفية لرؤية الجميع.',
      emptyNoneBody: 'يملك العميل مشاريع، ويستلم بضائع، ويُفوتَر له. أنشئ الأول للبدء.',
      outstandingSuffix: 'مستحق',
      count_one: 'عميل',
      count_other: 'عملاء',
    },
    form: {
      codeLabel: 'كود العميل',
      codeHint: 'مرجعك الخاص، مثال: CL-006',
      nameEnLabel: 'الاسم (إنجليزي)',
      nameArLabel: 'الاسم (عربي)',
      trnLabel: 'الرقم الضريبي',
      trnHint: '9 أرقام، صادر عن مصلحة الضرائب المصرية',
      commercialRegLabel: 'السجل التجاري',
      commercialRegHint: 'صادر عن الهيئة العامة للاستثمار (GAFI)',
      governorateLabel: 'المحافظة',
      governoratePlaceholder: 'اختر محافظة',
      addressLabel: 'العنوان',
      contactNameLabel: 'اسم جهة الاتصال',
      contactPhoneLabel: 'هاتف جهة الاتصال',
      contactEmailLabel: 'البريد الإلكتروني لجهة الاتصال',
      paymentTermsLabel: 'شروط السداد (أيام)',
      paymentTermsHint: 'تُطبَّق على تاريخ الاستحقاق عند إصدار فاتورة',
      creditLimitLabel: 'حد الائتمان (جنيه مصري)',
      creditLimitHint: '0 يعني بلا حد',
      notesLabel: 'ملاحظات',
      creating: 'جارٍ الإنشاء…',
      saving: 'جارٍ الحفظ…',
      createClient: 'إنشاء عميل',
      saveChanges: 'حفظ التغييرات',
      cancel: 'إلغاء',
    },
    newPage: {
      overline: 'العلاقات',
      title: 'عميل جديد',
      lede: 'يملك العميل مشاريع، ويستلم بضائع، ويُفوتَر له. الرقم الضريبي هو ما يجعل فواتيره سارية.',
    },
    editPage: {
      editTitle: 'تعديل',
    },
    detail: {
      newProject: 'مشروع جديد',
      newBill: 'فاتورة جديدة',
      edit: 'تعديل',
      printStatement: 'طباعة كشف الحساب',
      accountTitle: 'الحساب',
      figureBilledToDate: 'المفوتر حتى الآن',
      figureCollected: 'المحصَّل',
      figureWithheld: 'المحجوز عند المنبع',
      figureOutstanding: 'المستحق',
      figureOverdue: 'المتأخر',
      ageingTitle: 'أعمار الديون',
      ageingCurrent: 'جارٍ',
      ageing1to30: '1–30 يومًا',
      ageing31to60: '31–60 يومًا',
      ageing61to90: '61–90 يومًا',
      ageingOver90: 'أكثر من 90 يومًا',
      creditLimit: 'حد الائتمان',
      overLimit: 'تجاوز الحد',
      paymentTerms: 'شروط السداد',
      projectsTitle: 'المشاريع',
      emptyProjectsTitle: 'لا توجد مشاريع',
      emptyProjectsBody: 'المشروع هو المكان الذي يجتمع فيه العمل والأفراد والمواد والفواتير الخاصة بهذا العميل.',
      colProject: 'المشروع',
      colStatus: 'الحالة',
      colSite: 'الموقع',
      colTeam: 'الفريق',
      colBudget: 'الميزانية',
      notPinned: 'غير محدد',
      goodsTitle: 'البضائع',
      goodsCaption: 'المنتجات المُسلَّمة لهذا العميل، وما تم إرجاعه',
      colProduct: 'المنتج',
      colDelivered: 'المُسلَّم',
      colReturned: 'المُرتجَع',
      colDamaged: 'التالف',
      colRetained: 'المحتفَظ به',
      billsTitle: 'الفواتير',
      emptyBillsTitle: 'لا توجد فواتير',
      emptyBillsBody: 'لم يتم إصدار أي فاتورة لهذا العميل بعد.',
      colNumber: 'الرقم',
      colIssued: 'الإصدار',
      colDue: 'الاستحقاق',
      colTotal: 'الإجمالي',
      colOutstanding: 'المستحق',
      settled: 'مُسدَّد',
      daysLate: 'يوم تأخير',
      activityTitle: 'النشاط',
      emptyActivityTitle: 'لم يحدث شيء بعد',
      emptyActivityBody: 'تظهر هنا المشاريع والفواتير والمدفوعات وحركات البضائع فور حدوثها.',
    },
    print: {
      backToClient: 'العودة إلى العميل',
      statementOverline: 'كشف حساب · كما في',
      billedToDate: 'المفوتر حتى الآن',
      collected: 'المحصَّل',
      outstanding: 'المستحق',
      overdue: 'المتأخر',
      openBillsTitle: 'الفواتير المفتوحة',
      nothingOutstanding: 'لا يوجد مستحقات.',
      colBill: 'الفاتورة',
      colIssued: 'الإصدار',
      colDue: 'الاستحقاق',
      colTotal: 'الإجمالي',
      colOutstanding: 'المستحق',
      colOverdue: 'المتأخر',
      producedBy: 'صادر عن',
    },
  },
  },
};
