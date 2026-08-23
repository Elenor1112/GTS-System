/** Finance module: Accounts (ageing ledger) and Electronic bills (tax
 *  documents, workflow, payments, print). */
export interface FinanceDict {
  finance: {
    accounts: {
      overline: string;
      title: string;
      lede: string;
      netPosition: string;
      netPositionNegative: string;
      netPositionPositive: string;
      receivable: string;
      payable: string;
      overdueIn: string;
      overdueOut: string;
      openSuffix: string;
      oldestDays: string;
      nothingLate: string;
      owedToUs: string;
      owedByUs: string;
      nothingOutstandingTitle: string;
      nothingOutstandingReceivableBody: string;
      nothingOutstandingPayableBody: string;
      table: {
        caption: string;
        counterparty: string;
        current: string;
        days1to30: string;
        days31to60: string;
        days61to90: string;
        over90: string;
        total: string;
        openSuffix: string;
        oldestDaysLate: string;
        overCreditLimit: string;
      };
    };
    bills: {
      nav: {
        overline: string;
        title: string;
      };
      list: {
        title: string;
        documentCount: (n: number) => string;
        outstandingSuffix: string;
        newBill: string;
        searchLabel: string;
        searchPlaceholder: string;
        directionLabel: string;
        bothDirections: string;
        receivableOption: string;
        payableOption: string;
        statusLabel: string;
        anyStatus: string;
        filter: string;
        clear: string;
        noMatchTitle: string;
        noneYetTitle: string;
        noMatchBody: string;
        noneYetBody: string;
        table: {
          caption: string;
          number: string;
          counterparty: string;
          project: string;
          issued: string;
          due: string;
          status: string;
          vat: string;
          total: string;
          outstanding: string;
          receivableTag: string;
          payableTag: string;
          lineCount: (n: number) => string;
          daysLate: (n: number) => string;
          settled: string;
        };
      };
      form: {
        newTitle: string;
        newLede: string;
        editOverlinePrefix: string;
        editTitle: string;
        editLede: string;
        documentLegend: string;
        directionLabel: string;
        receivableOption: string;
        payableOption: string;
        clientLabel: string;
        selectClient: string;
        vendorLabel: string;
        selectVendor: string;
        projectLabel: string;
        noProject: string;
        chooseClientFirst: string;
        onlyClientProjects: string;
        issueDateLabel: string;
        dueDateLabel: string;
        dueDateHint: string;
        currencyLabel: string;
        exchangeRateLabel: string;
        exchangeRateHint: string;
        withholdingLegend: string;
        withholdingLabel: string;
        withholdingNone: string;
        lineItemsLegend: string;
        productLabel: string;
        freeTextLine: string;
        descriptionLabel: string;
        quantityLabel: string;
        unitLabel: string;
        unitPriceLabel: string;
        discountLabel: string;
        vatLabel: string;
        removeLine: string;
        removeLabel: string;
        addLine: string;
        previewNote: string;
        subtotal: string;
        discount: string;
        net: string;
        vat: string;
        total: string;
        withheld: string;
        netPayable: string;
        notesLabel: string;
        savingLabel: string;
        creatingLabel: string;
        saveLines: string;
        createDraft: string;
        cancel: string;
      };
      detail: {
        taxInvoice: string;
        purchaseBill: string;
        noProject: string;
        editLines: string;
        print: string;
        daysSuffix: string;
        parties: string;
        issuedBy: string;
        issuedTo: string;
        noTrn: string;
        noTrnOrg: string;
        issued: string;
        due: string;
        currency: string;
        project: string;
        lines: (n: number) => string;
        table: {
          caption: string;
          description: string;
          itemCode: string;
          qty: string;
          unitPrice: string;
          discount: string;
          net: string;
          vat: string;
          total: string;
          noGpcCode: string;
        };
        totals: {
          subtotal: string;
          discount: string;
          net: string;
          vat: string;
          total: string;
          withholdingNote: string;
          withheldAt: (rate: string) => string;
          netPayable: string;
          paid: string;
          outstanding: string;
        };
        payments: {
          title: (n: number) => string;
          recordPayment: string;
          outstandingSuffix: string;
          nothingYetTitle: string;
          nothingYetBodyLocked: string;
          nothingYetBody: string;
          table: {
            reference: string;
            received: string;
            method: string;
            recordedBy: string;
            amount: string;
            withheld: string;
          };
          form: {
            amountLabel: string;
            withholdingLabel: string;
            withholdingHint: string;
            methodLabel: string;
            receivedOnLabel: string;
            bankReferenceLabel: string;
            bankReferencePlaceholder: string;
            recording: string;
            recordPayment: string;
            cancel: string;
            successPrefix: string;
            successNowStatus: string;
          };
        };
        history: {
          title: string;
          emptyTitle: string;
          emptyBody: string;
          by: string;
          actions: {
            submitted: string;
            approved: string;
            rejected: string;
            sent: string;
            cancelled: string;
            payment: string;
            overdue: string;
          };
        };
        eta: {
          title: string;
          submission: string;
          documentUuid: string;
          disclaimer: string;
        };
      };
      workflow: {
        whyPrefix: string;
        beingRejected: string;
        beingCancelled: string;
        rejectPlaceholder: string;
        cancelPlaceholder: string;
        recording: string;
        reject: string;
        cancelBill: string;
        neverMind: string;
        submitForApproval: string;
        approve: string;
        markSent: string;
        cancel: string;
      };
      print: {
        backToBill: string;
        taxInvoice: string;
        purchaseInvoice: string;
        from: string;
        to: string;
        trn: string;
        issued: string;
        due: string;
        project: string;
        table: {
          index: string;
          description: string;
          qty: string;
          unit: string;
          unitPrice: string;
          discount: string;
          vat: string;
          net: string;
        };
        totals: {
          subtotal: string;
          discount: string;
          net: string;
          vat: string;
          total: string;
          withheld: (rate: string) => string;
          netPayable: string;
          paid: string;
          outstanding: string;
        };
        notes: string;
        disclaimer: string;
      };
      paymentMethods: {
        bankTransfer: string;
        cheque: string;
        cash: string;
        card: string;
        other: string;
      };
      status: {
        draft: string;
        pendingApproval: string;
        approved: string;
        sent: string;
        partiallyPaid: string;
        paid: string;
        overdue: string;
        cancelled: string;
      };
    };
  };
}

export const en: FinanceDict = {
  finance: {
    accounts: {
      overline: 'Financial',
      title: 'Accounts',
      lede: 'Receivables and payables, aged from their due dates. Computed from the transactions, never stored.',
      netPosition: 'Net position',
      netPositionNegative: 'More is owed to suppliers than is owed to us.',
      netPositionPositive: 'More is owed to us than we owe to suppliers.',
      receivable: 'Receivable',
      payable: 'Payable',
      overdueIn: 'Overdue in',
      overdueOut: 'Overdue out',
      openSuffix: 'open',
      oldestDays: 'oldest {days} days',
      nothingLate: 'nothing late',
      owedToUs: 'Owed to us',
      owedByUs: 'Owed by us',
      nothingOutstandingTitle: 'Nothing outstanding',
      nothingOutstandingReceivableBody: 'Every issued invoice has been settled.',
      nothingOutstandingPayableBody: 'Every supplier bill has been settled.',
      table: {
        caption: 'Outstanding balances by age since the due date',
        counterparty: 'Counterparty',
        current: 'Current',
        days1to30: '1–30',
        days31to60: '31–60',
        days61to90: '61–90',
        over90: '90+',
        total: 'Total',
        openSuffix: 'open',
        oldestDaysLate: 'oldest {days} days late',
        overCreditLimit: 'over credit limit',
      },
    },
    bills: {
      nav: {
        overline: 'Tax documents',
        title: 'Electronic bills',
      },
      list: {
        title: 'Electronic bills',
        documentCount: (n) => `${n} document${n === 1 ? '' : 's'}`,
        outstandingSuffix: 'outstanding',
        newBill: 'New bill',
        searchLabel: 'Search bills',
        searchPlaceholder: 'Number, counterparty or project',
        directionLabel: 'Direction',
        bothDirections: 'Both directions',
        receivableOption: 'Receivable — issued to clients',
        payableOption: 'Payable — received from vendors',
        statusLabel: 'Status',
        anyStatus: 'Any status',
        filter: 'Filter',
        clear: 'Clear',
        noMatchTitle: 'No bill matches',
        noneYetTitle: 'No bills yet',
        noMatchBody: 'Try a different filter, or clear it to see everything.',
        noneYetBody: 'A bill carries line items, and every total on it is computed from those lines on the server.',
        table: {
          caption: 'Electronic bills, with VAT and outstanding balances',
          number: 'Number',
          counterparty: 'Counterparty',
          project: 'Project',
          issued: 'Issued',
          due: 'Due',
          status: 'Status',
          vat: 'VAT',
          total: 'Total',
          outstanding: 'Outstanding',
          receivableTag: 'receivable',
          payableTag: 'payable',
          lineCount: (n) => `${n} line${n === 1 ? '' : 's'}`,
          daysLate: (n) => `${n} days late`,
          settled: 'settled',
        },
      },
      form: {
        newTitle: 'New bill',
        newLede: 'Add the lines. Every total — net, VAT per line, the invoice total and any withholding — is computed on the server from what you enter here.',
        editOverlinePrefix: 'Draft',
        editTitle: 'Edit lines',
        editLede: 'Saving replaces every line on this bill and recomputes the totals on the server. Who it is for and when it was issued cannot be changed here.',
        documentLegend: 'Document',
        directionLabel: 'Direction',
        receivableOption: 'Receivable — we issue it to a client',
        payableOption: 'Payable — a vendor issued it to us',
        clientLabel: 'Client',
        selectClient: 'Select a client',
        vendorLabel: 'Vendor',
        selectVendor: 'Select a vendor',
        projectLabel: 'Project',
        noProject: 'No project',
        chooseClientFirst: 'Choose a client first',
        onlyClientProjects: 'Only this client’s projects are offered',
        issueDateLabel: 'Issue date',
        dueDateLabel: 'Due date',
        dueDateHint: 'Left blank, the counterparty’s payment terms apply',
        currencyLabel: 'Currency',
        exchangeRateLabel: 'Exchange rate',
        exchangeRateHint: 'Required when the currency is not {currency}',
        withholdingLegend: 'Withholding',
        withholdingLabel: 'Withholding tax',
        withholdingNone: 'None',
        lineItemsLegend: 'Line items',
        productLabel: 'Product',
        freeTextLine: 'Free text line',
        descriptionLabel: 'Description',
        quantityLabel: 'Qty',
        unitLabel: 'Unit',
        unitPriceLabel: 'Unit price',
        discountLabel: 'Discount',
        vatLabel: 'VAT',
        removeLine: 'Remove line {n}',
        removeLabel: 'Remove',
        addLine: 'Add a line',
        previewNote: 'A preview. The server recomputes every figure from the lines above and stores its own — nothing here is submitted.',
        subtotal: 'Subtotal',
        discount: 'Discount',
        net: 'Net',
        vat: 'VAT',
        total: 'Total',
        withheld: 'Withheld',
        netPayable: 'Net payable',
        notesLabel: 'Notes',
        savingLabel: 'Saving…',
        creatingLabel: 'Creating…',
        saveLines: 'Save lines',
        createDraft: 'Create draft bill',
        cancel: 'Cancel',
      },
      detail: {
        taxInvoice: 'Tax invoice',
        purchaseBill: 'Purchase bill',
        noProject: 'No project',
        editLines: 'Edit lines',
        print: 'Print',
        daysSuffix: 'days',
        parties: 'Parties',
        issuedBy: 'Issued by',
        issuedTo: 'Issued to',
        noTrn: 'No tax registration number',
        noTrnOrg: 'No tax registration number set — see Administration',
        issued: 'Issued',
        due: 'Due',
        currency: 'Currency',
        project: 'Project',
        lines: (n) => `Lines (${n})`,
        table: {
          caption: 'Line items, each with its own VAT rate',
          description: 'Description',
          itemCode: 'Item code',
          qty: 'Qty',
          unitPrice: 'Unit price',
          discount: 'Discount',
          net: 'Net',
          vat: 'VAT',
          total: 'Total',
          noGpcCode: 'No GPC code',
        },
        totals: {
          subtotal: 'Subtotal',
          discount: 'Discount',
          net: 'Net',
          vat: 'VAT',
          total: 'Total',
          withholdingNote: 'Withholding tax is deducted by the buyer at payment and remitted to the ETA on our behalf. It reduces the cash received — never the invoice total.',
          withheldAt: (rate) => `Withheld at ${rate}%`,
          netPayable: 'Net payable',
          paid: 'Paid',
          outstanding: 'Outstanding',
        },
        payments: {
          title: (n) => `Payments (${n})`,
          recordPayment: 'Record a payment',
          outstandingSuffix: 'outstanding',
          nothingYetTitle: 'Nothing paid yet',
          nothingYetBodyLocked: 'A payment cannot be recorded until the bill is approved.',
          nothingYetBody: 'Payments recorded against this bill appear here.',
          table: {
            reference: 'Reference',
            received: 'Received',
            method: 'Method',
            recordedBy: 'Recorded by',
            amount: 'Amount',
            withheld: 'Withheld',
          },
          form: {
            amountLabel: 'Amount',
            withholdingLabel: 'Withholding deducted',
            withholdingHint: 'Remitted to the ETA by the payer',
            methodLabel: 'Method',
            receivedOnLabel: 'Received on',
            bankReferenceLabel: 'Bank reference',
            bankReferencePlaceholder: 'TT-482913',
            recording: 'Recording…',
            recordPayment: 'Record payment',
            cancel: 'Cancel',
            successPrefix: 'Payment',
            successNowStatus: 'recorded. The bill is now',
          },
        },
        history: {
          title: 'History',
          emptyTitle: 'Still a draft',
          emptyBody: 'Every submission, approval, rejection and cancellation is recorded here with who did it.',
          by: 'by',
          actions: {
            submitted: 'submitted',
            approved: 'approved',
            rejected: 'rejected',
            sent: 'sent',
            cancelled: 'cancelled',
            payment: 'payment recorded',
            overdue: 'marked overdue',
          },
        },
        eta: {
          title: 'Egyptian Tax Authority',
          submission: 'Submission',
          documentUuid: 'Document UUID',
          disclaimer: 'This document is produced in the ETA’s shape — both parties’ registration numbers, GPC item codes and per-line VAT — but it is not transmitted. Submission requires taxpayer credentials and an e-seal certificate, which are not configured. No identifier is shown above because none has been issued.',
        },
      },
      workflow: {
        whyPrefix: 'Why is',
        beingRejected: 'being rejected?',
        beingCancelled: 'being cancelled?',
        rejectPlaceholder: 'Wrong rate applied on line 2',
        cancelPlaceholder: 'Client withdrew the order',
        recording: 'Recording…',
        reject: 'Reject',
        cancelBill: 'Cancel the bill',
        neverMind: 'Never mind',
        submitForApproval: 'Submit for approval',
        approve: 'Approve',
        markSent: 'Mark as sent',
        cancel: 'Cancel',
      },
      print: {
        backToBill: 'Back to the bill',
        taxInvoice: 'Tax invoice',
        purchaseInvoice: 'Purchase invoice',
        from: 'From',
        to: 'To',
        trn: 'TRN',
        issued: 'Issued',
        due: 'Due',
        project: 'Project',
        table: {
          index: '#',
          description: 'Description',
          qty: 'Qty',
          unit: 'Unit',
          unitPrice: 'Unit price',
          discount: 'Discount',
          vat: 'VAT',
          net: 'Net',
        },
        totals: {
          subtotal: 'Subtotal',
          discount: 'Discount',
          net: 'Net',
          vat: 'VAT',
          total: 'Total',
          withheld: (rate) => `Withheld (${rate}%)`,
          netPayable: 'Net payable',
          paid: 'Paid',
          outstanding: 'Outstanding',
        },
        notes: 'Notes',
        disclaimer: 'This document was produced by GTS. It has not been submitted to the Egyptian Tax Authority from this system.',
      },
      paymentMethods: {
        bankTransfer: 'Bank transfer',
        cheque: 'Cheque',
        cash: 'Cash',
        card: 'Card',
        other: 'Other',
      },
      status: {
        draft: 'draft',
        pendingApproval: 'pending approval',
        approved: 'approved',
        sent: 'sent',
        partiallyPaid: 'partially paid',
        paid: 'paid',
        overdue: 'overdue',
        cancelled: 'cancelled',
      },
    },
  },
};

export const ar: FinanceDict = {
  finance: {
    accounts: {
      overline: 'مالي',
      title: 'الحسابات',
      lede: 'المستحقات والمطلوبات، مرتبة بحسب تاريخ الاستحقاق. تُحسب من الحركات المالية مباشرة ولا تُخزَّن أبدًا.',
      netPosition: 'صافي المركز المالي',
      netPositionNegative: 'المستحق للموردين أكبر من المستحق لنا.',
      netPositionPositive: 'المستحق لنا أكبر من المستحق للموردين.',
      receivable: 'المستحقات',
      payable: 'المطلوبات',
      overdueIn: 'متأخرات مستحقة لنا',
      overdueOut: 'متأخرات مستحقة علينا',
      openSuffix: 'مفتوحة',
      oldestDays: 'الأقدم منذ {days} يومًا',
      nothingLate: 'لا يوجد متأخر',
      owedToUs: 'المستحق لنا',
      owedByUs: 'المستحق علينا',
      nothingOutstandingTitle: 'لا يوجد رصيد مستحق',
      nothingOutstandingReceivableBody: 'تمت تسوية جميع الفواتير الصادرة.',
      nothingOutstandingPayableBody: 'تمت تسوية جميع فواتير الموردين.',
      table: {
        caption: 'الأرصدة المستحقة موزعة حسب مدة التأخير عن تاريخ الاستحقاق',
        counterparty: 'الطرف المقابل',
        current: 'حالي',
        days1to30: '١–٣٠',
        days31to60: '٣١–٦٠',
        days61to90: '٦١–٩٠',
        over90: '+٩٠',
        total: 'الإجمالي',
        openSuffix: 'مفتوحة',
        oldestDaysLate: 'الأقدم متأخر {days} يومًا',
        overCreditLimit: 'تجاوز حد الائتمان',
      },
    },
    bills: {
      nav: {
        overline: 'المستندات الضريبية',
        title: 'الفواتير الإلكترونية',
      },
      list: {
        title: 'الفواتير الإلكترونية',
        documentCount: (n) => `${n} ${n === 1 ? 'مستند' : 'مستندات'}`,
        outstandingSuffix: 'مستحق',
        newBill: 'فاتورة جديدة',
        searchLabel: 'بحث في الفواتير',
        searchPlaceholder: 'الرقم أو الطرف المقابل أو المشروع',
        directionLabel: 'الاتجاه',
        bothDirections: 'كلا الاتجاهين',
        receivableOption: 'مستحقة — صادرة للعملاء',
        payableOption: 'مطلوبة — واردة من الموردين',
        statusLabel: 'الحالة',
        anyStatus: 'أي حالة',
        filter: 'تصفية',
        clear: 'مسح',
        noMatchTitle: 'لا توجد فاتورة مطابقة',
        noneYetTitle: 'لا توجد فواتير بعد',
        noMatchBody: 'جرّب تصفية مختلفة، أو امسحها لعرض الكل.',
        noneYetBody: 'تحتوي الفاتورة على بنود، وتُحسب كل إجمالياتها من هذه البنود على الخادم.',
        table: {
          caption: 'الفواتير الإلكترونية، مع ضريبة القيمة المضافة والأرصدة المستحقة',
          number: 'الرقم',
          counterparty: 'الطرف المقابل',
          project: 'المشروع',
          issued: 'تاريخ الإصدار',
          due: 'تاريخ الاستحقاق',
          status: 'الحالة',
          vat: 'ض.ق.م',
          total: 'الإجمالي',
          outstanding: 'المستحق',
          receivableTag: 'مستحقة',
          payableTag: 'مطلوبة',
          lineCount: (n) => `${n} ${n === 1 ? 'بند' : 'بنود'}`,
          daysLate: (n) => `متأخر ${n} يومًا`,
          settled: 'مسددة',
        },
      },
      form: {
        newTitle: 'فاتورة جديدة',
        newLede: 'أضِف البنود. كل إجمالي — الصافي، ضريبة القيمة المضافة لكل بند، إجمالي الفاتورة وأي خصم من المنبع — يُحسب على الخادم مما تُدخله هنا.',
        editOverlinePrefix: 'مسودة',
        editTitle: 'تعديل البنود',
        editLede: 'يستبدل الحفظ جميع بنود هذه الفاتورة ويعيد احتساب الإجماليات على الخادم. لا يمكن تغيير الجهة المصدرة لها أو تاريخ إصدارها من هنا.',
        documentLegend: 'المستند',
        directionLabel: 'الاتجاه',
        receivableOption: 'مستحقة — نصدرها لعميل',
        payableOption: 'مطلوبة — أصدرها لنا مورّد',
        clientLabel: 'العميل',
        selectClient: 'اختر عميلًا',
        vendorLabel: 'المورّد',
        selectVendor: 'اختر مورّدًا',
        projectLabel: 'المشروع',
        noProject: 'بدون مشروع',
        chooseClientFirst: 'اختر عميلًا أولًا',
        onlyClientProjects: 'تُعرض مشاريع هذا العميل فقط',
        issueDateLabel: 'تاريخ الإصدار',
        dueDateLabel: 'تاريخ الاستحقاق',
        dueDateHint: 'إذا تُرك فارغًا، تُطبَّق شروط السداد الخاصة بالطرف المقابل',
        currencyLabel: 'العملة',
        exchangeRateLabel: 'سعر الصرف',
        exchangeRateHint: 'مطلوب عندما تكون العملة غير {currency}',
        withholdingLegend: 'الخصم من المنبع',
        withholdingLabel: 'ضريبة الخصم من المنبع',
        withholdingNone: 'بدون',
        lineItemsLegend: 'بنود الفاتورة',
        productLabel: 'المنتج',
        freeTextLine: 'بند نصي حر',
        descriptionLabel: 'الوصف',
        quantityLabel: 'الكمية',
        unitLabel: 'الوحدة',
        unitPriceLabel: 'سعر الوحدة',
        discountLabel: 'الخصم',
        vatLabel: 'ض.ق.م',
        removeLine: 'حذف البند {n}',
        removeLabel: 'حذف',
        addLine: 'إضافة بند',
        previewNote: 'هذه معاينة فقط. يعيد الخادم احتساب كل رقم من البنود أعلاه ويخزّن نسخته الخاصة — لا شيء هنا يُرسل فعليًا.',
        subtotal: 'الإجمالي الفرعي',
        discount: 'الخصم',
        net: 'الصافي',
        vat: 'ض.ق.م',
        total: 'الإجمالي',
        withheld: 'المخصوم',
        netPayable: 'صافي المستحق',
        notesLabel: 'ملاحظات',
        savingLabel: 'جارٍ الحفظ…',
        creatingLabel: 'جارٍ الإنشاء…',
        saveLines: 'حفظ البنود',
        createDraft: 'إنشاء مسودة فاتورة',
        cancel: 'إلغاء',
      },
      detail: {
        taxInvoice: 'فاتورة ضريبية',
        purchaseBill: 'فاتورة شراء',
        noProject: 'بدون مشروع',
        editLines: 'تعديل البنود',
        print: 'طباعة',
        daysSuffix: 'يوم',
        parties: 'الأطراف',
        issuedBy: 'صادرة من',
        issuedTo: 'صادرة إلى',
        noTrn: 'لا يوجد رقم تسجيل ضريبي',
        noTrnOrg: 'لم يُحدَّد رقم التسجيل الضريبي — راجع الإدارة',
        issued: 'تاريخ الإصدار',
        due: 'تاريخ الاستحقاق',
        currency: 'العملة',
        project: 'المشروع',
        lines: (n) => `البنود (${n})`,
        table: {
          caption: 'بنود الفاتورة، لكل منها نسبة ضريبة القيمة المضافة الخاصة به',
          description: 'الوصف',
          itemCode: 'كود الصنف',
          qty: 'الكمية',
          unitPrice: 'سعر الوحدة',
          discount: 'الخصم',
          net: 'الصافي',
          vat: 'ض.ق.م',
          total: 'الإجمالي',
          noGpcCode: 'لا يوجد كود GPC',
        },
        totals: {
          subtotal: 'الإجمالي الفرعي',
          discount: 'الخصم',
          net: 'الصافي',
          vat: 'ض.ق.م',
          total: 'الإجمالي',
          withholdingNote: 'يخصم المشتري ضريبة الخصم من المنبع عند السداد ويوردها إلى مصلحة الضرائب المصرية نيابة عنا. وهي تُخفّض المبلغ النقدي المُحصَّل — ولا تُخفّض إجمالي الفاتورة أبدًا.',
          withheldAt: (rate) => `مخصوم بنسبة ${rate}٪`,
          netPayable: 'صافي المستحق',
          paid: 'المسدد',
          outstanding: 'المستحق',
        },
        payments: {
          title: (n) => `المدفوعات (${n})`,
          recordPayment: 'تسجيل دفعة',
          outstandingSuffix: 'مستحق',
          nothingYetTitle: 'لم يُسدَّد شيء بعد',
          nothingYetBodyLocked: 'لا يمكن تسجيل دفعة قبل اعتماد الفاتورة.',
          nothingYetBody: 'تظهر هنا المدفوعات المسجَّلة مقابل هذه الفاتورة.',
          table: {
            reference: 'المرجع',
            received: 'تاريخ الاستلام',
            method: 'طريقة الدفع',
            recordedBy: 'سجَّلها',
            amount: 'المبلغ',
            withheld: 'المخصوم',
          },
          form: {
            amountLabel: 'المبلغ',
            withholdingLabel: 'الخصم من المنبع المخصوم',
            withholdingHint: 'يورَّد إلى مصلحة الضرائب المصرية من قبل الدافع',
            methodLabel: 'طريقة الدفع',
            receivedOnLabel: 'تاريخ الاستلام',
            bankReferenceLabel: 'المرجع البنكي',
            bankReferencePlaceholder: 'TT-482913',
            recording: 'جارٍ التسجيل…',
            recordPayment: 'تسجيل الدفعة',
            cancel: 'إلغاء',
            successPrefix: 'الدفعة',
            successNowStatus: 'تم تسجيلها. أصبحت حالة الفاتورة الآن',
          },
        },
        history: {
          title: 'السجل',
          emptyTitle: 'لا تزال مسودة',
          emptyBody: 'يُسجَّل هنا كل تقديم واعتماد ورفض وإلغاء، مع بيان من قام به.',
          by: 'بواسطة',
          actions: {
            submitted: 'تم التقديم',
            approved: 'تم الاعتماد',
            rejected: 'تم الرفض',
            sent: 'تم الإرسال',
            cancelled: 'تم الإلغاء',
            payment: 'تم تسجيل دفعة',
            overdue: 'وُسمت كمتأخرة',
          },
        },
        eta: {
          title: 'مصلحة الضرائب المصرية',
          submission: 'حالة الإرسال',
          documentUuid: 'المعرف الفريد للمستند',
          disclaimer: 'يُنتَج هذا المستند بصيغة مصلحة الضرائب المصرية — أرقام تسجيل الطرفين، أكواد GPC للأصناف، وضريبة القيمة المضافة لكل بند — إلا أنه لم يُرسَل. يتطلب الإرسال بيانات اعتماد الممول وشهادة ختم إلكتروني، وهما غير مُهيَّأين. لا يظهر أي معرف أعلاه لأنه لم يصدر أي معرف بعد.',
        },
      },
      workflow: {
        whyPrefix: 'لماذا يتم',
        beingRejected: 'رفض',
        beingCancelled: 'إلغاء',
        rejectPlaceholder: 'تم تطبيق نسبة خاطئة على البند ٢',
        cancelPlaceholder: 'سحب العميل الطلب',
        recording: 'جارٍ التسجيل…',
        reject: 'رفض',
        cancelBill: 'إلغاء الفاتورة',
        neverMind: 'تراجع',
        submitForApproval: 'إرسال للاعتماد',
        approve: 'اعتماد',
        markSent: 'وضع علامة كمُرسلة',
        cancel: 'إلغاء',
      },
      print: {
        backToBill: 'العودة إلى الفاتورة',
        taxInvoice: 'فاتورة ضريبية',
        purchaseInvoice: 'فاتورة شراء',
        from: 'من',
        to: 'إلى',
        trn: 'رقم التسجيل الضريبي',
        issued: 'تاريخ الإصدار',
        due: 'تاريخ الاستحقاق',
        project: 'المشروع',
        table: {
          index: '#',
          description: 'الوصف',
          qty: 'الكمية',
          unit: 'الوحدة',
          unitPrice: 'سعر الوحدة',
          discount: 'الخصم',
          vat: 'ض.ق.م',
          net: 'الصافي',
        },
        totals: {
          subtotal: 'الإجمالي الفرعي',
          discount: 'الخصم',
          net: 'الصافي',
          vat: 'ض.ق.م',
          total: 'الإجمالي',
          withheld: (rate) => `المخصوم (${rate}٪)`,
          netPayable: 'صافي المستحق',
          paid: 'المسدد',
          outstanding: 'المستحق',
        },
        notes: 'ملاحظات',
        disclaimer: 'تم إصدار هذا المستند بواسطة نظام GTS. لم يُرسَل إلى مصلحة الضرائب المصرية من هذا النظام.',
      },
      paymentMethods: {
        bankTransfer: 'تحويل بنكي',
        cheque: 'شيك',
        cash: 'نقدًا',
        card: 'بطاقة',
        other: 'أخرى',
      },
      status: {
        draft: 'مسودة',
        pendingApproval: 'بانتظار الاعتماد',
        approved: 'معتمدة',
        sent: 'مُرسلة',
        partiallyPaid: 'مسددة جزئيًا',
        paid: 'مسددة',
        overdue: 'متأخرة',
        cancelled: 'ملغاة',
      },
    },
  },
};
