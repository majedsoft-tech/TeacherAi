import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, Award, CheckCircle2, Calendar, Star, GraduationCap } from 'lucide-react';
import { Student } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
}

export const StudentCertificateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  student,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const getAppreciationText = (score: number) => {
    if (score >= 90) return 'بتقدير ممتاز مع مرتبة الشرف والتفوق الدراسي';
    if (score >= 75) return 'بتقدير جيد جداً مع التمنيات بمزيد من التفوق';
    if (score >= 60) return 'بتقدير جيد مع اجتياز التقييمات بنجاح';
    return 'مع التوجيه بمواصلة الجد والاجتهاد والتحصيل العلمي';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/70 z-50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto print:p-0 print:bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 print:shadow-none print:border-none print:max-h-full print:w-full"
          dir="rtl"
        >
          {/* Header Controls (Hidden during print) */}
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center print:hidden">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              <span className="font-extrabold text-sm text-slate-800">
                شهادة إتمام وتفوق دراسي معتمدة
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer active:scale-95"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة الشهادة الرسمية</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Certificate Content - Print Optimized */}
          <div className="p-8 sm:p-12 overflow-y-auto flex-1 flex flex-col items-center text-center relative bg-gradient-to-b from-amber-50/20 via-white to-indigo-50/20 border-8 border-double border-amber-300/80 m-4 rounded-2xl shadow-inner print:m-0 print:border-8 print:border-amber-400">
            {/* Corner Decorative Ornaments */}
            <div className="absolute top-3 right-3 text-amber-500/40 select-none text-2xl font-serif">
              ❖
            </div>
            <div className="absolute top-3 left-3 text-amber-500/40 select-none text-2xl font-serif">
              ❖
            </div>
            <div className="absolute bottom-3 right-3 text-amber-500/40 select-none text-2xl font-serif">
              ❖
            </div>
            <div className="absolute bottom-3 left-3 text-amber-500/40 select-none text-2xl font-serif">
              ❖
            </div>

            {/* School Header */}
            <div className="space-y-1 mb-6">
              <div className="w-12 h-12 rounded-full bg-amber-500 text-white flex items-center justify-center mx-auto shadow-md shadow-amber-200 mb-2">
                <GraduationCap className="w-7 h-7" />
              </div>
              <h4 className="text-xs font-black tracking-widest text-slate-500 uppercase">
                المملكة العربية السعودية • وزارة التعليم
              </h4>
              <h2 className="text-xl sm:text-2xl font-black text-amber-900 font-serif pt-1">
                شهادة شكر وتقدير واجتياز دراسي
              </h2>
            </div>

            {/* Certificate Body */}
            <div className="max-w-xl mx-auto space-y-4 my-auto">
              <p className="text-slate-600 text-sm leading-relaxed">
                يسر إدارة المدرسة ومعلم المادة منح هذه الشهادة للطالب المتميز:
              </p>

              <div className="py-2 px-6 bg-amber-50/80 border-y-2 border-amber-200 rounded-xl inline-block shadow-3xs">
                <h1 className="text-xl sm:text-2xl font-black text-indigo-950 font-serif">
                  {student.name}
                </h1>
              </div>

              <p className="text-slate-600 text-sm leading-relaxed">
                المقيد بالصف: <strong className="text-slate-900 font-bold">{student.gradeClass || `${student.grade || ''} - ${student.semester || ''}`}</strong>
              </p>

              <p className="text-slate-700 text-sm leading-relaxed">
                وذلك تقديراً لاجتيازه الاختبارات والتقييمات المدرسية بنجاح بنسبة إنجاز:
              </p>

              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-black text-emerald-700 font-sans">
                  {student.averageScore}%
                </span>
                <span className="text-sm font-extrabold text-slate-600">
                  ({getAppreciationText(student.averageScore)})
                </span>
              </div>

              {/* Quizzes Summary */}
              {Array.isArray(student.detailedGrades) && student.detailedGrades.length > 0 && (
                <div className="pt-4 max-w-md mx-auto">
                  <div className="text-[11px] font-bold text-slate-400 mb-2">
                    كشف الاختبارات المعتمدة في هذه الشهادة:
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-right font-sans text-xs">
                    {student.detailedGrades.map((g, idx) => (
                      <div
                        key={idx}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white/80 flex items-center justify-between gap-1 shadow-3xs"
                      >
                        <span className="truncate font-bold text-slate-700 text-[11px]">
                          {g.quizTitle}
                        </span>
                        <span className="font-mono font-extrabold text-indigo-700 text-[11px] shrink-0">
                          {g.score}/{g.maxScore}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Official Signatures & Seal */}
            <div className="w-full grid grid-cols-2 pt-8 mt-6 border-t border-slate-200/80 text-xs font-bold text-slate-600">
              <div className="space-y-1">
                <span>معلم المادة</span>
                <div className="h-10 flex items-center justify-center font-serif text-slate-400 text-xs italic">
                  معتمد إلكترونياً
                </div>
              </div>

              <div className="space-y-1">
                <span>ختم الاعتماد والتاريخ</span>
                <div className="h-10 flex items-center justify-center font-sans text-slate-500 text-xs font-mono">
                  {new Date().toLocaleDateString('ar-SA')}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
