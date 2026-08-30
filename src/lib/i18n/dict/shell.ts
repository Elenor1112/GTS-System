/** Chrome shared by every screen: nav, buttons, preferences. */
export interface ShellDict {
  common: {
    save: string;
    cancel: string;
    edit: string;
    delete: string;
    create: string;
    filter: string;
    clear: string;
    search: string;
    print: string;
    back: string;
    yes: string;
    no: string;
    any: string;
    none: string;
    active: string;
    inactive: string;
    includeInactive: string;
    loading: string;
  };
  nav: {
    dashboard: string;
    notifications: string;
    accounts: string;
    bills: string;
    clients: string;
    vendors: string;
    projects: string;
    storage: string;
    products: string;
    employees: string;
    attendance: string;
    leave: string;
    reports: string;
    users: string;
    permissions: string;
    audit: string;
    admin: string;
    accounting: string;
    warehouses: string;
    humanResources: string;
    system: string;
    more: string;
    home: string;
    checkIn: string;
    alerts: string;
    account: string;
    signOut: string;
    help: string;
  };
  preferences: {
    appearance: string;
    light: string;
    dark: string;
    system: string;
    language: string;
    english: string;
    arabic: string;
  };
  auth: {
    tagline: string;
    title: string;
    sessionExpired: string;
    forbidden: string;
    emailLabel: string;
    passwordLabel: string;
    signingIn: string;
    signIn: string;
    devHint: string;
  };
}

export const en: ShellDict = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    create: 'Create',
    filter: 'Filter',
    clear: 'Clear',
    search: 'Search',
    print: 'Print',
    back: 'Back',
    yes: 'Yes',
    no: 'No',
    any: 'Any',
    none: 'None',
    active: 'Active',
    inactive: 'Inactive',
    includeInactive: 'Include inactive',
    loading: 'Loading…',
  },
  nav: {
    dashboard: 'Dashboard',
    notifications: 'Notifications',
    accounts: 'Accounts',
    bills: 'Electronic bills',
    clients: 'Clients',
    vendors: 'Vendors',
    projects: 'Projects',
    storage: 'Warehouses',
    products: 'Products',
    employees: 'Employees',
    attendance: 'Attendance',
    leave: 'Leave',
    reports: 'Reports',
    users: 'Users',
    permissions: 'Permissions',
    audit: 'Audit log',
    admin: 'Administration',
    accounting: 'Accounting',
    warehouses: 'Warehouses',
    humanResources: 'Human Resources',
    system: 'System',
    more: 'More',
    home: 'Home',
    checkIn: 'Check in',
    alerts: 'Alerts',
    account: 'Your account',
    signOut: 'Sign out',
    help: 'Help',
  },
  preferences: {
    appearance: 'Appearance',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    language: 'Language',
    english: 'English',
    arabic: 'العربية',
  },
  auth: {
    tagline: 'Business operating system',
    title: 'Sign in',
    sessionExpired: 'Your session ended. Sign in again to continue.',
    forbidden: 'You do not have permission to open that page.',
    emailLabel: 'Email address',
    passwordLabel: 'Password',
    signingIn: 'Signing in…',
    signIn: 'Sign in',
    devHint: 'Development sign-in —',
  },
};

export const ar: ShellDict = {
  common: {
    save: 'حفظ',
    cancel: 'إلغاء',
    edit: 'تعديل',
    delete: 'حذف',
    create: 'إنشاء',
    filter: 'تصفية',
    clear: 'مسح',
    search: 'بحث',
    print: 'طباعة',
    back: 'رجوع',
    yes: 'نعم',
    no: 'لا',
    any: 'أي',
    none: 'لا شيء',
    active: 'نشط',
    inactive: 'غير نشط',
    includeInactive: 'تضمين غير النشطين',
    loading: 'جارٍ التحميل…',
  },
  nav: {
    dashboard: 'لوحة التحكم',
    notifications: 'الإشعارات',
    accounts: 'الحسابات',
    bills: 'الفواتير الإلكترونية',
    clients: 'العملاء',
    vendors: 'الموردون',
    projects: 'المشاريع',
    storage: 'المخازن',
    products: 'المنتجات',
    employees: 'الموظفون',
    attendance: 'الحضور',
    leave: 'الإجازات',
    reports: 'التقارير',
    users: 'المستخدمون',
    permissions: 'الصلاحيات',
    audit: 'سجل التدقيق',
    admin: 'الإدارة',
    accounting: 'المحاسبة',
    warehouses: 'المخازن',
    humanResources: 'الموارد البشرية',
    system: 'النظام',
    more: 'المزيد',
    home: 'الرئيسية',
    checkIn: 'تسجيل الحضور',
    alerts: 'التنبيهات',
    account: 'حسابك',
    signOut: 'تسجيل الخروج',
    help: 'المساعدة',
  },
  preferences: {
    appearance: 'المظهر',
    light: 'فاتح',
    dark: 'داكن',
    system: 'النظام',
    language: 'اللغة',
    english: 'English',
    arabic: 'العربية',
  },
  auth: {
    tagline: 'نظام إدارة الأعمال',
    title: 'تسجيل الدخول',
    sessionExpired: 'انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.',
    forbidden: 'ليست لديك صلاحية لفتح هذه الصفحة.',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    signingIn: 'جارٍ تسجيل الدخول…',
    signIn: 'تسجيل الدخول',
    devHint: 'تسجيل دخول تجريبي —',
  },
};
