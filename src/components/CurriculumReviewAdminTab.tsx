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
  CheckCircle2,
  Sliders,
  Filter,
  GraduationCap,
  Bell,
  Plus,
  Trash2,
  BookPlus,
  AlertTriangle,
  Calendar
} from "lucide-react";
import { doc, onSnapshot, setDoc, collection, query, where } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { PRELOADED_SUBJECTS } from "./StudentCurriculumReview";
import { BankQuestion, Student } from "../types";
import { isGradeMatching } from "../utils/questionUtils";

interface CurriculumReviewAdminTabProps {
  currentUser: any;
  bankQuestions: BankQuestion[];
  students: Student[];
  grades: string[];
  semesters?: any[];
  triggerToast: (msg: string, type: "success" | "error" | "info" | "warning") => void;
  isFullScreenResults?: boolean;
  onToggleFullScreen?: (val: boolean) => void;
}

export default function CurriculumReviewAdminTab({
  currentUser,
  bankQuestions,
  students = [],
  grades = [],
  semesters = [],
  triggerToast,
  isFullScreenResults: externalIsFullScreen,
  onToggleFullScreen
}: CurriculumReviewAdminTabProps) {
  // Live state for grades and semesters added in "إضافة الفصول"
  const [liveGrades, setLiveGrades] = useState<string[]>([]);
  const [liveSemesters, setLiveSemesters] = useState<any[]>([]);

  // Listen to Firestore real-time updates for grades and semesters added by teacher
  useEffect(() => {
    if (!currentUser?.uid) return;

    const gradesQuery = query(
      collection(db, "grades"),
      where("teacherId", "==", currentUser.uid)
    );
    const unsubGrades = onSnapshot(
      gradesQuery,
      (snapshot) => {
        const list: string[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.name && typeof d.name === "string" && d.name.trim()) {
            list.push(d.name.trim());
          }
        });
        setLiveGrades(list);
      },
      (err) => console.warn("Error listening to grades in CurriculumReviewAdminTab:", err)
    );

    const semestersQuery = query(
      collection(db, "semesters"),
      where("teacherId", "==", currentUser.uid)
    );
    const unsubSemesters = onSnapshot(
      semestersQuery,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.name) {
            list.push({
              id: docSnap.id,
              name: d.name,
              gradeName: d.gradeName || "",
            });
          }
        });
        setLiveSemesters(list);
      },
      (err) => console.warn("Error listening to semesters in CurriculumReviewAdminTab:", err)
    );

    return () => {
      unsubGrades();
      unsubSemesters();
    };
  }, [currentUser]);
  // Current Tab selection
  const [activeSubTab, setActiveSubTab] = useState<"settings" | "results">("settings");

  // State for Subject Visibility Settings
  const [visibleSubjects, setVisibleSubjects] = useState<string[]>([]);
  const [subjectTargets, setSubjectTargets] = useState<Record<string, { targetGrade?: string; targetClass?: string; questionsPerLesson?: string | number; updatedAt?: string; isCustomized?: boolean }>>({});
  const [configuredGradeSubjects, setConfiguredGradeSubjects] = useState<Record<string, boolean>>({});
  const [configuredQLimitSubjects, setConfiguredQLimitSubjects] = useState<Record<string, boolean>>({});
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
  const [internalFullScreen, setInternalFullScreen] = useState<boolean>(false);
  const isFullScreenResults = externalIsFullScreen !== undefined ? externalIsFullScreen : internalFullScreen;

  const handleToggleFullScreen = (val?: boolean) => {
    const nextVal = val !== undefined ? val : !isFullScreenResults;
    setInternalFullScreen(nextVal);
    if (onToggleFullScreen) {
      onToggleFullScreen(nextVal);
    }
  };

  const [tableDensity, setTableDensity] = useState<"ultra-compact" | "compact" | "normal">("ultra-compact");
  const [showFilters, setShowFilters] = useState<boolean>(true);

  // Load visible subjects from Firestore (supporting both UID and Email references)
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    setLoading(true);
    const userEmail = currentUser.email?.toLowerCase().trim();
    const uidRef = doc(db, "curriculum_settings", currentUser.uid);

    let unsubEmail = () => {};

    const unsubUid = onSnapshot(uidRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setVisibleSubjects(data.visibleSubjects || []);
        setSubjectTargets(data.subjectTargets || {});
        setLoading(false);
      } else if (userEmail) {
        // If not found under UID, check under email or by teacherEmail
        const emailRef = doc(db, "curriculum_settings", userEmail);
        unsubEmail = onSnapshot(emailRef, (emailSnap) => {
          if (emailSnap.exists()) {
            const data = emailSnap.data();
            setVisibleSubjects(data.visibleSubjects || []);
            setSubjectTargets(data.subjectTargets || {});
            // Migrate to UID doc
            setDoc(uidRef, {
              ...data,
              teacherId: currentUser.uid,
              teacherEmail: userEmail,
            }, { merge: true }).catch(() => {});
          } else {
            setVisibleSubjects([]);
            setSubjectTargets({});
          }
          setLoading(false);
        }, () => {
          setLoading(false);
        });
      } else {
        setVisibleSubjects([]);
        setSubjectTargets({});
        setLoading(false);
      }
    }, (error) => {
      console.error("Failed to fetch curriculum settings:", error);
      setLoading(false);
    });

    return () => {
      unsubUid();
      unsubEmail();
    };
  }, [currentUser?.uid, currentUser?.email]);

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

  // Modal state for adding a subject from Question Bank
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState<boolean>(false);
  // Modal filter states for "Add Subject from Question Bank"
  const [modalSearchQuery, setModalSearchQuery] = useState<string>("");
  const [modalStageFilter, setModalStageFilter] = useState<string>("all");
  const [modalGradeFilter, setModalGradeFilter] = useState<string>("all");

  // Reset modal filters when modal is opened/closed
  useEffect(() => {
    if (!isAddSubjectModalOpen) {
      setModalSearchQuery("");
      setModalStageFilter("all");
      setModalGradeFilter("all");
    }
  }, [isAddSubjectModalOpen]);

  // State for subject deletion confirmation modal
  const [subjectToDelete, setSubjectToDelete] = useState<string | null>(null);

  // Aggregate all custom subjects strictly from Bank Questions
  const allBankSubjects = useMemo(() => {
    const subjectsMap: Record<string, { 
      name: string; 
      isPreloaded: boolean; 
      units: Set<string>; 
      lessons: Set<string>; 
      grades: Set<string>;
      semesters: Set<string>;
      questionCount: number;
    }> = {};

    bankQuestions.forEach((q) => {
      const subName = q.subject;
      if (!subName) return;
      
      const unitName = q.unit || "عام";
      const lessonName = q.lesson || "عام";
      const gradeName = q.grade;
      const semesterName = q.semester;

      if (!subjectsMap[subName]) {
        subjectsMap[subName] = {
          name: subName,
          isPreloaded: false,
          units: new Set(),
          lessons: new Set(),
          grades: new Set(),
          semesters: new Set(),
          questionCount: 0
        };
      }

      subjectsMap[subName].units.add(unitName);
      subjectsMap[subName].lessons.add(`${unitName}-${lessonName}`);
      if (gradeName && typeof gradeName === "string" && gradeName.trim()) {
        subjectsMap[subName].grades.add(gradeName.trim());
      }
      if (semesterName && typeof semesterName === "string" && semesterName.trim()) {
        subjectsMap[subName].semesters.add(semesterName.trim());
      }
      subjectsMap[subName].questionCount += 1;
    });

    return Object.values(subjectsMap).map((sub) => ({
      name: sub.name,
      isPreloaded: false,
      unitCount: sub.units.size,
      lessonCount: sub.lessons.size,
      grades: Array.from(sub.grades),
      semesters: Array.from(sub.semesters),
      questionCount: sub.questionCount
    }));
  }, [bankQuestions]);

  // List of bank subjects that have NOT been added by the teacher yet
  const unaddedBankSubjects = useMemo(() => {
    return allBankSubjects.filter((sub) => !visibleSubjects.includes(sub.name));
  }, [allBankSubjects, visibleSubjects]);

  // Helper to check if a subject matches an educational stage
  const isStageMatchingSubject = (stageKey: string, gradesList: string[], subName: string): boolean => {
    if (stageKey === "all") return true;

    const keywordsMap: Record<string, string[]> = {
      primary: ["ابتدائ", "الابتدائي", "الابتدائية", "ابتدائي", "ابتدائيه"],
      middle: ["متوسط", "المتوسط", "المتوسطة", "متوسطه"],
      secondary: ["ثانوي", "الثانوي", "الثانوية", "ثانويه", "مسارات", "1-1", "1-2", "1-3"]
    };

    const keywords = keywordsMap[stageKey];
    if (!keywords) return true;

    // 1. Check if any grade string attached to the subject matches
    const hasGradeMatch = gradesList.some((g) => {
      const norm = (g || "").toLowerCase();
      return keywords.some((kw) => norm.includes(kw));
    });
    if (hasGradeMatch) return true;

    // 2. Check subject name
    const normSubName = (subName || "").toLowerCase();
    return keywords.some((kw) => normSubName.includes(kw));
  };

  // Filtered list of unadded bank subjects for the modal
  const filteredUnaddedBankSubjects = useMemo(() => {
    return unaddedBankSubjects
      .filter((sub) => {
        // Search query filter
        const query = modalSearchQuery.trim().toLowerCase();
        const matchesSearch = !query || sub.name.toLowerCase().includes(query);

        // Stage filter
        const matchesStage = isStageMatchingSubject(modalStageFilter, sub.grades, sub.name);

        // Grade filter
        const matchesGrade = modalGradeFilter === "all" || sub.grades.some((g) => isGradeMatching(g, modalGradeFilter));

        return matchesSearch && matchesStage && matchesGrade;
      })
      .sort((a, b) => b.questionCount - a.questionCount);
  }, [unaddedBankSubjects, modalSearchQuery, modalStageFilter, modalGradeFilter]);

  // List of subjects that the teacher has explicitly added to their review list
  const teacherAddedSubjects = useMemo(() => {
    const map = new Map<string, { name: string; isPreloaded: boolean; unitCount: number; lessonCount: number; questionCount?: number }>();
    
    // First map bank details for added subjects
    allBankSubjects.forEach(s => {
      if (visibleSubjects.includes(s.name)) {
        map.set(s.name, s);
      }
    });

    // Also include any subject in visibleSubjects that might not be in allBankSubjects
    visibleSubjects.forEach(name => {
      if (!map.has(name)) {
        map.set(name, {
          name,
          isPreloaded: false,
          unitCount: 0,
          lessonCount: 0,
          questionCount: 0
        });
      }
    });

    return Array.from(map.values());
  }, [allBankSubjects, visibleSubjects]);

  // Alias allSubjects to teacherAddedSubjects for backwards compatibility
  const allSubjects = teacherAddedSubjects;

  // Filter allSubjects to keep only those that are toggled on (visible)
  const visibleSubjectsList = useMemo(() => {
    return teacherAddedSubjects.filter((sub) => visibleSubjects.includes(sub.name));
  }, [teacherAddedSubjects, visibleSubjects]);

  // Add subject from Question Bank to teacher's review list (automatically sets it as visible for students)
  const addSubjectFromBank = async (subjectName: string) => {
    if (!currentUser?.uid) return;
    setSavingId(subjectName);

    const updatedVisible = Array.from(new Set([...visibleSubjects, subjectName]));
    
    // Always reset targeting configuration on add/re-add so the visual pulse is active
    const updatedTargets = {
      ...subjectTargets,
      [subjectName]: {
        targetGrade: "جميع الصفوف (عام)",
        targetClass: "جميع الفصول (عام)",
        questionsPerLesson: "15",
        isCustomized: false,
        updatedAt: new Date().toISOString()
      }
    };
    setConfiguredGradeSubjects((prev) => ({ ...prev, [subjectName]: false }));
    setConfiguredQLimitSubjects((prev) => ({ ...prev, [subjectName]: false }));

    try {
      const ref = doc(db, "curriculum_settings", currentUser.uid);
      await setDoc(ref, {
        teacherId: currentUser.uid,
        visibleSubjects: updatedVisible,
        subjectTargets: updatedTargets,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      setVisibleSubjects(updatedVisible);
      setSubjectTargets(updatedTargets);
      triggerToast(`تم إضافة مادة "${subjectName}" وتفعيل عرضها للطلاب تلقائياً 🎯`, "success");
      // Keep modal open so teacher can add more subjects sequentially if desired
    } catch (error) {
      console.error("Failed to add subject:", error);
      handleFirestoreError(error, OperationType.WRITE, `curriculum_settings/${currentUser.uid}`);
      triggerToast("فشل إضافة المادة على الخادم", "error");
    } finally {
      setSavingId(null);
    }
  };

  // Remove subject from teacher's review list
  const removeSubjectFromReview = async (subjectName: string) => {
    if (!currentUser?.uid) return;
    setSavingId(subjectName);

    const updatedVisible = visibleSubjects.filter((name) => name !== subjectName);

    // Reset configured state so if re-added later, the pulse activates
    setConfiguredGradeSubjects((prev) => {
      const next = { ...prev };
      delete next[subjectName];
      return next;
    });
    setConfiguredQLimitSubjects((prev) => {
      const next = { ...prev };
      delete next[subjectName];
      return next;
    });

    const updatedTargets = {
      ...subjectTargets,
      [subjectName]: {
        targetGrade: "جميع الصفوف (عام)",
        targetClass: "جميع الفصول (عام)",
        questionsPerLesson: "15",
        isCustomized: false,
        updatedAt: new Date().toISOString()
      }
    };

    try {
      const ref = doc(db, "curriculum_settings", currentUser.uid);
      await setDoc(ref, {
        teacherId: currentUser.uid,
        visibleSubjects: updatedVisible,
        subjectTargets: updatedTargets,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      setVisibleSubjects(updatedVisible);
      setSubjectTargets(updatedTargets);
      triggerToast(`تم إزالة مادة "${subjectName}" من المراجعة الشاملة`, "info");
    } catch (error) {
      console.error("Failed to remove subject:", error);
      handleFirestoreError(error, OperationType.WRITE, `curriculum_settings/${currentUser.uid}`);
      triggerToast("فشل حذف المادة على الخادم", "error");
    } finally {
      setSavingId(null);
    }
  };

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

  // Extract unique grades list directly from "إضافة الفصول" (grades/semesters), students, and bank questions
  const allAvailableGrades = useMemo(() => {
    const teacherSet = new Set<string>();

    // 1. Primary source: Grades added in "إضافة الفصول" (liveGrades state & grades prop)
    if (liveGrades && Array.isArray(liveGrades)) {
      liveGrades.forEach((g) => { if (g && g.trim()) teacherSet.add(g.trim()); });
    }
    if (grades && Array.isArray(grades)) {
      grades.forEach((g) => { if (g && g.trim()) teacherSet.add(g.trim()); });
    }

    // 2. Grades attached to classes in "إضافة الفصول" (liveSemesters state & semesters prop)
    const activeSemesters = (liveSemesters && liveSemesters.length > 0 ? liveSemesters : semesters) || [];
    if (Array.isArray(activeSemesters)) {
      activeSemesters.forEach((s: any) => {
        if (s?.gradeName && s.gradeName.trim()) teacherSet.add(s.gradeName.trim());
      });
    }

    // If teacher added any grades in "إضافة الفصول", use them directly as the source list
    if (teacherSet.size > 0) {
      return Array.from(teacherSet).sort((a, b) => a.localeCompare(b, "ar"));
    }

    // Fallbacks if no teacher grades added yet:
    const fallbackSet = new Set<string>();
    if (students && Array.isArray(students)) {
      students.forEach((s) => { if (s.grade && s.grade.trim()) fallbackSet.add(s.grade.trim()); });
    }
    if (bankQuestions && Array.isArray(bankQuestions)) {
      bankQuestions.forEach((q) => { if (q.grade && q.grade.trim()) fallbackSet.add(q.grade.trim()); });
    }

    if (fallbackSet.size === 0) {
      [
        "الصف الأول الابتدائي",
        "الصف الثاني الابتدائي",
        "الصف الثالث الابتدائي",
        "الصف الرابع الابتدائي",
        "الصف الخامس الابتدائي",
        "الصف السادس الابتدائي",
        "الصف الأول المتوسط",
        "الصف الثاني المتوسط",
        "الصف الثالث المتوسط",
        "السنة الأولى المشتركة (أول ثانوي)",
        "الصف الثاني الثانوي",
        "الصف الثالث الثانوي"
      ].forEach((g) => fallbackSet.add(g));
    }
    return Array.from(fallbackSet).sort((a, b) => a.localeCompare(b, "ar"));
  }, [liveGrades, grades, liveSemesters, semesters, students, bankQuestions]);

  // Extract unique classes/sections based on target grade
  const getAvailableClassesForGrade = (targetGrade?: string) => {
    const teacherClassSet = new Set<string>();
    const activeSemesters = (liveSemesters && liveSemesters.length > 0 ? liveSemesters : semesters) || [];

    // 1. Primary source: Classes/sections added in "إضافة الفصول" for this grade
    if (Array.isArray(activeSemesters)) {
      activeSemesters.forEach((s: any) => {
        const semGrade = s.gradeName || "";
        const semName = s.name || "";
        const matchesGrade =
          !targetGrade ||
          targetGrade === "جميع الصفوف (عام)" ||
          targetGrade === "الكل" ||
          targetGrade === "عام" ||
          isGradeMatching(targetGrade, semGrade);

        if (matchesGrade && semName && semName.trim()) {
          teacherClassSet.add(semName.trim());
        }
      });
    }

    // If teacher added classes for this grade in "إضافة الفصول", use them directly
    if (teacherClassSet.size > 0) {
      return Array.from(teacherClassSet).sort((a, b) => a.localeCompare(b, "ar"));
    }

    // Fallback sources if no teacher classes added for this grade yet:
    const fallbackSet = new Set<string>();
    if (students && Array.isArray(students)) {
      students.forEach((s) => {
        const sGrade = s.grade || "";
        const matchesGrade =
          !targetGrade ||
          targetGrade === "جميع الصفوف (عام)" ||
          targetGrade === "الكل" ||
          targetGrade === "عام" ||
          isGradeMatching(targetGrade, sGrade, s.gradeClass);

        if (matchesGrade) {
          if (s.gradeClass && s.gradeClass.trim()) fallbackSet.add(s.gradeClass.trim());
          if (s.semester && s.semester.trim()) fallbackSet.add(s.semester.trim());
        }
      });
    }

    if (bankQuestions && Array.isArray(bankQuestions)) {
      bankQuestions.forEach((q) => {
        const matchesGrade =
          !targetGrade ||
          targetGrade === "جميع الصفوف (عام)" ||
          targetGrade === "الكل" ||
          targetGrade === "عام" ||
          isGradeMatching(targetGrade, q.grade);

        if (matchesGrade) {
          if (q.semester && q.semester.trim() && q.semester !== "عام" && q.semester !== "جميع الفصول") {
            fallbackSet.add(q.semester.trim());
          }
        }
      });
    }

    if (fallbackSet.size === 0 && Array.isArray(activeSemesters)) {
      activeSemesters.forEach((s: any) => {
        if (s?.name && s.name.trim()) fallbackSet.add(s.name.trim());
      });
    }

    if (fallbackSet.size === 0 && students && Array.isArray(students)) {
      students.forEach((s) => {
        if (s.gradeClass && s.gradeClass.trim()) fallbackSet.add(s.gradeClass.trim());
        if (s.semester && s.semester.trim()) fallbackSet.add(s.semester.trim());
      });
    }

    if (fallbackSet.size === 0) {
      ["1/1", "1/2", "1/3", "1/4", "الفصل الأول", "الفصل الثاني", "فصل (أ)", "فصل (ب)"].forEach((c) => fallbackSet.add(c));
    }

    return Array.from(fallbackSet).sort((a, b) => a.localeCompare(b, "ar"));
  };

  // Update subject targeting (grade, class, and questions limit per lesson) in Firestore
  const updateSubjectTarget = async (
    subjectName: string,
    targetGrade: string,
    targetClass: string,
    questionsPerLesson?: string | number
  ) => {
    if (!currentUser?.uid) return;

    // Immediately mark subject as configured to turn off pulse
    setConfiguredGradeSubjects((prev) => ({ ...prev, [subjectName]: true }));
    setConfiguredQLimitSubjects((prev) => ({ ...prev, [subjectName]: true }));

    // Validate if targetClass is valid for the selected targetGrade
    const validClasses = getAvailableClassesForGrade(targetGrade);
    let finalClass = targetClass || "جميع الفصول (عام)";
    if (finalClass !== "جميع الفصول (عام)" && !validClasses.includes(finalClass)) {
      finalClass = "جميع الفصول (عام)";
    }

    const currentSettings = subjectTargets[subjectName] || {};
    const finalQLimit = questionsPerLesson !== undefined
      ? questionsPerLesson
      : (currentSettings.questionsPerLesson || "15");

    const newTargets = {
      ...subjectTargets,
      [subjectName]: {
        ...currentSettings,
        targetGrade: targetGrade || "جميع الصفوف (عام)",
        targetClass: finalClass,
        questionsPerLesson: finalQLimit,
        isCustomized: true,
        updatedAt: new Date().toISOString()
      }
    };

    setSubjectTargets(newTargets);

    try {
      const ref = doc(db, "curriculum_settings", currentUser.uid);
      await setDoc(ref, {
        teacherId: currentUser.uid,
        teacherEmail: currentUser.email?.toLowerCase().trim() || "",
        subjectTargets: newTargets
      }, { merge: true });
      triggerToast(`تم حفظ إعدادات مادة "${subjectName}" بنجاح 🎯`, "success");
    } catch (error) {
      console.error("Failed to update subject target:", error);
      handleFirestoreError(error, OperationType.WRITE, `curriculum_settings/${currentUser.uid}`);
      triggerToast("فشل حفظ التغييرات على الخادم السحابي", "error");
    }
  };

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
          trUnit: "h-8",
          trLesson: "h-[44px]",
          thUnit: "px-2 text-[10px] h-8 align-middle",
          thLesson: "px-1 py-1 text-[9px] min-w-[75px] max-w-[95px] h-[44px]",
          td: "px-1 py-1 text-[9px]",
          fontClass: "text-[9px]",
          badgeClass: "px-1.5 py-0.5 text-[8.5px] rounded-md",
          studentCell: "px-2.5 py-1 min-w-[185px] max-w-[210px]",
          studentName: "text-[10px]",
          studentMeta: "text-[8px]",
          numCell: "px-2 py-1 text-[10px] w-8",
          studentRight: "right-8",
          unitTop: "top-0",
          lessonTop: "top-[32px]"
        };
      case "compact":
        return {
          trUnit: "h-9",
          trLesson: "h-[52px]",
          thUnit: "px-2.5 text-[10.5px] h-9 align-middle",
          thLesson: "px-1.5 py-1.5 text-[9.5px] min-w-[100px] max-w-[120px] h-[52px]",
          td: "px-1.5 py-1.5 text-[10px]",
          fontClass: "text-[10px]",
          badgeClass: "px-2 py-0.5 text-[9.5px] rounded-lg",
          studentCell: "px-3 py-1.5 min-w-[200px] max-w-[230px]",
          studentName: "text-xs",
          studentMeta: "text-[9px]",
          numCell: "px-3 py-2 text-xs w-10",
          studentRight: "right-10",
          unitTop: "top-0",
          lessonTop: "top-[36px]"
        };
      case "normal":
      default:
        return {
          trUnit: "h-10",
          trLesson: "h-[56px]",
          thUnit: "px-3 text-[11px] h-10 align-middle",
          thLesson: "px-2 py-1.5 text-center text-[10px] min-w-[120px] max-w-[150px] h-[56px]",
          td: "px-2 py-1 text-center",
          fontClass: "text-[11px]",
          badgeClass: "px-2 py-1 text-[10.5px] rounded-lg",
          studentCell: "px-3 py-1 min-w-[210px] max-w-[240px]",
          studentName: "text-xs",
          studentMeta: "text-[9px]",
          numCell: "px-3 py-1 text-xs w-10",
          studentRight: "right-10",
          unitTop: "top-0",
          lessonTop: "top-[40px]"
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
        teacherEmail: currentUser.email?.toLowerCase().trim() || "",
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
    <div className={`space-y-6 text-right font-sans ${isFullScreenResults ? "flex-1 min-h-0 flex flex-col" : ""}`} dir="rtl">
      {/* Section Header Banner */}
      {!isFullScreenResults && (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                المراجعة الشاملة للمنهج 📚
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                إعداد المواد المعروضة للطلاب، وتحديد مستويات التوجيه، ومتابعة سجل نتائج المراجعة الشاملة
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Sub-Tab Navigation Bar - High Contrast Pills Design */}
      {(!isFullScreenResults || showFilters) && (
        <div className="sticky top-0 z-20 bg-slate-100/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/80 flex items-center gap-2 w-full sm:w-fit shadow-xs font-sans transition-all">
          <button
            type="button"
            onClick={() => setActiveSubTab("settings")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer ${
              activeSubTab === "settings"
                ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/25 ring-2 ring-indigo-500/30 scale-[1.02]"
                : "text-slate-600 hover:text-indigo-700 hover:bg-white/80 font-bold"
            }`}
          >
            <Settings className={`w-4 h-4 ${activeSubTab === "settings" ? "text-indigo-100 animate-spin-slow" : "text-slate-500"}`} />
            <span>إعدادات المواد وحالة العرض ⚙️</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("results")}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 cursor-pointer ${
              activeSubTab === "results"
                ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25 ring-2 ring-emerald-500/30 scale-[1.02]"
                : "text-slate-600 hover:text-emerald-700 hover:bg-white/80 font-bold"
            }`}
          >
            <Activity className={`w-4 h-4 ${activeSubTab === "results" ? "text-emerald-100 animate-pulse" : "text-slate-500"}`} />
            <span>سجل نتائج المراجعة الشاملة 📊</span>
          </button>
        </div>
      )}

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
            <div className="bg-white border-2 border-slate-300/90 rounded-3xl shadow-md overflow-hidden ring-1 ring-slate-900/5">
              {/* Controls Bar */}
              <div className="p-5 border-b-2 border-slate-200 bg-slate-100/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md">
                  <span className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="البحث في المواد المضافة..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-right shadow-xs"
                  />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIsAddSubjectModalOpen(true)}
                    className="px-4.5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-200 hover:shadow-lg flex items-center gap-2 transition-all cursor-pointer shrink-0 active:scale-95"
                  >
                    <BookPlus className="w-4 h-4" />
                    <span>إضافة مادة للمراجعة</span>
                  </button>

                  <div className="text-xs text-slate-500 font-bold flex items-center gap-1.5 bg-blue-50/50 text-blue-800 px-3 py-2 rounded-xl border border-blue-100/80">
                    <Info className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>المادة المضافة تُفعل تلقائياً للطلاب ويمكن تخصيص الصف والفصل لها</span>
                  </div>
                </div>
              </div>

              {/* Subjects List */}
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                  <span className="text-xs font-bold text-slate-500">جاري تحميل حالة المراجعة الشاملة...</span>
                </div>
              ) : teacherAddedSubjects.length === 0 ? (
                <div className="py-10 px-4 sm:px-8 space-y-8 max-w-5xl mx-auto">
                  {/* Top Intro Header */}
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-600 border-2 border-indigo-200 rounded-3xl flex items-center justify-center mx-auto text-white shadow-lg shadow-indigo-200 animate-bounce">
                      <BookPlus className="w-8 h-8" />
                    </div>
                    <div className="space-y-1.5 max-w-xl mx-auto">
                      <h3 className="text-lg font-black text-slate-900">لا توجد مواد مضافة للمراجعة الشاملة بعد</h3>
                      <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                        قم بإضافة المواد التي ترغب بعرضها للطلاب من خلال بنك الأسئلة. عند إضافة أي مادة، ستظهر للطلاب مباشرة في قسم المراجعة مع إمكانية تحديد الصف والفصل المطلوب بكل مرونة.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddSubjectModalOpen(true)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-95 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-500/25 transition-all cursor-pointer ring-2 ring-indigo-400/50"
                    >
                      <Plus className="w-4.5 h-4.5" />
                      <span>إضافة مادة للمراجعة الآن 🚀</span>
                    </button>
                  </div>

                  {/* Section 2: Real Student Page Screenshot & Interactive Review Mockup */}
                  <div className="bg-white rounded-3xl border-2 border-slate-200 overflow-hidden shadow-lg space-y-0">
                    <div className="p-4 bg-slate-900 text-white flex items-center justify-between flex-wrap gap-2 border-b border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="flex gap-1.5">
                          <span className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-xs" />
                          <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shadow-xs" />
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shadow-xs" />
                        </div>
                        <span className="text-xs font-black text-slate-200 mr-2 flex items-center gap-1.5">
                          <Eye className="w-4 h-4 text-indigo-400" />
                          <span>صورة ومعاينة فعلية لشاشة المراجعة الشاملة من حساب الطالب 📱</span>
                        </span>
                      </div>
                      <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-3 py-1 rounded-full text-[11px] font-black flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin-slow" />
                        <span>الواجهة المباشرة للطلاب</span>
                      </span>
                    </div>

                    {/* Actual Student Review Interface Container */}
                    <div className="bg-slate-100 p-4 sm:p-6 space-y-6">
                      
                      {/* Sub-View 1: Student Header & Subject Selection Portal */}
                      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
                        {/* Student Bar */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 font-black text-lg">
                              📖
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900 text-sm">الطالب: محمد أحمد علي</span>
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2.5 py-0.5 rounded-md border border-indigo-100">
                                  بوابة المراجعة التفاعلية
                                </span>
                              </div>
                              <span className="text-xs text-slate-500 font-bold block mt-0.5">
                                الصف: الرابع الابتدائي (فصل أ) • الفصل الدراسي الأول
                              </span>
                            </div>
                          </div>
                          <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full font-black flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>المواد المتاحة حسب توجيه المعلم</span>
                          </span>
                        </div>
                      </div>

                      {/* Sub-View 2: Active Question & Interactive Quiz Screen */}
                      <div className="bg-slate-900 rounded-3xl p-4 sm:p-5 text-white border border-slate-800 shadow-xl space-y-4">
                        {/* Question View Top Bar */}
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-indigo-600 text-white font-black text-xs">📐</span>
                            <div>
                              <span className="font-black text-xs text-white block">مراجعة الرياضيات - الدرس الثاني</span>
                              <span className="text-[10px] text-slate-400 font-bold">الوحدة الأولى: القيمة المنزلية</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1">
                              <Trophy className="w-3 h-3 text-amber-400" />
                              <span>+100 نقطة دراسية</span>
                            </span>
                            <span className="bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">
                              السؤال 3 من 10
                            </span>
                          </div>
                        </div>

                        {/* Interactive Question Box */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                          {/* Main Question Panel (8 cols) */}
                          <div className="lg:col-span-8 bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="bg-indigo-900/60 text-indigo-300 border border-indigo-700/50 px-2.5 py-0.5 rounded-md font-black">
                                اختر الإجابة الصحيحة
                              </span>
                              <span className="text-emerald-400 font-bold flex items-center gap-1 text-[10px]">
                                <Sparkles className="w-3 h-3" /> تصحيح آلي فوري
                              </span>
                            </div>

                            <p className="text-xs sm:text-sm font-black text-slate-100 leading-relaxed pt-1">
                              سؤال: ما هي القيمة المنزلية للرقم 7 في العدد 475,210 ؟
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold pt-1">
                              <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400">
                                أ) 700
                              </div>
                              <div className="p-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-950/80 text-emerald-200 font-black flex items-center justify-between shadow-xs">
                                <span>ب) 70,000</span>
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              </div>
                              <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400">
                                ج) 7,000
                              </div>
                              <div className="p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 text-slate-400">
                                د) 700,000
                              </div>
                            </div>

                            {/* Correct Toast */}
                            <div className="bg-emerald-600/90 border border-emerald-400/40 text-white p-2.5 rounded-xl text-center text-xs font-black shadow-sm flex items-center justify-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                              <span>أحسنت! إجابة صحيحة وتم رصد النتيجة في سجل درجات المعلم.</span>
                            </div>
                          </div>

                          {/* Lessons & Units Sidebar (4 cols) */}
                          <div className="lg:col-span-4 bg-slate-950/60 rounded-2xl p-3 border border-slate-800 space-y-2 text-xs">
                            <div className="font-black text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-1.5 text-[11px]">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                              <span>سجل الإنجازات والدروس</span>
                            </div>
                            <div className="space-y-1.5 text-[10px]">
                              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 flex justify-between items-center text-slate-300">
                                <span>1. القيمة المنزلية ضمن الملايين</span>
                                <span className="text-emerald-400 font-black">10/10 ✔</span>
                              </div>
                              <div className="p-2 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex justify-between items-center text-indigo-200 font-bold">
                                <span>2. المقارنة بين الأعداد</span>
                                <span className="text-amber-400 font-black">جاري الحل..</span>
                              </div>
                              <div className="p-2 rounded-xl bg-slate-900/50 border border-slate-800/80 flex justify-between items-center text-slate-500">
                                <span>3. ترتيب الأعداد والتقريب</span>
                                <span>لم يبدأ</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Section 1: Simplified Explanation Cards for Teachers */}
                  <div className="bg-gradient-to-br from-indigo-50/90 via-slate-50 to-purple-50/50 p-6 rounded-3xl border border-indigo-100 shadow-sm space-y-5">
                    <div className="flex items-center gap-2.5 text-indigo-900 font-black text-sm">
                      <Sparkles className="w-5 h-5 text-indigo-600" />
                      <span>فكرة المراجعة الشاملة للمنهج 💡 (دليل المعلم السريع)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
                      <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-2xs space-y-2">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-sm">1</div>
                        <h4 className="text-xs font-black text-slate-800">توجيه مرن حسب الصف والفصل</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                          يمكنك اختيار المادة وتحديد الصف والفصل المستهدف (أو جميع الصفوف) لتظهر خصيصاً للطلاب المطلوبين.
                        </p>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-2xs space-y-2">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">2</div>
                        <h4 className="text-xs font-black text-slate-800">أسئلة تفاعلية وتدريبات</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                          يولّد النظام تدريبات وأسئلة تفاعلية لكل درس مباشرة من بنك الأسئلة المعتمد لديك في المنصة.
                        </p>
                      </div>

                      <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-2xs space-y-2">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm">3</div>
                        <h4 className="text-xs font-black text-slate-800">رصد وحفظ تلقائي للنتائج</h4>
                        <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                          يتلقى الطالب تصحيحاً فورياً، ويتم تسجِيل جميع الإجابات والدرجات تلقائياً لتستعرضها في سجل النتائج.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : filteredSubjects.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-14 h-14 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                    <Search className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800">لا توجد نتائج مطابقة للبحث</h3>
                  <p className="text-xs text-slate-400 font-semibold">جرب البحث باسم مادة أخرى مضافة للمراجعة</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSubjects.map((subject, sIdx) => {
                    const isVisible = visibleSubjects.includes(subject.name);
                    const isSaving = savingId === subject.name;
                    const targetInfo = subjectTargets[subject.name] || {};
                    const currentGradeTarget = targetInfo.targetGrade || "جميع الصفوف (عام)";
                    const rawClassTarget = targetInfo.targetClass || "جميع الفصول (عام)";
                    const currentQLimit = targetInfo.questionsPerLesson || "15";

                    const isGradeConfigured = Boolean(
                      configuredGradeSubjects[subject.name] ||
                      (targetInfo.targetGrade && targetInfo.targetGrade !== "جميع الصفوف (عام)") ||
                      (targetInfo.targetClass && targetInfo.targetClass !== "جميع الفصول (عام)") ||
                      targetInfo.isCustomized
                    );

                    const isQLimitConfigured = Boolean(
                      configuredQLimitSubjects[subject.name] ||
                      (targetInfo.questionsPerLesson && targetInfo.questionsPerLesson !== "15") ||
                      targetInfo.isCustomized
                    );

                    const availableClassesForGrade = getAvailableClassesForGrade(currentGradeTarget);
                    const currentClassTarget = (rawClassTarget === "جميع الفصول (عام)" || availableClassesForGrade.includes(rawClassTarget))
                      ? rawClassTarget
                      : "جميع الفصول (عام)";

                    return (
                      <div 
                        key={`admin-sub-${subject.name}-${sIdx}`}
                        className="p-5 flex flex-col gap-4 bg-white rounded-2xl border-2 border-slate-300 hover:border-indigo-500 shadow-sm transition-all"
                      >
                        {/* Top Details & Action Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                                <span className="text-[10px] font-extrabold bg-indigo-50 border border-indigo-200/60 text-indigo-700 px-2 py-0.5 rounded-md flex items-center gap-1 select-none">
                                  <Users className="w-3 h-3 text-indigo-500 shrink-0" />
                                  {currentGradeTarget === "جميع الصفوف (عام)" && currentClassTarget === "جميع الفصول (عام)"
                                    ? "متاحة لجميع الصفوف والفصول"
                                    : `الهدف: ${currentGradeTarget} ${currentClassTarget !== "جميع الفصول (عام)" ? `(${currentClassTarget})` : ""}`}
                                </span>
                                <span className="text-[10px] font-extrabold bg-amber-50 border border-amber-200/60 text-amber-800 px-2 py-0.5 rounded-md flex items-center gap-1 select-none">
                                  <HelpCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                  {currentQLimit === "all" || !currentQLimit
                                    ? "عرض جميع أسئلة الدرس"
                                    : `${currentQLimit} أسئلة في كل درس`}
                                </span>
                              </div>

                              <p className="text-xs text-slate-400 font-semibold font-sans">
                                تحتوي على: {subject.unitCount} وحدات مراجعة • {subject.lessonCount} دروس فرعية مجهزة بالأسئلة
                              </p>
                            </div>
                          </div>

                          {/* Status Badge & Delete Button */}
                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            {/* Status Badge */}
                            <div className="font-sans">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-extrabold shadow-2xs select-none">
                                <Eye className="w-3.5 h-3.5" />
                                <span>نشطة ومرئية للطلاب</span>
                              </span>
                            </div>

                            {/* Remove Subject Button */}
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => setSubjectToDelete(subject.name)}
                              title="حذف المادة من قائمة المراجعة"
                              className="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200/80 hover:border-rose-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف المادة</span>
                            </button>
                          </div>
                        </div>

                        {/* Grade, Class and Questions-Per-Lesson Targeting Selection Bar */}
                        <div className="pt-3.5 p-3.5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs border-t-2 border-slate-200 bg-slate-50/80 transition-all">
                          {/* Grade & Class Target */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                            <div className="flex items-center gap-1.5 text-slate-700 font-extrabold shrink-0">
                              <Sliders className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span>توجيه المادة للطلاب:</span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Target Grade Selector */}
                              <div className="relative flex items-center" title="الصف الدراسي المستهدف">
                                <span className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-indigo-600 z-10">
                                  <GraduationCap className="w-4 h-4" />
                                </span>
                                <select
                                  value={currentGradeTarget}
                                  onFocus={() => setConfiguredGradeSubjects((prev) => ({ ...prev, [subject.name]: true }))}
                                  onChange={(e) => {
                                    setConfiguredGradeSubjects((prev) => ({ ...prev, [subject.name]: true }));
                                    updateSubjectTarget(subject.name, e.target.value, currentClassTarget, currentQLimit);
                                  }}
                                  className={`bg-white rounded-xl pr-8 pl-3 py-1.5 font-bold text-slate-800 text-xs focus:outline-none cursor-pointer transition-all ${
                                    !isGradeConfigured
                                      ? "animate-pulse ring-2 ring-indigo-500 border-2 border-indigo-600 bg-indigo-50/60 shadow-md shadow-indigo-200"
                                      : "border border-indigo-300 hover:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-2xs"
                                  }`}
                                >
                                  <option value="جميع الصفوف (عام)">جميع الصفوف (عام)</option>
                                  {allAvailableGrades.map((g) => (
                                    <option key={g} value={g}>
                                      {g}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Target Class Selector */}
                              <div className="relative flex items-center" title="الفصل / الشعبة المستهدفة">
                                <span className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-emerald-600 z-10">
                                  <Users className="w-4 h-4" />
                                </span>
                                <select
                                  value={currentClassTarget}
                                  onFocus={() => setConfiguredGradeSubjects((prev) => ({ ...prev, [subject.name]: true }))}
                                  onChange={(e) => {
                                    setConfiguredGradeSubjects((prev) => ({ ...prev, [subject.name]: true }));
                                    updateSubjectTarget(subject.name, currentGradeTarget, e.target.value, currentQLimit);
                                  }}
                                  className={`bg-white rounded-xl pr-8 pl-3 py-1.5 font-bold text-slate-800 text-xs focus:outline-none cursor-pointer transition-all ${
                                    !isGradeConfigured
                                      ? "animate-pulse ring-2 ring-emerald-500 border-2 border-emerald-600 bg-emerald-50/60 shadow-md shadow-emerald-200"
                                      : "border border-emerald-300 hover:border-emerald-400 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-2xs"
                                  }`}
                                >
                                  <option value="جميع الفصول (عام)">جميع الفصول (عام)</option>
                                  {availableClassesForGrade.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>

                          {/* Questions Per Lesson Limit Selector */}
                          <div className="flex items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/60">
                            <div className="flex items-center gap-1.5 text-slate-700 font-extrabold shrink-0" title="عدد الأسئلة المعروضة للطالب في كل درس">
                              <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>أسئلة كل درس:</span>
                            </div>

                            <div className="relative flex items-center">
                              <select
                                value={String(currentQLimit)}
                                onFocus={() => setConfiguredQLimitSubjects((prev) => ({ ...prev, [subject.name]: true }))}
                                onChange={(e) => {
                                  setConfiguredQLimitSubjects((prev) => ({ ...prev, [subject.name]: true }));
                                  updateSubjectTarget(subject.name, currentGradeTarget, currentClassTarget, e.target.value);
                                }}
                                className={`bg-white rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs focus:outline-none cursor-pointer transition-all ${
                                  !isQLimitConfigured
                                    ? "animate-pulse ring-2 ring-amber-500 border-2 border-amber-600 bg-amber-50/60 shadow-md shadow-amber-200"
                                    : "border border-amber-300 hover:border-amber-400 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-2xs"
                                }`}
                              >
                                <option value="all">عرض جميع الأسئلة المتاحة</option>
                                <option value="5">5 أسئلة في كل درس</option>
                                <option value="10">10 أسئلة في كل درس</option>
                                <option value="15">15 سؤالاً في كل درس</option>
                                <option value="20">20 سؤالاً في كل درس</option>
                                <option value="25">25 سؤالاً في كل درس</option>
                                <option value="30">30 سؤالاً في كل درس</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <div className={`w-full text-right font-sans ${isFullScreenResults ? "flex-1 min-h-0 flex flex-col" : ""}`}>
            <motion.div
              key="results-section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={
                isFullScreenResults
                  ? "bg-slate-50 border border-slate-200 w-full rounded-3xl shadow-xs flex flex-col p-4 md:p-6 gap-4 flex-1 min-h-0"
                  : "space-y-6"
              }
            >


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
                <div className={`overflow-auto ${
                  isFullScreenResults 
                    ? showFilters 
                      ? "flex-1 min-h-[300px] max-h-[calc(100vh-300px)]" 
                      : "flex-1 min-h-[400px] max-h-[calc(100vh-140px)]" 
                    : "max-h-[85vh]"
                }`}>
                  <table className="w-full border-collapse min-w-[900px]">
                    <thead>
                      {/* Row 1: Units Super-Headers */}
                      <tr className={`bg-slate-100 border-b border-slate-200 ${tableClasses.trUnit}`}>
                        <th rowSpan={2} className={`${tableClasses.numCell} text-right font-black text-slate-800 border-l border-slate-200 bg-slate-100 sticky top-0 right-0 z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`}>#</th>
                        <th rowSpan={2} className={`${tableClasses.studentCell} text-right font-black text-slate-800 border-l border-slate-200 bg-slate-100 sticky top-0 ${tableClasses.studentRight} z-40 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] align-middle`}>
                          <div className="flex flex-col gap-1.5 py-0.5">
                            {/* Top row: Fullscreen & Filters toggle button */}
                            <div className="flex flex-col gap-1 items-center justify-center">
                              {/* Maximize / Minimize button */}
                              <button
                                type="button"
                                onClick={() => {
                                  const nextFS = !isFullScreenResults;
                                  handleToggleFullScreen(nextFS);
                                  if (nextFS) {
                                    setShowFilters(false);
                                  } else {
                                    setShowFilters(true);
                                  }
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-sm font-black rounded-xl transition-all border border-emerald-500 cursor-pointer shadow-md shrink-0 w-full"
                                title={isFullScreenResults ? "تصغير الشاشة" : "تكبير ملء الشاشة"}
                              >
                                {isFullScreenResults ? (
                                  <>
                                    <Minimize2 className="w-5 h-5" />
                                    <span>تصغير ↩</span>
                                  </>
                                ) : (
                                  <>
                                    <Maximize2 className="w-5 h-5" />
                                    <span>ملء الشاشة ⛶</span>
                                  </>
                                )}
                              </button>

                              {isFullScreenResults && (
                                <button
                                  type="button"
                                  onClick={() => setShowFilters(!showFilters)}
                                  className="flex items-center justify-center gap-1.5 px-2 py-1 bg-slate-200/90 hover:bg-slate-300 text-slate-800 text-[10.5px] font-black rounded-lg transition-all border border-slate-300/80 cursor-pointer w-full shadow-2xs"
                                  title={showFilters ? "إخفاء فلاتر التصفية" : "إظهار فلاتر التصفية"}
                                >
                                  <Filter className="w-3.5 h-3.5 text-slate-600" />
                                  <span>{showFilters ? "طوي الفلاتر 🔼" : "عرض الفلاتر 🔽"}</span>
                                </button>
                              )}
                            </div>

                            {/* Density options inside header */}
                            <div className="flex items-center gap-0.5 bg-white p-0.5 rounded-lg border border-slate-200/90 text-slate-900 shadow-2xs w-full">
                              <button
                                type="button"
                                onClick={() => setTableDensity("normal")}
                                className={`flex-1 py-0.5 text-[9px] sm:text-[9.5px] font-black rounded transition-all cursor-pointer text-center ${
                                  tableDensity === "normal"
                                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-2xs"
                                    : "text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                عادي
                              </button>
                              <button
                                type="button"
                                onClick={() => setTableDensity("compact")}
                                className={`flex-1 py-0.5 text-[9px] sm:text-[9.5px] font-black rounded transition-all cursor-pointer text-center ${
                                  tableDensity === "compact"
                                    ? "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-2xs"
                                    : "text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                مكثف
                              </button>
                              <button
                                type="button"
                                onClick={() => setTableDensity("ultra-compact")}
                                className={`flex-1 py-0.5 text-[9px] sm:text-[9.5px] font-black rounded transition-all cursor-pointer text-center ${
                                  tableDensity === "ultra-compact"
                                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-2xs"
                                    : "text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                دقيق
                              </button>
                            </div>


                          </div>
                        </th>
                        
                        {activeSyllabus.units.map((unit, index) => {
                          const colColor = UNIT_COLORS[index % UNIT_COLORS.length];
                          return (
                            <th
                              key={unit.name}
                              colSpan={unit.lessons.length}
                              className={`${tableClasses.thUnit} text-center font-black border-l border-slate-200 ${colColor} sticky top-0 z-30`}
                            >
                              {unit.name}
                            </th>
                          );
                        })}
                      </tr>

                      {/* Row 2: Lessons Headers */}
                      <tr className={`bg-slate-50 border-b border-slate-250 ${tableClasses.trLesson}`}>
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

      {/* Add Subject From Question Bank Modal */}
      {isAddSubjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsAddSubjectModalOpen(false)} 
          />

          {/* Modal Dialog */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden relative z-10 text-right font-sans flex flex-col max-h-[85vh]"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-blue-50/50 to-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                  <BookPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">إضافة مادة للمراجعة</h3>
                  <p className="text-xs text-slate-500 font-semibold">اختر المواد التي ترغب بإظهارها للطلاب (يمكنك إضافة أكثر من مادة معاً)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSubjectModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: List of Available Bank Subjects with Filters */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 min-h-0">
              {unaddedBankSubjects.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <div className="w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-500">
                    <Database className="w-7 h-7" />
                  </div>
                  {allBankSubjects.length === 0 ? (
                    <>
                      <h4 className="text-sm font-black text-slate-800">لا توجد مواد مجهزة في بنك الأسئلة</h4>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                        يرجى أولاً إنشاء أسئلة دراسية في "بنك الأسئلة" وتحديد اسم المادة والدرس، وسوف تظهر هنا تلقائياً لتمكين إضافتها.
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="text-sm font-black text-slate-800">جميع مواد بنك الأسئلة تم إضافتها بالفعل!</h4>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                        لقد قمت بإضافة كافة المواد المتاحة في بنك الأسئلة لجدول المراجعة الشاملة.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Search and Filters Controls Bar */}
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2.5">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                      {/* Search Input */}
                      <div className="relative w-full sm:flex-1">
                        <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                          <Search className="w-4 h-4" />
                        </span>
                        <input
                          type="text"
                          placeholder="البحث باسم المادة..."
                          value={modalSearchQuery}
                          onChange={(e) => setModalSearchQuery(e.target.value)}
                          className="w-full pr-9 pl-8 py-1.5 bg-white border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-right shadow-2xs"
                        />
                        {modalSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setModalSearchQuery("")}
                            className="absolute inset-y-0 left-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Stage Filter Dropdown */}
                      <div className="relative w-full sm:w-auto min-w-[130px]">
                        <span className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-purple-600 z-10">
                          <Layers className="w-4 h-4" />
                        </span>
                        <select
                          value={modalStageFilter}
                          onChange={(e) => setModalStageFilter(e.target.value)}
                          className="w-full bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl pr-8 pl-3 py-1.5 font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 cursor-pointer shadow-2xs transition-all"
                        >
                          <option value="all">جميع المراحل</option>
                          <option value="primary">المرحلة الابتدائية</option>
                          <option value="middle">المرحلة المتوسطة</option>
                          <option value="secondary">المرحلة الثانوية</option>
                        </select>
                      </div>

                      {/* Grade Filter Dropdown */}
                      <div className="relative w-full sm:w-auto min-w-[135px]">
                        <span className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-indigo-600 z-10">
                          <GraduationCap className="w-4 h-4" />
                        </span>
                        <select
                          value={modalGradeFilter}
                          onChange={(e) => setModalGradeFilter(e.target.value)}
                          className="w-full bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl pr-8 pl-3 py-1.5 font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer shadow-2xs transition-all"
                        >
                          <option value="all">جميع الصفوف ({unaddedBankSubjects.length})</option>
                          {allAvailableGrades.map((g, gIdx) => (
                            <option key={`modal-grade-opt-${g}-${gIdx}`} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Filter Status Bar */}
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>
                          المواد المعروضة: <span className="text-indigo-600 font-extrabold">{filteredUnaddedBankSubjects.length}</span> من أصل <span className="text-slate-700 font-extrabold">{unaddedBankSubjects.length}</span> مادة
                        </span>
                      </div>

                      {(modalSearchQuery || modalStageFilter !== "all" || modalGradeFilter !== "all") && (
                        <button
                          type="button"
                          onClick={() => {
                            setModalSearchQuery("");
                            setModalStageFilter("all");
                            setModalGradeFilter("all");
                          }}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline font-bold transition-colors cursor-pointer"
                        >
                          إعادة ضبط الفلاتر
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filtered Subjects List */}
                  {filteredUnaddedBankSubjects.length === 0 ? (
                    <div className="py-8 text-center space-y-2.5 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                      <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <Filter className="w-5 h-5" />
                      </div>
                      <h5 className="text-xs font-black text-slate-800">لا توجد مواد تطابق خيارات التصفية</h5>
                      <p className="text-[11px] text-slate-400 font-semibold">جرب تغيير الكلمة المفتاحية أو اختيار مرحلة أو صف دراسي آخر</p>
                      <button
                        type="button"
                        onClick={() => {
                          setModalSearchQuery("");
                          setModalStageFilter("all");
                          setModalGradeFilter("all");
                        }}
                        className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        إلغاء الفلاتر
                      </button>
                    </div>
                  ) : (
                    filteredUnaddedBankSubjects.map((sub, subIdx) => (
                      <div
                        key={`modal-unadded-sub-${sub.name}-${subIdx}`}
                        className="p-4 rounded-2xl border border-slate-200/90 bg-slate-50/60 hover:bg-indigo-50/30 hover:border-indigo-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-indigo-600 flex items-center justify-center font-bold shadow-2xs group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-black text-slate-900">{sub.name}</h4>
                              {sub.grades && sub.grades.length > 0 && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  <GraduationCap className="w-3 h-3 text-indigo-500" />
                                  <span>{sub.grades.join("، ")}</span>
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              تتضمن {sub.unitCount} وحدات • {sub.lessonCount} دروس • {sub.questionCount} أسئلة
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={savingId === sub.name}
                          onClick={() => addSubjectFromBank(sub.name)}
                          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-black shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                        >
                          {savingId === sub.name ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          <span>إضافة وتفعيل المادة</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsAddSubjectModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {subjectToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
              onClick={() => setSubjectToDelete(null)} 
            />

            {/* Dialog */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden relative z-10 text-right font-sans p-6 space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-600 flex items-center justify-center shrink-0 shadow-xs">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تأكيد حذف المادة</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">من قائمة المراجعة الشاملة</p>
                </div>
              </div>

              <div className="text-sm font-bold text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100/90 space-y-1">
                <p>
                  هل أنت تأكد من إزالة مادة <span className="text-rose-600 font-black">"{subjectToDelete}"</span> من قائمة المراجعة؟
                </p>
                <p className="text-xs font-semibold text-slate-450 pt-1">
                  لن تظهر المادة للطلاب بعد الحذف، ويمكنك إعادتها في أي وقت من بنك الأسئلة.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSubjectToDelete(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={savingId === subjectToDelete}
                  onClick={async () => {
                    if (subjectToDelete) {
                      const name = subjectToDelete;
                      await removeSubjectFromReview(name);
                      setSubjectToDelete(null);
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-black shadow-md shadow-rose-200 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {savingId === subjectToDelete ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>تأكيد الحذف</span>
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
