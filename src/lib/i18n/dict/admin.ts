/**
 * Administration module: Admin settings, Users, Permissions, Audit log,
 * and the signed-in person's own Account page.
 */
export interface AdminDict {
  admin: {
    settings: {
      overline: string;
      title: string;
      lede: string;
      noTrnWarning: string;
      savedNotice: string;
      taxIdentity: {
        legend: string;
        help: string;
        orgNameLabel: string;
        orgNameArLabel: string;
        trnLabel: string;
        trnHint: string;
        commercialRegLabel: string;
        commercialRegHint: string;
        governorateLabel: string;
        addressLabel: string;
      };
      attendance: {
        legend: string;
        help: string;
        workStartLabel: string;
        workStartHint: string;
        workEndLabel: string;
        lateThresholdLabel: string;
        lateThresholdHint: string;
        defaultRadiusLabel: string;
        defaultRadiusHint: string;
        maxAccuracyLabel: string;
        maxAccuracyHint: string;
      };
      billing: {
        legend: string;
        help: string;
        paymentTermsLabel: string;
      };
      saveButton: string;
      savingButton: string;
      market: {
        title: string;
        currency: string;
        standardVat: string;
        withholdingThreshold: string;
        workingWeek: string;
        workingWeekValue: string;
        timezone: string;
        governorates: string;
        note: string;
      };
      eta: {
        title: string;
        documentFormat: string;
        implemented: string;
        transmission: string;
        notConfigured: string;
        body: string;
      };
      system: {
        title: string;
        activeUsers: string;
        employees: string;
        projects: string;
        bills: string;
        stockMovements: string;
        auditEntries: string;
        signedInAs: string;
      };
    };
    users: {
      overline: string;
      title: string;
      ledeAccounts: string;
      ledeAdministrators: string;
      lastAdminWarning: string;
      includeDeactivated: string;
      apply: string;
      accountsRegion: string;
      emptyTitle: string;
      emptyBody: string;
      tableCaption: string;
      table: {
        user: string;
        role: string;
        employee: string;
        lastSignedIn: string;
        status: string;
      };
      noEmployeeRecord: string;
      never: string;
      activeSession: string;
      activeSessions: string;
      statusActive: string;
      statusDeactivated: string;
      newAccountRegion: string;
      employeesRegion: string;
      employeesBody: string;
      openEmployees: string;
      row: {
        newPasswordPlaceholder: string;
        roleLabel: string;
        set: string;
        cancel: string;
        resetPassword: string;
        deactivate: string;
        reactivate: string;
      };
      form: {
        createdNotice: string;
        nameLabel: string;
        emailLabel: string;
        nameArLabel: string;
        phoneLabel: string;
        roleLabel: string;
        rolePlaceholder: string;
        passwordLabel: string;
        passwordHint: string;
        createButton: string;
        creatingButton: string;
      };
    };
    permissions: {
      overline: string;
      title: string;
      lede: string;
      matrix: {
        title: string;
        caption: string;
        permissionHeader: string;
        allBadge: string;
        mayLabel: string;
        notHeld: string;
      };
      systemRoleBadge: string;
      userCount: string;
      userCountPlural: string;
      adminLocked: string;
      form: {
        savedNotice: string;
        clearAll: string;
        selectAll: string;
        saveButton: string;
        savingButton: string;
        selected: string;
      };
    };
    audit: {
      overline: string;
      title: string;
      lede: string;
      filter: {
        actionLabel: string;
        anyAction: string;
        personLabel: string;
        anybody: string;
        recordLabel: string;
        anyRecord: string;
        filterButton: string;
        clearButton: string;
      };
      emptyTitle: string;
      emptyBodyFiltered: string;
      emptyBodyDefault: string;
      tableCaption: string;
      table: {
        when: string;
        who: string;
        action: string;
        record: string;
        whatChanged: string;
        from: string;
      };
      notSignedIn: string;
      pagination: {
        label: string;
        newer: string;
        older: string;
        pageOf: string;
      };
    };
    account: {
      overline: string;
      email: string;
      role: string;
      employee: string;
      lastSignedIn: string;
      activeSessions: string;
      administeredNote: string;
      passwordSectionTitle: string;
      passwordForm: {
        successNotice: string;
        currentPasswordLabel: string;
        newPasswordLabel: string;
        newPasswordHint: string;
        confirmPasswordLabel: string;
        changeButton: string;
        changingButton: string;
      };
    };
  };
}

export const en: AdminDict = {
  admin: {
    settings: {
      overline: 'System',
      title: 'Administration',
      lede: 'The values the business logic reads. Changing the geofence radius or the late threshold changes what the server accepts, not merely what a screen displays.',
      noTrnWarning: 'No tax registration number is set for this organisation. Every invoice you issue is missing the issuer TRN, which makes it invalid as an Egyptian tax document.',
      savedNotice: 'Saved. The new values apply to the next check-in and the next bill raised.',
      taxIdentity: {
        legend: 'Tax identity',
        help: 'Printed on every invoice as the issuer. An invoice without a valid 9-digit registration number is not a valid Egyptian tax document.',
        orgNameLabel: 'Organisation name',
        orgNameArLabel: 'Organisation name (Arabic)',
        trnLabel: 'Tax registration number',
        trnHint: '9 digits, issued by the Egyptian Tax Authority',
        commercialRegLabel: 'Commercial register',
        commercialRegHint: 'Issued by GAFI',
        governorateLabel: 'Governorate',
        addressLabel: 'Address',
      },
      attendance: {
        legend: 'Attendance',
        help: 'These decide what the server accepts. A check-in outside the radius, or from a fix coarser than the accuracy limit, is refused — raising these values widens what counts as being on site.',
        workStartLabel: 'Working day starts',
        workStartHint: '24-hour, Cairo time',
        workEndLabel: 'Working day ends',
        lateThresholdLabel: 'Late after (minutes)',
        lateThresholdHint: 'Grace period before a check-in is marked late',
        defaultRadiusLabel: 'Default site radius (metres)',
        defaultRadiusHint: 'Suggested when a new project location is pinned',
        maxAccuracyLabel: 'Refuse a fix coarser than (metres)',
        maxAccuracyHint: 'Below this, a position cannot tell inside a site from outside it',
      },
      billing: {
        legend: 'Billing',
        help: 'Applied when a counterparty has no terms of their own. VAT and the withholding threshold are statutory and are not set here.',
        paymentTermsLabel: 'Default payment terms (days)',
      },
      saveButton: 'Save settings',
      savingButton: 'Saving…',
      market: {
        title: 'Market',
        currency: 'Currency',
        standardVat: 'Standard VAT',
        withholdingThreshold: 'Withholding threshold',
        workingWeek: 'Working week',
        workingWeekValue: 'Sunday – Thursday',
        timezone: 'Timezone',
        governorates: 'Governorates',
        note: 'Statutory values, set in src/lib/egypt.ts rather than here — VAT is 14% because Law 67 of 2016 says so, not because somebody chose it.',
      },
      eta: {
        title: 'Egyptian Tax Authority e-invoicing',
        documentFormat: 'Document format',
        implemented: 'Implemented',
        transmission: 'Transmission',
        notConfigured: 'Not configured',
        body: 'Bills are produced in the ETA’s shape: both parties’ registration numbers, GPC item codes, per-line VAT and the required document fields. They are not transmitted. Submission needs taxpayer credentials, a client id and secret, and an e-seal certificate to sign the canonical serialisation — none of which can live in this repository. No document shows a UUID, because none has been issued; inventing one would fabricate a compliance record.',
      },
      system: {
        title: 'System',
        activeUsers: 'Active users',
        employees: 'Employees',
        projects: 'Projects',
        bills: 'Bills',
        stockMovements: 'Stock movements',
        auditEntries: 'Audit entries',
        signedInAs: 'Signed in as',
      },
    },
    users: {
      overline: 'System',
      title: 'Users',
      ledeAccounts: 'account',
      ledeAdministrators: 'administrator',
      lastAdminWarning: 'There is only one administrator. If that account is lost, nobody can administer the system — the last administrator cannot be demoted or deactivated for exactly that reason. Consider promoting a second.',
      includeDeactivated: 'Include deactivated',
      apply: 'Apply',
      accountsRegion: 'Accounts',
      emptyTitle: 'No users',
      emptyBody: 'Nobody can sign in yet.',
      tableCaption: 'User accounts, their roles and employee links',
      table: {
        user: 'User',
        role: 'Role',
        employee: 'Employee',
        lastSignedIn: 'Last signed in',
        status: 'Status',
      },
      noEmployeeRecord: 'no employee record',
      never: 'never',
      activeSession: 'active session',
      activeSessions: 'active sessions',
      statusActive: 'active',
      statusDeactivated: 'deactivated',
      newAccountRegion: 'New account',
      employeesRegion: 'Employees',
      employeesBody: 'The employee directory, with filters by position, department and project, has its own page.',
      openEmployees: 'Open employees',
      row: {
        newPasswordPlaceholder: 'New password for',
        roleLabel: 'Role for',
        set: 'Set',
        cancel: 'Cancel',
        resetPassword: 'Reset password',
        deactivate: 'Deactivate',
        reactivate: 'Reactivate',
      },
      form: {
        createdNotice: 'Created. They can sign in with the password you set.',
        nameLabel: 'Name',
        emailLabel: 'Email address',
        nameArLabel: 'Name (Arabic)',
        phoneLabel: 'Phone',
        roleLabel: 'Role',
        rolePlaceholder: 'Select a role',
        passwordLabel: 'Password',
        passwordHint: 'At least 12 characters. Length matters more than symbols.',
        createButton: 'Create account',
        creatingButton: 'Creating…',
      },
    },
    permissions: {
      overline: 'System',
      title: 'Permissions',
      lede: 'roles across {modules} modules. Every one of these keys is checked on the server before the action runs — hiding a button is a courtesy, not a control.',
      matrix: {
        title: 'Access matrix',
        caption: 'Which permissions each role holds, by module',
        permissionHeader: 'Permission',
        allBadge: 'all',
        mayLabel: 'may',
        notHeld: 'not held',
      },
      systemRoleBadge: 'system role',
      userCount: 'user',
      userCountPlural: 'users',
      adminLocked: 'The administrator role holds every permission implicitly, so there is nothing to tick or untick — a reduced set here would appear to save and change nothing. Create a separate role if somebody needs narrower access.',
      form: {
        savedNotice: 'Saved — this role now holds {count} permissions. Anyone signed in with this role is affected on their next request.',
        clearAll: 'Clear all',
        selectAll: 'Select all',
        saveButton: 'Save permissions',
        savingButton: 'Saving…',
        selected: 'selected',
      },
    },
    audit: {
      overline: 'System',
      title: 'Audit log',
      lede: 'recorded actions. Entries are never edited or deleted — a correction is a new entry, so the history of what was believed, and when, survives.',
      filter: {
        actionLabel: 'Action',
        anyAction: 'Any action',
        personLabel: 'Person',
        anybody: 'Anybody',
        recordLabel: 'Record type',
        anyRecord: 'Any record',
        filterButton: 'Filter',
        clearButton: 'Clear',
      },
      emptyTitle: 'Nothing recorded',
      emptyBodyFiltered: 'No entry matches that filter.',
      emptyBodyDefault: 'Actions appear here as they happen.',
      tableCaption: 'Audit entries, newest first',
      table: {
        when: 'When',
        who: 'Who',
        action: 'Action',
        record: 'Record',
        whatChanged: 'What changed',
        from: 'From',
      },
      notSignedIn: 'not signed in',
      pagination: {
        label: 'Audit log pages',
        newer: 'Newer',
        older: 'Older',
        pageOf: 'Page {page} of {pages}',
      },
    },
    account: {
      overline: 'Your account',
      email: 'Email',
      role: 'Role',
      employee: 'Employee',
      lastSignedIn: 'Last signed in',
      activeSessions: 'Active sessions',
      administeredNote: 'Your name, role and employee record are administered from Users. Ask an administrator if any of them is wrong.',
      passwordSectionTitle: 'Change your password',
      passwordForm: {
        successNotice: 'Your password has been changed. Any other device you were signed in on has been signed out.',
        currentPasswordLabel: 'Current password',
        newPasswordLabel: 'New password',
        newPasswordHint: 'At least 12 characters. Length is what resists cracking — a passphrase beats a short password with symbols in it.',
        confirmPasswordLabel: 'Confirm new password',
        changeButton: 'Change password',
        changingButton: 'Changing…',
      },
    },
  },
};

export const ar: AdminDict = {
  admin: {
    settings: {
      overline: 'النظام',
      title: 'الإدارة',
      lede: 'القيم التي يعتمد عليها منطق العمل. تغيير نصف قطر السياج الجغرافي أو حد التأخير يغيّر ما يقبله الخادم فعليًا، وليس فقط ما تعرضه الشاشة.',
      noTrnWarning: 'لا يوجد رقم تسجيل ضريبي محدد لهذه المؤسسة. كل فاتورة تصدرها تفتقد الرقم الضريبي للجهة المُصدرة، مما يجعلها مستندًا ضريبيًا مصريًا غير صالح.',
      savedNotice: 'تم الحفظ. تُطبَّق القيم الجديدة على عملية تسجيل الحضور القادمة وعلى الفاتورة القادمة.',
      taxIdentity: {
        legend: 'الهوية الضريبية',
        help: 'تُطبع على كل فاتورة باعتبارها بيانات الجهة المُصدرة. الفاتورة بدون رقم تسجيل صحيح مكوّن من 9 أرقام ليست مستندًا ضريبيًا مصريًا صالحًا.',
        orgNameLabel: 'اسم المؤسسة',
        orgNameArLabel: 'اسم المؤسسة (بالعربية)',
        trnLabel: 'رقم التسجيل الضريبي',
        trnHint: '9 أرقام، صادر عن مصلحة الضرائب المصرية',
        commercialRegLabel: 'السجل التجاري',
        commercialRegHint: 'صادر عن الهيئة العامة للاستثمار (GAFI)',
        governorateLabel: 'المحافظة',
        addressLabel: 'العنوان',
      },
      attendance: {
        legend: 'الحضور',
        help: 'هذه القيم تحدد ما يقبله الخادم. يُرفض تسجيل الحضور خارج نصف القطر، أو من موقع أقل دقة من الحد المسموح به — رفع هذه القيم يوسّع ما يُعتبر تواجدًا في الموقع.',
        workStartLabel: 'بداية يوم العمل',
        workStartHint: 'نظام 24 ساعة، بتوقيت القاهرة',
        workEndLabel: 'نهاية يوم العمل',
        lateThresholdLabel: 'التأخير بعد (بالدقائق)',
        lateThresholdHint: 'فترة السماح قبل اعتبار تسجيل الحضور متأخرًا',
        defaultRadiusLabel: 'نصف قطر الموقع الافتراضي (بالمتر)',
        defaultRadiusHint: 'يُقترح عند تحديد موقع مشروع جديد',
        maxAccuracyLabel: 'رفض القراءة إذا تجاوزت دقتها (بالمتر)',
        maxAccuracyHint: 'أقل من هذا الحد، لا يمكن للموقع تمييز الداخل من الخارج',
      },
      billing: {
        legend: 'الفوترة',
        help: 'تُطبَّق عندما لا يكون للطرف الآخر شروط خاصة به. ضريبة القيمة المضافة وحد الخصم عند المنبع قيم قانونية ولا تُضبط من هنا.',
        paymentTermsLabel: 'شروط السداد الافتراضية (بالأيام)',
      },
      saveButton: 'حفظ الإعدادات',
      savingButton: 'جارٍ الحفظ…',
      market: {
        title: 'السوق',
        currency: 'العملة',
        standardVat: 'ضريبة القيمة المضافة الأساسية',
        withholdingThreshold: 'حد الخصم عند المنبع',
        workingWeek: 'أسبوع العمل',
        workingWeekValue: 'الأحد – الخميس',
        timezone: 'المنطقة الزمنية',
        governorates: 'المحافظات',
        note: 'قيم قانونية، مُحددة في src/lib/egypt.ts وليس هنا — ضريبة القيمة المضافة 14% لأن القانون 67 لسنة 2016 ينص على ذلك، وليس لأن أحدًا اختارها.',
      },
      eta: {
        title: 'الفوترة الإلكترونية لمصلحة الضرائب المصرية',
        documentFormat: 'صيغة المستند',
        implemented: 'مُنفَّذ',
        transmission: 'الإرسال',
        notConfigured: 'غير مُهيَّأ',
        body: 'تُنتَج الفواتير بصيغة مصلحة الضرائب: أرقام تسجيل الطرفين، رموز أصناف GPC، ضريبة القيمة المضافة لكل بند، وحقول المستند المطلوبة. لا تُرسَل هذه الفواتير. الإرسال يتطلب بيانات اعتماد المكلف، ومعرّف وسر العميل، وشهادة الختم الإلكتروني لتوقيع التسلسل القياسي — لا شيء من هذا يمكن أن يوجد في هذا المستودع. لا يظهر أي مستند برقم UUID لأنه لم يُصدر أي منها؛ واختلاق واحد سيكون تزويرًا لسجل امتثال.',
      },
      system: {
        title: 'النظام',
        activeUsers: 'المستخدمون النشطون',
        employees: 'الموظفون',
        projects: 'المشاريع',
        bills: 'الفواتير',
        stockMovements: 'حركات المخزون',
        auditEntries: 'سجلات التدقيق',
        signedInAs: 'مسجّل الدخول باسم',
      },
    },
    users: {
      overline: 'النظام',
      title: 'المستخدمون',
      ledeAccounts: 'حساب',
      ledeAdministrators: 'مسؤول',
      lastAdminWarning: 'يوجد مسؤول واحد فقط. في حال فقدان هذا الحساب، لن يتمكن أحد من إدارة النظام — لهذا السبب بالتحديد لا يمكن تخفيض رتبة آخر مسؤول أو إلغاء تفعيله. يُنصح بترقية مسؤول ثانٍ.',
      includeDeactivated: 'تضمين المُعطَّلين',
      apply: 'تطبيق',
      accountsRegion: 'الحسابات',
      emptyTitle: 'لا يوجد مستخدمون',
      emptyBody: 'لا يمكن لأحد تسجيل الدخول بعد.',
      tableCaption: 'حسابات المستخدمين وأدوارهم وروابطهم الوظيفية',
      table: {
        user: 'المستخدم',
        role: 'الدور',
        employee: 'الموظف',
        lastSignedIn: 'آخر تسجيل دخول',
        status: 'الحالة',
      },
      noEmployeeRecord: 'لا يوجد سجل موظف',
      never: 'أبدًا',
      activeSession: 'جلسة نشطة',
      activeSessions: 'جلسات نشطة',
      statusActive: 'نشط',
      statusDeactivated: 'مُعطَّل',
      newAccountRegion: 'حساب جديد',
      employeesRegion: 'الموظفون',
      employeesBody: 'لدليل الموظفين، بفلاتر حسب المنصب والقسم والمشروع، صفحة خاصة به.',
      openEmployees: 'فتح صفحة الموظفين',
      row: {
        newPasswordPlaceholder: 'كلمة مرور جديدة لـ',
        roleLabel: 'الدور لـ',
        set: 'تعيين',
        cancel: 'إلغاء',
        resetPassword: 'إعادة تعيين كلمة المرور',
        deactivate: 'تعطيل',
        reactivate: 'إعادة التفعيل',
      },
      form: {
        createdNotice: 'تم الإنشاء. يمكنهم تسجيل الدخول بكلمة المرور التي حددتها.',
        nameLabel: 'الاسم',
        emailLabel: 'البريد الإلكتروني',
        nameArLabel: 'الاسم (بالعربية)',
        phoneLabel: 'الهاتف',
        roleLabel: 'الدور',
        rolePlaceholder: 'اختر دورًا',
        passwordLabel: 'كلمة المرور',
        passwordHint: '12 حرفًا على الأقل. الطول أهم من الرموز.',
        createButton: 'إنشاء حساب',
        creatingButton: 'جارٍ الإنشاء…',
      },
    },
    permissions: {
      overline: 'النظام',
      title: 'الصلاحيات',
      lede: 'دورًا عبر {modules} وحدة. يتحقق الخادم من كل مفتاح من هذه المفاتيح قبل تنفيذ الإجراء — إخفاء زر هو مجاملة، وليس ضبطًا فعليًا.',
      matrix: {
        title: 'مصفوفة الصلاحيات',
        caption: 'الصلاحيات التي يملكها كل دور، حسب الوحدة',
        permissionHeader: 'الصلاحية',
        allBadge: 'الكل',
        mayLabel: 'يستطيع',
        notHeld: 'غير ممنوحة',
      },
      systemRoleBadge: 'دور نظامي',
      userCount: 'مستخدم',
      userCountPlural: 'مستخدمين',
      adminLocked: 'يملك دور المسؤول جميع الصلاحيات ضمنيًا، فلا يوجد ما يمكن تحديده أو إلغاؤه — أي مجموعة مخفَّضة هنا ستبدو وكأنها حُفظت دون أي تغيير فعلي. أنشئ دورًا منفصلًا إذا احتاج أحدهم إلى صلاحيات أضيق.',
      form: {
        savedNotice: 'تم الحفظ — يملك هذا الدور الآن {count} صلاحية. يتأثر كل من يسجّل الدخول بهذا الدور في طلبه التالي.',
        clearAll: 'إلغاء تحديد الكل',
        selectAll: 'تحديد الكل',
        saveButton: 'حفظ الصلاحيات',
        savingButton: 'جارٍ الحفظ…',
        selected: 'محدد',
      },
    },
    audit: {
      overline: 'النظام',
      title: 'سجل التدقيق',
      lede: 'إجراء مسجَّل. لا تُعدَّل أو تُحذف السجلات أبدًا — أي تصحيح هو سجل جديد، بحيث يبقى تاريخ ما كان معتقَدًا، ومتى، محفوظًا.',
      filter: {
        actionLabel: 'الإجراء',
        anyAction: 'أي إجراء',
        personLabel: 'الشخص',
        anybody: 'أي شخص',
        recordLabel: 'نوع السجل',
        anyRecord: 'أي سجل',
        filterButton: 'تصفية',
        clearButton: 'مسح',
      },
      emptyTitle: 'لا يوجد شيء مسجَّل',
      emptyBodyFiltered: 'لا يوجد سجل يطابق هذا الفلتر.',
      emptyBodyDefault: 'تظهر الإجراءات هنا فور حدوثها.',
      tableCaption: 'سجلات التدقيق، الأحدث أولاً',
      table: {
        when: 'الوقت',
        who: 'من',
        action: 'الإجراء',
        record: 'السجل',
        whatChanged: 'ما الذي تغيّر',
        from: 'من عنوان',
      },
      notSignedIn: 'لم يسجّل الدخول',
      pagination: {
        label: 'صفحات سجل التدقيق',
        newer: 'الأحدث',
        older: 'الأقدم',
        pageOf: 'صفحة {page} من {pages}',
      },
    },
    account: {
      overline: 'حسابك',
      email: 'البريد الإلكتروني',
      role: 'الدور',
      employee: 'الموظف',
      lastSignedIn: 'آخر تسجيل دخول',
      activeSessions: 'الجلسات النشطة',
      administeredNote: 'يُدار اسمك ودورك وسجل توظيفك من صفحة المستخدمين. اسأل أحد المسؤولين إذا كان أي منها غير صحيح.',
      passwordSectionTitle: 'تغيير كلمة المرور',
      passwordForm: {
        successNotice: 'تم تغيير كلمة المرور الخاصة بك. تم تسجيل الخروج من أي جهاز آخر كنت مسجّلاً فيه.',
        currentPasswordLabel: 'كلمة المرور الحالية',
        newPasswordLabel: 'كلمة المرور الجديدة',
        newPasswordHint: '12 حرفًا على الأقل. الطول هو ما يقاوم الاختراق — عبارة مرور أفضل من كلمة مرور قصيرة تحوي رموزًا.',
        confirmPasswordLabel: 'تأكيد كلمة المرور الجديدة',
        changeButton: 'تغيير كلمة المرور',
        changingButton: 'جارٍ التغيير…',
      },
    },
  },
};
