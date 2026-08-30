/**
 * The Help page: a plain-language, step-by-step manual for people who
 * have never used a computer system like this before. Every topic is a
 * short list of numbered steps — no jargon, no assumed knowledge.
 *
 * Kept as its own module (not folded into shell.ts) because it is one
 * long page of prose rather than short chrome labels, and it changes
 * on its own schedule as features are added.
 */

export interface HelpTopic {
  id: string;
  icon: string;
  title: string;
  intro?: string;
  steps: string[];
  note?: string;
}

export interface HelpDict {
  help: {
    overline: string;
    title: string;
    lede: string;
    tocTitle: string;
    permissionNoteTitle: string;
    permissionNoteBody: string;
    topics: HelpTopic[];
    contactTitle: string;
    contactBody: string;
  };
}

export const en: HelpDict = {
  help: {
    overline: 'Help',
    title: 'How to use GTS',
    lede:
      'A simple, step-by-step guide to the system. You do not need any computer experience — just follow the numbered steps for whatever you are trying to do.',
    tocTitle: 'What do you need help with?',
    permissionNoteTitle: 'Do not see something mentioned here?',
    permissionNoteBody:
      'Not everyone sees every menu. What you can see depends on your role (for example, Storekeeper or Financial Controller). If a step below mentions a screen you do not have, that is normal — ask your administrator if you believe you should have access to it.',
    topics: [
      {
        id: 'getting-around',
        icon: 'explore',
        title: 'Getting around the screen',
        intro: 'Every page in the system is built the same way, so once you learn this, you can find your way anywhere.',
        steps: [
          'On a computer, the list of sections (Clients, Vendors, Projects, Warehouses, and so on) is on the left side of the screen. On a phone, tap the icons along the bottom instead.',
          'The bar across the top of the screen is always there. On the right side of it you will find: a question-mark (?) button for this Help page, a bell for Notifications, and a gear for your Account.',
          'Your name and photo circle are shown at the bottom-left of the sidebar (on a computer). Tap it to change the light/dark appearance, switch the language, or sign out.',
          'If a page shows a list of records (like a list of clients), you can usually search or filter at the top of that list, and tap any row to see its full details.',
          'Buttons that create something new are usually in the top-right corner of a page and say things like "Create" or "New".',
        ],
      },
      {
        id: 'sign-in',
        icon: 'login',
        title: 'Signing in',
        steps: [
          'Open the sign-in page and type the email address and password your administrator gave you.',
          'Press "Sign in".',
          'If you see a message saying your session ended, this simply means you were signed out after a period of time — sign in again the same way.',
          'If you see a message saying you do not have permission for a page, this is expected for some roles — it means that section is not part of your job in the system. Speak to your administrator if you believe this is wrong.',
          'Forgot your password? Ask your administrator to help — they can guide you, since passwords are changed from inside the Account page once you are signed in.',
        ],
      },
      {
        id: 'language-appearance',
        icon: 'language',
        title: 'Changing the language or the light/dark look',
        steps: [
          'Tap your name at the bottom of the left-hand menu (on a phone, tap "More" then your name).',
          'A small panel opens with two rows: "Appearance" and "Language".',
          'Under Appearance, choose Light, Dark, or System (System matches your phone or computer\'s own setting).',
          'Under Language, choose English or Arabic. The whole system — menus, buttons, and text direction — switches immediately.',
        ],
      },
      {
        id: 'dashboard',
        icon: 'dashboard',
        title: 'Understanding the Dashboard (home screen)',
        intro: 'The Dashboard is the first screen you see. It gives you a quick picture of what needs your attention today.',
        steps: [
          '"Needs attention" at the top lists urgent items, such as overdue bills or low stock. Tap any item to go directly to it.',
          'The colored boxes show your key numbers, such as money owed to you and money you owe, if your role allows you to see money figures.',
          '"Your work" lists the projects you are involved in, with a bar showing how much of the budget has been used.',
          'Further down you may see Storage (warehouse stock) and Attendance (who is on-site today), depending on your role.',
          '"Quick Actions" on the right gives one-tap shortcuts to the most common tasks, like creating a bill or checking in.',
        ],
      },
      {
        id: 'attendance',
        icon: 'location_on',
        title: 'Checking in and out of work (Attendance)',
        intro: 'Attendance uses your phone or computer\'s location to confirm you are actually at the work site — like a fingerprint machine, but using GPS.',
        steps: [
          'Open "Attendance" from the menu (or tap the fingerprint icon at the bottom on a phone).',
          'You will see a card for each site you are assigned to. Tap the large round button on the card for the site you are at.',
          'The screen will say "Finding you…" while it checks your location. Allow location access if your phone or browser asks for permission — without this, checking in is not possible.',
          'If you are close enough to the site, the button turns green and you can tap it to check in. If you are too far away, it will tell you and stay disabled until you get closer.',
          'Not sure where the site is? Tap "Get directions" on the card to open it in your maps app.',
          'When you are done for the day, come back to the same card and tap "Check out".',
          'Your check-in/out times, and whether you were on time, appear in the history table below the cards.',
        ],
        note: 'If your phone says it cannot find your location, make sure Location/GPS is turned on in your phone settings, then tap "Try again".',
      },
      {
        id: 'leave',
        icon: 'event_busy',
        title: 'Requesting time off (Leave)',
        steps: [
          'Open "Leave" from the menu.',
          'At the top you will see how many days you have left for each type of leave (for example, Annual or Sick).',
          'To ask for time off, use the "Request leave" form: choose the type of leave, then the first and last day you will be away.',
          'You can add a short reason if you like. The form will show you how many working days that request covers (weekends are not counted).',
          'Press submit. You will get a reference number — keep this in case you need to ask about your request later.',
          'Your request will appear in "Your requests" as Pending until someone approves or rejects it. You can cancel a request yourself if it is still Pending or Approved and you no longer need it.',
        ],
        note: 'If you are a manager who approves leave for others, you will also see a "Pending approval" list where you can Approve or Reject requests (you must type a short reason to reject one).',
      },
      {
        id: 'clients-vendors',
        icon: 'groups',
        title: 'Adding a client or a vendor',
        intro: 'Clients are the people or companies you sell to. Vendors are the people or companies you buy from. Both work the same way.',
        steps: [
          'Open "Clients" or "Vendors" from the menu.',
          'Press the "Create" button, usually in the top-right corner.',
          'Fill in the name, phone number, and any other details you have — you do not need to fill in every box, only the ones with a red asterisk (*) are required.',
          'Press "Save" at the bottom of the form.',
          'The new client or vendor now appears in the list. Tap it any time to see its full history or to edit its details.',
        ],
      },
      {
        id: 'projects',
        icon: 'account_tree',
        title: 'Creating a project and setting its site location',
        steps: [
          'Open "Projects" from the menu and press "Create".',
          'Fill in the project name and choose the client it belongs to.',
          'If you need people to be able to check in with GPS at this project, tick "Set site location".',
          'Type the address, and pick the type of site (Office, Warehouse, Site, or Yard) — each type has a sensible default check-in distance already filled in for you.',
          'Tap the map to drop a pin exactly where the site is, or drag the pin already on the map. If you are standing at the site right now, you can also use "Use my current position" to fill this in automatically.',
          'Press "Save" to finish creating the project.',
        ],
        note: 'Only some roles can set a site location or assign staff to a project — if you do not see these options, that is expected for your role.',
      },
      {
        id: 'products-storage',
        icon: 'inventory_2',
        title: 'Products and warehouses (Storage)',
        steps: [
          'Open "Products" to see or add items in your catalogue — press "Create" to add a new product with its name, unit, and price.',
          'Open "Storage" to see your warehouses and how much stock is in each one.',
          'Tap a warehouse to see exactly what products are inside it and in what quantity.',
          'Moving stock in, out, or between warehouses is done from within the warehouse or product screen, if your role allows it (this is usually the Storekeeper\'s job).',
        ],
      },
      {
        id: 'bills',
        icon: 'receipt_long',
        title: 'Creating a bill (invoice)',
        intro: 'A bill records money owed to you (a sale) or money you owe (a purchase).',
        steps: [
          'Open "Bills" and press "New Transaction" (also available as a shortcut on the Dashboard).',
          'Choose whether this is a sale (you will receive money) or a purchase (you will pay money), then pick the client or vendor.',
          'If the bill relates to a project, select it — this is optional.',
          'Check the date, due date, and currency, then add each item being billed: pick a product if it is in your catalogue (this fills in the price for you automatically) or type it in by hand.',
          'The total, tax, and any amount owed are calculated for you automatically as you type — you do not need to do any maths.',
          'Press "Save" to create the bill as a draft. Someone with approval rights will review it before it is sent.',
        ],
      },
      {
        id: 'notifications',
        icon: 'notifications',
        title: 'Notifications (the bell icon)',
        steps: [
          'Tap the bell icon at the top of the screen at any time to see your notifications.',
          'Each notification tells you what happened (for example, "Bill overdue" or "Leave approved") and when.',
          'Unread notifications are highlighted. Tap one to go straight to whatever it is about.',
          'Press "Mark all read" to clear the highlights once you have seen everything.',
        ],
      },
      {
        id: 'account-settings',
        icon: 'settings',
        title: 'Your account and changing your password',
        steps: [
          'Tap the gear icon at the top of the screen, or "Your account" in your name menu.',
          'Here you can see your email, role, and when you last signed in.',
          'To change your password, scroll to "Change password", type your current password and then your new one twice, and press save.',
          'For security, changing your password signs you out of every other device you were signed in on — this is normal and expected.',
        ],
        note: 'Your name, role, and job title cannot be changed here — ask your administrator if any of these need to be corrected.',
      },
    ],
    contactTitle: 'Still stuck?',
    contactBody:
      'Ask your administrator or supervisor — they can open your account, check your role and permissions, and walk through the exact screen with you.',
  },
};

export const ar: HelpDict = {
  help: {
    overline: 'المساعدة',
    title: 'كيفية استخدام النظام',
    lede: 'دليل بسيط وخطوة بخطوة لاستخدام النظام. لست بحاجة لأي خبرة بالحاسوب — فقط اتبع الخطوات المرقّمة لما تريد القيام به.',
    tocTitle: 'في أي موضوع تحتاج مساعدة؟',
    permissionNoteTitle: 'لا تجد شيئًا مذكورًا هنا؟',
    permissionNoteBody:
      'ليس كل شخص يرى كل القوائم. ما تراه يعتمد على دورك الوظيفي (مثل أمين المخزن أو المدير المالي). إذا ذكرت إحدى الخطوات شاشة لا تملكها، فهذا أمر طبيعي — اسأل مدير النظام إذا كنت تعتقد أنه يجب أن تصل إليها.',
    topics: [
      {
        id: 'getting-around',
        icon: 'explore',
        title: 'التعرّف على الشاشة',
        intro: 'كل صفحة في النظام مبنية بنفس الطريقة، فبمجرد أن تتعلم هذا، ستجد طريقك في كل مكان.',
        steps: [
          'على الحاسوب، توجد قائمة الأقسام (العملاء، الموردون، المشاريع، المخازن، وغيرها) على الجانب الأيسر من الشاشة. على الهاتف، اضغط على الأيقونات أسفل الشاشة بدلاً من ذلك.',
          'الشريط العلوي موجود دائمًا في أعلى الشاشة. على يمينه ستجد: زر علامة استفهام (؟) لصفحة المساعدة هذه، وجرسًا للإشعارات، وترسًا لحسابك.',
          'اسمك ودائرة صورتك تظهر أسفل يسار القائمة الجانبية (على الحاسوب). اضغط عليها لتغيير المظهر الفاتح/الداكن، أو تغيير اللغة، أو تسجيل الخروج.',
          'إذا عرضت الصفحة قائمة سجلات (مثل قائمة العملاء)، يمكنك عادة البحث أو التصفية أعلى تلك القائمة، والضغط على أي صف لرؤية تفاصيله كاملة.',
          'الأزرار التي تنشئ شيئًا جديدًا توجد عادة أعلى يمين الصفحة وتحمل كلمات مثل "إنشاء" أو "جديد".',
        ],
      },
      {
        id: 'sign-in',
        icon: 'login',
        title: 'تسجيل الدخول',
        steps: [
          'افتح صفحة تسجيل الدخول واكتب البريد الإلكتروني وكلمة المرور اللذين أعطاك إياهما مدير النظام.',
          'اضغط على "تسجيل الدخول".',
          'إذا ظهرت رسالة تفيد بانتهاء جلستك، فهذا يعني فقط أنه تم تسجيل خروجك بعد مرور بعض الوقت — سجّل دخولك مرة أخرى بنفس الطريقة.',
          'إذا ظهرت رسالة تفيد بأنك لا تملك صلاحية لصفحة ما، فهذا متوقع لبعض الأدوار الوظيفية — يعني أن هذا القسم ليس جزءًا من عملك في النظام. تحدث مع مدير النظام إذا كنت تعتقد أن هذا غير صحيح.',
          'هل نسيت كلمة المرور؟ اطلب من مدير النظام مساعدتك — يمكنه إرشادك، حيث يتم تغيير كلمات المرور من داخل صفحة الحساب بعد تسجيل الدخول.',
        ],
      },
      {
        id: 'language-appearance',
        icon: 'language',
        title: 'تغيير اللغة أو المظهر الفاتح/الداكن',
        steps: [
          'اضغط على اسمك أسفل القائمة الجانبية اليسرى (على الهاتف، اضغط "المزيد" ثم اسمك).',
          'ستفتح لوحة صغيرة بها صفان: "المظهر" و"اللغة".',
          'تحت المظهر، اختر فاتح أو داكن أو النظام (يطابق "النظام" إعدادات هاتفك أو حاسوبك).',
          'تحت اللغة، اختر العربية أو الإنجليزية. يتغيّر النظام بالكامل فورًا — القوائم والأزرار واتجاه النص.',
        ],
      },
      {
        id: 'dashboard',
        icon: 'dashboard',
        title: 'فهم لوحة التحكم (الشاشة الرئيسية)',
        intro: 'لوحة التحكم هي أول شاشة تراها. تعطيك صورة سريعة عمّا يحتاج انتباهك اليوم.',
        steps: [
          '"يحتاج انتباه" في الأعلى يسرد العناصر العاجلة، مثل الفواتير المتأخرة أو انخفاض المخزون. اضغط على أي عنصر للانتقال إليه مباشرة.',
          'المربعات الملونة تعرض أهم أرقامك، مثل الأموال المستحقة لك والأموال المستحقة عليك، إذا كان دورك يسمح لك برؤية الأرقام المالية.',
          '"عملك" يسرد المشاريع التي تشارك فيها، مع شريط يوضح مقدار الميزانية المستهلكة.',
          'أسفل ذلك قد ترى المخازن (مخزون المستودعات) والحضور (من هو موجود في الموقع اليوم)، حسب دورك الوظيفي.',
          '"إجراءات سريعة" على اليمين يمنحك اختصارات بضغطة واحدة لأكثر المهام شيوعًا، مثل إنشاء فاتورة أو تسجيل الحضور.',
        ],
      },
      {
        id: 'attendance',
        icon: 'location_on',
        title: 'تسجيل الحضور والانصراف',
        intro: 'يستخدم تسجيل الحضور موقع هاتفك أو حاسوبك للتأكد من وجودك فعليًا في موقع العمل — مثل جهاز البصمة، لكن باستخدام تحديد المواقع (GPS).',
        steps: [
          'افتح "الحضور" من القائمة (أو اضغط على أيقونة البصمة أسفل الشاشة على الهاتف).',
          'ستظهر بطاقة لكل موقع أنت مُكلّف به. اضغط على الزر الدائري الكبير في بطاقة الموقع الذي أنت فيه.',
          'ستظهر الشاشة عبارة "جارٍ تحديد موقعك…" أثناء التحقق من موقعك. اسمح بالوصول إلى الموقع إذا طلب هاتفك أو المتصفح ذلك — بدون هذا، لا يمكن تسجيل الحضور.',
          'إذا كنت قريبًا بما يكفي من الموقع، سيتحول الزر إلى اللون الأخضر ويمكنك الضغط عليه لتسجيل الحضور. إذا كنت بعيدًا جدًا، سيخبرك النظام ويبقى الزر معطلاً حتى تقترب.',
          'لا تعرف مكان الموقع؟ اضغط على "الحصول على الاتجاهات" في البطاقة لفتحه في تطبيق الخرائط لديك.',
          'عند انتهاء يوم عملك، عد إلى نفس البطاقة واضغط "تسجيل الانصراف".',
          'أوقات حضورك وانصرافك، وما إذا كنت في الموعد، تظهر في جدول السجل أسفل البطاقات.',
        ],
        note: 'إذا قال هاتفك إنه لا يستطيع تحديد موقعك، تأكد من تفعيل خدمة الموقع (GPS) في إعدادات هاتفك، ثم اضغط "إعادة المحاولة".',
      },
      {
        id: 'leave',
        icon: 'event_busy',
        title: 'طلب إجازة',
        steps: [
          'افتح "الإجازات" من القائمة.',
          'في الأعلى سترى عدد الأيام المتبقية لك من كل نوع إجازة (مثل السنوية أو المرضية).',
          'لطلب إجازة، استخدم نموذج "طلب إجازة": اختر نوع الإجازة، ثم أول وآخر يوم ستكون فيه غائبًا.',
          'يمكنك إضافة سبب مختصر إن أردت. سيوضح النموذج عدد أيام العمل التي يغطيها الطلب (لا تُحتسب عطلات نهاية الأسبوع).',
          'اضغط إرسال. ستحصل على رقم مرجعي — احتفظ به في حال احتجت للسؤال عن طلبك لاحقًا.',
          'سيظهر طلبك في "طلباتك" بحالة "قيد الانتظار" حتى تتم الموافقة عليه أو رفضه. يمكنك إلغاء الطلب بنفسك إذا كان لا يزال قيد الانتظار أو تمت الموافقة عليه ولم تعد بحاجة إليه.',
        ],
        note: 'إذا كنت مديرًا يوافق على إجازات الآخرين، ستشاهد أيضًا قائمة "بانتظار الموافقة" حيث يمكنك الموافقة أو الرفض (يجب كتابة سبب مختصر عند الرفض).',
      },
      {
        id: 'clients-vendors',
        icon: 'groups',
        title: 'إضافة عميل أو مورد',
        intro: 'العملاء هم الأشخاص أو الشركات التي تبيع لها. الموردون هم الأشخاص أو الشركات التي تشتري منها. كلاهما يعمل بنفس الطريقة.',
        steps: [
          'افتح "العملاء" أو "الموردون" من القائمة.',
          'اضغط على زر "إنشاء"، وعادة ما يكون أعلى يمين الصفحة.',
          'املأ الاسم ورقم الهاتف وأي تفاصيل أخرى لديك — لست مضطرًا لملء كل حقل، فقط الحقول التي بجانبها علامة نجمة حمراء (*) مطلوبة.',
          'اضغط "حفظ" أسفل النموذج.',
          'يظهر العميل أو المورد الجديد الآن في القائمة. اضغط عليه في أي وقت لرؤية سجله الكامل أو تعديل بياناته.',
        ],
      },
      {
        id: 'projects',
        icon: 'account_tree',
        title: 'إنشاء مشروع وتحديد موقعه',
        steps: [
          'افتح "المشاريع" من القائمة واضغط "إنشاء".',
          'املأ اسم المشروع واختر العميل الذي يتبع له.',
          'إذا كنت تريد أن يتمكن الأشخاص من تسجيل الحضور بتحديد الموقع في هذا المشروع، ضع علامة على "تحديد موقع الموقع".',
          'اكتب العنوان، واختر نوع الموقع (مكتب، مستودع، موقع عمل، أو ساحة) — كل نوع له مسافة تسجيل حضور افتراضية مناسبة معبأة مسبقًا لك.',
          'اضغط على الخريطة لوضع علامة في المكان الدقيق للموقع، أو اسحب العلامة الموجودة بالفعل. إذا كنت واقفًا في الموقع الآن، يمكنك أيضًا استخدام "استخدام موقعي الحالي" لملء هذا تلقائيًا.',
          'اضغط "حفظ" لإنهاء إنشاء المشروع.',
        ],
        note: 'بعض الأدوار الوظيفية فقط يمكنها تحديد موقع الموقع أو تعيين موظفين لمشروع — إذا لم تجد هذه الخيارات، فهذا متوقع لدورك الوظيفي.',
      },
      {
        id: 'products-storage',
        icon: 'inventory_2',
        title: 'المنتجات والمخازن',
        steps: [
          'افتح "المنتجات" لرؤية أو إضافة عناصر في كتالوجك — اضغط "إنشاء" لإضافة منتج جديد باسمه ووحدته وسعره.',
          'افتح "المخازن" لرؤية مستودعاتك وكمية المخزون في كل منها.',
          'اضغط على مستودع لرؤية المنتجات الموجودة بداخله بالضبط وكمياتها.',
          'نقل المخزون داخل أو خارج أو بين المستودعات يتم من داخل شاشة المستودع أو المنتج، إذا كان دورك يسمح بذلك (عادة ما تكون هذه مهمة أمين المخزن).',
        ],
      },
      {
        id: 'bills',
        icon: 'receipt_long',
        title: 'إنشاء فاتورة',
        intro: 'تسجل الفاتورة أموالًا مستحقة لك (بيع) أو أموالًا عليك دفعها (شراء).',
        steps: [
          'افتح "الفواتير" واضغط "معاملة جديدة" (متاحة أيضًا كاختصار في لوحة التحكم).',
          'اختر ما إذا كانت هذه عملية بيع (ستستلم أموالًا) أو شراء (ستدفع أموالًا)، ثم اختر العميل أو المورد.',
          'إذا كانت الفاتورة متعلقة بمشروع، اخترْه — هذا اختياري.',
          'تحقق من التاريخ وتاريخ الاستحقاق والعملة، ثم أضف كل عنصر يتم إصدار فاتورة به: اختر منتجًا إذا كان موجودًا في كتالوجك (سيملأ السعر لك تلقائيًا) أو اكتبه يدويًا.',
          'يتم احتساب الإجمالي والضريبة وأي مبلغ مستحق لك تلقائيًا أثناء الكتابة — لست بحاجة لإجراء أي حسابات.',
          'اضغط "حفظ" لإنشاء الفاتورة كمسودة. سيقوم شخص لديه صلاحية الموافقة بمراجعتها قبل إرسالها.',
        ],
      },
      {
        id: 'notifications',
        icon: 'notifications',
        title: 'الإشعارات (أيقونة الجرس)',
        steps: [
          'اضغط على أيقونة الجرس أعلى الشاشة في أي وقت لرؤية إشعاراتك.',
          'يخبرك كل إشعار بما حدث (مثل "فاتورة متأخرة" أو "تمت الموافقة على الإجازة") ومتى.',
          'الإشعارات غير المقروءة تكون مميزة. اضغط على أي منها للانتقال مباشرة إلى ما يتعلق به.',
          'اضغط "تعليم الكل كمقروء" لإزالة التمييز بعد أن تكون قد اطلعت على كل شيء.',
        ],
      },
      {
        id: 'account-settings',
        icon: 'settings',
        title: 'حسابك وتغيير كلمة المرور',
        steps: [
          'اضغط على أيقونة الترس أعلى الشاشة، أو "حسابك" في قائمة اسمك.',
          'هنا يمكنك رؤية بريدك الإلكتروني ودورك الوظيفي وآخر مرة سجّلت فيها الدخول.',
          'لتغيير كلمة المرور، انتقل إلى "تغيير كلمة المرور"، اكتب كلمة مرورك الحالية ثم كلمة المرور الجديدة مرتين، واضغط حفظ.',
          'لأسباب أمنية، تغيير كلمة المرور يسجل خروجك من كل الأجهزة الأخرى التي كنت مسجلاً دخولك عليها — هذا أمر طبيعي ومتوقع.',
        ],
        note: 'لا يمكن تغيير اسمك أو دورك الوظيفي أو مسماك الوظيفي من هنا — اسأل مدير النظام إذا احتاج أي منها إلى تصحيح.',
      },
    ],
    contactTitle: 'ما زلت تواجه صعوبة؟',
    contactBody: 'اسأل مدير النظام أو المشرف عليك — يمكنه فتح حسابك، والتحقق من دورك وصلاحياتك، ومراجعة الشاشة المحددة معك خطوة بخطوة.',
  },
};
