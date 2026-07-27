import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  Database, 
  X, 
  Check, 
  BookOpen, 
  CheckSquare, 
  HelpCircle,
  Clock,
  Layers,
  Edit2,
  CheckCircle2,
  XCircle,
  Upload,
  Sparkles,
  FileText,
  AlertTriangle,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BankQuestion, QuestionType } from '../types';
import { isTrueFalseQuestion, normalizeQuestion } from '../utils/questionUtils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';

interface QuestionBankTabProps {
  currentUser: any;
  bankQuestions: BankQuestion[];
  bankQuestionsLoaded?: boolean;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  triggerConfirm: (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => void;
  onAutoCreateQuiz?: (
    selectedQuestions: BankQuestion[],
    meta: { stage: string; grade: string; semester: string; subject: string; unit: string; lesson: string }
  ) => void;
  hideReadOnlyNotice?: boolean;
}

// Preset Arabic classifications for easy selection
const STAGE_PRESETS = ['المرحلة الابتدائية', 'المرحلة المتوسطة', 'المرحلة الثانوية'];

const GRADE_PRESETS: Record<string, string[]> = {
  'المرحلة الابتدائية': [
    'الصف الأول الابتدائي',
    'الصف الثاني الابتدائي',
    'الصف الثالث الابتدائي',
    'الصف الرابع الابتدائي',
    'الصف الخامس الابتدائي',
    'الصف السادس الابتدائي'
  ],
  'المرحلة المتوسطة': [
    'الصف الأول المتوسط',
    'الصف الثاني المتوسط',
    'الصف الثالث المتوسط'
  ],
  'المرحلة الثانوية': [
    'السنة الأولى المشتركة (أول ثانوي)',
    'الصف الثاني الثانوي - مسارات',
    'الصف الثالث الثانوي - مسارات'
  ]
};

const SEMESTER_PRESETS = ['الفصل الدراسي الأول', 'الفصل الدراسي الثاني', 'الفصل الدراسي الثالث'];

const STAGE_SUBJECT_PRESETS: Record<string, string[]> = {
  'المرحلة الابتدائية': [
    'القرآن الكريم والدراسات الإسلامية',
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'الدراسات الاجتماعية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'المرحلة المتوسطة': [
    'الدراسات الإسلامية',
    'القرآن الكريم وتجويده',
    'الرياضيات',
    'العلوم',
    'لغتي الخالدة',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'الدراسات الاجتماعية',
    'التفكير الناقد',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'المرحلة الثانوية': [
    'الكفايات اللغوية 1-1',
    'الكفايات اللغوية 1-2',
    'الكفايات اللغوية 2-1',
    'الكفايات اللغوية 2-2',
    'الرياضيات 1-1',
    'الرياضيات 1-2',
    'الرياضيات 1-3',
    'الرياضيات 2-1',
    'الرياضيات 2-2',
    'الرياضيات 3',
    'الفيزياء 1',
    'الفيزياء 2',
    'الفيزياء 3',
    'الكيمياء 1',
    'الكيمياء 2',
    'الكيمياء 3',
    'الأحياء 1',
    'الأحياء 2',
    'الأحياء 3',
    'علم الأرض والفضاء',
    'علم البيئة',
    'اللغة الإنجليزية 1-1',
    'اللغة الإنجليزية 1-2',
    'اللغة الإنجليزية 1-3',
    'اللغة الإنجليزية 2-1',
    'اللغة الإنجليزية 2-2',
    'اللغة الإنجليزية 3',
    'التقنية الرقمية 1-1',
    'التقنية الرقمية 1-2',
    'التقنية الرقمية 1-3',
    'التقنية الرقمية 2-1',
    'التقنية الرقمية 2-2',
    'التقنية الرقمية 3',
    'الدراسات الاجتماعية',
    'التاريخ',
    'الجغرافيا',
    'التفكير الناقد',
    'المعرفة المالية',
    'اللياقة والثقافة الصحية',
    'التربية الصحية والبدنية',
    'التربية المهنية',
    'المواطنة الرقمية',
    'الفنون'
  ]
};

const GRADE_SUBJECT_PRESETS: Record<string, string[]> = {
  'الصف الأول الابتدائي': [
    'القرآن الكريم والدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الثاني الابتدائي': [
    'القرآن الكريم والدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الثالث الابتدائي': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الرابع الابتدائي': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'الدراسات الاجتماعية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الخامس الابتدائي': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'الدراسات الاجتماعية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف السادس الابتدائي': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'الدراسات الاجتماعية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الأول المتوسط': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'لغتي الخالدة',
    'الرياضيات',
    'العلوم',
    'الدراسات الاجتماعية',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الثاني المتوسط': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'لغتي الخالدة',
    'الرياضيات',
    'العلوم',
    'الدراسات الاجتماعية',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الثالث المتوسط': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'لغتي الخالدة',
    'الرياضيات',
    'العلوم',
    'الدراسات الاجتماعية',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'التفكير الناقد',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'السنة الأولى المشتركة (أول ثانوي)': [
    'الكفايات اللغوية 1-1',
    'الكفايات اللغوية 1-2',
    'الرياضيات 1-1',
    'الرياضيات 1-2',
    'الرياضيات 1-3',
    'الفيزياء 1',
    'الكيمياء 1',
    'الأحياء 1',
    'علم البيئة',
    'التقنية الرقمية 1-1',
    'التقنية الرقمية 1-2',
    'التقنية الرقمية 1-3',
    'اللغة الإنجليزية 1-1',
    'اللغة الإنجليزية 1-2',
    'اللغة الإنجليزية 1-3',
    'التفكير الناقد',
    'التربية الصحية والبدنية'
  ],
  'الصف الثاني الثانوي - مسارات': [
    'الكفايات اللغوية 2-1',
    'الكفايات اللغوية 2-2',
    'الرياضيات 2-1',
    'الرياضيات 2-2',
    'الفيزياء 2',
    'الكيمياء 2',
    'الأحياء 2',
    'التاريخ',
    'اللغة الإنجليزية 2-1',
    'اللغة الإنجليزية 2-2',
    'التقنية الرقمية 2-1',
    'التقنية الرقمية 2-2',
    'المعرفة المالية',
    'اللياقة والثقافة الصحية',
    'الفنون'
  ],
  'الصف الثالث الثانوي - مسارات': [
    'الدراسات الإسلامية',
    'الرياضيات 3',
    'الفيزياء 3',
    'الكيمياء 3',
    'الأحياء 3',
    'علم الأرض والفضاء',
    'اللغة الإنجليزية 3',
    'التقنية الرقمية 3',
    'الجغرافيا',
    'التربية المهنية',
    'المواطنة الرقمية'
  ]
};

const SUBJECT_PRESETS = [
  'القرآن الكريم والدراسات الإسلامية',
  'القرآن الكريم وتجويده',
  'الدراسات الإسلامية',
  'الرياضيات',
  'العلوم',
  'الفيزياء',
  'الكيمياء',
  'الأحياء',
  'علم الأرض والفضاء',
  'علم البيئة',
  'لغتي الجميلة',
  'لغتي الخالدة',
  'الكفايات اللغوية',
  'اللغة الإنجليزية',
  'المهارات الرقمية',
  'التقنية الرقمية',
  'الدراسات الاجتماعية',
  'التاريخ',
  'الجغرافيا',
  'التفكير الناقد',
  'المعرفة المالية',
  'المهارات الحياتية والأسرية',
  'التربية الفنية',
  'التربية البدنية والدفاع عن النفس',
  'التربية الصحية والبدنية',
  'التربية المهنية',
  'المواطنة الرقمية',
  'الفنون'
];

export default function QuestionBankTab({ 
  currentUser, 
  bankQuestions, 
  bankQuestionsLoaded, 
  triggerToast, 
  triggerConfirm,
  onAutoCreateQuiz,
  hideReadOnlyNotice
}: QuestionBankTabProps) {
  const isPrimaryAccount = !!currentUser && currentUser?.email?.trim().toLowerCase() === 'majedsoft@gmail.com';
  const isAdmin = isPrimaryAccount;

  // Automatic restoration and default question checks have been completely removed and deleted as requested.

  // Mode toggle
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // Question Moving states
  const [isMoving, setIsMoving] = useState(false);
  const [moveProgress, setMoveProgress] = useState(0);
  const [moveTotal, setMoveTotal] = useState(0);

  // AI PDF Generation States
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfMimeType, setPdfMimeType] = useState<string>('application/pdf');
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [pdfCustomPrompt, setPdfCustomPrompt] = useState('');
  const [mcqCount, setMcqCount] = useState<number>(3);
  const [tfCount, setTfCount] = useState<number>(2);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDrafts, setGeneratedDrafts] = useState<Partial<BankQuestion>[]>([]);
  const [selectedDraftIndexes, setSelectedDraftIndexes] = useState<Record<number, boolean>>({});
  const [pdfError, setPdfError] = useState<string | null>(null);

  // AI PDF Generation Classification Overrides
  const [pdfStageOverride, setPdfStageOverride] = useState<string>('auto');
  const [pdfGradeOverride, setPdfGradeOverride] = useState<string>('auto');
  const [pdfSemesterOverride, setPdfSemesterOverride] = useState<string>('auto');
  const [pdfSubjectOverride, setPdfSubjectOverride] = useState<string>('auto');
  const [pdfUnitOverride, setPdfUnitOverride] = useState<string>('');
  const [pdfLessonOverride, setPdfLessonOverride] = useState<string>('');

  const handleResetPdfModalStates = () => {
    setPdfFile(null);
    setPdfMimeType('application/pdf');
    setPdfBase64('');
    setPdfCustomPrompt('');
    setGeneratedDrafts([]);
    setSelectedDraftIndexes({});
    setPdfError(null);
    setPdfStageOverride('auto');
    setPdfGradeOverride('auto');
    setPdfSemesterOverride('auto');
    setPdfSubjectOverride('auto');
    setPdfUnitOverride('');
    setPdfLessonOverride('');
  };

  // Excel Copy-Paste Import States
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelPasteText, setExcelPasteText] = useState('');
  const [excelRows, setExcelRows] = useState<string[][]>([]);
  const [excelMappings, setExcelMappings] = useState<Record<number, string>>({}); // column index -> db field
  const [excelHasHeader, setExcelHasHeader] = useState(true);
  
  // Defaults to apply for imported questions
  const [excelStage, setExcelStage] = useState('المرحلة الثانوية');
  const [excelGrade, setExcelGrade] = useState('السنة الأولى المشتركة (أول ثانوي)');
  const [excelSemester, setExcelSemester] = useState('الفصل الدراسي الأول');
  const [excelSubject, setExcelSubject] = useState('التقنية الرقمية 1-1');
  const [excelUnit, setExcelUnit] = useState('');
  const [excelLesson, setExcelLesson] = useState('');

  const [isExcelImporting, setIsExcelImporting] = useState(false);
  const [excelImportProgress, setExcelImportProgress] = useState(0);
  const [excelImportTotal, setExcelImportTotal] = useState(0);
  const [excelImportErrors, setExcelImportErrors] = useState<string[]>([]);
  const [excelSummaryModal, setExcelSummaryModal] = useState<{ savedCount: number; duplicateCount: number } | null>(null);

  // Automatic Excel row and column parser with auto-mapping
  useEffect(() => {
    if (!excelPasteText.trim()) {
      setExcelRows([]);
      setExcelMappings({});
      return;
    }

    const rawLines = excelPasteText.split(/\r?\n/);
    
    // Auto-detect best delimiter (Tab, Semicolon, or Comma)
    let delimiter = '\t';
    if (rawLines.length > 0) {
      const sample = rawLines[0];
      const tabs = (sample.match(/\t/g) || []).length;
      const semicolons = (sample.match(/;/g) || []).length;
      const commas = (sample.match(/,/g) || []).length;
      
      if (semicolons > tabs && semicolons > commas) {
        delimiter = ';';
      } else if (commas > tabs && commas > semicolons) {
        delimiter = ',';
      }
    }

    const parsed = rawLines
      .map(line => line.split(delimiter).map(cell => cell.trim()))
      .filter(row => row.length > 0 && row.some(cell => cell !== ''));

    setExcelRows(parsed);

    // Smart Auto-Mapping
    if (parsed.length > 0) {
      const firstRow = parsed[0];
      const mappings: Record<number, string> = {};
      
      // Helper to normalize Arabic text for robust mapping
      const normalizeArabic = (str: string) => {
        return str
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '') // remove all whitespace
          .replace(/[أإآ]/g, 'ا') // replace hamzas with plain alif
          .replace(/ة/g, 'ه') // replace teh marbuta with heh
          .replace(/[ى]/g, 'ي'); // replace alif maksura with yeh
      };
      
      // Step 1: Detect explicit columns first
      firstRow.forEach((cell, idx) => {
        const text = cell.toLowerCase();
        const normCell = normalizeArabic(cell);
        
        if (normCell.includes('سؤال') || normCell.includes('السؤال') || text.includes('text') || text.includes('question')) {
          mappings[idx] = 'text';
        } else if (normCell.includes('نوع') || text.includes('type')) {
          mappings[idx] = 'type';
        } else if (
          normCell.includes('خيار1') || 
          normCell.includes('خياراول') || 
          normCell.includes('الاول') || 
          text.includes('opt1') || 
          text.includes('option1') || 
          text.includes('أ') || 
          text.includes('أ)') || 
          text.includes('1)') ||
          normCell.includes('اجابهصحيحه') ||
          normCell.includes('الاجابهالصحيحه') ||
          normCell.includes('الجوابالصحيح') ||
          normCell.includes('الخيارالصحيح') ||
          normCell.includes('الاجابه') ||
          normCell.includes('الجواب') ||
          text.includes('correct') ||
          text.includes('answer')
        ) {
          mappings[idx] = 'option1';
        } else if (
          normCell.includes('خيار2') || 
          normCell.includes('خيارثاني') || 
          normCell.includes('الثاني') || 
          text.includes('opt2') || 
          text.includes('option2') || 
          text.includes('ب') || 
          text.includes('ب)') || 
          text.includes('2)')
        ) {
          mappings[idx] = 'option2';
        } else if (
          normCell.includes('خيار3') || 
          normCell.includes('خيارثالث') || 
          normCell.includes('الثالث') || 
          text.includes('opt3') || 
          text.includes('option3') || 
          text.includes('ج') || 
          text.includes('ج)') || 
          text.includes('3)')
        ) {
          mappings[idx] = 'option3';
        } else if (
          normCell.includes('خيار4') || 
          normCell.includes('خياررابع') || 
          normCell.includes('الرابع') || 
          text.includes('opt4') || 
          text.includes('option4') || 
          text.includes('د') || 
          text.includes('د)') || 
          text.includes('4)')
        ) {
          mappings[idx] = 'option4';
        } else if (normCell.includes('درج') || normCell.includes('درجه') || normCell.includes('نقاط') || text.includes('point') || text.includes('score')) {
          mappings[idx] = 'points';
        } else if (normCell.includes('وحد') || normCell.includes('الوحده') || text.includes('unit')) {
          mappings[idx] = 'unit';
        } else if (normCell.includes('درس') || normCell.includes('الدرس') || text.includes('lesson')) {
          mappings[idx] = 'lesson';
        }
      });

      // Step 2: Ensure we have a text mapping
      const hasTextMapping = Object.values(mappings).includes('text');
      if (!hasTextMapping) {
        mappings[0] = 'text';
      }

      // Step 3: Sequentially map remaining unmapped columns to option1, option2, option3, option4
      let optIndex = 1;
      for (let i = 0; i < firstRow.length; i++) {
        // Skip columns that already have explicit mappings
        if (mappings[i]) {
          // If it's already mapped to an option, increment our sequential index tracker so we don't overwrite
          if (mappings[i].startsWith('option')) {
            const num = parseInt(mappings[i].replace('option', ''), 10);
            if (num >= optIndex) optIndex = num + 1;
          }
          continue;
        }

        // Map unmapped columns to options sequentially (up to 4 options)
        if (optIndex <= 4) {
          mappings[i] = `option${optIndex}`;
          optIndex++;
        }
      }
      
      setExcelMappings(mappings);
    }
  }, [excelPasteText]);

  const handleExcelStageChange = (stage: string) => {
    setExcelStage(stage);
    const presets = GRADE_PRESETS[stage];
    if (presets && presets.length > 0) {
      const defaultGrade = presets[0];
      setExcelGrade(defaultGrade);
      
      const validSubjects = GRADE_SUBJECT_PRESETS[defaultGrade];
      if (validSubjects && validSubjects.length > 0) {
        setExcelSubject(validSubjects[0]);
      } else {
        const subjPresets = STAGE_SUBJECT_PRESETS[stage];
        if (subjPresets && subjPresets.length > 0) {
          setExcelSubject(subjPresets[0]);
        }
      }
    }
  };

  const handleImportExcelData = async () => {
    if (!isAdmin) {
      triggerToast('استيراد وإضافة أسئلة بنك الأسئلة متاح فقط للحساب الرئيسي (majedsoft@gmail.com).', 'error');
      return;
    }

    if (excelRows.length === 0) {
      triggerToast('يرجى لصق بيانات صالحة من ملف Excel أولاً.', 'error');
      return;
    }

    const startIndex = excelHasHeader ? 1 : 0;
    const rowsToProcess = excelRows.slice(startIndex);

    if (rowsToProcess.length === 0) {
      triggerToast('لا توجد صفوف كافية للاستيراد بعد تخطي السطر الأول.', 'error');
      return;
    }

    // Map column names
    const invMappings = Object.entries(excelMappings).reduce((acc, [colIdx, field]) => {
      acc[field] = Number(colIdx);
      return acc;
    }, {} as Record<string, number>);

    if (invMappings['text'] === undefined) {
      triggerToast('يجب تحديد العمود الذي يحتوي على نص السؤال.', 'error');
      return;
    }

    setIsExcelImporting(true);
    setExcelImportProgress(0);
    setExcelImportTotal(rowsToProcess.length);
    setExcelImportErrors([]);

    try {
      let duplicateCount = 0;
      const errors: string[] = [];
      const norm = (s: any) => String(s || '').replace(/\s+/g, '').toLowerCase();

      // Fast O(N) duplicate checking using Set
      const getCompositeKey = (textStr: string, typeStr: string, subjStr: string, grdStr: string, optsArr: string[]) => {
        const opts = (optsArr || []).map(o => norm(o)).sort().join('|');
        return `${norm(textStr)}||${typeStr || ''}||${norm(subjStr)}||${norm(grdStr)}||${opts}`;
      };

      const existingKeysSet = new Set<string>();
      bankQuestions.forEach(q => {
        existingKeysSet.add(getCompositeKey(q.text, q.type, q.subject, q.grade, q.options || []));
      });

      const addedQuestionsKeys = new Set<string>();
      const questionsToSave: BankQuestion[] = [];

      // Stage 1: Fast filtering and object construction
      for (let i = 0; i < rowsToProcess.length; i++) {
        const row = rowsToProcess[i];
        const text = row[invMappings['text']] || '';
        
        if (!text.trim()) {
          continue;
        }

        // Extract question type
        let type: QuestionType = 'multiple_choice';
        if (invMappings['type'] !== undefined) {
          const rawType = String(row[invMappings['type']] || '').toLowerCase();
          if (rawType.includes('صح') || rawType.includes('خطأ') || rawType.includes('false') || rawType.includes('true') || rawType === 'tf' || rawType === 't/f') {
            type = 'true_false';
          }
        }

        // Extract options (guarantee exactly 4 options for multiple choice)
        const options: string[] = [];
        if (type === 'multiple_choice') {
          const opt1 = invMappings['option1'] !== undefined ? row[invMappings['option1']] || '' : '';
          const opt2 = invMappings['option2'] !== undefined ? row[invMappings['option2']] || '' : '';
          const opt3 = invMappings['option3'] !== undefined ? row[invMappings['option3']] || '' : '';
          const opt4 = invMappings['option4'] !== undefined ? row[invMappings['option4']] || '' : '';
          
          options.push(String(opt1).trim() || 'الخيار الأول');
          options.push(String(opt2).trim() || 'الخيار الثاني');
          options.push(String(opt3).trim() || 'الخيار الثالث');
          options.push(String(opt4).trim() || 'الخيار الرابع');
        } else {
          options.push('صح');
          options.push('خطأ');
        }

        // Extract correct answer - Always the first option (index 0) is the correct answer
        let correctAnswer = type === 'true_false' ? 'true' : '0';

        // Extract points
        let points = 1; // Default score is 1 point for standard questions
        if (invMappings['points'] !== undefined) {
          const rawPoints = Number(row[invMappings['points']]);
          if (!isNaN(rawPoints) && rawPoints > 0) {
            points = Math.round(rawPoints);
          }
        }
        if (points < 1) points = 1;
        if (points > 100) points = 100;

        const rawUnit = invMappings['unit'] !== undefined ? row[invMappings['unit']] || excelUnit : excelUnit;
        const rawLesson = invMappings['lesson'] !== undefined ? row[invMappings['lesson']] || excelLesson : excelLesson;

        // Ensure non-empty values that strictly satisfy Firestore Schema rule: size() >= 1
        const unitStr = (String(rawUnit).trim() || 'الوحدة الأولى').substring(0, 100);
        const lessonStr = (String(rawLesson).trim() || 'الدرس الأول').substring(0, 100);

        const stageStr = (excelStage || 'المرحلة الثانوية').trim().substring(0, 100);
        const gradeStr = (excelGrade || 'السنة الأولى المشتركة (أول ثانوي)').trim().substring(0, 100);
        const semesterStr = (excelSemester || 'الفصل الدراسي الأول').trim().substring(0, 100);
        const subjectStr = (excelSubject || 'التقنية الرقمية 1-1').trim().substring(0, 100);

        // Duplicate check
        const compKey = getCompositeKey(text, type, subjectStr, gradeStr, options);
        if (existingKeysSet.has(compKey) || addedQuestionsKeys.has(compKey)) {
          duplicateCount++;
          continue;
        }

        addedQuestionsKeys.add(compKey);

        const newBqId = `bq-excel-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`;
        const newBqObj: BankQuestion = {
          id: newBqId,
          teacherId: currentUser.uid || 'system',
          text: String(text).trim(),
          type,
          options,
          correctAnswer,
          points,
          stage: stageStr,
          grade: gradeStr,
          semester: semesterStr,
          subject: subjectStr,
          unit: unitStr,
          lesson: lessonStr
        };

        questionsToSave.push(newBqObj);
      }

      // Stage 2: Bulk Batch Writes of up to 500 documents at a time
      if (questionsToSave.length === 0) {
        setIsExcelImporting(false);
        if (duplicateCount > 0) {
          triggerToast(`💡 تم تخطي وتجاهل الأسئلة المستوردة لأنها مكررة وموجودة بالفعل في البنك! (تكرار: ${duplicateCount} سؤال)، تم الحفظ: 0.`, 'success');
          setExcelSummaryModal({ savedCount: 0, duplicateCount });
          setExcelPasteText('');
          setExcelRows([]);
          setShowExcelModal(false);
        } else {
          triggerToast('لم يتم العثور على أي أسئلة صالحة للاستيراد.', 'error');
        }
        return;
      }

      let savedCount = 0;
      const batchSize = 500;

      for (let i = 0; i < questionsToSave.length; i += batchSize) {
        const chunk = questionsToSave.slice(i, i + batchSize);
        const batch = writeBatch(db);

        chunk.forEach(q => {
          const docRef = doc(db, 'question_bank', q.id);
          batch.set(docRef, q);
        });

        try {
          await batch.commit();
          savedCount += chunk.length;
        } catch (err: any) {
          console.error(err);
          const batchErrorMsg = err.message || err;
          errors.push(`فشل حفظ دفعة الأسئلة رقم ${Math.floor(i / batchSize) + 1}: ${batchErrorMsg}`);
        }

        // Update progress bar
        setExcelImportProgress(Math.min(rowsToProcess.length, duplicateCount + savedCount));
      }

      setIsExcelImporting(false);
      setExcelImportErrors(errors);

      if (errors.length > 0) {
        triggerToast(`تم استيراد ${savedCount} سؤال بنجاح، وتجاهل ${duplicateCount} سؤال مكرر. واجهنا ${errors.length} خطأ أثناء الحفظ.`, 'info');
        setExcelSummaryModal({ savedCount, duplicateCount });
        setExcelPasteText('');
        setExcelRows([]);
        setShowExcelModal(false);
      } else {
        // Beautiful Arabic summary detailing success/ignore as requested by user
        let summaryMsg = `🎉 تم الاستيراد بنجاح! 📊 ملخص العملية: \n• عدد الأسئلة المستوردة: ${savedCount} سؤال \n• عدد الأسئلة المكررة التي تم تجاهلها: ${duplicateCount} سؤال.`;
        triggerToast(summaryMsg, 'success');
        setExcelSummaryModal({ savedCount, duplicateCount });
        setExcelPasteText('');
        setExcelRows([]);
        setShowExcelModal(false);
      }
    } catch (outerError: any) {
      console.error("Outer Excel import error:", outerError);
      setIsExcelImporting(false);
      triggerToast(`حدث خطأ غير متوقع أثناء معالجة بيانات الاستيراد: ${outerError.message || outerError}`, 'error');
    }
  };

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState('all');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterSemester, setFilterSemester] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterLesson, setFilterLesson] = useState('all');

  // Multi-selection state for batch delete
  const [selectedBqIds, setSelectedBqIds] = useState<Record<string, boolean>>({});

  // Form states for adding / editing bank question
  const [formText, setFormText] = useState('');
  const [formType, setFormType] = useState<QuestionType>('multiple_choice');
  const [formOptions, setFormOptions] = useState<string[]>(['', '', '', '']);
  const [formCorrectAnswer, setFormCorrectAnswer] = useState('0');
  const [formPoints, setFormPoints] = useState(1);

  const [formStage, setFormStage] = useState('المرحلة الثانوية');
  const [formGrade, setFormGrade] = useState('السنة الأولى المشتركة (أول ثانوي)');
  const [formSemester, setFormSemester] = useState('الفصل الدراسي الأول');
  const [formSubject, setFormSubject] = useState('التقنية الرقمية');
  const [formUnit, setFormUnit] = useState('');
  const [formLesson, setFormLesson] = useState('');

  // Move selected questions states
  const [isMovePanelOpen, setIsMovePanelOpen] = useState(false);
  const [moveStage, setMoveStage] = useState('المرحلة الثانوية');
  const [moveGrade, setMoveGrade] = useState('السنة الأولى المشتركة (أول ثانوي)');
  const [moveSemester, setMoveSemester] = useState('الفصل الدراسي الأول');
  const [moveSubject, setMoveSubject] = useState('التقنية الرقمية');
  const [moveUnit, setMoveUnit] = useState('');
  const [moveLesson, setMoveLesson] = useState('');



  // Handle stage change in form to adjust grade presets
  const handleFormStageChange = (stage: string) => {
    setFormStage(stage);
    const presets = GRADE_PRESETS[stage];
    if (presets && presets.length > 0) {
      const defaultGrade = presets[0];
      setFormGrade(defaultGrade);
      
      const validSubjects = GRADE_SUBJECT_PRESETS[defaultGrade];
      if (validSubjects && validSubjects.length > 0) {
        setFormSubject(validSubjects[0]);
      } else {
        const subjPresets = STAGE_SUBJECT_PRESETS[stage];
        if (subjPresets && subjPresets.length > 0) {
          setFormSubject(subjPresets[0]);
        }
      }
    }
  };

  // Convert True/False choices
  const handleTypeChange = (type: QuestionType) => {
    setFormType(type);
    if (type === 'true_false') {
      setFormOptions(['صحيح', 'خطأ']);
      setFormCorrectAnswer('true');
    } else {
      setFormOptions(['', '', '', '']);
      setFormCorrectAnswer('0');
    }
  };

  const handleOptionChange = (idx: number, val: string) => {
    const nextOpts = [...formOptions];
    nextOpts[idx] = val;
    setFormOptions(nextOpts);
  };

  const handleResetForm = () => {
    setFormText('');
    setFormType('multiple_choice');
    setFormOptions(['', '', '', '']);
    setFormCorrectAnswer('0');
    setFormPoints(1);
    setFormStage('المرحلة الثانوية');
    setFormGrade('السنة الأولى المشتركة (أول ثانوي)');
    setFormSemester('الفصل الدراسي الأول');
    setFormSubject('التقنية الرقمية');
    setFormUnit('');
    setFormLesson('');
    setShowAddForm(false);
    setEditingQuestionId(null);
  };

  // Save question handler (Insert or Update)
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      triggerToast('تعديل وإضافة أسئلة بنك الأسئلة متاح فقط للحساب الرئيسي (majedsoft@gmail.com).', 'error');
      return;
    }

    if (!formText.trim()) {
      triggerToast('الرجاء كتابة نص السؤال الأول', 'error');
      return;
    }
    if (formType === 'multiple_choice') {
      const anyEmpty = formOptions.some(opt => !opt.trim());
      if (anyEmpty) {
        triggerToast('الرجاء كتابة جميع الخيارات الأربعة للسؤال متعدد الخيارات', 'error');
        return;
      }
    }
    const finalUnit = formUnit.trim() || 'الوحدة الأولى';
    const finalLesson = formLesson.trim() || 'الدرس الأول';

    // Check for existing duplicate before saving (except when editing back the same question)
    const isDuplicate = bankQuestions.some(q => {
      if (editingQuestionId && q.id === editingQuestionId) return false;
      const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
      const sameText = norm(q.text) === norm(formText);
      const sameType = q.type === formType;
      const sameSubject = q.subject === formSubject;
      const sameGrade = q.grade === formGrade;
      const opts1 = (q.options || []).map(o => norm(o)).sort().join('|');
      const opts2 = (formOptions || []).map(o => norm(o)).sort().join('|');
      return sameText && sameType && sameSubject && sameGrade && opts1 === opts2;
    });

    if (isDuplicate) {
      triggerToast('عذراً، هذا السؤال موجود بالفعل في بنك الأسئلة للمادة والصف المحددين بنفس النص والخيارات!', 'error');
      return;
    }

    const bqId = editingQuestionId || `bq-${Date.now()}`;
    const questionObj: BankQuestion = {
      id: bqId,
      teacherId: currentUser.uid,
      text: formText.trim(),
      type: formType,
      options: formOptions.map(o => o.trim()),
      correctAnswer: formCorrectAnswer,
      points: Number(formPoints),
      stage: formStage,
      grade: formGrade,
      semester: formSemester,
      subject: formSubject,
      unit: finalUnit,
      lesson: finalLesson
    };

    try {
      await setDoc(doc(db, 'question_bank', bqId), questionObj);
      triggerToast(
        editingQuestionId ? 'تم تحديث وتحفيظ سؤال بنك الأسئلة بنجاح' : 'تم إضافة السؤال إلى بنك الأسئلة بنجاح!',
        'success'
      );
      handleResetForm();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `question_bank/${bqId}`);
    }
  };

  // Trigger editing mode
  const handleStartEdit = (q: BankQuestion) => {
    setEditingQuestionId(q.id);
    setFormText(q.text);
    setFormType(q.type);
    setFormOptions(q.options);
    setFormCorrectAnswer(q.correctAnswer);
    setFormPoints(q.points);
    setFormStage(q.stage);
    setFormGrade(q.grade);
    setFormSemester(q.semester);
    setFormSubject(q.subject);
    setFormUnit(q.unit);
    setFormLesson(q.lesson);
    setShowAddForm(true);
    // Smooth scroll to top of workspace
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const filename = file.name.toLowerCase();
    const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
    
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.xlsx', '.xls'];
    const allowedMimeTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];

    const isAllowed = allowedMimeTypes.includes(file.type) || allowedExtensions.includes(extension);

    if (!isAllowed) {
      triggerToast('صيغة الملف غير مدعومة. يرجى اختيار ملف PDF أو Word أو Excel صالحة.', 'error');
      return;
    }

    // Limit file size to 10MB to avoid proxy network upload errors (e.g., 413 Payload Too Large)
    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSizeBytes) {
      triggerToast(
        `حجم الملف كبير جداً (${(file.size / 1024 / 1024).toFixed(1)} ميجابايت). يرجى اختيار ملف أصغر من 10 ميجابايت.`,
        'error'
      );
      setPdfError(
        `حجم الملف (${(file.size / 1024 / 1024).toFixed(1)} ميجابايت) يتجاوز الحد الأقصى المسموح به لضمان نجاح التحليل (10 ميجابايت). يرجى تقسيم المستند أو ضغطه قبل الرفع.`
      );
      setPdfFile(null);
      setPdfBase64('');
      return;
    }

    // Determine the exact MIME type to send to Gemini
    let detectedMime = file.type;
    if (!detectedMime) {
      if (extension === '.pdf') detectedMime = 'application/pdf';
      else if (extension === '.docx') detectedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (extension === '.doc') detectedMime = 'application/msword';
      else if (extension === '.xlsx') detectedMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      else if (extension === '.xls') detectedMime = 'application/vnd.ms-excel';
    }

    setPdfFile(file);
    setPdfMimeType(detectedMime || 'application/pdf');
    setPdfError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result?.toString().split(',')[1] || '';
      setPdfBase64(base64String);
    };
    reader.onerror = () => {
      setPdfError('فشل في قراءة محتوى الملف وتحويله.');
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateQuestionsFromPdf = async () => {
    if (!pdfBase64) {
      triggerToast('يرجى تحميل ملف للمتابعة', 'error');
      return;
    }

    setIsGenerating(true);
    setPdfError(null);
    setGeneratedDrafts([]);
    setSelectedDraftIndexes({});

    try {
      const res = await fetch('/api/generate-questions-from-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfBase64,
          mimeType: pdfMimeType,
          customPrompt: pdfCustomPrompt,
          mcqCount,
          tfCount,
          stageOverride: pdfStageOverride,
          gradeOverride: pdfGradeOverride,
          semesterOverride: pdfSemesterOverride,
          subjectOverride: pdfSubjectOverride,
          unitOverride: pdfUnitOverride,
          lessonOverride: pdfLessonOverride
        }),
      });

      if (!res.ok) {
        let errMsg = 'فشلت عملية التحليل واستخراج الأسئلة.';
        try {
          const responseText = await res.text();
          if (responseText.startsWith("{") || responseText.startsWith("[")) {
            const errData = JSON.parse(responseText);
            errMsg = errData.error || errMsg;
          } else if (res.status === 413) {
            errMsg = "الملف المختار كبير جداً بالنسبة للشبكة السحابية. يرجى استخدام مستند أصغر من 10 ميجابايت، أو تقسيمه لعدة أجزاء.";
          } else {
            errMsg = `خطأ من الخادم (رمز الخطأ: ${res.status}). قد يكون حجم المستند كبيراً جداً بالنسبة لشبكة الاتصال.`;
          }
        } catch (e) {
          if (res.status === 413) {
            errMsg = "الملف المختار كبير جداً بالنسبة للشبكة السحابية. يرجى استخدام مستند أصغر من 10 ميجابايت، أو تقسيمه لعدة أجزاء.";
          }
        }
        throw new Error(errMsg);
      }

      const responseText = await res.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error("تلقى التطبيق استجابة غير صالحة من الخادم. قد يكون الملف كبيراً جداً أو يحتوي على بيانات غير مدعومة.");
      }

      if (data.success && Array.isArray(data.questions)) {
        setGeneratedDrafts(data.questions);
        const initialSelected: Record<number, boolean> = {};
        data.questions.forEach((_: any, idx: number) => {
          initialSelected[idx] = true;
        });
        setSelectedDraftIndexes(initialSelected);
        triggerToast(`تم استخراج ${data.questions.length} أسئلة بنجاح مراجعة وحفظ!`, 'success');
      } else {
        throw new Error('الاستجابة المستلمة من الخادم غير صالحة.');
      }
    } catch (err: any) {
      console.error(err);
      setPdfError(err.message || 'حدث خطأ غير متوقع أثناء استخراج الأسئلة.');
      triggerToast('حدث خطأ أثناء معالجة الملف', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveSelectedDrafts = async () => {
    if (!isAdmin) {
      triggerToast('حفظ واستيراد أسئلة بنك الأسئلة متاح فقط للحساب الرئيسي (majedsoft@gmail.com).', 'error');
      return;
    }

    const draftsToSave = generatedDrafts.filter((_, idx) => selectedDraftIndexes[idx]);
    if (draftsToSave.length === 0) {
      triggerToast('يرجى اختيار سؤال واحد على الأقل ليتم حفظه ببنك الأسئلة', 'error');
      return;
    }

    try {
      let savedCount = 0;
      let skippedDuplicates = 0;
      for (let i = 0; i < draftsToSave.length; i++) {
        const draft = draftsToSave[i];
        
        // Apply classification overrides if selected
        const draftStage = pdfStageOverride !== 'auto' ? pdfStageOverride : (draft.stage || 'المرحلة الثانوية');
        const draftGrade = pdfGradeOverride !== 'auto' ? pdfGradeOverride : (draft.grade || 'السنة الأولى المشتركة (أول ثانوي)');
        const draftSemester = pdfSemesterOverride !== 'auto' ? pdfSemesterOverride : (draft.semester || 'الفصل الدراسي الأول');
        const draftSubject = pdfSubjectOverride !== 'auto' ? pdfSubjectOverride : (draft.subject || 'التقنية الرقمية');
        const draftUnit = (pdfUnitOverride.trim() !== '' ? pdfUnitOverride.trim() : (draft.unit || 'الوحدة الأولى')).trim();
        const draftLesson = (pdfLessonOverride.trim() !== '' ? pdfLessonOverride.trim() : (draft.lesson || 'الدرس الأول')).trim();

        // Check if there is already a duplicate in the question bank
        const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
        const draftText = draft.text || 'سؤال مستخرج';
        const draftType = draft.type === 'true_false' ? 'true_false' : 'multiple_choice';
        const draftOptions = Array.isArray(draft.options) ? draft.options : [];
        
        const isDuplicate = bankQuestions.some(q => {
          const sameText = norm(q.text) === norm(draftText);
          const sameType = q.type === draftType;
          const sameSubject = q.subject === draftSubject;
          const sameGrade = q.grade === draftGrade;
          const opts1 = (q.options || []).map(o => norm(o)).sort().join('|');
          const opts2 = draftOptions.map(o => norm(o)).sort().join('|');
          return sameText && sameType && sameSubject && sameGrade && opts1 === opts2;
        });

        if (isDuplicate) {
          skippedDuplicates++;
          continue;
        }

        const newBqId = `bq-ai-${Date.now()}-${i}`;
        const newBqObj: BankQuestion = {
          id: newBqId,
          teacherId: currentUser.uid,
          text: draftText,
          type: draftType,
          options: draftOptions.map(o => o.trim()),
          correctAnswer: String(draft.correctAnswer ?? '0'),
          points: Number(draft.points || 1),
          stage: draftStage,
          grade: draftGrade,
          semester: draftSemester,
          subject: draftSubject,
          unit: draftUnit,
          lesson: draftLesson
        };

        await setDoc(doc(db, 'question_bank', newBqId), newBqObj);
        savedCount++;
      }

      if (skippedDuplicates > 0) {
        triggerToast(`تم بنجاح حفظ وصرف ${savedCount} سؤال مستخرج، وتخطي ${skippedDuplicates} سؤال مكرر لعدم التكرار.`, 'success');
      } else {
        triggerToast(`تم بنجاح حفظ وصرف ${savedCount} سؤال مستخرج بالذكاء الاصطناعي في بنك أسئلتك!`, 'success');
      }
      
      // Reset Modal state
      handleResetPdfModalStates();
    } catch (err) {
      console.error('Error saving drafted questions to Firestore:', err);
      triggerToast('حدث خطأ أثناء حفظ الأسئلة ببنك الأسئلة.', 'error');
    }
  };

  // Delete question
  const handleDeleteQuestion = async (id: string, text: string) => {
    if (!isAdmin) {
      triggerToast('حذف وتعديل أسئلة بنك الأسئلة متاح فقط للحساب الرئيسي (majedsoft@gmail.com).', 'error');
      return;
    }
    triggerConfirm(
      'حذف السؤال نهائياً',
      `هل أنت متأكد من رغبتك في حذف هذا السؤال نهائياً من كشف بنك الأسئلة؟\n\n"${text.substring(0, 50)}..."`,
      async () => {
        try {
          await deleteDoc(doc(db, 'question_bank', id));
          triggerToast('تم حذف السؤال من بنك الأسئلة بنجاح', 'success');
          if (editingQuestionId === id) handleResetForm();
          // Remove from selection if checked
          if (selectedBqIds[id]) {
            const updated = { ...selectedBqIds };
            delete updated[id];
            setSelectedBqIds(updated);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `question_bank/${id}`);
        }
      },
      undefined,
      'نعم، احذف السؤال',
      'إلغاء الإجراء'
    );
  };

  // Batch delete selected questions
  const handleDeleteSelected = async () => {
    if (!isAdmin) {
      triggerToast('حذف أسئلة بنك الأسئلة متاح فقط للحساب الرئيسي (majedsoft@gmail.com).', 'error');
      return;
    }
    const selectedIds = Object.keys(selectedBqIds).filter(id => selectedBqIds[id]);
    if (selectedIds.length === 0) return;

    triggerConfirm(
      'حذف الأسئلة المحددة دفعة واحدة',
      `هل أنت متأكد من رغبتك في حذف ${selectedIds.length} سؤالاً محدداً نهائياً من بنك الأسئلة؟ لا يمكن التراجع عن هذا الإجراء المعمم.`,
      async () => {
        try {
          let count = 0;
          for (const id of selectedIds) {
            await deleteDoc(doc(db, 'question_bank', id));
            if (editingQuestionId === id) handleResetForm();
            count++;
          }
          setSelectedBqIds({});
          triggerToast(`تم حذف ${count} سؤال من بنك الأسئلة بنجاح!`, 'success');
        } catch (err) {
          console.error("Error bulk deleting questions:", err);
          triggerToast('حدث خطأ أثناء محاولة حذف الأسئلة المحددة.', 'error');
        }
      },
      undefined,
      'نعم، احذف الأسئلة المحددة',
      'إلغاء الإجراء'
    );
  };

  const handleMoveStageChange = (stage: string) => {
    setMoveStage(stage);
    const presets = GRADE_PRESETS[stage];
    if (presets && presets.length > 0) {
      const defaultGrade = presets[0];
      setMoveGrade(defaultGrade);
      
      const validSubjects = GRADE_SUBJECT_PRESETS[defaultGrade];
      if (validSubjects && validSubjects.length > 0) {
        setMoveSubject(validSubjects[0]);
      } else {
        const subjPresets = STAGE_SUBJECT_PRESETS[stage];
        if (subjPresets && subjPresets.length > 0) {
          setMoveSubject(subjPresets[0]);
        }
      }
    }
  };

  const handleMoveSelected = async () => {
    if (!isAdmin) {
      triggerToast('نقل أسئلة بنك الأسئلة متاح فقط للحساب الرئيسي (majedsoft@gmail.com).', 'error');
      return;
    }
    const selectedIds = Object.keys(selectedBqIds).filter(id => selectedBqIds[id]);
    if (selectedIds.length === 0) return;

    triggerConfirm(
      'تأكيد نقل الأسئلة المحددة',
      `هل أنت متأكد من رغبتك في نقل ${selectedIds.length} سؤالاً محدداً إلى التصنيف الجديد المختار؟\n\n` +
      `المرحلة: ${moveStage}\n` +
      `الصف: ${moveGrade}\n` +
      `الفصل: ${moveSemester}\n` +
      `المادة: ${moveSubject}\n` +
      `الوحدة: ${moveUnit.trim() || 'سيتم الاحتفاظ بالوحدة الأصلية للأسئلة'}\n` +
      `الدرس: ${moveLesson.trim() || 'سيتم الاحتفاظ بالدرس الأصلي للأسئلة'}`,
      async () => {
        setIsMoving(true);
        setMoveProgress(0);
        setMoveTotal(selectedIds.length);
        try {
          let count = 0;
          for (const id of selectedIds) {
            const originalQuestion = bankQuestions.find(q => q.id === id);
            const finalUnit = moveUnit.trim() || (originalQuestion ? originalQuestion.unit : '') || 'الوحدة الأولى';
            const finalLesson = moveLesson.trim() || (originalQuestion ? originalQuestion.lesson : '') || 'الدرس الأول';

            await updateDoc(doc(db, 'question_bank', id), {
              stage: moveStage,
              grade: moveGrade,
              semester: moveSemester,
              subject: moveSubject,
              unit: finalUnit,
              lesson: finalLesson
            });
            count++;
            setMoveProgress(count);
          }
          setSelectedBqIds({});
          setIsMovePanelOpen(false);
          triggerToast(`تم بنجاح نقل ${count} سؤال إلى التصنيف الجديد بنجاح!`, 'success');
        } catch (err) {
          console.error("Error bulk moving questions:", err);
          triggerToast('حدث خطأ أثناء محاولة نقل الأسئلة المحددة. يرجى التحقق من المدخلات والمحاولة لاحقاً.', 'error');
        } finally {
          setIsMoving(false);
        }
      },
      undefined,
      'نعم، انقل الأسئلة الآن',
      'إلغاء الإجراء'
    );
  };

  // Find all existing duplicate questions in the bank
  const getDuplicatesInfo = () => {
    const seen = new Map<string, string>(); // uniqueKey -> first question ID
    const duplicateIds: string[] = []; // IDs of the duplicates to delete
    
    bankQuestions.forEach((q) => {
      const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
      const textKey = norm(q.text);
      const typeKey = q.type;
      const subKey = q.subject;
      const grKey = q.grade;
      const optsKey = (q.options || []).map(o => norm(o)).sort().join('|');
      
      const uniqueKey = `${textKey}::${typeKey}::${subKey}::${grKey}::${optsKey}`;
      
      if (seen.has(uniqueKey)) {
        duplicateIds.push(q.id);
      } else {
        seen.set(uniqueKey, q.id);
      }
    });

    return duplicateIds;
  };

  // Automated cleanup of all found duplicate questions
  const handleCleanDuplicates = async () => {
    if (!isAdmin) {
      triggerToast('تنظيف الأسئلة المكررة متاح فقط للحساب الرئيسي (majedsoft@gmail.com).', 'error');
      return;
    }
    const dups = getDuplicatesInfo();
    if (dups.length === 0) {
      triggerToast('ممتاز! لم يتم العثور على أي أسئلة مكررة في بنك الأسئلة حالياً.', 'info');
      return;
    }

    triggerConfirm(
      'تنظيف الأسئلة المكررة تلقائياً',
      `تم اكتشاف ${dups.length} سؤال مكرر بنفس التفاصيل (النص، المادة، الصف والخيارات). هل تريد حذف جميع النسخ المكررة والاحتفاظ بنسخة فريدة واحدة من كل سؤال في بنك الأسئلة؟ لا يمكن التراجع عن هذا الإجراء.`,
      async () => {
        try {
          let count = 0;
          for (const id of dups) {
            await deleteDoc(doc(db, 'question_bank', id));
            if (editingQuestionId === id) handleResetForm();
            count++;
          }
          // Remove deleted ones from selection list if any
          setSelectedBqIds(prev => {
            const updated = { ...prev };
            dups.forEach(id => {
              delete updated[id];
            });
            return updated;
          });
          triggerToast(`تم بنجاح تنظيف البنك وحذف ${count} سؤال مكرر!`, 'success');
        } catch (err) {
          console.error("Error cleaning duplicate questions:", err);
          triggerToast('حدث خطأ أثناء محاولة تنظيف الأسئلة المكررة.', 'error');
        }
      },
      undefined,
      'نعم، نظّف واحذف المكرر',
      'إلغاء الإجراء'
    );
  };




  // Filter logic
  const filteredBank = bankQuestions.filter(q => {
    const matchesSearch = searchQuery.trim() === '' || 
                          q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          q.unit.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          q.lesson.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStage = filterStage === 'all' || q.stage === filterStage;
    const matchesGrade = filterGrade === 'all' || q.grade === filterGrade;
    const matchesSubject = filterSubject === 'all' || q.subject === filterSubject;
    const matchesSemester = filterSemester === 'all' || q.semester === filterSemester;
    const matchesUnit = filterUnit === 'all' || q.unit === filterUnit;
    const matchesLesson = filterLesson === 'all' || q.lesson === filterLesson;

    return matchesSearch && matchesStage && matchesGrade && matchesSubject && matchesSemester && matchesUnit && matchesLesson;
  });

  // Unique filter lists built dynamically from the database contents (strictly based on existing bank questions only)
  const loadedStages = Array.from(new Set(bankQuestions.map(q => q.stage))).filter(Boolean).sort();
  const loadedGrades = Array.from(new Set(
    bankQuestions
      .filter(q => filterStage === 'all' || q.stage === filterStage)
      .map(q => q.grade)
  )).filter(Boolean).sort();
  const loadedSemesters = Array.from(new Set(
    bankQuestions
      .filter(q => (filterStage === 'all' || q.stage === filterStage) && (filterGrade === 'all' || q.grade === filterGrade))
      .map(q => q.semester)
  )).filter(Boolean).sort();
  const loadedSubjects = Array.from(new Set(
    bankQuestions
      .filter(q => (filterStage === 'all' || q.stage === filterStage) && (filterGrade === 'all' || q.grade === filterGrade) && (filterSemester === 'all' || q.semester === filterSemester))
      .map(q => q.subject)
  )).filter(Boolean).sort();
  const loadedUnits = Array.from(new Set(
    bankQuestions
      .filter(q => (filterStage === 'all' || q.stage === filterStage) && (filterGrade === 'all' || q.grade === filterGrade) && (filterSemester === 'all' || q.semester === filterSemester) && (filterSubject === 'all' || q.subject === filterSubject))
      .map(q => q.unit)
  )).filter(Boolean).sort();
  const loadedLessons = Array.from(new Set(
    bankQuestions
      .filter(q => (filterStage === 'all' || q.stage === filterStage) && (filterGrade === 'all' || q.grade === filterGrade) && (filterSemester === 'all' || q.semester === filterSemester) && (filterSubject === 'all' || q.subject === filterSubject) && (filterUnit === 'all' || q.unit === filterUnit))
      .map(q => q.lesson)
  )).filter(Boolean).sort();

  // Simple filter statistics
  const statTotal = bankQuestions.length;

  return (
    <div className="space-y-8">
      {/* Read-Only Notice for non-admin users */}
      {!isAdmin && !hideReadOnlyNotice && (
        <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-start gap-3.5 text-emerald-850 text-xs font-bold leading-relaxed shadow-xs" dir="rtl">
          <Database className="w-5 h-5 text-emerald-600 animate-pulse shrink-0 mt-0.5" />
          <div>
            <span className="block font-black text-emerald-900 text-sm mb-1">تنبيه: وضع التصفح والربط فقط 🔒</span>
            <span>أنت تستعرض بنك الأسئلة الموحد في وضع القراءة المخصص للمعلمين. يمكنك البحث، الفرز، تصفح وربط الأسئلة باختباراتك في ثوانٍ من صفحة المعلم. تظل الصلاحيات الإدارية الكاملة لتعديل أو حذف أو استيراد أسئلة بالذكاء استحواذًا من مسؤول بنك الأسئلة (majedsoft@gmail.com).</span>
          </div>
        </div>
      )}
      
      {/* Dynamic Action Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">بنك الأسئلة الذكي والمصنف</h3>
            <p className="text-xs text-slate-400 font-medium">قاعدة أسئلة متكاملة للتحضير وإعادة استخدام الأسئلة حسب المرحلة والصف والمادة والأهداف الدراسية.</p>
          </div>
        </div>
        
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowPdfModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-100 transition duration-150 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-emerald-250 animate-pulse" />
              <span>إنشاء أسئلة من مستند (PDF / Word / Excel)</span>
            </button>

            <button
              onClick={() => setShowExcelModal(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-850 hover:bg-slate-900 text-white font-bold text-xs shadow-md shadow-slate-150 transition duration-150 cursor-pointer"
            >
              <Upload className="w-4 h-4 text-slate-300" />
              <span>استيراد سريع بالنسخ واللصق من Excel</span>
            </button>

            <button
              onClick={() => {
                if (showAddForm) {
                  handleResetForm();
                } else {
                  setShowAddForm(true);
                }
              }}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs transition duration-150 cursor-pointer ${
                showAddForm
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-150'
              }`}
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{showAddForm ? 'إلغاء وإغلاق المنشئ' : 'إضافة سؤال جديد للبنك'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Expandable Creation Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden bg-white border border-slate-200/90 shadow-xs rounded-3xl"
          >
            <form onSubmit={handleSaveQuestion} className="p-6 md:p-8 space-y-6">
              <h4 className="text-sm font-extrabold text-indigo-700 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Database className="w-4 h-4" />
                <span>{editingQuestionId ? 'تعديل بيانات سؤال البنك' : 'صياغة وإدراج سؤال جديد في البنك'}</span>
              </h4>

              {/* 1. Categorization Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block">المرحلة الدراسية</label>
                  <select
                    value={formStage}
                    onChange={(e) => handleFormStageChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {STAGE_PRESETS.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block">الصف الدراسي</label>
                  <select
                    value={formGrade}
                    onChange={(e) => {
                      const selectedGrade = e.target.value;
                      setFormGrade(selectedGrade);
                      const validSubjects = GRADE_SUBJECT_PRESETS[selectedGrade] || [];
                      if (validSubjects.length > 0) {
                        setFormSubject(validSubjects[0]);
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {GRADE_PRESETS[formStage]?.map(gr => (
                      <option key={gr} value={gr}>{gr}</option>
                    )) || <option value={formGrade}>{formGrade}</option>}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block">الفصل الدراسي</label>
                  <select
                    value={formSemester}
                    onChange={(e) => setFormSemester(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {SEMESTER_PRESETS.map(sm => (
                      <option key={sm} value={sm}>{sm}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block">المادة العلمية</label>
                  <div className="flex gap-2">
                    <select
                      value={(GRADE_SUBJECT_PRESETS[formGrade] || STAGE_SUBJECT_PRESETS[formStage] || SUBJECT_PRESETS).includes(formSubject) ? formSubject : 'custom'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== 'custom') setFormSubject(val);
                      }}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {(GRADE_SUBJECT_PRESETS[formGrade] || STAGE_SUBJECT_PRESETS[formStage] || SUBJECT_PRESETS).map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                      <option value="custom">أخرى / كتابة يدوية...</option>
                    </select>
                    {(!(GRADE_SUBJECT_PRESETS[formGrade] || STAGE_SUBJECT_PRESETS[formStage] || SUBJECT_PRESETS).includes(formSubject) || formSubject === '') && (
                      <input
                        type="text"
                        placeholder="اكتب اسم المادة..."
                        value={formSubject}
                        onChange={(e) => setFormSubject(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block">الوحدة الدراسية</label>
                  <input
                    type="text"
                    placeholder="مثل: الوحدة الأولى: علم الحاسوب ورؤية البيانات"
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block">الدرس</label>
                  <input
                    type="text"
                    placeholder="مثل: الدرس الأول: البيانات والمعلومات"
                    value={formLesson}
                    onChange={(e) => setFormLesson(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* 2. Question Text */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 block">نص السؤال</label>
                <textarea
                  rows={3}
                  placeholder="اكتب السؤال بوضوح وصيغة جذابة للطلاب هنا..."
                  value={formText}
                  onChange={(e) => setFormText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 3. Question Form Types */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-3 block">شكل ونوع السؤال</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleTypeChange('multiple_choice')}
                      className={`px-4 py-3.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                        formType === 'multiple_choice'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50/50'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>اختيار من متعدد</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTypeChange('true_false')}
                      className={`px-4 py-3.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                        formType === 'true_false'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50/50'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>صواب أو خطأ</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 mb-3 block">النقاط / الدرجة المستحقة</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formPoints}
                    onChange={(e) => setFormPoints(Number(e.target.value))}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans w-full"
                  />
                </div>
              </div>

              {/* 4. Options and Answers Block */}
              <div className="bg-slate-50/60 p-6 rounded-2xl border border-slate-200/60 space-y-4">
                <label className="text-xs font-extrabold text-slate-700 block mb-2">الإجابة الصحيحة وخيارات الحل</label>
                
                {formType === 'multiple_choice' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formOptions.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setFormCorrectAnswer(String(idx))}
                          className={`w-6 h-6 rounded-full flex items-center justify-center border font-bold text-xs transition shrink-0 cursor-pointer ${
                            formCorrectAnswer === String(idx)
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'border-slate-300 text-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          {formCorrectAnswer === String(idx) ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                        </button>
                        <input
                          type="text"
                          placeholder={`اكتب الخيار ${idx + 1} هنا...`}
                          value={opt}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          className="flex-1 bg-transparent text-xs border-none outline-none font-sans"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <button
                      type="button"
                      onClick={() => setFormCorrectAnswer('true')}
                      className={`p-4 rounded-xl border font-bold text-xs flex flex-col items-center gap-2 transition cursor-pointer ${
                        formCorrectAnswer === 'true'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 animate-pulse" />
                      <span>صحيح</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setFormCorrectAnswer('false')}
                      className={`p-4 rounded-xl border font-bold text-xs flex flex-col items-center gap-2 transition cursor-pointer ${
                        formCorrectAnswer === 'false'
                          ? 'bg-rose-50 border-rose-200 text-rose-700'
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      <XCircle className="w-6 h-6 text-rose-500 animate-pulse" />
                      <span>خطأ</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء التغييرات
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-100 cursor-pointer"
                >
                  {editingQuestionId ? 'تحديث وتطبيق النقاط' : 'أودع في بنك الأسئلة'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Database Filter Bar */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h4 className="text-sm font-extrabold text-slate-700">تصفح وفلترة بنك الأسئلة</h4>
            <p className="text-xs text-slate-400">اختر المرحلة أو المادة أو استخدم البحث في كشاف الأسئلة المتوفرة للعثور بسرعة على سؤالك.</p>
          </div>
          
          {/* Main search text filter */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث بالنص، الوحدة أو الدرس..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-9 py-2.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* 6 Classifications filter dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">المرحلة الدراسية</label>
            <select
              value={filterStage}
              onChange={(e) => {
                setFilterStage(e.target.value);
                setFilterGrade('all'); // reset sub filter
                setFilterSubject('all');
                setFilterSemester('all');
                setFilterUnit('all');
                setFilterLesson('all');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">الكل ({loadedStages.length})</option>
              {loadedStages.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">الصف</label>
            <select
              value={filterGrade}
              onChange={(e) => {
                setFilterGrade(e.target.value);
                setFilterSubject('all');
                setFilterSemester('all');
                setFilterUnit('all');
                setFilterLesson('all');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">الكل ({loadedGrades.length})</option>
              {loadedGrades.map(gr => (
                <option key={gr} value={gr}>{gr}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">الفصل الدراسي</label>
            <select
              value={filterSemester}
              onChange={(e) => {
                setFilterSemester(e.target.value);
                setFilterSubject('all');
                setFilterUnit('all');
                setFilterLesson('all');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">الكل ({loadedSemesters.length})</option>
              {loadedSemesters.map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">المادة</label>
            <select
              value={filterSubject}
              onChange={(e) => {
                setFilterSubject(e.target.value);
                setFilterUnit('all');
                setFilterLesson('all');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">الكل ({loadedSubjects.length})</option>
              {loadedSubjects.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">الوحدة</label>
            <select
              value={filterUnit}
              onChange={(e) => {
                setFilterUnit(e.target.value);
                setFilterLesson('all');
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">الكل ({loadedUnits.length})</option>
              {loadedUnits.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 mb-1.5 block">الدرس</label>
            <select
              value={filterLesson}
              onChange={(e) => setFilterLesson(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">الكل ({loadedLessons.length})</option>
              {loadedLessons.map(lesson => (
                <option key={lesson} value={lesson}>{lesson}</option>
              ))}
            </select>
          </div>
        </div>



        {/* Dynamic Filter Statistics */}
        <div className="border-t border-slate-100 pt-4 mt-2 select-none">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-500 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-indigo-500" />
              إحصائيات الفلترة والتصفية والفرز الحالية:
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 font-bold text-slate-650 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                <span>إجمالي الأسئلة في البنك:</span>
                <span className="font-sans font-extrabold text-slate-900">{statTotal}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 font-bold text-indigo-700 bg-indigo-50/50 border border-indigo-100 px-3 py-1.5 rounded-xl">
                <span>عدد الأسئلة بعد الفلترة:</span>
                <span className="font-sans font-extrabold text-indigo-800">{filteredBank.length}</span>
              </span>

              {isAdmin && getDuplicatesInfo().length > 0 && (
                <button
                  type="button"
                  onClick={handleCleanDuplicates}
                  className="inline-flex items-center gap-1.5 font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-3xs"
                  title="اضغط لتنظيف بنك الأسئلة من التكرار"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  <span>تكرار مكتشف: {getDuplicatesInfo().length} (حذف المكرر)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Loaded Questions Cards */}
      <div className="space-y-4">
        {isAdmin && filteredBank.length > 0 && (
          <div className="space-y-3">
            <div className="bg-slate-50/70 border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-3xs select-none">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <input
                  type="checkbox"
                  id="selectAllBqChecked"
                  className="w-4.5 h-4.5 text-indigo-650 border-slate-350 rounded focus:ring-indigo-500 cursor-pointer accent-indigo-600"
                  checked={filteredBank.every(q => selectedBqIds[q.id])}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    const updated = { ...selectedBqIds };
                    filteredBank.forEach(q => {
                      updated[q.id] = checked;
                    });
                    setSelectedBqIds(updated);
                  }}
                />
                <label htmlFor="selectAllBqChecked" className="text-xs font-extrabold text-slate-700 cursor-pointer">
                  تحديد جميع الأسئلة المعروضة حالياً ({filteredBank.length} سؤال)
                </label>
              </div>

              {Object.keys(selectedBqIds).filter(id => selectedBqIds[id]).length > 0 && (
                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                  <span className="text-xs font-black text-indigo-700 bg-white border border-indigo-200/40 px-3 py-1 rounded-xl">
                    تم تحديد {Object.keys(selectedBqIds).filter(id => selectedBqIds[id]).length} سؤال
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-toggle-move-selected"
                      onClick={() => setIsMovePanelOpen(!isMovePanelOpen)}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-3xs ${
                        isMovePanelOpen
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-600'
                          : 'bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700'
                      }`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>نقل الأسئلة المحددة</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-250 text-rose-700 font-extrabold text-xs transition cursor-pointer shadow-3xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف الأسئلة المحددة</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Expandable Move Category/Classification Section */}
            <AnimatePresence>
              {isMovePanelOpen && Object.keys(selectedBqIds).filter(id => selectedBqIds[id]).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-indigo-50/30 border border-indigo-100 rounded-2xl p-5 shadow-3xs overflow-hidden"
                  dir="rtl"
                >
                  <h5 className="text-xs font-black text-indigo-800 mb-4 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-indigo-650" />
                    <span>تحديد التصنيف الجديد لنقل الأسئلة المحددة إليه</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-2 block">المرحلة الدراسية</label>
                      <select
                        value={moveStage}
                        onChange={(e) => handleMoveStageChange(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {STAGE_PRESETS.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-2 block">الصف الدراسي</label>
                      <select
                        value={moveGrade}
                        onChange={(e) => {
                          const selectedGrade = e.target.value;
                          setMoveGrade(selectedGrade);
                          const validSubjects = GRADE_SUBJECT_PRESETS[selectedGrade] || [];
                          if (validSubjects.length > 0) {
                            setMoveSubject(validSubjects[0]);
                          }
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {GRADE_PRESETS[moveStage]?.map(gr => (
                          <option key={gr} value={gr}>{gr}</option>
                        )) || <option value={moveGrade}>{moveGrade}</option>}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-2 block">الفصل الدراسي</label>
                      <select
                        value={moveSemester}
                        onChange={(e) => setMoveSemester(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {SEMESTER_PRESETS.map(sm => (
                          <option key={sm} value={sm}>{sm}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-2 block">المادة العلمية</label>
                      <div className="flex gap-2">
                        <select
                          value={(GRADE_SUBJECT_PRESETS[moveGrade] || STAGE_SUBJECT_PRESETS[moveStage] || SUBJECT_PRESETS).includes(moveSubject) ? moveSubject : 'custom'}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val !== 'custom') setMoveSubject(val);
                          }}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {(GRADE_SUBJECT_PRESETS[moveGrade] || STAGE_SUBJECT_PRESETS[moveStage] || SUBJECT_PRESETS).map(sub => (
                            <option key={sub} value={sub}>{sub}</option>
                          ))}
                          <option value="custom">أخرى / كتابة يدوية...</option>
                        </select>
                        {(!(GRADE_SUBJECT_PRESETS[moveGrade] || STAGE_SUBJECT_PRESETS[moveStage] || SUBJECT_PRESETS).includes(moveSubject) || moveSubject === '') && (
                          <input
                            type="text"
                            placeholder="اكتب اسم المادة..."
                            value={moveSubject}
                            onChange={(e) => setMoveSubject(e.target.value)}
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-2 block">الوحدة الدراسية</label>
                      <input
                        type="text"
                        placeholder="مثل: الوحدة الأولى: علم الحاسوب ورؤية البيانات"
                        value={moveUnit}
                        onChange={(e) => setMoveUnit(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-sans text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-2 block">الدرس</label>
                      <input
                        type="text"
                        placeholder="مثل: الدرس الأول: مقدمة في التعلم الآلي"
                        value={moveLesson}
                        onChange={(e) => setMoveLesson(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-sans text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-indigo-100/60">
                    <button
                      type="button"
                      onClick={() => setIsMovePanelOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-extrabold text-slate-500 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      id="btn-confirm-move-selected"
                      onClick={handleMoveSelected}
                      className="inline-flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition cursor-pointer shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>تأكيد نقل الأسئلة المحددة ({Object.keys(selectedBqIds).filter(id => selectedBqIds[id]).length} سؤال)</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {filteredBank.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center">
            <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h5 className="text-sm font-bold text-slate-500">بنك الأسئلة خالٍ بحدود هذه التصفية</h5>
            <p className="text-xs text-slate-400 pt-1">لم نجد أي أسئلة تطابق قيود الفلترة المختارة، جرب تعديل قيم البحث أو أضف سؤالاً جديداً ومصنفاً.</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[950px] overflow-y-auto pl-2 pr-1.5 custom-scrollbar" style={{ scrollbarWidth: 'thin' }}>
            {filteredBank.map((q) => (
              <div 
                key={q.id}
                className={`bg-white border transition-all rounded-2xl p-6 ${
                  selectedBqIds[q.id] 
                    ? 'border-indigo-400 bg-indigo-50/5 ring-1 ring-indigo-50/40 shadow-xs' 
                    : 'border-slate-200/80 shadow-xs hover:shadow-md hover:border-slate-350'
                }`}
              >
                {/* Question Classifications Badger Row */}
                <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-indigo-650 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer ml-1.5 accent-indigo-600"
                      checked={!!selectedBqIds[q.id]}
                      onChange={(e) => {
                        setSelectedBqIds({
                          ...selectedBqIds,
                          [q.id]: e.target.checked
                        });
                      }}
                    />
                  )}
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold">
                    {q.stage}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold">
                    {q.grade}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-100 text-orange-700 text-[10px] font-bold">
                    {q.semester}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold">
                    {q.subject}
                  </span>
                  {q.unit && (
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 text-[10px] font-sans font-semibold">
                      {q.unit}
                    </span>
                  )}
                  {q.lesson && (
                    <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-600 text-[10px] font-sans font-semibold">
                      {q.lesson}
                    </span>
                  )}
                  <div className="mr-auto flex items-center gap-1.5 bg-indigo-50/55 border border-indigo-100 rounded-xl px-2.5 py-0.5 select-none" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] text-indigo-700 font-extrabold font-sans">الدرجة:</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      disabled={!isAdmin}
                      value={q.points || 1}
                      onChange={async (e) => {
                        if (!isAdmin) return;
                        const newP = Number(e.target.value);
                        if (newP >= 1) {
                          try {
                            await setDoc(doc(db, 'question_bank', q.id), {
                              ...q,
                              points: newP
                            });
                            triggerToast('تم تعديل درجة السؤال في بنك الأسئلة بنجاح', 'success');
                          } catch (err: any) {
                            console.error('Failed inline update:', err);
                          }
                        }
                      }}
                      className={`w-11 bg-white border border-slate-200 text-center font-black text-xs text-indigo-650 focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded-lg py-0.5 font-sans ${!isAdmin ? 'opacity-70 pointer-events-none' : ''}`}
                    />
                    <span className="text-[10px] text-slate-500 font-bold">نقاط</span>
                  </div>
                </div>

                {/* Question Title Text */}
                <div className="space-y-4">
                  <h5 className="text-lg md:text-[18px] font-black text-slate-900 leading-relaxed font-sans">{q.text}</h5>
                  
                  {/* Options display stacked vertically with numbered indicators */}
                  <div className="flex flex-col gap-2.5 w-full">
                    {(() => {
                      const isTf = isTrueFalseQuestion(q);
                      const baseOpts = isTf
                        ? (Array.isArray(q.options) && q.options.length >= 2 && q.options[0] && q.options[1] && !q.options[0].includes('الخيار الثالث') ? [q.options[0], q.options[1]] : ['صحيح', 'خطأ'])
                        : (q.options || []);

                      return baseOpts
                        .map((opt, oIdx) => ({ opt, oIdx }))
                        .filter(item => {
                          if (!item.opt) return false;
                          const t = item.opt.trim();
                          if (isTf) {
                            return t !== '' && 
                              t !== 'الخيار الثالث' && 
                              t !== 'الخيار الرابع' && 
                              t !== 'الخيار الثالث...' && 
                              t !== 'الخيار الرابع...' &&
                              t !== 'option 3' &&
                              t !== 'option 4' &&
                              t !== 'option3' &&
                              t !== 'option4';
                          }
                          return t !== '';
                        })
                        .map(({ opt, oIdx }) => {
                          const isCorrect = !isTf 
                            ? String(oIdx) === String(q.correctAnswer)
                            : (oIdx === 0 && (q.correctAnswer === 'true' || q.correctAnswer === '0' || q.correctAnswer === 'صح' || q.correctAnswer === 'صحيح' || q.correctAnswer === 'صواب')) ||
                              (oIdx === 1 && (q.correctAnswer === 'false' || q.correctAnswer === '1' || q.correctAnswer === 'خطأ' || q.correctAnswer === 'خاطئ' || q.correctAnswer === 'خاطئة'));

                          return (
                          <div 
                            key={oIdx}
                            className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
                              isCorrect 
                                ? 'bg-emerald-50/70 border-emerald-500 text-emerald-800 font-extrabold shadow-3xs'
                                : 'bg-slate-50 border-slate-200/80 text-slate-600 hover:bg-slate-100/70'
                            }`}
                          >
                            <div className="flex items-center gap-3.5 overflow-hidden">
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm font-black shrink-0 ${
                                isCorrect 
                                  ? 'bg-emerald-200 text-emerald-900' 
                                  : 'bg-slate-200 text-slate-650'
                              }`}>
                                {oIdx + 1}
                              </span>
                              <span className="truncate text-slate-800 font-extrabold text-[15px]">{opt}</span>
                            </div>
                            {isCorrect && <Check className="w-5 h-5 text-emerald-600 shrink-0 mr-2" />}
                          </div>
                        );
                      })
                    })()}
                  </div>
                </div>

                {/* Action operations on bottom bar */}
                {isAdmin && (
                  <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100/70">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(q)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 font-bold text-[10px] border border-transparent transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>تعديل السؤال</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(q.id, q.text)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 font-bold text-[10px] border border-transparent transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف</span>
                    </button>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

      {/* SHADED MODAL: CREATE QUESTIONS FROM PDF */}
      <AnimatePresence>
        {showPdfModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-right font-sans"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-150 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">توليد الأسئلة الذكي من المستندات (PDF / Word / Excel)</h3>
                    <p className="text-xs text-slate-400 font-medium">قم بتحميل ملف PDF أو Word أو Excel وسيقوم الذكاء الاصطناعي بتحليله فوراً واستخراج أسئلة مصنفة منه.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleResetPdfModalStates();
                    setShowPdfModal(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {!isGenerating && generatedDrafts.length === 0 ? (
                  <div className="space-y-5">
                    {/* File Dropzone */}
                    <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-8 bg-slate-50/50 transition-all text-center flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Upload className="w-6 h-6 text-emerald-600 animate-bounce" />
                      </div>
                      
                      {pdfFile ? (
                        <div className="space-y-1.5">
                          <p className="text-sm font-extrabold text-emerald-700 flex items-center gap-1.5 justify-center">
                            <FileText className="w-4 h-4 text-emerald-650" />
                            <span>{pdfFile.name}</span>
                          </p>
                          <p className="text-[11px] text-slate-450 font-sans">
                            {(pdfFile.size / 1024 / 1024).toFixed(2)} ميغابايت • ملف جاهز للتحليل الذكي
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-slate-700">اسحب ملف (PDF، Word، Excel) هنا أو انقر لتحديد الملف</p>
                          <p className="text-xs text-slate-400 font-sans">تنسيق مستندات PDF (.pdf) أو Word (.docx, .doc) أو Excel (.xlsx, .xls) التي تحتوي على المادة العلمية</p>
                        </div>
                      )}

                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.xlsx,.xls"
                        onChange={handlePdfUpload}
                        className="hidden"
                        id="pdf-picker-input"
                      />
                      <label
                        htmlFor="pdf-picker-input"
                        className="mt-2 px-4.5 py-2 border border-slate-200 hover:border-slate-300 rounded-xl bg-white text-xs font-bold text-slate-650 cursor-pointer transition shadow-xs"
                      >
                        {pdfFile ? 'تغيير الملف المحدد' : 'تصفح ملفات جهازك'}
                      </label>
                    </div>

                    {/* Choice of MCQ and True/False questions counts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2 text-right">
                        <label className="text-xs font-black text-slate-700 block select-none">عدد أسئلة الاختيار من متعدد:</label>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            max={25}
                            value={mcqCount}
                            onChange={(e) => setMcqCount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="bg-transparent font-black text-slate-800 text-sm focus:outline-none flex-1 font-sans text-center"
                          />
                          <span className="text-xs font-bold text-slate-400">سؤال</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-right">
                        <label className="text-xs font-black text-slate-700 block select-none">عدد أسئلة الصواب والخطأ:</label>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            max={25}
                            value={tfCount}
                            onChange={(e) => setTfCount(Math.max(0, parseInt(e.target.value) || 0))}
                            className="bg-transparent font-black text-slate-800 text-sm focus:outline-none flex-1 font-sans text-center"
                          />
                          <span className="text-xs font-bold text-slate-400">سؤال</span>
                        </div>
                      </div>
                    </div>

                    {/* Classification Overrides Section */}
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-150">
                        <FolderOpen className="w-4 h-4 text-emerald-600" />
                        <div className="text-right">
                          <h4 className="text-xs font-extrabold text-slate-800">تصنيف الأسئلة المولدة</h4>
                          <p className="text-[10px] text-slate-400 font-medium">اختر تصنيفاً محدداً لوضع الأسئلة فيه تلقائياً، أو اتركها "تحديد تلقائي بالذكاء الاصطناعي" ليقوم النظام باستنتاجها من قراءة ملف الـ PDF.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                        {/* Stage Selector */}
                        <div className="space-y-1.5 text-right">
                          <label htmlFor="pdf-stage-select" className="text-[11px] font-bold text-slate-500 block">المرحلة الدراسية</label>
                          <select
                            id="pdf-stage-select"
                            value={pdfStageOverride}
                            onChange={(e) => {
                              const val = e.target.value;
                              setPdfStageOverride(val);
                              // Reset dependent fields if stage is auto
                              if (val === 'auto') {
                                setPdfGradeOverride('auto');
                                setPdfSubjectOverride('auto');
                              } else {
                                // Default to first available preset in that stage
                                if (GRADE_PRESETS[val]) {
                                  const firstGrade = GRADE_PRESETS[val][0];
                                  setPdfGradeOverride(firstGrade);
                                  if (GRADE_SUBJECT_PRESETS[firstGrade]) {
                                    setPdfSubjectOverride(GRADE_SUBJECT_PRESETS[firstGrade][0]);
                                  } else if (STAGE_SUBJECT_PRESETS[val]) {
                                    setPdfSubjectOverride(STAGE_SUBJECT_PRESETS[val][0]);
                                  }
                                } else {
                                  if (STAGE_SUBJECT_PRESETS[val]) {
                                    setPdfSubjectOverride(STAGE_SUBJECT_PRESETS[val][0]);
                                  }
                                }
                              }
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-650 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                          >
                            <option value="auto">🤖 تحديد تلقائي بالذكاء الاصطناعي</option>
                            {STAGE_PRESETS.map(st => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>

                        {/* Grade Selector */}
                        <div className="space-y-1.5 text-right">
                          <label htmlFor="pdf-grade-select" className="text-[11px] font-bold text-slate-500 block">الصف الدراسي</label>
                          <select
                            id="pdf-grade-select"
                            value={pdfGradeOverride}
                            disabled={pdfStageOverride === 'auto'}
                            onChange={(e) => {
                              const selectedGrade = e.target.value;
                              setPdfGradeOverride(selectedGrade);
                              if (selectedGrade !== 'auto') {
                                const validSubjects = GRADE_SUBJECT_PRESETS[selectedGrade] || [];
                                if (validSubjects.length > 0) {
                                  setPdfSubjectOverride(validSubjects[0]);
                                }
                              } else {
                                if (pdfStageOverride !== 'auto' && STAGE_SUBJECT_PRESETS[pdfStageOverride]) {
                                  setPdfSubjectOverride(STAGE_SUBJECT_PRESETS[pdfStageOverride][0]);
                                }
                              }
                            }}
                            className="w-full bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-650 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                          >
                            {pdfStageOverride === 'auto' ? (
                              <option value="auto">🤖 يحدد تلقائياً مع المرحلة</option>
                            ) : (
                              <>
                                <option value="auto">🤖 تحديد تلقائي للصف</option>
                                {(GRADE_PRESETS[pdfStageOverride] || []).map(gr => (
                                  <option key={gr} value={gr}>{gr}</option>
                                ))}
                              </>
                            )}
                          </select>
                        </div>

                        {/* Subject Selector */}
                        <div className="space-y-1.5 text-right">
                          <label htmlFor="pdf-subject-select" className="text-[11px] font-bold text-slate-500 block">المادة الدراسية</label>
                          <select
                            id="pdf-subject-select"
                            value={pdfSubjectOverride}
                            disabled={pdfStageOverride === 'auto'}
                            onChange={(e) => setPdfSubjectOverride(e.target.value)}
                            className="w-full bg-white disabled:bg-slate-100 disabled:text-slate-400 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-650 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                          >
                            {pdfStageOverride === 'auto' ? (
                              <option value="auto">🤖 تحدد تلقائياً مع المرحلة</option>
                            ) : (
                              <>
                                <option value="auto">🤖 تحديد تلقائي للمادة</option>
                                {(pdfGradeOverride !== 'auto' && GRADE_SUBJECT_PRESETS[pdfGradeOverride]
                                  ? GRADE_SUBJECT_PRESETS[pdfGradeOverride]
                                  : STAGE_SUBJECT_PRESETS[pdfStageOverride] || []
                                ).map(sub => (
                                  <option key={sub} value={sub}>{sub}</option>
                                ))}
                              </>
                            )}
                          </select>
                        </div>

                        {/* Semester Selector */}
                        <div className="space-y-1.5 text-right">
                          <label htmlFor="pdf-semester-select" className="text-[11px] font-bold text-slate-500 block">الفصل الدراسي</label>
                          <select
                            id="pdf-semester-select"
                            value={pdfSemesterOverride}
                            onChange={(e) => setPdfSemesterOverride(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-650 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                          >
                            <option value="auto">🤖 تحديد تلقائي بالذكاء الاصطناعي</option>
                            {SEMESTER_PRESETS.map(sem => (
                              <option key={sem} value={sem}>{sem}</option>
                            ))}
                          </select>
                        </div>

                        {/* Unit Selector */}
                        <div className="space-y-1.5 text-right">
                          <label htmlFor="pdf-unit-input" className="text-[11px] font-bold text-slate-500 block">الوحدة الدراسية</label>
                          <input
                            id="pdf-unit-input"
                            type="text"
                            placeholder="مثال: الوحدة الأولى (تحديد تلقائي إن تركت فارغة)"
                            value={pdfUnitOverride}
                            onChange={(e) => setPdfUnitOverride(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-650 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                          />
                        </div>

                        {/* Lesson Selector */}
                        <div className="space-y-1.5 text-right">
                          <label htmlFor="pdf-lesson-input" className="text-[11px] font-bold text-slate-500 block">الدرس</label>
                          <input
                            id="pdf-lesson-input"
                            type="text"
                            placeholder="مثال: الدرس الأول (تحديد تلقائي إن تركت فارغة)"
                            value={pdfLessonOverride}
                            onChange={(e) => setPdfLessonOverride(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-650 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Custom prompt options */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 flex items-center gap-1 justify-start">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>إرشادات وتوجيهات مخصصة (اختياري)</span>
                      </label>
                      <textarea
                        rows={3}
                        placeholder="مثال: نريد 5 أسئلة، ركز فقط على الوحدة الأولى من الكتاب، صغ 3 أسئلة اختيار من متعدد وسؤالين صواب وخطأ..."
                        value={pdfCustomPrompt}
                        onChange={(e) => setPdfCustomPrompt(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Generate button */}
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        disabled={isGenerating || !pdfBase64}
                        onClick={handleGenerateQuestionsFromPdf}
                        className={`w-full sm:w-auto px-10 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-sm shadow-md transition duration-150 flex items-center justify-center gap-2 ${
                          !pdfBase64 ? 'opacity-50 cursor-not-allowed' : 'hover:from-emerald-700 hover:to-teal-700 cursor-pointer shadow-emerald-100'
                        }`}
                      >
                        <Sparkles className="w-4.5 h-4.5 text-emerald-100" />
                        <span>بدء القراءة واستخراج الأسئلة</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Question drafts list review */}
                {!isGenerating && generatedDrafts.length > 0 ? (
                  <div className="space-y-4">
                    {/* Select helpers row */}
                    <div className="flex justify-between items-center text-xs text-slate-500 pb-2 border-b border-slate-100">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const next: Record<number, boolean> = {};
                            generatedDrafts.forEach((_, idx) => { next[idx] = true; });
                            setSelectedDraftIndexes(next);
                          }}
                          className="text-emerald-700 font-extrabold hover:underline cursor-pointer"
                        >
                          تحديد الكل
                        </button>
                        <span>|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDraftIndexes({})}
                          className="text-slate-500 font-extrabold hover:underline cursor-pointer"
                        >
                          إلغاء تحديد الكل
                        </button>
                      </div>
                      <span className="font-bold">
                        تم العثور على <span className="text-emerald-600 text-sm font-sans">{generatedDrafts.length}</span> أسئلة منسقة. اختر الأسئلة المراد إدراجها:
                      </span>
                    </div>

                    {/* Draft question Cards */}
                    <div className="space-y-3.5">
                      {generatedDrafts.map((draft, idx) => {
                        const isSelected = !!selectedDraftIndexes[idx];
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setSelectedDraftIndexes(prev => ({
                                ...prev,
                                [idx]: !prev[idx]
                              }));
                            }}
                            className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                              isSelected
                                ? 'bg-emerald-50/20 border-emerald-500 shadow-xs'
                                : 'bg-white border-slate-200/80 hover:border-slate-300'
                            }`}
                          >
                            {/* Checkbox */}
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition ${
                              isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-350 text-transparent bg-white'
                            }`}>
                              <Check className="w-3.5 h-3.5" />
                            </div>

                            {/* Details */}
                            <div className="flex-1 space-y-3 w-full">
                              {/* Metadata labels row */}
                              <div className="flex flex-wrap gap-1.5 items-center text-right">
                                {(pdfStageOverride !== 'auto' ? pdfStageOverride : draft.stage) && (
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] font-bold">
                                    {pdfStageOverride !== 'auto' ? pdfStageOverride : draft.stage}
                                  </span>
                                )}
                                {(pdfGradeOverride !== 'auto' ? pdfGradeOverride : draft.grade) && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-bold">
                                    {pdfGradeOverride !== 'auto' ? pdfGradeOverride : draft.grade}
                                  </span>
                                )}
                                {(pdfSubjectOverride !== 'auto' ? pdfSubjectOverride : draft.subject) && (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-bold">
                                    {pdfSubjectOverride !== 'auto' ? pdfSubjectOverride : draft.subject}
                                  </span>
                                )}
                                {(pdfSemesterOverride !== 'auto' ? pdfSemesterOverride : draft.semester) && (
                                  <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-100 text-orange-700 text-[9px] font-bold">
                                    {pdfSemesterOverride !== 'auto' ? pdfSemesterOverride : draft.semester}
                                  </span>
                                )}
                                {(pdfUnitOverride.trim() !== '' ? pdfUnitOverride : draft.unit) && (
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-50/50 text-indigo-600 text-[9px] font-sans font-semibold">
                                    {pdfUnitOverride.trim() !== '' ? pdfUnitOverride : draft.unit}
                                  </span>
                                )}
                                {(pdfLessonOverride.trim() !== '' ? pdfLessonOverride : draft.lesson) && (
                                  <span className="px-2 py-0.5 rounded-md bg-teal-50/50 text-teal-600 text-[9px] font-sans font-semibold">
                                    {pdfLessonOverride.trim() !== '' ? pdfLessonOverride : draft.lesson}
                                  </span>
                                )}
                                <span className="mr-auto text-[10px] font-bold text-slate-400 font-sans">{draft.points || 1} {(draft.points || 1) === 1 ? 'نقطة' : 'نقاط'}</span>
                              </div>

                              {/* Question TEXT */}
                              <p className="text-xs font-bold text-slate-800 leading-relaxed font-sans text-right">{draft.text}</p>

                              {/* Options */}
                              {Array.isArray(draft.options) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-right">
                                  {draft.options
                                    .map((optionText, oIdx) => ({ optionText, oIdx }))
                                    .filter(item => {
                                      if (!item.optionText) return false;
                                      const t = item.optionText.trim();
                                      return t !== '' && 
                                        t !== 'الخيار الثالث' && 
                                        t !== 'الخيار الرابع' && 
                                        t !== 'الخيار الثالث...' && 
                                        t !== 'الخيار الرابع...' &&
                                        t !== 'option 3' &&
                                        t !== 'option 4' &&
                                        t !== 'option3' &&
                                        t !== 'option4';
                                    })
                                    .map(({ optionText, oIdx }) => {
                                      const isCorrect = draft.type === 'true_false'
                                        ? (oIdx === 0 && draft.correctAnswer === 'true') || (oIdx === 1 && draft.correctAnswer === 'false')
                                        : String(oIdx) === draft.correctAnswer;
                                      return (
                                        <div
                                          key={oIdx}
                                          className={`p-2.5 rounded-xl text-xs font-sans border-r-4 flex items-center justify-between ${
                                            isCorrect
                                              ? 'bg-emerald-50/60 border-emerald-500 text-emerald-800 font-bold'
                                              : 'bg-slate-50 border-transparent text-slate-500'
                                          }`}
                                        >
                                          <span className="truncate">{optionText}</span>
                                          {isCorrect && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                        </div>
                                      );
                                    })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Progress display */}
                {isGenerating && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <div className="w-12 h-12 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin"></div>
                    <div className="text-center space-y-1.5">
                      <p className="text-sm font-bold text-slate-800">يقوم الذكاء الاصطناعي بقراءة واستخراج الأسئلة الأكاديمية</p>
                      <p className="text-xs text-slate-450 leading-relaxed font-sans">
                        نعمل على فحص محتوى وجداول ومواضيع ملف الـ PDF لإعداد وصياغة أسئلة دقيقة ومنسقة ومطابقة لمعايير الوزارة...
                      </p>
                    </div>
                  </div>
                )}

                {/* Exception/Error Display */}
                {pdfError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-800">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-right">
                      <p className="text-xs font-bold">فشل معالجة المستند:</p>
                      <p className="text-[11px] mt-0.5 leading-relaxed font-sans">{pdfError}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                {generatedDrafts.length > 0 ? (
                  <>
                    <span className="text-xs font-bold text-indigo-800 font-sans">
                      تم تحديد <span className="text-emerald-600 text-sm font-bold">{Object.values(selectedDraftIndexes).filter(Boolean).length}</span> أسئلة للحفظ.
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleResetPdfModalStates}
                        className="px-4.5 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-650 cursor-pointer transition"
                      >
                        إلغاء وتحميل ملف جديد
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSelectedDrafts}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 cursor-pointer transition font-sans"
                      >
                        حفظ الأسئلة المحددة ببنك الأسئلة
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] text-slate-400 font-medium">نظام التوليد يدعم ملفات PDF بكفاءة عالية بفضل نموذج Gemini 3.5.</span>
                    <button
                      type="button"
                      onClick={() => {
                        handleResetPdfModalStates();
                        setShowPdfModal(false);
                      }}
                      className="px-5 py-2 border border-slate-250 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition"
                    >
                      إغلاق نافذة التوليد
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SHADED MODAL: COPY PASTE FROM EXCEL */}
      <AnimatePresence>
        {showExcelModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-right font-sans"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-150 bg-gradient-to-r from-indigo-50/50 to-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">استيراد سريع بالنسخ واللصق من Excel</h3>
                    <p className="text-xs text-slate-400 font-medium">انسخ الخلايا مباشرة من ملف Excel الخاص بك والصقها هنا لإضافة مئات الأسئلة فوراً لبنك الأسئلة دون قيود حجم الملف.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowExcelModal(false);
                    setExcelPasteText('');
                    setExcelRows([]);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {isExcelImporting ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-bold text-slate-800">جاري استيراد وحفظ الأسئلة...</h4>
                      <p className="text-sm text-slate-500 font-sans">
                        تمت معالجة {excelImportProgress} سؤال من أصل {excelImportTotal} سؤال ({Math.round((excelImportProgress / excelImportTotal) * 100)}%)
                      </p>
                    </div>
                    <div className="w-full max-w-md bg-slate-100 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-indigo-600 h-2.5 rounded-full transition-all duration-150" 
                        style={{ width: `${(excelImportProgress / excelImportTotal) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-slate-400">يرجى عدم إغلاق هذه النافذة أو مغادرة الصفحة حتى تكتمل العملية.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Two-Column Setup: Settings Left, Paste Right */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Column 1: Classification Settings (Default values) */}
                      <div className="lg:col-span-1 bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>التصنيف الموحد للأسئلة المستوردة</span>
                        </h4>
                        <p className="text-[11px] text-slate-400">سيتم ربط جميع الأسئلة المستوردة بهذا التصنيف الدراسي تلقائياً، إلا إذا حددت أعمدة خاصة بالدرس أو الوحدة في جدول البيانات.</p>
                        
                        {/* Stage */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">المرحلة الدراسية</label>
                          <select
                            value={excelStage}
                            onChange={(e) => handleExcelStageChange(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-hidden focus:border-indigo-500"
                          >
                            {STAGE_PRESETS.map((stg) => (
                              <option key={stg} value={stg}>{stg}</option>
                            ))}
                          </select>
                        </div>

                        {/* Grade */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">الصف الدراسي</label>
                          <select
                            value={excelGrade}
                            onChange={(e) => {
                              setExcelGrade(e.target.value);
                              const subjects = GRADE_SUBJECT_PRESETS[e.target.value] || STAGE_SUBJECT_PRESETS[excelStage] || [];
                              if (subjects.length > 0) setExcelSubject(subjects[0]);
                            }}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-hidden focus:border-indigo-500"
                          >
                            {(GRADE_PRESETS[excelStage] || []).map((grd) => (
                              <option key={grd} value={grd}>{grd}</option>
                            ))}
                          </select>
                        </div>

                        {/* Subject */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">المادة الدراسية</label>
                          <select
                            value={excelSubject}
                            onChange={(e) => setExcelSubject(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-hidden focus:border-indigo-500"
                          >
                            {(GRADE_SUBJECT_PRESETS[excelGrade] || STAGE_SUBJECT_PRESETS[excelStage] || []).map((sub) => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                        </div>

                        {/* Semester */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-600 block">الفصل الدراسي</label>
                          <select
                            value={excelSemester}
                            onChange={(e) => setExcelSemester(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-hidden focus:border-indigo-500"
                          >
                            {SEMESTER_PRESETS.map((sem) => (
                              <option key={sem} value={sem}>{sem}</option>
                            ))}
                          </select>
                        </div>

                        {/* Unit & Lesson */}
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 block">الوحدة (اختياري)</label>
                            <input
                              type="text"
                              value={excelUnit}
                              onChange={(e) => setExcelUnit(e.target.value)}
                              placeholder="مثال: الوحدة الأولى"
                              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-hidden focus:border-indigo-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-600 block">الدرس (اختياري)</label>
                            <input
                              type="text"
                              value={excelLesson}
                              onChange={(e) => setExcelLesson(e.target.value)}
                              placeholder="مثال: الدرس الأول"
                              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-hidden focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Column 2 & 3: Paste area */}
                      <div className="lg:col-span-2 space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">الصق البيانات هنا</h4>
                          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={excelHasHeader}
                              onChange={(e) => setExcelHasHeader(e.target.checked)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                            />
                            <span>السطر الأول يحتوي على أسماء الأعمدة (رأس الجدول)</span>
                          </label>
                        </div>

                        <div className="relative">
                          <textarea
                            value={excelPasteText}
                            onChange={(e) => setExcelPasteText(e.target.value)}
                            rows={8}
                            placeholder="افتح ملف الـ Excel، حدد خلايا الأسئلة والخيارات والاجابات، انسخها (Ctrl+C) ثم الصقها هنا مباشرة (Ctrl+V)..."
                            className="w-full p-4 rounded-2xl border border-slate-250 bg-slate-50 text-xs font-mono text-slate-700 placeholder-slate-400 leading-relaxed outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-50 transition-all text-left"
                            style={{ direction: 'ltr' }}
                          />
                        </div>

                        <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-100 flex gap-2.5">
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="text-xs text-amber-800 leading-relaxed space-y-0.5">
                            <p className="font-bold">تنسيق ومعالجة الإجابات التلقائية:</p>
                            <p>تنبيه: سيقوم النظام تلقائياً بتعيين <strong>الخيار الأول دائماً كإجابة صحيحة</strong> لجميع الأسئلة المتعددة الخيارات تلبيةً لطلبك، ولن تحتاج لتخصيص عمود للإجابة الصحيحة. يرجى التأكد من أن خيارات الأسئلة منسقة بحيث تكون الإجابة الصحيحة هي الأولى دائماً في ملف الـ Excel الخاص بك قبل النسخ.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Columns mapping & preview (Only if we have parsed rows) */}
                    {excelRows.length > 0 && (
                      <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-200/60 pb-3">
                          <h4 className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                            <span>مطابقة أعمدة جدول البيانات والمعاينة الذكية</span>
                          </h4>
                          <span className="text-[11px] bg-indigo-50 font-bold text-indigo-700 px-2.5 py-1 rounded-full font-sans">
                            تم كشف {excelRows.length} صفاً من البيانات
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500">
                          يرجى اختيار الحقل المناسب لكل عمود من الأعمدة المكتشفة أدناه لربط البيانات بالبنك بشكل صحيح:
                        </p>

                        <div className="overflow-x-auto max-w-full rounded-xl border border-slate-200">
                          <table className="w-full text-xs text-slate-600 text-right min-w-[700px]">
                            <thead>
                              <tr className="bg-indigo-50/50 border-b border-slate-200">
                                {excelRows[0].map((_, idx) => (
                                  <th key={idx} className="p-3 text-center border-l border-slate-200">
                                    <div className="space-y-1.5 max-w-[150px] mx-auto">
                                      <span className="text-[10px] font-bold text-slate-400 block font-sans">
                                        العمود {idx + 1}
                                      </span>
                                      <select
                                        value={excelMappings[idx] || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setExcelMappings(prev => ({
                                            ...prev,
                                            [idx]: val
                                          }));
                                        }}
                                        className="w-full px-2 py-1 rounded border border-slate-200 bg-white text-[11px] text-slate-800 font-bold outline-hidden focus:border-indigo-500"
                                      >
                                        <option value="">-- تجاهل --</option>
                                        <option value="text">نص السؤال *</option>
                                        <option value="type">نوع السؤال</option>
                                        <option value="option1">الخيار الأول</option>
                                        <option value="option2">الخيار الثاني</option>
                                        <option value="option3">الخيار الثالث</option>
                                        <option value="option4">الخيار الرابع</option>
                                        <option value="points">الدرجة</option>
                                        <option value="unit">الوحدة</option>
                                        <option value="lesson">الدرس</option>
                                      </select>
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {excelRows.slice(0, 5).map((row, rowIdx) => (
                                <tr key={rowIdx} className="border-b border-slate-100 hover:bg-slate-100/50 transition">
                                  {row.map((cell, cellIdx) => (
                                    <td key={cellIdx} className="p-3 border-l border-slate-100 truncate max-w-[150px] font-sans text-center">
                                      {rowIdx === 0 && excelHasHeader ? (
                                        <span className="font-bold text-indigo-650 bg-indigo-50/50 px-1.5 py-0.5 rounded text-[11px]">
                                          {cell || 'فارغ'}
                                        </span>
                                      ) : (
                                        cell || <span className="text-slate-300 italic">فارغ</span>
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                              {excelRows.length > 5 && (
                                <tr className="bg-white">
                                  <td colSpan={excelRows[0].length} className="p-2 text-center text-[10px] text-slate-400 italic">
                                    تم إخفاء {excelRows.length - 5} صفاً متبقياً لسهولة استعراض الصفحة...
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-slate-150 bg-slate-50 flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-semibold font-sans">
                  جميع الأسئلة يتم تخزينها وتحديثها محلياً وبشكل آمن في Firestore.
                </span>
                
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExcelModal(false);
                      setExcelPasteText('');
                      setExcelRows([]);
                    }}
                    className="px-5 py-2.5 border border-slate-250 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition"
                    disabled={isExcelImporting}
                  >
                    إلغاء وإغلاق
                  </button>

                  <button
                    type="button"
                    onClick={handleImportExcelData}
                    className={`px-6 py-2.5 rounded-xl text-white font-bold text-xs shadow-md cursor-pointer transition flex items-center gap-2 ${
                      isExcelImporting
                        ? 'bg-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-150'
                    }`}
                    disabled={isExcelImporting}
                  >
                    <Check className="w-4 h-4" />
                    <span>
                      {isExcelImporting 
                        ? 'جاري الاستيراد...' 
                        : `بدء استيراد الأسئلة (${excelRows.length > 0 ? (excelHasHeader ? Math.max(0, excelRows.length - 1) : excelRows.length) : 0})`}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SHADED MODAL: EXCEL IMPORT SUMMARY */}
      <AnimatePresence>
        {excelSummaryModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-55 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-right font-sans"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/40 to-indigo-50/40 flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800">نتيجة عملية الاستيراد</h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExcelSummaryModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-5">
                <div className="text-center pb-2">
                  <span className="text-4xl">📊</span>
                  <p className="text-sm text-slate-500 font-bold mt-2">لقد تم الانتهاء من معالجة صفوف Excel التي قمت بلصقها.</p>
                </div>

                <div className="space-y-3">
                  {/* Imported count */}
                  <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        ✓
                      </div>
                      <span className="text-xs font-black text-slate-700">الأسئلة الجديدة التي تم استيرادها وحفظها:</span>
                    </div>
                    <span className="text-lg font-black text-emerald-700 font-mono">{excelSummaryModal.savedCount}</span>
                  </div>

                  {/* Duplicates count */}
                  <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                        ⚠️
                      </div>
                      <span className="text-xs font-black text-slate-700">أسئلة مكررة وموجودة مسبقاً (تم تجاهلها):</span>
                    </div>
                    <span className="text-lg font-black text-amber-700 font-mono">{excelSummaryModal.duplicateCount}</span>
                  </div>
                </div>

                {excelSummaryModal.savedCount > 0 ? (
                  <p className="text-center text-xs text-slate-400 font-medium leading-relaxed">
                    💡 تم إدخال الأسئلة وتحديث بنك الأسئلة تلقائياً. يمكنك الآن تصفحها أو ربطها بالاختبارات فوراً.
                  </p>
                ) : (
                  <p className="text-center text-xs text-slate-400 font-medium leading-relaxed">
                    💡 لم يتم إدخال أي أسئلة جديدة لأن جميع الأسئلة الملصقة متطابقة بالكامل مع أسئلة مسجلة بالفعل في بنك الأسئلة لتجنب التكرار.
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setExcelSummaryModal(null)}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition shadow-md shadow-indigo-100 cursor-pointer"
                >
                  حسناً، فهمت
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* Moving Progress Modal Overlay */}
      <AnimatePresence>
        {isMoving && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6"
              dir="rtl"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 relative">
                  <FolderOpen className="w-8 h-8 text-indigo-600 animate-pulse" />
                  <div className="absolute inset-0 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
                </div>
                
                <h3 className="text-base font-black text-slate-900 mb-2">
                  جاري نقل الأسئلة المحددة...
                </h3>
                
                <p className="text-xs text-slate-500 mb-6 font-semibold">
                  يرجى الانتظار، يتم الآن نقل وتحديث تصنيفات الأسئلة في قاعدة البيانات.
                </p>

                {/* Progress Bar Container */}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-3 relative">
                  <motion.div 
                    className="bg-indigo-600 h-full rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: `${moveTotal > 0 ? (moveProgress / moveTotal) * 100 : 0}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>

                {/* Progress Details */}
                <div className="flex justify-between w-full text-xs font-bold text-slate-600">
                  <span>نسبة الإنجاز: {moveTotal > 0 ? Math.round((moveProgress / moveTotal) * 100) : 0}%</span>
                  <span>تم نقل {moveProgress} من أصل {moveTotal} سؤال</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
