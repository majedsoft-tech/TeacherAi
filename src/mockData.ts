import { Quiz, Student, TeacherStats, BankQuestion } from './types';

export const initialStats: TeacherStats = {
  totalStudents: 124,
  activeQuizzes: 3,
  successRate: 87.5,
  totalHomeworks: 18,
};

export const initialQuizzes: Quiz[] = [
  {
    id: 'q1',
    title: 'اختبار الرياضيات النهائي - الفصل الثالث',
    subject: 'الرياضيات',
    durationMinutes: 45,
    status: 'active',
    dateCreated: '2026-05-28',
    questions: [
      {
        id: 'q1-1',
        text: 'ما هو ناتج حل المعادلة التالي: 2س + 5 = 15؟',
        type: 'multiple_choice',
        options: ['س = 5', 'س = 10', 'س = 7.5', 'س = 4'],
        correctAnswer: '0',
        points: 5,
      },
      {
        id: 'q1-2',
        text: 'مجموع زوايا المثلث الداعمة يساوي دائماً 180 درجة.',
        type: 'true_false',
        options: ['صحيح', 'خطأ'],
        correctAnswer: 'true',
        points: 5,
      },
      {
        id: 'q1-3',
        text: 'إذا كان نصف قطر دائرة يساوي 7 سم، فما هو محيطها التقريبي؟ (ط = 22/7)',
        type: 'multiple_choice',
        options: ['22 سم', '44 سم', '154 سم', '88 سم'],
        correctAnswer: '1',
        points: 10,
      }
    ]
  },
  {
    id: 'q2',
    title: 'مفاهيم الفيزياء الأساسية - قانون نيوتن الثاني',
    subject: 'العلوم الطبيعية',
    durationMinutes: 30,
    status: 'active',
    dateCreated: '2026-06-01',
    questions: [
      {
        id: 'q2-1',
        text: 'القوة تساوي الكتلة مضروبة في التسارع.',
        type: 'true_false',
        options: ['صحيح', 'خطأ'],
        correctAnswer: 'true',
        points: 5,
      },
      {
        id: 'q2-2',
        text: 'ما هي وحدة قياس القوة في النظام الدولي للوحدات (SI)؟',
        type: 'multiple_choice',
        options: ['الجول', 'الوات', 'النيوتن', 'الكيلوغرام'],
        correctAnswer: '2',
        points: 5,
      }
    ]
  },
  {
    id: 'q3',
    title: 'العصور الإسلامية والأدب العربي وقواعد النحو',
    subject: 'اللغة العربية',
    durationMinutes: 40,
    status: 'active',
    dateCreated: '2026-06-02',
    questions: [
      {
        id: 'q3-1',
        text: 'ما هو إعراب كلمة "الطالبُ" في جملة: "حضر الطالبُ مستعداً"؟',
        type: 'multiple_choice',
        options: ['مفعول به منصوب بالفتحة', 'فاعل مرفوع بالضمة', 'مبتدأ مرفوع بالضمة', 'حال منصوب بالفتحة'],
        correctAnswer: '1',
        points: 5,
      },
      {
        id: 'q3-2',
        text: 'الفاعل في الجملة الفعلية قد يأتي ضميراً مستتراً.',
        type: 'true_false',
        options: ['صحيح', 'خطأ'],
        correctAnswer: 'true',
        points: 5,
      }
    ]
  },
  {
    id: 'q4',
    title: 'تاريخ الجزيرة العربية وجغرافية الشرق الأوسط',
    subject: 'الاجتماعيات والتربية الوطنية',
    durationMinutes: 20,
    status: 'closed',
    dateCreated: '2026-05-15',
    questions: [
      {
        id: 'q4-1',
        text: 'في أي عام هجري تأسست الدولة السعودية الأولى؟',
        type: 'multiple_choice',
        options: ['1157 هـ', '1240 هـ', '1351 هـ', '1000 هـ'],
        correctAnswer: '0',
        points: 10,
      }
    ]
  }
];

export const initialStudents: Student[] = [
  {
    id: 's1',
    name: 'أحمد محمود القحطاني',
    gradeClass: 'الصف العاشر - أ',
    email: 'ahmed.m@academy.edu',
    averageScore: 94,
    status: 'excellent',
    detailedGrades: [
      { quizTitle: 'اختبار الرياضيات النهائي - الفصل الثالث', score: 20, maxScore: 20, date: '2026-05-29', passed: true },
      { quizTitle: 'مفاهيم الفيزياء الأساسية - قانون نيوتن الثاني', score: 9, maxScore: 10, date: '2026-06-01', passed: true },
      { quizTitle: 'تاريخ الجزيرة العربية وجغرافية الشرق الأوسط', score: 10, maxScore: 10, date: '2026-05-16', passed: true },
    ]
  },
  {
    id: 's2',
    name: 'فاطمة الزهراء الشريف',
    gradeClass: 'الصف العاشر - أ',
    email: 'fatima.sh@academy.edu',
    averageScore: 97,
    status: 'excellent',
    detailedGrades: [
      { quizTitle: 'اختبار الرياضيات النهائي - الفصل الثالث', score: 20, maxScore: 20, date: '2026-05-29', passed: true },
      { quizTitle: 'مفاهيم الفيزياء الأساسية - قانون نيوتن الثاني', score: 10, maxScore: 10, date: '2026-06-01', passed: true },
      { quizTitle: 'تاريخ الجزيرة العربية وجغرافية الشرق الأوسط', score: 10, maxScore: 10, date: '2026-05-16', passed: true },
    ]
  },
  {
    id: 's3',
    name: 'عبد الرحمن العتيبي',
    gradeClass: 'الصف العاشر - ب',
    email: 'abdulrahman.o@academy.edu',
    averageScore: 82,
    status: 'good',
    detailedGrades: [
      { quizTitle: 'اختبار الرياضيات النهائي - الفصل الثالث', score: 15, maxScore: 20, date: '2026-05-29', passed: true },
      { quizTitle: 'مفاهيم الفيزياء الأساسية - قانون نيوتن الثاني', score: 8, maxScore: 10, date: '2026-06-02', passed: true },
      { quizTitle: 'تاريخ الجزيرة العربية وجغرافية الشرق الأوسط', score: 8, maxScore: 10, date: '2026-05-16', passed: true },
    ]
  },
  {
    id: 's4',
    name: 'سارة بنت فيصل السديري',
    gradeClass: 'الصف العاشر - أ',
    email: 'sara.s@academy.edu',
    averageScore: 89,
    status: 'good',
    detailedGrades: [
      { quizTitle: 'اختبار الرياضيات النهائي - الفصل الثالث', score: 18, maxScore: 20, date: '2026-05-29', passed: true },
      { quizTitle: 'مفاهيم الفيزياء الأساسية - قانون نيوتن الثاني', score: 9, maxScore: 10, date: '2026-06-01', passed: true },
      { quizTitle: 'تاريخ الجزيرة العربية وجغرافية الشرق الأوسط', score: 7, maxScore: 10, date: '2026-05-16', passed: true },
    ]
  },
  {
    id: 's5',
    name: 'فهد يوسف الدوسري',
    gradeClass: 'الصف العاشر - ب',
    email: 'fahad.d@academy.edu',
    averageScore: 71,
    status: 'average',
    detailedGrades: [
      { quizTitle: 'اختبار الرياضيات النهائي - الفصل الثالث', score: 14, maxScore: 20, date: '2026-05-29', passed: true },
      { quizTitle: 'مفاهيم الفيزياء الأساسية - قانون نيوتن الثاني', score: 6, maxScore: 10, date: '2026-06-02', passed: true },
      { quizTitle: 'تاريخ الجزيرة العربية وجغرافية الشرق الأوسط', score: 6, maxScore: 10, date: '2026-05-16', passed: true },
    ]
  },
  {
    id: 's6',
    name: 'خالد عبد الله الشمري',
    gradeClass: 'الصف العاشر - ب',
    email: 'khalid.sh@academy.edu',
    averageScore: 48,
    status: 'needs_improvement',
    detailedGrades: [
      { quizTitle: 'اختبار الرياضيات النهائي - الفصل الثالث', score: 9, maxScore: 20, date: '2026-05-29', passed: false },
      { quizTitle: 'مفاهيم الفيزياء الأساسية - قانون نيوتن الثاني', score: 4, maxScore: 10, date: '2026-06-02', passed: false },
      { quizTitle: 'تاريخ الجزيرة العربية وجغرافية الشرق الأوسط', score: 5, maxScore: 10, date: '2026-05-16', passed: true },
    ]
  },
  {
    id: 's7',
    name: 'ريما العبد اللطيف',
    gradeClass: 'الصف العاشر - أ',
    email: 'reema.l@academy.edu',
    averageScore: 92,
    status: 'excellent',
    detailedGrades: [
      { quizTitle: 'اختبار الرياضيات النهائي - الفصل الثالث', score: 19, maxScore: 20, date: '2026-05-29', passed: true },
      { quizTitle: 'مفاهيم الفيزياء الأساسية - قانون نيوتن الثاني', score: 9, maxScore: 10, date: '2026-06-01', passed: true },
    ]
  }
];

export const initialBankQuestions: Omit<BankQuestion, 'teacherId'>[] = [
  {
    id: 'bq1',
    text: 'ما هو الفرق الرئيسي بين البيانات (Data) والمعلومات (Information)؟',
    type: 'multiple_choice',
    options: [
      'البيانات هي المخرجات والمعلومات هي المدخلات المباشرة لمعالجات النظام الفوري',
      'البيانات هي المادة الخام والملموسة بينما المعلومات هي ناتج معالجة البيانات وتحليلها وإعطائها سياقاً نافعاً',
      'لا يوجد أي فرق بينهما في علم الحاسب وتقنيات المعلومات',
      'المعلومات تفقد قيمتها بالمعالجة والتحليل الإحصائي'
    ],
    correctAnswer: '1',
    points: 5,
    stage: 'ثانوي',
    grade: 'الصف العاشر',
    semester: 'الفصل الأول',
    subject: 'التقنية الرقمية',
    unit: 'الوحدة الأولى: علم الحاسوب ورؤية البيانات',
    lesson: 'الدرس الأول: البيانات والمعلومات والاتصال السحابي'
  },
  {
    id: 'bq2',
    text: 'تعتبر ذاكرة الوصول العشوائي (RAM) ذاكرة متطايرة تفقد محتوياتها بمجرد انقطاع التيار الكهربائي أو إغلاق الجهاز.',
    type: 'true_false',
    options: ['صحيح', 'خطأ'],
    correctAnswer: 'true',
    points: 5,
    stage: 'ثانوي',
    grade: 'الصف العاشر',
    semester: 'الفصل الأول',
    subject: 'التقنية الرقمية',
    unit: 'الوحدة الأولى: علم الحاسوب ورؤية البيانات',
    lesson: 'الدرس الثاني: بنية الحاسب والذاكرة العملياتية'
  },
  {
    id: 'bq3',
    text: 'أيُّ من العناصر التالية يعتبر من الغازات الخاملة (النبيلة) الممثلة في المجموعة 18 في الجدول الدوري الحديث؟',
    type: 'multiple_choice',
    options: ['الأكسجين النشط', 'الهيليوم', 'الصوديوم المتفاعل', 'الكلور السام'],
    correctAnswer: '1',
    points: 5,
    stage: 'متوسط',
    grade: 'الصف الثالث متوسط',
    semester: 'الفصل الثاني',
    subject: 'العلوم الطبيعية',
    unit: 'الوحدة الثالثة: كيمياء المادة والروابط العناصرية',
    lesson: 'الدرس الأول: الجدول الدوري وتوزيع الخواص'
  },
  {
    id: 'bq4',
    text: 'ما قيمة المتغير س كحل جذري للمعادلة الخطية التالية: 3س + 5 = 20؟',
    type: 'multiple_choice',
    options: ['س = 3', 'س = 5', 'س = 15', 'س = 6'],
    correctAnswer: '1',
    points: 5,
    stage: 'متوسط',
    grade: 'الصف الثالث متوسط',
    semester: 'الفصل الأول',
    subject: 'الرياضيات المتقدمة',
    unit: 'الوحدة الثانية: المعادلات والدوال الخطية المترابطة',
    lesson: 'الدرس الأول: حل المعادلات المتعددة خطوة بخطوة'
  },
  {
    id: 'bq5',
    text: 'تتأثر اتجاهات حركة الرياح العالمية على كوكب الأرض بظاهرة كوريوليس الناتجة مباشرة عن دوران الأرض حول محورها.',
    type: 'true_false',
    options: ['صحيح', 'خطأ'],
    correctAnswer: 'true',
    points: 5,
    stage: 'ابتدائي',
    grade: 'الصف الخامس الابتدائي',
    semester: 'الفصل الثالث',
    subject: 'العلوم الطبيعية',
    unit: 'الوحدة الرابعة: الطقس والمناخ والمظاهر الكونية',
    lesson: 'الدرس الأول: العوامل الطبيعية المؤثرة بالرياح العالمية'
  },
  {
    id: 'bq6',
    text: 'ما هي علامة رفع الفاعل الأصلية والظاهرة في قواعد النحو العربي إذا جاء مفرداً أو جمع تكسير سالم؟',
    type: 'multiple_choice',
    options: ['الفتحة الظاهرة على آخره لتمييز النصب', 'الكسرة المقدرة للكسر والجر', 'الضمة الظاهرة على آخره للرفع والمعارضة', 'حذف حرف النون بالكامل'],
    correctAnswer: '2',
    points: 5,
    stage: 'ابتدائي',
    grade: 'الصف الخامس الابتدائي',
    semester: 'الفصل الثاني',
    subject: 'اللغة العربية ولغة الضاد',
    unit: 'الوحدة الثانية: المعرب والمبني من الكلمات والأسماء',
    lesson: 'الدرس الأول: الأسماء المرفوعة وموقع الفاعل النحوي'
  }
];
