import React, { useRef } from "react";
import {
  Check,
  RotateCcw,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface BankQuestionItem {
  stage?: string;
  grade?: string;
  semester?: string;
  subject?: string;
  unit?: string;
  lesson?: string;
}

interface QuestionBankSmartFiltersProps {
  questions: BankQuestionItem[];
  stage: string;
  setStage: (val: string) => void;
  grade: string;
  setGrade: (val: string) => void;
  semester: string;
  setSemester: (val: string) => void;
  subject: string;
  setSubject: (val: string) => void;
  setUnit?: (val: string) => void;
  setLesson?: (val: string) => void;
  search: string;
  setSearch: (val: string) => void;
  nextStepRef?: React.RefObject<HTMLDivElement | null>;
}

export const QuestionBankSmartFilters: React.FC<QuestionBankSmartFiltersProps> = ({
  questions,
  stage,
  setStage,
  grade,
  setGrade,
  semester,
  setSemester,
  subject,
  setSubject,
  setUnit,
  setLesson,
  search,
  setSearch,
  nextStepRef,
}) => {
  // Section Refs for smooth scrolling
  const stageSectionRef = useRef<HTMLDivElement>(null);
  const gradeSectionRef = useRef<HTMLDivElement>(null);
  const semesterSectionRef = useRef<HTMLDivElement>(null);
  const subjectSectionRef = useRef<HTMLDivElement>(null);

  // Derive options lists dynamically based on selections
  const stagesList = Array.from(new Set(questions.map((q) => q.stage)))
    .filter(Boolean)
    .sort() as string[];

  const gradesList = Array.from(
    new Set(
      questions
        .filter((q) => stage === "all" || q.stage === stage)
        .map((q) => q.grade)
    )
  )
    .filter(Boolean)
    .sort() as string[];

  const semestersList = Array.from(
    new Set(
      questions
        .filter(
          (q) =>
            (stage === "all" || q.stage === stage) &&
            (grade === "all" || q.grade === grade)
        )
        .map((q) => q.semester)
    )
  )
    .filter(Boolean)
    .sort() as string[];

  const subjectsList = Array.from(
    new Set(
      questions
        .filter(
          (q) =>
            (stage === "all" || q.stage === stage) &&
            (grade === "all" || q.grade === grade) &&
            (semester === "all" || q.semester === semester)
        )
        .map((q) => q.subject)
    )
  )
    .filter(Boolean)
    .sort() as string[];

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      if (ref.current) {
        ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 150);
  };

  // Helper function to scale down text font size if the label is long
  const getDynamicTextClass = (text: string) => {
    if (text.length > 22) {
      return "text-[10px] sm:text-xs font-black leading-tight line-clamp-2 break-words";
    }
    if (text.length > 13) {
      return "text-[11px] sm:text-xs font-black leading-snug line-clamp-2 break-words";
    }
    return "text-xs sm:text-sm font-black truncate";
  };

  // Handlers with automatic smooth scroll to next step
  const handleSelectStage = (val: string) => {
    setStage(val);
    setGrade("all");
    setSemester("all");
    setSubject("all");
    if (setUnit) setUnit("all");
    if (setLesson) setLesson("all");
    scrollToRef(gradeSectionRef);
  };

  const handleSelectGrade = (val: string) => {
    setGrade(val);
    setSemester("all");
    setSubject("all");
    if (setUnit) setUnit("all");
    if (setLesson) setLesson("all");
    scrollToRef(semesterSectionRef);
  };

  const handleSelectSemester = (val: string) => {
    setSemester(val);
    setSubject("all");
    if (setUnit) setUnit("all");
    if (setLesson) setLesson("all");
    scrollToRef(subjectSectionRef);
  };

  const handleSelectSubject = (val: string) => {
    setSubject(val);
    if (setUnit) setUnit("all");
    if (setLesson) setLesson("all");
    setTimeout(() => {
      if (nextStepRef?.current) {
        nextStepRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        const nextElem = document.getElementById("unit-lesson-multiselect-section");
        if (nextElem) {
          nextElem.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    }, 150);
  };

  const handleResetFilters = () => {
    setStage("all");
    setGrade("all");
    setSemester("all");
    setSubject("all");
    if (setUnit) setUnit("all");
    if (setLesson) setLesson("all");
    setSearch("");
    scrollToRef(stageSectionRef);
  };

  const isStageSelected = stage !== "all";
  const isGradeSelected = grade !== "all";
  const isSemesterSelected = semester !== "all";

  // Active step indicators for pulsing ring effect
  const isStep1Active = stage === "all";
  const isStep2Active = isStageSelected && grade === "all";
  const isStep3Active = isGradeSelected && semester === "all";
  const isStep4Active = isSemesterSelected && subject === "all";

  return (
    <div className="space-y-4 bg-slate-100/70 p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-xs dir-rtl">
      {/* Reset Bar */}
      {isStageSelected && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleResetFilters}
            className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-2xl transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة ضبط الفلاتر</span>
          </button>
        </div>
      )}

      {/* SECTION 1: STAGE SELECTION CARD GRID */}
      <div
        ref={stageSectionRef}
        className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3.5 transition-all duration-300 scroll-mt-6 ${
          isStep1Active
            ? "border-indigo-500 ring-4 ring-indigo-500/30 shadow-md animate-pulse"
            : "border-slate-200/90"
        }`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏫</span>
            <h4 className="text-sm sm:text-base font-black text-slate-800">
              اختر المرحلة الدراسية
            </h4>
          </div>
          {stage !== "all" && (
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              {stage}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {stagesList.map((stg) => {
            const isSelected = stage === stg;
            return (
              <button
                key={stg}
                type="button"
                onClick={() => handleSelectStage(stg)}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 text-right flex items-center justify-between cursor-pointer min-h-[64px] ${
                  isSelected
                    ? "border-2 border-indigo-600 bg-indigo-50/70 text-indigo-950 font-black shadow-xs ring-2 ring-indigo-400/20"
                    : isStep1Active
                    ? "border-indigo-300 bg-white text-slate-800 font-bold hover:border-indigo-500 hover:bg-indigo-50/50 shadow-xs"
                    : "border-slate-200 bg-white text-slate-700 font-bold hover:border-indigo-300 hover:bg-slate-50/70"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-2">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-indigo-50/80 text-indigo-600 border border-indigo-100"
                    }`}
                  >
                    <span className="text-base">🏫</span>
                  </div>
                  <span className={getDynamicTextClass(stg)}>{stg}</span>
                </div>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mr-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: GRADE / TRACK SELECTION GRID */}
      <AnimatePresence>
        {isStageSelected && (
          <motion.div
            ref={gradeSectionRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3.5 transition-all duration-300 scroll-mt-6 ${
              isStep2Active
                ? "border-indigo-500 ring-4 ring-indigo-500/30 shadow-md animate-pulse"
                : "border-slate-200/90"
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛣️</span>
                <h4 className="text-sm sm:text-base font-black text-slate-800">
                  اختر الصف / المسار الدراسي
                </h4>
              </div>
              {grade !== "all" && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {grade}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {gradesList.map((grd) => {
                const isSelected = grade === grd;
                return (
                  <button
                    key={grd}
                    type="button"
                    onClick={() => handleSelectGrade(grd)}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 text-right flex items-center justify-between cursor-pointer min-h-[64px] ${
                      isSelected
                        ? "border-2 border-indigo-600 bg-indigo-50/70 text-indigo-950 font-black shadow-xs ring-2 ring-indigo-400/20"
                        : isStep2Active
                        ? "border-indigo-300 bg-white text-slate-800 font-bold hover:border-indigo-500 hover:bg-indigo-50/50 shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 font-bold hover:border-indigo-300 hover:bg-slate-50/70"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-sky-50 text-sky-600 border border-sky-100"
                        }`}
                      >
                        <span className="text-base">🛣️</span>
                      </div>
                      <span className={getDynamicTextClass(grd)}>{grd}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mr-1" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 3: SEMESTER SELECTION GRID */}
      <AnimatePresence>
        {isGradeSelected && (
          <motion.div
            ref={semesterSectionRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3.5 transition-all duration-300 scroll-mt-6 ${
              isStep3Active
                ? "border-indigo-500 ring-4 ring-indigo-500/30 shadow-md animate-pulse"
                : "border-slate-200/90"
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">📖</span>
                <h4 className="text-sm sm:text-base font-black text-slate-800">
                  اختر الفصل الدراسي
                </h4>
              </div>
              {semester !== "all" && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {semester}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {semestersList.map((sem) => {
                const isSelected = semester === sem;
                return (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => handleSelectSemester(sem)}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 text-right flex items-center justify-between cursor-pointer min-h-[64px] ${
                      isSelected
                        ? "border-2 border-indigo-600 bg-indigo-50/70 text-indigo-950 font-black shadow-xs ring-2 ring-indigo-400/20"
                        : isStep3Active
                        ? "border-indigo-300 bg-white text-slate-800 font-bold hover:border-indigo-500 hover:bg-indigo-50/50 shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 font-bold hover:border-indigo-300 hover:bg-slate-50/70"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-amber-50 text-amber-600 border border-amber-100"
                        }`}
                      >
                        <span className="text-base">📖</span>
                      </div>
                      <span className={getDynamicTextClass(sem)}>{sem}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mr-1" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 4: SUBJECT SELECTION GRID */}
      <AnimatePresence>
        {isSemesterSelected && (
          <motion.div
            ref={subjectSectionRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`bg-white rounded-2xl border p-4 sm:p-5 shadow-xs space-y-3.5 transition-all duration-300 scroll-mt-6 ${
              isStep4Active
                ? "border-indigo-500 ring-4 ring-indigo-500/30 shadow-md animate-pulse"
                : "border-slate-200/90"
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">📚</span>
                <h4 className="text-sm sm:text-base font-black text-slate-800">
                  اختر المادة الدراسية
                </h4>
              </div>
              {subject !== "all" && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  {subject}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {subjectsList.map((sbj) => {
                const isSelected = subject === sbj;
                return (
                  <button
                    key={sbj}
                    type="button"
                    onClick={() => handleSelectSubject(sbj)}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all duration-200 text-right flex items-center justify-between cursor-pointer min-h-[64px] ${
                      isSelected
                        ? "border-2 border-indigo-600 bg-indigo-50/70 text-indigo-950 font-black shadow-xs ring-2 ring-indigo-400/20"
                        : isStep4Active
                        ? "border-indigo-300 bg-white text-slate-800 font-bold hover:border-indigo-500 hover:bg-indigo-50/50 shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 font-bold hover:border-indigo-300 hover:bg-slate-50/70"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pl-2">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                        }`}
                      >
                        <span className="text-base">📚</span>
                      </div>
                      <span className={getDynamicTextClass(sbj)}>{sbj}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mr-1" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
