const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '../src/i18n/en.json');
const arPath = path.join(__dirname, '../src/i18n/ar.json');
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const ar = JSON.parse(fs.readFileSync(arPath, 'utf8'));

const translations = {
  'auth.selectCollegeError': { en: 'Please select your college', ar: 'يرجى اختيار الكلية' },
  'auth.title': { en: 'University Portal', ar: 'بوابة الجامعة' },
  'colleges.allColleges': { en: 'All Colleges', ar: 'جميع الكليات' },
  'colleges.descPlaceholder': { en: 'Enter college description...', ar: 'أدخل وصف الكلية...' },
  'colleges.updateSuccess': { en: 'College updated successfully', ar: 'تم تحديث الكلية بنجاح' },
  'common.basicInfo': { en: 'Basic Information', ar: 'المعلومات الأساسية' },
  'common.export': { en: 'Export', ar: 'تصدير' },
  'common.page': { en: 'Page', ar: 'صفحة' },
  'common.reset': { en: 'Reset', ar: 'إعادة تعيين' },
  'common.saveChanges': { en: 'Save Changes', ar: 'حفظ التغييرات' },
  'common.update': { en: 'Update', ar: 'تحديث' },
  'courses.addDesc': { en: 'Add a new course to the catalog', ar: 'إضافة مقرر جديد إلى الكتالوج' },
  'courses.addNew': { en: 'Add New Course', ar: 'إضافة مقرر جديد' },
  'courses.addSuccess': { en: 'Course added successfully', ar: 'تم إضافة المقرر بنجاح' },
  'courses.assignDoctor': { en: 'Assign Instructor', ar: 'تعيين المحاضر' },
  'courses.courseName': { en: 'Course Name', ar: 'اسم المقرر' },
  'courses.createError': { en: 'Error creating course', ar: 'خطأ في إنشاء المقرر' },
  'courses.deleteConfirm': { en: 'Are you sure you want to delete this course?', ar: 'هل أنت متأكد من حذف هذا المقرر؟' },
  'courses.deleteError': { en: 'Error deleting course', ar: 'خطأ في حذف المقرر' },
  'courses.deleteSuccess': { en: 'Course deleted successfully', ar: 'تم حذف المقرر بنجاح' },
  'courses.descPlaceholder': { en: 'Enter course description...', ar: 'أدخل وصف المقرر...' },
  'courses.description': { en: 'Description', ar: 'الوصف' },
  'courses.fillRequired': { en: 'Please fill all required fields', ar: 'يرجى ملء جميع الحقول المطلوبة' },
  'courses.instructor': { en: 'Instructor', ar: 'المحاضر' },
  'courses.noCourses': { en: 'No courses found', ar: 'لم يتم العثور على مقررات' },
  'courses.noCoursesDesc': { en: 'Try adjusting your filters or add a new course.', ar: 'حاول تعديل الفلاتر أو إضافة مقرر جديد.' },
  'courses.searchCourse': { en: 'Search Course', ar: 'البحث عن مقرر' },
  'courses.searchPlaceholder': { en: 'Search by name or code...', ar: 'ابحث بالاسم أو الكود...' },
  'courses.students': { en: 'Students', ar: 'الطلاب' },
  'courses.subtitle': { en: 'View and manage academic courses', ar: 'عرض وإدارة المقررات الدراسية' },
  'courses.updateSuccess': { en: 'Course updated successfully', ar: 'تم تحديث المقرر بنجاح' },
  'dashboard.academicOverview': { en: 'Academic Overview', ar: 'نظرة أكاديمية عامة' },
  'dashboard.activityLog': { en: 'Activity Log', ar: 'سجل النشاط' },
  'dashboard.allSystemsOperational': { en: 'All Systems Operational', ar: 'جميع الأنظمة تعمل' },
  'dashboard.announcements': { en: 'Announcements', ar: 'الإعلانات' },
  'dashboard.assessments': { en: 'Assessments', ar: 'التقييمات' },
  'dashboard.boardMeeting': { en: 'Board Meeting', ar: 'اجتماع مجلس الإدارة' },
  'dashboard.conferenceRoom': { en: 'Conference Room', ar: 'قاعة المؤتمرات' },
  'dashboard.enterprise': { en: 'Enterprise', ar: 'المؤسسة' },
  'dashboard.examScheduleNote': { en: 'Please review the academic schedule for dates and halls.', ar: 'يرجى مراجعة الجدول الدراسي لمعرفة المواعيد والقاعات.' },
  'dashboard.examSchedulePublished': { en: 'Exam Schedule Published', ar: 'تم نشر جدول الامتحانات' },
  'dashboard.fall': { en: 'Fall', ar: 'الخريف' },
  'dashboard.growthTrend': { en: 'Growth Trend', ar: 'اتجاه النمو' },
  'dashboard.manageSubscription': { en: 'Manage Subscription', ar: 'إدارة الاشتراك' },
  'dashboard.pendingTasks': { en: 'Pending Tasks', ar: 'المهام المعلقة' },
  'dashboard.quickActions': { en: 'Quick Actions', ar: 'إجراءات سريعة' },
  'dashboard.quotaUsage': { en: 'Quota Usage', ar: 'استخدام الحصة' },
  'dashboard.recentActivity': { en: 'Recent Activity', ar: 'النشاط الأخير' },
  'dashboard.serverLoad': { en: 'Server Load', ar: 'حمل الخادم' },
  'dashboard.storageUsage': { en: 'Storage Usage', ar: 'استخدام التخزين' },
  'dashboard.subscription': { en: 'Subscription', ar: 'الاشتراك' },
  'dashboard.toGrade': { en: 'To Grade', ar: 'بانتظار التقييم' },
  'dashboard.totalQuizzes': { en: 'Total Quizzes', ar: 'إجمالي الاختبارات' },
  'dashboard.upcomingEvents': { en: 'Upcoming Events', ar: 'الأحداث القادمة' },
  'dashboard.viewAllActivity': { en: 'View All Activity', ar: 'عرض كل النشاط' },
  'departments.allDepartments': { en: 'All Departments', ar: 'جميع الأقسام' },
  'departments.createSuccess': { en: 'Department created successfully', ar: 'تم إنشاء القسم بنجاح' },
  'doctors.createSuccess': { en: 'Doctor created successfully', ar: 'تم إنشاء الدكتور بنجاح' },
  'finance.activePlans': { en: 'Active Payment Plans', ar: 'خطط الدفع النشطة' },
  'finance.adminSubtitle': { en: 'Manage payments and university fees', ar: 'إدارة المدفوعات والرسوم الجامعية' },
  'finance.allStatuses': { en: 'All Statuses', ar: 'جميع الحالات' },
  'finance.createSuccess': { en: 'Payment created successfully', ar: 'تم إنشاء الدفعة بنجاح' },
  'finance.markPaid': { en: 'Mark as Paid', ar: 'تحديد كمدفوع' },
  'finance.other': { en: 'Other', ar: 'أخرى' },
  'finance.paidSoFar': { en: 'Paid So Far', ar: 'المدفوع حتى الآن' },
  'finance.payNow': { en: 'Pay Now', ar: 'ادفع الآن' },
  'finance.paymentsByType': { en: 'Payments by Type', ar: 'المدفوعات حسب النوع' },
  'finance.revenueOverTime': { en: 'Revenue Over Time', ar: 'الإيرادات عبر الزمن' },
  'finance.revenueByType': { en: 'Revenue by Type', ar: 'الإيرادات حسب النوع' },
  'finance.searchPayments': { en: 'Search payments...', ar: 'البحث في المدفوعات...' },
  'finance.studentSubtitle': { en: 'Your personal payment history and dues', ar: 'سجل مدفوعاتك الشخصية والمستحقات' },
  'finance.totalDues': { en: 'Total Dues', ar: 'إجمالي المستحقات' },
  'finance.updateError': { en: 'Error updating payment', ar: 'خطأ في تحديث الدفعة' },
  'header.markAllRead': { en: 'Mark All as Read', ar: 'تحديد الكل كمقروء' },
  'header.noNotifications': { en: 'No notifications', ar: 'لا توجد إشعارات' },
  'header.notifications': { en: 'Notifications', ar: 'الإشعارات' },
  'nav.notifications': { en: 'Notifications', ar: 'الإشعارات' },
  'profile.browseFiles': { en: 'Browse files', ar: 'تصفح الملفات' },
  'profile.dropPic': { en: 'Drop your image here', ar: 'أسقط صورتك هنا' },
  'profile.password': { en: 'Password', ar: 'كلمة المرور' },
  'profile.savePic': { en: 'Save Picture', ar: 'حفظ الصورة' },
  'schedules.title': { en: 'Schedules', ar: 'الجداول الدراسية' },
  'students.year': { en: 'Academic Year', ar: 'السنة الدراسية' },
};

function setNested(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function getNested(obj, dotPath) {
  return dotPath.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

function humanizeKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

for (const [dotPath, vals] of Object.entries(translations)) {
  const enVal = getNested(en, dotPath);
  const arVal = getNested(ar, dotPath);
  if (enVal === '__STRING_NOT_TRANSLATED__' || enVal === undefined) {
    setNested(en, dotPath, vals.en);
  }
  if (arVal === '__STRING_NOT_TRANSLATED__' || arVal === undefined) {
    setNested(ar, dotPath, vals.ar);
  }
}

function fixRemaining(enObj, arObj, prefix = '') {
  let count = 0;
  for (const key of Object.keys(enObj)) {
    const dotPath = prefix ? `${prefix}.${key}` : key;
    if (typeof enObj[key] === 'object' && enObj[key] !== null && !Array.isArray(enObj[key])) {
      count += fixRemaining(enObj[key], arObj[key], dotPath);
    } else if (enObj[key] === '__STRING_NOT_TRANSLATED__') {
      const fallback = humanizeKey(key);
      enObj[key] = fallback;
      if (arObj[key] === '__STRING_NOT_TRANSLATED__') {
        arObj[key] = fallback;
      }
      count++;
      console.warn('Auto-fixed:', dotPath);
    }
  }
  return count;
}

const autoFixed = fixRemaining(en, ar);
fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`);
fs.writeFileSync(arPath, `${JSON.stringify(ar, null, 2)}\n`);

const enLeft = JSON.stringify(en).match(/__STRING_NOT_TRANSLATED__/g);
const arLeft = JSON.stringify(ar).match(/__STRING_NOT_TRANSLATED__/g);
console.log('Auto-fixed remaining:', autoFixed);
console.log('en placeholders left:', enLeft ? enLeft.length : 0);
console.log('ar placeholders left:', arLeft ? arLeft.length : 0);
