/** Attendance, leave and the employee directory. */
export interface PeopleDict {
  people: {
  attendance: {
    overline: string;
    title: string;
    noEmployee: {
      title: string;
      body: string;
    };
    noSite: {
      title: string;
      body: string;
    };
    history: {
      title: string;
      workingDayNote: string; // e.g. "Working day starts {start} · late after {n} minutes"
      empty: {
        title: string;
        body: string;
      };
      dateHeader: string;
      projectHeader: string;
      inHeader: string;
      outHeader: string;
      statusHeader: string;
      distanceHeader: string;
    };
    checkIn: {
      checkedIn: string;
      distanceFromSite: string; // "{n}m from the site centre"
      minutesLate: string; // "{n} minutes late"
      checkedOut: string; // "Checked out {time}"
      distanceToSite: string;
      opensWithin: string; // "Check-in opens within {n}m"
      fixAccurate: string; // "fix accurate to {n}m"
      opensWithinBody: string; // full sentence for when there's no fix yet
      dayRecorded: string;
      checkOut: string;
      recording: string;
      attend: string;
      attendHint: string;
      findingYou: string;
      findingYouHint: string;
      tryAgain: string;
      checkInLabel: string;
      almostThere: string;
      tooFar: string;
      onSiteHint: string;
      offSiteHint: string;
      siteBoundary: string;
      siteBoundaryBody: string; // "{radius}m radius, set by your administrator..."
      openInMaps: string;
      cannotReportLocation: string;
      locationDenied: string;
      locationTimeout: string;
      locationUnavailable: string;
    };
  };
  leave: {
    overline: string;
    title: string;
    ledeWaiting: string; // "{n} request(s) waiting on you"
    ledeLaw: string;
    noEmployee: {
      title: string;
      body: string;
    };
    balances: {
      title: string; // "Your balances · {year}"
      empty: {
        title: string;
        body: string;
      };
      ofDays: string; // "of {n} days"
      taken: string; // "{n} taken"
      reservedPending: string; // "· {n} reserved by a pending request"
    };
    request: {
      title: string;
      typeLabel: string;
      typePlaceholder: string;
      unpaidSuffix: string;
      documentRequiredSuffix: string;
      firstDayLabel: string;
      lastDayLabel: string;
      reasonLabel: string;
      reasonPlaceholder: string;
      submit: string;
      submitting: string;
      allWeekend: string;
      workingDaysNote: string; // "{n} working day(s). Friday and Saturday are not counted."
      successMessage: string; // "Request {ref} submitted — {n} working days..."
    };
    queue: {
      title: string; // "Awaiting decision ({n})"
      empty: {
        title: string;
        body: string;
      };
      employeeHeader: string;
      typeHeader: string;
      fromHeader: string;
      toHeader: string;
      workingDaysHeader: string;
      leftAfterHeader: string;
      reasonHeader: string;
      unpaid: string;
    };
    myRequests: {
      title: string;
      empty: {
        title: string;
        body: string;
      };
      referenceHeader: string;
      typeHeader: string;
      fromHeader: string;
      toHeader: string;
      daysHeader: string;
      statusHeader: string;
      decidedByHeader: string;
    };
    away: {
      title: string;
      empty: {
        title: string;
        body: string;
      };
      until: string; // "until {date}"
    };
    decision: {
      rejectReasonPlaceholder: string; // "Why is {reference} rejected?"
      rejectReasonLabel: string; // "Reason for rejecting {reference}"
      reject: string;
      cancel: string;
      approve: string;
      deciding: string;
    };
  };
  employees: {
    overline: string;
    title: string;
    countLede: string; // "{n} employee(s)"
    newEmployee: string;
    newPage: {
      overline: string;
      title: string;
      lede: string;
    };
    editPage: {
      editTitle: string;
    };
    form: {
      codeLabel: string;
      codeHint: string;
      nameEnLabel: string;
      nameArLabel: string;
      jobTitleEnLabel: string;
      jobTitleArLabel: string;
      departmentLabel: string;
      nationalIdLabel: string;
      nationalIdHint: string;
      insuranceNoLabel: string;
      insuranceNoHint: string;
      phoneLabel: string;
      emailLabel: string;
      hiredOnLabel: string;
      dailyRateLabel: string;
      dailyRateHint: string;
      createEmployee: string;
      saveChanges: string;
      creating: string;
      saving: string;
      cancel: string;
    };
    filters: {
      searchLabel: string;
      searchPlaceholder: string;
      positionLabel: string;
      anyPosition: string;
      departmentLabel: string;
      anyDepartment: string;
      projectLabel: string;
      anyProject: string;
      includeInactive: string;
      filter: string;
      clear: string;
    };
    list: {
      caption: string;
      employeeHeader: string;
      positionHeader: string;
      departmentHeader: string;
      projectsHeader: string;
      hiredHeader: string;
      loginHeader: string;
      noLogin: string;
    };
    empty: {
      noMatchTitle: string;
      noneYetTitle: string;
      filteredBody: string;
      emptyBody: string;
    };
  };
  };
}

export const en: PeopleDict = {
  people: {
  attendance: {
    overline: 'Attendance',
    title: 'Where you are',
    noEmployee: {
      title: 'No employee record',
      body: 'Your login is not linked to an employee, so there is no attendance to record. An administrator can link it from the Users screen.',
    },
    noSite: {
      title: 'No site assigned',
      body: 'You are not currently assigned to a project with a pinned location. Attendance opens as soon as somebody assigns you to one.',
    },
    history: {
      title: 'Your last fortnight',
      workingDayNote: 'Working day starts {start} · late after {minutes} minutes',
      empty: {
        title: 'No attendance recorded yet',
        body: 'Your check-ins appear here once you record the first one.',
      },
      dateHeader: 'Date',
      projectHeader: 'Project',
      inHeader: 'In',
      outHeader: 'Out',
      statusHeader: 'Status',
      distanceHeader: 'Distance',
    },
    checkIn: {
      checkedIn: 'Checked in',
      distanceFromSite: '{distance}m from the site centre',
      minutesLate: '{minutes} minutes late',
      checkedOut: 'Checked out {time}',
      distanceToSite: 'Distance to site',
      opensWithin: 'Check-in opens within {radius}m',
      fixAccurate: 'fix accurate to {accuracy}m',
      opensWithinBody:
        'Check-in opens within {radius}m of the site. Your position is checked again on the server before anything is recorded.',
      dayRecorded: 'Day recorded',
      checkOut: 'Check out',
      recording: 'Recording…',
      attend: 'Attend',
      attendHint: 'Uses your location to confirm you are on site',
      findingYou: 'Finding you…',
      findingYouHint: 'Allow location access when prompted',
      tryAgain: 'Try again',
      checkInLabel: 'Check in',
      almostThere: 'Almost there',
      tooFar: 'Too far to check in',
      onSiteHint: "You're on site — tap to record your arrival",
      offSiteHint: 'Check-in unlocks inside the site boundary',
      siteBoundary: 'Site boundary',
      siteBoundaryBody:
        '{radius}m radius, set by your administrator. A fix accurate to worse than {maxAccuracy}m is refused — it cannot tell inside from outside.',
      openInMaps: 'Open in Google Maps',
      cannotReportLocation: 'This device cannot report its location.',
      locationDenied:
        'Location permission was refused. Attendance is recorded against the site you are standing on, so it cannot be taken without it.',
      locationTimeout: 'Finding your position took too long. Move into the open and try again.',
      locationUnavailable: 'Your position could not be determined.',
    },
  },
  leave: {
    overline: 'People',
    title: 'Leave',
    ledeWaiting: '{count} request{plural} waiting on you',
    ledeLaw:
      'Egyptian Labour Law 12/2003 — 21 days annual leave, rising to 30 after ten years’ service.',
    noEmployee: {
      title: 'No employee record',
      body: 'Your login is not linked to an employee, so there is no leave to request or balance to show.',
    },
    balances: {
      title: 'Your balances · {year}',
      empty: {
        title: 'No entitlement recorded',
        body: 'An administrator sets your annual entitlement from the Administration screen.',
      },
      ofDays: 'of {entitled} days',
      taken: '{taken} taken',
      reservedPending: ' · {pending} reserved by a pending request',
    },
    request: {
      title: 'Request leave',
      typeLabel: 'Type',
      typePlaceholder: 'Select a leave type',
      unpaidSuffix: ' — unpaid',
      documentRequiredSuffix: ' (document required)',
      firstDayLabel: 'First day',
      lastDayLabel: 'Last day',
      reasonLabel: 'Reason',
      reasonPlaceholder: 'Family visit',
      submit: 'Request leave',
      submitting: 'Submitting…',
      allWeekend: 'That range is entirely weekend — nothing to request.',
      workingDaysNote: '{days} working day{plural}. Friday and Saturday are not counted.',
      successMessage:
        'Request {ref} submitted — {days} working days. Those days are reserved from your balance until it is decided.',
    },
    queue: {
      title: 'Awaiting decision ({count})',
      empty: {
        title: 'Nothing waiting',
        body: 'Requests appear here the moment somebody submits one. Their balance stays reserved until you decide.',
      },
      employeeHeader: 'Employee',
      typeHeader: 'Type',
      fromHeader: 'From',
      toHeader: 'To',
      workingDaysHeader: 'Working days',
      leftAfterHeader: 'Left after',
      reasonHeader: 'Reason',
      unpaid: 'unpaid',
    },
    myRequests: {
      title: 'Your requests',
      empty: {
        title: 'You have not requested leave',
        body: 'Requests you submit appear here with their decision.',
      },
      referenceHeader: 'Reference',
      typeHeader: 'Type',
      fromHeader: 'From',
      toHeader: 'To',
      daysHeader: 'Days',
      statusHeader: 'Status',
      decidedByHeader: 'Decided by',
    },
    away: {
      title: 'Away today',
      empty: {
        title: 'Everybody is in',
        body: 'Nobody is on approved leave today.',
      },
      until: 'until {date}',
    },
    decision: {
      rejectReasonPlaceholder: 'Why is {reference} rejected?',
      rejectReasonLabel: 'Reason for rejecting {reference}',
      reject: 'Reject',
      cancel: 'Cancel',
      approve: 'Approve',
      deciding: '…',
    },
  },
  employees: {
    overline: 'People',
    title: 'Employees',
    countLede: '{count} employee{plural}',
    newEmployee: 'New employee',
    newPage: {
      overline: 'People',
      title: 'New employee',
      lede: 'Add someone to the directory. Their code is assigned automatically.',
    },
    editPage: {
      editTitle: 'Edit',
    },
    form: {
      codeLabel: 'Employee code',
      codeHint: 'Assigned automatically. Change it here if you need a different reference.',
      nameEnLabel: 'Name (English)',
      nameArLabel: 'Name (Arabic)',
      jobTitleEnLabel: 'Job title (English)',
      jobTitleArLabel: 'Job title (Arabic)',
      departmentLabel: 'Department',
      nationalIdLabel: 'National ID',
      nationalIdHint: '14 digits',
      insuranceNoLabel: 'Insurance number',
      insuranceNoHint: '9 digits, issued for payroll',
      phoneLabel: 'Phone',
      emailLabel: 'Email',
      hiredOnLabel: 'Hired on',
      dailyRateLabel: 'Daily rate',
      dailyRateHint: 'Used to cost attendance against a project',
      createEmployee: 'Create employee',
      saveChanges: 'Save changes',
      creating: 'Creating…',
      saving: 'Saving…',
      cancel: 'Cancel',
    },
    filters: {
      searchLabel: 'Search employees',
      searchPlaceholder: 'Name, code or email',
      positionLabel: 'Position',
      anyPosition: 'Any position',
      departmentLabel: 'Department',
      anyDepartment: 'Any department',
      projectLabel: 'Project',
      anyProject: 'Any project',
      includeInactive: 'Include inactive',
      filter: 'Filter',
      clear: 'Clear',
    },
    list: {
      caption: 'Employees, their position and current project assignments',
      employeeHeader: 'Employee',
      positionHeader: 'Position',
      departmentHeader: 'Department',
      projectsHeader: 'Projects',
      hiredHeader: 'Hired',
      loginHeader: 'Login',
      noLogin: 'none',
    },
    empty: {
      noMatchTitle: 'No employee matches',
      noneYetTitle: 'No employees yet',
      filteredBody: 'Try a different search, or clear the filter.',
      emptyBody: 'An employee is a person the business employs, whether or not they have a login.',
    },
  },
  },
};

export const ar: PeopleDict = {
  people: {
  attendance: {
    overline: 'الحضور',
    title: 'أين أنت',
    noEmployee: {
      title: 'لا يوجد سجل موظف',
      body: 'حسابك غير مرتبط بموظف، لذا لا يوجد حضور يمكن تسجيله. يمكن لأحد المسؤولين ربطه من شاشة المستخدمين.',
    },
    noSite: {
      title: 'لا يوجد موقع مخصص',
      body: 'أنت غير مخصص حاليًا لمشروع له موقع محدد. يُفتح الحضور بمجرد أن يخصصك أحد لمشروع.',
    },
    history: {
      title: 'الأسبوعان الماضيان',
      workingDayNote: 'يبدأ يوم العمل الساعة {start} · يُعتبر متأخرًا بعد {minutes} دقيقة',
      empty: {
        title: 'لا يوجد حضور مسجل بعد',
        body: 'تظهر تسجيلات حضورك هنا بمجرد تسجيل أول حضور.',
      },
      dateHeader: 'التاريخ',
      projectHeader: 'المشروع',
      inHeader: 'الحضور',
      outHeader: 'الانصراف',
      statusHeader: 'الحالة',
      distanceHeader: 'المسافة',
    },
    checkIn: {
      checkedIn: 'تم تسجيل الحضور',
      distanceFromSite: '{distance} م من مركز الموقع',
      minutesLate: 'متأخر {minutes} دقيقة',
      checkedOut: 'تم تسجيل الانصراف {time}',
      distanceToSite: 'المسافة إلى الموقع',
      opensWithin: 'يُفتح تسجيل الحضور ضمن {radius} م',
      fixAccurate: 'دقة التحديد {accuracy} م',
      opensWithinBody:
        'يُفتح تسجيل الحضور ضمن {radius} م من الموقع. يتم التحقق من موقعك مرة أخرى على الخادم قبل تسجيل أي شيء.',
      dayRecorded: 'تم تسجيل اليوم',
      checkOut: 'تسجيل الانصراف',
      recording: 'جارٍ التسجيل…',
      attend: 'تسجيل الحضور',
      attendHint: 'يستخدم موقعك للتأكد من وجودك في الموقع',
      findingYou: 'جارٍ تحديد موقعك…',
      findingYouHint: 'اسمح بالوصول إلى الموقع عند الطلب',
      tryAgain: 'حاول مرة أخرى',
      checkInLabel: 'تسجيل الحضور',
      almostThere: 'اقتربت من الموقع',
      tooFar: 'بعيد جدًا عن التسجيل',
      onSiteHint: 'أنت في الموقع — اضغط لتسجيل وصولك',
      offSiteHint: 'يُتاح تسجيل الحضور داخل حدود الموقع',
      siteBoundary: 'حدود الموقع',
      siteBoundaryBody:
        'نطاق {radius} م، حدده المسؤول لديك. يُرفض أي تحديد موقع تقل دقته عن {maxAccuracy} م لأنه لا يمكن تمييز الداخل من الخارج.',
      openInMaps: 'فتح في خرائط جوجل',
      cannotReportLocation: 'لا يمكن لهذا الجهاز الإبلاغ عن موقعه.',
      locationDenied:
        'تم رفض إذن الوصول إلى الموقع. يُسجَّل الحضور بناءً على الموقع الذي تقف فيه، لذا لا يمكن تسجيله بدونه.',
      locationTimeout: 'استغرق تحديد موقعك وقتًا طويلاً. انتقل إلى مكان مفتوح وحاول مرة أخرى.',
      locationUnavailable: 'تعذر تحديد موقعك.',
    },
  },
  leave: {
    overline: 'الأفراد',
    title: 'الإجازات',
    ledeWaiting: '{count} طلب{plural} في انتظارك',
    ledeLaw: 'قانون العمل المصري رقم 12 لسنة 2003 — 21 يومًا إجازة سنوية، ترتفع إلى 30 يومًا بعد عشر سنوات خدمة.',
    noEmployee: {
      title: 'لا يوجد سجل موظف',
      body: 'حسابك غير مرتبط بموظف، لذا لا يوجد رصيد إجازات أو طلب يمكن تقديمه.',
    },
    balances: {
      title: 'رصيدك · {year}',
      empty: {
        title: 'لا يوجد استحقاق مسجل',
        body: 'يحدد أحد المسؤولين استحقاقك السنوي من شاشة الإدارة.',
      },
      ofDays: 'من {entitled} يومًا',
      taken: '{taken} مستخدم',
      reservedPending: ' · {pending} محجوز لطلب قيد الانتظار',
    },
    request: {
      title: 'طلب إجازة',
      typeLabel: 'النوع',
      typePlaceholder: 'اختر نوع الإجازة',
      unpaidSuffix: ' — غير مدفوعة',
      documentRequiredSuffix: ' (يتطلب مستندًا)',
      firstDayLabel: 'أول يوم',
      lastDayLabel: 'آخر يوم',
      reasonLabel: 'السبب',
      reasonPlaceholder: 'زيارة عائلية',
      submit: 'تقديم طلب الإجازة',
      submitting: 'جارٍ التقديم…',
      allWeekend: 'هذا النطاق بالكامل ضمن عطلة نهاية الأسبوع — لا يوجد ما يُطلب.',
      workingDaysNote: '{days} يوم عمل{plural}. لا يُحتسب الجمعة والسبت.',
      successMessage:
        'تم تقديم الطلب {ref} — {days} يوم عمل. هذه الأيام محجوزة من رصيدك حتى يتم البت في الطلب.',
    },
    queue: {
      title: 'بانتظار القرار ({count})',
      empty: {
        title: 'لا يوجد شيء في الانتظار',
        body: 'تظهر الطلبات هنا بمجرد أن يقدمها أحد. يبقى رصيده محجوزًا حتى تتخذ قرارك.',
      },
      employeeHeader: 'الموظف',
      typeHeader: 'النوع',
      fromHeader: 'من',
      toHeader: 'إلى',
      workingDaysHeader: 'أيام العمل',
      leftAfterHeader: 'المتبقي بعدها',
      reasonHeader: 'السبب',
      unpaid: 'غير مدفوعة',
    },
    myRequests: {
      title: 'طلباتك',
      empty: {
        title: 'لم تطلب إجازة بعد',
        body: 'تظهر الطلبات التي تقدمها هنا مع قرارها.',
      },
      referenceHeader: 'المرجع',
      typeHeader: 'النوع',
      fromHeader: 'من',
      toHeader: 'إلى',
      daysHeader: 'الأيام',
      statusHeader: 'الحالة',
      decidedByHeader: 'قرار من',
    },
    away: {
      title: 'غائبون اليوم',
      empty: {
        title: 'الجميع حاضر',
        body: 'لا يوجد أحد في إجازة معتمدة اليوم.',
      },
      until: 'حتى {date}',
    },
    decision: {
      rejectReasonPlaceholder: 'لماذا يُرفض {reference}؟',
      rejectReasonLabel: 'سبب رفض {reference}',
      reject: 'رفض',
      cancel: 'إلغاء',
      approve: 'موافقة',
      deciding: '…',
    },
  },
  employees: {
    overline: 'الأفراد',
    title: 'الموظفون',
    countLede: '{count} موظف{plural}',
    newEmployee: 'موظف جديد',
    newPage: {
      overline: 'الأفراد',
      title: 'موظف جديد',
      lede: 'أضف شخصًا إلى الدليل. يُخصَّص الكود تلقائيًا.',
    },
    editPage: {
      editTitle: 'تعديل',
    },
    form: {
      codeLabel: 'كود الموظف',
      codeHint: 'يُخصَّص تلقائيًا. يمكنك تغييره هنا إذا احتجت مرجعًا مختلفًا.',
      nameEnLabel: 'الاسم (إنجليزي)',
      nameArLabel: 'الاسم (عربي)',
      jobTitleEnLabel: 'المسمى الوظيفي (إنجليزي)',
      jobTitleArLabel: 'المسمى الوظيفي (عربي)',
      departmentLabel: 'القسم',
      nationalIdLabel: 'الرقم القومي',
      nationalIdHint: '14 رقمًا',
      insuranceNoLabel: 'رقم التأمين',
      insuranceNoHint: '9 أرقام، صادر لأغراض الرواتب',
      phoneLabel: 'الهاتف',
      emailLabel: 'البريد الإلكتروني',
      hiredOnLabel: 'تاريخ التعيين',
      dailyRateLabel: 'الأجر اليومي',
      dailyRateHint: 'يُستخدم لتقدير تكلفة الحضور على المشروع',
      createEmployee: 'إنشاء موظف',
      saveChanges: 'حفظ التغييرات',
      creating: 'جارٍ الإنشاء…',
      saving: 'جارٍ الحفظ…',
      cancel: 'إلغاء',
    },
    filters: {
      searchLabel: 'البحث عن الموظفين',
      searchPlaceholder: 'الاسم أو الكود أو البريد الإلكتروني',
      positionLabel: 'الوظيفة',
      anyPosition: 'أي وظيفة',
      departmentLabel: 'القسم',
      anyDepartment: 'أي قسم',
      projectLabel: 'المشروع',
      anyProject: 'أي مشروع',
      includeInactive: 'تضمين غير النشطين',
      filter: 'تصفية',
      clear: 'مسح',
    },
    list: {
      caption: 'الموظفون ووظائفهم وتخصيصات مشاريعهم الحالية',
      employeeHeader: 'الموظف',
      positionHeader: 'الوظيفة',
      departmentHeader: 'القسم',
      projectsHeader: 'المشاريع',
      hiredHeader: 'تاريخ التعيين',
      loginHeader: 'الدخول',
      noLogin: 'لا يوجد',
    },
    empty: {
      noMatchTitle: 'لا يوجد موظف مطابق',
      noneYetTitle: 'لا يوجد موظفون بعد',
      filteredBody: 'جرّب بحثًا مختلفًا، أو امسح عوامل التصفية.',
      emptyBody: 'الموظف هو شخص تستخدمه الشركة، سواء كان لديه حساب دخول أم لا.',
    },
  },
  },
};
