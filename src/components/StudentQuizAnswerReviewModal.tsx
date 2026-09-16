import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  FileCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Printer,
  Award,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { Student, StudentGrade, Quiz, Question } from '../types';
import {
  findMatchingQuestionItem,
  checkAnswerCorrectness,
  resolveQuestionCorrectText,
  isTrueFalseQuestion,
  normalizeArabicText
} from '../utils/questionUtils';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  grade: StudentGrade;
  quiz?: Quiz | null;
  allQuizzes?: Quiz[];
  onRegrade?: (studentId: string, quizTitle: string) => Promise<void> | void;
}

export interface QuestionReviewItem {
  id: string;
  number: number;
  text: string;
  type: string;
  points: number;
  options: string[];
  studentAnswer: any;
  studentAnswerText: string;
  correctAnswerText: string;
  isCorrect: boolean;
  isAnswered: boolean;
  hasMismatchWithBank?: boolean;
}

export const StudentQuizAnswerReviewModal: React.FC<Props> = ({
  isOpen,
  onClose,
  student,
  grade,
  quiz,
  allQuizzes = [],
  onRegrade,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'correct' | 'wrong' | 'unanswered'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRegrading, setIsRegrading] = useState(false);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [archivedSubmission, setArchivedSubmission] = useState<any | null>(null);

  // Identify the target quiz object from allQuizzes or the passed quiz
  const targetQuiz = useMemo(() => {
    if (quiz && (quiz.id === grade.quizId || quiz.title === grade.quizTitle)) {
      return quiz;
    }
    const found = allQuizzes.find(
      (qz) => (grade.quizId && qz.id === grade.quizId) || qz.title === grade.quizTitle
    );
    return found || quiz || null;
  }, [quiz, allQuizzes, grade]);

  // Attempt to load from Firestore standalone_results if local details are incomplete
  useEffect(() => {
    if (!isOpen) return;

    const hasDetailedResults =
      Array.isArray(grade.detailedQuestionResults) && grade.detailedQuestionResults.length > 0;
    const hasAnswersMap = grade.answers && Object.keys(grade.answers).length > 0;

    if (hasDetailedResults && hasAnswersMap) {
      return;
    }

    let isMounted = true;
    const fetchArchived = async () => {
      try {
        setIsLoadingArchive(true);
        const qCol = collection(db, 'standalone_results');
        const qQuery = query(qCol, where('quizTitle', '==', grade.quizTitle));
        const snap = await getDocs(qQuery);
        if (!isMounted) return;

        const docs = snap.docs.map((d) => d.data());
        const normStudentName = normalizeArabicText(student.name);

        const match = docs.find(
          (doc) =>
            doc.studentId === student.id ||
            (doc.studentName && normalizeArabicText(doc.studentName) === normStudentName)
        );

        if (match) {
          setArchivedSubmission(match);
        }
      } catch (err) {
        console.warn('Could not load archived submission for review:', err);
      } finally {
        if (isMounted) setIsLoadingArchive(false);
      }
    };

    fetchArchived();

    return () => {
      isMounted = false;
    };
  }, [isOpen, student.id, student.name, grade.quizTitle, grade.detailedQuestionResults, grade.answers]);

  // Build the unified questions review list
  const reviewItems: QuestionReviewItem[] = useMemo(() => {
    const items: QuestionReviewItem[] = [];

    // Sources of truth
    const detailedList: any[] =
      Array.isArray(grade.detailedQuestionResults) && grade.detailedQuestionResults.length > 0
        ? grade.detailedQuestionResults
        : Array.isArray(archivedSubmission?.detailedQuestionResults) &&
          archivedSubmission.detailedQuestionResults.length > 0
        ? archivedSubmission.detailedQuestionResults
        : [];

    const answersMap: Record<string, any> = {
      ...(archivedSubmission?.answers || {}),
      ...(grade.answers || {}),
    };

    // If we have questions from targetQuiz, iterate through them
    if (targetQuiz && Array.isArray(targetQuiz.questions) && targetQuiz.questions.length > 0) {
      targetQuiz.questions.forEach((q, idx) => {
        const detail = findMatchingQuestionItem(q, detailedList);

        // 1. Student Answer lookup
        let studentAns: any = undefined;
        if (detail && detail.studentAnswer !== undefined && detail.studentAnswer !== null) {
          studentAns = detail.studentAnswer;
        } else if (answersMap[q.id] !== undefined) {
          studentAns = answersMap[q.id];
        } else if (detail?.questionId && answersMap[detail.questionId] !== undefined) {
          studentAns = answersMap[detail.questionId];
        }

        const isAnswered =
          studentAns !== undefined && studentAns !== null && String(studentAns).trim() !== '';

        // 2. Correct answer text resolution from authoritative current quiz question
        const currentCorrectText = resolveQuestionCorrectText(q);
        const resolvedCorrectText =
          currentCorrectText ||
          (detail?.correctOptionText || detail?.correctAnswer) ||
          String(q.correctAnswer ?? '');

        // 3. Evaluation
        let isCorrect = false;
        if (detail && typeof detail.isCorrect === 'boolean') {
          isCorrect = detail.isCorrect;
        } else if (isAnswered) {
          isCorrect = checkAnswerCorrectness(q, studentAns);
        }

        // 4. Student answer representation
        let studentAnsText = '';
        if (!isAnswered) {
          studentAnsText = 'لم يُجب الطالب على هذا السؤال';
        } else if (isTrueFalseQuestion(q)) {
          const sStr = String(studentAns).trim().toLowerCase();
          if (sStr === '0' || sStr === 'true' || sStr === 'صح' || sStr === 'صحيح' || sStr === 'صواب') {
            studentAnsText = 'صحيح (صح)';
          } else if (sStr === '1' || sStr === 'false' || sStr === 'خطأ' || sStr === 'خاطئ') {
            studentAnsText = 'خطأ (خاطئ)';
          } else {
            studentAnsText = String(studentAns);
          }
        } else if (Array.isArray(q.options) && q.options.length > 0) {
          const parsedIdx = parseInt(String(studentAns).trim(), 10);
          if (
            !isNaN(parsedIdx) &&
            String(parsedIdx) === String(studentAns).trim() &&
            parsedIdx >= 0 &&
            parsedIdx < q.options.length
          ) {
            studentAnsText = String(q.options[parsedIdx]);
          } else {
            studentAnsText = String(studentAns);
          }
        } else {
          studentAnsText = String(studentAns);
        }

        // Check if there was a discrepancy between past recorded evaluation and current answer key
        const currentModelEvaluation = isAnswered ? checkAnswerCorrectness(q, studentAns) : false;
        const hasMismatchWithBank =
          detail && typeof detail.isCorrect === 'boolean' && detail.isCorrect !== currentModelEvaluation;

        items.push({
          id: q.id || `q-${idx}`,
          number: idx + 1,
          text: q.text,
          type: q.type,
          points: typeof q.points === 'number' && q.points > 0 ? q.points : 1,
          options: q.options || [],
          studentAnswer: studentAns,
          studentAnswerText: studentAnsText,
          correctAnswerText: resolvedCorrectText,
          isCorrect,
          isAnswered,
          hasMismatchWithBank,
        });
      });
    } else if (detailedList.length > 0) {
      // Fallback directly to detailedList if quiz structure isn't in quizzes state
      detailedList.forEach((detail, idx) => {
        const studentAns = detail.studentAnswer;
        const isAnswered =
          studentAns !== undefined && studentAns !== null && String(studentAns).trim() !== '';
        const correctText = String(
          detail.correctOptionText || detail.correctAnswer || 'غير محدد'
        );

        let studentAnsText = '';
        if (!isAnswered) {
          studentAnsText = 'لم يُجب الطالب على هذا السؤال';
        } else {
          studentAnsText = String(studentAns);
        }

        items.push({
          id: detail.questionId || detail.id || `det-${idx}`,
          number: idx + 1,
          text: detail.text || `السؤال رقم ${idx + 1}`,
          type: detail.type || 'multiple_choice',
          points: typeof detail.points === 'number' && detail.points > 0 ? detail.points : 1,
          options: Array.isArray(detail.options) ? detail.options : [],
          studentAnswer: studentAns,
          studentAnswerText: studentAnsText,
          correctAnswerText: correctText,
          isCorrect: Boolean(detail.isCorrect),
          isAnswered,
          hasMismatchWithBank: false,
        });
      });
    }

    return items;
  }, [targetQuiz, grade, archivedSubmission]);

  // Filtered items based on user selection and search
  const filteredItems = useMemo(() => {
    return reviewItems.filter((item) => {
      // Filter tab
      if (filterType === 'correct' && !item.isCorrect) return false;
      if (filterType === 'wrong' && (item.isCorrect || !item.isAnswered)) return false;
      if (filterType === 'unanswered' && item.isAnswered) return false;

      // Search query
      if (searchQuery.trim()) {
        const qNorm = normalizeArabicText(searchQuery);
        const textNorm = normalizeArabicText(item.text);
        const ansNorm = normalizeArabicText(item.studentAnswerText);
        const corrNorm = normalizeArabicText(item.correctAnswerText);
        return (
          textNorm.includes(qNorm) ||
          ansNorm.includes(qNorm) ||
          corrNorm.includes(qNorm) ||
          String(item.number).includes(qNorm)
        );
      }

      return true;
    });
  }, [reviewItems, filterType, searchQuery]);

  // Aggregate stats
  const totalQuestions = reviewItems.length;
  const correctCount = reviewItems.filter((item) => item.isCorrect).length;
  const wrongCount = reviewItems.filter((item) => item.isAnswered && !item.isCorrect).length;
  const unansweredCount = reviewItems.filter((item) => !item.isAnswered).length;
  const earnedScore = reviewItems.reduce(
    (acc, curr) => (curr.isCorrect ? acc + curr.points : acc),
    0
  );
  const totalPossiblePoints = reviewItems.reduce((acc, curr) => acc + curr.points, 0) || grade.maxScore || 10;
  const accuracyPct = Math.round((earnedScore / (totalPossiblePoints || 1)) * 100);

  const handleTriggerRegrade = async () => {
    if (!onRegrade) return;
    try {
      setIsRegrading(true);
      await onRegrade(student.id, grade.quizTitle);
    } catch (err) {
      console.error('Error regrading from review modal:', err);
    } finally {
      setIsRegrading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/70 z-50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200"
          dir="rtl"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 via-white to-slate-50 flex flex-wrap justify-between items-center gap-4 text-right">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                <FileCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-slate-850 text-base sm:text-lg">
                    نموذج الإجابة ومقارنة حل الطالب
                  </h3>
                  <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg bg-indigo-100/70 text-indigo-800 border border-indigo-200">
                    {grade.quizTitle}
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-4 text-xs text-slate-500 mt-1 flex-wrap font-sans">
                  <span>الطالب: <strong className="text-slate-800 font-sans">{student.name}</strong></span>
                  <span className="hidden sm:inline text-slate-300">•</span>
                  <span>الصف: <strong className="text-slate-700">{student.gradeClass || `${student.grade || ''} - ${student.semester || ''}`}</strong></span>
                  <span className="hidden sm:inline text-slate-300">•</span>
                  <span>تاريخ التسليم: <strong className="text-slate-700 font-mono">{grade.date}</strong></span>
                </div>
              </div>
            </div>

            {/* Actions in header */}
            <div className="flex items-center gap-2 mr-auto">
              {onRegrade && (
                <button
                  type="button"
                  onClick={handleTriggerRegrade}
                  disabled={isRegrading}
                  className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer active:scale-95 disabled:opacity-50"
                  title="إعادة تصحيح هذا الاختبار للطالب تلقائياً وفق نموذج الإجابات وتوزيع الدرجات الحالي"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${isRegrading ? 'animate-spin' : ''}`} />
                  <span>{isRegrading ? 'جاري التصحيح...' : 'إعادة تصحيح الاختبار'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer active:scale-95"
                title="طباعة نموذج إجابة الطالب"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>طباعة</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-200/80 rounded-full transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
                title="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Analytics & Score Summary Banner */}
          <div className="bg-slate-50/80 px-5 sm:px-6 py-3.5 border-b border-slate-100 grid grid-cols-2 sm:grid-cols-5 gap-3 text-right">
            {/* Score Card */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/70 shadow-3xs col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">درجة الطالب</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-indigo-700 font-sans">{grade.score}</span>
                <span className="text-xs text-slate-400 font-bold font-sans">/ {grade.maxScore || totalPossiblePoints}</span>
                <span className={`text-[11px] font-black mr-auto px-1.5 py-0.5 rounded-md ${accuracyPct >= 60 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {accuracyPct}%
                </span>
              </div>
            </div>

            {/* Total Questions */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/70 shadow-3xs">
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">إجمالي الأسئلة</span>
              <div className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
                <span className="text-base font-black text-slate-800 font-sans">{totalQuestions}</span>
                <span className="text-[10px] text-slate-400">سؤال</span>
              </div>
            </div>

            {/* Correct Answers */}
            <div className="bg-white p-3 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-3xs">
              <span className="text-[10px] font-bold text-emerald-700 block mb-0.5">إجابات صحيحة</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-base font-black text-emerald-700 font-sans">{correctCount}</span>
                <span className="text-[10px] text-emerald-600">({totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0}%)</span>
              </div>
            </div>

            {/* Wrong Answers */}
            <div className="bg-white p-3 rounded-2xl border border-rose-100 bg-rose-50/20 shadow-3xs">
              <span className="text-[10px] font-bold text-rose-700 block mb-0.5">إجابات خاطئة</span>
              <div className="flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="text-base font-black text-rose-700 font-sans">{wrongCount}</span>
                <span className="text-[10px] text-rose-600">({totalQuestions > 0 ? Math.round((wrongCount / totalQuestions) * 100) : 0}%)</span>
              </div>
            </div>

            {/* Unanswered / Status */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200/70 shadow-3xs">
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">النتيجة النهائية</span>
              <div>
                {grade.passed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    <Award className="w-3.5 h-3.5" />
                    تم الاجتياز بنجاح
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    يحتاج إلى متابعة
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Filtering and Search Toolbar */}
          <div className="px-5 sm:px-6 py-3 border-b border-slate-100 bg-white flex flex-wrap items-center justify-between gap-3 text-right">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-white text-indigo-900 shadow-3xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل ({totalQuestions})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('correct')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  filterType === 'correct'
                    ? 'bg-emerald-600 text-white shadow-3xs font-black'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>الصحيحة ({correctCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType('wrong')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  filterType === 'wrong'
                    ? 'bg-rose-600 text-white shadow-3xs font-black'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>الخاطئة ({wrongCount})</span>
              </button>
              {unansweredCount > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterType('unanswered')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                    filterType === 'unanswered'
                      ? 'bg-amber-600 text-white shadow-3xs font-black'
                      : 'text-slate-600 hover:text-amber-700'
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>المتروكة ({unansweredCount})</span>
                </button>
              )}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث في نص السؤال أو الإجابة..."
                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:bg-white rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-sans"
              />
            </div>
          </div>

          {/* Questions Review List (Scrollable Area) */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/40">
            {isLoadingArchive && (
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-center text-xs font-bold text-indigo-800 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                <span>جاري استرجاع التفاصيل الكاملة لإجابات الطالب من الأرشيف السحابي...</span>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div className="p-10 text-center space-y-3 bg-white rounded-2xl border border-slate-200">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Filter className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-700 text-sm">لا توجد أسئلة تطابق الفرز الحالي</h4>
                <p className="text-xs text-slate-400">
                  يمكنك تعديل التبويب أو حذف كلمة البحث لعرض كافة أسئلة الاختبار.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isTf = item.type === 'true_false' || isTrueFalseQuestion({ type: item.type, options: item.options });

                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border transition-all p-4 sm:p-5 bg-white shadow-3xs ${
                      item.isCorrect
                        ? 'border-emerald-200 bg-emerald-50/10'
                        : !item.isAnswered
                        ? 'border-amber-200 bg-amber-50/10'
                        : 'border-rose-200 bg-rose-50/10'
                    }`}
                  >
                    {/* Question Top Meta */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-white text-xs font-black flex items-center justify-center font-mono">
                          {item.number}
                        </span>
                        <span className="text-xs font-extrabold text-slate-600">
                          {isTf ? 'صح وخطأ' : 'اختيار من متعدد'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-sans font-bold">
                          ({item.points} {item.points === 1 ? 'درجة' : 'درجات'})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.isCorrect ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl shadow-3xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>إجابة صحيحة (+{item.points})</span>
                          </span>
                        ) : !item.isAnswered ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl shadow-3xs">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <span>لم يجب الطالب (0)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-black text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl shadow-3xs">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            <span>إجابة غير صحيحة (0)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Question Text */}
                    <div className="py-3 text-slate-850 font-extrabold text-sm sm:text-base leading-relaxed">
                      {item.text}
                    </div>

                    {/* Side-by-Side Comparison Blocks */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {/* Student's Answer Box */}
                      <div
                        className={`p-3.5 rounded-xl border ${
                          item.isCorrect
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                            : !item.isAnswered
                            ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                            : 'bg-rose-50/60 border-rose-200 text-rose-950'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[11px] font-black flex items-center gap-1">
                            {item.isCorrect ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            ) : !item.isAnswered ? (
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                            )}
                            <span>إجابة الطالب:</span>
                          </span>
                          <span className="text-[10px] font-sans font-bold opacity-80">
                            {item.isCorrect ? 'محتسبة كاملة' : '0 من ' + item.points}
                          </span>
                        </div>
                        <div className="font-bold text-xs sm:text-sm font-sans pr-4">
                          {item.studentAnswerText || 'لا توجد إجابة'}
                        </div>
                      </div>

                      {/* Official Model Answer Key Box */}
                      <div className="p-3.5 rounded-xl border bg-indigo-50/60 border-indigo-200 text-indigo-950">
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[11px] font-black text-indigo-850 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>نموذج الإجابة المعتمد (النموذج الصحيح):</span>
                          </span>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/80 px-1.5 py-0.5 rounded-md">
                            معتمد
                          </span>
                        </div>
                        <div className="font-bold text-xs sm:text-sm font-sans pr-4 text-indigo-900">
                          {item.correctAnswerText || 'غير محدد'}
                        </div>
                      </div>
                    </div>

                    {/* Option Details Breakdown for Multiple Choice & TF */}
                    {item.options && item.options.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 block mb-2">
                          خيارات السؤال وتحديد اختيار الطالب ونموذج الإجابة:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {item.options.map((optText, optIdx) => {
                            const optStr = String(optText).trim();
                            const normOpt = normalizeArabicText(optStr);
                            const normCorrect = normalizeArabicText(item.correctAnswerText);
                            const normStudent = normalizeArabicText(item.studentAnswerText);

                            const isCorrectOpt =
                              normOpt === normCorrect ||
                              optStr === item.correctAnswerText ||
                              String(optIdx) === String(item.correctAnswerText).trim();

                            const isStudentSelected =
                              item.isAnswered &&
                              (normOpt === normStudent ||
                                optStr === item.studentAnswerText ||
                                String(optIdx) === String(item.studentAnswer).trim() ||
                                String(optText).trim() === String(item.studentAnswer).trim());

                            let cardClass = 'bg-slate-50/60 border-slate-200 text-slate-700';
                            if (isCorrectOpt && isStudentSelected) {
                              cardClass = 'bg-emerald-100/70 border-emerald-300 text-emerald-950 font-black';
                            } else if (isCorrectOpt) {
                              cardClass = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold';
                            } else if (isStudentSelected) {
                              cardClass = 'bg-rose-50 border-rose-300 text-rose-950 font-bold';
                            }

                            return (
                              <div
                                key={optIdx}
                                className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${cardClass}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-md bg-white border border-slate-200 font-bold text-[10px] flex items-center justify-center text-slate-600 shrink-0 font-mono">
                                    {String.fromCharCode(65 + optIdx)}
                                  </span>
                                  <span>{optStr}</span>
                                </div>

                                <div className="flex items-center gap-1 text-[10px] font-extrabold shrink-0">
                                  {isCorrectOpt && (
                                    <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-3xs">
                                      <CheckCircle2 className="w-3 h-3" />
                                      نموذج الإجابة
                                    </span>
                                  )}
                                  {isStudentSelected && !isCorrectOpt && (
                                    <span className="bg-rose-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-3xs">
                                      <XCircle className="w-3 h-3" />
                                      اختيار الطالب
                                    </span>
                                  )}
                                  {isStudentSelected && isCorrectOpt && (
                                    <span className="bg-emerald-700 text-white px-2 py-0.5 rounded-md flex items-center gap-1 shadow-3xs">
                                      اختيار الطالب ✓
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Mismatch Alert with Question Bank Notice */}
                    {item.hasMismatchWithBank && (
                      <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-center gap-2">
                        <Info className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          ملاحظة: تم رصد تحديث في نموذج الإجابة أو توزيع درجات هذا السؤال في بنك الأسئلة بعد تسليم الطالب. اضغط على زر "إعادة تصحيح الاختبار" لتحديث درجة الطالب فوراً.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex flex-wrap justify-between items-center gap-3 text-right">
            <div className="text-xs text-slate-500 font-bold font-sans">
              عرض نموذج الإجابة للاختبار معتمد رسمياً لمقارنة الإجابات وتدقيق نتائج الطلاب.
            </div>

            <div className="flex items-center gap-2 mr-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 hover:bg-slate-200 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
