import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Minus,
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
  FolderOpen,
  ChevronDown,
  ChevronUp,
  BookCheck,
  ListChecks,
  Loader2,
  CheckCheck,
  ArrowRight,
  ArrowLeft,
  Bookmark,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BankQuestion, QuestionType, BookStructure, TextbookUnit, TextbookLesson } from '../types';
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
  const [pdfStep, setPdfStep] = useState<'upload' | 'structure' | 'review'>('upload');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfMimeType, setPdfMimeType] = useState<string>('application/pdf');
  const [pdfBase64, setPdfBase64] = useState<string>('');
  const [pdfCustomPrompt, setPdfCustomPrompt] = useState('');
  const [mcqCount, setMcqCount] = useState<number>(5);
  const [tfCount, setTfCount] = useState<number>(2);
  const [isExtractingStructure, setIsExtractingStructure] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [bookStructure, setBookStructure] = useState<BookStructure | null>(null);
  const [selectedLessons, setSelectedLessons] = useState<Record<string, boolean>>({});
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
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

  // High-capacity generation progress and pagination states (supports 500+ questions)
  const [generationProgress, setGenerationProgress] = useState<{
    totalTarget: number;
    generatedSoFar: number;
    currentBatch: number;
    totalBatches: number;
    currentLessonName: string;
    isStopping: boolean;
  } | null>(null);
  const abortGenerationRef = useRef<boolean>(false);
  const [reviewSearchQuery, setReviewSearchQuery] = useState('');
  const [reviewCurrentPage, setReviewCurrentPage] = useState(1);
  const REVIEW_PAGE_SIZE = 40;

  const handleResetPdfModalStates = () => {
    setPdfStep('upload');
    setPdfFile(null);
    setPdfMimeType('application/pdf');
    setPdfBase64('');
    setPdfCustomPrompt('');
    setBookStructure(null);
    setSelectedLessons({});
    setExpandedUnits({});
    setIsExtractingStructure(false);
    setIsGenerating(false);
    setGenerationProgress(null);
    abortGenerationRef.current = false;
    setGeneratedDrafts([]);
    setSelectedDraftIndexes({});
    setPdfError(null);
    setPdfStageOverride('auto');
    setPdfGradeOverride('auto');
    setPdfSemesterOverride('auto');
    setPdfSubjectOverride('auto');
    setPdfUnitOverride('');
    setPdfLessonOverride('');
    setReviewSearchQuery('');
    setReviewCurrentPage(1);
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

  // True/False Rephrasing states
  const [isRephrasing, setIsRephrasing] = useState(false);
  const [rephraseProgress, setRephraseProgress] = useState(0);
  const [rephraseTotal, setRephraseTotal] = useState(0);



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

  const handleExtractBookStructure = async (base64Data: string, mime: string) => {
    if (!base64Data) return;
    setIsExtractingStructure(true);
    setPdfError(null);
    setPdfStep('structure');
    setBookStructure(null);
    setSelectedLessons({});
    setExpandedUnits({});

    try {
      const res = await fetch('/api/extract-book-structure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfBase64: base64Data,
          mimeType: mime,
        }),
      });

      if (!res.ok) {
        let errMsg = 'فشلت عملية تحليل هيكلية الكتاب.';
        try {
          const errData = await res.json();
          errMsg = errData.error || errMsg;
        } catch (e) {
          // ignore
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      if (data.success && data.structure) {
        const structure: BookStructure = data.structure;
        setBookStructure(structure);

        // Select all lessons by default
        const initialSelected: Record<string, boolean> = {};
        const initialExpanded: Record<string, boolean> = {};
        if (structure.units && structure.units.length > 0) {
          structure.units.forEach((unit) => {
            initialExpanded[unit.id] = true;
            unit.lessons?.forEach((lesson) => {
              initialSelected[lesson.lessonTitle] = true;
            });
          });
        }
        setSelectedLessons(initialSelected);
        setExpandedUnits(initialExpanded);

        // Pre-fill stage, grade, semester, subject if detected
        if (structure.stage && STAGE_PRESETS.includes(structure.stage)) {
          setPdfStageOverride(structure.stage);
          if (structure.grade) {
            setPdfGradeOverride(structure.grade);
          }
          if (structure.subject) {
            setPdfSubjectOverride(structure.subject);
          }
        }
        if (structure.semester && SEMESTER_PRESETS.includes(structure.semester)) {
          setPdfSemesterOverride(structure.semester);
        }

        triggerToast('تم فحص الكتاب واستخراج الوحدات والدروس بنجاح!', 'success');
      } else {
        throw new Error('لم يتم العثور على هيكلية واضحة للمستند.');
      }
    } catch (err: any) {
      console.error('Error extracting structure:', err);
      setPdfError(err.message || 'حدث خطأ أثناء قراءة فهرس ووحدات الكتاب.');
      triggerToast('حدث خطأ أثناء استخراج الوحدات والدروس', 'error');
    } finally {
      setIsExtractingStructure(false);
    }
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
    const mimeToUse = detectedMime || 'application/pdf';
    setPdfMimeType(mimeToUse);
    setPdfError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result?.toString().split(',')[1] || '';
      setPdfBase64(base64String);
      // Automatically begin extracting units & lessons structure
      handleExtractBookStructure(base64String, mimeToUse);
    };
    reader.onerror = () => {
      setPdfError('فشل في قراءة محتوى الملف وتحويله.');
    };
    reader.readAsDataURL(file);
  };

  const handleToggleLesson = (lessonTitle: string) => {
    setSelectedLessons(prev => ({
      ...prev,
      [lessonTitle]: !prev[lessonTitle]
    }));
  };

  const handleToggleUnitAllLessons = (unit: TextbookUnit) => {
    if (!unit.lessons || unit.lessons.length === 0) return;
    const allSelected = unit.lessons.every(l => !!selectedLessons[l.lessonTitle]);
    setSelectedLessons(prev => {
      const next = { ...prev };
      unit.lessons.forEach(l => {
        next[l.lessonTitle] = !allSelected;
      });
      return next;
    });
  };

  const handleSelectAllLessons = () => {
    if (!bookStructure?.units) return;
    const next: Record<string, boolean> = {};
    bookStructure.units.forEach(u => {
      u.lessons?.forEach(l => {
        next[l.lessonTitle] = true;
      });
    });
    setSelectedLessons(next);
  };

  const handleDeselectAllLessons = () => {
    setSelectedLessons({});
  };

  const handleToggleUnitExpanded = (unitId: string) => {
    setExpandedUnits(prev => ({
      ...prev,
      [unitId]: !prev[unitId]
    }));
  };

  const handleStopPdfGeneration = () => {
    abortGenerationRef.current = true;
    if (generationProgress) {
      setGenerationProgress(prev => prev ? { ...prev, isStopping: true } : null);
    }
  };

  const handleGenerateQuestionsFromPdf = async () => {
    if (!pdfBase64) {
      triggerToast('يرجى تحميل ملف للمتابعة', 'error');
      return;
    }

    const activeLessons = Object.keys(selectedLessons).filter(k => selectedLessons[k]);
    if (bookStructure?.units && bookStructure.units.length > 0 && activeLessons.length === 0) {
      triggerToast('يرجى تحديد درس واحد على الأقل لإنشاء الأسئلة منه.', 'error');
      return;
    }

    // Determine target units and detailed lessons with their parent units
    const lessonsDetail: { unitTitle: string; lessonTitle: string }[] = [];
    const targetUnitsSet = new Set<string>();
    if (bookStructure?.units && bookStructure.units.length > 0) {
      bookStructure.units.forEach(u => {
        u.lessons?.forEach(l => {
          if (selectedLessons[l.lessonTitle]) {
            lessonsDetail.push({
              unitTitle: u.unitTitle,
              lessonTitle: l.lessonTitle
            });
            targetUnitsSet.add(u.unitTitle);
          }
        });
      });
    }
    const targetUnits = Array.from(targetUnitsSet);

    // Calculate total expected questions and batch chunks
    const questionsPerLesson = mcqCount + tfCount;
    const isSingleDoc = lessonsDetail.length === 0;
    const totalExpected = isSingleDoc 
      ? questionsPerLesson 
      : lessonsDetail.length * questionsPerLesson;

    // Determine optimal chunk size: 1-2 lessons per API call to guarantee ultra fast responses ~3-7s per call
    let chunkSize = 2;
    if (questionsPerLesson >= 15) {
      chunkSize = 1;
    } else if (questionsPerLesson <= 5) {
      chunkSize = 3;
    }

    const chunks: { unitTitle: string; lessonTitle: string }[][] = [];
    if (isSingleDoc) {
      chunks.push([]);
    } else {
      for (let i = 0; i < lessonsDetail.length; i += chunkSize) {
        chunks.push(lessonsDetail.slice(i, i + chunkSize));
      }
    }

    setIsGenerating(true);
    setPdfError(null);
    setGeneratedDrafts([]);
    setSelectedDraftIndexes({});
    setReviewCurrentPage(1);
    setReviewSearchQuery('');
    abortGenerationRef.current = false;

    const accumulatedQuestions: any[] = [];
    let lastEncounteredError: string | null = null;

    setGenerationProgress({
      totalTarget: totalExpected,
      generatedSoFar: 0,
      currentBatch: 1,
      totalBatches: chunks.length,
      currentLessonName: isSingleDoc ? 'كامل محتوى المستند' : (chunks[0]?.[0]?.lessonTitle || ''),
      isStopping: false
    });

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      if (abortGenerationRef.current) {
        console.log("Generation aborted by user. Showing collected drafts so far.");
        break;
      }

      const currentChunk = chunks[cIdx];
      const currentChunkLessonNames = isSingleDoc 
        ? 'كامل محتوى المستند' 
        : currentChunk.map(c => c.lessonTitle).join('، ');

      setGenerationProgress({
        totalTarget: totalExpected,
        generatedSoFar: accumulatedQuestions.length,
        currentBatch: cIdx + 1,
        totalBatches: chunks.length,
        currentLessonName: currentChunkLessonNames,
        isStopping: false
      });

      // Resilient retry loop for this specific chunk (up to 3 tries)
      let chunkSuccess = false;
      let chunkErrorMsg = '';

      for (let attempt = 0; attempt < 3; attempt++) {
        if (abortGenerationRef.current) break;
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
              lessonOverride: pdfLessonOverride,
              selectedLessons: isSingleDoc ? [] : currentChunk.map(c => c.lessonTitle),
              selectedUnits: targetUnits,
              lessonsDetail: isSingleDoc ? undefined : currentChunk
            }),
          });

          const responseText = await res.text();
          let data: any = null;
          try {
            data = JSON.parse(responseText);
          } catch (parseErr) {
            if (res.status === 413) {
              throw new Error("حجم الملف المرفق كبير جداً، يرجى اختيار ملف أصغر من 15 ميجابايت.");
            }
            throw new Error("استجابة غير مكتملة للدفعة الحالية من الخادم.");
          }

          if (!res.ok || !data?.success) {
            throw new Error(data?.error || `فشل في توليد دفعة الأسئلة (رمز: ${res.status}).`);
          }

          if (Array.isArray(data.questions) && data.questions.length > 0) {
            accumulatedQuestions.push(...data.questions);
            chunkSuccess = true;
            break;
          } else {
            throw new Error('لم يتم إرجاع أسئلة لهذه الدفعة.');
          }
        } catch (attemptErr: any) {
          chunkErrorMsg = attemptErr.message || 'حدث خطأ في معالجة الدفعة.';
          console.warn(`[Generation Chunk ${cIdx + 1} Attempt ${attempt + 1}] encounter:`, chunkErrorMsg);
          if (attempt < 2 && !abortGenerationRef.current) {
            const isQuotaOrBusy = chunkErrorMsg.includes("الحد الأقصى") || 
                                  chunkErrorMsg.includes("429") || 
                                  chunkErrorMsg.includes("ضغط") || 
                                  chunkErrorMsg.includes("503");
            const waitTime = isQuotaOrBusy ? 3500 * (attempt + 1) : 2000 * (attempt + 1);
            await new Promise(r => setTimeout(r, waitTime));
          }
        }
      }

      if (!chunkSuccess && !abortGenerationRef.current) {
        lastEncounteredError = chunkErrorMsg;
        console.error(`Chunk ${cIdx + 1} failed completely after retries:`, chunkErrorMsg);
      }

      // Delay between chunks to respect RPM quotas
      if (cIdx < chunks.length - 1 && !abortGenerationRef.current) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    setIsGenerating(false);
    setGenerationProgress(null);

    if (accumulatedQuestions.length > 0) {
      setGeneratedDrafts(accumulatedQuestions);
      const initialSelected: Record<number, boolean> = {};
      accumulatedQuestions.forEach((_, idx) => {
        initialSelected[idx] = true;
      });
      setSelectedDraftIndexes(initialSelected);
      setPdfStep('review');
      
      if (accumulatedQuestions.length >= totalExpected * 0.85) {
        triggerToast(`🎉 تم بنجاح توليد واستخراج ${accumulatedQuestions.length} سؤالاً بدقة عالية! راجع الأسئلة لحفظها.`, 'success');
      } else {
        triggerToast(`تم استخراج ${accumulatedQuestions.length} سؤالاً بنجاح! راجع الأسئلة لحفظها ببنك الأسئلة.`, 'success');
      }
    } else {
      setPdfError(lastEncounteredError || 'تعذر استخراج الأسئلة من المستند. يرجى تجربة اختيار دروس أخرى أو التحقق من جودة الملف.');
      triggerToast('حدث خطأ أثناء معالجة المستند', 'error');
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
      setIsGenerating(true);
      let savedCount = 0;
      let skippedDuplicates = 0;
      const questionsToBatch: BankQuestion[] = [];

      // Fast O(1) duplicate lookup map
      const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');
      const existingKeys = new Set(
        bankQuestions.map(q => {
          const opts = (q.options || []).map(o => norm(o)).sort().join('|');
          return `${norm(q.text)}::${q.type}::${q.subject}::${q.grade}::${opts}`;
        })
      );

      for (let i = 0; i < draftsToSave.length; i++) {
        const draft = draftsToSave[i];
        
        // Apply classification overrides if selected
        const draftStage = pdfStageOverride !== 'auto' ? pdfStageOverride : (draft.stage || 'المرحلة الثانوية');
        const draftGrade = pdfGradeOverride !== 'auto' ? pdfGradeOverride : (draft.grade || 'السنة الأولى المشتركة (أول ثانوي)');
        const draftSemester = pdfSemesterOverride !== 'auto' ? pdfSemesterOverride : (draft.semester || 'الفصل الدراسي الأول');
        const draftSubject = pdfSubjectOverride !== 'auto' ? pdfSubjectOverride : (draft.subject || 'التقنية الرقمية');
        const draftUnit = ((draft.unit && draft.unit.trim() !== '') ? draft.unit.trim() : (pdfUnitOverride.trim() !== '' ? pdfUnitOverride.trim() : 'الوحدة الأولى')).trim();
        const draftLesson = ((draft.lesson && draft.lesson.trim() !== '') ? draft.lesson.trim() : (pdfLessonOverride.trim() !== '' ? pdfLessonOverride.trim() : 'الدرس الأول')).trim();

        const draftText = draft.text || 'سؤال مستخرج';
        const draftType = draft.type === 'true_false' ? 'true_false' : 'multiple_choice';
        let rawDraftOpts = Array.isArray(draft.options) ? draft.options.map(o => String(o).trim()) : [];
        let finalDraftOpts: string[] = [];
        let finalCorrectAnswer = '0';

        if (draftType === 'true_false') {
          finalDraftOpts = ['صحيح', 'خطأ'];
          const rawCorrect = String(draft.correctAnswer ?? '').toLowerCase().trim();
          if (rawCorrect === 'false' || rawCorrect === '1' || rawCorrect === 'خطأ' || rawCorrect === 'خطا') {
            finalCorrectAnswer = 'false';
          } else {
            finalCorrectAnswer = 'true';
          }
        } else {
          // Ensure correct option is strictly at index 0
          const rawCorrect = String(draft.correctAnswer ?? '0').trim();
          let correctOpt = '';

          if (/^[0-3]$/.test(rawCorrect)) {
            const idx = parseInt(rawCorrect, 10);
            if (idx >= 0 && idx < rawDraftOpts.length) {
              correctOpt = rawDraftOpts[idx];
            }
          } else {
            const matchIdx = rawDraftOpts.findIndex(o => o.toLowerCase() === rawCorrect.toLowerCase());
            if (matchIdx !== -1) {
              correctOpt = rawDraftOpts[matchIdx];
            }
          }

          if (!correctOpt) {
            correctOpt = rawDraftOpts[0] || 'الخيار الصحيح';
          }

          const otherOpts = rawDraftOpts.filter(o => o !== correctOpt);
          while (otherOpts.length < 3) {
            otherOpts.push(`الخيار البديل ${otherOpts.length + 1}`);
          }

          finalDraftOpts = [correctOpt, otherOpts[0], otherOpts[1], otherOpts[2]];
          finalCorrectAnswer = '0';
        }

        const optsKey = finalDraftOpts.map(o => norm(o)).sort().join('|');
        const uniqueKey = `${norm(draftText)}::${draftType}::${draftSubject}::${draftGrade}::${optsKey}`;

        if (existingKeys.has(uniqueKey)) {
          skippedDuplicates++;
          continue;
        }

        existingKeys.add(uniqueKey); // Prevent duplicates inside current batch

        const newBqId = `bq-ai-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
        questionsToBatch.push({
          id: newBqId,
          teacherId: currentUser.uid,
          text: draftText,
          type: draftType,
          options: finalDraftOpts,
          correctAnswer: finalCorrectAnswer,
          points: Number(draft.points || 1),
          stage: draftStage,
          grade: draftGrade,
          semester: draftSemester,
          subject: draftSubject,
          unit: draftUnit,
          lesson: draftLesson
        });
      }

      // Fast writeBatch execution in chunks of 400
      const BATCH_SIZE = 400;
      for (let i = 0; i < questionsToBatch.length; i += BATCH_SIZE) {
        const chunk = questionsToBatch.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(q => {
          batch.set(doc(db, 'question_bank', q.id), q);
        });
        await batch.commit();
        savedCount += chunk.length;
      }

      if (skippedDuplicates > 0) {
        triggerToast(`تم بنجاح حفظ ${savedCount} سؤال مستخرج، وتخطي ${skippedDuplicates} سؤال مكرر لعدم التكرار.`, 'success');
      } else {
        triggerToast(`تم بنجاح حفظ ${savedCount} سؤال مستخرج بالذكاء الاصطناعي في بنك الأسئلة في لحظات!`, 'success');
      }
      
      // Reset Modal state
      handleResetPdfModalStates();
    } catch (err) {
      console.error('Error saving drafted questions to Firestore:', err);
      triggerToast('حدث خطأ أثناء حفظ الأسئلة ببنك الأسئلة.', 'error');
    } finally {
      setIsGenerating(false);
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

  // Batch delete selected questions using writeBatch
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
          const BATCH_SIZE = 400;
          let count = 0;
          for (let i = 0; i < selectedIds.length; i += BATCH_SIZE) {
            const chunk = selectedIds.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(db);
            chunk.forEach(id => {
              batch.delete(doc(db, 'question_bank', id));
              if (editingQuestionId === id) handleResetForm();
            });
            await batch.commit();
            count += chunk.length;
          }
          setSelectedBqIds({});
          triggerToast(`تم حذف ${count} سؤال من بنك الأسئلة بنجاح وبسرعة فائقة!`, 'success');
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
          const BATCH_SIZE = 400;
          let count = 0;
          for (let i = 0; i < selectedIds.length; i += BATCH_SIZE) {
            const chunk = selectedIds.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(db);
            chunk.forEach(id => {
              const originalQuestion = bankQuestions.find(q => q.id === id);
              const finalUnit = moveUnit.trim() || (originalQuestion ? originalQuestion.unit : '') || 'الوحدة الأولى';
              const finalLesson = moveLesson.trim() || (originalQuestion ? originalQuestion.lesson : '') || 'الدرس الأول';
              batch.update(doc(db, 'question_bank', id), {
                stage: moveStage,
                grade: moveGrade,
                semester: moveSemester,
                subject: moveSubject,
                unit: finalUnit,
                lesson: finalLesson
              });
            });
            await batch.commit();
            count += chunk.length;
            setMoveProgress(count);
          }
          setSelectedBqIds({});
          setIsMovePanelOpen(false);
          triggerToast(`تم بنجاح نقل ${count} سؤال إلى التصنيف الجديد بسرعة وكفاءة!`, 'success');
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

  // Automated cleanup of all found duplicate questions using writeBatch
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
          const BATCH_SIZE = 400;
          let count = 0;
          for (let i = 0; i < dups.length; i += BATCH_SIZE) {
            const chunk = dups.slice(i, i + BATCH_SIZE);
            const batch = writeBatch(db);
            chunk.forEach(id => {
              batch.delete(doc(db, 'question_bank', id));
              if (editingQuestionId === id) handleResetForm();
            });
            await batch.commit();
            count += chunk.length;
          }
          // Remove deleted ones from selection list if any
          setSelectedBqIds(prev => {
            const updated = { ...prev };
            dups.forEach(id => {
              delete updated[id];
            });
            return updated;
          });
          triggerToast(`تم بنجاح تنظيف البنك وحذف ${count} سؤال مكرر بسرعة فائقة!`, 'success');
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

  // Smart Rephrasing of True/False Questions
  // Converts a portion of "True" answers into "False" statements while preserving student history
  const handleRephraseTrueFalse = async (targetScope: 'selected' | 'current_filter' | 'all') => {
    if (!isAdmin) {
      triggerToast('إعادة صياغة الأسئلة الذكية متاحة فقط للحساب الرئيسي.', 'error');
      return;
    }

    let candidates: BankQuestion[] = [];

    if (targetScope === 'selected') {
      const selectedIds = Object.keys(selectedBqIds).filter(id => selectedBqIds[id]);
      candidates = bankQuestions.filter(q => selectedIds.includes(q.id) && q.type === 'true_false');
      if (candidates.length === 0) {
        triggerToast('لم تقم بتحديد أي أسئلة من نوع صح وخطأ لإعادة صياغتها!', 'info');
        return;
      }
    } else if (targetScope === 'current_filter') {
      candidates = filteredBank.filter(q => q.type === 'true_false');
      if (candidates.length === 0) {
        triggerToast('لا توجد أسئلة صح وخطأ في التصفية الحالية لإعادة صياغتها!', 'info');
        return;
      }
    } else {
      candidates = bankQuestions.filter(q => q.type === 'true_false');
      if (candidates.length === 0) {
        triggerToast('لا توجد أسئلة صح وخطأ في بنك الأسئلة لإعادة صياغتها!', 'info');
        return;
      }
    }

    const trueCount = candidates.filter(q => q.correctAnswer === 'true' || q.correctAnswer === '0' || q.correctAnswer === 'صح').length;

    triggerConfirm(
      'إعادة صياغة وتنويع أسئلة الصح والخطأ بالذكاء الاصطناعي 🔄',
      `تم إيجاد (${candidates.length}) سؤال صح وخطأ ضمن النطاق المختار (منها ${trueCount} إجابتها "صح").\n\n` +
      `سيقوم النظام الذكي بإعادة صياغة نسبة 50% منها لتصبح عبارات خاطئة علمياً مع تصويب الإجابة إلى "خطأ"، مع الاحتفاظ التام بسجلات ونسب ودرجات الطلاب الحالية ووضع شارة "سؤال محدث 🔄" أمام الأسئلة المطورة فقط.\n\n` +
      `هل تود المتابعة؟`,
      async () => {
        setIsRephrasing(true);
        setRephraseProgress(0);
        setRephraseTotal(candidates.length);

        try {
          // Send to server-side AI endpoint in batches of 20
          const CHUNK_SIZE = 20;
          let updatedQuestionsCount = 0;

          for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
            const chunk = candidates.slice(i, i + CHUNK_SIZE);

            const res = await fetch('/api/rephrase-true-false-questions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                questions: chunk,
                targetRatio: 0.5
              })
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `خطأ في الخادم: ${res.status}`);
            }

            const data = await res.json();
            const updatedChunk: BankQuestion[] = data.updatedQuestions || data.questions || [];

            // Commit changed questions to Firestore in a batch
            const batch = writeBatch(db);
            let hasWrites = false;

            for (const q of updatedChunk) {
              if (q.isRephrased) {
                const docRef = doc(db, 'question_bank', q.id);
                batch.update(docRef, {
                  text: q.text,
                  correctAnswer: q.correctAnswer,
                  isRephrased: true,
                  version: (q.version || 1) + 1,
                  updatedAt: new Date().toISOString(),
                  ...(q.rephraseExplanation ? { rephraseExplanation: q.rephraseExplanation } : {})
                });
                hasWrites = true;
                updatedQuestionsCount++;
              }
            }

            if (hasWrites) {
              await batch.commit();
            }

            setRephraseProgress(Math.min(candidates.length, i + CHUNK_SIZE));
          }

          triggerToast(
            `اكتملت العملية بنجاح! تم تنويع وإعادة صياغة ${updatedQuestionsCount} سؤالاً لتصبح "خطأ" مع حفظ درجات الطلاب.`,
            'success'
          );
        } catch (err: any) {
          console.error("Error rephrasing questions:", err);
          triggerToast(err.message || 'حدث خطأ أثناء محاولة إعادة صياغة الأسئلة.', 'error');
        } finally {
          setIsRephrasing(false);
          setRephraseProgress(0);
          setRephraseTotal(0);
        }
      },
      undefined,
      'نعم، أعد الصياغة ونوّع الأسئلة',
      'إلغاء'
    );
  };

  // Filter logic (memoized for instantaneous UI response)
  const filteredBank = useMemo(() => {
    const search = searchQuery.trim().toLowerCase();
    return bankQuestions.filter(q => {
      const matchesSearch = search === '' || 
                            q.text.toLowerCase().includes(search) ||
                            q.unit.toLowerCase().includes(search) ||
                            q.lesson.toLowerCase().includes(search);
      
      const matchesStage = filterStage === 'all' || q.stage === filterStage;
      const matchesGrade = filterGrade === 'all' || q.grade === filterGrade;
      const matchesSubject = filterSubject === 'all' || q.subject === filterSubject;
      const matchesSemester = filterSemester === 'all' || q.semester === filterSemester;
      const matchesUnit = filterUnit === 'all' || q.unit === filterUnit;
      const matchesLesson = filterLesson === 'all' || q.lesson === filterLesson;

      return matchesSearch && matchesStage && matchesGrade && matchesSubject && matchesSemester && matchesUnit && matchesLesson;
    });
  }, [bankQuestions, searchQuery, filterStage, filterGrade, filterSubject, filterSemester, filterUnit, filterLesson]);

  // Unique filter lists built dynamically from the database contents (memoized for performance)
  const loadedStages = useMemo(() => {
    return Array.from(new Set(bankQuestions.map(q => q.stage))).filter(Boolean).sort();
  }, [bankQuestions]);

  const loadedGrades = useMemo(() => {
    return Array.from(new Set(
      bankQuestions
        .filter(q => filterStage === 'all' || q.stage === filterStage)
        .map(q => q.grade)
    )).filter(Boolean).sort();
  }, [bankQuestions, filterStage]);

  const loadedSemesters = useMemo(() => {
    return Array.from(new Set(
      bankQuestions
        .filter(q => (filterStage === 'all' || q.stage === filterStage) && (filterGrade === 'all' || q.grade === filterGrade))
        .map(q => q.semester)
    )).filter(Boolean).sort();
  }, [bankQuestions, filterStage, filterGrade]);

  const loadedSubjects = useMemo(() => {
    return Array.from(new Set(
      bankQuestions
        .filter(q => (filterStage === 'all' || q.stage === filterStage) && (filterGrade === 'all' || q.grade === filterGrade) && (filterSemester === 'all' || q.semester === filterSemester))
        .map(q => q.subject)
    )).filter(Boolean).sort();
  }, [bankQuestions, filterStage, filterGrade, filterSemester]);

  const loadedUnits = useMemo(() => {
    return Array.from(new Set(
      bankQuestions
        .filter(q => (filterStage === 'all' || q.stage === filterStage) && (filterGrade === 'all' || q.grade === filterGrade) && (filterSemester === 'all' || q.semester === filterSemester) && (filterSubject === 'all' || q.subject === filterSubject))
        .map(q => q.unit)
    )).filter(Boolean).sort();
  }, [bankQuestions, filterStage, filterGrade, filterSemester, filterSubject]);

  const loadedLessons = useMemo(() => {
    return Array.from(new Set(
      bankQuestions
        .filter(q => (filterStage === 'all' || q.stage === filterStage) && (filterGrade === 'all' || q.grade === filterGrade) && (filterSemester === 'all' || q.semester === filterSemester) && (filterSubject === 'all' || q.subject === filterSubject) && (filterUnit === 'all' || q.unit === filterUnit))
        .map(q => q.lesson)
    )).filter(Boolean).sort();
  }, [bankQuestions, filterStage, filterGrade, filterSemester, filterSubject, filterUnit]);

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
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 md:p-6 rounded-3xl border border-slate-200/80 shadow-sm transition-all">
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
              onClick={() => handleRephraseTrueFalse('current_filter')}
              disabled={isRephrasing}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-xs shadow-md transition duration-150 cursor-pointer ${
                isRephrasing
                  ? 'bg-amber-100 text-amber-700 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-amber-200 hover:shadow-lg'
              }`}
              title="إعادة صياغة وتنويع أسئلة الصح والخطأ بالذكاء الاصطناعي مع الحفاظ التام على درجات الطلاب"
            >
              <RefreshCw className={`w-4 h-4 ${isRephrasing ? 'animate-spin' : ''}`} />
              <span>{isRephrasing ? `جاري التنويع (${rephraseProgress}/${rephraseTotal})...` : 'تنويع أسئلة الصح والخطأ 🔄'}</span>
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
                      onClick={() => handleRephraseTrueFalse('selected')}
                      disabled={isRephrasing}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer shadow-3xs ${
                        isRephrasing
                          ? 'bg-amber-100 text-amber-700 cursor-not-allowed'
                          : 'bg-amber-50 hover:bg-amber-100 border border-amber-250 text-amber-800'
                      }`}
                      title="تنويع أسئلة الصح والخطأ من بين الأسئلة المحددة"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRephrasing ? 'animate-spin' : ''}`} />
                      <span>تنويع المحددة (صح/خطأ)</span>
                    </button>

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
            <p className="text-xs text-slate-400 pt-1">لا توجد أسئلة تطابق معايير التصفية والبحث المحددة.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredBank.map((q) => {
              const isSelected = !!selectedBqIds[q.id];
              return (
                <div
                  key={q.id}
                  className={`bg-white border rounded-2xl p-5 sm:p-6 transition-all shadow-3xs ${
                    isSelected ? "border-indigo-400 ring-2 ring-indigo-100 bg-indigo-50/10" : "border-slate-200/90 hover:border-slate-300"
                  }`}
                  dir="rtl"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Right side: Checkbox & Info */}
                    <div className="flex items-start gap-3.5 flex-1">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            setSelectedBqIds(prev => ({
                              ...prev,
                              [q.id]: e.target.checked
                            }));
                          }}
                          className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer accent-indigo-600 mt-1"
                        />
                      )}

                      <div className="space-y-3 flex-1">
                        {/* Badges */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                          <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700">
                            {q.stage}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700">
                            {q.grade}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                            {q.subject}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-50 border border-amber-100 text-amber-700">
                            {q.semester}
                          </span>
                          {q.unit && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-teal-50 border border-teal-100 text-teal-700">
                              {q.unit}
                            </span>
                          )}
                          {q.lesson && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-cyan-50 border border-cyan-100 text-cyan-700">
                              {q.lesson}
                            </span>
                          )}
                          {q.isRephrased && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 font-black flex items-center gap-1 shadow-2xs">
                              <span>سؤال محدث 🔄</span>
                            </span>
                          )}
                          <span className="mr-auto px-2.5 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 font-sans">
                            {q.points || 1} {q.points === 1 ? "درجة" : "درجات"}
                          </span>
                        </div>

                        {/* Question Text */}
                        <p className="text-sm font-extrabold text-slate-800 leading-relaxed font-sans">
                          {q.text}
                        </p>

                        {/* Options */}
                        {q.options && q.options.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {q.options.map((opt, optIdx) => {
                              const isCorrect = q.type === "true_false"
                                ? (optIdx === 0 && (q.correctAnswer === "true" || q.correctAnswer === "0")) ||
                                  (optIdx === 1 && (q.correctAnswer === "false" || q.correctAnswer === "1"))
                                : String(optIdx) === String(q.correctAnswer);
                              return (
                                <div
                                  key={optIdx}
                                  className={`px-3.5 py-2 rounded-xl text-xs font-sans flex items-center justify-between border ${
                                    isCorrect
                                      ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                                      : "bg-slate-50 border-slate-200 text-slate-600"
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {isCorrect && (
                                    <span className="flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>الإجابة الصحيحة</span>
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Left side: Action buttons */}
                    {isAdmin && (
                      <div className="flex sm:flex-col items-center gap-2 shrink-0 self-end sm:self-start">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(q)}
                          className="p-2 rounded-xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer"
                          title="تعديل السؤال"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id, q.text)}
                          className="p-2 rounded-xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition cursor-pointer"
                          title="حذف السؤال"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SHADED MODAL: CREATE QUESTIONS FROM PDF / TEXTBOOK */}
      <AnimatePresence>
        {showPdfModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-right font-sans border border-slate-200/80"
            >
              {/* Header with Step Progress */}
              <div className="p-5 sm:p-6 border-b border-slate-150 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                    <BookCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                      <span>توليد الأسئلة من المناهج والكتب المدرسية</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">ذكاء اصطناعي</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">استعراض فهرس ووحدات ودروس الكتاب المدرسي وتحديد الدروس المراد إنشاء أسئلة لها بدقة.</p>
                  </div>
                </div>

                {/* Wizard Steps indicator */}
                <div className="flex items-center gap-1.5 self-start sm:self-center bg-white/80 backdrop-blur-xs border border-slate-200/80 rounded-2xl p-1 text-xs">
                  <div className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition ${
                    pdfStep === 'upload' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'
                  }`}>
                    <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center">1</span>
                    <span>رفع الكتاب</span>
                  </div>
                  <span className="text-slate-300">/</span>
                  <div className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition ${
                    pdfStep === 'structure' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'
                  }`}>
                    <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center">2</span>
                    <span>اختيار الدروس</span>
                  </div>
                  <span className="text-slate-300">/</span>
                  <div className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition ${
                    pdfStep === 'review' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500'
                  }`}>
                    <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] flex items-center justify-center">3</span>
                    <span>مراجعة الأسئلة</span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      handleResetPdfModalStates();
                      setShowPdfModal(false);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 mr-1 cursor-pointer"
                    title="إغلاق"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 p-5 sm:p-6 overflow-y-auto space-y-6">

                {/* 1. UPLOAD STEP */}
                {pdfStep === 'upload' && !isExtractingStructure && (
                  <div className="space-y-5">
                    {/* File Dropzone */}
                    <div className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-3xl p-8 sm:p-10 bg-emerald-50/20 hover:bg-emerald-50/40 transition-all text-center flex flex-col items-center justify-center gap-4">
                      <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
                        <Upload className="w-8 h-8 animate-bounce" />
                      </div>
                      
                      <div className="space-y-1.5 max-w-md">
                        <h4 className="text-sm sm:text-base font-black text-slate-800">اسحب كتاب المنهج أو المستند هنا أو انقر للتحديد</h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-sans">
                          يدعم ملفات الكتب والمذكرات الدراسية بصيغ (PDF، Word .docx، Excel .xlsx) بحد أقصى 10 ميجابايت.
                        </p>
                      </div>

                      <input
                        type="file"
                        accept=".pdf,.docx,.doc,.xlsx,.xls"
                        onChange={handlePdfUpload}
                        className="hidden"
                        id="pdf-picker-input-bank"
                      />
                      <label
                        htmlFor="pdf-picker-input-bank"
                        className="mt-2 px-6 py-3 border border-emerald-300 hover:border-emerald-400 rounded-2xl bg-white hover:bg-emerald-50 text-xs font-black text-emerald-800 cursor-pointer transition shadow-xs flex items-center gap-2"
                      >
                        <FolderOpen className="w-4 h-4 text-emerald-600" />
                        <span>اختيار ملف من جهازك</span>
                      </label>
                    </div>

                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-right space-y-1">
                        <p className="text-xs font-bold text-slate-800">ماذا يحدث بعد رفع الكتاب؟</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          سيقوم الذكاء الاصطناعي بقراءة فهرس ومحتوى الكتاب تلقائياً واستخراج عناوين الوحدات والدروس، ليتيح لك تحديد الدروس المستهدفة بدقة وصياغة الأسئلة حولها مباشرة.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* EXTRACTING STRUCTURE SPINNER */}
                {isExtractingStructure && (
                  <div className="flex flex-col items-center justify-center py-14 space-y-5 text-center">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                        <BookOpen className="w-6 h-6 animate-pulse" />
                      </div>
                    </div>
                    <div className="space-y-2 max-w-md">
                      <h4 className="text-base font-black text-slate-800">جاري فحص الكتاب وقراءة الوحدات والدروس...</h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-sans">
                        يقوم نموذج الذكاء الاصطناعي المتطور بتحليل فهرس الكتاب وموضوعاته الأكاديمية لاستخراج قائمة الوحدات والدروس التعليمية بدقة.
                      </p>
                    </div>
                  </div>
                )}

                {/* 2. STRUCTURE STEP (UNITS & LESSONS SELECTION + GENERATION PARAMS) */}
                {pdfStep === 'structure' && !isExtractingStructure && (
                  <div className="space-y-6">
                    {/* Book Metadata Banner */}
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-3xl p-5 shadow-lg shadow-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold">
                            📖 تم فحص المستند بنجاح
                          </span>
                          {pdfFile && (
                            <span className="text-[11px] text-emerald-100 font-sans">
                              ({(pdfFile.size / 1024 / 1024).toFixed(2)} ميغابايت)
                            </span>
                          )}
                        </div>
                        <h3 className="text-base sm:text-lg font-black leading-snug">
                          {bookStructure?.bookTitle || pdfFile?.name || 'الكتاب المدرسي المستهدف'}
                        </h3>
                        {/* Detected badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {bookStructure?.stage && (
                            <span className="px-2 py-0.5 rounded-lg bg-white/20 text-white text-[10px] font-bold">
                              {bookStructure.stage}
                            </span>
                          )}
                          {bookStructure?.grade && (
                            <span className="px-2 py-0.5 rounded-lg bg-white/20 text-white text-[10px] font-bold">
                              {bookStructure.grade}
                            </span>
                          )}
                          {bookStructure?.subject && (
                            <span className="px-2 py-0.5 rounded-lg bg-white/20 text-white text-[10px] font-bold">
                              {bookStructure.subject}
                            </span>
                          )}
                          {bookStructure?.semester && (
                            <span className="px-2 py-0.5 rounded-lg bg-white/20 text-white text-[10px] font-bold">
                              {bookStructure.semester}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                        <input
                          type="file"
                          accept=".pdf,.docx,.doc,.xlsx,.xls"
                          onChange={handlePdfUpload}
                          className="hidden"
                          id="pdf-reupload-input-bank"
                        />
                        <label
                          htmlFor="pdf-reupload-input-bank"
                          className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-extrabold cursor-pointer transition border border-white/20 flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>تغيير الكتاب</span>
                        </label>
                      </div>
                    </div>

                    {/* Units & Lessons Selection List */}
                    <div className="border border-slate-200 rounded-3xl p-5 bg-white space-y-4 shadow-2xs">
                      {/* Selection Toolbar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-150">
                        <div className="flex items-center gap-2">
                          <ListChecks className="w-5 h-5 text-emerald-600" />
                          <div>
                            <h4 className="text-sm font-black text-slate-800">قائمة الوحدات والدروس المستخرجة</h4>
                            <p className="text-[11px] text-slate-500 font-medium">
                              حدد الدروس التي تود أن يقوم الذكاء الاصطناعي بصياغة الأسئلة منها:
                            </p>
                          </div>
                        </div>

                        {/* Quick Selection Buttons */}
                        <div className="flex items-center gap-2 text-xs">
                          <button
                            type="button"
                            onClick={handleSelectAllLessons}
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold transition cursor-pointer flex items-center gap-1"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            <span>تحديد كافة الدروس</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDeselectAllLessons}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-650 font-extrabold transition cursor-pointer"
                          >
                            <span>إلغاء التحديد</span>
                          </button>
                        </div>
                      </div>

                      {/* Summary of Selected Lessons */}
                      <div className="bg-slate-50 rounded-2xl px-4 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>الدروس المحددة للتوليد:</span>
                        <span className="px-3 py-1 rounded-xl bg-emerald-600 text-white text-xs font-black font-sans">
                          {Object.keys(selectedLessons).filter(k => selectedLessons[k]).length} درس محدد
                        </span>
                      </div>

                      {/* Units Accordion */}
                      {bookStructure?.units && bookStructure.units.length > 0 ? (
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                          {bookStructure.units.map((unit) => {
                            const isExpanded = !!expandedUnits[unit.id];
                            const unitLessons = unit.lessons || [];
                            const selectedInUnitCount = unitLessons.filter(l => !!selectedLessons[l.lessonTitle]).length;
                            const isAllUnitSelected = unitLessons.length > 0 && selectedInUnitCount === unitLessons.length;

                            return (
                              <div
                                key={unit.id}
                                className="border border-slate-200/90 rounded-2xl overflow-hidden bg-slate-50/40 transition hover:border-emerald-300"
                              >
                                {/* Unit Header */}
                                <div className="p-3.5 bg-slate-100/70 flex items-center justify-between gap-3 select-none">
                                  <div 
                                    className="flex items-center gap-3 flex-1 cursor-pointer"
                                    onClick={() => handleToggleUnitExpanded(unit.id)}
                                  >
                                    <button
                                      type="button"
                                      className="text-slate-400 hover:text-slate-700"
                                    >
                                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    </button>
                                    <Bookmark className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span className="text-xs sm:text-sm font-black text-slate-800">{unit.unitTitle}</span>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-extrabold">
                                      {selectedInUnitCount} / {unitLessons.length} دروس
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleUnitAllLessons(unit)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                                      isAllUnitSelected
                                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    {isAllUnitSelected ? 'إلغاء دروس الوحدة' : 'تحديد دروس الوحدة'}
                                  </button>
                                </div>

                                {/* Lessons inside Unit */}
                                {isExpanded && (
                                  <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-150">
                                    {unitLessons.map((lesson) => {
                                      const isSelected = !!selectedLessons[lesson.lessonTitle];
                                      return (
                                        <div
                                          key={lesson.id}
                                          onClick={() => handleToggleLesson(lesson.lessonTitle)}
                                          className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                                            isSelected
                                              ? 'bg-emerald-50/60 border-emerald-500 text-emerald-900 shadow-3xs'
                                              : 'bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100/80 hover:border-slate-300'
                                          }`}
                                        >
                                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                                            isSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-350 bg-white'
                                          }`}>
                                            {isSelected && <Check className="w-3.5 h-3.5" />}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-extrabold truncate">{lesson.lessonTitle}</p>
                                            {lesson.pageOrSection && (
                                              <p className="text-[10px] text-slate-400 font-sans mt-0.5">{lesson.pageOrSection}</p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 bg-slate-50 rounded-2xl text-center space-y-2">
                          <p className="text-xs font-bold text-slate-700">لم يتم استخراج وحدات مقسمة، سيتم التوليد من كامل محتوى المستند المرفوع.</p>
                        </div>
                      )}
                    </div>

                    {/* Question Count and Types Config (Per Lesson) */}
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-right">
                        <div>
                          <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                            <span>تحديد عدد الأسئلة في كل درس</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">لكل درس على حدة</span>
                          </h4>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">حدد عدد الأسئلة المطلوبة لكل نوع ليتم توليدها وصياغتها بدقة لكل درس محدد</p>
                        </div>
                        {Object.values(selectedLessons).filter(Boolean).length > 0 && (
                          <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-black font-sans self-start sm:self-auto shadow-3xs">
                            {Object.values(selectedLessons).filter(Boolean).length} {Object.values(selectedLessons).filter(Boolean).length === 1 ? 'درس محدد' : Object.values(selectedLessons).filter(Boolean).length === 2 ? 'درسان محددان' : 'دروس محددة'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* MCQ Count Card */}
                        <div className="bg-slate-50/90 border border-slate-200/90 hover:border-indigo-300 rounded-2xl p-4 transition space-y-3 text-right">
                          <div className="flex items-center justify-between">
                            <label htmlFor="mcq-count-input" className="text-xs font-black text-slate-700 block select-none">
                              أسئلة الاختيار من متعدد:
                            </label>
                            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-sans">
                              لكل درس
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl p-1.5 shadow-3xs">
                            <button
                              type="button"
                              onClick={() => setMcqCount(Math.max(0, mcqCount - 1))}
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center transition cursor-pointer"
                              title="تقليل سؤال واحد"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            
                            <div className="flex-1 flex items-center justify-center gap-1.5">
                              <input
                                id="mcq-count-input"
                                type="number"
                                min={0}
                                max={50}
                                value={mcqCount}
                                onChange={(e) => setMcqCount(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-16 text-center font-black text-slate-800 text-base focus:outline-none font-sans"
                              />
                              <span className="text-xs font-bold text-slate-400">سؤال</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setMcqCount(Math.min(50, mcqCount + 1))}
                              className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-600 flex items-center justify-center transition cursor-pointer"
                              title="زيادة سؤال واحد"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Quick presets */}
                          <div className="flex items-center justify-between gap-1 pt-1">
                            <span className="text-[10px] text-slate-400 font-bold">خيارات سريعة:</span>
                            <div className="flex items-center gap-1">
                              {[3, 5, 10, 15, 20].map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => setMcqCount(num)}
                                  className={`px-2 py-0.5 text-[11px] font-sans font-extrabold rounded-md transition cursor-pointer ${
                                    mcqCount === num
                                      ? 'bg-indigo-600 text-white'
                                      : 'bg-white hover:bg-slate-200/80 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* True/False Count Card */}
                        <div className="bg-slate-50/90 border border-slate-200/90 hover:border-emerald-300 rounded-2xl p-4 transition space-y-3 text-right">
                          <div className="flex items-center justify-between">
                            <label htmlFor="tf-count-input" className="text-xs font-black text-slate-700 block select-none">
                              أسئلة الصواب والخطأ:
                            </label>
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-sans">
                              لكل درس
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl p-1.5 shadow-3xs">
                            <button
                              type="button"
                              onClick={() => setTfCount(Math.max(0, tfCount - 1))}
                              className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center transition cursor-pointer"
                              title="تقليل سؤال واحد"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            
                            <div className="flex-1 flex items-center justify-center gap-1.5">
                              <input
                                id="tf-count-input"
                                type="number"
                                min={0}
                                max={50}
                                value={tfCount}
                                onChange={(e) => setTfCount(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-16 text-center font-black text-slate-800 text-base focus:outline-none font-sans"
                              />
                              <span className="text-xs font-bold text-slate-400">سؤال</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setTfCount(Math.min(50, tfCount + 1))}
                              className="w-8 h-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-600 flex items-center justify-center transition cursor-pointer"
                              title="زيادة سؤال واحد"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Quick presets */}
                          <div className="flex items-center justify-between gap-1 pt-1">
                            <span className="text-[10px] text-slate-400 font-bold">خيارات سريعة:</span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 5, 10].map((num) => (
                                <button
                                  key={num}
                                  type="button"
                                  onClick={() => setTfCount(num)}
                                  className={`px-2 py-0.5 text-[11px] font-sans font-extrabold rounded-md transition cursor-pointer ${
                                    tfCount === num
                                      ? 'bg-emerald-600 text-white'
                                      : 'bg-white hover:bg-slate-200/80 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Live Calculation Note Box directly below the question counts config */}
                      {(() => {
                        const selCount = Object.values(selectedLessons).filter(Boolean).length;
                        const isMulti = selCount > 0;
                        const totalMcq = isMulti ? (mcqCount * selCount) : mcqCount;
                        const totalTf = isMulti ? (tfCount * selCount) : tfCount;
                        const totalAll = totalMcq + totalTf;
                        return (
                          <div className="p-4 bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-emerald-50/90 border border-emerald-200/90 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3.5 text-right shadow-3xs">
                            <div className="flex items-start sm:items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Sparkles className="w-4.5 h-4.5" />
                              </div>
                              <div>
                                <h5 className="text-xs font-black text-slate-800 flex items-center gap-1.5 flex-wrap">
                                  <span>ملاحظة: مجموع الأسئلة الكلية لجميع الدروس المحددة</span>
                                  {isMulti ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold font-sans">
                                      {selCount} {selCount === 1 ? 'درس' : selCount === 2 ? 'درسين' : 'دروس'}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                                      كامل المستند
                                    </span>
                                  )}
                                </h5>
                                <p className="text-[11px] text-emerald-800 font-medium font-sans mt-0.5 leading-relaxed">
                                  {isMulti ? (
                                    <>
                                      سيقوم النظام بتوليد ({mcqCount} اختيار من متعدد + {tfCount} صح وخطأ) لكل درس من الدروس الـ ({selCount}) المحددة = مجموع كلي ({totalAll} سؤال).
                                    </>
                                  ) : (
                                    <>
                                      سيتم توليد ({mcqCount} اختيار من متعدد + {tfCount} صح وخطأ) من كامل محتوى الملف المرفق = مجموع ({totalAll} سؤال).
                                    </>
                                  )}
                                </p>
                              </div>
                            </div>

                            {/* Breakdown and Total Badges */}
                            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto shrink-0">
                              <div className="px-3 py-1.5 bg-white border border-emerald-200/90 rounded-xl flex items-center gap-1.5 text-xs font-bold text-slate-700 shadow-3xs">
                                <span className="text-slate-400 font-normal">إجمالي الاختيار من متعدد:</span>
                                <span className="font-black text-indigo-600 font-sans">{totalMcq}</span>
                              </div>
                              <div className="px-3 py-1.5 bg-white border border-emerald-200/90 rounded-xl flex items-center gap-1.5 text-xs font-bold text-slate-700 shadow-3xs">
                                <span className="text-slate-400 font-normal">إجمالي الصح والخطأ:</span>
                                <span className="font-black text-emerald-600 font-sans">{totalTf}</span>
                              </div>
                              <div className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl flex items-center gap-1.5 text-xs font-black shadow-xs font-sans">
                                <span className="text-emerald-100 font-medium">المجموع الكلي:</span>
                                <span className="text-sm font-black">{totalAll}</span>
                                <span>سؤال</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Classification Details (Collapsible or Grid) */}
                    <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-150">
                        <FolderOpen className="w-4 h-4 text-emerald-600" />
                        <div className="text-right">
                          <h4 className="text-xs font-extrabold text-slate-800">تصنيف الأسئلة ببنك الأسئلة (الصف والمادة)</h4>
                          <p className="text-[10px] text-slate-400 font-medium">تم ضبطها تلقائياً وفقاً للكتاب المستخرج، ويمكنك تعديلها يدوياً عند الرغبة.</p>
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
                              if (val === 'auto') {
                                setPdfGradeOverride('auto');
                                setPdfSubjectOverride('auto');
                              } else {
                                if (GRADE_PRESETS[val]) {
                                  const firstGrade = GRADE_PRESETS[val][0];
                                  setPdfGradeOverride(firstGrade);
                                  if (GRADE_SUBJECT_PRESETS[firstGrade]) {
                                    setPdfSubjectOverride(GRADE_SUBJECT_PRESETS[firstGrade][0]);
                                  } else if (STAGE_SUBJECT_PRESETS[val]) {
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
                          <label htmlFor="pdf-unit-input" className="text-[11px] font-bold text-slate-500 block">الوحدة الدراسية (اختياري)</label>
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
                          <label htmlFor="pdf-lesson-input" className="text-[11px] font-bold text-slate-500 block">الدرس (اختياري)</label>
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

                    {/* Custom Prompt Textarea */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 flex items-center gap-1 justify-start">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>إرشادات وتوجيهات إضافية للتوليد (اختياري)</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="مثال: ركز على التعريفات والمفاهيم الأساسية، تجنب الأسئلة الغامضة، اجعل الخيارات واضحة..."
                        value={pdfCustomPrompt}
                        onChange={(e) => setPdfCustomPrompt(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Generate Button */}
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        disabled={isGenerating || (bookStructure?.units && bookStructure.units.length > 0 && Object.keys(selectedLessons).filter(k => selectedLessons[k]).length === 0)}
                        onClick={handleGenerateQuestionsFromPdf}
                        className={`w-full sm:w-auto px-10 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-sm shadow-md transition duration-150 flex items-center justify-center gap-2 ${
                          (bookStructure?.units && bookStructure.units.length > 0 && Object.keys(selectedLessons).filter(k => selectedLessons[k]).length === 0)
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:from-emerald-700 hover:to-teal-700 cursor-pointer shadow-emerald-100'
                        }`}
                      >
                        <Sparkles className="w-4.5 h-4.5 text-emerald-100" />
                        <span>
                          ✨ بدء توليد أسئلة الدروس المحددة ({(() => {
                            const c = Object.values(selectedLessons).filter(Boolean).length;
                            return c > 0 ? (mcqCount + tfCount) * c : (mcqCount + tfCount);
                          })()} سؤالاً)
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* GENERATING QUESTIONS PROGRESS SCREEN */}
                {isGenerating && (
                  <div className="flex flex-col items-center justify-center py-10 space-y-6 text-center">
                    <div className="relative">
                      <div className="w-18 h-18 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-emerald-600">
                        <Sparkles className="w-7 h-7 animate-pulse" />
                      </div>
                    </div>
                    
                    <div className="space-y-3 max-w-lg w-full px-2">
                      <h4 className="text-base font-black text-slate-800">
                        يقوم الذكاء الاصطناعي بتوليد وصياغة الأسئلة الأكاديمية الآن
                      </h4>
                      
                      {generationProgress && (
                        <div className="space-y-3 bg-slate-50 border border-slate-200/90 rounded-2xl p-4 text-right shadow-3xs">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-emerald-700 font-black font-sans">
                              تم استخراج <span className="text-base font-black">{generationProgress.generatedSoFar}</span> من أصل <span className="font-black">{generationProgress.totalTarget}</span> سؤالاً
                            </span>
                            <span className="text-slate-500 font-sans bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-[11px]">
                              الدفعة {generationProgress.currentBatch} من {generationProgress.totalBatches}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden shadow-inner">
                            <div 
                              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300 ease-out"
                              style={{
                                width: `${Math.min(100, Math.max(4, (generationProgress.generatedSoFar / Math.max(1, generationProgress.totalTarget)) * 100))}%`
                              }}
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="text-[11px] font-bold text-slate-400 shrink-0">جاري معالجة:</span>
                            <span className="text-xs font-extrabold text-slate-700 truncate font-sans">
                              {generationProgress.currentLessonName}
                            </span>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-slate-500 leading-relaxed font-sans">
                        يتم تقسيم الطلب ومعالجة الدروس على دفعات سريعة لضمان استقرار الخادم وعدم انقطاع الاتصال حتى 500 سؤال.
                      </p>

                      {/* Stop and Review early button */}
                      {generationProgress && generationProgress.generatedSoFar > 0 && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={handleStopPdfGeneration}
                            disabled={generationProgress.isStopping}
                            className="px-5 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition cursor-pointer shadow-3xs flex items-center gap-2 mx-auto"
                          >
                            {generationProgress.isStopping ? (
                              <span>جاري إنهاء الدفعة الحالية وعرض النتائج...</span>
                            ) : (
                              <>
                                <span>إيقاف المعالجة والاحتفاظ بـ ({generationProgress.generatedSoFar}) سؤالاً مستخرجاً</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. REVIEW GENERATED QUESTIONS (Supports 500+ Questions) */}
                {pdfStep === 'review' && !isGenerating && generatedDrafts.length > 0 && (() => {
                  const filteredDrafts = generatedDrafts
                    .map((draft, originalIndex) => ({ draft, originalIndex }))
                    .filter(({ draft }) => {
                      if (!reviewSearchQuery.trim()) return true;
                      const q = reviewSearchQuery.trim().toLowerCase();
                      const matchText = (draft.text || '').toLowerCase().includes(q);
                      const matchLesson = (draft.lesson || '').toLowerCase().includes(q);
                      const matchUnit = (draft.unit || '').toLowerCase().includes(q);
                      return matchText || matchLesson || matchUnit;
                    });

                  const totalPages = Math.ceil(filteredDrafts.length / REVIEW_PAGE_SIZE) || 1;
                  const currentPage = Math.min(reviewCurrentPage, totalPages);
                  const startIndex = (currentPage - 1) * REVIEW_PAGE_SIZE;
                  const visibleDrafts = filteredDrafts.slice(startIndex, startIndex + REVIEW_PAGE_SIZE);
                  const selectedCount = Object.values(selectedDraftIndexes).filter(Boolean).length;

                  return (
                    <div className="space-y-4">
                      {/* Search & Bulk Select Toolbar */}
                      <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3.5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
                          {/* Bulk Actions */}
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const next: Record<number, boolean> = {};
                                generatedDrafts.forEach((_, idx) => { next[idx] = true; });
                                setSelectedDraftIndexes(next);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 transition cursor-pointer shadow-3xs text-xs font-sans"
                            >
                              تحديد الكل ({generatedDrafts.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedDraftIndexes({})}
                              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-650 font-extrabold hover:bg-slate-100 transition cursor-pointer text-xs font-sans"
                            >
                              إلغاء التحديد
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = { ...selectedDraftIndexes };
                                visibleDrafts.forEach(({ originalIndex }) => {
                                  next[originalIndex] = true;
                                });
                                setSelectedDraftIndexes(next);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold hover:bg-indigo-100 transition cursor-pointer text-xs font-sans"
                            >
                              تحديد الصفحة الحالية ({visibleDrafts.length})
                            </button>
                          </div>

                          {/* Stat Badge */}
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 font-sans shadow-3xs">
                              المحدد للحفظ: <span className="font-black text-emerald-600 font-sans text-sm">{selectedCount}</span> من <span className="font-black text-slate-800 font-sans">{generatedDrafts.length}</span> سؤال
                            </span>
                          </div>
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="🔍 بحث سريع في نص السؤال أو اسم الدرس أو الوحدة..."
                            value={reviewSearchQuery}
                            onChange={(e) => {
                              setReviewSearchQuery(e.target.value);
                              setReviewCurrentPage(1);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                          />
                          {reviewSearchQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setReviewSearchQuery('');
                                setReviewCurrentPage(1);
                              }}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                              مسح
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Draft Question Cards */}
                      <div className="space-y-3.5 max-h-[52vh] overflow-y-auto pr-1">
                        {visibleDrafts.length === 0 ? (
                          <div className="p-8 text-center bg-slate-50 rounded-2xl text-slate-400 text-xs font-bold">
                            لا توجد أسئلة تطابق بحثك الحسابي.
                          </div>
                        ) : (
                          visibleDrafts.map(({ draft, originalIndex }) => {
                            const isSelected = !!selectedDraftIndexes[originalIndex];
                            return (
                              <div
                                key={originalIndex}
                                onClick={() => {
                                  setSelectedDraftIndexes(prev => ({
                                    ...prev,
                                    [originalIndex]: !prev[originalIndex]
                                  }));
                                }}
                                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                                  isSelected
                                    ? 'bg-emerald-50/20 border-emerald-500 shadow-xs'
                                    : 'bg-white border-slate-200 hover:border-slate-300'
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
                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-sans font-bold">
                                      #{originalIndex + 1}
                                    </span>
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
                                    {(draft.unit || (pdfUnitOverride.trim() !== '' ? pdfUnitOverride : '')) && (
                                      <span className="px-2 py-0.5 rounded-md bg-indigo-50/50 text-indigo-600 text-[9px] font-sans font-semibold">
                                        {draft.unit || pdfUnitOverride}
                                      </span>
                                    )}
                                    {(draft.lesson || (pdfLessonOverride.trim() !== '' ? pdfLessonOverride : '')) && (
                                      <span className="px-2 py-0.5 rounded-md bg-teal-50/50 text-teal-600 text-[9px] font-sans font-semibold">
                                        {draft.lesson || pdfLessonOverride}
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
                                            ? (oIdx === 0 && (draft.correctAnswer === 'true' || draft.correctAnswer === '0')) || (oIdx === 1 && (draft.correctAnswer === 'false' || draft.correctAnswer === '1'))
                                            : String(oIdx) === String(draft.correctAnswer);
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
                          })
                        )}
                      </div>

                      {/* Pagination Controls for Large Question Sets */}
                      {totalPages > 1 && (
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-150 text-xs font-sans">
                          <div className="text-slate-500 font-bold">
                            عرض الصفحة <span className="font-black text-slate-800">{currentPage}</span> من <span className="font-black text-slate-800">{totalPages}</span> ({filteredDrafts.length} سؤال إجمالي)
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={currentPage <= 1}
                              onClick={() => setReviewCurrentPage(p => Math.max(1, p - 1))}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 cursor-pointer transition"
                            >
                              السابق
                            </button>
                            
                            {/* Page buttons */}
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              let pageNum = i + 1;
                              if (totalPages > 5) {
                                pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                              }
                              return (
                                <button
                                  key={pageNum}
                                  type="button"
                                  onClick={() => setReviewCurrentPage(pageNum)}
                                  className={`w-8 h-8 rounded-lg font-black text-xs transition cursor-pointer ${
                                    currentPage === pageNum
                                      ? 'bg-emerald-600 text-white shadow-3xs'
                                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              );
                            })}

                            <button
                              type="button"
                              disabled={currentPage >= totalPages}
                              onClick={() => setReviewCurrentPage(p => Math.min(totalPages, p + 1))}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 cursor-pointer transition"
                            >
                              التالي
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Error Banner */}
                {pdfError && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-800">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="text-right flex-1">
                      <p className="text-xs font-bold">تنبيه أثناء معالجة المستند:</p>
                      <p className="text-[11px] mt-0.5 leading-relaxed font-sans">{pdfError}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row justify-between items-center gap-3">
                {pdfStep === 'review' && generatedDrafts.length > 0 ? (
                  <>
                    <span className="text-xs font-bold text-indigo-900 font-sans">
                      تم تحديد <span className="text-emerald-600 text-sm font-black">{Object.values(selectedDraftIndexes).filter(Boolean).length}</span> أسئلة للحفظ.
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPdfStep('structure')}
                        className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-extrabold text-slate-700 cursor-pointer transition flex items-center gap-1.5"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        <span>العودة لاختيار دروس أخرى</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSelectedDrafts}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-100 cursor-pointer transition font-sans flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>حفظ الأسئلة المحددة ببنك الأسئلة</span>
                      </button>
                    </div>
                  </>
                ) : pdfStep === 'structure' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setPdfStep('upload')}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-650 cursor-pointer transition flex items-center gap-1.5"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>اختيار ملف مختلف</span>
                    </button>
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                      المحرك الذكي يقوم بصياغة الأسئلة استناداً إلى الدروس المحددة بالأعلى فقط.
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] text-slate-400 font-medium">نظام التوليد يدعم ملفات PDF و Word و Excel بكفاءة عالية.</span>
                    <button
                      type="button"
                      onClick={() => {
                        handleResetPdfModalStates();
                        setShowPdfModal(false);
                      }}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-650 cursor-pointer transition"
                    >
                      إغلاق
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
