import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, 
  Eye, 
  EyeOff, 
  Search, 
  Sparkles, 
  Check, 
  X, 
  RefreshCw, 
  Settings, 
  Info,
  Database,
  Trophy,
  Users,
  Layers,
  Activity,
  RotateCcw,
  Maximize2,
  Minimize2,
  HelpCircle,
  BarChart3,
  Target,
  TrendingUp,
  CheckCircle2
} from "lucide-react";
import { doc, onSnapshot, setDoc, collection } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { PRELOADED_SUBJECTS } from "./StudentCurriculumReview";
import { BankQuestion, Student } from "../types";

interface CurriculumReviewAdminTabProps {
  currentUser: any;
  bankQuestions: BankQuestion[];
  students: Student[];
  grades: string[];
  triggerToast: (msg: string, type: "success" | "error" | "info" | "warning") => void;
}

export default function CurriculumReviewAdminTab({
  currentUser,
  bankQuestions,
  students = [],
  grades = [],
  triggerToast
}: CurriculumReviewAdminTabProps) {
  // Current Tab selection
  const [activeSubTab, setActiveSubTab] = useState<"settings" | "results">("results");

  // State for Subject Visibility Settings
  const [visibleSubjects, setVisibleSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // State for Results Sheet
  const [studentScores, setStudentScores] = useState<Record<string, any>>({});
  const [scoresLoading, setScoresLoading] = useState<boolean>(true);

  // States for resetting scores with beautiful custom dialogs
  const [resetModal, setResetModal] = useState<{
    targetGrade: string;
    targetClass: string;
    description: string;
    studentCount: number;
  } | null>(null);

  const [resetProgress, setResetProgress] = useState<{
    total: number;
    current: number;
    studentName: string;
  } | null>(null);
  
  // Filters for results matrix
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>("الكل");
  const [selectedClass, setSelectedClass] = useState<string>("الكل");

  // States for full screen and compact table layout
  const [isFullScreenResults, setIsFullScreenResults] = useState<boolean>(false);
  const [tableDensity, setTableDensity] = useState<"ultra-compact" | "compact" | "normal">("normal");
  const [showFilters, setShowFilters] = useState<boolean>(true);

  // Load visible subjects from Firestore
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    setLoading(true);
    const ref = doc(db, "curriculum_settings", currentUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setVisibleSubjects(data.visibleSubjects || []);
      } else {
        setVisibleSubjects([]); // Default is empty array (all hidden by default)
      }
      setLoading(false);
    }, (error) => {
      console.error("Failed to fetch curriculum settings:", error);
      triggerToast("خطأ أثناء جلب إعدادات المراجعة الشاملة", "error");
      setLoading(false);
    });

    return unsub;
  }, [currentUser?.uid]);

  // Load student curriculum scores in real-time
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    setScoresLoading(true);
    const ref = collection(db, "student_curriculum_scores");
    const unsub = onSnapshot(ref, (snap) => {
      const data: Record<string, any> = {};
      snap.forEach((doc) => {
        data[doc.id] = doc.data();
      });
      setStudentScores(data);
      setScoresLoading(false);
    }, (error) => {
      console.error("Failed to fetch student curriculum scores:", error);
      setScoresLoading(false);
    });

    return unsub;
  }, [currentUser?.uid]);

  // Aggregate all custom subjects strictly from Bank Questions (exclude preloaded)
  const allSubjects = useMemo(() => {
    const subjectsMap: Record<string, { 
      name: string; 
      isPreloaded: boolean; 
      units: Set<string>; 
      lessons: Set<string>; 
    }> = {};

    bankQuestions.forEach((q) => {
      const subName = q.subject;
      if (!subName) return;
      
      const unitName = q.unit || "عام";
      const lessonName = q.lesson || "عام";

      if (!subjectsMap[subName]) {
        subjectsMap[subName] = {
          name: subName,
          isPreloaded: false,
          units: new Set(),
          lessons: new Set()
        };
      }

      subjectsMap[subName].units.add(unitName);
      subjectsMap[subName].lessons.add(`${unitName}-${lessonName}`);
    });

    return Object.values(subjectsMap).map((sub) => ({
      name: sub.name,
      isPreloaded: false,
      unitCount: sub.units.size,
      lessonCount: sub.lessons.size
    }));
  }, [bankQuestions]);

  // Filter allSubjects to keep only those that are toggled on (visible)
  const visibleSubjectsList = useMemo(() => {
    return allSubjects.filter((sub) => visibleSubjects.includes(sub.name));
  }, [allSubjects, visibleSubjects]);

  // Set initial selected subject for result matrix when subjects load
  useEffect(() => {
    if (visibleSubjectsList.length > 0) {
      if (!selectedSubject || !visibleSubjects.includes(selectedSubject)) {
        setSelectedSubject(visibleSubjectsList[0].name);
      }
    } else {
      setSelectedSubject(null);
    }
  }, [visibleSubjectsList, selectedSubject, visibleSubjects]);

  // Extract unique grades list from students
  const availableGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.grade) set.add(s.grade);
    });
    // Fallback to grades prop if student records have no explicit grade strings
    if (set.size === 0 && grades) {
      grades.forEach((g) => {
        if (g) set.add(g);
      });
    }
    return Array.from(set);
  }, [students, grades]);

  // Extract unique classes/sections based on selected grade
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      const matchGrade = selectedGrade === "الكل" || s.grade === selectedGrade;
      if (s.gradeClass && matchGrade) {
        set.add(s.gradeClass);
      }
    });
    return Array.from(set).sort();
  }, [students, selectedGrade]);

  // Filter students to display in the matrix
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchGrade = selectedGrade === "الكل" || s.grade === selectedGrade;
      const matchClass = selectedClass === "الكل" || s.gradeClass === selectedClass;
      return matchGrade && matchClass;
    }).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [students, selectedGrade, selectedClass]);

  // Reset student grades / scores for the specified grade and class/section (triggers custom modal)
  const handleResetScores = (targetGrade: string, targetClass: string) => {
    // Find matching students
    const matchingStudents = students.filter((s) => {
      const matchGrade = targetGrade === "الكل" || s.grade === targetGrade;
      const matchClass = targetClass === "الكل" || s.gradeClass === targetClass;
      return matchGrade && matchClass;
    });

    if (matchingStudents.length === 0) {
      triggerToast("لا يوجد طلاب في التحديد المختار لتصفير درجاتهم", "warning");
      return;
    }

    let description = "";
    if (targetGrade === "الكل" && targetClass === "الكل") {
      description = "أنت على وشك تصفير درجات جميع الطلاب في جميع الصفوف والفصول لنتائج المراجعة الشاملة. لا يمكن التراجع عن هذا الإجراء.";
    } else if (targetClass === "الكل") {
      description = `أنت على وشك تصفير درجات جميع طلاب ${targetGrade === "الكل" ? "جميع الصفوف" : `الصف (${targetGrade})`} لنتائج المراجعة الشاملة.`;
    } else {
      description = `أنت على وشك تصفير درجات جميع طلاب ${targetGrade === "الكل" ? "" : `الصف (${targetGrade}) - `}فصل (${targetClass}) لنتائج المراجعة الشاملة.`;
    }

    setResetModal({
      targetGrade,
      targetClass,
      description,
      studentCount: matchingStudents.length
    });
  };

  // Perform the actual progressive reset with active visual percentage and student names
  const executeResetScores = async () => {
    if (!resetModal) return;
    const { targetGrade, targetClass } = resetModal;
    setResetModal(null); // close confirmation modal

    const matchingStudents = students.filter((s) => {
      const matchGrade = targetGrade === "الكل" || s.grade === targetGrade;
      const matchClass = targetClass === "الكل" || s.gradeClass === targetClass;
      return matchGrade && matchClass;
    });

    setResetProgress({
      total: matchingStudents.length,
      current: 0,
      studentName: matchingStudents[0]?.name || ""
    });

    try {
      let currentIdx = 0;
      for (const student of matchingStudents) {
        setResetProgress({
          total: matchingStudents.length,
          current: currentIdx,
          studentName: student.name
        });

        const ref = doc(db, "student_curriculum_scores", student.id);
        await setDoc(ref, {
          studentId: student.id,
          studentName: student.name,
          stats: {},
          lastUpdated: new Date().toISOString()
        }, { merge: true });

        // A small sleep to let the user visually perceive the progress loading screen
        await new Promise((resolve) => setTimeout(resolve, 100));
        currentIdx++;
      }

      setResetProgress({
        total: matchingStudents.length,
        current: matchingStudents.length,
        studentName: "اكتملت العملية بنجاح!"
      });

      triggerToast("تم تصفير درجات الطلاب المحددين بنجاح", "success");

      // Auto dismiss after 1.2s
      setTimeout(() => {
        setResetProgress(null);
      }, 1200);

    } catch (err) {
      console.error("Failed to reset scores:", err);
      triggerToast("حدث خطأ أثناء تصفير درجات الطلاب", "error");
      setResetProgress(null);
    }
  };

  // Build the complete units & lessons structure for the selected subject
  const activeSyllabus = useMemo(() => {
    if (!selectedSubject) return null;
    
    const unitsMap: Record<string, Record<string, Set<string>>> = {};

    bankQuestions.forEach((q) => {
      const subName = q.subject || "أخرى";
      if (subName !== selectedSubject) return;

      const unitName = q.unit || "عام";
      const lessonName = q.lesson || "عام";

      if (!unitsMap[unitName]) {
        unitsMap[unitName] = {};
      }
      if (!unitsMap[unitName][lessonName]) {
        unitsMap[unitName][lessonName] = new Set();
      }
      unitsMap[unitName][lessonName].add(q.id);
    });

    const unitsList = Object.keys(unitsMap).map((unitName) => {
      const lessonsList = Object.keys(unitsMap[unitName]).map((lessonName) => {
        return {
          name: lessonName,
          questionsCount: unitsMap[unitName][lessonName].size
        };
      });
      return {
        name: unitName,
        lessons: lessonsList
      };
    });

    return {
      name: selectedSubject,
      units: unitsList
    };
  }, [bankQuestions, selectedSubject]);

  // Flat lessons representing headers
  const flatLessons = useMemo(() => {
    if (!activeSyllabus) return [];
    const list: Array<{ unitName: string; lessonName: string; questionsCount: number }> = [];
    activeSyllabus.units.forEach((u) => {
      u.lessons.forEach((l) => {
        list.push({
          unitName: u.name,
          lessonName: l.name,
          questionsCount: l.questionsCount
        });
      });
    });
    return list;
  }, [activeSyllabus]);

  // Comprehensive progress and question count statistics for selected subject
  const progressStats = useMemo(() => {
    if (!selectedSubject || flatLessons.length === 0 || filteredStudents.length === 0) {
      return {
        totalQuestions: 0,
        totalUnits: 0,
        totalLessons: 0,
        completedStudentsCount: 0,
        inProgressStudentsCount: 0,
        notStartedStudentsCount: 0,
        totalSolvedLessons: 0,
        totalPossibleLessons: 0,
        overallProgressPercent: 0,
        perfectScoresCount: 0
      };
    }

    const totalQuestions = bankQuestions.filter(
      (q) => (q.subject || "أخرى") === selectedSubject
    ).length;

    const totalUnits = activeSyllabus?.units.length || 0;
    const totalLessons = flatLessons.length;
    const totalPossibleLessons = filteredStudents.length * totalLessons;

    let completedStudentsCount = 0;
    let inProgressStudentsCount = 0;
    let notStartedStudentsCount = 0;
    let totalSolvedLessons = 0;
    let perfectScoresCount = 0;

    filteredStudents.forEach((student) => {
      const sData = studentScores[student.id];
      const stats = sData?.stats || {};

      let studentSolved = 0;

      flatLessons.forEach((lesson) => {
        const statsKey = `${selectedSubject}_${lesson.unitName}_${lesson.lessonName}`;
        const stat = stats[statsKey];
        if (stat && stat.solved) {
          studentSolved++;
          totalSolvedLessons++;
          if (stat.score === stat.maxScore) {
            perfectScoresCount++;
          }
        }
      });

      if (studentSolved === totalLessons && totalLessons > 0) {
        completedStudentsCount++;
      } else if (studentSolved > 0) {
        inProgressStudentsCount++;
      } else {
        notStartedStudentsCount++;
      }
    });

    const overallProgressPercent = totalPossibleLessons > 0
      ? Math.round((totalSolvedLessons / totalPossibleLessons) * 100)
      : 0;

    return {
      totalQuestions,
      totalUnits,
      totalLessons,
      completedStudentsCount,
      inProgressStudentsCount,
      notStartedStudentsCount,
      totalSolvedLessons,
      totalPossibleLessons,
      overallProgressPercent,
      perfectScoresCount
    };
  }, [selectedSubject, flatLessons, activeSyllabus, filteredStudents, studentScores, bankQuestions]);

  // Dynamic table CSS classes depending on table density setting
  const tableClasses = useMemo(() => {
    switch (tableDensity) {
      case "ultra-compact":
        return {
          thUnit: "px-2 py-1.5 text-[10px]",
          thLesson: "px-1 py-1 text-[9px] min-w-[75px] max-w-[95px]",
          td: "px-1 py-1 text-[9px]",
          fontClass: "text-[9px]",
          badgeClass: "px-1.5 py-0.5 text-[8.5px] rounded-md",
          studentCell: "px-3 py-1 min-w-[130px] max-w-[150px]",
          studentName: "text-[10px]",
          studentMeta: "text-[8px]",
          numCell: "px-2 py-1 text-[10px] w-8",
          studentRight: "right-8",
          lessonTop: "top-[27px]"
        };
      case "compact":
        return {
          thUnit: "px-2.5 py-2 text-[10.5px]",
          thLesson: "px-1.5 py-1.5 text-[9.5px] min-w-[100px] max-w-[120px]",
          td: "px-1.5 py-1.5 text-[10px]",
          fontClass: "text-[10px]",
          badgeClass: "px-2 py-0.5 text-[9.5px] rounded-lg",
          studentCell: "px-4 py-2 min-w-[160px] max-w-[180px]",
          studentName: "text-xs",
          studentMeta: "text-[9px]",
          numCell: "px-3 py-2 text-xs w-10",
          studentRight: "right-10",
          lessonTop: "top-[33px]"
        };
      case "normal":
      default:
        return {
          thUnit: "px-3 py-3 text-[11px]",
          thLesson: "px-2 py-3 text-center text-[10px] min-w-[120px] max-w-[150px]",
          td: "px-2 py-3.5 text-center",
          fontClass: "text-[11px]",
          badgeClass: "px-2.5 py-1.5 text-[11px] rounded-lg",
          studentCell: "px-5 py-4 min-w-[200px] max-w-[240px]",
          studentName: "text-xs",
          studentMeta: "text-[9.5px]",
          numCell: "px-4 py-4 text-xs w-12",
          studentRight: "right-12",
          lessonTop: "top-[41px]"
        };
    }
  }, [tableDensity]);

  // Beautiful background coloring for units in header
  const UNIT_COLORS = [
    "bg-indigo-600 text-white",
    "bg-amber-600 text-white",
    "bg-emerald-600 text-white",
    "bg-rose-600 text-white",
    "bg-sky-600 text-white",
    "bg-purple-600 text-white"
  ];

  // Toggle subject visibility (adding/removing from visibleSubjects)
  const toggleSubjectVisibility = async (subjectName: string) => {
    if (!currentUser?.uid) return;
    setSavingId(subjectName);

    const isCurrentlyVisible = visibleSubjects.includes(subjectName);
    let updatedVisible: string[];

    if (isCurrentlyVisible) {
      updatedVisible = visibleSubjects.filter((name) => name !== subjectName);
    } else {
      updatedVisible = [...visibleSubjects, subjectName];
    }

    try {
      const ref = doc(db, "curriculum_settings", currentUser.uid);
      await setDoc(ref, {
        teacherId: currentUser.uid,
        visibleSubjects: updatedVisible,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      setVisibleSubjects(updatedVisible);
      triggerToast(
        isCurrentlyVisible 
          ? `تم إخفاء مادة "${subjectName}" عن الطلاب بنجاح 🚫`
          : `تم إظهار مادة "${subjectName}" للطلاب بنجاح 👁️`,
        "success"
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `curriculum_settings/${currentUser.uid}`);
      triggerToast("فشل حفظ التغييرات على الخادم السحابي", "error");
    } finally {
      setSavingId(null);
    }
  };

  // Filtered list of custom subjects for show/hide tab
  const filteredSubjects = allSubjects.filter((sub) => 
    sub.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const visibleCount = visibleSubjects.filter(name => allSubjects.some(s => s.name === name)).length;
  const hiddenCount = allSubjects.length - visibleCount;

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      {/* Top Sub-Tab Navigation Bar */}
      <div className="sticky top-0 z-40 bg-slate-50/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 w-fit mr-auto shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveSubTab("settings")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === "settings"
              ? "bg-white text-indigo-700 shadow-sm border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
          }`}
        >
          <Settings className="w-4 h-4 text-indigo-500" />
          <span>إعدادات المواد وحالة العرض ⚙️</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("results")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === "results"
              ? "bg-white text-emerald-700 shadow-sm border border-slate-200/80"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
          <span>سجل نتائج المراجعة الشاملة 📊</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === "settings" ? (
          <motion.div
            key="settings-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >


            {/* Main Content Area */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              {/* Controls Bar */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <span className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="البحث عن مادة دراسية من بنك الأسئلة..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-right shadow-xs"
                  />
                </div>

                <div className="text-xs text-slate-450 font-bold flex items-center gap-1.5 bg-blue-50/50 text-blue-700 px-3.5 py-1.5 rounded-xl border border-blue-100">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <span>تكون جميع المواد مخفية بشكل افتراضي لتسهيل ترتيب مراجعة المنهج</span>
                </div>
              </div>

              {/* Subjects List */}
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                  <span className="text-xs font-bold text-slate-500">جاري تحميل حالة المراجعة الشاملة...</span>
                </div>
              ) : filteredSubjects.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <div className="w-16 h-16 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                    <Search className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-black text-slate-800">لا توجد مواد مجهزة في بنك الأسئلة</h3>
                  <p className="text-xs text-slate-450 font-semibold max-w-xs mx-auto leading-relaxed">
                    يرجى أولاً إنشاء أسئلة دراسية في "بنك الأسئلة" وربطها باسم المادة والوحدة والدرس، وسوف تظهر هنا تلقائياً لتمكين تفعيلها لطلابك.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredSubjects.map((subject) => {
                    const isVisible = visibleSubjects.includes(subject.name);
                    const isSaving = savingId === subject.name;

                    return (
                      <div 
                        key={subject.name}
                        className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors"
                      >
                        {/* Subject Details */}
                        <div className="flex items-start gap-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 shadow-xs ${
                            !isVisible 
                              ? "bg-slate-100 border-slate-200 text-slate-400" 
                              : "bg-blue-50/50 border-blue-100 text-blue-600"
                          }`}>
                            <BookOpen className="w-5.5 h-5.5" />
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-sm font-black text-slate-900">{subject.name}</h3>
                              <span className="text-[9px] font-bold bg-purple-50 border border-purple-200/50 text-purple-700 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 select-none">
                                <Database className="w-2.5 h-2.5 text-purple-500 shrink-0" />
                                بنك الأسئلة
                              </span>
                            </div>

                            <p className="text-xs text-slate-400 font-semibold font-sans">
                              تحتوي على: {subject.unitCount} وحدات مراجعة • {subject.lessonCount} دروس فرعية مجهزة بالأسئلة
                            </p>
                          </div>
                        </div>

                        {/* Toggle Button & Status Badge */}
                        <div className="flex items-center gap-4.5 self-end sm:self-auto">
                          {/* Status Badge */}
                          <div className="font-sans">
                            {!isVisible ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-100 text-rose-700 text-xs font-extrabold shadow-3xs select-none">
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>مخفية عن الطلاب</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-extrabold shadow-3xs select-none">
                                <Eye className="w-3.5 h-3.5" />
                                <span>نشطة ومرئية للطلاب</span>
                              </span>
                            )}
                          </div>

                          {/* Action Toggle Switch */}
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => toggleSubjectVisibility(subject.name)}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 select-none ${
                              !isVisible ? "bg-slate-200" : "bg-blue-600"
                            }`}
                          >
                            <span className="sr-only">تغيير حالة العرض</span>
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                                !isVisible ? "translate-x-0" : "-translate-x-5"
                              }`}
                            >
                              {isSaving ? (
                                <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
                              ) : !isVisible ? (
                                <X className="w-3 h-3 text-slate-400" />
                              ) : (
                                <Check className="w-3 h-3 text-blue-600" />
                              )}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <div className={isFullScreenResults ? "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs p-3 md:p-5 flex items-center justify-center text-right font-sans" : "contents"}>
            <motion.div
              key="results-section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={
                isFullScreenResults
                  ? "bg-slate-50 border border-slate-200 w-full h-full rounded-3xl shadow-2xl flex flex-col p-5 overflow-hidden relative gap-4"
                  : "space-y-6"
              }
            >
              {/* Header Area styled like attached image (non-sticky during scroll as requested) */}
              <div className="bg-purple-650 text-white p-4.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md relative">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <h2 className="text-sm md:text-base font-black tracking-wide leading-none bg-gradient-to-r from-white via-amber-200 to-emerald-200 bg-clip-text text-transparent drop-shadow-sm flex items-center gap-1.5 flex-wrap">
                    <span>لوحة الإدارة | سجل نتائج المراجعة الشاملة</span>
                    <span className="text-white/80 text-[10px] md:text-xs font-bold bg-white/10 px-2 py-0.5 rounded-md border border-white/5 select-none font-sans shrink-0">(مزامنة حية وتحديث تلقائي ⚡)</span>
                  </h2>
                </div>
                
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {/* Density selector buttons */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-slate-900 shadow-inner">
                    <span className="text-[10.5px] font-black px-2.5 py-1 bg-slate-200/65 text-slate-900 rounded-lg border border-slate-300/50 hidden md:inline-block tracking-tight">حجم الجدول 📏:</span>
                    <button
                      type="button"
                      onClick={() => setTableDensity("normal")}
                      className={`px-3 py-1.5 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
                        tableDensity === "normal"
                          ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md scale-[1.05] border border-blue-400/20"
                          : "text-slate-900 hover:bg-slate-200"
                      }`}
                    >
                      عادي
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableDensity("compact")}
                      className={`px-3 py-1.5 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
                        tableDensity === "compact"
                          ? "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-md scale-[1.05] border border-violet-400/20"
                          : "text-slate-900 hover:bg-slate-200"
                      }`}
                    >
                      مكثف
                    </button>
                    <button
                      type="button"
                      onClick={() => setTableDensity("ultra-compact")}
                      className={`px-3 py-1.5 rounded-lg text-[10.5px] font-black transition-all cursor-pointer ${
                        tableDensity === "ultra-compact"
                          ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md scale-[1.05] border border-amber-400/20"
                          : "text-slate-900 hover:bg-slate-200"
                      }`}
                    >
                      دقيق جداً 🔬
                    </button>
                  </div>

                  {/* Toggle filters button inside full screen */}
                  {isFullScreenResults && (
                    <button
                      type="button"
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white text-[11px] font-black rounded-lg transition-all border border-white/10 cursor-pointer"
                      title={showFilters ? "إخفاء الفلاتر لتوسيع الجدول" : "إظهار فلاتر البحث والصفوف"}
                    >
                      <span>{showFilters ? "إخفاء الفلاتر 👁️" : "عرض الفلاتر 🔍"}</span>
                    </button>
                  )}

                  {/* Maximize / Minimize button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsFullScreenResults(!isFullScreenResults);
                      if (!isFullScreenResults) {
                        setShowFilters(true); // Reset show filters when maximizing
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-[11px] font-black rounded-lg transition-all border border-emerald-400 cursor-pointer shadow-xs"
                    title={isFullScreenResults ? "تصغير الشاشة" : "تكبير ملء الشاشة"}
                  >
                    {isFullScreenResults ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>تصغير ↩</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>ملء الشاشة ⛶</span>
                      </>
                    )}
                  </button>

                  <div className="text-[11px] font-black bg-white/15 px-3 py-1.5 rounded-lg border border-white/10 hidden sm:block">
                    مجموع الطلاب: {filteredStudents.length}
                  </div>
                </div>
              </div>

            {/* Selector Filters Grid resembling attached image layout */}
            {(!isFullScreenResults || showFilters) && (
              <div className="bg-white border border-slate-200 p-6 rounded-3xl shadow-sm space-y-5">
                
                {/* Row 1: Select Subject */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-black text-slate-600 shrink-0">المادة الدراسية:</span>
                  <div className="flex flex-wrap gap-2">
                    {visibleSubjectsList.map((sub) => {
                      const isSelected = selectedSubject === sub.name;
                      return (
                        <div key={sub.name} className="flex items-center gap-1.5 bg-slate-100/60 p-1 rounded-xl border border-slate-200/50">
                          <button
                            type="button"
                            onClick={() => setSelectedSubject(sub.name)}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              isSelected
                                ? "bg-blue-600 text-white shadow-xs"
                                : "text-slate-700 hover:bg-slate-200/50"
                            }`}
                          >
                            {sub.name}
                          </button>
                          {isSelected && (
                            <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100/60 shrink-0 flex items-center gap-1 select-none">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              حالة العرض: مرئية للطلاب
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {visibleSubjectsList.length === 0 && (
                      <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-xs font-extrabold w-full flex items-center gap-2">
                        ⚠️ يرجى تفعيل عرض المواد الدراسية أولاً من تبويب "المواد ومستودع الأسئلة" لتظهر نتائجها هنا.
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Select Grade / Level */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-black text-slate-600 shrink-0">المرحلة / الصف:</span>
                  <div className="flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-1 bg-slate-150 p-1 rounded-full border border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => setSelectedGrade("الكل")}
                        className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                          selectedGrade === "الكل"
                            ? "bg-[#1e3a8a] text-white shadow-xs"
                            : "text-slate-650 hover:bg-slate-250"
                        }`}
                      >
                        الكل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetScores("الكل", "الكل")}
                        title="تصفير درجات جميع الصفوف"
                        className="p-1 rounded-full text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {availableGrades.map((grade) => (
                      <div key={grade} className="inline-flex items-center gap-1 bg-slate-150 p-1 rounded-full border border-slate-200/60">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGrade(grade);
                            setSelectedClass("الكل"); // Reset class filter upon grade change
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer ${
                            selectedGrade === grade
                              ? "bg-[#1e3a8a] text-white shadow-xs"
                              : "text-slate-650 hover:bg-slate-250"
                          }`}
                        >
                          {grade}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetScores(grade, "الكل")}
                          title={`تصفير درجات صف ${grade}`}
                          className="p-1 rounded-full text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 3: Select Class/Section */}
                <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4.5">
                  <span className="text-xs font-black text-slate-600 shrink-0">الفصول المتاحة:</span>
                  <div className="flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-1 bg-slate-100/60 p-1 rounded-xl border border-slate-200/50">
                      <button
                        type="button"
                        onClick={() => setSelectedClass("الكل")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          selectedClass === "الكل"
                            ? "bg-blue-600 text-white shadow-xs"
                            : "text-slate-700 hover:bg-slate-200/50"
                        }`}
                      >
                        كل الفصول
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetScores(selectedGrade, "الكل")}
                        title="تصفير درجات كل الفصول"
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {availableClasses.map((cls) => (
                      <div key={cls} className="inline-flex items-center gap-1 bg-slate-100/60 p-1 rounded-xl border border-slate-200/50">
                        <button
                          type="button"
                          onClick={() => setSelectedClass(cls)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                            selectedClass === cls
                              ? "bg-blue-600 text-white shadow-xs"
                              : "text-slate-700 hover:bg-slate-200/50"
                          }`}
                        >
                          {cls}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetScores(selectedGrade, cls)}
                          title={`تصفير درجات فصل ${cls}`}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 4: Sticky Question Count & Solve Progress Stages Banner */}
                {selectedSubject && (
                  <div className="border-t border-slate-100 pt-4 mt-2 space-y-3 sticky top-0 z-20 bg-white/95 backdrop-blur-xs pb-3 shadow-2xs rounded-2xl p-3 border border-slate-100">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                        <span className="text-xs font-black text-slate-700">احصائيات الأسئلة ومراحل تقدم الحل:</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5 shadow-2xs">
                          <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                          <span>عدد الأسئلة الكلي: <strong className="font-black text-indigo-900 font-mono text-sm">{progressStats.totalQuestions}</strong> سؤال</span>
                        </span>
                        <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-lg border border-purple-100 flex items-center gap-1.5 shadow-2xs">
                          <Layers className="w-3.5 h-3.5 text-purple-500" />
                          <span>التقسيم: <strong className="font-black text-purple-900">{progressStats.totalUnits} وحدات ({progressStats.totalLessons} درس)</strong></span>
                        </span>
                      </div>
                    </div>

                    {/* Overall Progress Bar & Stages Grid */}
                    <div className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3 shadow-2xs">
                      {/* Top row: Progress bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-black text-slate-800">مراحل تقدم حل الأسئلة إجمالاً:</span>
                          <span className="font-mono font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md text-xs border border-emerald-200">
                            {progressStats.overallProgressPercent}% مكتمل
                          </span>
                        </div>
                        <span className="text-[11px] font-extrabold text-slate-500">
                          تم إنجاز {progressStats.totalSolvedLessons} من أصل {progressStats.totalPossibleLessons} درس مخصص للطلاب
                        </span>
                      </div>

                      {/* Progress track */}
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-300/60">
                        <div
                          className="bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 h-full rounded-full transition-all duration-500 shadow-2xs"
                          style={{ width: `${progressStats.overallProgressPercent}%` }}
                        />
                      </div>

                      {/* Stages breakdown cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                        {/* Stage 1: Completed / Mastered */}
                        <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-500">مرحلة الإكتمال (100%)</span>
                              <span className="text-xs font-black text-emerald-700">{progressStats.completedStudentsCount} طالب</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-extrabold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md border border-emerald-100">
                            أكملوا
                          </span>
                        </div>

                        {/* Stage 2: In Progress */}
                        <div className="bg-white p-2.5 rounded-xl border border-blue-200 shadow-2xs flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-blue-500 shrink-0 animate-pulse" />
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-500">مرحلة قيد التقدم</span>
                              <span className="text-xs font-black text-blue-700">{progressStats.inProgressStudentsCount} طالب</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-extrabold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md border border-blue-100">
                            جاري الحل
                          </span>
                        </div>

                        {/* Stage 3: Not Started */}
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Info className="w-4 h-4 text-slate-400 shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-500">لم يبدأوا بعد</span>
                              <span className="text-xs font-black text-slate-700">{progressStats.notStartedStudentsCount} طالب</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-extrabold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md border border-slate-200">
                            بانتظار البدء
                          </span>
                        </div>

                        {/* Stage 4: Full Score Lessons */}
                        <div className="bg-white p-2.5 rounded-xl border border-amber-200 shadow-2xs flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-500">دروس بالدرجة الكاملة</span>
                              <span className="text-xs font-black text-amber-700">{progressStats.perfectScoresCount} إجابة</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-extrabold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md border border-amber-100">
                            علامة كاملة
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Matrix Data Table Sheet */}
            {scoresLoading ? (
              <div className="py-24 bg-white border border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="text-xs font-bold text-slate-500">جاري مزامنة وجلب نتائج الطلاب في المراجعة...</span>
              </div>
            ) : !selectedSubject ? (
              <div className="py-20 bg-white border border-slate-200 rounded-3xl text-center space-y-3">
                <div className="w-16 h-16 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                  <BookOpen className="w-8 h-8" />
                </div>
                <h3 className="text-base font-black text-slate-800">لا توجد مواد مجهزة بعد</h3>
                <p className="text-xs text-slate-450 font-semibold max-w-xs mx-auto leading-relaxed">
                  يرجى إنشاء مادة دراسية وأسئلة في بنك الأسئلة أولاً لتبدأ عملية رصد ومتابعة التقدم.
                </p>
              </div>
            ) : flatLessons.length === 0 ? (
              <div className="py-20 bg-white border border-slate-200 rounded-3xl text-center space-y-3">
                <div className="w-16 h-16 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-base font-black text-slate-800">لا توجد دروس أو أسئلة مضافة في مادة "{selectedSubject}"</h3>
                <p className="text-xs text-slate-450 font-semibold max-w-xs mx-auto leading-relaxed">
                  الرجاء تزويد دروس هذه المادة بالأسئلة اللازمة عبر صفحة "بنك الأسئلة" لإنشاء جدول رصد النتائج.
                </p>
              </div>
            ) : (
              <div className={`bg-white border border-slate-200 rounded-3xl shadow-md overflow-hidden ${
                isFullScreenResults ? "flex-1 min-h-0 flex flex-col" : ""
              }`}>
                {/* Horizontal & Vertical Scroll wrapper for dense table matrix */}
                <div className={`overflow-auto ${isFullScreenResults ? "flex-1 min-h-0" : "max-h-[75vh]"}`}>
                  <table className="w-full border-collapse min-w-[900px]">
                    <thead>
                      {/* Row 1: Units Super-Headers */}
                      <tr className="bg-slate-100 border-b border-slate-200">
                        <th rowSpan={2} className={`${tableClasses.numCell} text-right font-black text-slate-800 border-l border-slate-200 bg-slate-100 sticky top-0 right-0 z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`}>#</th>
                        <th rowSpan={2} className={`${tableClasses.studentCell} text-right font-black text-slate-800 border-l border-slate-200 bg-slate-100 sticky top-0 ${tableClasses.studentRight} z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`}>اسم الطالب</th>
                        
                        {activeSyllabus.units.map((unit, index) => {
                          const colColor = UNIT_COLORS[index % UNIT_COLORS.length];
                          return (
                            <th
                              key={unit.name}
                              colSpan={unit.lessons.length}
                              className={`${tableClasses.thUnit} text-center font-black border-l border-slate-200 ${colColor} sticky top-0 z-20`}
                            >
                              {unit.name}
                            </th>
                          );
                        })}
                      </tr>

                      {/* Row 2: Lessons Headers */}
                      <tr className="bg-slate-50 border-b border-slate-250">
                        {flatLessons.map((lesson, idx) => (
                          <th
                            key={`${lesson.unitName}-${lesson.lessonName}-${idx}`}
                            className={`${tableClasses.thLesson} text-center border-l border-slate-200 align-top sticky ${tableClasses.lessonTop} z-20 bg-slate-50`}
                          >
                            <div className="flex flex-col items-center justify-between h-full gap-1.5">
                              <span className={`${tableDensity === "ultra-compact" ? "text-[8.5px]" : tableDensity === "compact" ? "text-[9px]" : "text-[10px]"} font-black text-slate-700 leading-snug line-clamp-3 block max-h-[48px] overflow-hidden`} title={lesson.lessonName}>
                                {lesson.lessonName}
                              </span>
                              <span className={`${tableDensity === "ultra-compact" ? "text-[7.5px] px-1 py-0" : "text-[8.5px] px-1.5 py-0.5"} font-bold bg-slate-100 text-slate-500 rounded-md border border-slate-200 select-none shrink-0 font-sans`}>
                                {lesson.questionsCount} أسئلة
                              </span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-150">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={flatLessons.length + 2} className="py-16 text-center text-xs font-semibold text-slate-450 bg-slate-50/30">
                            لا يوجد طلاب مسجلين في الفلاتر والصفوف المحددة حالياً.
                          </td>
                        </tr>
                      ) : (
                        filteredStudents.map((student, sIdx) => {
                          const scoreDoc = studentScores[student.id] || {};
                          const stats = scoreDoc.stats || {};

                          return (
                            <tr key={student.id} className="hover:bg-slate-50/40 transition-colors">
                              {/* Row Index */}
                              <td className={`${tableClasses.numCell} text-right font-bold text-slate-500 border-l border-slate-200 bg-white sticky right-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`}>
                                {sIdx + 1}
                              </td>

                              {/* Student Name */}
                              <td className={`${tableClasses.studentCell} text-right border-l border-slate-200 bg-white sticky ${tableClasses.studentRight} z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`}>
                                <div className="space-y-0.5">
                                  <span className={`${tableClasses.studentName} font-extrabold text-slate-900 block leading-tight`}>{student.name}</span>
                                  <span className={`${tableClasses.studentMeta} font-bold text-slate-400 block font-sans`}>
                                    {student.grade || "لا يوجد صف"} • {student.gradeClass || "لا يوجد فصل"}
                                  </span>
                                </div>
                              </td>

                              {/* Lessons Cells */}
                              {flatLessons.map((lesson, lIdx) => {
                                const statsKey = `${selectedSubject}_${lesson.unitName}_${lesson.lessonName}`;
                                const stat = stats[statsKey];

                                let badgeElement = <span className="text-slate-350 font-bold">-</span>;

                                if (stat && stat.solved) {
                                  const isPerfect = stat.score === stat.maxScore;
                                  if (isPerfect) {
                                    badgeElement = (
                                      <span 
                                        dir="ltr" 
                                        className={`inline-flex items-center justify-center gap-1 bg-emerald-500 text-white font-black shadow-xs border border-emerald-600 font-mono select-none ${tableClasses.badgeClass}`}
                                      >
                                        <Trophy className={`${tableDensity === "ultra-compact" ? "w-2 h-2" : "w-3 h-3"} text-amber-300 animate-bounce shrink-0`} />
                                        <span>{stat.score} / {stat.maxScore}</span>
                                      </span>
                                    );
                                  } else {
                                    badgeElement = (
                                      <span 
                                        dir="ltr" 
                                        className={`inline-flex items-center justify-center bg-amber-500 text-slate-950 font-black shadow-xs border border-amber-600 font-mono select-none ${tableClasses.badgeClass}`}
                                      >
                                        <span>{stat.score} / {stat.maxScore}</span>
                                      </span>
                                    );
                                  }
                                }

                                return (
                                  <td 
                                    key={`${student.id}-${statsKey}-${lIdx}`}
                                    className={`${tableClasses.td} text-center border-l border-slate-200`}
                                  >
                                    {badgeElement}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Footer Controls & Live Update Pulse Banner */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 font-bold text-slate-500">
                    <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>يتم تحديث الخلايا وتلوينها فور استجابة الطالب للحل بدون الحاجة لتحديث الصفحة.</span>
                  </div>

                  <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-1.5 rounded-full font-extrabold select-none shadow-3xs self-start sm:self-auto">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>تحديث حي ونبض 🟢</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Confirmation Reset Modal */}
      <AnimatePresence>
        {resetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setResetModal(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-2xl shadow-xl border border-rose-100 w-full max-w-md overflow-hidden relative z-10 text-right p-6 font-sans"
            >
              {/* Decorative Warning Icon Header */}
              <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-slate-100">
                <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
                  <RotateCcw className="w-6 h-6 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تأكيد تصفير درجات الطلاب</h3>
                  <p className="text-xs font-bold text-slate-450 mt-0.5">يرجى تأكيد رغبتك قبل المتابعة</p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-4">
                <p className="text-xs font-semibold leading-relaxed text-slate-650">
                  {resetModal.description}
                </p>

                {/* Affected count pill */}
                <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3.5 flex items-center justify-between text-rose-900 text-xs">
                  <span className="font-extrabold text-slate-550">إجمالي عدد الطلاب المتأثرين:</span>
                  <span className="bg-rose-500 text-white font-black px-3 py-1 rounded-full text-[11px] shadow-3xs font-mono">
                    {resetModal.studentCount} طالب
                  </span>
                </div>

                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 flex items-start gap-2.5 text-amber-850 text-[11px] font-medium leading-relaxed">
                  <span className="text-amber-500 font-extrabold text-sm shrink-0 leading-none">⚠️</span>
                  <span>تنبيه: سيؤدي هذا الإجراء إلى تصفير درجات الطلاب المسجلة في المراجعة الشاملة بالكامل، ولا يمكن التراجع عن هذا الإجراء بعد تنفيذه.</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={executeResetScores}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white py-2.5 rounded-xl font-black text-xs transition shadow-md shadow-rose-600/10 cursor-pointer"
                >
                  نعم، تصفير الدرجات
                </button>
                <button
                  type="button"
                  onClick={() => setResetModal(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer"
                >
                  إلغاء التصفير
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Progress Status Modal */}
      <AnimatePresence>
        {resetProgress && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden relative z-10 text-right p-6 font-sans"
            >
              {/* Spinner/Status Icon */}
              <div className="flex flex-col items-center justify-center text-center py-4">
                {resetProgress.current < resetProgress.total ? (
                  <div className="relative flex items-center justify-center mb-4">
                    <div className="w-14 h-14 rounded-full border-4 border-slate-100 border-t-rose-500 animate-spin" />
                    <span className="absolute text-xs font-black text-rose-600 font-mono">
                      {Math.round((resetProgress.current / resetProgress.total) * 100)}%
                    </span>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-4 border border-emerald-200 animate-bounce">
                    <Check className="w-7 h-7" />
                  </div>
                )}

                <h3 className="text-sm font-black text-slate-900">
                  {resetProgress.current < resetProgress.total ? "جاري تصفير درجات الطلاب..." : "اكتمل التصفير بنجاح!"}
                </h3>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 space-y-3">
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-150 relative">
                  <div
                    className="bg-gradient-to-r from-rose-500 to-amber-400 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${(resetProgress.current / resetProgress.total) * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                  <span className="font-mono text-slate-400">{resetProgress.current} / {resetProgress.total} طالب</span>
                  <span className="text-slate-650">التقدم الإجمالي</span>
                </div>

                {/* Subtext info */}
                <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-450 font-semibold shrink-0">الطالب الحالي:</span>
                  <span className="font-extrabold text-slate-800 truncate text-left max-w-[200px]" dir="auto">
                    {resetProgress.studentName || "تهيئة..."}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
