import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  BookOpen,
  Users,
  CheckSquare,
  TrendingUp,
  Plus,
  Trash2,
  Eye,
  Award,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Search,
  PlusCircle,
  Check,
  Share2,
  Copy,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  BarChart3,
  HelpCircle,
  Calendar,
  Layers,
  X,
  Eraser,
  Info,
  Database,
  RefreshCw,
  Sparkles,
  Upload,
  AlertTriangle,
  Settings,
  Play,
  Pause,
  Pencil,
  ClipboardList,
  Library,
  Shuffle,
  Lock,
  Link,
  LayoutDashboard,
  LogOut,
  MoreVertical,
  LayoutGrid,
  List,
  Home,
  EyeOff,
  Download,
  Printer,
  FileSpreadsheet,
  Gamepad2,
  Trophy,
  Timer,
  Zap,
  Key,
  UserCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import {
  Quiz,
  Student,
  Question,
  QuestionType,
  TeacherStats,
  BankQuestion,
  ReviewChallenge,
  ReviewScore,
} from "./types";
import { isTrueFalseQuestion, normalizeQuestion } from "./utils/questionUtils";
import {
  initialQuizzes,
  initialStudents,
  initialStats,
} from "./mockData";
import QuestionBankTab from "./components/QuestionBankTab";
import ReviewsAdminTab from "./components/ReviewsAdminTab";
import StudentReviewsTab from "./components/StudentReviewsTab";
import StudentCurriculumReview from "./components/StudentCurriculumReview";
import CurriculumReviewAdminTab from "./components/CurriculumReviewAdminTab";
import { RegisteredTeachersTab } from "./components/RegisteredTeachersTab";
import { UnitLessonMultiSelect } from "./components/UnitLessonMultiSelect";
import { QuestionBankSmartFilters } from "./components/QuestionBankSmartFilters";
import { initializeApp, getApp, getApps } from "firebase/app";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User,
  getAuth,
  signInWithCredential,
} from "firebase/auth";
import { db, auth, handleFirestoreError, OperationType, firebaseConfig, saveCustomFirebaseConfig, clearCustomFirebaseConfig, getCustomFirebaseConfig, getDefaultFirestore, getFirestoreForDb, getDefaultAuth, defaultFirebaseConfig, isCustomFirebaseActive } from "./firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  getDoc,
  limit,
  writeBatch,
} from "firebase/firestore";

const DEFAULT_GRADES: string[] = [];

const DEFAULT_SEMESTERS: string[] = [];

const normalizeSemesterName = (name: string) => {
  if (!name) return "";
  let base = name.trim().toLowerCase();
  base = base
    .replace("الدراسي ", "")
    .replace("شعبة ", "")
    .replace("الشعبة ", "")
    .replace("الفصل ", "")
    .trim();
  base = base
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, "");
  return base;
};

const normalizeGradeName = (name: string) => {
  if (!name) return "";
  let base = name.trim().toLowerCase();
  base = base
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
  return base;
};

function parseFirebaseConfig(pastedText: string): any {
  if (!pastedText || !pastedText.trim()) return null;
  // If it's a valid JSON, just parse it
  try {
    return JSON.parse(pastedText.trim());
  } catch (e) {
    // Ignore JSON error and try regex
  }

  // Regex to extract fields
  const fields = ["apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId", "databaseURL", "firestoreDatabaseId"];
  const config: any = {};
  let found = false;

  for (const field of fields) {
    const regex = new RegExp(`['"]?${field}['"]?\\s*:\\s*['"\`]([^'"\`]+)['"\`]`);
    const match = pastedText.match(regex);
    if (match && match[1]) {
      config[field] = match[1].trim();
      found = true;
    }
  }

  if (found && config.apiKey && config.projectId) {
    return config;
  }
  return null;
}

const QUIZ_TEMPLATES: any[] = [];

export default function App() {
  // Navigation active tab
  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "builder"
    | "analytics"
    | "students"
    | "question_bank"
    | "student_results"
    | "manage_student_portal"
    | "reviews_admin"
    | "curriculum_review_admin"
    | "registered_teachers"
  >("dashboard");
  const [quizViewMode, setQuizViewMode] = useState<"grid" | "list">("grid");
  const [teacherPreviewActive, setTeacherPreviewActive] =
    useState<boolean>(false);
  const [isCurriculumAdminFullScreen, setIsCurriculumAdminFullScreen] =
    useState<boolean>(false);



  // Dynamic Grades and Semesters States
  const [grades, setGrades] = useState<string[]>([]);
  const [semesters, setSemesters] = useState<
    Array<{ id: string; name: string; gradeName: string; number?: number; createdAt?: number }>
  >([]);
  const [gradesLoaded, setGradesLoaded] = useState(false);
  const [semestersLoaded, setSemestersLoaded] = useState(false);
  const [showGradesSemestersModal, setShowGradesSemestersModal] =
    useState(false);
  const [modalSeeding, setModalSeeding] = useState(false);
  const [selectedManageGrade, setSelectedManageGrade] = useState<string | null>(
    null,
  );

  const [newGradeInput, setNewGradeInput] = useState("");
  const [newSemesterInput, setNewSemesterInput] = useState("");
  const [newSemesterNumber, setNewSemesterNumber] = useState<number>(1);
  const [selectedSemesterNumbers, setSelectedSemesterNumbers] = useState<number[]>([]);
  const [editingGrade, setEditingGrade] = useState<{
    original: string;
    current: string;
  } | null>(null);
  const [editingSemester, setEditingSemester] = useState<{
    original: string;
    current: string;
    number?: number;
  } | null>(null);

  // Helper function to sort grades by natural numerical value or Arabic word value ascending
  const sortGradesByNumber = useCallback((a: string, b: string) => {
    // Extract numbers (supporting multiple digits)
    const numA = a.match(/\d+/);
    const numB = b.match(/\d+/);
    
    if (numA && numB) {
      const valA = parseInt(numA[0], 10);
      const valB = parseInt(numB[0], 10);
      if (valA !== valB) {
        return valA - valB;
      }
    } else if (numA) {
      return -1; // Elements with digits come first
    } else if (numB) {
      return 1;
    }
    
    // If no digits found, check for written Arabic numbers
    const arabicNumbersMap: { [key: string]: number } = {
      "الأول": 1, "الاول": 1,
      "الثاني": 2,
      "الثالث": 3,
      "الرابع": 4,
      "الخامس": 5,
      "السادس": 6,
      "السابع": 7,
      "الثامن": 8,
      "التاسع": 9,
      "العاشر": 10,
      "الحادي عشر": 11,
      "الثاني عشر": 12
    };
    
    let valA = 999;
    let valB = 999;
    
    for (const [key, val] of Object.entries(arabicNumbersMap)) {
      if (a.includes(key)) {
        valA = val;
        break;
      }
    }
    for (const [key, val] of Object.entries(arabicNumbersMap)) {
      if (b.includes(key)) {
        valB = val;
        break;
      }
    }
    
    if (valA !== valB) {
      return valA - valB;
    }
    
    // Natural sorting fallback
    return a.localeCompare(b, "ar", { numeric: true });
  }, []);

  // Helper function to sort semesters/classes by natural numerical value or Arabic word value ascending
  const sortSemestersByNumber = useCallback((a: string, b: string) => {
    const hasDigitsA = /\d/.test(a);
    const hasDigitsB = /\d/.test(b);

    if (!hasDigitsA || !hasDigitsB) {
      const arabicNumbersMap: { [key: string]: number } = {
        "الأول": 1, "الاول": 1, "الأولى": 1, "الاولى": 1, "أ": 1,
        "الثاني": 2, "الثانية": 2, "ب": 2,
        "الثالث": 3, "الثالثة": 3, "ج": 3,
        "الرابع": 4, "الرابعة": 4, "د": 4,
        "الخامس": 5, "الخامسة": 5, "هـ": 5,
        "السادس": 6, "السادسة": 6,
        "السابع": 7, "السابعة": 7,
        "الثامن": 8, "الثامنة": 8,
        "التاسع": 9, "التاسعة": 9,
        "العاشر": 10, "العاشرة": 10,
        "الحادي عشر": 11, "الثاني عشر": 12
      };

      let valA = -1;
      let valB = -1;

      for (const [key, val] of Object.entries(arabicNumbersMap)) {
        if (a.includes(key)) {
          valA = val;
          break;
        }
      }
      for (const [key, val] of Object.entries(arabicNumbersMap)) {
        if (b.includes(key)) {
          valB = val;
          break;
        }
      }

      if (valA !== -1 && valB !== -1) {
        if (valA !== valB) return valA - valB;
      } else if (valA !== -1) {
        return -1;
      } else if (valB !== -1) {
        return 1;
      }
    }

    return a.localeCompare(b, "ar", { numeric: true });
  }, []);

  const gradesList = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const g of grades) {
      if (!g) continue;
      const norm = normalizeGradeName(g) || g.trim();
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push(g);
      }
    }
    return result.sort(sortGradesByNumber);
  }, [grades, sortGradesByNumber]);

  // Custom Universal Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);

  const [isConfirmLoading, setIsConfirmLoading] = useState(false);

  const triggerConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    onCancel?: () => void,
    confirmText = "نعم، تأكيد والمتابعة",
    cancelText = "إلغاء الإجراء",
  ) => {
    setConfirmDialog({
      title,
      message,
      onConfirm: async () => {
        setIsConfirmLoading(true);
        try {
          await onConfirm();
        } catch (error: any) {
          console.error("Confirmation action failed:", error);
          triggerToast(
            `حدث خطأ أثناء تنفيذ الإجراء: ${error.message || error}`,
            "error",
          );
        } finally {
          setIsConfirmLoading(false);
          setConfirmDialog(null);
        }
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setConfirmDialog(null);
      },
      confirmText,
      cancelText,
    });
  };

  // Firebase Auth State
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(
    undefined,
  );
  const [authErrorDetails, setAuthErrorDetails] = useState<{
    code?: string;
    message?: string;
    domain?: string;
  } | null>(null);

  const [showCustomFirebaseForm, setShowCustomFirebaseForm] = useState(false);
  const [customFirebaseInput, setCustomFirebaseInput] = useState("");
  const [customFirebaseError, setCustomFirebaseError] = useState("");



  // Check for student mode in URL params
  const urlParams = new URLSearchParams(window.location.search);
  let studentQuizId = urlParams.get("quizId") || urlParams.get("quizid") || urlParams.get("quizID");
  if (!studentQuizId) {
    // Robust check for any case-insensitive variants or letter l (lemon) vs I (indigo) typos in quizId / quizld
    for (const [key, value] of urlParams.entries()) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === "quizid" || lowerKey === "quizld") {
        studentQuizId = value;
        break;
      }
    }
  }

  // Student Mode States - Loaded dynamically from localStorage to ensure survival/resume
  const [studentQuiz, setStudentQuiz] = useState<Quiz | null>(() => {
    try {
      const activeId = localStorage.getItem("seb_student_logged_id");
      if (!activeId) return null;
      const saved = localStorage.getItem(`seb_student_${activeId}_quiz`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [studentQuizLoading, setStudentQuizLoading] = useState(false);
  const [studentQuizError, setStudentQuizError] = useState<string | null>(null);
  const [studentQuizStarted, setStudentQuizStarted] = useState(() => {
    const activeId = localStorage.getItem("seb_student_logged_id");
    if (!activeId) return false;
    return localStorage.getItem(`seb_student_${activeId}_quiz_started`) === "true";
  });
  const [studentQuizFinished, setStudentQuizFinished] = useState(() => {
    const activeId = localStorage.getItem("seb_student_logged_id");
    if (!activeId) return false;
    return localStorage.getItem(`seb_student_${activeId}_quiz_finished`) === "true";
  });

  // Student Portal-wide states
  const [studentPortalActive, setStudentPortalActive] = useState<boolean>(
    () => {
      // If teacher portal is explicitly requested via URL parameter
      if (
        urlParams.get("teacher") === "true" ||
        urlParams.get("portal") === "teacher" ||
        urlParams.get("portal") === "bank" ||
        urlParams.get("bank") === "true"
      ) {
        return false;
      }
      // Main site root URL opens the main landing page
      return true;
    },
  );

  const [studentPortalTicker, setStudentPortalTicker] = useState<number>(0);
  useEffect(() => {
    if (!studentPortalActive) return;
    const interval = setInterval(() => {
      setStudentPortalTicker((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [studentPortalActive]);

  // Standalone Question Bank Portal state
  const [bankPortalActive, setBankPortalActive] = useState<boolean>(() => {
    return (
      urlParams.get("portal") === "bank" ||
      urlParams.get("bank") === "true"
    );
  });
  const [studentPortalTeacherId, setStudentPortalTeacherId] = useState<
    string | null
  >(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTId = params.get("teacherId");
    if (urlTId) {
      localStorage.setItem("seb_student_teacher_id", urlTId);
      return urlTId;
    }
    
    // If there's no teacherId and no quizId in the URL parameters and no portal param,
    // we should NOT use a cached teacherId. This forces the code entry screen.
    const quizId = params.get("quizId") || params.get("quizid") || params.get("quizID");
    const hasPortalParam = params.get("portal") === "student";
    if (!quizId && !hasPortalParam && params.toString() === "") {
      return null;
    }
    
    return localStorage.getItem("seb_student_teacher_id");
  });

  const [studentPortalTeacherName, setStudentPortalTeacherName] = useState<string>("");

  useEffect(() => {
    if (!studentPortalTeacherId) {
      setStudentPortalTeacherName("");
      return;
    }
    
    // If the logged-in user in Auth is the teacher matching this ID, use their displayName directly
    if (currentUser && currentUser.uid === studentPortalTeacherId) {
      setStudentPortalTeacherName(currentUser.displayName || currentUser.email?.split("@")[0] || "المعلم");
      return;
    }
    
    const getTeacherName = async () => {
      try {
        const teacherDoc = await getDoc(doc(db, "teachers", studentPortalTeacherId));
        if (teacherDoc.exists()) {
          const tData = teacherDoc.data();
          setStudentPortalTeacherName(tData.displayName || tData.email?.split("@")[0] || "المعلم");
        } else {
          setStudentPortalTeacherName("المعلم");
        }
      } catch (err) {
        console.warn("Could not fetch teacher name:", err);
        setStudentPortalTeacherName("المعلم");
      }
    };
    
    getTeacherName();
  }, [studentPortalTeacherId, currentUser]);
  const [studentLoggedInId, setStudentLoggedInId] = useState<string | null>(
    () => {
      return localStorage.getItem("seb_student_logged_id");
    },
  );
  const [studentCustomExamCode, setStudentCustomExamCode] = useState("");
  const [selectedCompletedQuizData, setSelectedCompletedQuizData] =
    useState<Quiz | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [studentActiveNav, setStudentActiveNav] =
    useState<"home" | "quizzes" | "reviews" | "curriculum_review">("home");
  const [studentReviewGameState, setStudentReviewGameState] =
    useState<"idle" | "playing" | "finished">("idle");
  const [selectedCurriculumSubject, setSelectedCurriculumSubject] =
    useState<string | null>(null);



  // Student Enrollment / Creation States
  const [studentSelectedClass, setStudentSelectedClass] =
    useState("الصف العاشر - أ");
  const [studentSelectedGrade, setStudentSelectedGrade] = useState(() => {
    return localStorage.getItem("seb_student_grade") || "الصف العاشر";
  });
  const [studentSelectedSemester, setStudentSelectedSemester] = useState(() => {
    return localStorage.getItem("seb_student_semester") || "الفصل الأول";
  });
  const [studentSelectedSection, setStudentSelectedSection] = useState("أ");
  const [studentSelectedId, setStudentSelectedId] = useState(() => {
    return localStorage.getItem("seb_student_logged_id") || "";
  });
  const [studentLoginSelectId, setStudentLoginSelectId] = useState("");
  const [studentLoginPassword, setStudentLoginPassword] = useState("");
  const [studentLoginConfirmPassword, setStudentLoginConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordErrorShake, setPasswordErrorShake] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState("");
  const [studentNameInput, setStudentNameInput] = useState("");
  const [studentEmailInput, setStudentEmailInput] = useState("");
  const [studentNewToggle, setStudentNewToggle] = useState(false);

  // Student progress inside the test
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>(() => {
    try {
      const activeId = localStorage.getItem("seb_student_logged_id");
      if (!activeId) return {};
      const saved = localStorage.getItem(`seb_student_${activeId}_quiz_answers`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [quizTimer, setQuizTimer] = useState(() => {
    const activeId = localStorage.getItem("seb_student_logged_id");
    if (!activeId) return 0;
    const savedEnd = localStorage.getItem(`seb_student_${activeId}_quiz_end_timestamp`);
    if (savedEnd) {
      const end = parseInt(savedEnd, 10);
      const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
      return remaining;
    }
    const savedTimer = localStorage.getItem(`seb_student_${activeId}_quiz_timer`);
    return savedTimer ? parseInt(savedTimer, 10) : 0;
  }); // seconds remaining
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [currentStudentQuestionIdx, setCurrentStudentQuestionIdx] = useState(() => {
    const activeId = localStorage.getItem("seb_student_logged_id");
    if (!activeId) return 0;
    const savedIdx = localStorage.getItem(`seb_student_${activeId}_quiz_question_idx`);
    return savedIdx ? parseInt(savedIdx, 10) : 0;
  });
  const [reviewResultQuestionIdx, setReviewResultQuestionIdx] = useState(0);

  // Load/synchronize state when active student changes
  useEffect(() => {
    if (!studentSelectedId) {
      setStudentQuiz(null);
      setStudentQuizStarted(false);
      setStudentQuizFinished(false);
      setQuizAnswers({});
      setCurrentStudentQuestionIdx(0);
      setQuizTimer(0);
      return;
    }

    // Load for this specific student
    try {
      const savedQuiz = localStorage.getItem(`seb_student_${studentSelectedId}_quiz`);
      const quizObj = savedQuiz ? JSON.parse(savedQuiz) as Quiz : null;
      setStudentQuiz(quizObj);

      if (quizObj) {
        const qKey = quizObj.id || quizObj.title;

        const started = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_started`) === "true";
        setStudentQuizStarted(started);

        const finished = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_finished`) === "true";
        setStudentQuizFinished(finished);

        const savedAnswers = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_answers`);
        setQuizAnswers(savedAnswers ? JSON.parse(savedAnswers) : {});

        const savedIdx = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_question_idx`);
        setCurrentStudentQuestionIdx(savedIdx ? parseInt(savedIdx, 10) : 0);

        const savedEnd = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_end_timestamp`);
        if (savedEnd) {
          const end = parseInt(savedEnd, 10);
          const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
          setQuizTimer(remaining);
        } else {
          const savedTimer = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_timer`);
          setQuizTimer(savedTimer ? parseInt(savedTimer, 10) : 0);
        }
      } else {
        setStudentQuizStarted(false);
        setStudentQuizFinished(false);
        setQuizAnswers({});
        setCurrentStudentQuestionIdx(0);
        setQuizTimer(0);
      }
    } catch (e) {
      console.error("Error loading student-specific quiz state:", e);
    }
  }, [studentSelectedId]);

  // Synchronize student exam active states to localStorage for resilience
  useEffect(() => {
    if (!studentSelectedId) return;
    if (studentQuiz) {
      localStorage.setItem(`seb_student_${studentSelectedId}_quiz`, JSON.stringify(studentQuiz));
      const qKey = studentQuiz.id || studentQuiz.title;
      localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}`, JSON.stringify(studentQuiz));
    } else {
      localStorage.removeItem(`seb_student_${studentSelectedId}_quiz`);
    }
  }, [studentQuiz, studentSelectedId]);

  useEffect(() => {
    if (!studentSelectedId) return;
    localStorage.setItem(`seb_student_${studentSelectedId}_quiz_started`, studentQuizStarted ? "true" : "false");
    if (studentQuiz && studentQuizStarted) {
      const qKey = studentQuiz.id || studentQuiz.title;
      localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}_started`, "true");
    }
  }, [studentQuizStarted, studentSelectedId, studentQuiz]);

  useEffect(() => {
    if (!studentSelectedId) return;
    localStorage.setItem(`seb_student_${studentSelectedId}_quiz_finished`, studentQuizFinished ? "true" : "false");
    if (studentQuiz) {
      const qKey = studentQuiz.id || studentQuiz.title;
      localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}_finished`, studentQuizFinished ? "true" : "false");
    }
  }, [studentQuizFinished, studentSelectedId, studentQuiz]);

  useEffect(() => {
    if (!studentSelectedId) return;
    localStorage.setItem(`seb_student_${studentSelectedId}_quiz_answers`, JSON.stringify(quizAnswers));
    if (studentQuiz) {
      const qKey = studentQuiz.id || studentQuiz.title;
      localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}_answers`, JSON.stringify(quizAnswers));
    }
  }, [quizAnswers, studentSelectedId, studentQuiz]);

  useEffect(() => {
    if (!studentSelectedId) return;
    localStorage.setItem(`seb_student_${studentSelectedId}_quiz_question_idx`, currentStudentQuestionIdx.toString());
    if (studentQuiz) {
      const qKey = studentQuiz.id || studentQuiz.title;
      localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}_question_idx`, currentStudentQuestionIdx.toString());
    }
  }, [currentStudentQuestionIdx, studentSelectedId, studentQuiz]);

  // Clean-up active quiz state helper
  const resetActiveQuizState = () => {
    if (studentSelectedId) {
      localStorage.removeItem(`seb_student_${studentSelectedId}_quiz`);
      localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_started`);
      localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_finished`);
      localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_answers`);
      localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_question_idx`);
      localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_end_timestamp`);
      localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_timer`);

      if (studentQuiz) {
        const qKey = studentQuiz.id || studentQuiz.title;
        localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_${qKey}`);
        localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_${qKey}_started`);
        localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_${qKey}_finished`);
        localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_${qKey}_answers`);
        localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_${qKey}_question_idx`);
        localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_${qKey}_end_timestamp`);
        localStorage.removeItem(`seb_student_${studentSelectedId}_quiz_${qKey}_timer`);
      }
    }

    setStudentQuiz(null);
    setStudentQuizStarted(false);
    setStudentQuizFinished(false);
    setQuizAnswers({});
    setCurrentStudentQuestionIdx(0);
    setQuizTimer(0);
  };

  // Student score display variables
  const [quizScore, setQuizScore] = useState(0);
  const [quizTotalPoints, setQuizTotalPoints] = useState(0);
  const [quizPercentage, setQuizPercentage] = useState(0);

  // Clear password inputs when changing student choices
  useEffect(() => {
    setStudentLoginPassword("");
    setStudentLoginConfirmPassword("");
    setShowPassword(false);
    setPasswordErrorShake(false);
    setPasswordErrorMessage("");
  }, [studentLoginSelectId, studentSelectedGrade, studentSelectedSemester, studentSelectedId]);

  // Core Data States from Firestore
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [trashStudents, setTrashStudents] = useState<Student[]>([]);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [selectedDeleteStudentIds, setSelectedDeleteStudentIds] = useState<
    Record<string, boolean>
  >({});
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [bankQuestionsLoaded, setBankQuestionsLoaded] = useState<boolean>(false);
  const [reviewChallenges, setReviewChallenges] = useState<ReviewChallenge[]>([]);
  const [reviewScores, setReviewScores] = useState<ReviewScore[]>([]);

  // Question Bank Import States inside Quiz Builder
  const [showBankImportModal, setShowBankImportModal] = useState(false);
  const [showBankImportInline, setShowBankImportInline] = useState(false);
  const [importSelectedBqIds, setImportSelectedBqIds] = useState<
    Record<string, boolean>
  >({});
  const [importFilterStage, setImportFilterStage] = useState("all");
  const [importFilterGrade, setImportFilterGrade] = useState("all");
  const [importFilterSubject, setImportFilterSubject] = useState("all");
  const [importFilterSemester, setImportFilterSemester] = useState("all");
  const [importFilterUnit, setImportFilterUnit] = useState("all");
  const [importFilterLesson, setImportFilterLesson] = useState("all");
  const [importFilterLessons, setImportFilterLessons] = useState<string[]>([]);
  const [importSearch, setImportSearch] = useState("");

  // Builder Automatic Quiz Creation states
  const [showBuilderAutoQuizModal, setShowBuilderAutoQuizModal] = useState(false);
  const [autoBuilderMcqCount, setAutoBuilderMcqCount] = useState(0);
  const [autoBuilderTfCount, setAutoBuilderTfCount] = useState(0);

  // Clear selected lessons when parent levels change
  useEffect(() => {
    setImportFilterLessons([]);
  }, [importFilterStage, importFilterGrade, importFilterSubject, importFilterSemester]);

  // Derived Import Filter Statistics
  const importStatTotal = bankQuestions.length;
  const filteredImportQuestions = bankQuestions.filter((q) => {
    const ms =
      importSearch.trim() === "" ||
      q.text.toLowerCase().includes(importSearch.toLowerCase()) ||
      q.unit.toLowerCase().includes(importSearch.toLowerCase()) ||
      q.lesson.toLowerCase().includes(importSearch.toLowerCase());
    const mst = importFilterStage === "all" || q.stage === importFilterStage;
    const mgr = importFilterGrade === "all" || q.grade === importFilterGrade;
    const msu =
      importFilterSubject === "all" || q.subject === importFilterSubject;
    const msem =
      importFilterSemester === "all" || q.semester === importFilterSemester;
    const mls =
      importFilterLessons.length === 0 ||
      importFilterLessons.includes(`${q.unit} | ${q.lesson}`);
    return ms && mst && mgr && msu && msem && mls;
  });
  const filteredImportCount = filteredImportQuestions.length;

  // Derived Statistics
  const [stats, setStats] = useState<TeacherStats>(initialStats);

  useEffect(() => {
    // Check for redirect login result on mount
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          triggerToast(
            "مرحباً بك مجدداً دكتور! تم تسجيل الدخول بنجاح.",
            "success",
          );
        }
      })
      .catch((error: any) => {
        console.error("Redirect login failure: ", error);
        setAuthErrorDetails({
          code: error.code,
          message: error.message,
          domain: window.location.hostname,
        });
      });

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        localStorage.setItem("seb_student_teacher_id", user.uid);
        localStorage.removeItem("seb_student_logged_id");
        setStudentPortalTeacherId(user.uid);
        
        // Save original platform teacher UID to localStorage if we are running on the default platform app
        if (!isCustomFirebaseActive()) {
          localStorage.setItem("platform_teacher_uid", user.uid);
          console.log("Saved original platform UID to localStorage:", user.uid);
        }

        // Save/update teacher profile in Firestore
        setDoc(doc(db, "teachers", user.uid), {
          uid: user.uid,
          displayName: user.displayName || user.email?.split("@")[0] || "المعلم",
          email: user.email || ""
        }, { merge: true }).catch(err => {
          console.error("Error saving teacher profile:", err);
        });
      } else {
        // Reset all teacher state and clear student teacher cache when logged out
        setQuizzes([]);
        setStudents([]);
        setBankQuestions([]);
        setGrades([]);
        setSemesters([]);
        setTrashStudents([]);
        setReviewChallenges([]);
        setReviewScores([]);
        setStudentPortalTeacherId(null);
        localStorage.removeItem("seb_student_teacher_id");
        localStorage.removeItem("seb_student_logged_id");
      }
    });
    return () => unsubscribe();
  }, []);

  const executeSafeGoogleLogin = async (customMessage?: string) => {
    const provider = new GoogleAuthProvider();
    try {
      // Authenticate directly using the active Firebase project's Auth instance
      const result = await signInWithPopup(auth, provider);
      
      triggerToast(
        customMessage || "مرحباً بك مجدداً دكتور! تم تسجيل الدخول بنجاح.",
        "success"
      );
      return result.user;
    } catch (error: any) {
      console.error("Login failure:", error);
      if (error.code === "auth/popup-closed-by-user") {
        triggerToast("⚠️ تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية. يرجى إعادة المحاولة مع إبقاء النافذة مفتوحة.", "info");
      } else {
        setAuthErrorDetails({
          code: error.code,
          message: error.message,
          domain: window.location.hostname,
        });
        triggerToast(
          `فشل تسجيل الدخول: ${error.message || error}`,
          "error"
        );
      }
      throw error;
    }
  };

  // Sync / Inject Student Mode Preview Banner Dynamically to avoid complex nested JSX modifications
  useEffect(() => {
    if (teacherPreviewActive) {
      // Create banner element
      const banner = document.createElement("div");
      banner.id = "teacher-student-preview-banner";
      banner.className =
        "fixed top-0 left-0 right-0 h-11 bg-rose-600 text-white flex items-center justify-between px-4 z-[999999] shadow-md select-none border-b border-rose-700/50";
      banner.setAttribute("dir", "rtl");

      const textContainer = document.createElement("div");
      textContainer.className =
        "flex items-center gap-2 font-sans text-xs font-black";
      textContainer.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
        <span>💡 وضع "معاينة صفحة الطالب" (أنت تتصفح حالياً من منظور الطالب للتأكد من المحتوى)</span>
      `;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "bg-white text-rose-700 hover:bg-rose-50 px-3 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer shadow-3xs active:scale-95";
      btn.innerText = "العودة للوحة المعلم ⏎";
      btn.onclick = () => {
        setTeacherPreviewActive(false);
      };

      banner.appendChild(textContainer);
      banner.appendChild(btn);
      document.body.appendChild(banner);

      // Inject top margin or padding to body so content isn't covered
      document.body.style.paddingTop = "44px";

      return () => {
        document.body.style.paddingTop = "";
        const existing = document.getElementById(
          "teacher-student-preview-banner",
        );
        if (existing) existing.remove();
      };
    }
  }, [teacherPreviewActive]);

  // Dynamic Title and Favicon based on studentPortalActive
  useEffect(() => {
    // 1. Update Title dynamically
    if (studentPortalActive) {
      document.title = "بوابة الطالب الإلكترونية";
    } else {
      document.title = "بوابة المعلم التعليمية";
    }

    // 2. Update Favicon dynamically using clean detailed school emblems as SVG data URLs
    const studentFaviconMedia = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%2310b981"/><path d="M16 8 L6 13 L16 18 L26 13 Z" fill="%23ffffff"/><path d="M10 16.5 V21.5 C10 23 12 24 16 24 C20 24 22 23 22 21.5 V16.5" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="13" r="2" fill="%23fcd34d"/></svg>`;
    const teacherFaviconMedia = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%234f46e5"/><path d="M16 6 L6 11 L16 16 L26 11 Z" fill="%23ffffff"/><path d="M11 15 V19 C11 20.5 13 21.5 16 21.5 C19 21.5 21 20.5 21 19 V15" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round"/><path d="M23 12 V18" fill="none" stroke="%23fcd34d" stroke-width="2" stroke-linecap="round"/><circle cx="23" cy="19.5" r="1.5" fill="%23fcd34d"/></svg>`;

    const faviconUrl = studentPortalActive
      ? studentFaviconMedia
      : teacherFaviconMedia;

    // Try finding existing favicon or create one
    let link: HTMLLinkElement | null =
      document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.getElementsByTagName("head")[0].appendChild(link);
    }
    link.type = "image/svg+xml";
    link.href = faviconUrl;
  }, [studentPortalActive]);

  // Note: Disabled auto-switch so main page always lands on main home portal first

  // Export to Google Sheets directly using the official Sheets API
  const exportToGoogleSheetsDirectly = async (headers: string[], rows: any[][], grade: string, semester: string) => {
    let token = googleAccessToken;

    const exportToExcelFallback = (msg?: string) => {
      if (msg) triggerToast(msg, "info");
      try {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "نتائج الطلاب");
        XLSX.writeFile(wb, `كشف_درجات_الطلاب_${grade || "العام"}_${semester || "الأول"}.xlsx`);
        triggerToast("🎉 تم تصدير كشف الدرجات كملف Excel بنجاح!", "success");
      } catch (excelErr: any) {
        triggerToast(`فشل تصدير Excel: ${excelErr.message || excelErr}`, "error");
      }
    };

    const requestGoogleToken = async () => {
      triggerToast("💡 جاري طلب صلاحيات Google Sheets...", "info");
      
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/spreadsheets");
      provider.addScope("https://www.googleapis.com/auth/drive.file");
      
      provider.setCustomParameters({
        prompt: "select_account consent",
        access_type: "offline"
      });
      
      let tempApp;
      if (getApps().some(app => app.name === "temp-google-sheets")) {
        tempApp = getApp("temp-google-sheets");
      } else {
        tempApp = initializeApp(defaultFirebaseConfig, "temp-google-sheets");
      }
      const tempAuth = getAuth(tempApp);
      
      // Must call signInWithPopup immediately without async delay to prevent browser popup block
      const result = await signInWithPopup(tempAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        return credential.accessToken;
      } else {
        throw new Error("لم نتمكن من الحصول على رمز الدخول من Google");
      }
    };
    
    if (!token) {
      try {
        token = await requestGoogleToken();
      } catch (error: any) {
        console.error("OAuth error:", error);
        setGoogleAccessToken(null);
        if (error.code === "auth/popup-blocked") {
          exportToExcelFallback("⚠️ تم حظر النافذة المنبثقة من المتصفح! تم تصدير كشف الدرجات كملف Excel تلقائياً.");
        } else if (error.code === "auth/popup-closed-by-user") {
          exportToExcelFallback("⚠️ تم إغلاق نافذة تسجيل الدخول. تم تصدير كشف الدرجات كملف Excel.");
        } else {
          exportToExcelFallback(`⚠️ تعذر ربط Google (${error.message || "خطأ صلاحيات"}). تم التصدير إلى Excel تلقائياً.`);
        }
        return;
      }
    }

    try {
      triggerToast("جاري إنشاء جدول بيانات Google Sheets جديد...", "info");
      
      let createResponse = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          properties: {
            title: `كشف درجات - الصف ${grade || ""} - الفصل ${semester || ""}`
          }
        })
      });

      // If cached token expired or failed authorization, clear it and export to Excel fallback
      if (!createResponse.ok && (createResponse.status === 401 || createResponse.status === 403)) {
        setGoogleAccessToken(null);
        console.warn("Google Sheets token expired or invalid permission, falling back to Excel");
        exportToExcelFallback("⚠️ انتهاء صلاحية الجلسة أو نقص الصلاحيات في Google Sheets. تم التصدير فورياً كملف Excel بديل!");
        return;
      }

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        console.error("Create spreadsheet error:", errorData);
        setGoogleAccessToken(null);
        exportToExcelFallback("⚠️ تعذر إنشاء جدول Google Sheets. تم التصدير كملف Excel بنجاح!");
        return;
      }

      const spreadsheet = await createResponse.json();
      const spreadsheetId = spreadsheet.spreadsheetId;
      const spreadsheetUrl = spreadsheet.spreadsheetUrl;

      triggerToast("جاري تصدير درجات الطلاب والملف الآن...", "info");

      const sheetName = spreadsheet.sheets?.[0]?.properties?.title || "Sheet1";
      
      const writeResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            values: [headers, ...rows]
          })
        }
      );

      if (!writeResponse.ok) {
        const errorData = await writeResponse.json().catch(() => ({}));
        console.error("Write spreadsheet values error:", errorData);
        setGoogleAccessToken(null);
        exportToExcelFallback("⚠️ تعذر كتابة كافة البيانات في Google Sheets. تم تنزيل الملف كاملاً كـ Excel!");
        return;
      }

      triggerToast("🎉 تم إنشاء الجدول بنجاح وتصدير كافة الدرجات إليه مباشرة!", "success");
      
      if (spreadsheetUrl) {
        window.open(spreadsheetUrl, "_blank");
      } else {
        window.open(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`, "_blank");
      }
    } catch (err: any) {
      console.error("Export directly error:", err);
      exportToExcelFallback("⚠️ حدث خطأ في عملية التصدير السحابي. تم تصدير كشف الدرجات كملف Excel فوري!");
    }
  };

  // Student Loader Hook
  useEffect(() => {
    if (!studentPortalActive && !teacherPreviewActive && !studentQuizId) {
      return;
    }

    const urlParamsObj = new URLSearchParams(window.location.search);
    const cachedTeacherId = urlParamsObj.get("teacherId") || localStorage.getItem("seb_student_teacher_id");
    const targetQuizId = studentQuizId;

    // Determine the active teacher UID for loading students/grades in Student Mode
    let tUid = cachedTeacherId;
    if (teacherPreviewActive && currentUser) {
      tUid = currentUser.uid;
    } else if (studentPortalActive && currentUser && !tUid) {
      tUid = currentUser.uid;
    }

    let unsubStudents: (() => void) | null = null;
    let unsubQuizzes: (() => void) | null = null;
    let unsubQuestionBank: (() => void) | null = null;

    const fetchQuizAndStudents = async () => {
      setStudentQuizLoading(true);
      setStudentQuizError(null);
      try {
        let currentTuid = tUid;

        // Fallback: Disable guessing a random teacher's ID globally when no context is provided.
        // Instead, we require an explicit teacherId or quizId to prevent showing other teachers' rosters.

        if (!targetQuizId && !currentTuid) {
          setStudentQuizLoading(false);
          return;
        }

        if (targetQuizId && targetQuizId !== "portal") {
          try {
            let loadedQuiz: Quiz | null = null;
            
            // 1. Try secure backend API first (strips answers for students)
            try {
              const res = await fetch(`/api/student/get-quiz/${encodeURIComponent(targetQuizId)}`);
              if (res.ok) {
                const resJson = await res.json();
                if (resJson.success && resJson.quiz) {
                  loadedQuiz = resJson.quiz as Quiz;
                }
              }
            } catch (apiErr) {
              console.warn("Secure API fetch failed, trying direct Firestore fallback:", apiErr);
            }

            // 2. Direct Firestore fallback (for logged-in teachers previewing)
            if (!loadedQuiz) {
              const quizDoc = await getDoc(doc(db, "quizzes", targetQuizId));
              if (quizDoc.exists()) {
                loadedQuiz = quizDoc.data() as Quiz;
              }
            }

            if (loadedQuiz) {
              const qData = loadedQuiz;
              setStudentQuiz(qData);
              setQuizTimer(qData.durationMinutes * 60);
              const qTeacherId = (qData as any).teacherId;
              if (qTeacherId) {
                currentTuid = qTeacherId;
              }

              // Match grade & semester
              if (qData.grade) {
                setStudentSelectedGrade(qData.grade);
                if (qData.semester && qData.semester !== "جميع الفصول") {
                  const firstSem = qData.semester.split(",")[0].trim();
                  if (firstSem) setStudentSelectedSemester(firstSem);
                }
              }
            } else {
              if (!currentTuid) {
                setStudentQuizError(
                  "لم نتمكن من العثور على هذا الاختبار، يرجى التأكد من الرابط الصحيح أو الرمز المدخل.",
                );
                setStudentQuizLoading(false);
                return;
              }
            }
          } catch (quizErr) {
            console.error("Error reading quiz document:", quizErr);
          }
        }

        if (currentTuid) {
          try {
            // Keep synced
            if (studentPortalTeacherId !== currentTuid) {
              if (studentPortalTeacherId) {
                setStudentSelectedId("");
                localStorage.removeItem("seb_student_logged_id");
              }
              setStudentPortalTeacherId(currentTuid);
            }
            localStorage.setItem("seb_student_teacher_id", currentTuid);

            // Subscribe to students list in real-time
            try {
              unsubStudents = onSnapshot(
                query(collection(db, "students"), where("teacherId", "==", currentTuid)),
                (snapshot) => {
                  const list: Student[] = [];
                  snapshot.forEach((doc) => {
                    const data = doc.data() as Student;
                    if (data.detailedGrades) {
                      const originalLength = data.detailedGrades.length;
                      data.detailedGrades = data.detailedGrades.filter(
                        (g) => g.quizTitle !== "اختبار تجريبي تمهيدي",
                      );
                      if (originalLength !== data.detailedGrades.length) {
                        let sumEarned = 0;
                        let sumMax = 0;
                        data.detailedGrades.forEach((g) => {
                          sumEarned += g.score;
                          sumMax += g.maxScore;
                        });
                        data.averageScore =
                          data.detailedGrades.length > 0
                            ? Math.round((sumEarned / (sumMax || 1)) * 100)
                            : 0;
                        data.status =
                          data.averageScore >= 90
                            ? "excellent"
                            : data.averageScore >= 75
                              ? "good"
                              : data.averageScore >= 60
                                ? "average"
                                : "needs_improvement";
                      }
                    }
                    list.push(data);
                  });
                  list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
                  setStudents(list);
                },
                (studentsErr) => {
                  console.warn("Failed to listen to students in student portal:", studentsErr);
                }
              );
            } catch (studentsErr) {
              console.warn("Failed to set up student listener in student portal:", studentsErr);
            }

            // Subscribe to quizzes list in real-time
            try {
              unsubQuizzes = onSnapshot(
                query(collection(db, "quizzes"), where("teacherId", "==", currentTuid)),
                (snapshot) => {
                  const qList: Quiz[] = [];
                  snapshot.forEach((doc) => {
                    const data = doc.data() as Quiz;
                    const normalizedQs = (data.questions || []).map((q) => normalizeQuestion(q));
                    qList.push({ ...data, questions: normalizedQs });
                  });
                  qList.sort((a, b) => b.dateCreated.localeCompare(a.dateCreated));
                  setQuizzes(qList);
                },
                (quizzesErr) => {
                  console.warn("Failed to listen to quizzes in student portal:", quizzesErr);
                }
              );
            } catch (quizzesErr) {
              console.warn("Failed to set up quizzes listener in student portal:", quizzesErr);
            }

            // Subscribe to question_bank list in real-time
            try {
              unsubQuestionBank = onSnapshot(
                query(collection(db, "question_bank"), where("teacherId", "==", currentTuid)),
                (snapshot) => {
                  const qbList: BankQuestion[] = [];
                  snapshot.forEach((doc) => {
                    qbList.push(normalizeQuestion(doc.data() as BankQuestion));
                  });
                  setBankQuestions(qbList);
                  setBankQuestionsLoaded(true);
                },
                (qbErr) => {
                  console.warn("Failed to listen to question_bank in student portal:", qbErr);
                  setBankQuestionsLoaded(true);
                }
              );
            } catch (qbErr) {
              console.warn("Failed to set up question_bank listener in student portal:", qbErr);
              setBankQuestionsLoaded(true);
            }

            // Fetch teacher's custom grades
            try {
              const gradesSnap = await getDocs(
                query(collection(db, "grades"), where("teacherId", "==", currentTuid)),
              );
              const gItems = gradesSnap.docs.map((doc) => {
                const data = doc.data();
                return {
                  name: data.name as string,
                  createdAt: data.createdAt || 0,
                  id: doc.id,
                };
              });
              gItems.sort((a, b) => {
                const timeA = a.createdAt || 0;
                const timeB = b.createdAt || 0;
                if (timeA !== timeB) {
                  return timeA - timeB; // oldest first
                }
                return a.id.localeCompare(b.id);
              });
              const gList = gItems.map((item) => item.name);
              if (gList.length > 0) {
                setGrades(gList);
              }
              setGradesLoaded(true);
            } catch (gradesErr) {
              console.warn("Failed to fetch grades in student portal:", gradesErr);
              setGradesLoaded(true);
            }

            // Fetch teacher's custom semesters
            try {
              const semestersSnap = await getDocs(
                query(
                  collection(db, "semesters"),
                  where("teacherId", "==", currentTuid),
                ),
              );
              const semList: Array<{
                id: string;
                name: string;
                gradeName: string;
                number?: number;
                createdAt?: number;
              }> = [];
              semestersSnap.forEach((doc) => {
                const d = doc.data();
                semList.push({
                  id: d.id || doc.id,
                  name: d.name || "",
                  gradeName: d.gradeName || "",
                  number: d.number !== undefined ? Number(d.number) : undefined,
                  createdAt: d.createdAt || 0,
                });
              });
              if (semList.length > 0) {
                setSemesters(semList);
              }
              setSemestersLoaded(true);
            } catch (semestersErr) {
              console.warn("Failed to fetch semesters in student portal:", semestersErr);
              setSemestersLoaded(true);
            }
          } catch (studentFetchErr) {
            console.warn(
              "Could not fetch students roster or settings:",
              studentFetchErr,
            );
            setStudentNewToggle(true);
          }
        }
      } catch (err) {
        console.error("Error loading student quiz: ", err);
        setStudentQuizError(
          "عذراً، حدث خطأ فني أثناء جلب بيانات الاختبار من الخادم السحابي.",
        );
      } finally {
        setStudentQuizLoading(false);
      }
    };

    fetchQuizAndStudents();

    return () => {
      if (unsubStudents) unsubStudents();
      if (unsubQuizzes) unsubQuizzes();
      if (unsubQuestionBank) unsubQuestionBank();
    };
  }, [studentQuizId, studentPortalActive, studentPortalTeacherId, teacherPreviewActive, currentUser?.uid]);



  // Student Quiz Countdown Timer Hook (supporting survival inside/outside active screen)
  useEffect(() => {
    // If there's no active quiz or it's already finished, do not run the timer
    if (!studentQuiz || studentQuizFinished || !studentSelectedId) return;

    const qKey = studentQuiz.id || studentQuiz.title;

    // If untimed, don't run any tick down timer!
    if (studentQuiz.durationMinutes === 9999) {
      setQuizTimer(999999);
      return;
    }

    // Is there an end timestamp?
    let endTimestampStr = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_end_timestamp`);
    if (!endTimestampStr && studentQuizStarted) {
      // If quiz started and no timestamp exists, create one!
      const end = Date.now() + (studentQuiz.durationMinutes * 60 * 1000);
      localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}_end_timestamp`, end.toString());
      endTimestampStr = end.toString();
    }

    if (!endTimestampStr) return;
    const end = parseInt(endTimestampStr, 10);

    const checkAndTick = () => {
      const remaining = Math.max(0, Math.round((end - Date.now()) / 1000));
      setQuizTimer(remaining);
      localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}_timer`, remaining.toString());
      localStorage.setItem(`seb_student_${studentSelectedId}_quiz_timer`, remaining.toString()); // backwards compatibility

      if (remaining <= 0) {
        // Auto submit when time runs out!
        handleStudentSubmitQuiz(true);
      }
    };

    // Run once immediately
    checkAndTick();

    const interval = setInterval(checkAndTick, 1000);
    return () => clearInterval(interval);
  }, [studentQuiz, studentQuizStarted, studentQuizFinished, studentSelectedId]);

  // Student Score Submissions Handler
  const handleStudentSubmitQuiz = async (isAutoSubmit = false) => {
    if (!studentQuiz) return;
    setQuizSubmitting(true);

    let currentStudentName = "";
    let currentStudentEmail = "";
    let currentStudentClass = `${studentSelectedGrade} - ${studentSelectedSemester}`;
    let targetStudentId = studentSelectedId;

    if (studentNewToggle || !studentSelectedId) {
      if (!studentNameInput.trim()) {
        triggerToast(
          "يرجى كتابة اسمك الثلاثي لطباعته في وثيقة النتيجة",
          "error",
        );
        setQuizSubmitting(false);
        return;
      }
      currentStudentName = studentNameInput.trim();
      currentStudentEmail =
        studentEmailInput.trim() || `${Date.now()}@student.edu`;
      targetStudentId = `s-${Date.now()}`;
    } else {
      const match = students.find((s) => s.id === studentSelectedId);
      if (match) {
        currentStudentName = match.name;
        currentStudentClass = match.gradeClass;
        currentStudentEmail = match.email;
      }
    }

    try {
      // 1. Submit answers to secure server endpoint for evaluation
      const response = await fetch("/api/student/submit-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizId: studentQuiz.id,
          answers: quizAnswers,
          studentInfo: {
            studentId: targetStudentId,
            name: currentStudentName,
            email: currentStudentEmail,
            gradeClass: currentStudentClass,
            grade: studentSelectedGrade,
            semester: studentSelectedSemester,
            isNewStudent: studentNewToggle || !studentSelectedId,
          },
        }),
      });

      if (response.ok) {
        const resData = await response.json();
        if (resData.success) {
          setQuizScore(resData.score);
          setQuizTotalPoints(resData.totalPoints);
          setQuizPercentage(resData.percentage);

          if (resData.targetStudentId) {
            setStudentSelectedId(resData.targetStudentId);
            localStorage.setItem("seb_student_logged_id", resData.targetStudentId);
          }
          if (studentNewToggle) {
            setStudentNewToggle(false);
          }

          // If detailed results with answers were returned for post-test review, populate them in studentQuiz
          if (Array.isArray(resData.detailedQuestionResults) && resData.detailedQuestionResults.length > 0) {
            setStudentQuiz((prev) => {
              if (!prev) return prev;
              const updatedQs = prev.questions.map((q) => {
                const evaluated = resData.detailedQuestionResults.find((r: any) => r.questionId === q.id);
                if (evaluated && evaluated.correctAnswer !== undefined) {
                  return { ...q, correctAnswer: evaluated.correctAnswer };
                }
                return q;
              });
              return { ...prev, questions: updatedQs };
            });
          }

          setStudentQuizFinished(true);
          const qKey = studentQuiz.id || studentQuiz.title;
          localStorage.setItem(`seb_student_${targetStudentId}_quiz_${qKey}_finished`, "true");
          setQuizSubmitting(false);

          if (isAutoSubmit) {
            triggerToast(
              "انتهى الوقت المحدد للاختبار! تم تسليم وتصحيح ورقة إجابتك في الخادم تلقائياً.",
              "info",
            );
          } else {
            triggerToast(
              "تم تسليم وتصحيح ورقة إجابتك في الخادم بنجاح! رائع جداً.",
              "success",
            );
          }
          return;
        }
      }

      // 2. Client-side fallback if server endpoint is unavailable
      let earnedPoints = 0;
      let totalPoints = 0;

      studentQuiz.questions.forEach((q) => {
        totalPoints += q.points;
        const ans = quizAnswers[q.id];
        if (ans !== undefined && q.correctAnswer && ans === q.correctAnswer) {
          earnedPoints += q.points;
        }
      });

      const pct = Math.round((earnedPoints / (totalPoints || 1)) * 100);
      setQuizScore(earnedPoints);
      setQuizTotalPoints(totalPoints);
      setQuizPercentage(pct);

      const gRecord = {
        quizTitle: studentQuiz.title,
        score: earnedPoints,
        maxScore: totalPoints,
        date: new Date().toISOString().split("T")[0],
        passed: pct >= 60,
      };

      const teacherUid = (studentQuiz as any).teacherId || "";

      if (studentNewToggle || !studentSelectedId) {
        // Form a brand new Student record
        const newStudentObj: Student = {
          id: targetStudentId,
          name: currentStudentName,
          gradeClass: currentStudentClass,
          grade: studentSelectedGrade,
          semester: studentSelectedSemester,
          email: currentStudentEmail,
          averageScore: pct,
          status:
            pct >= 90
              ? "excellent"
              : pct >= 75
                ? "good"
                : pct >= 60
                  ? "average"
                  : "needs_improvement",
          detailedGrades: [gRecord],
        };

        await setDoc(doc(db, "students", targetStudentId), {
          ...newStudentObj,
          teacherId: teacherUid,
        });

        // Update local state and log the new student in
        setStudents((prev) => [...prev, newStudentObj]);
        setStudentSelectedId(targetStudentId);
        setStudentNewToggle(false);
        localStorage.setItem("seb_student_logged_id", targetStudentId);
      } else {
        // Read and update the existing Student profile array
        const origStudent = students.find((s) => s.id === studentSelectedId);
        if (origStudent) {
          const updatedGrades = [...origStudent.detailedGrades, gRecord];

          let sumEarned = 0;
          let sumMax = 0;
          updatedGrades.forEach((g) => {
            sumEarned += g.score;
            sumMax += g.maxScore;
          });
          const newAvg = Math.round((sumEarned / (sumMax || 1)) * 100);
          const newStatus =
            newAvg >= 90
              ? "excellent"
              : newAvg >= 75
                ? "good"
                : newAvg >= 60
                  ? "average"
                  : "needs_improvement";

          await updateDoc(doc(db, "students", studentSelectedId), {
            detailedGrades: updatedGrades,
            averageScore: newAvg,
            status: newStatus,
          });

          // Update local state of students list
          setStudents((prev) =>
            prev.map((s) =>
              s.id === studentSelectedId
                ? {
                    ...s,
                    detailedGrades: updatedGrades,
                    averageScore: newAvg,
                    status: newStatus,
                  }
                : s,
            ),
          );
        }
      }

      setStudentQuizFinished(true);
      const qKey = studentQuiz.id || studentQuiz.title;
      localStorage.setItem(`seb_student_${targetStudentId}_quiz_${qKey}_finished`, "true");

      if (isAutoSubmit) {
        triggerToast(
          "انتهى الوقت المحدود للاجابة، وتم تسليم اختبارك تلقائياً بنجاح!",
          "info",
        );
      } else {
        triggerToast(
          "عمل رائع! تم رصد حلولك وإرسال نتيجتك للمعلم بنجاح",
          "success",
        );
      }
    } catch (err) {
      console.error("Quiz submission error: ", err);
      triggerToast(
        "عذراً، واجهنا مشكلة في تخزين البيانات، حاول تسليم الورقة مجدداً.",
        "error",
      );
    } finally {
      setQuizSubmitting(false);
    }
  };

  // Listen to Firestore real-time updates when logged in
  useEffect(() => {
    if (!currentUser) {
      setQuizzes([]);
      setStudents([]);
      setBankQuestions([]);
      setGrades([]);
      setSemesters([]);
      setTrashStudents([]);
      return;
    }
    if (studentPortalActive || teacherPreviewActive) return;

    const quizzesQuery = query(
      collection(db, "quizzes"),
      where("teacherId", "==", currentUser.uid),
    );
    const unsubscribeQuizzes = onSnapshot(
      quizzesQuery,
      (snapshot) => {
        const list: Quiz[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as Quiz;
          const normalizedQs = (data.questions || []).map((q) => normalizeQuestion(q));
          list.push({ ...data, questions: normalizedQs });
        });
        list.sort((a, b) => b.dateCreated.localeCompare(a.dateCreated));
        setQuizzes(list);
      },
      (error) => {
        console.warn("Error listening to quizzes:", error);
      },
    );

    const studentsQuery = query(
      collection(db, "students"),
      where("teacherId", "==", currentUser.uid),
    );
    const unsubscribeStudents = onSnapshot(
      studentsQuery,
      (snapshot) => {
        const list: Student[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as Student;
          if (data.detailedGrades) {
            const originalLength = data.detailedGrades.length;
            data.detailedGrades = data.detailedGrades.filter(
              (g) => g.quizTitle !== "اختبار تجريبي تمهيدي",
            );
            if (originalLength !== data.detailedGrades.length) {
              let sumEarned = 0;
              let sumMax = 0;
              data.detailedGrades.forEach((g) => {
                sumEarned += g.score;
                sumMax += g.maxScore;
              });
              data.averageScore =
                data.detailedGrades.length > 0
                  ? Math.round((sumEarned / (sumMax || 1)) * 100)
                  : 0;
              data.status =
                data.averageScore >= 90
                  ? "excellent"
                  : data.averageScore >= 75
                    ? "good"
                    : data.averageScore >= 60
                      ? "average"
                      : "needs_improvement";
            }
          }
          list.push(data);
        });
        list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
        setStudents(list);
      },
      (error) => {
        console.warn("Error listening to students:", error);
      },
    );

    const questionBankQuery = query(
      collection(db, "question_bank"),
    );
    const unsubscribeQuestionBank = onSnapshot(
      questionBankQuery,
      (snapshot) => {
        const list: BankQuestion[] = [];
        snapshot.forEach((doc) => {
          list.push(normalizeQuestion(doc.data() as BankQuestion));
        });
        setBankQuestions(list);
        setBankQuestionsLoaded(true);
      },
      (error) => {
        console.warn("Error listening to question bank:", error);
        setBankQuestionsLoaded(true);
      },
    );

    const gradesQuery = query(
      collection(db, "grades"),
      where("teacherId", "==", currentUser.uid),
    );
    const unsubscribeGrades = onSnapshot(
      gradesQuery,
      (snapshot) => {
        const gItems = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            name: (data.name as string) || "",
            createdAt: data.createdAt || 0,
            id: doc.id,
          };
        });
        // Deduplicate grades by normalized grade name
        const seenGrades = new Set<string>();
        const uniqueGItems = gItems.filter((item) => {
          const norm = normalizeGradeName(item.name);
          if (!norm || seenGrades.has(norm)) return false;
          seenGrades.add(norm);
          return true;
        });
        uniqueGItems.sort((a, b) => {
          const timeA = a.createdAt || 0;
          const timeB = b.createdAt || 0;
          if (timeA !== timeB) {
            return timeA - timeB; // oldest first
          }
          return a.id.localeCompare(b.id);
        });
        const list = uniqueGItems.map((item) => item.name);
        setGrades(list);
        setGradesLoaded(true);
      },
      (error) => {
        console.warn("Error listening to grades:", error);
      },
    );

    const semestersQuery = query(
      collection(db, "semesters"),
      where("teacherId", "==", currentUser.uid),
    );
    const unsubscribeSemesters = onSnapshot(
      semestersQuery,
      (snapshot) => {
        const rawList: Array<{
          id: string;
          name: string;
          gradeName: string;
          number?: number;
          createdAt?: number;
        }> = [];
        snapshot.forEach((doc) => {
          const d = doc.data();
          rawList.push({
            id: d.id || doc.id,
            name: d.name || "",
            gradeName: d.gradeName || "",
            number: d.number !== undefined ? Number(d.number) : undefined,
            createdAt: d.createdAt || 0,
          });
        });
        // Deduplicate semesters by (normalized gradeName, normalized semester name)
        const seenSemKey = new Set<string>();
        const list = rawList.filter((s) => {
          const gNorm = normalizeGradeName(s.gradeName);
          const sNorm = normalizeSemesterName(s.name);
          const key = `${gNorm}___${sNorm}`;
          if (!sNorm || seenSemKey.has(key)) return false;
          seenSemKey.add(key);
          return true;
        });
        setSemesters(list);
        setSemestersLoaded(true);
      },
      (error) => {
        console.warn("Error listening to semesters:", error);
      },
    );

    const trashQuery = query(
      collection(db, "trash_students"),
      where("teacherId", "==", currentUser.uid),
    );
    const unsubscribeTrash = onSnapshot(
      trashQuery,
      (snapshot) => {
        const list: Student[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as Student);
        });
        list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
        setTrashStudents(list);
      },
      (error) => {
        console.warn("Error loading trash students:", error);
      },
    );

    return () => {
      unsubscribeQuizzes();
      unsubscribeStudents();
      unsubscribeQuestionBank();
      unsubscribeGrades();
      unsubscribeSemesters();
      unsubscribeTrash();
    };
  }, [currentUser, studentPortalActive, teacherPreviewActive]);

  // Proactively save/update teacher profile in Firestore so students can display their name
  useEffect(() => {
    if (currentUser) {
      setDoc(doc(db, "teachers", currentUser.uid), {
        uid: currentUser.uid,
        displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "المعلم",
        email: currentUser.email || ""
      }, { merge: true }).catch(err => {
        console.error("Proactive save of teacher profile error:", err);
      });
    }
  }, [currentUser]);



  // Synchronize Review Challenges and Scores
  useEffect(() => {
    let unsubChallenges = () => {};
    let unsubScores = () => {};

    const targetTeacherId = studentPortalActive ? studentPortalTeacherId : currentUser?.uid;

    if (targetTeacherId) {
      // Listen to review challenges for this specific teacher
      const challengesQuery = query(
        collection(db, "reviewChallenges"),
        where("teacherId", "==", targetTeacherId)
      );
      unsubChallenges = onSnapshot(
        challengesQuery,
        (snapshot) => {
          const list: ReviewChallenge[] = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() } as ReviewChallenge);
          });
          list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          setReviewChallenges(list);
        },
        (error) => {
          console.warn("Failed to listen to review challenges:", error);
        }
      );

      // Listen to review scores for this specific teacher
      const scoresQuery = query(
        collection(db, "reviewScores"),
        where("teacherId", "==", targetTeacherId)
      );
      unsubScores = onSnapshot(
        scoresQuery,
        (snapshot) => {
          const list: ReviewScore[] = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...doc.data() } as ReviewScore);
          });
          setReviewScores(list);
        },
        (error) => {
          console.warn("Failed to listen to review scores:", error);
        }
      );
    } else {
      setReviewChallenges([]);
      setReviewScores([]);
    }

    return () => {
      unsubChallenges();
      unsubScores();
    };
  }, [currentUser, studentPortalTeacherId, studentPortalActive]);

  useEffect(() => {
    // Dynamically calculate stats based on actual data
    const activeQuizCount = quizzes.filter((q) => q.status === "active").length;
    const totalS = students.length;

    // Calculate global success rate
    let totalDetailedGrades = 0;
    let passedGradesCount = 0;
    students.forEach((s) => {
      s.detailedGrades.forEach((g) => {
        totalDetailedGrades++;
        if (g.passed) passedGradesCount++;
      });
    });

    const calculatedSuccessRate =
      totalDetailedGrades > 0
        ? Math.round((passedGradesCount / totalDetailedGrades) * 1000) / 10
        : 85;

    setStats({
      totalStudents: totalS,
      activeQuizzes: activeQuizCount,
      successRate: calculatedSuccessRate,
      totalHomeworks: Math.max(12, Math.floor(totalS * 0.15)),
    });
  }, [quizzes, students]);

  // Search and Filter States
  const [quizSearch, setQuizSearch] = useState("");
  const [quizFilter, setQuizFilter] = useState<"all" | "active" | "closed">(
    "all",
  );

  const [studentSearch, setStudentSearch] = useState("");
  const [studentFilter, setStudentFilter] = useState<
    "all" | "excellent" | "good" | "average" | "needs_improvement"
  >("all");
  const [studentGradeFilter, setStudentGradeFilter] = useState<string>("all");
  const [studentSemesterFilter, setStudentSemesterFilter] =
    useState<string>("all");

  // Interactive drill-down states for Students Tab (reduces screen clutter)
  const [selectedTabGrade, setSelectedTabGrade] = useState<string | null>(null);
  const [selectedTabSemester, setSelectedTabSemester] = useState<string | null>(
    null,
  );

  // Selected items for Details Modal
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedManageStudent, setSelectedManageStudent] =
    useState<Student | null>(null);

  // Global password security state for students
  const [isPasswordRequiredGlobal, setIsPasswordRequiredGlobal] =
    useState(false);

  useEffect(() => {
    if (activeTab === "students" && selectedTabGrade && selectedTabSemester) {
      const activeGrade = selectedTabGrade || "";
      const activeSemester = selectedTabSemester || "";
      const activeClassStudents = students.filter((student) => {
        const sGrade =
          student.grade ||
          (student.gradeClass && student.gradeClass.includes(" - ")
            ? student.gradeClass.split(" - ")[0].trim()
            : "الصف العاشر");
        const sSemester =
          student.semester ||
          (student.gradeClass && student.gradeClass.includes(" - ")
            ? student.gradeClass.split(" - ")[1].trim()
            : "الفصل الأول");
        return (
          normalizeGradeName(sGrade) === normalizeGradeName(activeGrade) &&
          normalizeSemesterName(sSemester) ===
            normalizeSemesterName(activeSemester)
        );
      });
      const anyRequired = activeClassStudents.some(
        (s) => s.passwordRequired === true,
      );
      setIsPasswordRequiredGlobal(anyRequired);
    }
  }, [students, selectedTabGrade, selectedTabSemester, activeTab]);

  // Scroll to top of the page when switching tabs, sections, or detail views
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [
    activeTab,
    selectedQuiz,
    selectedStudent,
    selectedManageStudent,
    selectedCompletedQuizData,
    selectedTabGrade,
    selectedTabSemester,
    teacherPreviewActive,
  ]);

  const handleTogglePasswordRequired = async (required: boolean) => {
    setIsPasswordRequiredGlobal(required);
    if (!selectedTabGrade || !selectedTabSemester) return;

    const activeGrade = selectedTabGrade || "";
    const activeSemester = selectedTabSemester || "";
    const activeClassStudents = students.filter((student) => {
      const sGrade =
        student.grade ||
        (student.gradeClass && student.gradeClass.includes(" - ")
          ? student.gradeClass.split(" - ")[0].trim()
          : "الصف العاشر");
      const sSemester =
        student.semester ||
        (student.gradeClass && student.gradeClass.includes(" - ")
          ? student.gradeClass.split(" - ")[1].trim()
          : "الفصل الأول");
      return (
        normalizeGradeName(sGrade) === normalizeGradeName(activeGrade) &&
        normalizeSemesterName(sSemester) ===
          normalizeSemesterName(activeSemester)
      );
    });

    try {
      const batch = writeBatch(db);
      activeClassStudents.forEach((student) => {
        const studentRef = doc(db, "students", student.id);
        batch.update(studentRef, { passwordRequired: required });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error updating passwordRequired in batch", err);
    }

    triggerToast(
      required
        ? "تم تفعيل متطلب كلمة المرور لجميع طلاب هذا الصف بنجاح"
        : "تم إلغاء متطلب كلمة المرور لجميع طلاب هذا الصف بنجاح",
      "success",
    );
  };

  const handleClearAllPasswords = async () => {
    if (filteredStudents.length === 0) {
      triggerToast("لا يوجد طلاب مسجلون حالياً لمسح كلمات مرورهم", "info");
      return;
    }

    const studentsWithPasswords = filteredStudents.filter((s) => s.password);
    if (studentsWithPasswords.length === 0) {
      triggerToast(
        "لا توجد كلمات مرور مسجلة لمسحها لدى طلاب الصف المعروضين حالياً",
        "info",
      );
      return;
    }

    triggerConfirm(
      "تأكيد مسح جميع كلمات المرور للطلاب",
      `هل أنت متأكد من رغبتك في مسح وحذف كلمات المرور لجميع الطلاب المعروضين بالجدول حالياً (عدد الطلاب: ${studentsWithPasswords.length})؟ هذا الإجراء سيتم تطبيقه على الفور وبسرعة فائقة.`,
      async () => {
        try {
          const batch = writeBatch(db);
          studentsWithPasswords.forEach((student) => {
            const studentRef = doc(db, "students", student.id);
            batch.update(studentRef, { password: "" });
          });
          
          await batch.commit();

          // Update local state
          setStudents((prev) =>
            prev.map((s) => {
              const isTargeted = studentsWithPasswords.some(
                (swp) => swp.id === s.id,
              );
              return isTargeted ? { ...s, password: "" } : s;
            }),
          );

          triggerToast(
            `تم مسح كلمات المرور بنجاح لعدد ${studentsWithPasswords.length} من الطلاب 🔑`,
            "success",
          );
        } catch (err) {
          console.error("Error clearing password with batch", err);
          triggerToast("حدث خطأ أثناء مسح كلمات المرور", "error");
        }
      },
      undefined,
      "نعم، مسح جميع كلمات المرور",
      "إلغاء الإجراء",
    );
  };

  const handleAutoGeneratePasswords = async () => {
    if (!currentUser) return;
    
    const activeGrade = selectedTabGrade || "";
    const activeSemester = selectedTabSemester || "";

    if (!activeGrade || !activeSemester) {
      triggerToast("يرجى اختيار الصف والفصل الدراسي أولاً", "info");
      return;
    }

    // Resolve student class and filter by selected activeGrade and activeSemester
    const activeClassStudents = students.filter((student) => {
      const sGrade =
        student.grade ||
        (student.gradeClass && student.gradeClass.includes(" - ")
          ? student.gradeClass.split(" - ")[0].trim()
          : "الصف العاشر");
      const sSemester =
        student.semester ||
        (student.gradeClass && student.gradeClass.includes(" - ")
          ? student.gradeClass.split(" - ")[1].trim()
          : "الفصل الأول");
      return (
        normalizeGradeName(sGrade) === normalizeGradeName(activeGrade) &&
        normalizeSemesterName(sSemester) === normalizeSemesterName(activeSemester)
      );
    });

    // Apply any active search filter on this list
    const queryVal = studentSearch.toLowerCase().trim();
    const targetStudents = activeClassStudents.filter((student) => {
      return (
        !queryVal ||
        student.name.toLowerCase().includes(queryVal) ||
        student.email.toLowerCase().includes(queryVal)
      );
    });

    if (targetStudents.length === 0) {
      triggerToast(`لا يوجد طلاب مسجلون في ${activeGrade} (${activeSemester}) لتوليد كلمات مرور لهم`, "info");
      return;
    }

    const easyPatterns = [
      "1234", "1122", "2233", "3344", "4455", "5566", "6677", "7788", "8899",
      "1111", "2222", "3333", "4444", "5555", "1212", "2323", "3434", "4545",
      "1357", "2468", "9876", "4321"
    ];

    triggerConfirm(
      "تأكيد توليد كلمات مرور سهلة تلقائياً",
      `هل أنت متأكد من رغبتك في توليد كلمات مرور سهلة وتلقائية لطلاب هذا الفصل فقط: "${activeGrade} - ${activeSemester}" (عدد الطلاب: ${targetStudents.length})؟ سيتم تحديث وتثبيت كلمات المرور لهم فوراً وبسرعة فائقة.`,
      async () => {
        // Start process and show progress indicator
        setPasswordGenProgress({
          active: true,
          current: 0,
          total: targetStudents.length,
          studentName: "جاري المعالجة",
        });

        try {
          const batch = writeBatch(db);
          const updatedResults: { id: string; password: string }[] = [];

          targetStudents.forEach((student) => {
            const randPattern = easyPatterns[Math.floor(Math.random() * easyPatterns.length)];
            const studentRef = doc(db, "students", student.id);
            batch.update(studentRef, { password: randPattern });
            updatedResults.push({ id: student.id, password: randPattern });
          });

          // Commit batch updates in one go!
          await batch.commit();

          // Small virtual progress step update for visual realism
          setPasswordGenProgress({
            active: true,
            current: targetStudents.length,
            total: targetStudents.length,
            studentName: "اكتمل",
          });

          setStudents((prev) =>
            prev.map((s) => {
              const updated = updatedResults.find((ur) => ur.id === s.id);
              return updated ? { ...s, password: updated.password } : s;
            })
          );

          triggerToast(`تم توليد كلمات مرور سهلة بنجاح لعدد ${updatedResults.length} من طلاب الفصل المختار! 🔑`, "success");
        } catch (err: any) {
          console.error("Error auto-generating passwords", err);
          triggerToast("حدث خطأ أثناء توليد كلمات المرور تلقائياً", "error");
        } finally {
          // Add a minor delayed clear so user can see it hit 100%
          setTimeout(() => {
            setPasswordGenProgress((prev) => ({ ...prev, active: false }));
          }, 300);
        }
      },
      undefined,
      "نعم، توليد كلمات مرور",
      "إلغاء الإجراء"
    );
  };

  // Success Notification Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "info" | "error">(
    "success",
  );

  const triggerToast = (
    msg: string,
    type: "success" | "info" | "error" = "success",
  ) => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Global loading overlay state
  const [globalLoading, setGlobalLoading] = useState<{
    active: boolean;
    message: string;
  }>({ active: false, message: "" });

  const runWithProgress = useCallback(async <T,>(
    operation: () => Promise<T> | T,
    loadingMessage: string,
    successMessage?: string | ((result: T) => string),
    errorMessage?: string
  ): Promise<T> => {
    setGlobalLoading({ active: true, message: loadingMessage });
    try {
      const result = await operation();
      setGlobalLoading({ active: false, message: "" });
      if (successMessage) {
        const msg = typeof successMessage === 'function' ? successMessage(result) : successMessage;
        triggerToast(msg, "success");
      }
      return result;
    } catch (err: any) {
      setGlobalLoading({ active: false, message: "" });
      console.error("Progress action failed:", err);
      const errText = errorMessage || `عذراً، فشلت العملية: ${err.message || err}`;
      triggerToast(errText, "error");
      throw err;
    }
  }, []);

  // Toggle quiz status (active / closed)
  const handleToggleQuizStatus = async (quizId: string) => {
    if (!currentUser) return;
    const quiz = quizzes.find((q) => q.id === quizId);
    if (!quiz) return;
    const newStatus = quiz.status === "active" ? "closed" : "active";
    await runWithProgress(
      async () => {
        await updateDoc(doc(db, "quizzes", quizId), { status: newStatus });
      },
      `جاري تغيير حالة اختبار "${quiz.title}"...`,
      `تم تغيير حالة الاختبار "${quiz.title}" إلى ${newStatus === "active" ? "نشط" : "مغلق"} بنجاح`
    );
  };

  // Delete a quiz
  const handleDeleteQuiz = async (quizId: string) => {
    if (!currentUser) return;
    const quizToDelete = quizzes.find((q) => q.id === quizId);
    triggerConfirm(
      "حذف التقييم نهائياً",
      `هل أنت متأكد من رغبتك في حذف اختبار "${quizToDelete?.title || ""}" نهائياً؟ هذا الإجراء لا يمكن إلغاؤه.`,
      async () => {
        await runWithProgress(
          async () => {
            await deleteDoc(doc(db, "quizzes", quizId));
            if (selectedQuiz?.id === quizId) setSelectedQuiz(null);
          },
          `جاري حذف اختبار "${quizToDelete?.title || ""}"...`,
          `تم حذف اختبار "${quizToDelete?.title || ""}" بنجاح 🗑️`
        );
      },
    );
  };

  // State to track if we are editing an existing quiz
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

  // Edit a quiz
  const handleEditQuiz = (quiz: Quiz) => {
    setEditingQuizId(quiz.id);
    setBuilderTitle(quiz.title || "");
    setBuilderSubject(quiz.subject || "");
    setBuilderDuration(
      quiz.durationMinutes === 9999 ? 15 : quiz.durationMinutes || 15,
    );
    setBuilderIsTimed(quiz.durationMinutes !== 9999);
    setBuilderGrade(quiz.grade || "");
    setBuilderSemester(quiz.semester || "");
    setBuilderCustomizeClass(!!(quiz.grade || quiz.semester));
    setBuilderShowResultToStudent(quiz.showResultToStudent ?? true);
    setBuilderShuffleQuestions(quiz.shuffleQuestions ?? false);
    setBuilderAvailabilityStart(quiz.availabilityStart || "");
    setBuilderAvailabilityEnd(quiz.availabilityEnd || "");
    setBuilderHasAvailability(
      !!(quiz.availabilityStart || quiz.availabilityEnd),
    );
    setBuilderRequireMoeEmail(quiz.requireMoeEmail ?? false);
    setBuilderRequireAcademicId(quiz.requireAcademicId ?? false);
    setBuilderRequireClassGroup(quiz.requireClassGroup ?? false);

    if (quiz.questions && quiz.questions.length > 0) {
      setBuilderQuestions(
        quiz.questions.map((q, idx) => ({
          id: q.id || `q-${idx}`,
          text: q.text || "",
          type: q.type || "multiple_choice",
          options: q.options || ["", "", "", ""],
          correctAnswer: q.correctAnswer || "0",
          points: q.points || 1,
          isManual: q.isManual || false,
        })),
      );
    } else {
      setBuilderQuestions([
        {
          id: `temp-${Date.now()}`,
          text: "",
          type: "multiple_choice",
          options: ["", "", "", ""],
          correctAnswer: "0",
          points: 1,
          isManual: true,
        },
      ]);
    }
    setActiveTab("builder");
  };

  // Quiz Builder form states
  const [builderTitle, setBuilderTitle] = useState("");
  const [builderSubject, setBuilderSubject] = useState("");
  const [builderDuration, setBuilderDuration] = useState(15);
  const [builderGrade, setBuilderGrade] = useState("");
  const [builderSemester, setBuilderSemester] = useState("");
  const [builderCustomizeClass, setBuilderCustomizeClass] = useState(false);
  const [builderShowResultToStudent, setBuilderShowResultToStudent] =
    useState(true);
  const [builderShuffleQuestions, setBuilderShuffleQuestions] = useState(true);
  const [builderAvailabilityStart, setBuilderAvailabilityStart] = useState("");
  const [builderAvailabilityEnd, setBuilderAvailabilityEnd] = useState("");
  const [builderRequireMoeEmail, setBuilderRequireMoeEmail] = useState(false);
  const [builderRequireAcademicId, setBuilderRequireAcademicId] =
    useState(false);
  const [builderRequireClassGroup, setBuilderRequireClassGroup] =
    useState(false);
  const [builderIsTimed, setBuilderIsTimed] = useState(true);
  const [builderHasAvailability, setBuilderHasAvailability] = useState(false);

  // Quiz Builder PDF Generation States
  const [showBuilderPdfModal, setShowBuilderPdfModal] = useState(false);
  const [showQuizCreationModal, setShowQuizCreationModal] = useState(false);
  const [activeMenuQuizId, setActiveMenuQuizId] = useState<string | null>(null);
  const [builderPdfFile, setBuilderPdfFile] = useState<File | null>(null);
  const [builderPdfBase64, setBuilderPdfBase64] = useState("");
  const [builderPdfCustomPrompt, setBuilderPdfCustomPrompt] = useState("");
  const [builderPdfMcqCount, setBuilderPdfMcqCount] = useState<number>(3);
  const [builderPdfTfCount, setBuilderPdfTfCount] = useState<number>(2);
  const [isBuilderPdfGenerating, setIsBuilderPdfGenerating] = useState(false);
  const [builderPdfDrafts, setBuilderPdfDrafts] = useState<any[]>([]);
  const [builderPdfSelectedDraftIndexes, setBuilderPdfSelectedDraftIndexes] =
    useState<Record<number, boolean>>({});
  const [builderPdfError, setBuilderPdfError] = useState<string | null>(null);

  // Current list of questions being built
  const [builderQuestions, setBuilderQuestions] = useState<Question[]>([]);

  const questionsContainerRef = useRef<HTMLDivElement>(null);
  const prevQuestionsLength = useRef(builderQuestions.length);

  useEffect(() => {
    if (builderQuestions.length > prevQuestionsLength.current) {
      setTimeout(() => {
        if (questionsContainerRef.current) {
          questionsContainerRef.current.scrollTo({
            top: questionsContainerRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 100);
    }
    prevQuestionsLength.current = builderQuestions.length;
  }, [builderQuestions.length]);

  // Add empty question to builder
  const handleAddQuestionToBuilder = () => {
    const nextId = `temp-${Date.now()}`;
    setBuilderQuestions((prev) => [
      ...prev,
      {
        id: nextId,
        text: "",
        type: "multiple_choice",
        options: ["", "", "", ""],
        correctAnswer: "0",
        points: 1,
        isManual: true,
      },
    ]);
    triggerToast("تمت إضافة سؤال يدوي جديد بنجاح وتجهيزه للصياغة", "success");
  };

  // Prepares the builder state and moves to active page with requested wizard open
  const handleStartNewQuizWithMethod = (method: "manual" | "ai" | "bank") => {
    setEditingQuizId(null);
    setBuilderTitle("");
    if (gradesList.length > 0) {
      setBuilderGrade(gradesList[0]);
    }
    setBuilderSemester("");
    setBuilderCustomizeClass(false);
    setBuilderShowResultToStudent(true);
    setBuilderShuffleQuestions(true);
    setBuilderAvailabilityStart("");
    setBuilderAvailabilityEnd("");
    setBuilderRequireMoeEmail(false);
    setBuilderRequireAcademicId(false);
    setBuilderRequireClassGroup(false);
    setBuilderIsTimed(true);
    setBuilderHasAvailability(false);
    setBuilderQuestions([]);

    setActiveTab("builder");

    if (method === "ai") {
      setShowBuilderPdfModal(true);
      setShowBankImportInline(false);
    } else if (method === "bank") {
      setImportSelectedBqIds({});
      setShowBankImportInline(true);
      setShowBankImportModal(false);
    } else {
      setShowBankImportInline(false);
    }

    setShowQuizCreationModal(false);
  };

  // Create an automatic quiz based on random selection from filtered bank questions
  const handleAutoCreateQuiz = (
    selectedQuestions: BankQuestion[],
    meta: { stage: string; grade: string; semester: string; subject: string; unit: string; lesson: string }
  ) => {
    setEditingQuizId(null);
    
    // Create title based on metadata
    const unitLabel = meta.unit !== "all" && meta.unit.trim() !== "" ? meta.unit.trim() : "";
    const lessonLabel = meta.lesson !== "all" && meta.lesson.trim() !== "" ? meta.lesson.trim() : "";
    let titleSuffix = "شامل";
    if (unitLabel && lessonLabel) {
      titleSuffix = `${unitLabel} - ${lessonLabel}`;
    } else if (unitLabel) {
      titleSuffix = unitLabel;
    } else if (lessonLabel) {
      titleSuffix = lessonLabel;
    }
    
    setBuilderTitle(`اختبار تلقائي - ${meta.subject !== "all" ? meta.subject : "مادة عامة"} - ${titleSuffix}`);
    setBuilderSubject(meta.subject !== "all" ? meta.subject : "");
    setBuilderGrade(meta.grade !== "all" ? meta.grade : "");
    setBuilderSemester(meta.semester !== "all" ? meta.semester : "");
    
    setBuilderCustomizeClass(false);
    setBuilderShowResultToStudent(true);
    setBuilderShuffleQuestions(true);
    setBuilderAvailabilityStart("");
    setBuilderAvailabilityEnd("");
    setBuilderRequireMoeEmail(false);
    setBuilderRequireAcademicId(false);
    setBuilderRequireClassGroup(false);
    setBuilderIsTimed(true);
    setBuilderHasAvailability(false);

    // Map questions
    const mapped: Question[] = selectedQuestions.map((bq, idx) => {
      const normQ = normalizeQuestion(bq);
      return {
        id: `temp-${Date.now()}-${idx}-${bq.id}`,
        text: normQ.text,
        type: normQ.type,
        options: normQ.options,
        correctAnswer: normQ.correctAnswer,
        points: normQ.points || 1,
      };
    });

    setBuilderQuestions(mapped);

    // Switch tab to builder
    setActiveTab("builder");

    triggerToast(
      `تم توليد واختيار ${selectedQuestions.length} أسئلة تلقائياً بنجاح! يرجى تكملة إعدادات الاختبار المتبقية.`,
      "success"
    );
  };

  // Open the builder-level automatic quiz creation modal
  const handleOpenBuilderAutoQuizModal = () => {
    const availableMcqs = filteredImportQuestions.filter((q) => !isTrueFalseQuestion(q));
    const availableTfs = filteredImportQuestions.filter((q) => isTrueFalseQuestion(q));

    if (filteredImportQuestions.length === 0) {
      triggerToast("لا توجد أسئلة متاحة في الفلترة الحالية لتوليد الاختبار التلقائي منها.", "error");
      return;
    }

    setAutoBuilderMcqCount(Math.min(5, availableMcqs.length));
    setAutoBuilderTfCount(Math.min(5, availableTfs.length));
    setShowBuilderAutoQuizModal(true);
  };

  // Confirm and generate automatic quiz from builder filters
  const handleConfirmBuilderAutoQuiz = () => {
    const availableMcqs = filteredImportQuestions.filter((q) => !isTrueFalseQuestion(q));
    const availableTfs = filteredImportQuestions.filter((q) => isTrueFalseQuestion(q));

    if (autoBuilderMcqCount === 0 && autoBuilderTfCount === 0) {
      triggerToast("يرجى اختيار سؤال واحد على الأقل لإنشاء الاختبار التلقائي.", "error");
      return;
    }

    if (autoBuilderMcqCount > availableMcqs.length) {
      triggerToast(`العدد المطلوب لأسئلة الاختيار من متعدد يتجاوز المتاح (${availableMcqs.length} سؤال).`, "error");
      return;
    }

    if (autoBuilderTfCount > availableTfs.length) {
      triggerToast(`العدد المطلوب لأسئلة الصواب والخطأ يتجاوز المتاح (${availableTfs.length} سؤال).`, "error");
      return;
    }

    // Shuffle and pick
    const shuffledMcqs = [...availableMcqs].sort(() => 0.5 - Math.random());
    const shuffledTfs = [...availableTfs].sort(() => 0.5 - Math.random());

    const selectedMcqs = shuffledMcqs.slice(0, autoBuilderMcqCount);
    const selectedTfs = shuffledTfs.slice(0, autoBuilderTfCount);

    const finalSelected = [...selectedMcqs, ...selectedTfs];

    // Construct title based on filters
    let titleSuffix = "شامل";
    if (importFilterLessons.length > 0) {
      titleSuffix = importFilterLessons.join(", ");
      if (titleSuffix.length > 50) {
        titleSuffix = titleSuffix.substring(0, 47) + "...";
      }
    }

    setEditingQuizId(null);
    setBuilderTitle(`اختبار تلقائي - ${importFilterSubject !== "all" ? importFilterSubject : "مادة عامة"} - ${titleSuffix}`);
    setBuilderSubject(importFilterSubject !== "all" ? importFilterSubject : "");
    setBuilderGrade(importFilterGrade !== "all" ? importFilterGrade : "");
    setBuilderSemester(importFilterSemester !== "all" ? importFilterSemester : "");

    setBuilderCustomizeClass(false);
    setBuilderShowResultToStudent(true);
    setBuilderShuffleQuestions(true);
    setBuilderAvailabilityStart("");
    setBuilderAvailabilityEnd("");
    setBuilderRequireMoeEmail(false);
    setBuilderRequireAcademicId(false);
    setBuilderRequireClassGroup(false);
    setBuilderIsTimed(true);
    setBuilderHasAvailability(false);

    // Map questions
    const mapped: Question[] = finalSelected.map((bq, idx) => {
      const normQ = normalizeQuestion(bq);
      return {
        id: `temp-${Date.now()}-${idx}-${bq.id}`,
        text: normQ.text,
        type: normQ.type,
        options: normQ.options,
        correctAnswer: normQ.correctAnswer,
        points: normQ.points || 1,
      };
    });

    setBuilderQuestions(mapped);

    // Close modaly layers
    setShowBuilderAutoQuizModal(false);
    setShowBankImportModal(false);
    setShowBankImportInline(false);

    triggerToast(
      `تم توليد واختيار ${finalSelected.length} أسئلة تلقائياً بنجاح! يرجى تكملة إعدادات الاختبار المتبقية.`,
      "success"
    );
  };

  // Import selected questions from Question Bank to the builder
  const handleImportSelectedQuestions = () => {
    const selectedIds = Object.keys(importSelectedBqIds).filter(
      (id) => importSelectedBqIds[id],
    );
    if (selectedIds.length === 0) {
      triggerToast("يرجى تحديد سؤال واحد على الأقل للاستيراد", "error");
      return;
    }

    const matchedQuestions = bankQuestions.filter((q) =>
      selectedIds.includes(q.id),
    );

    const mapped: Question[] = matchedQuestions.map((bq, idx) => {
      const normQ = normalizeQuestion(bq);
      return {
        id: `temp-${Date.now()}-${idx}-${bq.id}`,
        text: normQ.text,
        type: normQ.type,
        options: normQ.options,
        correctAnswer: normQ.correctAnswer,
        points: normQ.points || 1,
      };
    });

    setBuilderQuestions((prev) => {
      // If the only question is a temporary empty one, replace it
      if (prev.length === 1 && prev[0].text.trim() === "") {
        return mapped;
      }
      return [...prev, ...mapped];
    });

    triggerToast(
      `تم استيراد ${matchedQuestions.length} أسئلة بنجاح إلى مصمم الاختبار!`,
      "success",
    );
    setShowBankImportModal(false);
    setImportSelectedBqIds({});
  };

  const handleBuilderPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExtensions = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv"];
    const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    
    if (!allowedExtensions.includes(fileExtension) && !file.type.match(/(pdf|word|excel|spreadsheet|csv)/)) {
      triggerToast(
        "الملف المختار غير صالح. يرجى اختيار ملف PDF أو Word أو Excel.",
        "error",
      );
      return;
    }

    // Limit file size to 10MB to avoid proxy network upload errors (e.g., 413 Payload Too Large)
    const maxSizeBytes = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSizeBytes) {
      triggerToast(
        `حجم الملف كبير جداً (${(file.size / 1024 / 1024).toFixed(1)} ميجابايت). يرجى اختيار ملف أصغر من 10 ميجابايت.`,
        "error",
      );
      setBuilderPdfError(
        `حجم الملف (${(file.size / 1024 / 1024).toFixed(1)} ميجابايت) يتجاوز الحد الأقصى المسموح به لضمان نجاح التحليل (10 ميجابايت). يرجى تقسيم المستند أو ضغطه قبل الرفع.`
      );
      setBuilderPdfFile(null);
      setBuilderPdfBase64("");
      return;
    }

    setBuilderPdfFile(file);
    setBuilderPdfError(null);

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result?.toString().split(",")[1] || "";
      setBuilderPdfBase64(base64String);
    };
    reader.onerror = () => {
      setBuilderPdfError("فشل في قراءة ملف المستند وتحويله.");
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateBuilderQuestionsFromPdf = async () => {
    if (!builderPdfBase64 || !builderPdfFile) {
      triggerToast("يرجى تحميل ملف للمتابعة", "error");
      return;
    }

    setIsBuilderPdfGenerating(true);
    setBuilderPdfError(null);
    setBuilderPdfDrafts([]);
    setBuilderPdfSelectedDraftIndexes({});

    try {
      const res = await fetch("/api/generate-questions-from-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          pdfBase64: builderPdfBase64,
          mimeType: builderPdfFile.type || "application/pdf",
          customPrompt: builderPdfCustomPrompt,
          mcqCount: builderPdfMcqCount,
          tfCount: builderPdfTfCount,
        }),
      });

      if (!res.ok) {
        let errMsg = "فشلت عملية التحليل واستخراج الأسئلة.";
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
        setBuilderPdfDrafts(data.questions);
        const initialSelected: Record<number, boolean> = {};
        data.questions.forEach((_: any, idx: number) => {
          initialSelected[idx] = true;
        });
        setBuilderPdfSelectedDraftIndexes(initialSelected);
        triggerToast(
          `تم استخراج ${data.questions.length} أسئلة بنجاح! مراجعة وإدراج للاختبار`,
          "success",
        );
      } else {
        throw new Error("الاستجابة المستلمة من الخادم غير صالحة.");
      }
    } catch (err: any) {
      console.error(err);
      setBuilderPdfError(
        err.message || "حدث خطأ غير متوقع أثناء استخراج الأسئلة.",
      );
      triggerToast("حدث خطأ أثناء معالجة ملف المستند", "error");
    } finally {
      setIsBuilderPdfGenerating(false);
    }
  };

  const handleSaveBuilderPdfDrafts = () => {
    const draftsToSave = builderPdfDrafts.filter(
      (_, idx) => builderPdfSelectedDraftIndexes[idx],
    );
    if (draftsToSave.length === 0) {
      triggerToast(
        "يرجى اختيار سؤال واحد على الأقل ليتم إدراجه بالاختبار",
        "error",
      );
      return;
    }

    const mapped: Question[] = draftsToSave.map((draft, idx) => ({
      id: `temp-${Date.now()}-${idx}-pdf`,
      text: draft.text || "سؤال مستخرج",
      type: draft.type === "true_false" ? "true_false" : "multiple_choice",
      options: Array.isArray(draft.options) ? draft.options : [],
      correctAnswer: String(draft.correctAnswer ?? "0"),
      points: Number(draft.points || 1),
    }));

    setBuilderQuestions((prev) => {
      // If the only question is a temporary empty one, replace it
      if (prev.length === 1 && prev[0].text.trim() === "") {
        return mapped;
      }
      return [...prev, ...mapped];
    });

    // Automatically fill in metadata (Subject, grade, stage, etc.) if they were extracted from PDF and builder was empty
    const firstDraft = draftsToSave[0];
    if (firstDraft) {
      if (!builderSubject && firstDraft.subject) {
        setBuilderSubject(firstDraft.subject);
      }
      if (!builderTitle && firstDraft.unit) {
        setBuilderTitle(
          `اختبار ${firstDraft.subject || ""} - ${firstDraft.unit}`,
        );
      }
    }

    triggerToast(
      `تم بنجاح إدراج ${mapped.length} أسئلة مستخرجة بالذكاء الاصطناعي في جعبة الاختبار!`,
      "success",
    );

    // Reset state and close modal
    setBuilderPdfFile(null);
    setBuilderPdfBase64("");
    setBuilderPdfCustomPrompt("");
    setBuilderPdfDrafts([]);
    setBuilderPdfSelectedDraftIndexes({});
    setShowBuilderPdfModal(false);
  };

  // Remove question from builder
  const handleRemoveQuestionFromBuilder = (index: number) => {
    setBuilderQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Handle question form adjustments
  const handleQuestionChange = (
    index: number,
    key: keyof Question,
    value: any,
  ) => {
    setBuilderQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx === index) {
          if (key === "type") {
            // If type changes to true-false, limit options to 2
            const defaultOptions =
              value === "true_false" ? ["صحيح", "خطأ"] : ["", "", "", ""];
            const defaultAns = value === "true_false" ? "true" : "0";
            return {
              ...q,
              type: value,
              options: defaultOptions,
              correctAnswer: defaultAns,
            };
          }
          return { ...q, [key]: value };
        }
        return q;
      }),
    );
  };

  // Handle options changes for MCQ
  const handleOptionChange = (
    qIndex: number,
    optionIndex: number,
    text: string,
  ) => {
    setBuilderQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx === qIndex) {
          const newOptions = [...q.options];
          newOptions[optionIndex] = text;
          return { ...q, options: newOptions };
        }
        return q;
      }),
    );
  };

  // Validate and Save Quiz
  const handleSaveQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!builderTitle.trim()) {
      triggerToast("يرجى إدخال عنوان الاختبار", "error");
      return;
    }

    // Merge any selected bank questions immediately in one step
    let finalQuestions = [...builderQuestions];
    const selectedIds = Object.keys(importSelectedBqIds).filter(
      (id) => importSelectedBqIds[id],
    );
    if (selectedIds.length > 0) {
      const matchedQuestions = bankQuestions.filter((q) =>
        selectedIds.includes(q.id),
      );
      const mapped: Question[] = matchedQuestions.map((bq, idx) => {
        const normQ = normalizeQuestion(bq);
        return {
          id: `temp-${Date.now()}-${idx}-${bq.id}`,
          text: normQ.text,
          type: normQ.type,
          options: normQ.options,
          correctAnswer: normQ.correctAnswer,
          points: normQ.points || 1,
        };
      });

      // If the only builder question is just a single empty placeholder, replace it. Otherwise, append.
      if (finalQuestions.length === 1 && finalQuestions[0].text.trim() === "") {
        finalQuestions = mapped;
      } else {
        finalQuestions = [...finalQuestions, ...mapped];
      }
    }

    // Validate questions
    if (finalQuestions.length === 0) {
      triggerToast("يجب إضافة سؤال واحد على الأقل لحفظ الاختبار", "error");
      return;
    }

    for (let i = 0; i < finalQuestions.length; i++) {
      const q = finalQuestions[i];
      if (!q.text.trim()) {
        triggerToast(`الرجاء كتابة نص السؤال رقم ${i + 1}`, "error");
        return;
      }
      if (q.type === "multiple_choice") {
        const emptyOptionIdx = q.options.findIndex((opt) => !opt.trim());
        if (emptyOptionIdx !== -1) {
          triggerToast(
            `الرجاء تعبئة الخيار رقم ${emptyOptionIdx + 1} في السؤال رقم ${i + 1}`,
            "error",
          );
          return;
        }
      }
    }

    const existingQuiz = editingQuizId
      ? quizzes.find((q) => q.id === editingQuizId)
      : null;
    const newQuizId = editingQuizId || `q-${Date.now()}`;
    // Construct final Quiz object
    const newQuiz: Quiz = {
      id: newQuizId,
      title: builderTitle.trim(),
      subject: builderSubject.trim() || "عام",
      durationMinutes: builderIsTimed ? Number(builderDuration) : 9999,
      status: existingQuiz ? existingQuiz.status : "active",
      dateCreated: existingQuiz
        ? existingQuiz.dateCreated || new Date().toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      grade: builderCustomizeClass ? builderGrade || null : null,
      semester: builderCustomizeClass ? builderSemester || null : null,
      showResultToStudent: builderShowResultToStudent,
      shuffleQuestions: builderShuffleQuestions,
      availabilityStart: builderHasAvailability
        ? builderAvailabilityStart || null
        : null,
      availabilityEnd: builderHasAvailability
        ? builderAvailabilityEnd || null
        : null,
      requireMoeEmail: builderRequireMoeEmail,
      requireAcademicId: builderRequireAcademicId,
      requireClassGroup: builderRequireClassGroup,
      questions: finalQuestions.map((q, index) => ({
        ...q,
        points: Number(q.points || 1),
        id:
          q.id && !q.id.startsWith("temp") ? q.id : `q-${Date.now()}-${index}`,
      })),
    };

    try {
      await setDoc(doc(db, "quizzes", newQuizId), {
        ...newQuiz,
        teacherId: currentUser.uid,
      });

      // Reset builder form
      setEditingQuizId(null);
      setBuilderTitle("");
      setBuilderSubject("");
      setBuilderDuration(15);
      setBuilderCustomizeClass(false);
      setBuilderShowResultToStudent(true);
      setBuilderShuffleQuestions(true);
      setBuilderAvailabilityStart("");
      setBuilderAvailabilityEnd("");
      setBuilderRequireMoeEmail(false);
      setBuilderRequireAcademicId(false);
      setBuilderRequireClassGroup(false);
      setBuilderIsTimed(true);
      setBuilderHasAvailability(false);
      setBuilderQuestions([
        {
          id: "temp-1",
          text: "",
          type: "multiple_choice",
          options: ["", "", "", ""],
          correctAnswer: "0",
          points: 1,
          isManual: true,
        },
      ]);
      setImportSelectedBqIds({});
      setShowBankImportInline(false);

      const successMsg = editingQuizId
        ? "تم تحديث ونشر تعديلات الاختبار بنجاح!"
        : "تم إنشاء ونشر الاختبار بنجاح وتمت إضافته للوحة التحكم!";
      triggerToast(successMsg, "success");
      setActiveTab("dashboard");
    } catch (error) {
      handleFirestoreError(
        error,
        editingQuizId ? OperationType.UPDATE : OperationType.CREATE,
        `quizzes/${newQuizId}`,
      );
    }
  };

  // Grades and Semesters Management Handlers
  const ensureSeededGradesAndSemesters = async () => {
    // Seeding is completely disabled as per user request to prevent any automatic/default grade creation.
    return;
  };

  const handleAddGrade = async () => {
    if (!currentUser || !newGradeInput.trim()) return;

    // Split input by newlines to support batch multi-line input (typed or copy-pasted from Excel)
    const lines = newGradeInput
      .split(/[\r\n]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) return;

    // Filter out duplicates against existing grades and batch list
    const newGradesToAdd: string[] = [];
    const skippedDuplicates: string[] = [];

    for (const rawName of lines) {
      const isDupInExisting = grades.some(
        (g) => normalizeGradeName(g) === normalizeGradeName(rawName)
      );
      const isDupInBatch = newGradesToAdd.some(
        (g) => normalizeGradeName(g) === normalizeGradeName(rawName)
      );

      if (isDupInExisting || isDupInBatch) {
        skippedDuplicates.push(rawName);
      } else {
        newGradesToAdd.push(rawName);
      }
    }

    if (newGradesToAdd.length === 0) {
      if (skippedDuplicates.length > 0) {
        triggerToast(`الصفوف المدخلة (${skippedDuplicates.join(", ")}) مضافة مسبقاً!`, "info");
      }
      return;
    }

    try {
      await runWithProgress(
        async () => {
          const addedNames: string[] = [];
          for (const name of newGradesToAdd) {
            const id = `grade-${Math.random().toString(36).substr(2, 9)}`;
            await setDoc(doc(db, "grades", id), {
              id,
              teacherId: currentUser.uid,
              name,
              createdAt: Date.now(),
            });
            addedNames.push(name);
          }
          setGrades((prev) => [...prev, ...addedNames]);
          setNewGradeInput("");
          if (addedNames.length > 0) {
            setSelectedManageGrade(addedNames[addedNames.length - 1]);
            setSelectedSemesterNumbers([]);
          }
        },
        newGradesToAdd.length === 1
          ? `جاري إضافة الصف الدراسي "${newGradesToAdd[0]}"...`
          : `جاري إضافة ${newGradesToAdd.length} صفوف دراسية...`,
        newGradesToAdd.length === 1
          ? `تمت إضافة الصف الدراسي "${newGradesToAdd[0]}" بنجاح ✨`
          : `تمت إضافة ${newGradesToAdd.length} صفوف دراسية بنجاح ✨`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "grades");
    }
  };


  const handleDeleteGrade = async (gradeName: string) => {
    if (!currentUser) return;

    // Check if there are any students in this grade
    const hasStudents = students.some((student) => {
      const sGrade =
        student.grade ||
        (student.gradeClass && student.gradeClass.includes(" - ")
          ? student.gradeClass.split(" - ")[0].trim()
          : "الصف العاشر");
      return normalizeGradeName(sGrade) === normalizeGradeName(gradeName);
    });

    if (hasStudents) {
      triggerToast(
        `لا يمكن حذف هذا الصف الأكاديمي ("${gradeName}") لأنه يحتوي على طلاب مسجلين فيه حالياً. يرجى نقل الطلاب أو إزالتهم أولاً لسلامة سجلاتهم.`,
        "error",
      );
      return;
    }

    triggerConfirm(
      "حذف الصف الدراسي",
      `هل أنت متأكد من رغبتك في حذف "${gradeName}" من قائمة الصفوف المعتمدة؟`,
      async () => {
        await runWithProgress(
          async () => {
            const q = query(
              collection(db, "grades"),
              where("teacherId", "==", currentUser.uid),
              where("name", "==", gradeName),
            );
            const s = await getDocs(q);
            const promises: Promise<void>[] = [];
            s.forEach((d) => {
              promises.push(deleteDoc(doc(db, "grades", d.id)));
            });

            // Also delete all semesters/classes associated with this deleted grade
            const semQ = query(
              collection(db, "semesters"),
              where("teacherId", "==", currentUser.uid),
              where("gradeName", "==", gradeName),
            );
            const semSnap = await getDocs(semQ);
            semSnap.forEach((d) => {
              promises.push(deleteDoc(doc(db, "semesters", d.id)));
            });

            await Promise.all(promises);
          },
          `جاري حذف الصف "${gradeName}" والفصول الدراسية التابعة له...`,
          `تم حذف الصف "${gradeName}" بنجاح 🗑️`
        );
      },
    );
  };

  const handleUpdateGrade = async () => {
    if (!currentUser || !editingGrade || !editingGrade.current.trim()) return;
    try {
      await runWithProgress(
        async () => {
          const q = query(
            collection(db, "grades"),
            where("teacherId", "==", currentUser.uid),
            where("name", "==", editingGrade.original),
          );
          const s = await getDocs(q);
          const batch = writeBatch(db);
          
          s.forEach((d) => {
            batch.update(doc(db, "grades", d.id), {
              name: editingGrade.current.trim(),
            });
          });

          const studentsToUpdate = students.filter((student) => {
            const sGrade =
              student.grade ||
              (student.gradeClass && student.gradeClass.includes(" - ")
                ? student.gradeClass.split(" - ")[0].trim()
                : "الصف العاشر");
            return sGrade === editingGrade.original;
          });

          studentsToUpdate.forEach((student) => {
            const section =
              student.gradeClass && student.gradeClass.includes(" - ")
                ? student.gradeClass.split(" - ")[1].trim()
                : "أ";
            batch.update(doc(db, "students", student.id), {
              grade: editingGrade.current.trim(),
              gradeClass: `${editingGrade.current.trim()} - ${section}`,
            });
          });

          await batch.commit();
          setEditingGrade(null);
        },
        `جاري تحديث مسمى الصف الدراسي إلى "${editingGrade.current.trim()}"...`,
        "تم تعديل مسمى الصف وتحديث بيانات الطلاب المنتسبين له بنجاح ✨"
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "grades");
    }
  };

  const handleAddSemester = async () => {
    if (!currentUser) return;
    const activeGrade =
      selectedManageGrade || (gradesList.length > 0 ? gradesList[0] : null);
    if (!activeGrade) {
      triggerToast(
        "يرجى تحديد صف دراسي أو إضافته أولاً لربط الفصول به",
        "error",
      );
      return;
    }

    if (!selectedSemesterNumbers || selectedSemesterNumbers.length === 0) {
      triggerToast("يرجى اختيار فصل واحد على الأقل لإضافته", "error");
      return;
    }

    const numbersToAdd = [...selectedSemesterNumbers].sort((a, b) => a - b);
    let addedCount = 0;
    const newSemDocs: typeof semesters = [];

    try {
      await runWithProgress(
        async () => {
          const batch = writeBatch(db);
          for (const num of numbersToAdd) {
            const finalSemesterName = `الفصل ${num}`;
            const isDuplicate = semesters.some(
              (s) =>
                normalizeGradeName(s.gradeName) === normalizeGradeName(activeGrade) &&
                normalizeSemesterName(s.name) === normalizeSemesterName(finalSemesterName)
            );

            if (!isDuplicate) {
              const id = `semester-${Math.random().toString(36).substr(2, 9)}`;
              const docData = {
                id,
                teacherId: currentUser.uid,
                name: finalSemesterName,
                gradeName: activeGrade,
                number: num,
                createdAt: Date.now() + num,
              };
              batch.set(doc(db, "semesters", id), docData);
              newSemDocs.push(docData);
              addedCount++;
            }
          }

          if (addedCount > 0) {
            await batch.commit();
            setSemesters((prev) => [...prev, ...newSemDocs]);
            setSelectedSemesterNumbers([]);
          }
        },
        `جاري إضافة الفصول المحددة لصف "${activeGrade}"...`,
        () => {
          if (addedCount === 0) {
            return "جميع الفصول المحددة مضافة مسبقاً لهذا الصف!";
          }
          return addedCount === 1
            ? `تمت إضافة الفصل بنجاح لـ ${activeGrade} 🎉`
            : `تمت إضافة ${addedCount} فصول بنجاح لـ ${activeGrade} 🎉`;
        }
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "semesters");
    }
  };

  const addSingleSemesterToGrade = async (targetGrade: string, num: number) => {
    if (!currentUser) return;
    const finalSemesterName = `الفصل ${num}`;
    const isDuplicate = semesters.some(
      (s) =>
        normalizeGradeName(s.gradeName) === normalizeGradeName(targetGrade) &&
        normalizeSemesterName(s.name) === normalizeSemesterName(finalSemesterName)
    );

    if (isDuplicate) return;

    try {
      await runWithProgress(
        async () => {
          const id = `semester-${Math.random().toString(36).substr(2, 9)}`;
          const docData = {
            id,
            teacherId: currentUser.uid,
            name: finalSemesterName,
            gradeName: targetGrade,
            number: num,
            createdAt: Date.now() + num,
          };
          await setDoc(doc(db, "semesters", id), docData);
          setSemesters((prev) => [...prev, docData]);
        },
        `جاري إضافة ${finalSemesterName} لصف ${targetGrade}...`,
        `تمت إضافة ${finalSemesterName} لـ "${targetGrade}" بنجاح 🎉`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "semesters");
    }
  };

  const handleDeleteSemester = async (
    semesterId: string,
    semesterName: string,
    targetGradeOverride?: string,
  ) => {
    if (!currentUser) return;
    const activeGrade =
      targetGradeOverride ||
      selectedManageGrade ||
      (gradesList.length > 0 ? gradesList[0] : "");

    // Check if there are any students in this class/semester under this grade
    const hasStudents = students.some((student) => {
      const sGrade =
        student.grade ||
        (student.gradeClass && student.gradeClass.includes(" - ")
          ? student.gradeClass.split(" - ")[0].trim()
          : "الصف العاشر");
      const sSemester =
        student.semester ||
        (student.gradeClass && student.gradeClass.includes(" - ")
          ? student.gradeClass.split(" - ")[1].trim()
          : "الفصل الأول");
      return (
        normalizeGradeName(sGrade) === normalizeGradeName(activeGrade) &&
        normalizeSemesterName(sSemester) === normalizeSemesterName(semesterName)
      );
    });

    if (hasStudents) {
      triggerToast(
        `لا يمكن حذف الفصل ("${semesterName}") لأنه يحتوي على طلاب مسجلين فيه لـ "${activeGrade}". يرجى نقل الطلاب أو إزالتهم أولاً لسلامة سجلاتهم.`,
        "error",
      );
      return;
    }

    triggerConfirm(
      "حذف الفصل",
      `هل أنت متأكد من رغبتك في حذف "${semesterName}" المرتبط بـ "${activeGrade}" من القائمة؟`,
      async () => {
        await runWithProgress(
          async () => {
            const q = query(
              collection(db, "semesters"),
              where("teacherId", "==", currentUser.uid)
            );
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            let deletedCount = 0;
            snap.forEach((d) => {
              const data = d.data();
              if (
                d.id === semesterId ||
                (normalizeGradeName(data.gradeName) === normalizeGradeName(activeGrade) &&
                 normalizeSemesterName(data.name) === normalizeSemesterName(semesterName))
              ) {
                batch.delete(doc(db, "semesters", d.id));
                deletedCount++;
              }
            });
            if (deletedCount > 0) {
              await batch.commit();
            } else {
              await deleteDoc(doc(db, "semesters", semesterId));
            }
          },
          `جاري حذف الفصل "${semesterName}"...`,
          `تم حذف الفصل "${semesterName}" بنجاح 🗑️`
        );
      },
    );
  };

  const handleResetAllData = async () => {
    if (!currentUser) return;

    triggerConfirm(
      "⚠️ مسح وإعادة تعيين كافة الفصول والطلاب",
      "هل أنت متأكد تماماً من رغبتك في مسح كافة الصفوف، الفصول، الطلاب، وسلة المهملات بشكل نهائي؟ هذا الإجراء سيفرغ سجلات الطلاب تماماً لتبدأ من جديد ولا يمكن التراجع عنه.",
      async () => {
        await runWithProgress(
          async () => {
            const tId = currentUser.uid;
            const collectionsToClear = ["students", "grades", "semesters", "trash_students"];
            
            for (const collName of collectionsToClear) {
              const q = query(
                collection(db, collName),
                where("teacherId", "==", tId)
              );
              const snap = await getDocs(q);
              const promises: Promise<void>[] = [];
              snap.forEach((d) => {
                promises.push(deleteDoc(doc(db, collName, d.id)));
              });
              await Promise.all(promises);
            }

            // Clear local React states
            setStudents([]);
            setGrades([]);
            setSemesters([]);
            setTrashStudents([]);
            setSelectedTabGrade(null);
            setSelectedTabSemester(null);
            setShowGradesSemestersModal(false);
          },
          "جاري تهيئة ومسح كافة الفصول والبيانات التابعة للطلاب...",
          "تم مسح كافة الفصول والطلاب وسلة المهملات بالكامل بنجاح! 🗑️"
        );
      }
    );
  };

  const handleUpdateSemester = async () => {
    if (!currentUser || !editingSemester || !editingSemester.current.trim())
      return;
    const activeGrade =
      selectedManageGrade || (gradesList.length > 0 ? gradesList[0] : "");
    try {
      const q = query(
        collection(db, "semesters"),
        where("teacherId", "==", currentUser.uid),
        where("name", "==", editingSemester.original),
        where("gradeName", "==", activeGrade),
      );
      const s = await getDocs(q);
      const batch = writeBatch(db);
      
      s.forEach((d) => {
        batch.update(doc(db, "semesters", d.id), {
          name: editingSemester.current.trim(),
        });
      });

      // Only update students who belong to THIS SPECIFIC active grade and original class name
      const studentsToUpdate = students.filter((student) => {
        const studentGrade =
          student.grade ||
          (student.gradeClass && student.gradeClass.includes(" - ")
            ? student.gradeClass.split(" - ")[0].trim()
            : "");
        const studentSemester = student.semester || "";
        return (
          studentGrade === activeGrade &&
          studentSemester === editingSemester.original
        );
      });

      studentsToUpdate.forEach((student) => {
        batch.update(doc(db, "students", student.id), {
          semester: editingSemester.current.trim(),
          gradeClass: `${activeGrade} - ${editingSemester.current.trim()}`,
        });
      });

      await batch.commit();

      setEditingSemester(null);
      triggerToast(
        "تم تعديل المسمى بنجاح وتحديث أسماء الطلاب المرتبطين به",
        "success",
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "semesters");
    }
  };

  // Student creation states
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentClass, setNewStudentClass] = useState("الصف العاشر - أ");
  const [newStudentGrade, setNewStudentGrade] = useState("الصف العاشر");
  const [newStudentSemester, setNewStudentSemester] = useState("الفصل الأول");
  const [newStudentSection, setNewStudentSection] = useState("أ");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [newStudentScore, setNewStudentScore] = useState(85);
  const [addStudentType, setAddStudentType] = useState<"single" | "bulk">(
    "bulk",
  );
  const [bulkPasteText, setBulkPasteText] = useState("");
  const [isAddingStudent, setIsAddingStudent] = useState(false);

  const [passwordGenProgress, setPasswordGenProgress] = useState<{
    active: boolean;
    current: number;
    total: number;
    studentName: string;
  }>({
    active: false,
    current: 0,
    total: 0,
    studentName: "",
  });

  // Get grade-specific semesters helper and related memoized lists
  const getSemestersForGrade = useCallback(
    (gName: string): string[] => {
      if (!semestersLoaded) return DEFAULT_SEMESTERS;
      const sortedDocs = [...semesters]
        .filter((s: any) =>
          typeof s === "object" && s !== null
            ? normalizeGradeName(s.gradeName) === normalizeGradeName(gName)
            : false,
        )
        .sort((a, b) => {
          const numA = typeof a.number === "number" ? a.number : 999;
          const numB = typeof b.number === "number" ? b.number : 999;
          if (numA !== numB) return numA - numB;
          const timeA = typeof a.createdAt === "number" ? a.createdAt : 0;
          const timeB = typeof b.createdAt === "number" ? b.createdAt : 0;
          if (timeA !== timeB) return timeA - timeB; // oldest first
          return (a.name || "").localeCompare(b.name || "", "ar");
        });

      if (sortedDocs.length > 0) {
        return Array.from(new Set(sortedDocs.map((s) => s.name)));
      }

      // Backward compatibility for old-style string values in array
      const stringSemesters = semesters.filter(
        (s: any) => typeof s === "string",
      ) as unknown as string[];
      if (stringSemesters.length > 0) return stringSemesters;

      return DEFAULT_SEMESTERS;
    },
    [semesters, semestersLoaded],
  );

  const getStudentsCountForGrade = useCallback(
    (gName: string): number => {
      if (!gName) return 0;
      return students.filter((student) => {
        const sGrade =
          student.grade ||
          (student.gradeClass && student.gradeClass.includes(" - ")
            ? student.gradeClass.split(" - ")[0].trim()
            : "الصف العاشر");
        return normalizeGradeName(sGrade) === normalizeGradeName(gName);
      }).length;
    },
    [students],
  );

  const getStudentsCountForSemester = useCallback(
    (gName: string, semName: string): number => {
      if (!gName || !semName) return 0;
      return students.filter((student) => {
        const sGrade =
          student.grade ||
          (student.gradeClass && student.gradeClass.includes(" - ")
            ? student.gradeClass.split(" - ")[0].trim()
            : "الصف العاشر");
        const sSemester =
          student.semester ||
          (student.gradeClass && student.gradeClass.includes(" - ")
            ? student.gradeClass.split(" - ")[1].trim()
            : "الفصل الأول");
        return (
          normalizeGradeName(sGrade) === normalizeGradeName(gName) &&
          normalizeSemesterName(sSemester) === normalizeSemesterName(semName)
        );
      }).length;
    },
    [students],
  );

  const semestersList = useMemo(() => {
    const activeGrade =
      selectedTabGrade || (gradesList.length > 0 ? gradesList[0] : "");
    const raw = getSemestersForGrade(activeGrade);
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const s of raw) {
      const norm = normalizeSemesterName(s) || s.trim();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        unique.push(s);
      }
    }
    return unique;
  }, [getSemestersForGrade, selectedTabGrade, gradesList]);

  const addStudentSemestersList = useMemo(() => {
    const raw = getSemestersForGrade(newStudentGrade);
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const s of raw) {
      const norm = normalizeSemesterName(s) || s.trim();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        unique.push(s);
      }
    }
    return unique;
  }, [getSemestersForGrade, newStudentGrade]);

  const studentGradesList = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];

    const addGrade = (g: string) => {
      if (!g) return;
      const norm = normalizeGradeName(g) || g.trim();
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push(g);
      }
    };

    // 1. Gather from actual student records loaded for this teacher
    students.forEach((s) => {
      const sGrade =
        s.grade ||
        (s.gradeClass && s.gradeClass.includes(" - ")
          ? s.gradeClass.split(" - ")[0].trim()
          : "");
      if (sGrade) {
        addGrade(sGrade);
      }
    });

    // 2. Gather from custom grades collection
    if (gradesLoaded) {
      grades.forEach((g) => {
        if (g) addGrade(g);
      });
    }

    result.sort(sortGradesByNumber);
    return result;
  }, [students, grades, gradesLoaded, sortGradesByNumber]);

  const studentSemestersList = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];

    const addSem = (s: string) => {
      if (!s) return;
      const norm = normalizeSemesterName(s) || s.trim();
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push(s);
      }
    };

    // 1. Gather from actual student records under selected grade
    students.forEach((s) => {
      const sGrade =
        s.grade ||
        (s.gradeClass && s.gradeClass.includes(" - ")
          ? s.gradeClass.split(" - ")[0].trim()
          : "");
      const sSemester =
        s.semester ||
        (s.gradeClass && s.gradeClass.includes(" - ")
          ? s.gradeClass.split(" - ")[1].trim()
          : "");
      if (
        normalizeGradeName(sGrade) === normalizeGradeName(studentSelectedGrade) &&
        sSemester
      ) {
        addSem(sSemester);
      }
    });

    // 2. Gather from custom semesters collection
    const baseList = getSemestersForGrade(studentSelectedGrade);
    baseList.forEach((s) => {
      if (s) addSem(s);
    });

    if (studentQuiz && studentQuiz.semester) {
      const qSem = studentQuiz.semester;
      if (
        qSem !== "الكل" &&
        qSem !== "جميع الفصول" &&
        qSem !== "جميع فصول الصف" &&
        qSem !== "جميع الفصول والفرق المعتمدة"
      ) {
        const allowedSemesters = qSem.split(",").map((s) => s.trim());
        const filtered = result.filter((s) =>
          allowedSemesters.some(
            (p) => normalizeSemesterName(s) === normalizeSemesterName(p)
          )
        );
        return filtered.length > 0
          ? [...filtered].sort(sortSemestersByNumber)
          : [...result].sort(sortSemestersByNumber);
      }
    }
    return [...result].sort(sortSemestersByNumber);
  }, [
    students,
    studentSelectedGrade,
    getSemestersForGrade,
    studentQuiz,
    sortSemestersByNumber,
  ]);

  const builderSemestersList = useMemo(() => {
    const activeGrade =
      builderGrade || (gradesList.length > 0 ? gradesList[0] : "");
    const raw = getSemestersForGrade(activeGrade);
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const s of raw) {
      const norm = normalizeSemesterName(s) || s.trim();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        unique.push(s);
      }
    }
    return unique;
  }, [getSemestersForGrade, builderGrade, gradesList]);

  // Automatically sync select defaults when grades list loads or changes
  useEffect(() => {
    if (studentGradesList.length > 0) {
      // For student selected grade
      const matchStudentSelected = studentGradesList.find(
        (g) => normalizeGradeName(g) === normalizeGradeName(studentSelectedGrade)
      );
      if (matchStudentSelected) {
        if (studentSelectedGrade !== matchStudentSelected) {
          setStudentSelectedGrade(matchStudentSelected);
        }
      } else {
        setStudentSelectedGrade(studentGradesList[0]);
      }
    }

    if (gradesList.length > 0) {
      // For new student grade
      const matchNewStudent = gradesList.find(
        (g) => normalizeGradeName(g) === normalizeGradeName(newStudentGrade)
      );
      if (matchNewStudent) {
        if (newStudentGrade !== matchNewStudent) {
          setNewStudentGrade(matchNewStudent);
        }
      } else {
        setNewStudentGrade(gradesList[0]);
      }

      // For builder grade
      const matchBuilder = gradesList.find(
        (g) => normalizeGradeName(g) === normalizeGradeName(builderGrade)
      );
      if (matchBuilder) {
        if (builderGrade !== matchBuilder) {
          setBuilderGrade(matchBuilder);
        }
      } else {
        setBuilderGrade(gradesList[0]);
      }
    }
  }, [studentGradesList, gradesList, studentSelectedGrade, newStudentGrade, builderGrade]);

  // Automatically sync select defaults when semesters list loads or changes for quiz builder
  useEffect(() => {
    if (builderSemestersList.length > 0) {
      if (!builderSemester) {
        setBuilderSemester("جميع الفصول");
      } else if (
        builderSemester !== "جميع الفصول" &&
        builderSemester !== "الكل" &&
        builderSemester !== "جميع فصول الصف"
      ) {
        const parts = builderSemester.split(",").map((s) => s.trim());
        const allPartsValid = parts.every((p) =>
          builderSemestersList.some((s) => normalizeSemesterName(s) === normalizeSemesterName(p)),
        );
        if (!allPartsValid) {
          setBuilderSemester("جميع الفصول");
        }
      }
    }
  }, [builderSemestersList, builderSemester]);

  // Automatically sync select defaults when semesters list loads or changes for student view
  useEffect(() => {
    if (studentSemestersList.length > 0) {
      if (
        studentQuiz &&
        studentQuiz.semester &&
        studentQuiz.semester !== "جميع الفصول"
      ) {
        const allowed = studentQuiz.semester.split(",").map((s) => s.trim());
        const isCurrentlySelectedValid =
          allowed.some(
            (s) =>
              normalizeSemesterName(s) ===
              normalizeSemesterName(studentSelectedSemester),
          ) && studentSemestersList.some((s) => normalizeSemesterName(s) === normalizeSemesterName(studentSelectedSemester));
        if (!isCurrentlySelectedValid) {
          const firstAllowedValid = allowed.find((s) => {
            return studentSemestersList.some(
              (sem) => normalizeSemesterName(sem) === normalizeSemesterName(s),
            );
          });
          const matchingInList = studentSemestersList.find(
            (sem) =>
              normalizeSemesterName(sem) ===
              normalizeSemesterName(firstAllowedValid || ""),
          );
          if (matchingInList) {
            setStudentSelectedSemester(matchingInList);
            return;
          }
        }
      }
      const match = studentSemestersList.find(
        (s) =>
          normalizeSemesterName(s) ===
          normalizeSemesterName(studentSelectedSemester),
      );
      if (match) {
        if (studentSelectedSemester !== match) {
          setStudentSelectedSemester(match);
        }
      } else {
        setStudentSelectedSemester(studentSemestersList[0]);
      }
    }
  }, [studentSemestersList, studentSelectedSemester, studentQuiz]);

  // Automatically sync select defaults when semesters list loads or changes for student addition
  useEffect(() => {
    if (addStudentSemestersList.length > 0) {
      const match = addStudentSemestersList.find(
        (s) => normalizeSemesterName(s) === normalizeSemesterName(newStudentSemester)
      );
      if (match) {
        if (newStudentSemester !== match) {
          setNewStudentSemester(match);
        }
      } else {
        setNewStudentSemester(addStudentSemestersList[0]);
      }
    }
  }, [addStudentSemestersList, newStudentSemester]);

  // Pre-select first grade and semester in the Students & Results Tab to match the required visual load instantly
  useEffect(() => {
    if (
      activeTab === "students" ||
      activeTab === "student_results" ||
      activeTab === "manage_student_portal"
    ) {
      if (!selectedTabGrade && gradesList.length > 0) {
        setSelectedTabGrade(gradesList[0]);
      }
      if (!selectedTabSemester && semestersList.length > 0) {
        setSelectedTabSemester(semestersList[0]);
      }
    }
  }, [
    activeTab,
    gradesList,
    semestersList,
    selectedTabGrade,
    selectedTabSemester,
  ]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const targetGrade =
      selectedTabGrade ||
      newStudentGrade ||
      (gradesList.length > 0 ? gradesList[0] : "الصف العاشر");
    const targetSemester =
      selectedTabSemester ||
      newStudentSemester ||
      (semestersList.length > 0 ? semestersList[0] : "الفصل الأول");

    // Helper to normalize Names for robust duplicate detection (Arabic characters, spaces, cases)
    const normalizeStudentNameLocal = (nameStr: string) => {
      if (!nameStr) return "";
      let base = nameStr.trim().toLowerCase();
      base = base
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/\s+/g, " "); // normalize internal spaces to a single space
      return base;
    };

    const pasteContent = bulkPasteText.trim() || newStudentName.trim();
    if (addStudentType === "bulk" || pasteContent.length > 0) {
      if (!pasteContent) {
        triggerToast("الرجاء إدخال أو لصق أسماء الطلاب أولاً", "error");
        return;
      }

      setIsAddingStudent(true);
      const lines = pasteContent.split("\n");
      const parsedStudents = lines
        .map((line) => {
          const parts = line
            .split("\t")
            .map((p) => p.trim())
            .filter((p) => p.length > 0);
          let nameCandidate = parts[0] || "";
          if (parts.length > 1) {
            if (/^\d+$/.test(parts[0]) && parts[1]) {
              nameCandidate = parts[1];
            }
          }
          return nameCandidate.trim();
        })
        .filter((name) => name.length >= 2);

      if (parsedStudents.length === 0) {
        triggerToast("لم يتم العثور على أسماء طلاب صالحة للاستيراد", "error");
        setIsAddingStudent(false);
        return;
      }

      // 1. Deduplicate names from the pasted list itself
      const uniqueParsedStudentsMap = new Map<string, string>();
      parsedStudents.forEach((name) => {
        const normalized = normalizeStudentNameLocal(name);
        if (normalized.length >= 2 && !uniqueParsedStudentsMap.has(normalized)) {
          uniqueParsedStudentsMap.set(normalized, name);
        }
      });
      const uniqueNamesToImportTemp = Array.from(uniqueParsedStudentsMap.values());
      const selfDuplicateCount = parsedStudents.length - uniqueNamesToImportTemp.length;

      // 2. Filter out names that already exist in the active students list in the same grade & semester
      const finalNamesToImport: string[] = [];
      let alreadyExistsCount = 0;

      uniqueNamesToImportTemp.forEach((name) => {
        const normName = normalizeStudentNameLocal(name);
        const exists = students.some((s) => {
          const sNorm = normalizeStudentNameLocal(s.name || "");
          const sGradeNorm = normalizeGradeName(s.grade || "");
          const sSemNorm = (s.semester || "").trim();
          return (
            sNorm === normName &&
            sGradeNorm === normalizeGradeName(targetGrade) &&
            sSemNorm === targetSemester.trim()
          );
        });

        if (exists) {
          alreadyExistsCount++;
        } else {
          finalNamesToImport.push(name);
        }
      });

      if (finalNamesToImport.length === 0) {
        if (alreadyExistsCount > 0) {
          triggerToast(
            `لم يتم استيراد أي طالب! جميع الأسماء المدخلة (${alreadyExistsCount}) مسجلة بالفعل في هذا الصف وهذا الفصل.`,
            "error",
          );
        } else {
          triggerToast("لم يتم العثور على أي أسماء غير مكررة وصالحة للاستيراد", "error");
        }
        setIsAddingStudent(false);
        return;
      }

      try {
        const batch = writeBatch(db);
        let successCount = 0;

        finalNamesToImport.forEach((name, index) => {
          const nextStudentId = `s-${Date.now()}-${index}-${Math.floor(Math.random() * 1000)}`;
          const calculatedClass = `${targetGrade} - ${targetSemester}`;
          const email = `std_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}@academy.edu`;

          const newStudent: Student = {
            id: nextStudentId,
            name: name,
            gradeClass: calculatedClass,
            grade: targetGrade,
            semester: targetSemester,
            email: email,
            averageScore: 0,
            status: "needs_improvement",
            detailedGrades: [],
            passwordRequired: isPasswordRequiredGlobal,
          };

          batch.set(doc(db, "students", nextStudentId), {
            ...newStudent,
            teacherId: currentUser.uid,
          });
          successCount++;
        });

        await batch.commit();

        setShowAddStudentModal(false);
        setBulkPasteText("");
        setNewStudentName("");

        let successMessage = `تم بنجاح استيراد وتسجيل ${successCount} طالب في ${targetGrade} - ${targetSemester}`;
        if (selfDuplicateCount > 0 || alreadyExistsCount > 0) {
          successMessage += ` (تم تلقائياً تصفية وتجاهل ${selfDuplicateCount + alreadyExistsCount} اسماً مكرراً)`;
        }
        triggerToast(successMessage, "success");
      } catch (error: any) {
        console.error("Failed to import students:", error);
        triggerToast(
          `عذراً، فشل استيراد الطلاب: ${error.message || error}`,
          "error",
        );
      } finally {
        setIsAddingStudent(false);
      }
      return;
    }

    // Single student path
    if (!newStudentName.trim()) {
      triggerToast("الرجاء كتابة اسم الطالب", "error");
      return;
    }

    // Check pre-existing for single student path as well
    const singleNormName = normalizeStudentNameLocal(newStudentName);
    const singleExists = students.some((s) => {
      const sNorm = normalizeStudentNameLocal(s.name || "");
      const sGradeNorm = normalizeGradeName(s.grade || "");
      const sSemNorm = (s.semester || "").trim();
      return (
        sNorm === singleNormName &&
        sGradeNorm === normalizeGradeName(targetGrade) &&
        sSemNorm === targetSemester.trim()
      );
    });

    if (singleExists) {
      triggerToast(
        `عذراً، الطالب "${newStudentName.trim()}" موجود بالفعل ومسجل في نفس هذا الصف والفصل!`,
        "error",
      );
      return;
    }

    setIsAddingStudent(true);
    const nextStudentId = `s-${Date.now()}`;
    const calculatedClass = `${targetGrade} - ${targetSemester}`;
    const email = `std_${Date.now()}@academy.edu`;

    const newStudent: Student = {
      id: nextStudentId,
      name: newStudentName.trim(),
      gradeClass: calculatedClass,
      grade: targetGrade,
      semester: targetSemester,
      email: email,
      averageScore: 0,
      status: "needs_improvement",
      detailedGrades: [],
      passwordRequired: isPasswordRequiredGlobal,
    };

    try {
      await setDoc(doc(db, "students", nextStudentId), {
        ...newStudent,
        teacherId: currentUser.uid,
      });

      setShowAddStudentModal(false);
      setNewStudentName("");
      triggerToast(`تمت إضافة الطالب ${newStudent.name} بنجاح`, "success");
    } catch (error: any) {
      console.error("Failed to add student:", error);
      triggerToast(
        `عذراً، فشل إجراء إضافة الطالب: ${error.message || error}`,
        "error",
      );
    } finally {
      setIsAddingStudent(false);
    }
  };

  // Delete single student
  const handleDeleteStudent = async (studentId: string) => {
    if (!currentUser) return;
    const studentToDelete = students.find((s) => s.id === studentId);
    if (!studentToDelete) return;

    triggerConfirm(
      "نقل الطالب إلى سلة المحذوفات",
      `هل أنت متأكد من رغبتك في نقل الطالب "${studentToDelete.name}" إلى سلة المحذوفات؟ ستتمكن من استعادة بياناته وكشف درجاته بالكامل في أي وقت.`,
      async () => {
        await runWithProgress(
          async () => {
            // Backup record in trash collection
            const trashRef = doc(db, "trash_students", studentId);
            await setDoc(trashRef, {
              ...studentToDelete,
              deletedAt: new Date().toISOString(),
              teacherId: currentUser.uid,
            });

            await deleteDoc(doc(db, "students", studentId));
            if (selectedStudent?.id === studentId) setSelectedStudent(null);
            // Remove from selected list if present
            setSelectedDeleteStudentIds((prev) => {
              const copy = { ...prev };
              delete copy[studentId];
              return copy;
            });
          },
          `جاري نقل الطالب "${studentToDelete.name}" إلى سلة المحذوفات...`,
          `تم نقل الطالب "${studentToDelete.name}" إلى سلة المحذوفات بنجاح 🗑️`
        );
      },
    );
  };

  // Bulk delete students
  const handleBulkDeleteStudents = async (targetStudentIds: string[]) => {
    if (!currentUser || targetStudentIds.length === 0) return;

    triggerConfirm(
      "نقل الطلاب إلى سلة المحذوفات",
      `هل أنت متأكد من رغبتك في نقل عدد ${targetStudentIds.length} من الطلاب المحددين إلى سلة المحذوفات؟ ستتمكن من استعادتهم لاحقاً بنقرة واحدة.`,
      async () => {
        await runWithProgress(
          async () => {
            const batch = writeBatch(db);
            targetStudentIds.forEach((id) => {
              const studentToDelete = students.find((s) => s.id === id);
              if (studentToDelete) {
                const trashRef = doc(db, "trash_students", id);
                batch.set(trashRef, {
                  ...studentToDelete,
                  deletedAt: new Date().toISOString(),
                  teacherId: currentUser.uid,
                });
                batch.delete(doc(db, "students", id));
              }
            });
            await batch.commit();
            
            // Clear selections
            setSelectedDeleteStudentIds((prev) => {
              const copy = { ...prev };
              targetStudentIds.forEach((id) => {
                delete copy[id];
              });
              return copy;
            });

            if (
              selectedStudent &&
              targetStudentIds.includes(selectedStudent.id)
            ) {
              setSelectedStudent(null);
            }
          },
          `جاري نقل عدد ${targetStudentIds.length} من الطلاب المحددين إلى سلة المحذوفات...`,
          `تم نقل عدد ${targetStudentIds.length} من الطلاب بنجاح إلى سلة المحذوفات 🗑️`
        );
      },
    );
  };

  // Restore student from trash
  const handleRestoreStudent = async (studentId: string) => {
    if (!currentUser) return;
    const restoredStudent = trashStudents.find((s) => s.id === studentId);
    if (!restoredStudent) return;

    await runWithProgress(
      async () => {
        const { deletedAt, ...cleanStudent } = restoredStudent as any;
        await setDoc(doc(db, "students", studentId), cleanStudent);
        await deleteDoc(doc(db, "trash_students", studentId));
      },
      `جاري استعادة الطالب "${restoredStudent.name}" وإرجاعه للقائمة الرسمية...`,
      `تمت استعادة الطالب "${restoredStudent.name}" بنجاح وإرجاعه للقائمة الرسمية`
    );
  };

  // Permanent Delete from trash
  const handlePermanentDeleteStudent = async (studentId: string) => {
    if (!currentUser) return;
    const studentToDelete = trashStudents.find((s) => s.id === studentId);
    if (!studentToDelete) return;

    triggerConfirm(
      "حذف الطالب نهائياً",
      `تحذير: هل أنت متأكد من رغبتك في حذف "${studentToDelete.name}" نهائياً من سلة المحذوفات؟ لن تتمكن من استعادته مجدداً وسيمحى كشف درجاته تماماً.`,
      async () => {
        await runWithProgress(
          async () => {
            await deleteDoc(doc(db, "trash_students", studentId));
          },
          `جاري حذف الطالب "${studentToDelete.name}" نهائياً من السجلات...`,
          `تم حذف الطالب "${studentToDelete.name}" نهائياً من سلة المحذوفات 🗑️`
        );
      },
    );
  };

  // Restore all trash
  const handleRestoreAllTrash = async () => {
    if (!currentUser || trashStudents.length === 0) return;
    await runWithProgress(
      async () => {
        const batch = writeBatch(db);
        trashStudents.forEach((student) => {
          const { deletedAt, ...cleanStudent } = student as any;
          batch.set(doc(db, "students", student.id), cleanStudent);
          batch.delete(doc(db, "trash_students", student.id));
        });
        await batch.commit();
        setShowTrashModal(false);
      },
      "جاري استعادة كافة الطلاب من سلة المحذوفات...",
      `تمت استعادة كافة المحذوفات (${trashStudents.length} طالباً) بنجاح 🔁`
    );
  };

  // Empty entire trash bin
  const handleEmptyTrash = async () => {
    if (!currentUser || trashStudents.length === 0) return;
    triggerConfirm(
      "إفراغ سلة المحذوفات",
      `تحذير الحذف النهائي الكلي: هل أنت متأكد من رغبتك في حذف جميع الطلاب الموجودين في سلة المحذوفات (${trashStudents.length} طالباً) نهائياً وبلا رجعة؟`,
      async () => {
        await runWithProgress(
          async () => {
            const batch = writeBatch(db);
            trashStudents.forEach((student) => {
              batch.delete(doc(db, "trash_students", student.id));
            });
            await batch.commit();
            setShowTrashModal(false);
          },
          "جاري إفراغ سلة المحذوفات نهائياً...",
          "تم إفراغ سلة المحذوفات بالكامل بنجاح 🗑️"
        );
      },
    );
  };

  // Change student class/grade/semester
  const handleChangeStudentClass = async (
    studentId: string,
    type: "grade" | "semester" | "gradeClass",
    value: string,
  ) => {
    if (!currentUser) return;
    try {
      const updateData: any = { [type]: value };
      const currentStudent = students.find((s) => s.id === studentId);
      if (currentStudent) {
        if (type === "grade") {
          const section =
            currentStudent.gradeClass &&
            currentStudent.gradeClass.includes(" - ")
              ? currentStudent.gradeClass.split(" - ")[1].trim()
              : "أ";
          updateData.gradeClass = `${value} - ${section}`;
        } else if (type === "gradeClass") {
          if (value.includes(" - ")) {
            updateData.grade = value.split(" - ")[0].trim();
          }
        }
      }
      await updateDoc(doc(db, "students", studentId), updateData);
      const studentName = currentStudent?.name || "";
      triggerToast(`تم تحديث تصنيف الطالب "${studentName}" بنجاح`, "success");
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `students/${studentId}`,
      );
    }
  };

  // Delete a student's completed quiz attempt and recalculate average
  const handleDeleteStudentCompletedQuiz = async (
    studentId: string,
    quizIndex: number,
  ) => {
    if (!currentUser) return;
    const targetStudentObj = students.find((s) => s.id === studentId);
    if (!targetStudentObj) return;

    const gradesArray = targetStudentObj.detailedGrades || [];
    if (quizIndex < 0 || quizIndex >= gradesArray.length) return;

    const updatedGrades = gradesArray.filter((_, idx) => idx !== quizIndex);

    let sumEarned = 0;
    let sumMax = 0;
    updatedGrades.forEach((g) => {
      sumEarned += g.score;
      sumMax += g.maxScore;
    });

    const newAvg =
      updatedGrades.length > 0
        ? Math.round((sumEarned / (sumMax || 1)) * 100)
        : 0;
    const newStatus =
      newAvg >= 90
        ? "excellent"
        : newAvg >= 75
          ? "good"
          : newAvg >= 60
            ? "average"
            : "needs_improvement";

    await runWithProgress(
      async () => {
        await updateDoc(doc(db, "students", studentId), {
          detailedGrades: updatedGrades,
          averageScore: newAvg,
          status: newStatus,
        });

        // Update local state copy of selectedManageStudent if it matches
        if (selectedManageStudent && selectedManageStudent.id === studentId) {
          setSelectedManageStudent((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              detailedGrades: updatedGrades,
              averageScore: newAvg,
              status: newStatus,
            };
          });
        }
      },
      "جاري حذف نتيجة الاختبار وتحديث المعدل التراكمي للطالب...",
      "تم حذف نتيجة الاختبار وتصحيح المعدل التراكمي بنجاح 🗑️"
    );
  };

  // Filter quizzes based on Search & Select Filter
  const filteredQuizzes = quizzes.filter((q) => {
    const matchesSearch =
      q.title.toLowerCase().includes(quizSearch.toLowerCase()) ||
      q.subject.toLowerCase().includes(quizSearch.toLowerCase());
    const matchesFilter = quizFilter === "all" || q.status === quizFilter;
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    const getTimestamp = (q: any) => {
      if (q.id && q.id.startsWith("q-")) {
        const parts = q.id.split("-");
        const ts = parseInt(parts[1], 10);
        if (!isNaN(ts)) return ts;
      }
      if (q.dateCreated) {
        const parsed = Date.parse(q.dateCreated);
        if (!isNaN(parsed)) return parsed;
      }
      return 0;
    };
    const tsA = getTimestamp(a);
    const tsB = getTimestamp(b);
    if (tsA !== tsB) {
      return tsB - tsA; // descending (newest first)
    }
    return b.id.localeCompare(a.id);
  });

  // Filter students based on Search & Class/Grade Filter
  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.gradeClass.toLowerCase().includes(studentSearch.toLowerCase());
    const matchesFilter = studentFilter === "all" || s.status === studentFilter;

    // Resolve Grade and Semester with safe defaults
    const sGrade =
      s.grade ||
      (s.gradeClass && s.gradeClass.includes(" - ")
        ? s.gradeClass.split(" - ")[0].trim()
        : "الصف العاشر");
    const sSemester =
      s.semester ||
      (s.gradeClass && s.gradeClass.includes(" - ")
        ? s.gradeClass.split(" - ")[1].trim()
        : "الفصل الأول");

    const matchesGrade =
      studentGradeFilter === "all" || sGrade === studentGradeFilter;
    const matchesSemester =
      studentSemesterFilter === "all" || sSemester === studentSemesterFilter;

    return matchesSearch && matchesFilter && matchesGrade && matchesSemester;
  });

  // Stats calculation helper for grade distribution chart (Analytics page)
  const getGradeTally = () => {
    const distribution = {
      excellent: 0,
      good: 0,
      average: 0,
      needs_improvement: 0,
    };
    filteredStudents.forEach((s) => {
      distribution[s.status]++;
    });
    return distribution;
  };
  const distributionData = getGradeTally();

  // Helper for arabic labels of statuses
  const getStatusBadge = (status: Student["status"]) => {
    switch (status) {
      case "excellent":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            امتياز
          </span>
        );
      case "good":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            جيد جداً
          </span>
        );
      case "average":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            مقبول
          </span>
        );
      case "needs_improvement":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            ضعيف / يحتاج تطوير
          </span>
        );
      default:
        return null;
    }
  };

  // --- STANDALONE QUESTION BANK PORTAL VIEW RENDER ---
  if (bankPortalActive) {
    if (currentUser === undefined) {
      return (
        <div
          className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-6 font-sans"
          dir="rtl"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            <p className="text-sm font-bold text-slate-400">
              جاري تحميل بوابة بنك الأسئلة السحابي...
            </p>
          </div>
        </div>
      );
    }

    if (currentUser === null) {
      // Standalone login for Question Bank
      const handleGoogleLogin = async () => {
        try {
          await executeSafeGoogleLogin("مرحباً بك! تم تسجيل الدخول لبوابة بنك الأسئلة المستقلة.");
        } catch (error) {
          // Safe login handles toast notifications internally
        }
      };

      return (
        <div
          className="min-h-screen bg-[#090d16] text-slate-200 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden"
          dir="rtl"
        >
          {/* Decorative gradients */}
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#111827]/80 backdrop-blur-md p-8 md:p-12 rounded-3xl shadow-2xl max-w-lg w-full border border-emerald-500/20 text-center relative z-10"
          >
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white mx-auto shadow-lg shadow-emerald-500/20 mb-6 transform hover:rotate-12 transition-transform duration-300">
              <Database className="w-10 h-10" />
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2 leading-tight">
              بوابة بنك الأسئلة المستقل
            </h1>
            <p className="text-emerald-400 text-xs font-bold tracking-widest uppercase mb-4 font-mono">
              نظام المستودع السحابي الموحد • CENTRAL BANK
            </p>
            <p className="text-slate-400 text-xs md:text-sm mb-8 font-medium leading-relaxed">
              مستودع أسئلة مستقل ومصنف بالكامل وفق المعايير والصفوف والمواد الدراسية. يتم إنشاء وإدارة الأسئلة هنا مركزياً، ليربطها المعلمون لاحقاً باختباراتهم تلقائياً دون تكرار أو عبء محلي في صفحاتهم.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] cursor-pointer"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.25.61 4.46 1.616l2.4-2.4C17.34 1.77 14.93 1 12.24 1c-5.52 0-10 4.48-10 10s4.48 10 10 10c5.77 0 9.6-4.06 9.6-9.715 0-.585-.05-1-.16-1h-9.44z"
                  />
                </svg>
                <span>تسجيل الدخول لبنك الأسئلة (جوجل)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBankPortalActive(false);
                  setStudentPortalActive(false);
                  const url = new URL(window.location.href);
                  url.searchParams.set("teacher", "true");
                  url.searchParams.delete("portal");
                  window.history.pushState({}, "", url.toString());
                }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all duration-200 active:scale-[0.98] cursor-pointer text-xs"
              >
                <span>العودة لبوابة المعلم الرئيسية</span>
              </button>
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap justify-center gap-4 text-[10px] text-slate-500 font-sans font-bold">
              <span>✓ مزامنة سحابية فورية</span>
              <span>✓ استيراد وتوليد بالذكاء الاصطناعي</span>
              <span>✓ تصنيف هرمي دقيق</span>
            </div>
          </motion.div>
        </div>
      );
    }

    // Authenticated Standalone Question Bank Portal
    const totalMCQs = bankQuestions.filter(q => q.type === 'multiple_choice').length;
    const totalTFs = bankQuestions.filter(q => q.type === 'true_false').length;
    const totalSubjects = new Set(bankQuestions.map(q => q.subject)).size;

    return (
      <div
        className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col md:flex-row"
        dir="rtl"
      >
        {/* Portal-specific Sidebar */}
        <aside className="w-full md:w-64 bg-[#0f172a] border-l border-slate-800 text-slate-100 shrink-0 flex flex-col justify-between p-5 md:sticky md:top-0 md:h-screen relative overflow-y-auto overflow-x-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-6 relative z-10">
            {/* Header / Logo */}
            <div className="flex items-center gap-3 pb-5 border-b border-slate-800">
              <div className="w-11 h-11 bg-gradient-to-tr from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 p-0.5 shrink-0">
                <div className="w-full h-full bg-slate-950 rounded-[10px] flex flex-col items-center justify-center relative overflow-hidden">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <span className="text-[6px] font-black tracking-widest text-[#f4be1c] font-sans">
                    BANK
                  </span>
                </div>
              </div>
              <div>
                <h1 className="text-sm font-extrabold text-white leading-tight">
                  بنك الأسئلة المستقل
                </h1>
                <span className="text-[9px] text-[#34d399] font-black mt-1 block">
                  المستودع المركزي الموحد
                </span>
              </div>
            </div>

            {/* Sidebar Stats Widget */}
            <div className="space-y-2.5 p-3.5 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">إحصاءات المستودع السحابي</span>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/50">
                  <span className="text-[10px] text-slate-400 block font-semibold">الأسئلة</span>
                  <span className="text-sm font-black text-white font-sans">{bankQuestions.length}</span>
                </div>
                <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-800/50">
                  <span className="text-[10px] text-slate-400 block font-semibold">المواد</span>
                  <span className="text-sm font-black text-white font-sans">{totalSubjects}</span>
                </div>
              </div>
              <div className="space-y-1 pt-1 border-t border-slate-800/60 text-[10px] text-slate-400 font-medium">
                <div className="flex justify-between">
                  <span>خيارات متعددة:</span>
                  <span className="font-bold text-white font-sans">{totalMCQs}</span>
                </div>
                <div className="flex justify-between">
                  <span>صواب أو خطأ:</span>
                  <span className="font-bold text-white font-sans">{totalTFs}</span>
                </div>
              </div>
            </div>

            {/* Actions list */}
            <nav className="space-y-1.5">
              <button
                type="button"
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20 select-none"
              >
                <Database className="w-4 h-4 shrink-0" />
                <span>إدارة الأسئلة السحابية</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBankPortalActive(false);
                  setStudentPortalActive(false);
                  const url = new URL(window.location.href);
                  url.searchParams.set("teacher", "true");
                  url.searchParams.delete("portal");
                  window.history.pushState({}, "", url.toString());
                  triggerToast("مرحباً بك في لوحة تحكم المعلم", "info");
                }}
                className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-black text-slate-300 hover:bg-slate-850 hover:text-white transition-all cursor-pointer"
              >
                <LayoutGrid className="w-4 h-4 shrink-0 text-slate-450" />
                <span>العودة للوحة المعلم</span>
              </button>
            </nav>
          </div>

          {/* Sidebar bottom */}
          <div className="pt-4 border-t border-slate-800 space-y-3 relative z-10">
            {/* User Info */}
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-300 flex items-center justify-center text-[10px] font-black border border-emerald-550/20">
                  {currentUser.displayName ? currentUser.displayName.charAt(0) : "م"}
                </div>
                <span className="text-[11px] font-black text-slate-250 truncate block flex-1">
                  {currentUser.displayName || currentUser.email}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block font-bold font-sans">
                أمين مستودع الأسئلة
              </span>
            </div>

            {/* Logout */}
            <button
              type="button"
              onClick={async () => {
                await signOut(auth);
                triggerToast("تم تسجيل الخروج بنجاح", "success");
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 text-[11px] font-black transition-all cursor-pointer border border-slate-800/50"
            >
              <LogOut className="w-4 h-4 shrink-0 text-slate-400" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 min-h-screen p-4 md:p-8 space-y-6 overflow-y-auto">
          {/* Header Dashboard Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
            <div className="space-y-1 relative z-10">
              <div className="flex items-center gap-2">
                <span className="text-xs bg-emerald-600 font-extrabold px-2.5 py-1 rounded-full uppercase text-white tracking-wider">البوابة المستقلة</span>
                <span className="text-slate-400 text-xs font-semibold">• السحاب المركزي لأسئلتك المعتمدة</span>
              </div>
              <h2 className="text-xl md:text-2xl font-black">مستودع بنك الأسئلة الموحد</h2>
              <p className="text-xs text-slate-400 font-medium">قاعدة بيانات مستقلة بالكامل تتيح لك صياغة الأسئلة وربطها لاحقاً بالاختبارات في ثوانٍ معدودة.</p>
            </div>
            
            <div className="flex gap-2 relative z-10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setBankPortalActive(false);
                  setStudentPortalActive(false);
                  const url = new URL(window.location.href);
                  url.searchParams.set("teacher", "true");
                  url.searchParams.delete("portal");
                  window.history.pushState({}, "", url.toString());
                  triggerToast("مرحباً بك في لوحة تحكم المعلم", "info");
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-black text-xs transition cursor-pointer"
              >
                لوحة تحكم المعلم ⏎
              </button>
            </div>
          </div>

          {/* Embedded Centralized QuestionBankTab */}
          <div className="bg-white p-2 rounded-3xl border border-slate-200/80 shadow-xs">
            <QuestionBankTab
              currentUser={currentUser}
              bankQuestions={bankQuestions}
              bankQuestionsLoaded={bankQuestionsLoaded}
              triggerToast={triggerToast}
              triggerConfirm={triggerConfirm}
              onAutoCreateQuiz={handleAutoCreateQuiz}
            />
          </div>
        </main>

        {/* Custom Confirmation Modal for Standalone Portal */}
        <AnimatePresence>
          {confirmDialog && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
                dir="rtl"
              >
                <div className="p-6">
                  <div className="flex items-center gap-3 text-slate-900 mb-3">
                    <AlertTriangle className="w-6 h-6 shrink-0 text-amber-500 animate-pulse" />
                    <h3 className="text-base font-black text-slate-900">
                      {confirmDialog.title}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                    {confirmDialog.message}
                  </p>
                </div>
                <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-3 justify-start">
                  <button
                    type="button"
                    disabled={isConfirmLoading}
                    onClick={confirmDialog.onConfirm}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                      isConfirmLoading
                        ? "bg-slate-400 text-white border-slate-400 cursor-not-allowed shadow-none"
                        : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100"
                    }`}
                  >
                    {isConfirmLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
                        <span>جاري التنفيذ...</span>
                      </>
                    ) : (
                      confirmDialog.confirmText || "تأكيد"
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isConfirmLoading}
                    onClick={confirmDialog.onCancel}
                    className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all border border-transparent ${
                      isConfirmLoading
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "hover:bg-slate-200 bg-slate-100 text-slate-700 cursor-pointer"
                    }`}
                  >
                    {confirmDialog.cancelText || "إلغاء الإجراء"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // --- STUDENT MODE VIEW RENDER ---
  if (
    studentQuizId ||
    (studentPortalActive && !urlParams.get("teacher")) ||
    teacherPreviewActive
  ) {
    if (studentQuizLoading) {
      return (
        <div
          className="min-h-screen bg-slate-50/70 flex flex-col items-center justify-center p-6 text-slate-800 animate-pulse"
          dir="rtl"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="text-sm font-bold text-slate-500 font-sans">
              جاري تحميل البوابة التعليمية للطلاب...
            </p>
          </div>
        </div>
      );
    }

    // A. NO TEACHER OR EXAM CONTEXT AT ALL (ROOT DOMAIN / NO PARAMETERS)
    if (!studentPortalTeacherId && !studentQuizId) {
      return (
        <div
          className="min-h-screen bg-slate-50/80 py-12 px-4 md:px-6 text-slate-800 flex flex-col items-center justify-center animate-fade-in"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-lg w-full overflow-hidden text-center"
          >
            {/* Main Platform Header */}
            <div className="p-8 md:p-10 bg-gradient-to-tr from-[#1e3a8a] via-indigo-700 to-blue-600 text-white relative font-sans">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white mx-auto mb-4 border border-white/20 shadow-inner">
                <GraduationCap className="w-9 h-9 text-amber-300" />
              </div>
              <span className="inline-block px-3.5 py-1 rounded-full bg-white/15 text-amber-300 text-xs font-black tracking-wide mb-2.5 backdrop-blur-xs border border-white/10">
                منصة SmartCloud التعليمية
              </span>
              <h1 className="text-2xl md:text-3xl font-black leading-tight text-white">
                منصة الاختبارات والتقييم الذكي
              </h1>
              <p className="text-white/85 text-xs md:text-sm mt-3 max-w-md mx-auto font-medium leading-relaxed">
                النظام الشامل لإدارة الاختبارات ورصد الدرجات وبنك الأسئلة السحابي
              </p>
            </div>

            {/* Portal Action Card */}
            <div className="p-6 md:p-8 space-y-6 bg-slate-50/50">
              <div className="p-5 rounded-2xl bg-white border border-indigo-100 shadow-sm text-right space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-200 mt-0.5">
                    <LayoutDashboard className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-indigo-950">
                      بوابة الأستاذ الذكية
                    </h2>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                      تسجيل دخول المعلمين، إنشاء الاختبارات والتطبيقات، وإدارة نتائج الطلاب
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-center gap-2 text-center text-indigo-900 font-bold text-sm bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-100">
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>أهلاً وسهلاً بكم في منصة SmartCloud التعليمية الذكية</span>
                </div>
              </div>


            </div>
          </motion.div>
        </div>
      );
    }

    // B. STUDENT NAME SELECTION / REGISTRATION SCREEN (IF NOT LOGGED IN YET)
    if (!studentSelectedId) {
      const classFilteredStudents = students.filter((s) => {
        const sGrade =
          s.grade ||
          (s.gradeClass && s.gradeClass.includes(" - ")
            ? s.gradeClass.split(" - ")[0].trim()
            : "الصف العاشر");
        const sSemester =
          s.semester ||
          (s.gradeClass && s.gradeClass.includes(" - ")
            ? s.gradeClass.split(" - ")[1].trim()
            : "الفصل الأول");
        return (
          normalizeGradeName(sGrade) ===
            normalizeGradeName(studentSelectedGrade) &&
          normalizeSemesterName(sSemester) ===
            normalizeSemesterName(studentSelectedSemester)
        );
      });

      const handleStudentPortalLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!studentLoginSelectId) {
          triggerToast(
            "الرجاء اختيار اسمك من قائمة الكشف المدرسية المدرجة",
            "error",
          );
          return;
        }
        const match = students.find(
          (s) => s.id === studentLoginSelectId,
        );
        if (match) {
          // Check password security if required
          if (match.passwordRequired) {
            const hasPassSet = !!match.password;
            if (!studentLoginPassword) {
              const errMsg = hasPassSet
                ? "الرجاء إدخال كلمة المرور المعتمدة الخاصة بك للتحقق"
                : "الرجاء تحديد واختيار كلمة مرور رقمية جديدة لحسابك لأول مرة";
              setPasswordErrorShake(true);
              setTimeout(() => setPasswordErrorShake(false), 500);
              setPasswordErrorMessage(errMsg);
              triggerToast(errMsg, "error");
              return;
            }
            if (!hasPassSet && !studentLoginConfirmPassword) {
              const errMsg = "الرجاء إدخال تأكيد كلمة المرور في المربع الثاني للمطابقة";
              setPasswordErrorShake(true);
              setTimeout(() => setPasswordErrorShake(false), 500);
              setPasswordErrorMessage(errMsg);
              triggerToast(errMsg, "error");
              return;
            }
            if (!hasPassSet && studentLoginPassword !== studentLoginConfirmPassword) {
              const errMsg = "كلمتا المرور غير متطابقتين! يرجى التأكد من تطابقهما";
              setPasswordErrorShake(true);
              setTimeout(() => setPasswordErrorShake(false), 500);
              setPasswordErrorMessage(errMsg);
              triggerToast(errMsg, "error");
              return;
            }
            const numericOnly = studentLoginPassword.replace(
              /[^0-9]/g,
              "",
            );
            if (numericOnly !== studentLoginPassword) {
              const errMsg = "عذراً، يجب تسجيل أرقام فقط ككلمة مرور";
              setPasswordErrorShake(true);
              setTimeout(() => setPasswordErrorShake(false), 500);
              setPasswordErrorMessage(errMsg);
              triggerToast(errMsg, "error");
              return;
            }
            if (studentLoginPassword.length > 10) {
              const errMsg = "عذراً، يجب أن لا تتجاوز كلمة المرور 10 أرقام فقط";
              setPasswordErrorShake(true);
              setTimeout(() => setPasswordErrorShake(false), 500);
              setPasswordErrorMessage(errMsg);
              triggerToast(errMsg, "error");
              return;
            }

            if (!hasPassSet) {
              // First time login: Set password in DB and local state
              try {
                const studentRef = doc(db, "students", match.id);
                await updateDoc(studentRef, {
                  password: studentLoginPassword,
                });
                // update matches locally
                setStudents((prev) =>
                  prev.map((s) =>
                    s.id === match.id
                      ? { ...s, password: studentLoginPassword }
                      : s,
                  ),
                );
                triggerToast(
                  "تم تعيين كلمة المرور وحفظها بنجاح لحسابك المستقبلي!",
                  "success",
                );
              } catch (err) {
                console.error(
                  "Failed to associate password to student:",
                  err,
                );
                triggerToast(
                  "خطأ أثناء تعيين كلمة المرور، يرجى إعادة المحاولة.",
                  "error",
                );
                return;
              }
            } else {
              // Subsequent logins: verify password matches
              if (match.password !== studentLoginPassword) {
                const errMsg = "كلمة المرور غير صحيحة! يرجى إعادة المحاولة أو مراجعة معلمك لإعادة تعيينها.";
                setPasswordErrorShake(true);
                setTimeout(() => setPasswordErrorShake(false), 500);
                setPasswordErrorMessage(errMsg);
                triggerToast(errMsg, "error");
                return;
              }
            }
          }

          localStorage.setItem("seb_student_logged_id", match.id);
          localStorage.setItem(
            "seb_student_grade",
            match.grade || studentSelectedGrade,
          );
          localStorage.setItem(
            "seb_student_semester",
            match.semester || studentSelectedSemester,
          );
          setStudentSelectedId(match.id);
          triggerToast(
            `أهلاً بك مجدداً يا ${match.name}! تم الدخول بنجاح.`,
            "success",
          );
        }
      };

      return (
        <div
          className="min-h-screen bg-slate-50/70 py-12 px-4 md:px-6 text-slate-800 flex items-center justify-center animate-fade-in"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-200/60 shadow-xl max-w-md w-full overflow-hidden"
          >
            <div className="p-8 bg-gradient-to-tr from-indigo-750 to-indigo-600 text-white text-center relative font-sans">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-white mx-auto mb-4 border border-white/10">
                <BookOpen className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-black leading-tight">
                بوابة الطالب الإلكترونية
              </h1>
              <p className="text-white/80 text-xs mt-2 leading-tight">
                اختر صفك الدراسي واسمك المعتمد للدخول المباشر إلى كشف اختباراتك
                النشطة ومراجعة تقارير درجاتك الفورية.
              </p>
            </div>

            {/* Selection and Details */}
            <form onSubmit={handleStudentPortalLogin} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-500 font-bold text-xs block">
                      الصف الدراسي الخاص بك:
                    </label>
                    <select
                      value={studentSelectedGrade}
                      onChange={(e) => {
                        setStudentSelectedGrade(e.target.value);
                        setStudentLoginSelectId("");
                      }}
                      className="w-full bg-slate-50 border border-slate-205 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans cursor-pointer transition-all hover:bg-slate-100"
                    >
                      {studentGradesList.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-500 font-bold text-xs block">
                      الفصل الدراسي:
                    </label>
                    <select
                      value={studentSelectedSemester}
                      onChange={(e) => {
                        setStudentSelectedSemester(e.target.value);
                        setStudentLoginSelectId("");
                      }}
                      className="w-full bg-slate-50 border border-slate-205 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans cursor-pointer transition-all hover:bg-slate-100"
                    >
                      {studentSemestersList.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <label className="text-slate-600 font-extrabold text-xs block">
                    اختر اسمك المعتمد في كشوفات الطلاب:
                  </label>
                  <select
                    value={studentLoginSelectId}
                    onChange={(e) => setStudentLoginSelectId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-205 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans cursor-pointer font-bold transition-all hover:bg-slate-100"
                  >
                    <option value="">-- اختر اسمك للبدء الفوري --</option>
                    {classFilteredStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name}
                      </option>
                    ))}
                  </select>
                  {classFilteredStudents.length === 0 && (
                    <span className="text-[11px] text-amber-600 block mt-2 font-bold leading-relaxed bg-amber-50 p-3 rounded-lg border border-amber-100">
                      لم نرصد أي طلاب مسجلين في هذا القسم الدراسي حالياً من قبل
                      المعلم. الرجاء مراجعة معلمك المعتمد لتسجيل اسمك في الكشف
                      المكتبي.
                    </span>
                  )}
                </div>

                {(() => {
                  const selectedStudentObj = students.find(
                    (s) => s.id === studentLoginSelectId,
                  );
                  if (
                    !selectedStudentObj ||
                    !selectedStudentObj.passwordRequired
                  )
                    return null;
                  const hasPassSet = !!selectedStudentObj.password;
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={
                        passwordErrorShake
                          ? { x: [-10, 10, -10, 10, -5, 5, 0], opacity: 1, y: 0 }
                          : { opacity: 1, y: 0, x: 0 }
                      }
                      transition={
                        passwordErrorShake
                          ? { x: { type: "tween", duration: 0.4 }, default: { duration: 0.2 } }
                          : { duration: 0.2 }
                      }
                      className={`p-4 rounded-2xl border ${
                        passwordErrorShake
                          ? "border-rose-450 bg-rose-50/20"
                          : "bg-indigo-50/50 border-indigo-100"
                      } space-y-2 mt-4 transition-all duration-200`}
                    >
                      <div className="space-y-3">
                        <div>
                          <label className="text-indigo-950 font-black text-xs block flex items-center gap-1.5 mb-1">
                            <span>🔒</span>
                            {hasPassSet
                              ? "مطلوب كلمة المرور لتسجيل الدخول:"
                              : "إنشاء كلمة المرور الخاصة بك (لأول مرة - أرقام فقط):"}
                          </label>
                          <div className="relative">
                            <input
                              type={showPassword ? "text" : "password"}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={10}
                              placeholder={
                                hasPassSet
                                  ? "أدخل كلمة المرور المكونة من أرقام فقط"
                                  : "أدخل كلمة مرور جديدة (أرقام فقط، بحد أقصى 10 أرقام)"
                              }
                              value={studentLoginPassword}
                              onChange={(e) => {
                                setStudentLoginPassword(
                                  e.target.value.replace(/[^0-9]/g, ""),
                                );
                                if (passwordErrorShake) {
                                  setPasswordErrorShake(false);
                                }
                                if (passwordErrorMessage) {
                                  setPasswordErrorMessage("");
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleStudentPortalLogin();
                                }
                              }}
                              className={`w-full bg-white border ${
                                passwordErrorShake || !!passwordErrorMessage
                                  ? "border-rose-500 ring-2 ring-rose-200 focus:ring-rose-500 bg-rose-50/30"
                                  : "border-indigo-200 focus:ring-indigo-500"
                              } rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 font-mono text-center tracking-widest font-black text-slate-800 transition-all`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors p-1 flex items-center justify-center cursor-pointer"
                              title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                            >
                              {showPassword ? (
                                <EyeOff className="w-4 h-4 shrink-0" />
                              ) : (
                                <Eye className="w-4 h-4 shrink-0" />
                              )}
                            </button>
                          </div>

                          {/* Red Error Banner under password input */}
                          {(passwordErrorMessage || passwordErrorShake) && (
                            <motion.div 
                              initial={{ opacity: 0, y: -4, scale: 0.98 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              className="text-rose-700 font-extrabold text-xs flex items-center gap-2 mt-2 bg-rose-100/90 py-2 px-3 rounded-xl border-2 border-rose-300 text-center justify-center shadow-sm"
                            >
                              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 animate-bounce" />
                              <span className="leading-tight">
                                {passwordErrorMessage || "⚠️ يوجد خطأ في كلمة المرور! يرجى إعادة كتابة كلمة المرور مرة أخرى بشكل صحيح."}
                              </span>
                            </motion.div>
                          )}
                        </div>

                        {!hasPassSet && (
                          <div className="pt-1">
                            <label className="text-indigo-950 font-black text-xs block flex items-center gap-1.5 mb-1">
                              <span>🔑</span>
                              <span>تأكيد كلمة المرور:</span>
                            </label>
                            <div className="relative">
                              <input
                                type={showPassword ? "text" : "password"}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={10}
                                placeholder="أعد إدخال كلمة المرور للتأكيد"
                                value={studentLoginConfirmPassword}
                                onChange={(e) => {
                                  setStudentLoginConfirmPassword(
                                    e.target.value.replace(/[^0-9]/g, ""),
                                  );
                                  if (passwordErrorShake) {
                                    setPasswordErrorShake(false);
                                  }
                                  if (passwordErrorMessage) {
                                    setPasswordErrorMessage("");
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleStudentPortalLogin();
                                  }
                                }}
                                className={`w-full bg-white border ${
                                  passwordErrorShake || !!passwordErrorMessage || (studentLoginConfirmPassword && studentLoginConfirmPassword !== studentLoginPassword)
                                    ? "border-rose-500 ring-2 ring-rose-200 focus:ring-rose-500 bg-rose-50/30"
                                    : "border-indigo-200 focus:ring-indigo-500"
                                } rounded-xl pl-12 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 font-mono text-center tracking-widest font-black text-slate-800 transition-all`}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors p-1 flex items-center justify-center cursor-pointer"
                                title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                              >
                                {showPassword ? (
                                  <EyeOff className="w-4 h-4 shrink-0" />
                                ) : (
                                  <Eye className="w-4 h-4 shrink-0" />
                                )}
                              </button>
                            </div>
                            {studentLoginConfirmPassword && studentLoginConfirmPassword !== studentLoginPassword && (
                              <div className="text-rose-700 font-extrabold text-xs flex items-center justify-center gap-1.5 mt-2 bg-rose-100/90 py-1.5 px-3 rounded-xl border border-rose-300">
                                <span>⚠️ كلمتا المرور غير متطابقتين! يرجى إعادة كتابتهما للتطابق.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <span className="text-[10px] text-indigo-600 block font-bold leading-normal mt-2">
                        {hasPassSet
                          ? "يرجى كتابة كلمة المرور المكونة من أرقام فقط التي اخترتها سابقاً."
                          : "تنبيه: ستكون كلمة المرور هذه هي المطلوبة منك دائماً لتسجيل دخولك القادم."}
                      </span>
                    </motion.div>
                  );
                })()}
              </div>

              {/* Start Quiz CTA */}
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl font-black shadow-lg shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 hover:shadow-indigo-500/40 active:translate-y-0 active:scale-[0.99] cursor-pointer"
              >
                <BookOpen className="w-5 h-5" />
                <span>دخول البوابة</span>
              </button>

              <div className="pt-4 flex flex-col items-center gap-2.5 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("seb_student_logged_id");
                    localStorage.removeItem("seb_student_teacher_id");
                    setStudentPortalActive(false);
                    const url = new URL(window.location.href);
                    url.searchParams.set("teacher", "true");
                    window.history.pushState({}, "", url.toString());
                    triggerToast(
                      "تم الانتقال إلى بوابة المعلم بنجاح",
                      "success",
                    );
                  }}
                  className="text-xs text-slate-400 hover:text-indigo-600 font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>التبديل إلى بوابة المعلم (الإدارة)</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      );
    }

    // C. COMPREHENSIVE STUDENT PORTAL DASHBOARD (WHEN LOGGED IN BUT QUIZ NOT ACTIVE YET)
    if (!studentQuizStarted) {
      // Find current student profile
      const activeStudent = students.find(
        (s) => s.id === studentSelectedId,
      ) || {
        id: studentSelectedId,
        name: studentNameInput || "طالب ذكي",
        gradeClass: `${studentSelectedGrade} - ${studentSelectedSemester}`,
        grade: studentSelectedGrade,
        semester: studentSelectedSemester,
        email: studentEmailInput || "",
        averageScore: 0,
        status: "good" as const,
        detailedGrades: [],
      };

      // Filter all active quizzes from current teacher that this student has NOT taken yet
      const activeQuizzes = quizzes.filter((q) => {
        // Must be active
        if (q.status !== "active") return false;

        // Grade matching if filtered
        if (
          q.grade &&
          normalizeGradeName(q.grade) !==
            normalizeGradeName(activeStudent.grade || studentSelectedGrade)
        ) {
          return false;
        }

        // Semester matching if customized/filtered (excluding "جميع الفصول")
        if (
          q.semester &&
          q.semester !== "جميع الفصول" &&
          normalizeSemesterName(q.semester) !==
            normalizeSemesterName(activeStudent.semester || studentSelectedSemester)
        ) {
          return false;
        }

        // Ensure student has not submitted this quiz yet (matching by title)
        const isTaken =
          activeStudent.detailedGrades &&
          activeStudent.detailedGrades.some((g) => g.quizTitle === q.title);
        return !isTaken;
      });

      // Sort quizzes from newest to oldest by creation date
      activeQuizzes.sort((a, b) => {
        const getTimestamp = (q: any) => {
          if (q.id && q.id.startsWith("q-")) {
            const parts = q.id.split("-");
            const ts = parseInt(parts[1], 10);
            if (!isNaN(ts)) return ts;
          }
          if (q.dateCreated) {
            const parsed = Date.parse(q.dateCreated);
            if (!isNaN(parsed)) return parsed;
          }
          return 0;
        };
        const tsA = getTimestamp(a);
        const tsB = getTimestamp(b);
        if (tsA !== tsB) {
          return tsB - tsA; // descending (newest first)
        }
        return b.id.localeCompare(a.id);
      });

      const completedQuizzes = activeStudent.detailedGrades || [];

      // Calculate level color
      const getStatusColor = (status: string) => {
        switch (status) {
          case "excellent":
            return "from-emerald-600 to-teal-600 border-emerald-500 text-emerald-100";
          case "good":
            return "from-blue-600 to-indigo-600 border-blue-500 text-blue-101";
          case "average":
            return "from-amber-500 to-orange-600 border-amber-500 text-amber-101";
          default:
            return "from-rose-500 to-red-600 border-rose-450 text-rose-101";
        }
      };

      const getStatusArabicLabel = (status: string) => {
        switch (status) {
          case "excellent":
            return "ممتاز (امتياز حافز)";
          case "good":
            return "جيد جداً (تحصيل رائع)";
          case "average":
            return "مقبول (مستمر بالعمل)";
          default:
            return "يحتاج دعم وتطوير مستمر";
        }
      };

      const showStudentSidebar = !(studentActiveNav === "reviews" && (studentReviewGameState === "playing" || studentReviewGameState === "finished")) && !(studentActiveNav === "curriculum_review" && selectedCurriculumSubject);
      const isLightBg = showStudentSidebar || (studentActiveNav === "curriculum_review");

      return (
        <div
          className={`min-h-screen ${isLightBg ? "bg-slate-50 text-slate-800" : "bg-slate-950 text-white"} flex flex-col md:flex-row`}
          dir="rtl"
        >
          {/* Right Sidebar menu styled dynamically with premium dark smart look */}
          {showStudentSidebar && (
            <aside className="w-full md:w-64 bg-slate-900 border-l border-slate-800 text-slate-100 shrink-0 flex flex-col justify-between p-5 md:sticky md:top-0 md:h-screen relative overflow-y-auto overflow-x-hidden shadow-2xl">
            {/* Subtle background glow */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="space-y-6 relative z-10">
              {/* Logo / Brand header matching teacher portal's premium badge */}
              <div className="flex items-center gap-3 pb-5 border-b border-slate-800">
                <div className="w-11 h-11 bg-gradient-to-tr from-indigo-550 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-550/20 p-0.5 shrink-0 transform hover:scale-110 transition-transform">
                  <div className="w-full h-full bg-slate-950 rounded-[10px] flex flex-col items-center justify-center relative overflow-hidden">
                    <GraduationCap className="w-5 h-5 text-indigo-400" />
                    <span className="text-[7px] font-black tracking-widest text-[#f4be1c] font-sans">
                      PORTAL
                    </span>
                  </div>
                </div>
                <div>
                  <h1 className="text-sm font-extrabold text-white leading-none leading-tight">
                    بوابة الطالب الإلكترونية
                  </h1>
                  <span className="text-[9px] text-[#818cf8] font-black mt-1 block mb-2">
                    نظام التعلم الفوري
                  </span>
                  <motion.div
                    className="relative p-[1.5px] rounded-lg overflow-hidden bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 bg-[length:200%_auto] w-full mt-1"
                    animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  >
                    <div className="text-[10px] text-slate-300 font-bold bg-slate-900 rounded-[7px] px-2.5 py-1 flex flex-col gap-0.5 w-full">
                      <span className="text-indigo-300 text-[9px] font-black">تحت إشراف المعلم:</span>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 font-extrabold text-[11.5px] truncate">
                        {studentPortalTeacherName || "جاري جلب المعلم..."}
                      </span>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* Navigation Tabs */}
              <nav className="space-y-1.5 animate-none">
                <button
                  type="button"
                  onClick={() => {
                    setStudentActiveNav("home");
                    setSelectedCurriculumSubject(null);
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-black transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer ${
                    studentActiveNav === "home"
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/30"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Home className="w-4 h-4 shrink-0 text-indigo-400" />
                  <span>الرئيسية 🏠</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStudentActiveNav("curriculum_review");
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-black transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer ${
                    studentActiveNav === "curriculum_review"
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/30"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Sparkles className="w-4 h-4 shrink-0 text-[#f4be1c]" />
                  <span>المراجعة الشاملة 📖</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStudentActiveNav("reviews");
                    setSelectedCurriculumSubject(null);
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-black transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer ${
                    studentActiveNav === "reviews"
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/30"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Gamepad2 className="w-4 h-4 shrink-0 text-yellow-400" />
                  <span>ألعاب وتحديات 🏆</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStudentActiveNav("quizzes");
                    setSelectedCurriculumSubject(null);
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-xs font-black transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer ${
                    studentActiveNav === "quizzes"
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-lg shadow-indigo-500/30"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>اختباراتي المدرسية 📝</span>
                </button>
              </nav>
            </div>

            {/* Sidebar bottom info & logout */}
            <div className="pt-4 border-t border-slate-800 space-y-3 relative z-10">
              {/* Student status mini card */}
              <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-xl space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-300 flex items-center justify-center text-[10px] font-black border border-indigo-550/20">
                    {activeStudent.name ? activeStudent.name.charAt(0) : "ط"}
                  </div>
                  <span className="text-[11px] font-black text-slate-250 truncate block flex-1">
                    {activeStudent.name}
                  </span>
                </div>
                <span className="text-[9px] text-slate-400 block font-bold font-sans">
                  دراسة ومتابعة • معدل: {activeStudent.averageScore}%
                </span>
              </div>

              {/* Logout button */}
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("seb_student_logged_id");
                  localStorage.removeItem("seb_student_grade");
                  localStorage.removeItem("seb_student_semester");
                  setStudentSelectedId("");
                  setStudentLoggedInId(null);
                  triggerToast("تم تسجيل الخروج بنجاح. بالتوفيق!", "info");
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-[11px] font-black transition-all duration-200 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>تسجيل الخروج</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.close();
                  setTimeout(() => {
                    triggerToast("إذا لم يغلق التبويب تلقائياً، يرجى إغلاقه يدوياً من المتصفح ❌", "info");
                  }, 400);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-slate-200 text-[11px] font-black transition-all duration-200 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer border border-slate-800/50"
              >
                <XCircle className="w-4 h-4 shrink-0 text-slate-400" />
                <span>إغلاق المتصفح</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStudentPortalActive(false);
                  const url = new URL(window.location.href);
                  url.searchParams.set("teacher", "true");
                  window.history.pushState({}, "", url.toString());
                  triggerToast(
                    "تم الانتقال إلى بوابة المعلم بنجاح",
                    "success",
                  );
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-[11px] font-black transition-all duration-200 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer border border-emerald-800/50"
              >
                <LayoutDashboard className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>معاينة صفحة المعلم</span>
              </button>
            </div>
          </aside>
          )}

          {/* Main content pane */}
          <div className={`flex-1 min-h-screen ${showStudentSidebar ? "bg-slate-50" : "bg-slate-950"} flex flex-col`}>
            {/* Top header navigation breadcrumb */}
            {showStudentSidebar && (
              <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold">
                    بوابة الطالب &gt;
                  </span>
                  <span className="text-xs text-indigo-600 font-black">
                    {studentActiveNav === "home" && "الصفحة الرئيسية والمتابعة 🏠"}
                    {studentActiveNav === "quizzes" && "الاختبارات المدرسية المتاحة 📝"}
                    {studentActiveNav === "reviews" && "الألعاب والتحديات التنافسية 🏆"}
                    {studentActiveNav === "curriculum_review" && "المراجعة الشاملة للمناهج 📖"}
                  </span>
                </div>
              </header>
            )}

            {/* Inner Content Area */}
            <main className={`p-4 md:p-8 flex-1 ${studentActiveNav === "curriculum_review" ? "w-full max-w-none" : (showStudentSidebar ? "max-w-6xl" : "max-w-7xl")} w-full mx-auto space-y-8`}>
              {/* TAB 1: STUDENT HOME PAGE */}
              {studentActiveNav === "home" && (() => {
                // Fetch stats for curriculum review from localStorage
                const statsKey = `curriculum_stats_${activeStudent?.id || "anonymous"}`;
                const savedStats = localStorage.getItem(statsKey);
                const parsedStats = savedStats ? JSON.parse(savedStats) : {};
                const solvedLessons = Object.values(parsedStats).filter((s: any) => s.solved);
                const solvedCount = solvedLessons.length;
                let totalPct = 0;
                solvedLessons.forEach((curr: any) => {
                  const s = Number(curr.score) || 0;
                  const m = Number(curr.maxScore) || 100;
                  totalPct += (s / m) * 100;
                });
                const avgCurriculumScore = solvedCount > 0 ? Math.round(totalPct / solvedCount) : 0;

                // Games and challenges stats
                const myScores = reviewScores.filter(s => s.studentId === activeStudent.id);
                const completedGamesCount = myScores.length;
                const highestGameScore = myScores.length > 0 ? Math.max(...myScores.map(s => s.score)) : 0;

                // Quizzes stats
                const completedQuizzesCount = completedQuizzes.length;
                const pendingQuizzesCount = activeQuizzes.length;

                return (
                  <div className="space-y-8 animate-fade-in">
                    {/* Welcome Banner */}
                    <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 rounded-2xl p-4 md:px-6 md:py-4 text-white shadow-md relative overflow-hidden border border-indigo-800">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                      
                      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="inline-flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-xs font-black border border-indigo-500/30">
                            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                            <span>بوابتك التعليمية 🌟</span>
                          </div>
                          
                          <h2 className="text-base md:text-lg font-extrabold leading-tight">
                            أهلاً بك مجدداً يا {activeStudent.name}! 👋
                          </h2>
                        </div>
                      </div>
                    </div>

                    {/* Quick performance overview section */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                        <TrendingUp className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-extrabold text-slate-800">ملخص أدائك في جميع الأقسام</h3>
                      </div>

                      {/* Sections Bento-Grid / Custom Responsive Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* CARD 1: المراجعة الشاملة */}
                        <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-xs hover:shadow-md transition-all duration-350 flex flex-col justify-between group">
                          <div className="space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100/50 group-hover:scale-110 transition-transform">
                              <Sparkles className="w-6 h-6 text-[#f4be1c]" />
                            </div>
                            
                            <div className="space-y-1">
                              <h4 className="font-extrabold text-base text-slate-900">المراجعة الشاملة 📖</h4>
                              <p className="text-xs text-slate-500 leading-relaxed">
                                راجع جميع الدروس المدرسية، وحل التمارين الذكية التفاعلية المخصصة لكل قسم لتثبيت معلوماتك المدرسية بشكل ممتاز.
                              </p>
                            </div>

                            {/* Stats */}
                            <div className="p-3 bg-slate-50 rounded-2xl space-y-2 border border-slate-100">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-bold">الدروس المحلولة:</span>
                                <span className="font-black text-indigo-600">{solvedCount} درس</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-bold">متوسط التحصيل:</span>
                                <span className="font-black text-emerald-600">{avgCurriculumScore}%</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-6">
                            <button
                              type="button"
                              onClick={() => setStudentActiveNav("curriculum_review")}
                              className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                            >
                              <span>ابدأ المراجعة الآن</span>
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* CARD 2: ألعاب وتحديات */}
                        <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-xs hover:shadow-md transition-all duration-350 flex flex-col justify-between group">
                          <div className="space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-yellow-50 text-yellow-600 flex items-center justify-center border border-yellow-100/50 group-hover:scale-110 transition-transform">
                              <Gamepad2 className="w-6 h-6 text-yellow-500" />
                            </div>
                            
                            <div className="space-y-1">
                              <h4 className="font-extrabold text-base text-slate-900">ألعاب وتحديات 🏆</h4>
                              <p className="text-xs text-slate-500 leading-relaxed">
                                تعلم بمرح وتنافس مع زملائك في التحديات والمسابقات المتنوعة واكسب الأوسمة والنجوم الذهبية!
                              </p>
                            </div>

                            {/* Stats */}
                            <div className="p-3 bg-slate-50 rounded-2xl space-y-2 border border-slate-100">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-bold">التحديات المنجزة:</span>
                                <span className="font-black text-indigo-600">{completedGamesCount} تحدي</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-bold">أعلى نتيجة لعبة:</span>
                                <span className="font-black text-yellow-600">{highestGameScore} نقطة</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-6">
                            <button
                              type="button"
                              onClick={() => {
                                setStudentActiveNav("reviews");
                                setSelectedCurriculumSubject(null);
                              }}
                              className="w-full py-2.5 px-4 bg-yellow-50 hover:bg-yellow-100 text-amber-800 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                            >
                              <span>انطلق للتحدي واللعب</span>
                              <ChevronLeft className="w-4 h-4 text-amber-700" />
                            </button>
                          </div>
                        </div>

                        {/* CARD 3: اختباراتي المدرسية */}
                        <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-xs hover:shadow-md transition-all duration-350 flex flex-col justify-between group">
                          <div className="space-y-4">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/50 group-hover:scale-110 transition-transform">
                              <BookOpen className="w-6 h-6 text-emerald-600" />
                            </div>
                            
                            <div className="space-y-1">
                              <h4 className="font-extrabold text-base text-slate-900">اختباراتي المدرسية 📝</h4>
                              <p className="text-xs text-slate-500 leading-relaxed">
                                خض اختباراتك المدرسية والواجبات المخصصة لك، واستعرض الدرجات والتقارير المفصلة لإجاباتك النموذجية.
                              </p>
                            </div>

                            {/* Stats */}
                            <div className="p-3 bg-slate-50 rounded-2xl space-y-2 border border-slate-100">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-bold">بانتظارك للحل:</span>
                                <span className={`font-black ${pendingQuizzesCount > 0 ? "text-rose-600 font-black animate-pulse" : "text-slate-600"}`}>
                                  {pendingQuizzesCount} اختبار
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-bold">الاختبارات المكتملة:</span>
                                <span className="font-black text-emerald-600">{completedQuizzesCount} اختبار</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-6">
                            <button
                              type="button"
                              onClick={() => {
                                setStudentActiveNav("quizzes");
                                setSelectedCurriculumSubject(null);
                              }}
                              className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                            >
                              <span>عرض الاختبارات المتاحة</span>
                              <ChevronLeft className="w-4 h-4 text-emerald-600" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Encounraging/Motivational Bottom Section */}
                    <div className="bg-white border border-slate-150 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-gradient-to-br from-yellow-300 to-amber-500 rounded-full flex items-center justify-center text-white text-2xl shadow-md shrink-0">
                          🏆
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-sm text-slate-950">نصيحة اليوم الذهبية من معلمك الذكي 💡</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            "تذكر دائماً أن النجاح هو مجموع خطوات صغيرة ومستمرة تُبذل يوماً بعد يوم. التركيز، المراجعة المستمرة وحب التعلم هم سلاحك الأقوى!"
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-indigo-600 font-extrabold shrink-0 border border-indigo-100 bg-indigo-50/50 px-4 py-2 rounded-2xl">
                        رابطتك المدرسية: {activeStudent.gradeClass}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB 2: QUIZZES PAGE */}
              {studentActiveNav === "quizzes" && (
                <div className="space-y-6">
                  {/* Secondary: Selected Quiz Review Overlay Sheet */}
                  {selectedCompletedQuizData && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-indigo-50/70 border border-indigo-150 p-6 rounded-3xl shadow-sm space-y-4"
                    >
                      <div className="flex justify-between items-center pb-3 border-b border-indigo-100">
                        <div className="flex items-center gap-2">
                          <Award className="w-5 h-5 text-indigo-600" />
                          <h3 className="font-extrabold text-sm text-indigo-950">
                            معايير الإجابة الصحيحة للاختبار:{" "}
                            <strong className="text-indigo-600">
                              {selectedCompletedQuizData.title}
                            </strong>
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedCompletedQuizData(null)}
                          className="p-1 px-3 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          إغلاق المعاينة والرجوع ✕
                        </button>
                      </div>

                      <div className="space-y-4 pt-1">
                        <p className="text-xs text-indigo-600 font-bold leading-relaxed">
                          يعرض هذا القسم مراجعة الأسئلة مع الإجابات الصحيحة
                          (النموذجية) التي تم برمجتها بواسطة المعلم لتساعدك على
                          التدريب وصقل مهاراتك بشكل متميز وصحيح.
                        </p>

                        <div className="space-y-3 font-sans">
                          {selectedCompletedQuizData.questions.map(
                            (q, qidx) => (
                              <div
                                key={q.id || qidx}
                                className="bg-white p-4 rounded-xl border border-indigo-100 space-y-2"
                              >
                                <div className="flex justify-between items-start gap-4">
                                  <span className="text-xs font-black text-slate-800">
                                    س{qidx + 1}: {q.text}
                                  </span>
                                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md shrink-0">
                                    {q.points} نقاط
                                  </span>
                                </div>
                                <div className="text-xs space-y-1">
                                  {q.type === "multiple_choice" ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                      {(q.options || [])
                                        .map((opt, oidx) => ({ opt, oidx }))
                                        .filter(item => {
                                          if (!item.opt) return false;
                                          const t = item.opt.trim();
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
                                        .map(({ opt, oidx }) => {
                                          const isCorrect =
                                            String(oidx) ===
                                            String(q.correctAnswer);
                                          return (
                                            <div
                                              key={oidx}
                                              className={`p-2 rounded-lg border text-xs font-bold ${
                                                isCorrect
                                                  ? "bg-emerald-50 border-emerald-250 text-emerald-700"
                                                  : "bg-slate-50 border-slate-200 text-slate-500"
                                              }`}
                                            >
                                              {opt} {isCorrect && "✓"}
                                            </div>
                                          );
                                        })}
                                    </div>
                                  ) : (
                                    <div className="flex gap-2 pt-1">
                                      <div
                                        className={`p-2 rounded-lg border text-xs font-bold flex-1 text-center ${
                                          String(q.correctAnswer) === "true"
                                            ? "bg-emerald-50 border-emerald-250 text-emerald-700"
                                            : "bg-slate-50 border-slate-200 text-slate-450"
                                        }`}
                                      >
                                        صح{" "}
                                        {String(q.correctAnswer) === "true" &&
                                          "✓"}
                                      </div>
                                      <div
                                        className={`p-2 rounded-lg border text-xs font-bold flex-1 text-center ${
                                          String(q.correctAnswer) === "false"
                                            ? "bg-emerald-50 border-emerald-250 text-emerald-700"
                                            : "bg-slate-50 border-slate-200 text-slate-450"
                                        }`}
                                      >
                                        خطأ{" "}
                                        {String(q.correctAnswer) === "false" &&
                                          "✓"}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Grid layout for the quiz dashboard section */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Left Column (Active quizzes) - 3 columns out of 5 */}
                    <div className="lg:col-span-3 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-sm text-slate-800">
                          الاختبارات النشطة المتاحة لصفك الدراسي:
                        </h3>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md font-sans">
                          محدث لحظة بلحظة
                        </span>
                      </div>

                      {activeQuizzes.length === 0 ? (
                        <div className="bg-white border border-slate-200/50 rounded-2xl p-8 py-12 text-center text-slate-500">
                          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 mx-auto mb-4 border border-emerald-100">
                            <GraduationCap className="w-8 h-8" />
                          </div>
                          <h4 className="font-extrabold text-slate-800 mb-1 text-sm">
                            أداء استثنائي جداً!
                          </h4>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed font-sans">
                            لقد أنجزت كافة الاختبارات المتاحة حالياً لصفك ودرجتك
                            المعتمدة. لا توجد اختبارات معلقة متبقية، راجع درجاتك
                            في الجانب الأيسر.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" dir="rtl">
                          {activeQuizzes.map((quiz) => {
                            const qKey = quiz.id || quiz.title;
                            const isStarted = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_started`) === "true";
                            const isFinished = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_finished`) === "true";
                            
                            let currentQuizTimerValue = 0;
                            const savedEndVal = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_end_timestamp`);
                            if (savedEndVal) {
                              const end = parseInt(savedEndVal, 10);
                              currentQuizTimerValue = Math.max(0, Math.floor((end - Date.now()) / 1000));
                            } else {
                              const savedTimerVal = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_timer`);
                              currentQuizTimerValue = savedTimerVal ? parseInt(savedTimerVal, 10) : 0;
                            }

                            const isOngoing = isStarted && !isFinished && (quiz.durationMinutes === 9999 || currentQuizTimerValue > 0);
                            return (
                              <motion.div
                                whileHover={{ y: -5, scale: 1.01 }}
                                animate={isOngoing ? {
                                  borderColor: [
                                    "rgba(239, 68, 68, 0.85)", // Red boundary blink
                                    "rgba(245, 158, 11, 0.85)", // Amber blink
                                    "rgba(99, 102, 241, 0.85)", // Indigo blink
                                    "rgba(239, 68, 68, 0.85)",
                                  ],
                                  boxShadow: [
                                    "0 10px 25px -5px rgba(239, 68, 68, 0.25)",
                                    "0 10px 25px -5px rgba(245, 158, 11, 0.25)",
                                    "0 10px 25px -5px rgba(99, 102, 241, 0.25)",
                                    "0 10px 25px -5px rgba(239, 68, 68, 0.25)",
                                  ],
                                  scale: [1, 1.015, 1], // Breathing movement
                                                                } : {
                                  borderColor: [
                                    "rgba(226, 232, 240, 1)", // neutral slate border
                                    "rgba(99, 102, 241, 0.45)", // indigo blush
                                    "rgba(168, 85, 247, 0.45)", // purple blush
                                    "rgba(226, 232, 240, 1)",
                                  ],
                                  boxShadow: [
                                    "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                                    "0 10px 15px -3px rgba(99, 102, 241, 0.12), 0 4px 6px -4px rgba(99, 102, 241, 0.12)",
                                    "0 10px 15px -3px rgba(168, 85, 247, 0.12), 0 4px 6px -4px rgba(168, 85, 247, 0.12)",
                                    "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
                                  ],
                                }}
                                transition={isOngoing ? {
                                  duration: 3,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                } : {
                                  duration: 5,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                                key={quiz.id}
                                className={`rounded-3xl border p-5.5 space-y-4 flex flex-col justify-between relative overflow-hidden transition-all duration-300 ${
                                  isOngoing
                                    ? "bg-gradient-to-br from-rose-50/95 via-amber-50/60 to-indigo-50/70 border-2"
                                    : "bg-white"
                                }`}
                              >
                                {/* Background decorative animated smooth radial glow */}
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 rounded-full blur-2xl pointer-events-none" />

                                <div className="space-y-2 relative z-10">
                                  <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="flex h-2 w-2 relative">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOngoing ? "bg-rose-500" : "bg-indigo-400"}`}></span>
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isOngoing ? "bg-rose-600" : "bg-indigo-500"}`}></span>
                                      </span>
                                      <span className={`px-2 py-0.5 border text-xs font-extrabold rounded-md tracking-tight ${
                                        isOngoing
                                          ? "bg-rose-100 border-rose-200 text-rose-700 animate-pulse"
                                          : "bg-indigo-50 border-indigo-100/80 text-indigo-600"
                                      }`}>
                                        مقرر: {quiz.subject} {isOngoing && "(قيد التقديم حالياً)"}
                                      </span>
                                    </div>
                                    <span className={`flex items-center gap-1 text-[10px] font-extrabold font-sans ${isOngoing ? "text-rose-650" : "text-indigo-500"}`}>
                                      <Clock className="w-3.5 h-3.5 animate-pulse" />
                                      {quiz.durationMinutes} دقيقة
                                    </span>
                                  </div>

                                  <h4 className="font-extrabold text-sm text-slate-800 leading-snug line-clamp-2 transform group-hover:text-indigo-600 transition-colors">
                                    {quiz.title}
                                  </h4>
                                </div>

                                {/* Dynamic Embedded Notification & Alerts box inside the ongoing quiz card */}
                                {isOngoing && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="bg-rose-500/5 border border-dashed border-rose-300 rounded-2xl p-3 space-y-2 relative z-10"
                                    dir="rtl"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="flex h-2.5 w-2.5 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                                      </span>
                                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200/60 font-black text-[9px] rounded-full">
                                        الاختبار نشط وجاري الآن
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-600 font-bold leading-relaxed m-0">
                                      عداد وقت الجلسة مستمر ولن يتوقف عند خروجك أو انتقالك. الرجاء سرعة المتابعة لاستغلال الزمن المتبقي.
                                    </p>
                                    
                                    {/* Embedded Visual High-contrast Compact Countdown badge */}
                                    <div className="bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-1.5 flex items-center justify-between font-mono">
                                      <Clock className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
                                      <div className="flex flex-col text-right">
                                        <span className="text-[8px] text-slate-400 font-bold block">الوقت المتبقي:</span>
                                        <span className="text-xs font-black tracking-widest text-amber-300 leading-none">
                                          {studentQuiz && (studentQuiz.id === quiz.id || studentQuiz.title === quiz.title)
                                            ? `${Math.floor(quizTimer / 60)}:${(quizTimer % 60) < 10 ? "0" : ""}${quizTimer % 60}`
                                            : `${Math.floor(currentQuizTimerValue / 60)}:${(currentQuizTimerValue % 60) < 10 ? "0" : ""}${currentQuizTimerValue % 60}`}
                                        </span>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}

                                <div className="pt-2 border-t border-slate-100 md:flex md:items-center md:justify-between grid grid-cols-2 gap-3">
                                  <div className="text-[10px] text-slate-400 font-bold block leading-none">
                                    <span>أسئلة ومجموع درجات:</span>
                                    <strong className="text-slate-600 block mt-1 font-sans">
                                      {quiz.questions.length} س /{" "}
                                      {quiz.questions.reduce(
                                        (s, q) => s + Number(q.points || 0),
                                        0,
                                      )}{" "}
                                      درجات
                                    </strong>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      const qKey = quiz.id || quiz.title;
                                      const isSameQuiz = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_started`) === "true" && localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_finished`) !== "true";

                                      const enterQuizAction = () => {
                                        if (isSameQuiz) {
                                          const savedQuizStr = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}`);
                                          if (savedQuizStr) {
                                            try {
                                              setStudentQuiz(JSON.parse(savedQuizStr));
                                            } catch (e) {
                                              setStudentQuiz(quiz);
                                            }
                                          } else {
                                            setStudentQuiz(quiz);
                                          }
                                        } else {
                                          let finalQuizToSet = { ...quiz };
                                          if (quiz.shuffleQuestions) {
                                            let shuffled = [...quiz.questions];
                                            for (let i = shuffled.length - 1; i > 0; i--) {
                                              const j = Math.floor(Math.random() * (i + 1));
                                              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                                            }
                                            // Shuffle multiple_choice options/choices for each question
                                            shuffled = shuffled.map(q => {
                                              if (q.type === "multiple_choice" && Array.isArray(q.options) && q.options.length > 0) {
                                                const originalCorrectIdx = parseInt(q.correctAnswer, 10);
                                                const mapped = q.options.map((opt, idx) => ({
                                                  text: opt,
                                                  isCorrect: idx === originalCorrectIdx,
                                                }));
                                                const isPlaceholder = (text: string) => {
                                                  if (!text) return true;
                                                  const t = text.trim();
                                                  return t === '' ||
                                                    t === 'الخيار الثالث' ||
                                                    t === 'الخيار الرابع' ||
                                                    t === 'الخيار الثالث...' ||
                                                    t === 'الخيار الرابع...' ||
                                                    t === 'option 3' ||
                                                    t === 'option 4' ||
                                                    t === 'option3' ||
                                                    t === 'option4';
                                                };
                                                const validOptions = mapped.filter(item => !isPlaceholder(item.text));
                                                const placeholderOptions = mapped.filter(item => isPlaceholder(item.text));
                                                const shuffledValid = [...validOptions];
                                                for (let i = shuffledValid.length - 1; i > 0; i--) {
                                                  const j = Math.floor(Math.random() * (i + 1));
                                                  [shuffledValid[i], shuffledValid[j]] = [shuffledValid[j], shuffledValid[i]];
                                                }
                                                const newOptionsCombined = [...shuffledValid, ...placeholderOptions];
                                                const newCorrectIdx = newOptionsCombined.findIndex(item => item.isCorrect);
                                                return {
                                                  ...q,
                                                  options: newOptionsCombined.map(item => item.text),
                                                  correctAnswer: newCorrectIdx !== -1 ? String(newCorrectIdx) : q.correctAnswer,
                                                };
                                              }
                                              return q;
                                            });
                                            finalQuizToSet.questions = shuffled;
                                          }
                                          const safeQuestions = finalQuizToSet.questions.map(q => {
                                            const { correctAnswer, ...safeQ } = q;
                                            return safeQ as Question;
                                          });
                                          finalQuizToSet.questions = safeQuestions;
                                          setStudentQuiz(finalQuizToSet);
                                        }
                                        
                                        if (isSameQuiz) {
                                          // Resume
                                          const savedEnd = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_end_timestamp`);
                                          if (savedEnd) {
                                            const end = parseInt(savedEnd, 10);
                                            const remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
                                            setQuizTimer(quiz.durationMinutes === 9999 ? 999999 : remaining);
                                          } else {
                                            setQuizTimer(quiz.durationMinutes === 9999 ? 999999 : quiz.durationMinutes * 60);
                                          }
                                          // Keep answers
                                          const savedAnswersStr = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_answers`);
                                          try {
                                            if (savedAnswersStr) {
                                              setQuizAnswers(JSON.parse(savedAnswersStr));
                                            } else {
                                              setQuizAnswers({});
                                            }
                                          } catch (e) {
                                            setQuizAnswers({});
                                          }
                                          // Keep question index
                                          const savedIdx = localStorage.getItem(`seb_student_${studentSelectedId}_quiz_${qKey}_question_idx`);
                                          setCurrentStudentQuestionIdx(savedIdx ? parseInt(savedIdx, 10) : 0);
                                        } else {
                                          // Brand new test start!
                                          const examDurationSeconds = quiz.durationMinutes === 9999 ? 999999 : quiz.durationMinutes * 60;
                                          const end = Date.now() + (examDurationSeconds * 1000);
                                          
                                          localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}_started`, "true");
                                          localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}_finished`, "false");
                                          if (quiz.durationMinutes !== 9999) {
                                            localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}_end_timestamp`, end.toString());
                                          }
                                          localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}_timer`, examDurationSeconds.toString());
                                          localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}_answers`, JSON.stringify({}));
                                          localStorage.setItem(`seb_student_${studentSelectedId}_quiz_${qKey}_question_idx`, "0");
                                          
                                          setQuizTimer(examDurationSeconds);
                                          setQuizAnswers({});
                                          setCurrentStudentQuestionIdx(0);
                                        }
                                        
                                        setStudentQuizStarted(true);
                                        setStudentQuizFinished(false);
                                        triggerToast(
                                          "تم توجيه جهازك لقاعة تقديم الاختبار الفعلي بنجاح، ركز وبالتوفيق!",
                                          "success",
                                        );
                                      };

                                      if (!isSameQuiz) {
                                        triggerConfirm(
                                          "تأكيد دخول وبدء الاختبار ⏱️",
                                          `تنبيه هام جداً: عند المتابعة، سوف يبدأ مؤقت احتساب وقت الاختبار فوراً (${quiz.durationMinutes} دقيقة) وسينطلق العد التنازلي دون أي إمكانية لإيقافه مؤقتاً أو التراجع عنه بمجرد البدء. هل أنت جاهز للبدء فوراً؟`,
                                          enterQuizAction,
                                          undefined,
                                          "نعم، ابدأ الاختبار الآن",
                                          "تراجع، ليس الآن"
                                        );
                                      } else {
                                        enterQuizAction();
                                      }
                                    }}
                                    className={`px-4 py-2.5 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all duration-300 cursor-pointer ${
                                      isOngoing
                                        ? "bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 shadow-rose-200 animate-pulse scale-102 font-black"
                                        : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                                    }`}
                                  >
                                    <span>{isOngoing ? "متابعة الاختبار الجاري" : "دخول الاختبار"}</span>
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right Column (Academic report history) - thinner */}
                    <div className="lg:col-span-2 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-sm text-slate-800">
                          تقرير كشف التحصيل الاكاديمي:
                        </h3>
                        <span className="text-[10px] font-bold text-slate-500 font-sans">
                          سجل الاختبارات المنجزة
                        </span>
                      </div>

                      {completedQuizzes.length === 0 ? (
                        <div className="bg-white border border-slate-200/50 rounded-2xl p-6 py-10 text-center text-slate-400 font-sans text-xs">
                          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          لا يوجد اختبارات مسجلة في كشفك حتى الآن. بمجرد تقديم
                          اختباراتك تظهر إحصائياتك هنا تلقائياً لطباعة شهادتك
                          المعتمدة.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {completedQuizzes.map((gradeRecord, index) => {
                            const matchedQuiz = quizzes.find(
                              (q) => q.title === gradeRecord.quizTitle,
                            );

                            return (
                              <div
                                key={index}
                                className="bg-white p-4 rounded-xl border border-slate-200/50 shadow-sm space-y-2.5 flex flex-col justify-between"
                              >
                                <div className="flex justify-between items-start gap-3">
                                  <div className="space-y-0.5">
                                    <h5 className="font-black text-xs text-slate-800 leading-snug">
                                      {gradeRecord.quizTitle}
                                    </h5>
                                    <span className="text-[10px] text-slate-400 font-medium font-sans">
                                      تاريخ التقديم: {gradeRecord.date}
                                    </span>
                                  </div>

                                  <span
                                    className={`text-xs font-black px-2 py-0.5 rounded-md font-sans ${
                                      gradeRecord.score /
                                        (gradeRecord.maxScore || 1) >=
                                      0.6
                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                        : "bg-rose-50 text-rose-500 border border-rose-100"
                                    }`}
                                  >
                                    {gradeRecord.score} / {gradeRecord.maxScore}{" "}
                                    درجة
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {studentActiveNav === "reviews" && (
                <StudentReviewsTab
                  activeStudent={activeStudent}
                  reviewChallenges={reviewChallenges}
                  reviewScores={reviewScores}
                  students={students}
                  triggerToast={triggerToast}
                  onGameStateChange={setStudentReviewGameState}
                  teacherId={studentPortalTeacherId || activeStudent?.teacherId || ""}
                />
              )}

              {studentActiveNav === "curriculum_review" && (
                <StudentCurriculumReview
                  activeStudent={activeStudent || null}
                  bankQuestions={bankQuestions}
                  triggerToast={triggerToast}
                  selectedSubject={selectedCurriculumSubject}
                  onSelectedSubjectChange={setSelectedCurriculumSubject}
                  onGoBackToQuizzes={() => {
                    setStudentActiveNav("quizzes");
                    setSelectedCurriculumSubject(null);
                  }}
                  teacherId={studentPortalTeacherId || currentUser?.uid || "demo_teacher"}
                />
              )}
            </main>
          </div>

          {/* Custom Confirmation Modal for Student Dashboard */}
          <AnimatePresence>
            {confirmDialog && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
                  dir="rtl"
                >
                  <div className="p-6">
                    <div className="flex items-center gap-3 text-slate-900 mb-3">
                      <AlertTriangle className="w-6 h-6 shrink-0 text-amber-500 animate-pulse" />
                      <h3 className="text-base font-black text-slate-900">
                        {confirmDialog.title}
                      </h3>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                      {confirmDialog.message}
                    </p>
                  </div>
                  <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-3 justify-start">
                    <button
                      type="button"
                      disabled={isConfirmLoading}
                      onClick={confirmDialog.onConfirm}
                      className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                        isConfirmLoading
                          ? "bg-slate-400 text-white border-slate-400 cursor-not-allowed shadow-none"
                          : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100"
                      }`}
                    >
                      {isConfirmLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
                          <span>جاري التنفيذ...</span>
                        </>
                      ) : (
                        confirmDialog.confirmText || "تأكيد"
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isConfirmLoading}
                      onClick={confirmDialog.onCancel}
                      className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all border border-transparent ${
                        isConfirmLoading
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "hover:bg-slate-200 bg-slate-100 text-slate-700 cursor-pointer"
                      }`}
                    >
                      {confirmDialog.cancelText || "إلغاء الإجراء"}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>


        </div>
      );
    }

    // B. Student Active Test Ongoing Screen
    if (!studentQuizFinished) {
      const answeredCount = Object.keys(quizAnswers).length;
      const totalCount = studentQuiz.questions.length;
      const progressPercent = Math.round((answeredCount / totalCount) * 100);
      const isTimeShort = quizTimer < 120; // less than 2 minutes

      const activeStudent = students.find((s) => s.id === studentSelectedId);
      const studentName = activeStudent?.name || "طالب اختبار";
      const studentClass = activeStudent?.gradeClass || studentSelectedGrade;

      const totalDurationSeconds = (studentQuiz.durationMinutes || 15) * 60;
      const timeRemainingPercent = Math.max(
        0,
        Math.min(100, (quizTimer / totalDurationSeconds) * 100),
      );

      // Formatted Time MM:SS
      const mins = Math.floor(quizTimer / 60);
      const secs = quizTimer % 60;
      const displayTime = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

      return (
        <div
          className="min-h-screen bg-slate-50 flex flex-col text-slate-800 pb-20 justify-start"
          dir="rtl"
        >
          {/* Ongoing Header Sticky Top */}
          <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm px-6 py-4">
            <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100 mb-3">
              {/* Right: Student details & Quiz title */}
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-center shrink-0">
                  <GraduationCap className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-black text-slate-800">
                      {studentName}
                    </span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold select-none">
                      {studentClass}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-bold mt-1 flex items-center gap-2 flex-wrap">
                    <span>
                      الاختبار:{" "}
                      <strong className="text-slate-700 font-extrabold">
                        {studentQuiz.title}
                      </strong>
                    </span>
                    <span className="text-slate-200">|</span>
                    <span>
                      المادة:{" "}
                      <strong className="text-indigo-600 font-extrabold">
                        {studentQuiz.subject}
                      </strong>
                    </span>
                    <span className="text-slate-200">|</span>
                    <span className="font-sans">عدد الأسئلة: {totalCount}</span>
                  </div>
                </div>
              </div>

              {/* Left: Timer Indicator and Back Button */}
              <div className="flex flex-wrap items-center justify-start md:justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setStudentQuizStarted(false);
                    triggerToast("تم الحفظ التلقائي لإجاباتك؛ بإمكانك الرجوع لإكمال الاختبار بأي وقت قبل انتهاء الزمن", "info");
                  }}
                  className="px-3.5 py-2 bg-slate-150 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl border border-slate-200/50 flex items-center gap-2 transition cursor-pointer"
                >
                  <Home className="w-4 h-4 text-indigo-600" />
                  <span>العودة للرئيسية</span>
                </button>

                <div
                  className={`flex items-center gap-2 px-3.5 py-2 bg-slate-50 rounded-xl border font-mono font-bold transition-all duration-300 ${
                    studentQuiz.durationMinutes === 9999
                      ? "border-indigo-100 text-indigo-700 bg-indigo-50/50"
                      : isTimeShort
                        ? "border-rose-300 text-rose-600 bg-rose-50/75 animate-pulse"
                        : "border-emerald-100 text-emerald-700 bg-emerald-50/50"
                  }`}
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-black tracking-wider leading-none">
                    {studentQuiz.durationMinutes === 9999 ? "مفتوح بدون وقت ♾️" : displayTime}
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Time Progress Bar (شريط وقتي) */}
            {studentQuiz.durationMinutes !== 9999 && (
              <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-1 text-[11px] text-slate-400 font-bold select-none">
                  <span className="flex items-center gap-1.5 font-bold">
                    <span
                      className={`w-2 h-2 rounded-full block ${isTimeShort ? "bg-rose-500 animate-ping" : "bg-emerald-500"}`}
                    />
                    زمن الإجابة المنقضي مقارنة بالوقت الإجمالي للاختبار
                  </span>
                  <span className="font-sans font-black text-indigo-600">
                    {Math.round(timeRemainingPercent)}% متبقي من الوقت
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/20">
                  <div
                    className={`h-full transition-all duration-1000 rounded-full ${
                      isTimeShort
                        ? "bg-gradient-to-l from-rose-500 to-amber-500"
                        : "bg-indigo-600"
                    }`}
                    style={{ width: `${timeRemainingPercent}%` }}
                  />
                </div>
              </div>
            )}
          </header>

          {/* Questions Container */}
          <main className="max-w-4xl mx-auto w-full p-4 md:p-6 space-y-6 flex-1">
            {/* Horizontal Question Index Strip */}
            <div className="bg-gradient-to-br from-indigo-50/90 via-slate-50 to-indigo-50/40 rounded-2xl border-2 border-indigo-200 shadow-md p-5 space-y-4">
              <div className="flex justify-between items-center text-xs text-indigo-950 font-bold select-none">
                <span className="flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-indigo-600" />
                  قائمة الأسئلة (اضغط على رقم السؤال للتنقل السريع):
                </span>
                <span className="font-sans font-black text-indigo-800 bg-indigo-100/80 px-2.5 py-1 rounded-full border border-indigo-200">
                  السؤال {currentStudentQuestionIdx + 1} من {totalCount}
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5 pt-1">
                {studentQuiz.questions.map((q, idx) => {
                  const isCurrent = idx === currentStudentQuestionIdx;
                  const isAnswered = quizAnswers[q.id] !== undefined;

                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setCurrentStudentQuestionIdx(idx)}
                      className={`w-11 h-11 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center relative transition-all duration-150 cursor-pointer ${
                        isCurrent
                          ? isAnswered
                            ? "bg-blue-600 text-white border-2 border-blue-800 ring-4 ring-blue-200 scale-110 z-10 shadow-md font-black"
                            : "bg-white text-blue-700 border-2 border-blue-600 ring-4 ring-blue-200 scale-110 z-10 shadow-md font-black"
                          : isAnswered
                            ? "bg-blue-600 hover:bg-blue-700 text-white border-2 border-blue-700 shadow-xs font-black"
                            : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs font-bold"
                      }`}
                    >
                      <span className="text-sm font-black">{idx + 1}</span>
                      {isAnswered && !isCurrent && (
                        <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Single Question Display */}
            {(() => {
              const question = studentQuiz.questions[currentStudentQuestionIdx];
              if (!question) return null;
              const selectedAnswer = quizAnswers[question.id];

              return (
                <div className="space-y-4">
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 space-y-4"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex gap-2.5 items-start">
                        <span className="w-7 h-7 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 font-sans mt-0.5">
                          {currentStudentQuestionIdx + 1}
                        </span>
                        <h4 className="font-extrabold text-slate-800 text-sm leading-relaxed">
                          {question.text}
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-md font-sans shrink-0">
                        {question.points} نقاط
                      </span>
                    </div>

                    {/* Rendering options based on type */}
                    {question.type === "multiple_choice" ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {(question.options || [])
                          .map((option, oIdx) => ({ option, oIdx }))
                          .filter(item => {
                            if (!item.option) return false;
                            const t = item.option.trim();
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
                          .map(({ option, oIdx }) => {
                            const optVal = String(oIdx);
                            const isChosen = selectedAnswer === optVal;

                            return (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => {
                                  setQuizAnswers((prev) => ({
                                    ...prev,
                                    [question.id]: optVal,
                                  }));
                                }}
                                className={`p-3.5 rounded-xl border text-right text-xs transition-all duration-155 flex items-center justify-between font-bold cursor-pointer group hover:bg-slate-50/50 ${
                                  isChosen
                                    ? "bg-indigo-50 border-indigo-300 text-indigo-900 ring-1 ring-indigo-300"
                                    : "bg-white border-slate-200 text-slate-600"
                                }`}
                              >
                                <span className="flex-1 leading-relaxed">
                                  {option}
                                </span>
                                <div
                                  className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-all ${
                                    isChosen
                                      ? "border-indigo-600 bg-indigo-600"
                                      : "border-slate-300 bg-white group-hover:border-slate-400"
                                  }`}
                                >
                                  {isChosen && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-4 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setQuizAnswers((prev) => ({
                              ...prev,
                              [question.id]: "true",
                            }));
                          }}
                          className={`flex-1 p-3.5 rounded-xl border text-center text-xs transition-all duration-150 font-bold cursor-pointer hover:bg-emerald-50/30 ${
                            selectedAnswer === "true"
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800 ring-1 ring-emerald-300"
                              : "bg-white border-slate-200 text-slate-600"
                          }`}
                        >
                          صحيح (True)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setQuizAnswers((prev) => ({
                              ...prev,
                              [question.id]: "false",
                            }));
                          }}
                          className={`flex-1 p-3.5 rounded-xl border text-center text-xs transition-all duration-150 font-bold cursor-pointer hover:bg-rose-50/30 ${
                            selectedAnswer === "false"
                              ? "bg-rose-50 border-rose-300 text-rose-800 ring-1 ring-rose-300"
                              : "bg-white border-slate-200 text-slate-600"
                          }`}
                        >
                          خطأ (False)
                        </button>
                      </div>
                    )}

                    {/* Clear selection button in yellow for reviewing later */}
                    {selectedAnswer !== undefined && (
                      <div className="pt-3 border-t border-slate-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setQuizAnswers((prev) => {
                              const updated = { ...prev };
                              delete updated[question.id];
                              return updated;
                            });
                          }}
                          className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-500 active:scale-95 text-amber-950 font-black text-xs rounded-xl border border-amber-500 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <Eraser className="w-3.5 h-3.5 text-amber-950" />
                          <span>إلغاء الاختيار للمراجعة لاحقا</span>
                        </button>
                      </div>
                    )}
                  </motion.div>

                  {/* Navigation Footer Under Card */}
                  <div className="flex items-center justify-between gap-4 pt-2">
                    <button
                      type="button"
                      disabled={currentStudentQuestionIdx === 0}
                      onClick={() =>
                        setCurrentStudentQuestionIdx((prev) => prev - 1)
                      }
                      className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                    >
                      <ChevronRight className="w-4 h-4 shrink-0" />
                      <span>السؤال السابق</span>
                    </button>

                    <button
                      type="button"
                      disabled={currentStudentQuestionIdx === totalCount - 1}
                      onClick={() =>
                        setCurrentStudentQuestionIdx((prev) => prev + 1)
                      }
                      className="flex items-center gap-2 px-5 py-3 rounded-xl border border-indigo-150 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-xs font-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                    >
                      <span>السؤال التالي</span>
                      <ChevronLeft className="w-4 h-4 shrink-0" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Bottom Submit Actions */}
            <div className="pt-6">
              <button
                type="button"
                id="student-quiz-submit-btn"
                disabled={quizSubmitting}
                onClick={() => {
                  const unAnswered = totalCount - answeredCount;
                  if (unAnswered > 0) {
                    triggerConfirm(
                      "تنبيه: أسئلة غير مجابة",
                      `لا يمكن تسليم الاختبار لوجود عدد ${unAnswered} أسئلة غير مجابة! يرجى العودة وإجابة كافة الأسئلة أولاً قبل التسليم لتتمكن من تصحيح وتسليم الاختبار.`,
                      () => {},
                      undefined,
                      "حسناً، سأكمل الحل",
                      "إغلاق التنبيه",
                    );
                    triggerToast(
                      `لا يمكن تسليم الاختبار! يرجى حل الـ ${unAnswered} أسئلة المتبقية أولاً.`,
                      "error",
                    );
                    return;
                  }

                  // If all questions are answered, proceed to confirmation
                  triggerConfirm(
                    "تسليم ورقة الإجابة",
                    "هل أنت متأكد من تسليم ورقة الإجابة وتصحيحها ورصد درجتك نهائياً؟",
                    () => {
                      handleStudentSubmitQuiz(false);
                    },
                    undefined,
                    "نعم، تسليم وتصحيح ورقة الإجابة فوراً",
                    "الرجوع للمراجعة والتصحيح",
                  );
                }}
                className={`w-full flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-black text-base text-white shadow-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] cursor-pointer bg-gradient-to-l from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-750 shadow-emerald-100 dark:shadow-none ${
                  quizSubmitting
                    ? "opacity-70 cursor-not-allowed animate-pulse"
                    : ""
                }`}
              >
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="font-sans font-black tracking-wide text-base leading-none">
                  {quizSubmitting
                    ? "جاري تصحيح وتسليم الاختبار..."
                    : "تصحيح وتسليم الاختبار"}
                </span>
              </button>
            </div>
          </main>

          {/* Custom Confirmation Modal inside Student view */}
          <AnimatePresence>
            {confirmDialog && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
                  dir="rtl"
                >
                  <div className="p-6">
                    <div className="flex items-center gap-3 text-indigo-600 mb-3">
                      <AlertTriangle className="w-6 h-6 shrink-0" />
                      <h3 className="text-base font-black text-slate-900">
                        {confirmDialog.title}
                      </h3>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                      {confirmDialog.message}
                    </p>
                  </div>
                  <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-3 justify-start">
                    <button
                      type="button"
                      disabled={isConfirmLoading}
                      onClick={confirmDialog.onConfirm}
                      className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                        isConfirmLoading
                          ? "bg-slate-400 text-white border-slate-400 cursor-not-allowed shadow-none"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
                      }`}
                    >
                      {isConfirmLoading ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
                          <span>جاري التسليم...</span>
                        </>
                      ) : (
                        confirmDialog.confirmText || "تأكيد"
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isConfirmLoading}
                      onClick={confirmDialog.onCancel}
                      className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all border border-transparent ${
                        isConfirmLoading
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "hover:bg-slate-200 bg-slate-100 text-slate-700 cursor-pointer"
                      }`}
                    >
                      {confirmDialog.cancelText || "إلغاء الإجراء"}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      );
    }

    // C. Student Completed/Result Feedback Page
    const activeStudent = students.find((s) => s.id === studentSelectedId);
    const studentName = activeStudent?.name || "طالب اختبار";
    const studentClass = activeStudent?.gradeClass || studentSelectedGrade;
    const totalCount = studentQuiz.questions.length;

    return (
      <div
        className="min-h-screen bg-slate-50 flex flex-col text-slate-800 pb-20 justify-start"
        dir="rtl"
      >
        {/* Top Header Sticky Bar with Student & Test Data */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm px-6 py-4">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Right: Student details & Quiz title */}
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-center shrink-0">
                <GraduationCap className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-black text-slate-800">
                    {studentName}
                  </span>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold select-none">
                    {studentClass}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-bold mt-1 flex items-center gap-2 flex-wrap">
                  <span>
                    الاختبار:{" "}
                    <strong className="text-slate-700 font-extrabold">
                      {studentQuiz.title}
                    </strong>
                  </span>
                  <span className="text-slate-200">|</span>
                  <span>
                    المادة:{" "}
                    <strong className="text-indigo-600 font-extrabold">
                      {studentQuiz.subject}
                    </strong>
                  </span>
                  <span className="text-slate-200">|</span>
                  <span className="font-sans">عدد الأسئلة: {totalCount}</span>
                </div>
              </div>
            </div>

            {/* Left: Score Badge and Return to Home Button */}
            <div className="flex flex-wrap items-center justify-start md:justify-end gap-3 shrink-0">
              <div className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 rounded-xl border border-indigo-100 font-bold text-xs">
                <span className="text-slate-500 font-medium">النتيجة:</span>
                <span className="font-sans font-black text-indigo-700">
                  {quizScore} من {quizTotalPoints} ({quizPercentage}%)
                </span>
              </div>

              <button
                type="button"
                onClick={resetActiveQuizState}
                className="px-3.5 py-2 bg-slate-150 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl border border-slate-200/50 flex items-center gap-2 transition cursor-pointer"
              >
                <Home className="w-4 h-4 text-indigo-600" />
                <span>العودة للرئيسية</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Result Content */}
        <main className="max-w-4xl mx-auto w-full p-4 md:p-6 space-y-6 flex-1">
          {/* Question Index Strip (Square rounded badges like test view) */}
          <div className="bg-gradient-to-br from-indigo-50/90 via-slate-50 to-indigo-50/40 rounded-2xl border-2 border-indigo-200 shadow-md p-5 space-y-4">
            <div className="flex justify-between items-center text-xs text-indigo-950 font-bold select-none">
              <span className="flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-indigo-600" />
                قائمة الأسئلة (اضغط على رقم السؤال للتنقل السريع):
              </span>
              <span className="font-sans font-black text-indigo-800 bg-indigo-100/80 px-2.5 py-1 rounded-full border border-indigo-200">
                السؤال {reviewResultQuestionIdx + 1} من {totalCount}
              </span>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-1">
              {studentQuiz.questions.map((q, idx) => {
                const isCurrent = idx === reviewResultQuestionIdx;
                const studentAns = quizAnswers[q.id];
                const isAnswered = studentAns !== undefined;
                const isCorrect = isAnswered && studentAns === q.correctAnswer;

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setReviewResultQuestionIdx(idx)}
                    className={`w-11 h-11 rounded-xl font-mono text-xs font-black flex flex-col items-center justify-center relative transition-all duration-150 cursor-pointer ${
                      isCurrent
                        ? isCorrect
                          ? "bg-emerald-500 text-white ring-4 ring-emerald-300 scale-110 z-10 border-2 border-emerald-700 shadow-md font-black"
                          : !isAnswered
                            ? "bg-amber-400 text-slate-900 ring-4 ring-amber-300 scale-110 z-10 border-2 border-amber-600 shadow-md font-black"
                            : "bg-red-500 text-white ring-4 ring-red-300 scale-110 z-10 border-2 border-red-700 shadow-md font-black"
                        : isCorrect
                          ? "bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-emerald-600 shadow-xs font-black"
                          : !isAnswered
                            ? "bg-amber-400 hover:bg-amber-500 text-slate-900 border-2 border-amber-500 shadow-xs font-black"
                            : "bg-red-500 hover:bg-red-600 text-white border-2 border-red-600 shadow-xs font-black"
                    }`}
                  >
                    <span className="text-sm font-black">{idx + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Display Card (Styled exactly like test questions) */}
          {(() => {
            const currentQ =
              studentQuiz.questions[reviewResultQuestionIdx] ||
              studentQuiz.questions[0];
            if (!currentQ) return null;
            const studentAns = quizAnswers[currentQ.id];
            const isAnswered = studentAns !== undefined;
            const isCorrect = isAnswered && studentAns === currentQ.correctAnswer;

            return (
              <div className="space-y-4">
                <motion.div
                  key={currentQ.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`bg-white rounded-2xl border-2 p-6 space-y-4 shadow-sm transition-all ${
                    isCorrect
                      ? "border-emerald-500 bg-emerald-50/10"
                      : !isAnswered
                        ? "border-amber-400 bg-amber-50/10"
                        : "border-red-500 bg-red-50/10"
                  }`}
                >
                  {/* Question Title Header */}
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex gap-2.5 items-start">
                      <span className="w-7 h-7 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 font-sans mt-0.5">
                        {reviewResultQuestionIdx + 1}
                      </span>
                      <h4 className="font-extrabold text-slate-800 text-sm md:text-base leading-relaxed flex items-center gap-2">
                        <span>{currentQ.text}</span>
                        <span className="text-base shrink-0">
                          {isCorrect ? "✔️" : !isAnswered ? "⚠️" : "❌"}
                        </span>
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-md font-sans shrink-0">
                      {currentQ.points} نقاط
                    </span>
                  </div>

                  {/* Options Display */}
                  {currentQ.type === "multiple_choice" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      {(currentQ.options || [])
                        .map((option, oIdx) => ({ option, oIdx }))
                        .filter((item) => {
                          if (!item.option) return false;
                          const t = item.option.trim();
                          return (
                            t !== "" &&
                            t !== "الخيار الثالث" &&
                            t !== "الخيار الرابع" &&
                            t !== "الخيار الثالث..." &&
                            t !== "الخيار الرابع..." &&
                            t !== "option 3" &&
                            t !== "option 4" &&
                            t !== "option3" &&
                            t !== "option4"
                          );
                        })
                        .map(({ option, oIdx }) => {
                          const optVal = String(oIdx);
                          const isSelectedByStudent = studentAns === optVal;

                          return (
                            <div
                              key={oIdx}
                              className={`p-3.5 rounded-xl border text-right text-xs transition-all duration-155 flex items-center justify-between font-bold ${
                                isSelectedByStudent
                                  ? "bg-indigo-50 border-indigo-300 text-indigo-900 ring-1 ring-indigo-300 font-extrabold"
                                  : "bg-white border-slate-200 text-slate-600"
                              }`}
                            >
                              <span className="flex-1 leading-relaxed">
                                {option}
                              </span>
                              <div
                                className={`w-4 h-4 rounded-full border shrink-0 flex items-center justify-center transition-all ${
                                  isSelectedByStudent
                                    ? "border-indigo-600 bg-indigo-600"
                                    : "border-slate-300 bg-white"
                                }`}
                              >
                                {isSelectedByStudent && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                      <div
                        className={`flex-1 p-3.5 rounded-xl border text-center text-xs font-bold transition-all flex items-center justify-center ${
                          studentAns === "true"
                            ? "bg-indigo-50 border-indigo-300 text-indigo-900 ring-1 ring-indigo-300 font-extrabold"
                            : "bg-white border-slate-200 text-slate-600"
                        }`}
                      >
                        صحيح (True)
                      </div>
                      <div
                        className={`flex-1 p-3.5 rounded-xl border text-center text-xs font-bold transition-all flex items-center justify-center ${
                          studentAns === "false"
                            ? "bg-indigo-50 border-indigo-300 text-indigo-900 ring-1 ring-indigo-300 font-extrabold"
                            : "bg-white border-slate-200 text-slate-600"
                        }`}
                      >
                        خطأ (False)
                      </div>
                    </div>
                  )}

                  {/* Message for Skipped Questions */}
                  {!isAnswered && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold flex items-center gap-2 justify-center">
                      <span>⚠️ تم تركه فارغاً</span>
                    </div>
                  )}
                </motion.div>

                {/* Navigation Buttons Below Question */}
                <div className="flex items-center justify-between gap-4 pt-2">
                  <button
                    type="button"
                    disabled={reviewResultQuestionIdx === 0}
                    onClick={() =>
                      setReviewResultQuestionIdx((prev) => Math.max(0, prev - 1))
                    }
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                  >
                    <ChevronRight className="w-4 h-4 shrink-0" />
                    <span>السؤال السابق</span>
                  </button>

                  <button
                    type="button"
                    disabled={
                      reviewResultQuestionIdx === studentQuiz.questions.length - 1
                    }
                    onClick={() =>
                      setReviewResultQuestionIdx((prev) =>
                        Math.min(studentQuiz.questions.length - 1, prev + 1)
                      )
                    }
                    className="flex items-center gap-2 px-5 py-3 rounded-xl border border-indigo-150 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 text-xs font-black transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none"
                  >
                    <span>السؤال التالي</span>
                    <ChevronLeft className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Bottom Return to Home Button */}
          <div className="pt-4">
            <button
              type="button"
              onClick={resetActiveQuizState}
              className="w-full bg-blue-700 hover:bg-blue-800 active:scale-[0.99] text-white font-black text-sm py-3.5 px-6 rounded-xl shadow-md transition-all cursor-pointer text-center flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              <span>العودة للرئيسية</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (currentUser === undefined) {
    return (
      <div
        className="min-h-screen bg-slate-50/70 flex flex-col items-center justify-center p-6 text-slate-800 font-sans"
        dir="rtl"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1e3a8a]"></div>
          <p className="text-sm font-bold text-slate-500">
            جاري تحميل لوحة التحكم وأمن Firebase...
          </p>
        </div>
      </div>
    );
  }

  if (currentUser === null) {
    const handleGoogleLogin = async () => {
      try {
        await executeSafeGoogleLogin();
      } catch (error) {
        // Safe login handles toast notifications internally
      }
    };

    return (
      <div
        className="min-h-screen bg-slate-50/70 flex flex-col items-center justify-center p-6 text-slate-800"
        dir="rtl"
      >
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 md:p-12 rounded-3xl shadow-xl max-w-lg w-full border border-slate-105/85 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-[#1e3a8a] flex items-center justify-center text-white mx-auto shadow-lg shadow-blue-105 mb-6">
            <GraduationCap className="w-10 h-10" />
          </div>

          <h1 className="text-3xl font-extrabold text-slate-900 mb-2 leading-tight">
            بوابة الأستاذ الذكية
          </h1>
          <p className="text-slate-550 text-sm mb-8 font-medium">
            قم بتسجيل الدخول السريع لمزامنة وإدارة اختباراتك، شؤون طلابك،
            وتحليلات العملية التعليمية بأمان عبر السحاب
          </p>

          {/* Login Action Buttons */}
          <div className="space-y-3">
            <button
              id="google-login-btn"
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-2xl font-bold shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 active:scale-[0.98] cursor-pointer text-sm"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
              </svg>
              <span>تسجيل الدخول باستخدام حساب جوجل</span>
            </button>
          </div>

          {authErrorDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-6 p-5 rounded-2xl bg-rose-50 border border-rose-200 text-right text-xs text-rose-900 font-sans space-y-2.5 overflow-hidden"
            >
              <div className="font-bold flex items-center gap-1.5 text-rose-800 text-sm">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span>تنبيه أمني ومطابقة النطاقات (Firebase Auth)</span>
              </div>
              <p className="leading-relaxed">
                رمز الخطأ الحاصل من المتصفح:{" "}
                <code className="bg-white/80 px-1 py-0.5 rounded font-mono text-rose-700 font-bold">
                  {authErrorDetails.code}
                </code>
              </p>

              {authErrorDetails.code === "auth/unauthorized-domain" ? (
                <div className="space-y-3 mt-2 pt-2 border-t border-rose-200/50">
                  <p className="font-bold text-rose-800 text-[13px]">
                    ⚠️ النطاق الحالي غير معتمد في إعدادات مشروع الـ Firebase!
                  </p>
                  <p className="leading-relaxed text-slate-700">
                    أنت تقوم بتشغيل التطبيق عبر النطاق:{" "}
                    <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-slate-800">
                      {authErrorDetails.domain}
                    </code>{" "}
                    ولكن هذا النطاق ليس مدرجاً في قائمة النطاقات المعتمدة لمثيله
                    الخاص بمصادقة جوجل.
                  </p>
                  <div className="bg-white p-3 rounded-xl border border-rose-100 text-[11px] text-slate-700 space-y-1.5 shadow-xs">
                    <p className="font-bold text-slate-800 mb-1">
                      خطوات التفعيل والحل السريع:
                    </p>
                    <p>
                      1. اذهب إلى{" "}
                      <a
                        href="https://console.firebase.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline font-bold"
                      >
                        وحدة تحكم Firebase Console
                      </a>{" "}
                      واختر مشروعك.
                    </p>
                    <p>
                      2. في القائمة الجانبية، اذهب إلى{" "}
                      <span className="font-bold text-black">
                        Build &gt; Authentication
                      </span>
                      .
                    </p>
                    <p>
                      3. اختر تبويب{" "}
                      <span className="font-bold text-black">Settings</span> في
                      الأعلى، ثم انقر على{" "}
                      <span className="font-bold text-black">
                        Authorized domains
                      </span>{" "}
                      (النطاقات المعتمدة).
                    </p>
                    <p>
                      4. انقر فوق زر{" "}
                      <span className="font-bold text-black">Add domain</span>{" "}
                      وقم بنسخ ولصق النطاق التالي تماماً:
                    </p>
                    <div className="my-2 p-1.5 bg-slate-100 text-slate-900 rounded select-all font-mono text-center text-xs font-bold border border-slate-200">
                      {authErrorDetails.domain}
                    </div>
                    <p className="text-emerald-700 font-medium">
                      5. انقر "يحفظ" (Save)، ثم حدّث هذه الصفحة وسيعمل تسجيل
                      الدخول بكفاءة مطلقة!
                    </p>
                  </div>
                </div>
              ) : (
                <p className="leading-relaxed text-slate-700">
                  التفاصيل:{" "}
                  {authErrorDetails.message ||
                    "حدثت مشكلة تمنع اتمام المصادقة مع سيرفرات جوجل."}
                  <br />
                  <span className="font-bold">نصيحة:</span> يرجى التأكد من السماح بالنوافذ المنبثقة في متصفحك لإتمام عملية تسجيل الدخول بنجاح.
                </p>
              )}

              {/* Quick Reset Option inside the error details */}
              {getCustomFirebaseConfig() && (
                <div className="mt-4 pt-4 border-t border-rose-200/50 flex flex-col items-center gap-2.5">
                  <p className="font-bold text-rose-850 text-[11.5px] text-center leading-relaxed">
                    💡 هل ترغب في العودة السريعة لمشروع المنصة الافتراضي؟
                  </p>
                  <p className="text-slate-600 text-[10.5px] text-center leading-relaxed">
                    إذا لم تكن ترغب في إعداد نطاقات معتمدة حالياً، اضغط على الزر أدناه لقطع اتصال مشروعك المخصص والعودة فوراً لقاعدة بيانات المنصة الافتراضية.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      clearCustomFirebaseConfig();
                      triggerToast("تم قطع الاتصال والعودة لقاعدة بيانات المنصة الافتراضية بنجاح! جاري التحديث...", "success");
                      setTimeout(() => window.location.reload(), 1200);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-rose-200 active:scale-95"
                  >
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: "3s" }} />
                    <span>قطع الاتصال والعودة لقاعدة بيانات المنصة الافتراضية 🔌</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center gap-3">
            {currentUser && currentUser.email?.trim().toLowerCase() === "majedsoft@gmail.com" && (
              <button
                type="button"
                onClick={() => {
                  setBankPortalActive(true);
                  setStudentPortalActive(false);
                  const url = new URL(window.location.href);
                  url.searchParams.delete("teacher");
                  url.searchParams.set("portal", "bank");
                  window.history.pushState({}, "", url.toString());
                  triggerToast(
                    "تم الانتقال إلى بوابة بنك الأسئلة المستقلة بنجاح",
                    "success",
                  );
                }}
                className="text-xs text-emerald-600 hover:text-emerald-800 font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 hover:underline"
              >
                <Database className="w-4 h-4 shrink-0 text-emerald-650" />
                <span>الذهاب إلى بوابة بنك الأسئلة المستقل 🔗</span>
              </button>
            )}

            <div className="text-xs text-slate-400">
              أو اتصل بمهندس الدعم التقني لمزيد من الاستعلامات
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc] text-slate-800 font-sans"
      dir="rtl"
    >
      {/* Dynamic Toast Alerts */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-6 left-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl border bg-white max-w-md animate-none"
            style={{
              borderColor:
                toastType === "success"
                  ? "#22c55e"
                  : toastType === "error"
                    ? "#f43f5e"
                    : "#3b82f6",
            }}
          >
            {toastType === "success" && (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            )}
            {toastType === "error" && (
              <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            {toastType === "info" && (
              <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
            )}

            <p className="text-sm font-semibold text-slate-700">
              {toastMessage}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modern Right side menu for teacher (similar structure to Student portal) */}
      {!(isCurriculumAdminFullScreen && activeTab === "curriculum_review_admin") && (
        <aside className="w-full md:w-64 bg-white border-l border-slate-200/80 text-slate-800 shrink-0 flex flex-col justify-between p-5 md:sticky md:top-0 md:h-screen relative overflow-y-auto overflow-x-hidden shadow-xs">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-6 relative z-10">
          {/* Logo / Brand header matching student portal */}
          <div className="flex flex-col gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-tr from-[#1e3a8a] to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/10 p-0.5 shrink-0 transform hover:scale-110 transition-transform">
                <div className="w-full h-full bg-white rounded-[10px] flex flex-col items-center justify-center relative overflow-hidden">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  <span className="text-[7px] font-black tracking-widest text-[#f4be1c] font-sans">
                    PORTAL
                  </span>
                </div>
              </div>
              <div>
                <h1 className="text-sm md:text-base font-extrabold text-slate-900 leading-tight">
                  بوابة المعلم الإلكترونية
                </h1>
                <span className="text-xs md:text-sm font-black text-indigo-700 tracking-wide block normal-case leading-tight font-sans mt-0.5">
                  SmartCloud
                </span>
              </div>
            </div>


          </div>

          {/* Navigation Tabs */}
          <nav className="space-y-1.5">
            {/* Grouped Games & Comprehensive Review Section */}
            <div className="p-1.5 bg-slate-100/90 border border-slate-200 rounded-2xl space-y-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("curriculum_review_admin")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 transform hover:-translate-y-0.5 hover:scale-105 active:scale-95 cursor-pointer ${
                  activeTab === "curriculum_review_admin"
                    ? "bg-gradient-to-r from-blue-600 to-[#1e3a8a] text-white shadow-lg"
                    : "text-slate-650 hover:bg-slate-100 hover:text-[#1e3a8a] font-bold"
                }`}
              >
                <Sparkles className="w-4 h-4 shrink-0 text-[#f4be1c]" />
                <span>المراجعة الشاملة 📖</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("reviews_admin")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 transform hover:-translate-y-0.5 hover:scale-105 active:scale-95 cursor-pointer ${
                  activeTab === "reviews_admin"
                    ? "bg-gradient-to-r from-blue-600 to-[#1e3a8a] text-white shadow-lg"
                    : "text-slate-650 hover:bg-slate-100 hover:text-[#1e3a8a] font-bold"
                }`}
              >
                <Gamepad2 className="w-4 h-4 shrink-0 text-amber-500" />
                <span>ألعاب وتحديات 🏆</span>
              </button>
            </div>

            {/* Grouped Exams & Results Section */}
            <div className="p-1.5 bg-slate-100/90 border border-slate-200 rounded-2xl space-y-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("dashboard")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 transform hover:-translate-y-0.5 hover:scale-105 active:scale-95 cursor-pointer ${
                  activeTab === "dashboard"
                    ? "bg-gradient-to-r from-blue-600 to-[#1e3a8a] text-white shadow-lg"
                    : "text-slate-650 hover:bg-slate-100 hover:text-[#1e3a8a] font-bold"
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span>الاختبارات</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("student_results")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 transform hover:-translate-y-0.5 hover:scale-105 active:scale-95 cursor-pointer ${
                  activeTab === "student_results"
                    ? "bg-gradient-to-r from-blue-600 to-[#1e3a8a] text-white shadow-lg"
                    : "text-slate-650 hover:bg-slate-100 hover:text-[#1e3a8a] font-bold"
                }`}
              >
                <Award className="w-4 h-4 shrink-0 text-amber-500" />
                <span>نتائج الاختبارات</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("manage_student_portal")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 transform hover:-translate-y-0.5 hover:scale-105 active:scale-95 cursor-pointer ${
                  activeTab === "manage_student_portal"
                    ? "bg-gradient-to-r from-blue-600 to-[#1e3a8a] text-white shadow-lg"
                    : "text-slate-650 hover:bg-slate-100 hover:text-[#1e3a8a] font-bold"
                }`}
              >
                <Settings className="w-4 h-4 shrink-0 text-indigo-500" />
                <span>إدارة اختبارات الطلاب</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("students")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black transition-all duration-200 transform hover:-translate-y-0.5 hover:scale-105 active:scale-95 cursor-pointer ${
                activeTab === "students"
                  ? "bg-gradient-to-r from-blue-600 to-[#1e3a8a] text-white shadow-lg"
                  : "text-slate-650 hover:bg-slate-105 hover:text-[#1e3a8a] font-bold"
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>إضافة الطلاب/الفصول</span>
            </button>



            {currentUser && currentUser.email?.trim().toLowerCase() === "majedsoft@gmail.com" && (
              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("registered_teachers")}
                  className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 transform hover:-translate-y-0.5 hover:scale-105 active:scale-95 cursor-pointer ${
                    activeTab === "registered_teachers"
                      ? "bg-gradient-to-r from-indigo-600 to-[#1e3a8a] text-white shadow-lg"
                      : "bg-indigo-50/70 hover:bg-indigo-100/90 text-indigo-950 border border-indigo-200/80 font-bold"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <UserCheck className="w-4 h-4 shrink-0 text-indigo-600" />
                    <span>إدارة المعلمين المسجلين</span>
                  </div>
                  <span className="text-[9px] font-sans font-bold bg-indigo-200/70 text-indigo-900 px-1.5 py-0.5 rounded-md shrink-0">المسؤول</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setBankPortalActive(true);
                    setStudentPortalActive(false);
                    const url = new URL(window.location.href);
                    url.searchParams.set("portal", "bank");
                    url.searchParams.delete("teacher");
                    window.history.pushState({}, "", url.toString());
                    triggerToast("تم الانتقال لبوابة بنك الأسئلة المستقلة السحابية ⚡", "success");
                  }}
                  className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 transform hover:-translate-y-0.5 hover:scale-105 active:scale-95 cursor-pointer bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800"
                >
                  <div className="flex items-center gap-3">
                    <Database className="w-4 h-4 shrink-0 text-emerald-600 animate-pulse" />
                    <span>بنك الأسئلة المستقل 🔗</span>
                  </div>
                  <span className="text-[9px] font-sans font-bold bg-emerald-200/60 text-emerald-800 px-1.5 py-0.5 rounded-md shrink-0">بوابة مستقلة</span>
                </button>
              </div>
            )}
          </nav>

          {/* Distinct divider to separate student action area */}
          <div className="my-3 border-t border-slate-150"></div>

          {/* Dedicated Preview Zone */}
          <div className="space-y-2 bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/60 shadow-3xs">
            <button
              type="button"
              onClick={() => {
                setTeacherPreviewActive(true);
                triggerToast(
                  "تم تشغيل محاكي الطالب بنجاح، استمتع بالمعاينة",
                  "info",
                );
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/50 transition-all duration-200 transform hover:-translate-y-0.5 hover:scale-105 active:scale-95 cursor-pointer shadow-3xs"
              title="معاينة البوابة من منظور الطلاب"
            >
              <Eye className="w-4 h-4 shrink-0 text-rose-600 animate-pulse" />
              <span>معاينة بوابة الطالب</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const portalLink = `${window.location.origin}/?portal=student&teacherId=${currentUser?.uid || "demo_teacher"}`;
                navigator.clipboard.writeText(portalLink);
                triggerToast(
                  "تم نسخ رابط بوابة الطلاب بنجاح! يمكنك إرساله للطلاب ليفتح صفحة القوائم مباشرة.",
                  "success",
                );
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black bg-emerald-55 hover:bg-emerald-100 text-emerald-800 border border-emerald-250/50 transition-all duration-200 transform hover:-translate-y-0.5 hover:scale-105 active:scale-95 cursor-pointer shadow-3xs"
              title="نسخ رابط بوابة الطلاب لمشاركته معهم"
            >
              <Copy className="w-4 h-4 shrink-0 text-emerald-600 animate-bounce" style={{ animationDuration: '3s' }} />
              <span>نسخ رابط صفحة الطلاب</span>
            </button>
          </div>
        </div>

        {/* Sidebar bottom teacher profile card & logout */}
        <div className="pt-4 border-t border-slate-100 space-y-3 relative z-10 font-sans">
          <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black border border-blue-105">
                {(currentUser?.displayName || "M").charAt(0)}
              </div>
              <span className="text-[11px] font-black text-slate-700 truncate block flex-1">
                {currentUser?.displayName || "المعلمة"}
              </span>
            </div>
            <span className="text-[9px] text-slate-500 block font-bold font-sans">
              {currentUser?.email || ""}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              triggerConfirm(
                "تسجيل الخروج",
                "هل أنت متأكد من رغبتك في تسجيل الخروج والعودة لصفحة الدخول؟",
                () => {
                  signOut(auth);
                  triggerToast("تم تسجيل خروجك بنجاح", "info");
                },
              );
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-[11px] font-black transition-all duration-200 transform hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
      )}

      {/* --- MAIN BODY WORKSPACE --- */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        <main className={`flex-1 flex flex-col ${isCurriculumAdminFullScreen && activeTab === "curriculum_review_admin" ? "p-3 md:p-6 max-w-none w-full" : "p-6 md:p-10 max-w-7xl mx-auto w-full"} overflow-x-hidden`}>
          {/* UPPER STATUS BAR */}
          {activeTab === "builder" ? (
            <header className="flex flex-col sm:flex-row justify-end items-center gap-4 mb-8">
              {/* Back Button matching picture */}
              <button
                type="button"
                onClick={() => {
                  triggerConfirm(
                    "الرجوع للرئيسية",
                    "هل أنت متأكد من رغبتك في العودة لصفحة الاختبارات؟ لن يتم حفظ التعديلات الحالية غير المنشورة.",
                    () => {
                      setActiveTab("dashboard");
                    },
                    undefined,
                    "نعم، رجوع",
                    "مواصلة التعديل",
                  );
                }}
                className="flex items-center gap-2 px-5 py-2.5 border border-slate-205 bg-white text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 shadow-xs transition-all cursor-pointer font-sans"
              >
                <span>رجوع</span>
                <ChevronLeft className="w-4 h-4 scale-x-[-1]" />
              </button>
            </header>
          ) : null}

          <AnimatePresence mode="wait">
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-8"
              >




                {/* Title section and the Golden Action button matching screenshot exactly */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
                  <div>
                    <h3 className="text-2xl font-black text-[#0f172a] tracking-tight">
                      اختباراتي
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold mt-1">
                      ابدأ بصياغة وتصنيف اختبارات تفاعلية ذكية لطلابك ورصد
                      التقييم.
                    </p>
                  </div>

                  {/* Yellow Create/Build New Button from screenshot */}
                  <button
                    type="button"
                    onClick={() => setShowQuizCreationModal(true)}
                    className="w-full sm:w-auto bg-[#f4be1c] hover:bg-[#ffca28] text-[#0f172a] font-extrabold text-sm px-7 py-3.5 rounded-2xl transform hover:-translate-y-1 hover:scale-[1.05] hover:shadow-xl hover:shadow-amber-400/30 active:scale-[0.96] transition-all duration-200 ease-out flex items-center justify-center gap-2 cursor-pointer shrink-0"
                  >
                    <PlusCircle className="w-5 h-5 text-[#0f172a]" />
                    <span>إنشاء اختبار</span>
                  </button>
                </div>

                {/* Compact Search & Filters Row to fully preserve search feature */}
                <div className="bg-white rounded-2xl border border-slate-200/55 p-4 flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="البحث باسم الاختبار أو المادة الدراسية..."
                      value={quizSearch}
                      onChange={(e) => setQuizSearch(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 placeholder-slate-400"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 w-full md:w-auto shrink-0 animate-fadeIn">
                    <select
                      value={quizFilter}
                      onChange={(e) => setQuizFilter(e.target.value as any)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 flex-1 md:flex-none"
                    >
                      <option value="all">كل الحالات (نشط ومغلق)</option>
                      <option value="active">متاح حالياً (نشط)</option>
                      <option value="closed">مغلق ومحجوب</option>
                    </select>

                    <span className="bg-indigo-50 text-indigo-750 text-xs font-bold px-3 py-2.5 rounded-xl flex items-center justify-center font-sans tracking-wide">
                      {filteredQuizzes.length} اختبارات
                    </span>

                    {/* View Mode Toggle Button Group */}
                    <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-1 bg-slate-50 select-none">
                      <button
                        type="button"
                        onClick={() => setQuizViewMode("grid")}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          quizViewMode === "grid"
                            ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50 font-extrabold"
                            : "text-slate-400 hover:text-slate-700 border border-transparent"
                        }`}
                        title="عرض شبكي"
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuizViewMode("list")}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          quizViewMode === "list"
                            ? "bg-white text-indigo-700 shadow-xs border border-slate-200/50 font-extrabold"
                            : "text-slate-400 hover:text-slate-700 border border-transparent"
                        }`}
                        title="عرض قائمة"
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quizzes Container Grid/List based on selected view mode */}
                <div
                  className={
                    quizViewMode === "grid"
                      ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                      : "space-y-3"
                  }
                  dir="rtl"
                >
                  {filteredQuizzes.length === 0 ? (
                    <div className="col-span-full bg-white border border-slate-250/40 rounded-[24px] p-12 text-center text-slate-400 text-xs">
                      <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3 animate-bounce" />
                      <p className="font-bold text-sm text-slate-600 mb-1">
                        لم يتم العثور على أي اختبارات مطابقة
                      </p>
                      <p className="text-slate-400 text-xs">
                        قم بتعديل فلتر البحث أو ابدأ بصياغة اختبارك الأول.
                      </p>
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
                        <button
                          type="button"
                          onClick={() => {
                            setQuizSearch("");
                            setQuizFilter("all");
                          }}
                          className="text-xs text-indigo-600 font-bold hover:underline cursor-pointer"
                        >
                          إعادة تعيين البحث
                        </button>
                      </div>
                    </div>
                  ) : (
                    filteredQuizzes.map((quiz) => {
                      const totalPoints = quiz.questions.reduce(
                        (sum, q) => sum + Number(q.points || 0),
                        0,
                      );

                      if (quizViewMode === "grid") {
                        return (
                          <div
                            key={quiz.id}
                            onClick={() => {
                              setActiveMenuQuizId(
                                activeMenuQuizId === quiz.id ? null : quiz.id,
                              );
                            }}
                            className={`rounded-[16px] border ${quiz.status === "active" ? "bg-white border-slate-200/60" : "border-rose-200 bg-rose-50/60 shadow-sm shadow-rose-100/40"} p-4 flex flex-col justify-between shadow-xs hover:shadow-lg hover:border-slate-300 transform hover:-translate-y-1 active:scale-[0.99] transition-all duration-300 ease-out relative group cursor-pointer ${activeMenuQuizId === quiz.id ? "z-40" : "z-10 hover:z-20"}`}
                          >
                            {/* Top Action Dropdown for extra features to preserve them */}
                            <div className="absolute left-2.5 top-2.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuQuizId(
                                    activeMenuQuizId === quiz.id
                                      ? null
                                      : quiz.id,
                                  );
                                }}
                                className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                title="خيارات إضافية"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {activeMenuQuizId === quiz.id && (
                                <>
                                  {/* Backdrop click closer */}
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuQuizId(null);
                                    }}
                                  />
                                  <div className="absolute left-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 text-right font-sans">
                                    {/* Toggle active / inactive status */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuQuizId(null);
                                        handleToggleQuizStatus(quiz.id);
                                      }}
                                      className="w-full text-right px-4 py-2 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2"
                                    >
                                      {quiz.status === "active" ? (
                                        <>
                                          <Pause className="w-3.5 h-3.5 text-rose-500" />
                                          <span>إيقاف التشغيل (مغلق)</span>
                                        </>
                                      ) : (
                                        <>
                                          <Play className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
                                          <span>بدء التشغيل (مفعل)</span>
                                        </>
                                      )}
                                    </button>

                                    {/* Edit Quiz */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuQuizId(null);
                                        handleEditQuiz(quiz);
                                      }}
                                      className="w-full text-right px-4 py-2 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2 border-t border-slate-100"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-amber-500" />
                                      <span>تعديل الاختبار</span>
                                    </button>

                                    {/* Preview / View details */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuQuizId(null);
                                        setSelectedQuiz(quiz);
                                      }}
                                      className="w-full text-right px-4 py-2 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2 border-t border-slate-100"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>استعراض التفاصيل</span>
                                    </button>

                                    {/* Delete Quiz */}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuQuizId(null);
                                        handleDeleteQuiz(quiz.id);
                                      }}
                                      className="w-full text-right px-4 py-2 hover:bg-rose-50 text-rose-600 text-xs font-black transition flex items-center gap-2 border-t border-slate-100"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>حذف الاختبار</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Top Info section */}
                            <div className="space-y-2">
                              {/* Title and Subject Row */}
                              <div className="space-y-0.5">
                                <h4 className="text-sm font-black text-slate-900 group-hover:text-[#1e3a8a] transition-colors leading-tight cursor-pointer line-clamp-2 pr-5">
                                  {quiz.title}
                                </h4>

                                <span className="text-[10px] text-slate-400 font-bold block">
                                  {quiz.subject || "بدون وصف"}
                                </span>
                              </div>

                              {/* Status Badge */}
                              <div className="pt-0.5 font-sans">
                                {quiz.status === "active" ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold text-[10px] bg-emerald-50 border border-emerald-100/80 px-2 py-0.5 rounded-lg shadow-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    مفعل
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-700 font-extrabold text-[10px] bg-red-50 border border-red-100/80 px-2 py-0.5 rounded-lg shadow-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    مغلق ومحجوب
                                  </span>
                                )}
                              </div>

                              {/* Stats line with bullets exactly like screenshot */}
                              <div className="text-[11px] font-extrabold text-[#475569] font-sans flex items-center flex-wrap gap-1.5 pt-0.5">
                                <span>{quiz.questions.length || 0} سؤال</span>
                                <span className="text-slate-300">•</span>
                                <span>{totalPoints} درجة</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-indigo-700 font-extrabold text-xs">
                                  {quiz.durationMinutes === 9999 ? "مفتوح (بدون وقت)" : `${quiz.durationMinutes || 15} دقيقة`}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span>{quiz.dateCreated}</span>
                              </div>
                            </div>

                            {/* Target Grades & Semesters */}
                            {quiz.grade || quiz.semester ? (
                              <div
                                className="flex flex-wrap gap-1 items-center py-1 px-2 bg-slate-50 border border-slate-100/80 rounded-xl mt-2 select-none"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[9px] font-extrabold text-[#475569] block whitespace-nowrap">
                                  الفئة المستهدفة:
                                </span>
                                {quiz.grade && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-black text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg shadow-3xs max-w-full truncate">
                                    {quiz.grade}
                                  </span>
                                )}
                                {quiz.semester && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg shadow-3xs max-w-full truncate">
                                    {quiz.semester}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div
                                className="flex flex-wrap gap-1 items-center py-1 px-2 bg-slate-50 border border-slate-100/80 rounded-xl mt-2 select-none"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[9px] font-extrabold text-[#475569] block whitespace-nowrap">
                                  الفئة المستهدفة:
                                </span>
                                <span className="px-1.5 py-0.5 text-[9px] font-black text-blue-800 bg-blue-50 border border-blue-200 rounded-lg shadow-3xs max-w-full truncate">
                                  جميع الطلاب (عام)
                                </span>
                              </div>
                            )}

                            {/* Card Buttons Divider & Content perfectly styled */}
                            <div className="grid grid-cols-2 gap-1.5 pt-2 mt-2 border-t border-slate-100">
                              {/* Copy Link Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const studentLink = `${window.location.origin}/?quizId=${quiz.id}&teacherId=${currentUser?.uid || quiz.teacherId || "demo_teacher"}`;
                                  navigator.clipboard.writeText(studentLink);
                                  triggerToast(
                                    "تم نسخ رابط التقديم الفعلي بنجاح لمشاركته مع الطلاب",
                                    "success",
                                  );
                                }}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-1 px-2 rounded-lg flex items-center justify-center gap-1 text-[10px] transition duration-150 cursor-pointer shadow-3xs active:scale-[0.98]"
                              >
                                <span>📄 نسخ الرابط</span>
                              </button>

                              {/* Results / Details Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTab("student_results");
                                  if (quiz.grade) {
                                    setSelectedTabGrade(quiz.grade);
                                  }
                                  if (quiz.semester) {
                                    const firstSem = quiz.semester
                                      .split(",")[0]
                                      .trim();
                                    setSelectedTabSemester(firstSem);
                                  }
                                }}
                                className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-1 px-2 rounded-lg flex items-center justify-center gap-1 text-[10px] transition duration-150 cursor-pointer shadow-3xs active:scale-[0.98]"
                              >
                                <span>📊 النتائج</span>
                              </button>
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div
                            key={quiz.id}
                            onClick={() => {
                              setActiveMenuQuizId(
                                activeMenuQuizId === quiz.id ? null : quiz.id,
                              );
                            }}
                            className={`rounded-[14px] border ${quiz.status === "active" ? "bg-white border-slate-200/60" : "border-rose-200 bg-rose-50/60 shadow-sm shadow-rose-100/40"} p-3 flex flex-col sm:flex-row sm:items-center justify-between shadow-xs hover:shadow-lg hover:border-slate-300 transform hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-300 ease-out relative group cursor-pointer gap-2 ${activeMenuQuizId === quiz.id ? "z-40" : "z-10 hover:z-20"}`}
                          >
                            {/* Left Block: Icon & Main Titles */}
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                                <BookOpen className="w-4 h-4 text-indigo-500" />
                              </div>
                              <div className="min-w-0 pr-1.5">
                                <h4 className="text-xs font-black text-slate-900 group-hover:text-[#1e3a8a] transition-colors leading-snug truncate">
                                  {quiz.title}
                                </h4>
                                <span className="text-[10px] text-slate-400 font-bold block mt-0">
                                  {quiz.subject || "بدون وصف"}
                                </span>
                              </div>
                            </div>

                            {/* Middle Block: Info details & status */}
                            <div className="flex flex-wrap items-center gap-3 shrink-0 font-sans text-[10px]">
                              {/* Status Badge */}
                              <div>
                                {quiz.status === "active" ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-extrabold text-[9px] bg-emerald-50 border border-emerald-100/80 px-1.5 py-0.5 rounded-md shadow-xs">
                                    <span className="w-1 h-1 rounded-full bg-emerald-500" />
                                    مفعل
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-red-700 font-extrabold text-[9px] bg-red-50 border border-red-100/80 px-1.5 py-0.5 rounded-md shadow-xs">
                                    <span className="w-1 h-1 rounded-full bg-red-500" />
                                    مغلق ومحجوب
                                  </span>
                                )}
                              </div>

                              {/* Question count, marks, date created indicators */}
                              <div className="text-[11px] font-extrabold text-[#475569] flex items-center gap-1.5">
                                <span>{quiz.questions.length || 0} سؤال</span>
                                <span className="text-slate-300">•</span>
                                <span>{totalPoints} درجة</span>
                                <span className="text-slate-300">•</span>
                                <span className="text-indigo-700 font-extrabold text-xs">
                                  {quiz.durationMinutes === 9999 ? "مفتوح (بدون وقت)" : `${quiz.durationMinutes || 15} دقيقة`}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span>{quiz.dateCreated}</span>
                              </div>
                            </div>

                            {/* Right Block: Buttons & Options Menu Dropdown */}
                            <div className="flex flex-col items-start sm:items-end gap-1.5 pr-1.5 shrink-0">
                              {/* Target Grades & Semesters */}
                              {quiz.grade || quiz.semester ? (
                                <div
                                  className="flex flex-wrap gap-1 items-center py-0.5 px-2 bg-slate-50 border border-slate-100/80 rounded-lg mb-1 select-none"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-[9px] font-extrabold text-[#475569] block whitespace-nowrap">
                                    المستهدف:
                                  </span>
                                  {quiz.grade && (
                                    <span className="px-1.5 py-0 text-[9px] font-black text-indigo-800 bg-indigo-50 border border-indigo-200 rounded shadow-3xs max-w-full truncate">
                                      {quiz.grade}
                                    </span>
                                  )}
                                  {quiz.semester && (
                                    <span className="px-1.5 py-0 text-[9px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded shadow-3xs max-w-full truncate">
                                      {quiz.semester}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className="flex flex-wrap gap-1 items-center py-0.5 px-2 bg-slate-50 border border-slate-100/80 rounded-lg mb-1 select-none"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span className="text-[9px] font-extrabold text-[#475569] block whitespace-nowrap">
                                    المستهدف:
                                  </span>
                                  <span className="px-1.5 py-0 text-[9px] font-black text-blue-800 bg-blue-50 border border-blue-200 rounded shadow-3xs max-w-full truncate">
                                    جميع الطلاب (عام)
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center gap-1.5">
                                {/* Copy Link Button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const studentLink = `${window.location.origin}/?quizId=${quiz.id}&teacherId=${currentUser?.uid || quiz.teacherId || "demo_teacher"}`;
                                    navigator.clipboard.writeText(studentLink);
                                    triggerToast(
                                      "تم نسخ رابط التقديم الفعلي بنجاح لمشاركته مع الطلاب",
                                      "success",
                                    );
                                  }}
                                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-1 px-2.5 rounded-lg flex items-center justify-center gap-1 text-[10px] transition duration-150 cursor-pointer shadow-3xs active:scale-[0.98]"
                                  title="نسخ الرابط"
                                >
                                  <span>📄 نسخ الرابط</span>
                                </button>

                                {/* Results / Details Button */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTab("student_results");
                                    if (quiz.grade) {
                                      setSelectedTabGrade(quiz.grade);
                                    }
                                    if (quiz.semester) {
                                      const firstSem = quiz.semester
                                        .split(",")[0]
                                        .trim();
                                      setSelectedTabSemester(firstSem);
                                    }
                                  }}
                                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-1 px-2.5 rounded-lg flex items-center justify-center gap-1 text-[10px] transition duration-150 cursor-pointer shadow-3xs active:scale-[0.98]"
                                  title="النتائج"
                                >
                                  <span>📊 النتائج</span>
                                </button>

                                {/* Options Dropdown */}
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuQuizId(
                                        activeMenuQuizId === quiz.id
                                          ? null
                                          : quiz.id,
                                      );
                                    }}
                                    className="w-7 h-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                    title="خيارات إضافية"
                                  >
                                    <MoreVertical className="w-3.5 h-3.5" />
                                  </button>

                                  {activeMenuQuizId === quiz.id && (
                                    <>
                                      <div
                                        className="fixed inset-0 z-40"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveMenuQuizId(null);
                                        }}
                                      />
                                      <div className="absolute left-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 text-right font-sans">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuQuizId(null);
                                            handleToggleQuizStatus(quiz.id);
                                          }}
                                          className="w-full text-right px-4 py-2 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2"
                                        >
                                          {quiz.status === "active" ? (
                                            <>
                                              <Pause className="w-3.5 h-3.5 text-rose-500" />
                                              <span>إيقاف التشغيل (مغلق)</span>
                                            </>
                                          ) : (
                                            <>
                                              <Play className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500" />
                                              <span>بدء التشغيل (مفعل)</span>
                                            </>
                                          )}
                                        </button>

                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuQuizId(null);
                                            handleEditQuiz(quiz);
                                          }}
                                          className="w-full text-right px-4 py-2 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2 border-t border-slate-100"
                                        >
                                          <Pencil className="w-3.5 h-3.5 text-amber-500" />
                                          <span>تعديل الاختبار</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuQuizId(null);
                                            setSelectedQuiz(quiz);
                                          }}
                                          className="w-full text-right px-4 py-2 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-2 border-t border-slate-100"
                                        >
                                          <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                          <span>استعراض التفاصيل</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveMenuQuizId(null);
                                            handleDeleteQuiz(quiz.id);
                                          }}
                                          className="w-full text-right px-4 py-2 hover:bg-rose-50 text-rose-600 text-xs font-black transition flex items-center gap-2 border-t border-slate-100"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                          <span>حذف الاختبار</span>
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    })
                  )}

                  {/* Dynamic Add New Exam matching current view mode */}
                  {quizViewMode === "grid" ? (
                    <div
                      onClick={() => setShowQuizCreationModal(true)}
                      className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/20 hover:bg-indigo-50/10 cursor-pointer rounded-[24px] p-6 flex flex-col items-center justify-center min-h-[220px] gap-3 text-slate-400 hover:text-indigo-600 transition-all duration-300 shadow-xs group"
                    >
                      <div className="w-12 h-12 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-250 shadow-xs transition-colors">
                        <Plus className="w-6 h-6 text-indigo-500 animate-pulse" />
                      </div>
                      <span className="font-extrabold text-slate-700 group-hover:text-indigo-600 text-sm mt-1">
                        إنشاء اختبار جديد
                      </span>
                    </div>
                  ) : (
                    <div
                      onClick={() => setShowQuizCreationModal(true)}
                      className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/20 hover:bg-indigo-50/10 cursor-pointer rounded-[20px] p-5 flex items-center justify-center gap-3 text-slate-400 hover:text-indigo-600 transition-all duration-300 shadow-xs group min-h-[70px] w-full"
                    >
                      <div className="w-8 h-8 rounded-full border border-slate-200 bg-white flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-250 shadow-xs transition-colors shrink-0">
                        <Plus className="w-4 h-4 text-indigo-500 animate-pulse" />
                      </div>
                      <span className="font-extrabold text-slate-700 group-hover:text-indigo-600 text-sm">
                        إنشاء اختبار جديد
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB 2: QUIZ BUILDER CONTAINER */}
            {activeTab === "builder" && (
              <motion.form
                onSubmit={handleSaveQuiz}
                key="builder-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-8"
              >
                {/* Card 2: Question Dynamic Builder Container */}
                <div className="space-y-6 relative">
                  {/* --- INLINE: SELECT QUESTIONS FROM QUESTION BANK --- */}
                  {showBankImportInline && (
                    <div
                      className="bg-white rounded-2xl border-2 border-indigo-200/90 shadow-md overflow-hidden flex flex-col mb-6 animate-fadeIn font-sans"
                    >
                    {/* Header */}
                    <div className="p-6 border-b border-indigo-100 bg-indigo-50/20 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center shrink-0">
                          <Library className="w-6 h-6 animate-pulse text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="text-base sm:text-lg font-black text-slate-900">
                            تصفح واستيراد الأسئلة من بنك الأسئلة
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-500 font-bold mt-1">
                            تصفح الأسئلة المصنفة وحصّل ما يناسب اختبارك لإدراجه مباشرة في المسودة.
                          </p>
                        </div>
                      </div>
                    </div>

                        {/* Filters Row */}
                        <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50/25 flex flex-col gap-5 transition-all duration-300">
                          <QuestionBankSmartFilters
                            questions={bankQuestions}
                            stage={importFilterStage}
                            setStage={setImportFilterStage}
                            grade={importFilterGrade}
                            setGrade={setImportFilterGrade}
                            semester={importFilterSemester}
                            setSemester={setImportFilterSemester}
                            subject={importFilterSubject}
                            setSubject={setImportFilterSubject}
                            setUnit={setImportFilterUnit}
                            setLesson={setImportFilterLesson}
                            search={importSearch}
                            setSearch={setImportSearch}
                          />

                          {/* Second Row: Wide Lesson Multiselect */}
                          <div id="unit-lesson-multiselect-section" className="w-full space-y-4 scroll-mt-6">
                            <UnitLessonMultiSelect
                              questions={bankQuestions.filter(
                                (q) =>
                                  (importFilterStage === "all" ||
                                    q.stage === importFilterStage) &&
                                  (importFilterGrade === "all" ||
                                    q.grade === importFilterGrade) &&
                                  (importFilterSubject === "all" ||
                                    q.subject === importFilterSubject) &&
                                  (importFilterSemester === "all" ||
                                    q.semester === importFilterSemester),
                              )}
                              selected={importFilterLessons}
                              onChange={setImportFilterLessons}
                              stepActive={importFilterSubject !== "all" && importFilterLessons.length === 0}
                              stepCompleted={importFilterLessons.length > 0}
                              stepDisabled={importFilterSubject === "all"}
                            />

                            {/* Automatic Quiz Creator trigger button */}
                            <div className="flex justify-start">
                              <button
                                type="button"
                                id="btn-builder-auto-quiz-trigger-inline"
                                disabled={importFilterLessons.length === 0}
                                onClick={handleOpenBuilderAutoQuizModal}
                                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-sm rounded-2xl shadow-md shadow-orange-100 hover:shadow-orange-200/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                              >
                                <Sparkles className="w-4.5 h-4.5 text-amber-100 group-hover:animate-pulse animate-pulse" />
                                <span>إنشاء اختبار تلقائي 🪄</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* TOP STATS DASHBOARD DISPLAY */}
                        <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border-b border-slate-100 select-none animate-fadeIn">
                          {/* Stat 2: Total grades/score current */}
                          <div className="bg-white p-4 flex items-center justify-between shadow-3xs rounded-xl border border-slate-150">
                            <div>
                              <span className="text-[10.5px] text-slate-400 font-extrabold block mb-1">
                                إجمالي درجات الاختبار
                              </span>
                              <span className="text-2xl font-black text-emerald-800 font-sans">
                                {builderQuestions.reduce(
                                  (acc, q) => acc + Number(q.points || 0),
                                  0,
                                ) +
                                  bankQuestions
                                    .filter((q) => importSelectedBqIds[q.id])
                                    .reduce(
                                      (acc, q) => acc + Number(q.points || 0),
                                      0,
                                    )}{" "}
                                <span className="text-xs font-bold text-emerald-600 font-medium">
                                  درجة
                                </span>
                              </span>
                            </div>
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100/50 shrink-0">
                              <Award className="w-5 h-5" />
                            </div>
                          </div>

                          {/* Stat 3: Questions currently selected in bank */}
                          <div className="bg-white p-4 flex items-center justify-between shadow-3xs rounded-xl border border-slate-150">
                            <div>
                              <span className="text-[10.5px] text-slate-400 font-extrabold block mb-1">
                                المحددة للاستيراد من البنك
                              </span>
                              <span className="text-2xl font-black text-amber-800 font-sans">
                                {
                                  Object.values(importSelectedBqIds).filter(Boolean)
                                    .length
                                }{" "}
                                <span className="text-xs font-bold text-amber-600 font-medium">
                                  سؤال
                                </span>
                              </span>
                            </div>
                            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-100/50 shrink-0">
                              <CheckSquare className="w-5 h-5" />
                            </div>
                          </div>
                        </div>

                        {/* Dynamic Filter Statistics */}
                        <div className="px-5 py-3.5 bg-slate-50/50 border-b border-slate-100 select-none text-[11px] animate-fadeIn">
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-slate-400">
                                العثور على {filteredImportCount} سؤال متاح
                              </span>
                            </div>

                            <div className="flex gap-2.5 items-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const next: Record<string, boolean> = {
                                    ...importSelectedBqIds,
                                  };
                                  filteredImportQuestions.forEach((q) => {
                                    next[q.id] = true;
                                  });
                                  setImportSelectedBqIds(next);
                                }}
                                className="text-xs text-indigo-600 font-black hover:underline cursor-pointer font-sans bg-indigo-50/50 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100"
                              >
                                تحديد الكل ({filteredImportCount})
                              </button>
                              <span className="text-slate-200">|</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const next: Record<string, boolean> = {
                                    ...importSelectedBqIds,
                                  };
                                  filteredImportQuestions.forEach((q) => {
                                    next[q.id] = false;
                                  });
                                  setImportSelectedBqIds(next);
                                }}
                                className="text-xs text-slate-500 font-extrabold hover:underline cursor-pointer font-sans bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors border border-slate-100"
                              >
                                إلغاء تحديد الكل
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Content Area - Scrollable Questions */}
                        <div className="p-6 overflow-y-auto space-y-4 max-h-[380px] bg-slate-50/25">
                          {(() => {
                            const filteredImport = filteredImportQuestions;

                            if (filteredImport.length === 0) {
                              return (
                                <div className="py-12 text-center text-slate-400">
                                  <Database className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                  <p className="text-xs font-bold font-sans">
                                    تنبيه: لا يوجد أسئلة مطابقة للخيارات المفلترة
                                    في البنك حالياً.
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <>
                                {/* List */}
                                <div className="space-y-3">
                                  {filteredImport.map((q) => {
                                    const isAlreadyAdded = builderQuestions.some(
                                      (bq) => bq.text.trim() === q.text.trim() || bq.id.endsWith(q.id) || bq.id === q.id
                                    );
                                    const isSelected = !isAlreadyAdded && !!importSelectedBqIds[q.id];
                                    return (
                                      <div
                                        key={q.id}
                                        onClick={() => {
                                          if (isAlreadyAdded) return;
                                          setImportSelectedBqIds((prev) => ({
                                            ...prev,
                                            [q.id]: !prev[q.id],
                                          }));
                                        }}
                                        className={`p-4 rounded-2xl border-2 transition-all flex items-start gap-3.5 text-right bg-white relative group ${
                                          isAlreadyAdded
                                            ? "bg-slate-50 border-slate-200/60 cursor-not-allowed opacity-70"
                                            : isSelected
                                              ? "bg-indigo-50/20 border-indigo-550 shadow-3xs cursor-pointer"
                                              : "border-slate-105 hover:border-slate-300 cursor-pointer"
                                        }`}
                                      >
                                        {/* Checkbox control */}
                                        <div
                                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                            isAlreadyAdded
                                              ? "bg-slate-100 border-slate-300 text-slate-400"
                                              : isSelected
                                                ? "bg-indigo-600 border-indigo-600 text-white"
                                                : "border-slate-300 text-transparent bg-white"
                                          }`}
                                        >
                                          <Check className="w-3.5 h-3.5" />
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 space-y-2.5 min-w-0">
                                          <div className="flex flex-wrap gap-1 items-center">
                                            <span className="text-[9px] font-sans font-bold text-slate-400 truncate max-w-[120px]">
                                              {q.subject}
                                            </span>
                                            {q.unit && (
                                              <span className="text-[9px] font-sans text-indigo-500 font-bold bg-indigo-50/50 px-1.5 py-0.5 rounded-md truncate max-w-[100px]">
                                                {q.unit}
                                              </span>
                                            )}
                                            {q.lesson && (
                                              <span className="text-[9px] font-sans text-teal-600 font-bold bg-teal-50/50 px-1.5 py-0.5 rounded-md truncate max-w-[100px] font-sans">
                                                {q.lesson}
                                              </span>
                                            )}
                                            {isAlreadyAdded && (
                                              <span className="text-[9px] font-sans font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md shrink-0">
                                                مضاف مسبقاً للاختبار
                                              </span>
                                            )}
                                            <span className="mr-auto text-[9px] font-sans font-extrabold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0">
                                              {q.points} ن
                                            </span>
                                          </div>
                                          <p className="text-[15px] font-black text-slate-900 leading-relaxed font-sans">
                                            {q.text}
                                          </p>

                                          {/* Options and correct answer display - Stacked vertically with numbered badges */}
                                          <div className="flex flex-col gap-2.5 pt-1.5 w-full">
                                            {(q.options || [])
                                              .map((opt, oIdx) => ({ opt, oIdx }))
                                              .filter(item => {
                                                if (!item.opt) return false;
                                                const t = item.opt.trim();
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
                                              .map(({ opt, oIdx }) => {
                                                const isCorrect =
                                                  q.type === "multiple_choice"
                                                    ? String(oIdx) ===
                                                      q.correctAnswer
                                                    : (oIdx === 0 &&
                                                        (q.correctAnswer === "true" || q.correctAnswer === "0" || q.correctAnswer === "صح" || q.correctAnswer === "صحيح" || q.correctAnswer === "صواب")) ||
                                                      (oIdx === 1 &&
                                                        (q.correctAnswer === "false" || q.correctAnswer === "1" || q.correctAnswer === "خطأ" || q.correctAnswer === "خاطئ" || q.correctAnswer === "خاطئة"));

                                                return (
                                                  <div
                                                    key={oIdx}
                                                    className={`p-3 rounded-xl text-[13px] font-sans border flex items-center justify-between transition-all ${
                                                      isCorrect
                                                        ? "bg-emerald-50/70 border-emerald-500 text-emerald-800 font-extrabold shadow-3xs"
                                                        : "bg-slate-50 border-slate-200/80 text-slate-650 hover:bg-slate-100/70"
                                                    }`}
                                                  >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                      <span className={`inline-flex items-center justify-center w-5.5 h-5.5 rounded-lg text-xs font-black shrink-0 ${
                                                        isCorrect 
                                                          ? 'bg-emerald-200 text-emerald-900' 
                                                          : 'bg-slate-200 text-slate-650'
                                                      }`}>
                                                        {oIdx + 1}
                                                      </span>
                                                      <span className="truncate pr-1 text-slate-800 font-bold text-[13px]">
                                                        {opt}
                                                      </span>
                                                    </div>
                                                    {isCorrect && (
                                                      <span className="text-[10px] bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 select-none">
                                                        <Check className="w-3 h-3 stroke-[3.5px]" />
                                                        الإجابة الصحيحة
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex justify-end items-center">
                          <span className="text-xs text-indigo-600 font-extrabold">
                            عدد الأسئلة المحددة حالياً من البنك: {Object.values(importSelectedBqIds).filter(Boolean).length}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* QUESTIONS STACK CONTAINER */}
                    <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-250 shadow-xs">
                      {/* UNIFIED TOP CONTROLS FOR QUESTIONS BOX (Always Visible) */}
                      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 pb-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-650 animate-pulse"></span>
                          <span className="font-extrabold text-slate-800 text-sm">
                            قائمة أسئلة الاختبار الحالي ({builderQuestions.length} سؤال / {builderQuestions.reduce((acc, q) => acc + Number(q.points || 0), 0)} درجة)
                          </span>
                        </div>
                      </div>

                      {builderQuestions.length === 0 ? (
                        <div className="bg-slate-50 rounded-2xl border-2 border-dashed border-indigo-100 p-8 text-center animate-fadeIn shadow-xs my-2">
                          <Database className="w-10 h-10 text-indigo-300 mx-auto mb-3 animate-pulse" />
                          <p className="text-sm font-extrabold text-slate-700 font-sans">
                            لا توجد أسئلة مضافة في هذا الاختبار حالياً.
                          </p>
                          <p className="text-xs text-slate-400 mt-1 font-sans">
                            ابدأ باختيار أسئلة من بنك الأسئلة أعلاه أو اضغط على "إضافة سؤال يدوي فارغ" لتصميم أسئلة مخصصة هنا مباشرة.
                          </p>
                        </div>
                      ) : (
                        <div
                          ref={questionsContainerRef}
                          className="max-h-[680px] overflow-y-auto pr-2 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
                          dir="rtl"
                        >
                          {builderQuestions.map((question, qIndex) => {
                            const themes = [
                              {
                                bg: "bg-indigo-50/15 hover:bg-indigo-50/25",
                                border: "border-indigo-150",
                                accent: "bg-indigo-600",
                                badgeBg: "bg-indigo-650 text-white",
                                numberBorder: "border-indigo-200",
                                focusRing:
                                  "focus:ring-indigo-500 focus:border-indigo-500",
                                inputBg: "bg-white",
                                optionBg:
                                  "bg-indigo-50/40 border-indigo-200/60 hover:bg-slate-50",
                                optionSelected:
                                  "bg-indigo-100/60 border-indigo-400 text-indigo-950",
                              },
                              {
                                bg: "bg-emerald-50/15 hover:bg-emerald-50/25",
                                border: "border-emerald-150",
                                accent: "bg-emerald-600",
                                badgeBg: "bg-emerald-650 text-white",
                                numberBorder: "border-emerald-200",
                                focusRing:
                                  "focus:ring-emerald-500 focus:border-emerald-500",
                                inputBg: "bg-white",
                                optionBg:
                                  "bg-emerald-50/40 border-emerald-200/60 hover:bg-slate-50",
                                optionSelected:
                                  "bg-emerald-100/60 border-emerald-400 text-emerald-950",
                              },
                              {
                                bg: "bg-amber-50/15 hover:bg-amber-50/25",
                                border: "border-amber-150",
                                accent: "bg-amber-500",
                                badgeBg: "bg-amber-600 text-white",
                                numberBorder: "border-amber-200",
                                focusRing:
                                  "focus:ring-amber-500 focus:border-amber-500",
                                inputBg: "bg-white",
                                optionBg:
                                  "bg-amber-50/40 border-amber-200/60 hover:bg-slate-50",
                                optionSelected:
                                  "bg-amber-100/60 border-amber-400 text-amber-950",
                              },
                              {
                                bg: "bg-rose-50/15 hover:bg-rose-50/25",
                                border: "border-rose-150",
                                accent: "bg-rose-600",
                                badgeBg: "bg-rose-650 text-white",
                                numberBorder: "border-rose-200",
                                focusRing:
                                  "focus:ring-rose-500 focus:border-rose-500",
                                inputBg: "bg-white",
                                optionBg:
                                  "bg-rose-50/40 border-rose-200/60 hover:bg-slate-50",
                                optionSelected:
                                  "bg-rose-100/60 border-rose-400 text-rose-950",
                              },
                            ];
                            const theme = themes[qIndex % themes.length];

                            return (
                              <div
                                key={question.id}
                                className={`rounded-2xl border p-6 relative overflow-hidden group/card transition-all duration-300 ${theme.bg} ${theme.border}`}
                              >
                                {/* Card Accent line on top */}
                                <div
                                  className={`absolute top-0 right-0 left-0 h-1 ${theme.accent}`}
                                />

                                <div className="flex justify-between items-center mb-5">
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`w-8 h-8 rounded-full ${theme.badgeBg} font-bold flex items-center justify-center font-sans text-sm shadow-xs border ${theme.numberBorder}`}
                                    >
                                      {qIndex + 1}
                                    </span>
                                    <span className="font-extrabold text-slate-850 text-sm">
                                      السؤال {qIndex + 1} {question.isManual ? " (يدوي مخصص)" : " (مستورد من البنك)"}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveQuestionFromBuilder(qIndex)
                                    }
                                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-100"
                                    title="حذف هذا السؤال"
                                  >
                                    <Trash2 className="w-4.5 h-4.5" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                  {/* Question Text */}
                                  <div className="lg:col-span-6 space-y-2">
                                    <label className="text-slate-700 font-bold text-xs block">
                                      نص السؤال والمنطوق
                                    </label>
                                    <input
                                      type="text"
                                      required
                                      placeholder="اكتب صيغة السؤال التقييمي هنا الموجه للطلاب..."
                                      value={question.text}
                                      onChange={(e) =>
                                        handleQuestionChange(
                                          qIndex,
                                          "text",
                                          e.target.value,
                                        )
                                      }
                                      className="w-full bg-white border border-slate-250 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 placeholder-slate-400 font-sans"
                                    />
                                  </div>

                                  {/* Question Type */}
                                  <div className="lg:col-span-3 space-y-2">
                                    <label className="text-slate-700 font-bold text-xs block">
                                      نوع السؤال
                                    </label>
                                    <select
                                      value={question.type}
                                      onChange={(e) =>
                                        handleQuestionChange(
                                          qIndex,
                                          "type",
                                          e.target.value,
                                        )
                                      }
                                      className="w-full bg-white border border-slate-250 rounded-xl px-3 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                                    >
                                      <option value="multiple_choice">إختيار من متعدد</option>
                                      <option value="true_false">صحيح / خطأ</option>
                                    </select>
                                  </div>

                                  {/* Question Points */}
                                  <div className="lg:col-span-3 space-y-2">
                                    <label className="text-slate-700 font-bold text-xs block">
                                      درجة السؤال
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={question.points || 1}
                                      onChange={(e) =>
                                        handleQuestionChange(
                                          qIndex,
                                          "points",
                                          Number(e.target.value) || 1,
                                        )
                                      }
                                      className="w-full bg-white border border-slate-250 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-800 font-sans"
                                    />
                                  </div>
                                </div>

                                {/* Question Options or True/False details */}
                                <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
                                  {question.type === "multiple_choice" ? (
                                    <div className="space-y-2.5">
                                      <label className="text-slate-700 font-extrabold text-xs block mb-1">
                                        خيارات السؤال (يرجى إدخال النصوص وتحديد الخيار الصحيح):
                                      </label>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {(question.options || ["", "", "", ""]).map((opt, oIdx) => {
                                          const isCorrect = question.correctAnswer === String(oIdx);
                                          return (
                                            <div
                                              key={oIdx}
                                              className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                                                isCorrect
                                                  ? "bg-emerald-50/40 border-emerald-300"
                                                  : "bg-white border-slate-200"
                                              }`}
                                            >
                                              {/* Correct Option Checkbox indicator */}
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleQuestionChange(
                                                    qIndex,
                                                    "correctAnswer",
                                                    String(oIdx),
                                                  )
                                                }
                                                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                                  isCorrect
                                                    ? "bg-emerald-600 border-emerald-600 text-white"
                                                    : "border-slate-300 text-transparent bg-white hover:border-slate-400"
                                                }`}
                                                title="تعيين كإجابة صحيحة"
                                              >
                                                <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                              </button>

                                              <input
                                                type="text"
                                                required
                                                placeholder={`الخيار رقم ${oIdx + 1}...`}
                                                value={opt}
                                                onChange={(e) =>
                                                  handleOptionChange(
                                                    qIndex,
                                                    oIdx,
                                                    e.target.value,
                                                  )
                                                }
                                                className="flex-1 bg-transparent border-none p-0 text-xs focus:outline-none focus:ring-0 text-slate-800 font-medium placeholder-slate-400 font-sans"
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2.5">
                                      <label className="text-slate-700 font-extrabold text-xs block mb-1">
                                        حدد الإجابة الصحيحة لسؤال (صحيح / خطأ):
                                      </label>
                                      <div className="flex gap-4">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleQuestionChange(
                                              qIndex,
                                              "correctAnswer",
                                              "true",
                                            )
                                          }
                                          className={`flex-1 p-3 rounded-xl border text-center text-xs font-bold transition-all ${
                                            (question.correctAnswer === "true" || question.correctAnswer === "0" || question.correctAnswer === "صح" || question.correctAnswer === "صحيح" || question.correctAnswer === "صواب")
                                              ? "bg-emerald-50/50 border-emerald-400 text-emerald-800 font-extrabold ring-1 ring-emerald-300"
                                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                          }`}
                                        >
                                          صحيح (True)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleQuestionChange(
                                              qIndex,
                                              "correctAnswer",
                                              "false",
                                            )
                                          }
                                          className={`flex-1 p-3 rounded-xl border text-center text-xs font-bold transition-all ${
                                            (question.correctAnswer === "false" || question.correctAnswer === "1" || question.correctAnswer === "خطأ" || question.correctAnswer === "خاطئ" || question.correctAnswer === "خاطئة")
                                              ? "bg-rose-50/50 border-rose-400 text-rose-800 font-extrabold ring-1 ring-rose-300"
                                              : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                          }`}
                                        >
                                          خطأ (False)
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Manual Question Fast Adder */}
                      <div className="bg-indigo-50/25 rounded-2xl border border-indigo-100 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 animate-fadeIn">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center shrink-0">
                            <Plus className="w-5.5 h-5.5 text-indigo-650" />
                          </div>
                          <div className="text-right">
                            <h4 className="text-sm font-extrabold text-slate-800">
                              إنشاء وإضافة أسئلة مخصصة يدوياً
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5 font-sans">
                              أضف سؤالاً فارغاً جديداً وسيقوم النظام بدمجه وتنسيقه مباشرة في قائمة أسئلة الاختبار الحالي.
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
                          <button
                            type="button"
                            onClick={handleAddQuestionToBuilder}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-6 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm shadow-indigo-100 font-sans"
                          >
                            <Plus className="w-4 h-4 stroke-[2.5]" />
                            <span>إضافة سؤال يدوي فارغ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowBankImportModal(true)}
                            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs px-6 py-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-sm shadow-emerald-100 font-sans"
                          >
                            <Database className="w-4 h-4" />
                            <span>إضافة سؤال من بنك الأسئلة</span>
                          </button>
                        </div>
                      </div>
                    </div>

                {/* Section 1: Basic Data & Advanced Settings Combined */}
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <ClipboardList className="w-5.5 h-5.5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800">
                        {editingQuizId
                          ? "تعديل وتحديث بيانات الاختبار الحالي"
                          : "بيانات ومعلومات الاختبار الأساسية"}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">
                        أدخل العنوان الرئيسي والمادة الدراسية، واضبط خيارات
                        وضوابط الاختبار المتقدمة أدناه.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Field A: Title */}
                    <div className="space-y-2">
                      <label className="text-slate-700 font-black text-sm sm:text-base block">
                        عنوان الاختبار
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="امتحان الفترة الثانية، اختبار تجريبي، إلخ..."
                        value={builderTitle}
                        onChange={(e) => setBuilderTitle(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-4 focus:ring-indigo-50 text-slate-800 placeholder-slate-400 transition-all font-bold"
                      />
                    </div>

                    {/* Field B: Subject */}
                    <div className="space-y-2">
                      <label className="text-slate-700 font-black text-sm sm:text-base block">
                        المادة الدراسية (اختياري)
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: الرياضيات، العلوم، اللغة العربية..."
                        value={builderSubject}
                        onChange={(e) => setBuilderSubject(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl px-4 py-3.5 text-sm sm:text-base focus:outline-none focus:ring-4 focus:ring-indigo-50 text-slate-800 placeholder-slate-400 transition-all font-bold"
                      />
                    </div>
                  </div>

                  {/* Embedded Advanced Options & Controls */}
                  <div className="border-t border-slate-100 pt-6 mt-4 space-y-4">
                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                      <Settings className="w-5 h-5 text-indigo-600 animate-spin-slow" />
                      <span className="text-sm sm:text-base font-black text-slate-800">
                        إعدادات وضوابط ومؤقت الاختبار
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* 0. Target Audience (Grade and Semester/Class Selection) */}
                      <div className="flex flex-col p-4 bg-slate-50/45 hover:bg-slate-50 border border-slate-150/60 rounded-2xl transition-all duration-200">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                              <GraduationCap className="w-6 h-6" />
                            </div>
                            <div>
                              <span className="font-extrabold text-sm sm:text-base text-slate-850 block">
                                تحديد الفئة المستهدفة للاختبار (الصف أو الفصل)
                              </span>
                              <span className="text-xs sm:text-sm text-slate-400 block mt-0.5 font-bold">
                                قصر ظهور هذا الاختبار على طلاب مرحلة دراسية أو فصل/شعبة معينة.
                              </span>
                            </div>
                          </div>
                          {/* Toggle Switch */}
                          <button
                            type="button"
                            onClick={() =>
                              setBuilderCustomizeClass(!builderCustomizeClass)
                            }
                            className={`w-12 h-6.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer flex items-center shrink-0 ${
                              builderCustomizeClass
                                ? "bg-indigo-600 justify-end"
                                : "bg-slate-300 justify-start"
                            }`}
                          >
                            <span className="w-5.5 h-5.5 rounded-full bg-white shadow-md block transition-transform"></span>
                          </button>
                        </div>

                        {/* Inline Grade & Semester Selection */}
                        {builderCustomizeClass && (
                          <div className="mt-4 mr-0 sm:mr-16 p-5 bg-indigo-50/35 border border-indigo-100 rounded-2xl space-y-4 animate-fadeIn">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* Grade selector */}
                              <div className="space-y-2">
                                <label className="text-xs sm:text-sm font-black text-slate-700 block">
                                  الصف الدراسي المستهدف:
                                </label>
                                <select
                                  value={builderGrade}
                                  onChange={(e) => setBuilderGrade(e.target.value)}
                                  className="w-full bg-white border border-slate-200 text-sm sm:text-base font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all duration-200 text-slate-800"
                                >
                                  {gradesList.map((g) => (
                                    <option key={g} value={g}>
                                      {g}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Semester/Class selector */}
                              <div className="space-y-2">
                                <label className="text-xs sm:text-sm font-black text-slate-700 block">
                                  الفصل/الشعبة المستهدفة:
                                </label>
                                <select
                                  value={builderSemester}
                                  onChange={(e) => setBuilderSemester(e.target.value)}
                                  className="w-full bg-white border border-slate-200 text-sm sm:text-base font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all duration-200 text-slate-800"
                                >
                                  <option value="جميع الفصول">جميع فصول الصف</option>
                                  {builderSemestersList.map((sem) => (
                                    <option key={sem} value={sem}>
                                      {sem}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 1. Show Result directly */}
                      <div className="flex flex-col p-4 bg-slate-50/45 hover:bg-slate-50 border border-slate-150/60 rounded-2xl transition-all duration-200">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
                              <BarChart3 className="w-6 h-6" />
                            </div>
                            <div>
                              <span className="font-extrabold text-sm text-slate-850 block">
                                عرض النتيجة للطالب
                              </span>
                              <span className="text-xs text-slate-400 block mt-0.5">
                                إظهار درجة الطالب وتفاصيل الإجابة بعد التسليم
                                مباشرة.
                              </span>
                            </div>
                          </div>
                          {/* Toggle Switch */}
                          <button
                            type="button"
                            onClick={() =>
                              setBuilderShowResultToStudent(
                                !builderShowResultToStudent,
                              )
                            }
                            className={`w-12 h-6.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer flex items-center shrink-0 ${
                              builderShowResultToStudent
                                ? "bg-emerald-500 justify-end"
                                : "bg-slate-300 justify-start"
                            }`}
                          >
                            <span className="w-5.5 h-5.5 rounded-full bg-white shadow-md block transition-transform"></span>
                          </button>
                        </div>
                      </div>

                      {/* 3. Shuffle Questions */}
                      <div className="flex flex-col p-4 bg-slate-50/45 hover:bg-slate-50 border border-slate-150/60 rounded-2xl transition-all duration-200">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                              <Shuffle className="w-5.5 h-5.5" />
                            </div>
                            <div>
                              <span className="font-extrabold text-sm text-slate-850 block">
                                ترتيب الأسئلة عشوائياً لكل طالب
                              </span>
                              <span className="text-xs text-slate-400 block mt-0.5">
                                يعيد ترتيب وخض الأسئلة تلقائياً وبشكل متباين لكل
                                تلميذ للحد من فرص التشارك والغش.
                              </span>
                            </div>
                          </div>
                          {/* Toggle Switch */}
                          <button
                            type="button"
                            onClick={() =>
                              setBuilderShuffleQuestions(
                                !builderShuffleQuestions,
                              )
                            }
                            className={`w-12 h-6.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer flex items-center shrink-0 ${
                              builderShuffleQuestions
                                ? "bg-emerald-500 justify-end"
                                : "bg-slate-300 justify-start"
                            }`}
                          >
                            <span className="w-5.5 h-5.5 rounded-full bg-white shadow-md block transition-transform"></span>
                          </button>
                        </div>
                      </div>

                      {/* 4. Timed Quiz */}
                      <div className="flex flex-col p-4 bg-slate-50/45 hover:bg-slate-50 border border-slate-150/60 rounded-2xl transition-all duration-200">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-violet-50 text-violet-600 border border-violet-100 shrink-0">
                              <Clock className="w-5.5 h-5.5" />
                            </div>
                            <div>
                              <span className="font-extrabold text-sm text-slate-850 block">
                                وقت الاختبار
                              </span>
                              <span className="text-xs text-slate-400 block mt-0.5">
                                تفعيل موقت زمني يسحب الإجابة ويقفلها مباشرة
                                بنهاية الدقائق المخصصة للاختبار.
                              </span>
                            </div>
                          </div>
                          {/* Toggle Switch */}
                          <button
                            type="button"
                            onClick={() => setBuilderIsTimed(!builderIsTimed)}
                            className={`w-12 h-6.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer flex items-center shrink-0 ${
                              builderIsTimed
                                ? "bg-violet-500 justify-end"
                                : "bg-slate-300 justify-start"
                            }`}
                          >
                            <span className="w-5.5 h-5.5 rounded-full bg-white shadow-md block transition-transform"></span>
                          </button>
                        </div>

                        {/* Inline Duration Selector */}
                        {builderIsTimed && (
                          <div className="mt-4 mr-16 p-4 bg-violet-50/35 border border-violet-100 rounded-xl max-w-sm space-y-2 animate-fadeIn">
                            <label className="text-xs font-extrabold text-violet-800 block">
                              حدد زمن الاختبار المقترح (بالدقائق):
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min={5}
                                max={180}
                                required={builderIsTimed}
                                value={builderDuration}
                                onChange={(e) =>
                                  setBuilderDuration(Number(e.target.value))
                                }
                                className="w-full bg-white border border-violet-200 focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400 rounded-xl pl-16 pr-4 py-2.5 text-xs text-slate-800 font-sans font-extrabold"
                              />
                              <span className="absolute left-4 top-2 text-[11px] font-bold text-violet-450 pt-0.5">
                                دقيقة
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 5. Set Availability Period */}
                      <div className="flex flex-col p-4 bg-slate-50/45 hover:bg-slate-50 border border-slate-150/60 rounded-2xl transition-all duration-200">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                              <Calendar className="w-5.5 h-5.5" />
                            </div>
                            <div>
                              <span className="font-extrabold text-sm text-slate-850 block">
                                تحديد فترة الإتاحة (جدولة الاختبار)
                              </span>
                              <span className="text-xs text-slate-300 block mt-0.5">
                                تحديد تواريخ وأوقات لبدء ونهاية إتاحة الرابط
                                للطلاب.
                              </span>
                            </div>
                          </div>
                          {/* Toggle Switch */}
                          <button
                            type="button"
                            onClick={() =>
                              setBuilderHasAvailability(!builderHasAvailability)
                            }
                            className={`w-12 h-6.5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer flex items-center shrink-0 ${
                              builderHasAvailability
                                ? "bg-emerald-500 justify-end"
                                : "bg-slate-300 justify-start"
                            }`}
                          >
                            <span className="w-5.5 h-5.5 rounded-full bg-white shadow-md block transition-transform"></span>
                          </button>
                        </div>
                        {/* Inline Dates Selection */}
                        {builderHasAvailability && (
                          <div className="mt-4 mr-16 p-4 bg-emerald-50/35 border border-emerald-100 rounded-xl max-w-sm space-y-2 animate-fadeIn">
                            <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                              <div className="space-y-1.5">
                                <span className="text-emerald-800 font-bold text-xs flex items-center gap-1.5">
                                  تبدأ فترة الإتاحة من تاريخ:
                                </span>
                                <input
                                  type="datetime-local"
                                  required={builderHasAvailability}
                                  value={builderAvailabilityStart}
                                  onChange={(e) =>
                                    setBuilderAvailabilityStart(e.target.value)
                                  }
                                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs text-slate-850 font-sans font-extrabold focus:outline-none focus:ring-1 focus:ring-emerald-450"
                                />
                              </div>

                              <div className="space-y-1.5">
                                <span className="text-emerald-800 font-bold text-xs flex items-center gap-1.5">
                                  تنتهي فترة الإتاحة في تاريخ:
                                </span>
                                <input
                                  type="datetime-local"
                                  required={builderHasAvailability}
                                  value={builderAvailabilityEnd}
                                  onChange={(e) =>
                                    setBuilderAvailabilityEnd(e.target.value)
                                  }
                                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs text-slate-850 font-sans font-extrabold focus:outline-none focus:ring-1 focus:ring-emerald-450"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

                {/* Action Finish Buttons */}
                <div className="flex items-center justify-between bg-white px-6 py-4 rounded-xl border border-slate-200/60 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-550 animate-pulse"></span>
                    <span className="text-[11px] text-slate-400 font-bold">
                      يتم توثيق كافة تعديلات الأسئلة والدرجات تلقائياً في
                      الإحصائيات أعلاه.
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        triggerConfirm(
                          editingQuizId ? "إلغاء التعديل" : "التخلي عن المسودة",
                          editingQuizId
                            ? "هل أنت متأكد من رغبتك في التخلي عن التعديلات الحالية والرجوع إلى لوحة التحكم؟ لن يتم حفظ هذه التغييرات."
                            : "هل أنت متأكد من رغبتك في التخلي عن المسودة الحالية والرجوع إلى لوحة التحكم؟ لن يتم حفظ أي تعديلات غير مخزنة.",
                          () => {
                            setEditingQuizId(null);
                            setActiveTab("dashboard");
                          },
                          undefined,
                          "نعم، إلغاء",
                          "مواصلة العمل",
                        );
                      }}
                      className="px-5 py-2.5 rounded-xl text-xs hover:bg-slate-100 border border-transparent text-slate-600 font-bold transition-colors cursor-pointer"
                    >
                      إلغاء التعديل
                    </button>

                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-6 py-3 rounded-xl transition-all shadow-md shadow-indigo-150 cursor-pointer"
                    >
                      {editingQuizId
                        ? "حفظ وتحديث التعديلات"
                        : "حفظ ونشر التقييم فوراً"}
                    </button>
                  </div>
                </div>
              </motion.form>
            )}

            {/* TAB 3: ANALYTICS & STUDENT LIST CONTAINER */}
            {activeTab === "analytics" && (
              <motion.div
                key="analytics-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-8"
              >
                {/* CHARTS INTEGRATED VISUAL PLACEHOLDER */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Visual Chart Card A: Progression breakdown using styled flex columns representing an SVG histogram */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:col-span-8 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-800">
                        توزيع المستويات التراكمية في الفصول الدراسية
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        إحصاء مبني على متوسط درجات الطلاب الحاليين والبالغ عددهم{" "}
                        {students.length} طالباً.
                      </p>
                    </div>

                    {/* Dynamic SVG with CSS Representation */}
                    <div className="py-6 flex items-end justify-around h-48 border-b border-slate-100">
                      {/* Bar Excellent */}
                      <div className="flex flex-col items-center gap-2 w-full max-w-20">
                        <div className="text-xs font-bold text-emerald-600 font-sans">
                          {distributionData.excellent} طلاب
                        </div>
                        <div
                          className="w-full bg-emerald-500 rounded-t-lg transition-all duration-500 hover:opacity-90 cursor-pointer"
                          style={{
                            height: `${(distributionData.excellent / Math.max(1, students.length)) * 120 + 20}px`,
                          }}
                          title="امتياز"
                        ></div>
                        <span className="text-xs font-bold text-slate-500">
                          امتياز
                        </span>
                      </div>

                      {/* Bar Good */}
                      <div className="flex flex-col items-center gap-2 w-full max-w-20">
                        <div className="text-xs font-bold text-blue-600 font-sans">
                          {distributionData.good} طلاب
                        </div>
                        <div
                          className="w-full bg-blue-500 rounded-t-lg transition-all duration-500 hover:opacity-90 cursor-pointer"
                          style={{
                            height: `${(distributionData.good / Math.max(1, students.length)) * 120 + 20}px`,
                          }}
                          title="جيد جداً"
                        ></div>
                        <span className="text-xs font-bold text-slate-500">
                          جيد جداً
                        </span>
                      </div>

                      {/* Bar Average */}
                      <div className="flex flex-col items-center gap-2 w-full max-w-20">
                        <div className="text-xs font-bold text-amber-600 font-sans">
                          {distributionData.average} طلاب
                        </div>
                        <div
                          className="w-full bg-amber-500 rounded-t-lg transition-all duration-500 hover:opacity-90 cursor-pointer"
                          style={{
                            height: `${(distributionData.average / Math.max(1, students.length)) * 120 + 20}px`,
                          }}
                          title="مقبول"
                        ></div>
                        <span className="text-xs font-bold text-slate-500">
                          مقبول
                        </span>
                      </div>

                      {/* Bar Needs Improvement */}
                      <div className="flex flex-col items-center gap-2 w-full max-w-20">
                        <div className="text-xs font-bold text-rose-600 font-sans">
                          {distributionData.needs_improvement} طلاب
                        </div>
                        <div
                          className="w-full bg-rose-500 rounded-t-lg transition-all duration-500 hover:opacity-90 cursor-pointer"
                          style={{
                            height: `${(distributionData.needs_improvement / Math.max(1, students.length)) * 120 + 20}px`,
                          }}
                          title="ضعيف"
                        ></div>
                        <span className="text-xs font-bold text-slate-500">
                          ضعيف
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>
                        * يتم احتساب المستويات تلقائياً بناءً على متوسط درجات
                        الكويزات الفردية
                      </span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>ارتفاع الأداء بنسبة 2% هذا الأسبوع</span>
                      </span>
                    </div>
                  </div>

                  {/* Visual Chart Card B: Radial Gauge of Success Ratio */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:col-span-4 flex flex-col justify-between items-center text-center">
                    <div className="w-full text-right self-start animate-none">
                      <h4 className="text-sm font-extrabold text-slate-800">
                        مؤشر النجاح العام
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        تحليل تراكمي لنسبة النجاح والتحصيل العام للطلاب.
                      </p>
                    </div>

                    <div className="relative flex items-center justify-center my-4">
                      {/* SVG Progress Circle */}
                      <svg className="w-32 h-32 transform -rotate-90">
                        <circle
                          cx="64"
                          cy="64"
                          r="50"
                          className="text-slate-100"
                          strokeWidth="10"
                          stroke="currentColor"
                          fill="transparent"
                        />
                        <circle
                          cx="64"
                          cy="64"
                          r="50"
                          className="text-indigo-600 transition-all duration-1000 ease-out"
                          strokeWidth="10"
                          strokeDasharray={2 * Math.PI * 50}
                          strokeDashoffset={
                            2 * Math.PI * 50 * (1 - stats.successRate / 100)
                          }
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="transparent"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black text-slate-800 font-sans">
                          {stats.successRate}%
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">
                          نسبة الاجتياز
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-indigo-700 bg-indigo-50/50 px-3.5 py-1.5 rounded-xl border border-indigo-100 font-black">
                      معدل الأداء متميز ومستقر
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 4: STUDENTS LIST OR RESULTS */}
            {(activeTab === "students" || activeTab === "student_results") &&
              (() => {
                const activeGrade = selectedTabGrade || "";
                const activeSemester = selectedTabSemester || "";

                // Resolve student class and filter by selected activeGrade and activeSemester
                const activeClassStudents = students.filter((student) => {
                  const sGrade =
                    student.grade ||
                    (student.gradeClass && student.gradeClass.includes(" - ")
                      ? student.gradeClass.split(" - ")[0].trim()
                      : "الصف العاشر");
                  const sSemester =
                    student.semester ||
                    (student.gradeClass && student.gradeClass.includes(" - ")
                      ? student.gradeClass.split(" - ")[1].trim()
                      : "الفصل الأول");
                  return (
                    normalizeGradeName(sGrade) ===
                      normalizeGradeName(activeGrade) &&
                    normalizeSemesterName(sSemester) ===
                      normalizeSemesterName(activeSemester)
                  );
                });

                // Apply search query only
                const queryVal = studentSearch.toLowerCase().trim();
                const filteredStudents = activeClassStudents.filter(
                  (student) => {
                    return (
                      !queryVal ||
                      student.name.toLowerCase().includes(queryVal) ||
                      student.email.toLowerCase().includes(queryVal)
                    );
                  },
                );

                // 1) Quizzes that match the grade and semester rules (both targeted and general quizzes)
                const matchingQuizzes = quizzes.filter((q) => {
                  // A quiz matches if:
                  // 1. It is explicitly assigned to this grade with q.grade matching activeGrade
                  // 2. OR it has no grade restriction (general/global quiz)
                  const isGradeMatch =
                    !q.grade ||
                    normalizeGradeName(q.grade) ===
                      normalizeGradeName(activeGrade);
                  if (!isGradeMatch) return false;

                  // If no semester is restricted, it applies to all semesters
                  if (!q.semester) return true;

                  const qSem = q.semester;
                  if (
                    qSem === "الكل" ||
                    qSem === "جميع الفصول" ||
                    qSem === "جميع فصول الصف" ||
                    qSem === "جميع الفصول والفرق المعتمدة"
                  ) {
                    return true;
                  }

                  const semestersAllowed = qSem
                    .split(",")
                    .map((s) => normalizeSemesterName(s.trim()));
                  return semestersAllowed.includes(
                    normalizeSemesterName(activeSemester),
                  );
                });

                // 2) Collect all quiz titles actually completed by the filtered students of this class
                const completedQuizTitlesByClass = new Set<string>();
                filteredStudents.forEach((student) => {
                  (student.detailedGrades || []).forEach((g) => {
                    if (g.quizTitle) {
                      completedQuizTitlesByClass.add(g.quizTitle);
                    }
                  });
                });

                // 3) Create a unified list of active quiz definitions for the headers
                const representedTitles = new Set(
                  matchingQuizzes.map((q) => q.title),
                );
                const activeClassQuizzes = [...matchingQuizzes];

                completedQuizTitlesByClass.forEach((title) => {
                  if (!representedTitles.has(title)) {
                    const existingGlobal = quizzes.find(
                      (q) => q.title === title,
                    );
                    if (existingGlobal) {
                      activeClassQuizzes.push(existingGlobal);
                    } else {
                      // Create a placeholder info for the column headers
                      activeClassQuizzes.push({
                        id: `synthesized-${title}`,
                        title: title,
                        subject: "عام",
                        durationMinutes: 0,
                        status: "closed",
                        questions: [],
                        dateCreated: "",
                        grade: activeGrade,
                        semester: activeSemester,
                      });
                    }
                  }
                });

                // Calculate active class metrics
                const classAverage =
                  activeClassStudents.length > 0
                    ? Math.round(
                        activeClassStudents.reduce(
                          (sum, s) => sum + s.averageScore,
                          0,
                        ) / activeClassStudents.length,
                      )
                    : 0;

                const excCount = activeClassStudents.filter(
                  (s) => s.status === "excellent",
                ).length;
                const needsImpCount = activeClassStudents.filter(
                  (s) => s.status === "needs_improvement",
                ).length;

                const triggerExport = async (format: "sheets" | "excel" | "csv" | "print") => {
                  if (filteredStudents.length === 0) {
                    triggerToast("⚠️ لا توجد بيانات طلاب لتصديرها حالياً في هذا الفصل.", "info");
                    return;
                  }

                  // 1. Prepare Headers
                  const headers = [
                    "اسم الطالب",
                    ...activeClassQuizzes.map((q) => {
                      const quizMaxScore =
                        q.questions && q.questions.length > 0
                          ? q.questions.reduce(
                              (sum, qn) => sum + Number(qn.points || 1),
                              0,
                            )
                          : (() => {
                              for (const s of students) {
                                const matchingGrade = (
                                  s.detailedGrades || []
                                ).find((g) => g.quizTitle === q.title);
                                if (matchingGrade) return matchingGrade.maxScore;
                              }
                              return 10;
                            })();
                      return `${q.title} (درجة: ${quizMaxScore})`;
                    }),
                    "مستوى التحصيل التراكمي (%)"
                  ];

                  // 2. Prepare Rows
                  const rows = filteredStudents.map((student) => {
                    return [
                      student.name,
                      ...activeClassQuizzes.map((q) => {
                        const gradeObj = (student.detailedGrades || []).find(
                          (g) => g.quizTitle === q.title
                        );
                        return gradeObj ? gradeObj.score : "-";
                      }),
                      `${student.averageScore}%`
                    ];
                  });

                  if (format === "sheets") {
                    await exportToGoogleSheetsDirectly(headers, rows, activeGrade, activeSemester);
                  } else if (format === "excel") {
                    try {
                      triggerToast("جاري تحضير وتحميل ملف Excel...", "info");
                      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "نتائج الطلاب");
                      XLSX.writeFile(wb, `كشف_درجات_الطلاب_${activeGrade}_${activeSemester}.xlsx`);
                      triggerToast("🎉 تم تحميل ملف Excel بنجاح!", "success");
                    } catch (error: any) {
                      console.error("Excel export error:", error);
                      triggerToast(`فشل تصدير Excel: ${error.message || error}`, "error");
                    }
                  } else if (format === "csv") {
                    try {
                      triggerToast("جاري تحضير وتحميل ملف CSV...", "info");
                      const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
                      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.setAttribute("href", url);
                      link.setAttribute("download", `كشف_درجات_الطلاب_${activeGrade}_${activeSemester}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      triggerToast("🎉 تم تحميل ملف CSV بنجاح!", "success");
                    } catch (error: any) {
                      console.error("CSV export error:", error);
                      triggerToast(`فشل تصدير CSV: ${error.message || error}`, "error");
                    }
                  } else if (format === "print") {
                    try {
                      triggerToast("جاري تجهيز كشف الدرجات للطباعة...", "info");
                      
                      const currentDate = new Date().toLocaleDateString("ar-SA");
                      const titleStr = `كشف درجات الطلاب - ${activeGrade} - ${activeSemester}`;

                      // 1. Create a style element for the print rules
                      const styleElement = document.createElement("style");
                      styleElement.id = "print-style-injection";
                      styleElement.innerHTML = `
                        @media screen {
                          #print-root {
                            display: none !important;
                          }
                        }
                        @media print {
                          /* Hide all existing elements in body */
                          body > *:not(#print-root) {
                            display: none !important;
                          }
                          #root {
                            display: none !important;
                          }
                          .toast-container, [role="status"], .radix-portal, [data-radix-portal] {
                            display: none !important;
                          }
                          html, body {
                            background-color: #ffffff !important;
                            background: #ffffff !important;
                            color: #1e293b !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            width: 100% !important;
                            height: auto !important;
                            min-height: auto !important;
                            overflow: visible !important;
                            overflow-x: visible !important;
                            overflow-y: visible !important;
                            position: static !important;
                            font-family: 'Cairo', sans-serif !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                          }
                          #print-root {
                            display: block !important;
                            visibility: visible !important;
                            width: 100% !important;
                            height: auto !important;
                            min-height: auto !important;
                            overflow: visible !important;
                            position: relative !important;
                            direction: rtl !important;
                            padding: 15px !important;
                            background-color: #ffffff !important;
                          }
                          @page {
                            size: A4 landscape;
                            margin: 12mm 15mm;
                          }
                          .header-table {
                            width: 100%;
                            margin-bottom: 25px;
                            border-collapse: collapse;
                          }
                          .header-table td {
                            border: none;
                            padding: 4px;
                          }
                          .header-title {
                            text-align: center;
                            font-size: 18px;
                            font-weight: 800;
                            color: #0f172a;
                            margin: 10px 0;
                          }
                          .meta-grid {
                            display: grid;
                            grid-template-columns: repeat(4, 1fr);
                            gap: 15px;
                            background-color: #f8fafc !important;
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            padding: 12px 15px;
                            margin-bottom: 20px;
                          }
                          .meta-item {
                            font-weight: 600;
                          }
                          .meta-item span {
                            font-weight: 400;
                            color: #64748b;
                          }
                          .data-table {
                            width: 100% !important;
                            border-collapse: collapse !important;
                            margin-bottom: 30px !important;
                            page-break-inside: auto !important;
                          }
                          .data-table th, .data-table td {
                            border: 1px solid #94a3b8 !important;
                            padding: 8px 10px !important;
                            text-align: center !important;
                          }
                          .data-table th {
                            background-color: #f1f5f9 !important;
                            color: #0f172a !important;
                            font-weight: 700 !important;
                            font-size: 11px !important;
                          }
                          .data-table td:first-child {
                            text-align: right !important;
                            font-weight: 600 !important;
                            background-color: #f8fafc !important;
                          }
                          .data-table tr {
                            page-break-inside: avoid !important;
                            page-break-after: auto !important;
                            break-inside: avoid !important;
                          }
                          .data-table tr:nth-child(even) {
                            background-color: #fdfdfd !important;
                          }
                          .data-table thead {
                            display: table-header-group !important;
                          }
                          .footer-signatures {
                            margin-top: 50px;
                            display: flex;
                            justify-content: space-between;
                            padding: 0 40px;
                            page-break-inside: avoid !important;
                            break-inside: avoid !important;
                          }
                          .signature-box {
                            text-align: center;
                            width: 180px;
                          }
                          .signature-line {
                            margin-top: 40px;
                            border-top: 1px dashed #94a3b8;
                          }
                        }
                      `;
                      document.head.appendChild(styleElement);

                      // 2. Create the element that will contain the printable kashf
                      const printRoot = document.createElement("div");
                      printRoot.id = "print-root";
                      printRoot.dir = "rtl";

                      printRoot.innerHTML = `
                        <div style="direction: rtl; font-family: 'Cairo', sans-serif;">
                          <table class="header-table">
                            <tr>
                              <td style="width: 33%; text-align: right; line-height: 1.6; font-size: 11px;">
                                <strong>المملكة العربية السعودية</strong><br>
                                <strong>وزارة التعليم</strong><br>
                                <strong>منصة رصد الدرجات الذكية</strong>
                              </td>
                              <td style="width: 34%; text-align: center; vertical-align: middle;">
                                <div class="header-title">كشف رصد درجات الطلاب التراكمي</div>
                              </td>
                              <td style="width: 33%; text-align: left; font-size: 10px; color: #475569; line-height: 1.6;">
                                التاريخ: ${currentDate}<br>
                                الصفحة: 1 من 1
                              </td>
                            </tr>
                          </table>

                          <div class="meta-grid">
                            <div class="meta-item">الصف الدراسي: <span>${activeGrade}</span></div>
                            <div class="meta-item">الفصل الدراسي: <span>${activeSemester}</span></div>
                            <div class="meta-item">المادة: <span>التربية الإسلامية واللغة العربية</span></div>
                            <div class="meta-item">عدد الطلاب: <span>${filteredStudents.length} طالب</span></div>
                          </div>

                          <table class="data-table">
                            <thead>
                              <tr>
                                ${headers.map(h => `<th>${h}</th>`).join("")}
                              </tr>
                            </thead>
                            <tbody>
                              ${rows.map(row => `
                                <tr>
                                  ${row.map((cell, idx) => {
                                    if (idx === row.length - 1) {
                                      return `<td style="font-weight: bold; background-color: #f0fdf4 !important; color: #166534 !important;">${cell}</td>`;
                                    }
                                    return `<td>${cell}</td>`;
                                  }).join("")}
                                </tr>
                              `).join("")}
                            </tbody>
                          </table>

                          <div class="footer-signatures">
                            <div class="signature-box">
                              <strong>معلم المادة</strong>
                              <div class="signature-line"></div>
                            </div>
                            <div class="signature-box">
                              <strong>المشرف التربوي</strong>
                              <div class="signature-line"></div>
                            </div>
                            <div class="signature-box">
                              <strong>مدير / قائد المدرسة</strong>
                              <div class="signature-line"></div>
                            </div>
                          </div>
                        </div>
                      `;
                      document.body.appendChild(printRoot);

                      // 3. Confirm element is added and fully loaded in DOM before printing
                      const originalTitle = document.title;
                      document.title = titleStr;

                      const checkAndPrint = () => {
                        const element = document.getElementById("print-root");
                        if (element && element.offsetHeight > 0) {
                          // Element is in DOM and has height (layout completed)
                          window.focus();
                          window.print();
                          
                          // Clean up after print dialog closes
                          setTimeout(() => {
                            try {
                              document.title = originalTitle;
                              const sty = document.getElementById("print-style-injection");
                              if (sty) sty.remove();
                              const root = document.getElementById("print-root");
                              if (root) root.remove();
                            } catch (ex) {
                              console.error("Clean up error", ex);
                            }
                          }, 1500);
                        } else {
                          // Try again in next frame
                          requestAnimationFrame(checkAndPrint);
                        }
                      };
                      
                      // Wait for animation frames to ensure style and DOM are painted
                      requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                          checkAndPrint();
                        });
                      });

                    } catch (error: any) {
                      console.error("PDF/Print error:", error);
                      triggerToast("حدث خطأ أثناء طباعة الملف. سنحاول طباعة الصفحة مباشرة.", "info");
                      window.print();
                    }
                  }
                };

                return (
                  <motion.div
                    key={
                      activeTab === "students" ? "students-tab" : "results-tab"
                    }
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6 text-right"
                  >
                    {/* TWO-STEP SELECTION FLOW - CARD CHIPS EXACTLY LIKE THE REQUESTED IMAGE */}
                    <div className="bg-slate-50 rounded-2xl p-4 md:p-5 flex flex-col gap-4 border border-slate-200 shadow-3xs select-none font-sans w-full">
                      {/* Top Header Row with Title and Manage/Edit Button (Shown only in Students management tab) */}
                      {activeTab === "students" && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full border-b border-slate-200/60 pb-3">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-indigo-600" />
                            <span className="text-xs font-black text-slate-700">تحديد الصف والفصل الدراسي:</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              ensureSeededGradesAndSemesters();
                              setSelectedManageGrade(null);
                              setSelectedSemesterNumbers([]);
                              setNewGradeInput("");
                              setShowGradesSemestersModal(true);
                            }}
                            className="px-3.5 py-2 flex items-center gap-2 rounded-xl text-white bg-amber-500 hover:bg-amber-600 border border-amber-400 hover:border-amber-500 active:scale-95 transition-all duration-200 cursor-pointer shadow-sm shadow-amber-200 shrink-0 text-xs font-black"
                            title="إضافة / تعديل الصفوف والفصول"
                            id="manage-semesters-top-btn"
                          >
                            <Settings className="w-3.5 h-3.5 md:w-4 md:h-4 text-white animate-spin-hover" />
                            <span>إضافة / تعديل الصفوف والفصول</span>
                          </button>
                        </div>
                      )}

                      {/* First row: Grade selection */}
                      <div className="flex flex-wrap justify-center items-center gap-2.5 w-full">
                        {gradesList.length === 0 ? (
                          <div className="text-center py-4 px-2">
                            <p className="text-xs text-slate-500 font-extrabold font-sans">
                              لا يوجد أي صفوف مضافة حالياً في كشفك. يرجى البدء بالضغط على زر "إضافة / تعديل الفصول" الذهبي بالأعلى لإضافة صفوف وفصول كشفك الخاص والبدء بتسجيل الطلاب.
                            </p>
                          </div>
                        ) : (
                          gradesList.map((g, idx) => {
                            const isGradeSelected = selectedTabGrade === g;
                            const gradeCount = getStudentsCountForGrade(g);
                            // Clean display name of grade to match the user's uploaded image ("الاول", "الثاني", "الثالث")
                            const getDisplayName = (gradeStr: string) => {
                              return gradeStr;
                            };

                            // Helper to get grade icon for RTL (on the right)
                            const getGradeIcon = (
                              gradeStr: string,
                              active: boolean,
                            ) => {
                              const iconClass = `w-4 h-4 shrink-0 transition-colors ${active ? "text-white" : "text-indigo-600"}`;
                              if (
                                gradeStr.includes("الأول") ||
                                gradeStr.includes("الاول")
                              )
                                return <BookOpen className={iconClass} />;
                              if (gradeStr.includes("الثاني"))
                                return <Layers className={iconClass} />;
                              if (gradeStr.includes("الثالث"))
                                return <Award className={iconClass} />;
                              return <GraduationCap className={iconClass} />;
                            };

                            return (
                              <button
                                key={g}
                                type="button"
                                onClick={() => {
                                  if (isGradeSelected) {
                                    setSelectedTabGrade(null);
                                    setSelectedTabSemester(null);
                                  } else {
                                    setSelectedTabGrade(g);
                                    setSelectedTabSemester(null); // Reset semester when changing grade
                                  }
                                }}
                                className={`flex flex-col rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer min-w-[125px] ${
                                  isGradeSelected
                                    ? "border-[#5352ed] shadow-md shadow-[#5352ed]/20 transform scale-[1.01]"
                                    : "border-slate-200 hover:border-indigo-400 bg-white shadow-3xs"
                                }`}
                              >
                                {/* Top Section: Grade Name & Icon */}
                                <div
                                  className={`px-3 py-2 flex items-center justify-between gap-2 font-black text-xs sm:text-sm ${
                                    isGradeSelected
                                      ? "bg-[#5352ed] text-white"
                                      : "bg-white text-slate-800"
                                  }`}
                                >
                                  {/* Right icon */}
                                  {getGradeIcon(g, isGradeSelected)}

                                  {/* Text label */}
                                  <span className="flex-1 text-center font-black">
                                    {getDisplayName(g)}
                                  </span>

                                  {/* Left check icon */}
                                  <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                                    {isGradeSelected && (
                                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                    )}
                                  </div>
                                </div>

                                {/* Bottom Section: Unified Student count inside same card button */}
                                <div className="px-2 py-1 bg-rose-50/80 border-t border-rose-100/80 flex items-center justify-center gap-1 text-center">
                                  <span className="text-xs font-black text-rose-600 leading-none">{gradeCount}</span>
                                  <span className="text-[10px] font-bold text-rose-500">طالب</span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* Second row: Classes/Sections selection as modern squarish buttons 1, 2, 3... */}
                      {selectedTabGrade && (
                        <div className="flex flex-wrap justify-center items-center gap-2.5 sm:gap-3 pt-2 border-t border-slate-200/50 w-full max-w-md">
                          {semestersList.map((s, idx) => {
                            const isSemSelected = selectedTabSemester === s;
                            // Map semester string to clean short numeric representations like 1, 2, 3...
                            const getSemesterNumber = (
                              semesterStr: string,
                              index: number,
                            ) => {
                              const match = semesterStr.match(/\d+/);
                              if (match) return match[0];

                              if (
                                semesterStr.includes("الأول") ||
                                semesterStr.includes("الاول") ||
                                semesterStr === "1"
                              )
                                return "1";
                              if (
                                semesterStr.includes("الثاني") ||
                                semesterStr === "2"
                              )
                                return "2";
                              if (
                                semesterStr.includes("الثالث") ||
                                semesterStr === "3"
                              )
                                return "3";
                              if (
                                semesterStr.includes("الرابع") ||
                                semesterStr === "4"
                              )
                                return "4";
                              if (
                                semesterStr.includes("الخامس") ||
                                semesterStr === "5"
                              )
                                return "5";
                              if (
                                semesterStr.includes("السادس") ||
                                semesterStr === "6"
                              )
                                return "6";
                              return String(index + 1);
                            };
                            const semesterNum = getSemesterNumber(s, idx);
                            const semCount = getStudentsCountForSemester(selectedTabGrade, s);

                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => {
                                  setSelectedTabSemester(
                                    isSemSelected ? null : s,
                                  );
                                }}
                                className={`flex flex-col rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer min-w-[50px] sm:min-w-[58px] ${
                                  isSemSelected
                                    ? "border-[#5352ed] shadow-md shadow-[#5352ed]/20 transform scale-105"
                                    : "border-indigo-200 hover:border-indigo-400 bg-white shadow-3xs"
                                }`}
                                title={`${s} - (${semCount} طالب)`}
                              >
                                {/* Top Section: Class number and check/plus */}
                                <div
                                  className={`px-3 py-1.5 flex items-center justify-center gap-1 text-sm sm:text-base font-black font-sans ${
                                    isSemSelected
                                      ? "bg-[#5352ed] text-white"
                                      : "bg-white text-[#5352ed] hover:bg-slate-50"
                                  }`}
                                >
                                  <span>{semesterNum}</span>
                                  {isSemSelected && (
                                    <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                  )}
                                </div>

                                {/* Bottom Section: Unified Student count inside same card button */}
                                <div className="px-1 py-1 bg-rose-50/80 border-t border-rose-100/80 flex flex-col items-center justify-center leading-tight">
                                  <span className="text-xs font-black text-rose-600 leading-none">
                                    {semCount}
                                  </span>
                                  <span className="text-[10px] font-bold text-rose-500 mt-0.5">
                                    طالب
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* DETAILED STUDENT ROSTER FOR THE SELECTED COMBINATION */}
                    {selectedTabGrade && selectedTabSemester ? (
                      <div className="bg-white rounded-3xl border border-slate-200/85 overflow-hidden shadow-sm">
                        {/* Subsection Header */}
                        <div className="bg-slate-50/60 py-5 px-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right">
                          <div className="flex items-center gap-3 justify-start">
                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 shadow-3xs">
                              {activeTab === "students" ? (
                                <Users className="w-5 h-5" />
                              ) : (
                                <Award className="w-5 h-5 text-amber-500" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-slate-800 text-sm">
                                {activeTab === "students"
                                  ? "كشف طلاب:"
                                  : "كشف نتائج طلاب:"}{" "}
                                <span className="text-indigo-700 font-black">
                                  {selectedTabGrade}
                                </span>{" "}
                                -{" "}
                                <span className="text-indigo-700 font-black">
                                  {selectedTabSemester}
                                </span>
                              </h4>
                              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                                {activeTab === "students"
                                  ? "تصفح كشف الطلاب، تفاصيل التحصيل، والتحكم في إضافة الطلاب أو السجلات."
                                  : "استعراض مستمر لمستويات التقدم والتحصيل العام ونسب النجاح."}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto self-end md:self-auto font-sans justify-end">
                            {/* Search bar specifically for this list */}
                            <div className="relative font-sans flex-1 md:flex-initial">
                              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
                              <input
                                type="text"
                                placeholder="ابحث باسم الطالب أو البريد..."
                                value={studentSearch}
                                onChange={(e) =>
                                  setStudentSearch(e.target.value)
                                }
                                className="bg-white border border-slate-200 text-xs rounded-xl pl-3 pr-9 py-2 shrink-0 w-full md:w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                              />
                            </div>

                            {/* Action buttons */}
                            {activeTab === "students" && (
                              <>
                                {trashStudents.length > 0 && (
                                  <button
                                    onClick={() => setShowTrashModal(true)}
                                    className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-extrabold text-xs px-3.5 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-3xs active:scale-95"
                                    title="فتح سلة المحذوفات واسترجاع الطلاب"
                                  >
                                    <Trash2 className="w-4 h-4 text-amber-600 pointer-events-none" />
                                    <span>سلة المحذوفات ({trashStudents.length})</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setNewStudentGrade(selectedTabGrade);
                                    setNewStudentSemester(selectedTabSemester);
                                    setShowAddStudentModal((prev) => !prev);
                                  }}
                                  className={`font-bold text-xs px-4 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-2 shadow-sm cursor-pointer ${
                                    showAddStudentModal
                                      ? "bg-slate-800 hover:bg-slate-900 text-white shadow-slate-200"
                                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-150"
                                  }`}
                                >
                                  {showAddStudentModal ? (
                                    <X className="w-4 h-4" />
                                  ) : (
                                    <Plus className="w-4 h-4" />
                                  )}
                                  <span>
                                    {showAddStudentModal
                                      ? "إغلاق نموذج الإضافة"
                                      : "إضافة طالب / طلاب للفصل"}
                                  </span>
                                </button>
                              </>
                            )}

                            {activeTab === "student_results" && (
                              <div className="flex flex-wrap items-center gap-2 font-sans">
                                <button
                                  type="button"
                                  onClick={() => triggerExport("sheets")}
                                  className="bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 text-emerald-800 font-extrabold text-[11px] px-3 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-3xs active:scale-95"
                                  title="تصدير النتائج إلى جداول بيانات Google Sheets"
                                >
                                  <Layers className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>تصدير Google Sheets</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => triggerExport("excel")}
                                  className="bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200/80 text-indigo-800 font-extrabold text-[11px] px-3 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-3xs active:scale-95"
                                  title="تحميل النتائج كملف Excel XLSX"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span>تحميل Excel (XLSX)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => triggerExport("csv")}
                                  className="bg-blue-50 hover:bg-blue-100/80 border border-blue-200/80 text-blue-800 font-extrabold text-[11px] px-3 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-3xs active:scale-95"
                                  title="تحميل النتائج كملف CSV"
                                >
                                  <Download className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span>تحميل كملف CSV</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => triggerExport("print")}
                                  className="bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 text-rose-800 font-extrabold text-[11px] px-3 py-2 rounded-xl transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-3xs active:scale-95"
                                  title="طباعة كشف الدرجات أو حفظه بصيغة PDF"
                                >
                                  <Printer className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                  <span>طباعة / حفظ PDF</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* INLINE ADD STUDENT FORM PANEL (Opens in the same page) */}
                        <AnimatePresence>
                          {showAddStudentModal && (
                            <motion.form
                              onSubmit={handleAddStudent}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="border-b border-indigo-100 bg-gradient-to-b from-indigo-50/80 via-indigo-50/40 to-white p-5 sm:p-6 text-right overflow-hidden shadow-inner"
                            >
                              <div className="max-w-3xl mx-auto space-y-4">
                                {/* Form Top Header */}
                                <div className="flex justify-between items-center pb-3 border-b border-indigo-100/80">
                                  <div>
                                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                                      <span>
                                        إضافة طالب أو مجموعة طلاب (يمكن نسخ ولصق مجموعة من الأسماء من ملف إكسل)
                                      </span>
                                    </h4>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      سجل الطلاب مباشرة دون مغادرة كشف الفصل الدراسي.
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setShowAddStudentModal(false)}
                                    className="p-1.5 hover:bg-slate-200/70 rounded-full transition-colors text-slate-400 cursor-pointer"
                                    title="إغلاق نموذج الإضافة"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>

                                {/* Direct Student Names / Excel Paste Input */}
                                <div className="space-y-2">
                                  <label className="text-slate-700 font-bold text-xs block">
                                    أدخل أو انسخ أسماء الطلاب
                                  </label>
                                  <p className="text-[11px] text-slate-500 bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-100 font-sans leading-relaxed">
                                    💡 يمكنك نسخ عمود الأسماء من ملف Excel ولصقها هنا مباشرة، أو كتابة الأسماء بمعدل اسم واحد في كل سطر.
                                  </p>
                                  <textarea
                                    rows={5}
                                    required
                                    id="bulk-paste-textarea"
                                    placeholder="أدخل الأسماء هنا، اسم في كل سطر:&#10;خالد محمد العتيبي&#10;سلطان عبد الله الشمري&#10;سارة فهد السديري"
                                    value={bulkPasteText}
                                    onChange={(e) =>
                                      setBulkPasteText(e.target.value)
                                    }
                                    className="w-full bg-white border-2 border-emerald-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all font-sans leading-relaxed text-right shadow-xs"
                                  />
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-2 flex justify-end gap-2 border-t border-indigo-100/80">
                                  <button
                                    type="button"
                                    onClick={() => setShowAddStudentModal(false)}
                                    className="px-4 py-2 hover:bg-slate-200/80 rounded-xl text-xs font-bold text-slate-600 transition-colors cursor-pointer"
                                  >
                                    إلغاء الأمر
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={isAddingStudent}
                                    id="submit-student-button"
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                                  >
                                    {isAddingStudent ? (
                                      <>
                                        <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full"></span>
                                        جاري الإضافة والتسجيل...
                                      </>
                                    ) : (
                                      "حفظ وتسجيل الطلاب"
                                    )}
                                  </button>
                                </div>
                              </div>
                            </motion.form>
                          )}
                        </AnimatePresence>

                        {/* Class Stats Summary Indicator */}
                        {activeClassStudents.length > 0 && (
                          <div className="bg-indigo-50/30 px-6 py-3 border-b border-slate-100 flex flex-wrap gap-6 items-center select-none text-right justify-start">
                            <div className="text-xs text-slate-500 font-bold">
                              عدد طلاب هذا الفصل:{" "}
                              <span className="text-slate-800 font-sans font-extrabold">
                                {activeClassStudents.length}
                              </span>
                            </div>
                            {activeTab === "student_results" && (
                              <>
                                <div className="text-xs text-slate-500 font-bold font-sans">
                                  معدل التحصيل النمائي:{" "}
                                  <span className="text-indigo-600 font-sans font-black">
                                    {classAverage}%
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  الامتياز:{" "}
                                  <span className="text-emerald-600 font-sans font-extrabold">
                                    {excCount}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 font-bold flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  بحاجة لمتابعة:{" "}
                                  <span className="text-rose-600 font-sans font-extrabold">
                                    {needsImpCount}
                                  </span>
                                </div>
                              </>
                            )}
                            {/* Bulk Delete option */}
                            {activeTab === "students" &&
                              (() => {
                                const selectedCount = filteredStudents.filter(
                                  (s) => selectedDeleteStudentIds[s.id],
                                ).length;
                                if (selectedCount === 0) return null;
                                return (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleBulkDeleteStudents(
                                        filteredStudents
                                          .filter(
                                            (s) =>
                                              selectedDeleteStudentIds[s.id],
                                          )
                                          .map((s) => s.id),
                                      )
                                    }
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] px-3 py-1.5 rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-xs cursor-pointer mr-auto"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 animate-pulse" />
                                    <span>
                                      حذف الطلاب المحددين ({selectedCount})
                                    </span>
                                  </button>
                                );
                              })()}
                          </div>
                        )}

                        {/* Roster list */}
                        {filteredStudents.length === 0 ? (
                          <div className="p-12 text-center">
                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-100">
                              <Users className="w-5 h-5 text-slate-400 animate-none mx-auto" />
                            </div>
                            <h5 className="font-extrabold text-sm text-slate-700">
                              لا يوجد سجلات في هذا التقسيم
                            </h5>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                              {activeClassStudents.length === 0
                                ? `لم يتم تسجيل أي طلاب في ${selectedTabGrade} (${selectedTabSemester}) حتى الآن.`
                                : "لا يوجد نتائج مطابقة لكلمة البحث الحالية."}
                            </p>
                            {activeClassStudents.length === 0 &&
                              activeTab === "students" && (
                                <button
                                  onClick={() => {
                                    setNewStudentGrade(selectedTabGrade);
                                    setNewStudentSemester(selectedTabSemester);
                                    setShowAddStudentModal(true);
                                  }}
                                  className="mt-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
                                >
                                  تسجيل أول طالب الآن
                                </button>
                              )}
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-2xs">
                            <table className="w-full text-right border-collapse text-[13px]">
                              <thead>
                                {activeTab === "students" ? (
                                  <tr className="bg-slate-100 text-slate-600 font-bold select-none divide-x divide-x-reverse divide-slate-200">
                                    <th className="py-2 px-3 border border-slate-200 w-12 text-center font-mono bg-slate-150">
                                      #
                                    </th>
                                    <th className="py-2 px-3 border border-slate-200 min-w-[220px]">
                                      اسم الطالب
                                    </th>
                                    <th className="py-2 px-3 border border-slate-200 text-center">
                                      الصف
                                    </th>
                                    <th className="py-2 px-3 border border-slate-200 text-center">
                                      الفصل
                                    </th>
                                    <th className="py-2 px-3 border border-slate-200 text-center w-52 min-w-[210px] bg-slate-100">
                                      <div className="flex flex-col items-center justify-center gap-2 mx-auto">
                                        <div className="flex items-center justify-center gap-1.5">
                                          <input
                                            type="checkbox"
                                            id="globalPasswordRequired"
                                            className="rounded border-slate-300 text-indigo-605 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                                            checked={isPasswordRequiredGlobal}
                                            onChange={(e) =>
                                              handleTogglePasswordRequired(
                                                e.target.checked,
                                              )
                                            }
                                          />
                                          <label
                                            htmlFor="globalPasswordRequired"
                                            className="text-slate-750 font-black text-xs cursor-pointer select-none"
                                          >
                                            كلمة المرور (مطلوبة)
                                          </label>
                                        </div>
                                        <div className="relative group cursor-pointer w-full max-w-[190px]">
                                          <p className="text-[10px] text-indigo-800 font-medium leading-tight bg-indigo-50/90 hover:bg-indigo-100 border border-indigo-200/80 px-2 py-1 rounded-md text-center transition-all duration-200 group-hover:shadow-sm group-hover:border-indigo-400 group-hover:text-indigo-950">
                                            💡 ملاحظة: بعد تفعيل كلمة المرور لأول مرة، سوف يتم مطالبة الطالب بإنشاء كلمة المرور لأول مرة عند تسجيل دخوله.
                                          </p>
                                          {/* Hover Floating Window / Popup */}
                                          <div className="pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 ease-out absolute top-full right-1/2 translate-x-1/2 mt-2 w-72 p-3.5 bg-slate-900/95 text-white text-xs font-medium rounded-2xl shadow-2xl backdrop-blur-md z-50 border border-slate-700/80 text-right leading-relaxed">
                                            <div className="flex items-start gap-2.5">
                                              <span className="text-xl shrink-0">💡</span>
                                              <div className="space-y-1">
                                                <span className="font-extrabold text-amber-300 block text-xs">
                                                  ملاحظة مهمة حول كلمة المرور
                                                </span>
                                                <p className="text-slate-200 text-xs font-normal leading-relaxed">
                                                  بعد تفعيل كلمة المرور لأول مرة، سوف يتم مطالبة الطالب بإنشاء كلمة المرور لأول مرة عند أول تسجيل دخول له إلى المنصة.
                                                </p>
                                              </div>
                                            </div>
                                            <div className="absolute bottom-full right-1/2 translate-x-1/2 -mb-1 border-4 border-transparent border-b-slate-900/95"></div>
                                          </div>
                                        </div>
                                        <div className="flex flex-col gap-1 w-full max-w-[190px]">
                                          <button
                                            type="button"
                                            disabled={passwordGenProgress.active}
                                            onClick={handleAutoGeneratePasswords}
                                            className={`w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-black rounded-lg border transition-all cursor-pointer shadow-3xs ${
                                              passwordGenProgress.active
                                                ? "bg-amber-50 text-amber-800 border-amber-200 cursor-not-allowed"
                                                : "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                                            }`}
                                            title={
                                              passwordGenProgress.active
                                                ? `جاري إنشاء كلمات المرور للطلاب (${passwordGenProgress.current} من ${passwordGenProgress.total})`
                                                : "توليد تلقائي لكلمات مرور سهلة لجميع الطلاب"
                                            }
                                          >
                                            {passwordGenProgress.active ? (
                                              <>
                                                <span className="w-2.5 h-2.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin shrink-0"></span>
                                                <span className="animate-pulse">جاري الإنشاء ({passwordGenProgress.current}/{passwordGenProgress.total})</span>
                                              </>
                                            ) : (
                                              <>
                                                <Sparkles className="w-3 h-3 text-blue-500 shrink-0 animate-pulse" />
                                                <span>توليد تلقائي سهل 🔑</span>
                                              </>
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={handleClearAllPasswords}
                                            className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-black bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 transition-all cursor-pointer shadow-3xs"
                                            title="مسح كلمات مرور جميع الطلاب بالجدول"
                                          >
                                            <Eraser className="w-3 h-3 text-rose-500 shrink-0" />
                                            <span>مسح جميع الكلمات</span>
                                          </button>
                                        </div>
                                      </div>
                                    </th>
                                    <th className="py-2 px-3 border border-slate-200 text-center w-28">
                                      <div className="flex items-center justify-center gap-1.5 mx-auto">
                                        <input
                                          type="checkbox"
                                          className="rounded border-slate-305 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                                          checked={
                                            filteredStudents.length > 0 &&
                                            filteredStudents.every(
                                              (s) =>
                                                selectedDeleteStudentIds[s.id],
                                            )
                                          }
                                          onChange={(e) => {
                                            const checked = e.target.checked;
                                            setSelectedDeleteStudentIds(
                                              (prev) => {
                                                const copy = { ...prev };
                                                filteredStudents.forEach(
                                                  (s) => {
                                                    copy[s.id] = checked;
                                                  },
                                                );
                                                return copy;
                                              },
                                            );
                                          }}
                                          title={
                                            filteredStudents.every(
                                              (s) =>
                                                selectedDeleteStudentIds[s.id],
                                            )
                                              ? "إلغاء تحديد الكل"
                                              : "تحديد الكل للحذف"
                                          }
                                        />
                                        <span>التحكم</span>
                                      </div>
                                    </th>
                                  </tr>
                                ) : (
                                  <tr className="bg-slate-100 text-slate-600 font-bold select-none divide-x divide-x-reverse divide-slate-200">
                                    <th className="py-2 px-3 border border-slate-200 w-12 text-center font-mono bg-slate-150">
                                      #
                                    </th>
                                    <th className="py-2 px-3 border border-slate-200 min-w-[220px]">
                                      اسم الطالب
                                    </th>
                                    {activeClassQuizzes.map((q) => {
                                      const quizMaxScore =
                                        q.questions && q.questions.length > 0
                                          ? q.questions.reduce(
                                              (sum, qn) =>
                                                sum + Number(qn.points || 1),
                                              0,
                                            )
                                          : (() => {
                                              for (const s of students) {
                                                const matchingGrade = (
                                                  s.detailedGrades || []
                                                ).find(
                                                  (g) =>
                                                    g.quizTitle === q.title,
                                                );
                                                if (matchingGrade)
                                                  return matchingGrade.maxScore;
                                              }
                                              return 10;
                                            })();

                                      return (
                                        <th
                                          key={q.id}
                                          className="py-2 px-3 border border-slate-200 text-center text-[11px] font-black text-indigo-950 bg-indigo-50/60 min-w-[110px]"
                                        >
                                          <div
                                            className="line-clamp-2 max-w-[140px] mx-auto text-slate-700 font-bold text-[10px] sm:text-[11px] leading-tight"
                                            title={q.title}
                                          >
                                            {q.title}
                                          </div>
                                          <span className="text-[9px] text-indigo-600 block mt-0.5 font-bold font-sans opacity-80">
                                            (درجة: {quizMaxScore})
                                          </span>
                                        </th>
                                      );
                                    })}
                                    <th className="py-2 px-3 border border-slate-200">
                                      مستوى التحصيل التراكمي
                                    </th>
                                    <th className="py-2 px-3 border border-slate-200 text-center w-24">
                                      كشف الإجراءات
                                    </th>
                                  </tr>
                                )}
                              </thead>
                              <tbody>
                                {filteredStudents.map((student, idx) => (
                                  <tr
                                    key={student.id}
                                    className="hover:bg-slate-50/50 transition-colors"
                                  >
                                    {/* Serial number style like Excel row index */}
                                    <td className="py-1.5 px-3 border border-slate-200 text-center font-mono font-bold text-slate-400 bg-slate-50 w-12 select-none">
                                      {idx + 1}
                                    </td>

                                    {/* Name without bloated avatar - simple, clean, and professional */}
                                    <td className="py-1.5 px-3 border border-slate-200 font-extrabold text-slate-800">
                                      <span
                                        onClick={() => {
                                          if (activeTab === "student_results")
                                            setSelectedStudent(student);
                                        }}
                                        className={
                                          activeTab === "student_results"
                                            ? "hover:text-indigo-600 hover:underline cursor-pointer transition-colors"
                                            : ""
                                        }
                                      >
                                        {student.name}
                                      </span>
                                    </td>

                                    {activeTab === "students" ? (
                                      <>
                                        {/* Grade */}
                                        <td className="py-1.5 px-3 border border-slate-200 text-slate-600 font-semibold font-sans text-center">
                                          {student.grade || selectedTabGrade}
                                        </td>

                                        {/* Semester */}
                                        <td className="py-1.5 px-3 border border-slate-200 text-slate-600 font-semibold font-sans text-center">
                                          {student.semester ||
                                            selectedTabSemester}
                                        </td>

                                        {/* Password */}
                                        <td className="py-1.5 px-3 border border-slate-200 text-center w-48 bg-slate-50/30">
                                          <div className="flex items-center justify-center gap-1 max-w-[170px] mx-auto">
                                            <div className="relative w-full">
                                              <input
                                                type="text"
                                                pattern="[0-9]*"
                                                maxLength={10}
                                                placeholder="أرقام فقط"
                                                value={student.password || ""}
                                                onChange={async (e) => {
                                                  const val =
                                                    e.target.value.replace(
                                                      /[^0-9]/g,
                                                      "",
                                                    );
                                                  setStudents((prev) =>
                                                    prev.map((s) =>
                                                      s.id === student.id
                                                        ? { ...s, password: val }
                                                        : s,
                                                    ),
                                                  );
                                                  try {
                                                    const studentRef = doc(
                                                      db,
                                                      "students",
                                                      student.id,
                                                    );
                                                    await updateDoc(studentRef, {
                                                      password: val,
                                                    });
                                                  } catch (err) {
                                                    console.error(
                                                      "Error updating student password",
                                                      student.id,
                                                      err,
                                                    );
                                                  }
                                                }}
                                                className="w-full bg-white hover:bg-slate-50 focus:bg-white border-2 border-slate-200 focus:border-blue-400 rounded-xl pl-8 pr-3 py-1.5 text-xs text-center font-mono focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all font-black text-slate-800"
                                              />
                                              <button
                                                type="button"
                                                onClick={async () => {
                                                  const easyPatterns = [
                                                    "1234", "1122", "2233", "3344", "4455", "5566", "6677", "7788", "8899",
                                                    "1111", "2222", "3333", "4444", "5555", "1212", "2323", "3434", "4545",
                                                    "1357", "2468", "9876", "4321"
                                                  ];
                                                  const randPattern = easyPatterns[Math.floor(Math.random() * easyPatterns.length)];
                                                  setStudents((prev) =>
                                                    prev.map((s) =>
                                                      s.id === student.id
                                                        ? { ...s, password: randPattern }
                                                        : s,
                                                    ),
                                                  );
                                                  try {
                                                    const studentRef = doc(
                                                      db,
                                                      "students",
                                                      student.id,
                                                    );
                                                    await updateDoc(studentRef, {
                                                      password: randPattern,
                                                    });
                                                    triggerToast(`تم توليد كلمة مرور سهلة للطالب: ${randPattern} 🔑`, "success");
                                                  } catch (err) {
                                                    console.error(
                                                      "Error generating student password",
                                                      student.id,
                                                      err,
                                                    );
                                                  }
                                                }}
                                                className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg cursor-pointer transition-all duration-200"
                                                title="توليد تلقائي لكلمة مرور سهلة ونمط بسيط"
                                              >
                                                <Key className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="py-1.5 px-3 border border-slate-200 text-center">
                                          <div className="flex justify-center items-center gap-2">
                                            <input
                                              type="checkbox"
                                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                                              checked={
                                                !!selectedDeleteStudentIds[
                                                  student.id
                                                ]
                                              }
                                              onChange={(e) => {
                                                setSelectedDeleteStudentIds(
                                                  (prev) => ({
                                                    ...prev,
                                                    [student.id]:
                                                      e.target.checked,
                                                  }),
                                                );
                                              }}
                                              title="تحديد الطالب للحذف"
                                            />
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleDeleteStudent(student.id)
                                              }
                                              className="p-1 rounded-md text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all cursor-pointer"
                                              title="إلغاء وحذف الطالب من سجل الكشوفات"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        {/* Quizzes cells specifying dynamic grades */}
                                        {activeClassQuizzes.map((q) => {
                                          const gradeObj = (
                                            student.detailedGrades || []
                                          ).find(
                                            (g) => g.quizTitle === q.title,
                                          );
                                          return (
                                            <td
                                              key={q.id}
                                              className="py-1.5 px-3 border border-slate-200 text-center font-sans font-extrabold text-xs text-indigo-850"
                                            >
                                              {gradeObj ? (
                                                <span>{gradeObj.score}</span>
                                              ) : (
                                                <span className="text-[10px] text-slate-400 font-medium font-sans">
                                                  لم يتقدم
                                                </span>
                                              )}
                                            </td>
                                          );
                                        })}

                                        {/* Progress bar */}
                                        <td className="py-1.5 px-3 border border-slate-200">
                                          <div className="flex items-center gap-2 max-w-[130px] justify-start">
                                            <div className="flex-grow bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                              <div
                                                className={`h-full rounded-full transition-all ${
                                                  student.averageScore >= 90
                                                    ? "bg-emerald-500"
                                                    : student.averageScore >= 75
                                                      ? "bg-blue-500"
                                                      : student.averageScore >=
                                                          60
                                                        ? "bg-amber-500"
                                                        : "bg-rose-500"
                                                }`}
                                                style={{
                                                  width: `${student.averageScore}%`,
                                                }}
                                              />
                                            </div>
                                            <span
                                              className={`font-sans text-xs font-black shrink-0 ${
                                                student.averageScore >= 90
                                                  ? "text-emerald-600"
                                                  : student.averageScore >= 75
                                                    ? "text-blue-600"
                                                    : student.averageScore >= 60
                                                      ? "text-amber-600"
                                                      : "text-rose-600"
                                              }`}
                                            >
                                              {student.averageScore}%
                                            </span>
                                          </div>
                                        </td>

                                        {/* Actions */}
                                        <td className="py-1.5 px-3 border border-slate-200 text-center">
                                          <div className="flex justify-center items-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setSelectedStudent(student)
                                              }
                                              className="p-1 rounded-md text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all cursor-pointer"
                                              title="عرض كشف النقاط الحالي للتحصيل العلمي"
                                            >
                                              <FileText className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ) : (
                      // Elegant prompt invitation to select grade and semester
                      <div className="bg-slate-50/50 rounded-3xl border border-slate-200/60 p-10 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mx-auto border border-indigo-100/40 text-center">
                          <Layers className="w-5 h-5 animate-pulse mx-auto" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-700">
                            يرجى تحديد الصف الدراسي والفصل
                          </h4>
                          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed font-semibold">
                            يرجى اختيار الصف الدراسي أولاً من القائمة المنسدلة
                            المرتبة أعلاه، ثم اختر الفصل المناسب لتجني ثمار
                            تخفيف مساحة الشاشة وإعطاء التفاصيل الكاملة للطلاب.
                          </p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })()}

            {activeTab === "manage_student_portal" &&
              (() => {
                const activeGrade = selectedTabGrade || "";
                const activeSemester = selectedTabSemester || "";

                // Resolve student class and filter by selected activeGrade and activeSemester
                const activeClassStudents = students.filter((student) => {
                  const sGrade =
                    student.grade ||
                    (student.gradeClass && student.gradeClass.includes(" - ")
                      ? student.gradeClass.split(" - ")[0].trim()
                      : "الصف العاشر");
                  const sSemester =
                    student.semester ||
                    (student.gradeClass && student.gradeClass.includes(" - ")
                      ? student.gradeClass.split(" - ")[1].trim()
                      : "الفصل الأول");
                  return (
                    normalizeGradeName(sGrade) ===
                      normalizeGradeName(activeGrade) &&
                    normalizeSemesterName(sSemester) ===
                      normalizeSemesterName(activeSemester)
                  );
                });

                const activeSemestersList = getSemestersForGrade(activeGrade);

                // Total students in the selected Grade across all of its active classes/semesters
                const totalGradeStudentsCount = students.filter((student) => {
                  const sGrade =
                    student.grade ||
                    (student.gradeClass && student.gradeClass.includes(" - ")
                      ? student.gradeClass.split(" - ")[0].trim()
                      : "الصف العاشر");
                  const sSemester =
                    student.semester ||
                    (student.gradeClass && student.gradeClass.includes(" - ")
                      ? student.gradeClass.split(" - ")[1].trim()
                      : "الفصل الأول");
                  return (
                    normalizeGradeName(sGrade) === normalizeGradeName(activeGrade) &&
                    activeSemestersList.some(
                      (sem) => normalizeSemesterName(sem) === normalizeSemesterName(sSemester)
                    )
                  );
                }).length;

                // Total students in active semesters of selected Grade who took quizzes
                const totalGradeTookQuizzesCount = students.filter((student) => {
                  const sGrade =
                    student.grade ||
                    (student.gradeClass && student.gradeClass.includes(" - ")
                      ? student.gradeClass.split(" - ")[0].trim()
                      : "الصف العاشر");
                  const sSemester =
                    student.semester ||
                    (student.gradeClass && student.gradeClass.includes(" - ")
                      ? student.gradeClass.split(" - ")[1].trim()
                      : "الفصل الأول");
                  return (
                    normalizeGradeName(sGrade) === normalizeGradeName(activeGrade) &&
                    activeSemestersList.some(
                      (sem) => normalizeSemesterName(sem) === normalizeSemesterName(sSemester)
                    ) &&
                    student.detailedGrades &&
                    student.detailedGrades.length > 0
                  );
                }).length;

                // Apply search query only
                const queryVal = studentSearch.toLowerCase().trim();
                const filteredStudents = activeClassStudents.filter(
                  (student) => {
                    return (
                      !queryVal ||
                      student.name.toLowerCase().includes(queryVal) ||
                      student.email.toLowerCase().includes(queryVal)
                    );
                  },
                );

                return (
                  <motion.div
                    key="manage-student-portal-tab"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-6"
                  >
                    {/* Header Section */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-3xs">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                          <Settings className="w-5 h-5 text-indigo-600 shrink-0" />
                          <span>إدارة اختبارات الطلاب</span>
                        </h3>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                          أداة الإدارة والتحكم السحابي لحذف ومزامنة الاختبارات
                          المنجزة وتعديل سجلات الطلاب.
                        </p>
                      </div>

                      {/* Quick summary specs */}
                      <div className="flex gap-4">
                        <div className="px-4 py-2 bg-indigo-50 border border-indigo-100/50 rounded-xl text-center min-w-[100px]">
                          <span className="text-[10px] text-indigo-600 font-bold block">
                            إجمالي الطلاب
                          </span>
                          <span className="text-base font-extrabold font-sans text-[#1e3a8a]">
                            {totalGradeStudentsCount}
                          </span>
                        </div>
                        <div className="px-4 py-2 bg-amber-50 border border-amber-100/50 rounded-xl text-center min-w-[100px]">
                          <span className="text-[10px] text-amber-700 font-bold block font-sans">
                            أدوا اختبارات
                          </span>
                          <span className="text-base font-extrabold font-sans text-amber-800">
                            {totalGradeTookQuizzesCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Grade and Semester Selection Block */}
                    <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 shadow-3xs overflow-hidden text-right">
                      <div className="p-5 bg-slate-50/40">
                        <div className="flex flex-col gap-4">
                          {/* Grades Tabs List */}
                          <div
                            className="flex items-center gap-2 overflow-x-auto pb-1"
                            dir="rtl"
                          >
                            {gradesList.map((g) => {
                              const isGradeSelected = selectedTabGrade === g;
                              const gradeCount = getStudentsCountForGrade(g);
                              return (
                                <button
                                  key={g}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTabGrade(g);
                                    const availableSemesters =
                                      getSemestersForGrade(g);
                                    if (availableSemesters.length > 0) {
                                      setSelectedTabSemester(
                                        availableSemesters[0],
                                      );
                                    } else {
                                      setSelectedTabSemester(null);
                                    }
                                  }}
                                  className={`flex flex-col rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer shrink-0 min-w-[110px] ${
                                    isGradeSelected
                                      ? "border-[#5352ed] shadow-md shadow-[#5352ed]/20"
                                      : "border-slate-200 hover:border-indigo-400 bg-white shadow-3xs"
                                  }`}
                                >
                                  <div
                                    className={`px-3 py-1.5 flex items-center justify-center gap-1.5 font-black text-xs ${
                                      isGradeSelected
                                        ? "bg-[#5352ed] text-white"
                                        : "bg-white text-slate-800"
                                    }`}
                                  >
                                    <span>{g}</span>
                                    {isGradeSelected && (
                                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                    )}
                                  </div>
                                  <div className="px-2 py-1 bg-rose-50/80 border-t border-rose-100/80 flex items-center justify-center gap-1 text-center">
                                    <span className="text-xs font-black text-rose-600 leading-none">{gradeCount}</span>
                                    <span className="text-[10px] font-bold text-rose-500">طالب</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Semesters Tabs List */}
                          {selectedTabGrade && (
                            <div
                              className="flex items-center gap-2 overflow-x-auto"
                              dir="rtl"
                            >
                              {getSemestersForGrade(selectedTabGrade).map(
                                (sem) => {
                                  const isSemSelected =
                                    selectedTabSemester === sem;
                                  const semCount = getStudentsCountForSemester(selectedTabGrade, sem);
                                  return (
                                    <button
                                      key={sem}
                                      type="button"
                                      onClick={() =>
                                        setSelectedTabSemester(sem)
                                      }
                                      className={`flex flex-col rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer shrink-0 min-w-[75px] ${
                                        isSemSelected
                                          ? "border-[#5352ed] shadow-md shadow-[#5352ed]/20"
                                          : "border-slate-200 hover:border-indigo-400 bg-white shadow-3xs"
                                      }`}
                                    >
                                      <div
                                        className={`px-3 py-1.5 flex items-center justify-center gap-1 font-black text-xs ${
                                          isSemSelected
                                            ? "bg-[#5352ed] text-white"
                                            : "bg-white text-[#5352ed]"
                                        }`}
                                      >
                                        <span>{sem}</span>
                                        {isSemSelected && (
                                          <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                        )}
                                      </div>
                                      <div className="px-2 py-1 bg-rose-50/80 border-t border-rose-100/80 flex items-center justify-center gap-1 text-center">
                                        <span className="text-xs font-black text-rose-600 leading-none">{semCount}</span>
                                        <span className="text-[10px] font-bold text-rose-500">طالب</span>
                                      </div>
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Search and Main Content */}
                      <div className="p-5 space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                          <div className="text-xs text-slate-500 font-extrabold w-full md:w-auto text-right">
                            {selectedTabGrade && selectedTabSemester ? (
                              <div className="flex items-center gap-1.5 justify-start md:justify-start">
                                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                                <span>الفصل النشط لإدارة الطلاب:</span>
                                <span className="text-indigo-700 font-black">
                                  {selectedTabGrade} ({selectedTabSemester})
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm sm:text-base font-black text-indigo-700 bg-indigo-50/70 border border-indigo-200/60 px-4 py-2.5 rounded-xl inline-flex items-center gap-2 shadow-xs animate-pulse">
                                💡 اختر الفصل واضغط اضافة
                              </span>
                            )}
                          </div>

                          {/* Search Bar matching other pages */}
                          <div className="relative w-full md:w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              placeholder="ابحث باسم الطالب أو البريد للتحرير..."
                              value={studentSearch}
                              onChange={(e) => setStudentSearch(e.target.value)}
                              className="bg-white border text-right border-slate-200 text-xs rounded-xl pl-3 pr-9 py-2 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
                            />
                          </div>
                        </div>

                        {/* Students list with manage panel */}
                        {filteredStudents.length === 0 ? (
                          <div className="p-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 border border-slate-105">
                              <Users className="w-5 h-5 text-slate-400 animate-none mx-auto" />
                            </div>
                            <h5 className="font-extrabold text-sm text-slate-700">
                              لا يوجد سجلات في هذا التقسيم
                            </h5>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto font-medium">
                              لم نعثر على طلاب مسجلين يطابقون تصفيتك الحالية في
                              الصف والفصل المعروض.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
                            {/* Students Roster on left (4 cols) */}
                            <div className="lg:col-span-5 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                              <span className="text-[11px] font-bold text-slate-400 block pb-1 text-right">
                                اختر الطالب لعرض وإدارة اختباراته:
                              </span>
                              {filteredStudents.map((stud) => {
                                const isSelected =
                                  selectedManageStudent?.id === stud.id;
                                const gradesCount = stud.detailedGrades
                                  ? stud.detailedGrades.length
                                  : 0;
                                return (
                                  <button
                                    key={stud.id}
                                    type="button"
                                    onClick={() =>
                                      setSelectedManageStudent(stud)
                                    }
                                    className={`w-full text-right p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                      isSelected
                                        ? "bg-indigo-50/80 border-indigo-250 ring-1 ring-indigo-200 shadow-3xs"
                                        : "bg-white hover:bg-slate-50 border-slate-100"
                                    }`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div
                                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                                          isSelected
                                            ? "bg-indigo-600 text-white"
                                            : "bg-slate-100 text-slate-650"
                                        }`}
                                      >
                                        {stud.name.substring(0, 2)}
                                      </div>
                                      <div className="min-w-0 text-right">
                                        <span className="text-xs font-black text-slate-800 block truncate">
                                          {stud.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-semibold block truncate font-sans">
                                          {stud.email}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="shrink-0 flex items-center gap-2">
                                      <span
                                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold font-sans ${
                                          gradesCount > 0
                                            ? "bg-indigo-100/60 text-indigo-700"
                                            : "bg-slate-100 text-slate-400 font-medium"
                                        }`}
                                      >
                                        {gradesCount}{" "}
                                        {gradesCount === 1
                                          ? "اختبار"
                                          : "اختبارات"}
                                      </span>
                                      <ChevronLeft
                                        className={`w-3.5 h-3.5 text-slate-450 transition-transform ${
                                          isSelected
                                            ? "-translate-x-1 text-indigo-600"
                                            : ""
                                        }`}
                                      />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Completed Tests Details and Management Panel on right (7 cols) */}
                            <div className="lg:col-span-7 bg-slate-50/50 rounded-2xl border border-slate-200/60 p-5 space-y-4 min-h-[300px]">
                              {selectedManageStudent ? (
                                (() => {
                                  // Re-fetch live data from the students state to ensure responsiveness
                                  const liveStud =
                                    students.find(
                                      (s) => s.id === selectedManageStudent.id,
                                    ) || selectedManageStudent;
                                  const testList =
                                    liveStud.detailedGrades || [];

                                  return (
                                    <div className="space-y-4 text-right">
                                      {/* Student Top Title */}
                                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-3 border-b border-slate-200 gap-3">
                                        <div className="text-right">
                                          <h4 className="font-extrabold text-sm text-slate-850">
                                            {liveStud.name}
                                          </h4>
                                          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                                            {liveStud.gradeClass} | المعدل:{" "}
                                            <span className="font-sans font-extrabold text-indigo-600">
                                              {liveStud.averageScore}%
                                            </span>
                                          </p>
                                        </div>

                                        {testList.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              triggerConfirm(
                                                "حذف كافة الاختبارات المنجزة",
                                                `هل أنت متأكد من رغبتك في تصفير وحذف جميع الاختبارات المنجزة (${testList.length}) للطالب: ${liveStud.name}؟ هذا الإجراء لا يمكن التراجع عنه وسيعيد تعيين معدل الطالب إلى صفر ليعيد أخذ الاختبارات.`,
                                                async () => {
                                                  await runWithProgress(
                                                    async () => {
                                                      await updateDoc(
                                                        doc(
                                                          db,
                                                          "students",
                                                          liveStud.id,
                                                        ),
                                                        {
                                                          detailedGrades: [],
                                                          averageScore: 0,
                                                          status:
                                                            "needs_improvement",
                                                        },
                                                      );
                                                    },
                                                    "جاري حذف كافة نتائج واختبارات الطالب المنجزة وتصفير السجل...",
                                                    "تم حذف وتصفير سجل اختبارات الطالب المنجزة بنجاح 🗑️"
                                                  );
                                                },
                                              );
                                            }}
                                            className="text-[10px] font-black text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-205 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-3xs cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                                            <span>
                                              حذف كافة الاختبارات المنجزة
                                            </span>
                                          </button>
                                        )}
                                      </div>

                                      {/* Tests entries list */}
                                      {testList.length === 0 ? (
                                        <div className="py-12 text-center bg-white rounded-xl border border-slate-100 p-6 space-y-2 select-none">
                                          <ClipboardList
                                            className="w-8 h-8 text-slate-300 mx-auto"
                                            strokeWidth={1.5}
                                          />
                                          <h6 className="font-extrabold text-xs text-slate-500">
                                            لا يوجد اختبارات منجزة مسجلة
                                          </h6>
                                          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                                            لم يقم هذا الطالب بحل أي اختبارات في
                                            السحابة حتى الآن، أو تم حذف كافة
                                            حلوله السابقة.
                                          </p>
                                        </div>
                                      ) : (
                                        <div className="space-y-2.5 max-h-[360px] overflow-y-auto pl-1">
                                          {testList.map((test, tIdx) => (
                                            <div
                                              key={tIdx}
                                              className="p-3.5 bg-white rounded-xl border border-slate-150 flex justify-between items-center gap-4 hover:shadow-xs transition-shadow text-right"
                                            >
                                              <div className="space-y-1 min-w-0 text-right flex-1">
                                                <span className="text-xs font-black text-slate-800 block truncate">
                                                  {test.quizTitle}
                                                </span>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold font-sans justify-start">
                                                  <span>
                                                    تاريخ الحل:{" "}
                                                    {test.date || "غير محدد"}
                                                  </span>
                                                  <span>•</span>
                                                  {test.passed ? (
                                                    <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                                                      ناجح
                                                    </span>
                                                  ) : (
                                                    <span className="text-rose-500 font-bold bg-rose-50 px-1.5 py-0.2 rounded font-semibold">
                                                      يحتاج متابعة
                                                    </span>
                                                  )}
                                                </div>
                                              </div>

                                              <div className="flex items-center gap-3 shrink-0">
                                                <div className="text-left font-sans">
                                                  <span className="text-xs font-black text-slate-700 block text-left">
                                                    {test.score} /{" "}
                                                    {test.maxScore}
                                                  </span>
                                                  <span className="text-[9px] text-slate-400 block font-black font-sans">
                                                    نقاط المحاولة
                                                  </span>
                                                </div>

                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    triggerConfirm(
                                                      "حذف نتيجة الاختبار",
                                                      `هل أنت متأكد من رغبتك في حذف إجابة/نتيجة اختبار "${test.quizTitle}" للطالب؟ سيقوم النظام بإغلاق هذه المحاولة وتصفيرها لإتاحة الاختبار من جديد.`,
                                                      () =>
                                                        handleDeleteStudentCompletedQuiz(
                                                          liveStud.id,
                                                          tIdx,
                                                        ),
                                                    );
                                                  }}
                                                  className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 rounded-lg border border-rose-100/80 transition-colors cursor-pointer"
                                                  title="حذف هذا الاختبار المنجز"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()
                              ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3 choose-prompt select-none">
                                  <div className="w-11 h-11 bg-white border border-slate-150 rounded-xl flex items-center justify-center mx-auto">
                                    <Settings className="w-5 h-5 text-indigo-400 shrink-0" />
                                  </div>
                                  <div>
                                    <h5 className="font-extrabold text-xs text-slate-650">
                                      لوحة التحكم ببوابة الطالب
                                    </h5>
                                    <p className="text-[10px] text-slate-450 max-w-sm mt-1 leading-relaxed">
                                      اختر أحد الطلاب من القائمة الجانبية لعرض
                                      اختباراته المصححة والتحكم بحذفها أو
                                      تصفيرها لإعادة إتاحة الاختبارات لهم أو
                                      تعديل سجل رصد الطلاب.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })()}

            {activeTab === "reviews_admin" && (
              <motion.div
                key="reviews-admin-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <ReviewsAdminTab
                  currentUser={currentUser}
                  quizzes={quizzes}
                  reviewChallenges={reviewChallenges}
                  reviewScores={reviewScores}
                  bankQuestions={bankQuestions}
                  triggerToast={triggerToast}
                  triggerConfirm={triggerConfirm}
                />
              </motion.div>
            )}

            {activeTab === "curriculum_review_admin" && (
              <motion.div
                key="curriculum-review-admin-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <CurriculumReviewAdminTab
                  currentUser={currentUser}
                  bankQuestions={bankQuestions}
                  students={students}
                  grades={grades}
                  triggerToast={triggerToast}
                  isFullScreenResults={isCurriculumAdminFullScreen}
                  onToggleFullScreen={(isFull) => setIsCurriculumAdminFullScreen(isFull)}
                />
              </motion.div>
            )}

            {activeTab === "registered_teachers" && (
              <motion.div
                key="registered-teachers-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <RegisteredTeachersTab
                  currentUser={currentUser}
                  triggerToast={triggerToast}
                />
              </motion.div>
            )}

            {activeTab === "question_bank" && (
              <motion.div
                key="question-bank-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <QuestionBankTab
                  currentUser={currentUser}
                  bankQuestions={bankQuestions}
                  bankQuestionsLoaded={bankQuestionsLoaded}
                  triggerToast={triggerToast}
                  triggerConfirm={triggerConfirm}
                  onAutoCreateQuiz={handleAutoCreateQuiz}
                  hideReadOnlyNotice={false}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* --- SHADED MODAL: IMPORT FROM QUESTION BANK --- */}
          <AnimatePresence>
            {showBankImportModal && (
              <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl w-full max-w-6xl shadow-2xl overflow-hidden h-[90vh] max-h-[90vh] flex flex-col"
                >
                  {/* Header */}
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-650 flex items-center justify-center">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-extrabold text-slate-800">
                          استيراد الأسئلة من بنك الأسئلة
                        </h3>
                        <p className="text-[10px] text-slate-400 font-medium">
                          اختر الأسئلة المصنفة لإدراجها مباشرة في مسودة الاختبار الحالي.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBankImportModal(false)}
                      className="p-1 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                    >
                      إغلاق
                    </button>
                  </div>

                  {/* Two Column Scrollable Body */}
                  <div className="flex-1 min-h-0 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
                    
                    {/* Right Column (Sidebar): Filters & Persistent Stats (Always Visible) */}
                    <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-1 text-right">
                      
                      {/* Stats Section (Sticky / Always Visible) */}
                      <div className="space-y-3 bg-slate-50/60 p-4 rounded-2xl border border-slate-150 shrink-0">
                        <h4 className="text-[11px] font-bold text-slate-400 block border-b border-slate-200/50 pb-1 mb-2">إحصائيات الانتقاء</h4>
                        
                        {/* Stat 1: Total grades/score current */}
                        <div className="bg-white p-3 flex items-center justify-between shadow-3xs rounded-xl border border-slate-150">
                          <div>
                            <span className="text-[10px] text-slate-400 font-extrabold block mb-0.5">
                              إجمالي درجات الاختبار
                            </span>
                            <span className="text-lg font-black text-emerald-800 font-sans">
                              {builderQuestions.reduce(
                                (acc, q) => acc + Number(q.points || 0),
                                0,
                              ) +
                                bankQuestions
                                  .filter((q) => importSelectedBqIds[q.id])
                                  .reduce(
                                    (acc, q) => acc + Number(q.points || 0),
                                    0,
                                  )}{" "}
                              <span className="text-[10px] font-bold text-emerald-650 font-medium">
                                درجة
                              </span>
                            </span>
                          </div>
                          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center border border-emerald-100/30 shrink-0">
                            <Award className="w-4.5 h-4.5" />
                          </div>
                        </div>

                        {/* Stat 2: Questions currently selected in bank */}
                        <div className="bg-white p-3 flex items-center justify-between shadow-3xs rounded-xl border border-slate-150">
                          <div>
                            <span className="text-[10px] text-slate-400 font-extrabold block mb-0.5">
                              المحددة للاستيراد من البنك
                            </span>
                            <span className="text-lg font-black text-amber-800 font-sans">
                              {
                                Object.values(importSelectedBqIds).filter(Boolean)
                                  .length
                              }{" "}
                              <span className="text-[10px] font-bold text-amber-600 font-medium">
                                سؤال
                              </span>
                            </span>
                          </div>
                          <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center border border-amber-100/30 shrink-0">
                            <CheckSquare className="w-4.5 h-4.5" />
                          </div>
                        </div>
                      </div>

                      {/* Filters Section (Units list scrolls internally inside select / dropdown) */}
                      <div className="space-y-3.5 bg-slate-50/40 p-4 rounded-2xl border border-slate-100 flex-1">
                        <h4 className="text-[11px] font-bold text-slate-400 block border-b border-slate-200/50 pb-1 mb-2">تصفية وبحث</h4>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            المرحلة الدراسية
                          </label>
                          <select
                            value={importFilterStage}
                            onChange={(e) => {
                              setImportFilterStage(e.target.value);
                              setImportFilterGrade("all");
                              setImportFilterSubject("all");
                              setImportFilterSemester("all");
                              setImportFilterUnit("all");
                              setImportFilterLesson("all");
                            }}
                            className="bg-white border border-slate-200 text-xs rounded-xl px-2.5 py-2 w-full focus:outline-none"
                          >
                            <option value="all">الكل</option>
                            {Array.from(new Set(bankQuestions.map((q) => q.stage)))
                              .filter(Boolean)
                              .sort()
                              .map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            الصف
                          </label>
                          <select
                            value={importFilterGrade}
                            onChange={(e) => {
                              setImportFilterGrade(e.target.value);
                              setImportFilterSubject("all");
                              setImportFilterSemester("all");
                              setImportFilterUnit("all");
                              setImportFilterLesson("all");
                            }}
                            className="bg-white border border-slate-200 text-xs rounded-xl px-2.5 py-2 w-full focus:outline-none"
                          >
                            <option value="all">الكل</option>
                            {Array.from(
                              new Set(
                                bankQuestions
                                  .filter(
                                    (q) =>
                                      importFilterStage === "all" ||
                                      q.stage === importFilterStage,
                                  )
                                  .map((q) => q.grade),
                              ),
                            )
                              .filter(Boolean)
                              .sort()
                              .map((g) => (
                                <option key={g} value={g}>
                                  {g}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            الفصل الدراسي
                          </label>
                          <select
                            value={importFilterSemester}
                            onChange={(e) => {
                              setImportFilterSemester(e.target.value);
                              setImportFilterSubject("all");
                              setImportFilterUnit("all");
                              setImportFilterLesson("all");
                            }}
                            className="bg-white border border-slate-200 text-xs rounded-xl px-2.5 py-2 w-full focus:outline-none"
                          >
                            <option value="all">الكل</option>
                            {Array.from(
                              new Set(
                                bankQuestions
                                  .filter(
                                    (q) =>
                                      (importFilterStage === "all" ||
                                        q.stage === importFilterStage) &&
                                      (importFilterGrade === "all" ||
                                        q.grade === importFilterGrade),
                                  )
                                  .map((q) => q.semester),
                              ),
                            )
                              .filter(Boolean)
                              .sort()
                              .map((sem) => (
                                <option key={sem} value={sem}>
                                  {sem}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            المادة
                          </label>
                          <select
                            value={importFilterSubject}
                            onChange={(e) => {
                              setImportFilterSubject(e.target.value);
                              setImportFilterUnit("all");
                              setImportFilterLesson("all");
                            }}
                            className="bg-white border border-slate-200 text-xs rounded-xl px-2.5 py-2 w-full focus:outline-none"
                          >
                            <option value="all">الكل</option>
                            {Array.from(
                              new Set(
                                bankQuestions
                                  .filter(
                                    (q) =>
                                      (importFilterStage === "all" ||
                                        q.stage === importFilterStage) &&
                                      (importFilterGrade === "all" ||
                                        q.grade === importFilterGrade) &&
                                      (importFilterSemester === "all" ||
                                        q.semester === importFilterSemester),
                                  )
                                  .map((q) => q.subject),
                              ),
                            )
                              .filter(Boolean)
                              .sort()
                              .map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            البحث بالنص
                          </label>
                          <input
                            type="text"
                            placeholder="ابحث بالنص..."
                            value={importSearch}
                            onChange={(e) => setImportSearch(e.target.value)}
                            className="bg-white border border-slate-200 text-xs rounded-xl px-2.5 py-2 w-full focus:outline-none placeholder-slate-350 font-sans"
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            الوحدات والدروس
                          </label>
                          <UnitLessonMultiSelect
                            questions={bankQuestions.filter(
                              (q) =>
                                (importFilterStage === "all" ||
                                  q.stage === importFilterStage) &&
                                (importFilterGrade === "all" ||
                                  q.grade === importFilterGrade) &&
                                (importFilterSemester === "all" ||
                                  q.semester === importFilterSemester) &&
                                (importFilterSubject === "all" ||
                                  q.subject === importFilterSubject),
                            )}
                            selected={importFilterLessons}
                            onChange={setImportFilterLessons}
                          />

                          {/* Automatic Quiz Creator trigger button */}
                          <div className="pt-1">
                            <button
                              type="button"
                              id="btn-builder-auto-quiz-trigger-modal"
                              disabled={importFilterLessons.length === 0}
                              onClick={handleOpenBuilderAutoQuizModal}
                              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs rounded-xl shadow-sm hover:shadow-orange-100 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                              <Sparkles className="w-4 h-4 text-amber-100 group-hover:animate-pulse animate-pulse" />
                              <span>إنشاء اختبار تلقائي 🪄</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Left Column (Questions List Area): Wider width with its own scroll container */}
                    <div className="lg:col-span-8 flex flex-col min-h-0 bg-slate-50/30 rounded-2xl border border-slate-100 p-4">
                      
                      {/* Dynamic Filter Statistics Header (Actions pinned at top of question area) */}
                      <div className="pb-3.5 border-b border-slate-200/60 mb-4 text-[11px] select-none shrink-0">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-550 bg-white border border-slate-150 px-2.5 py-1.5 rounded-lg">
                              العثور على <span className="text-indigo-600 font-extrabold">{filteredImportCount}</span> سؤال متاح
                            </span>
                          </div>

                          <div className="flex gap-2.5 items-center">
                            <button
                              type="button"
                              onClick={() => {
                                const next: Record<string, boolean> = {
                                  ...importSelectedBqIds,
                                };
                                filteredImportQuestions.forEach((q) => {
                                  next[q.id] = true;
                                });
                                setImportSelectedBqIds(next);
                              }}
                              className="text-xs text-indigo-600 font-black hover:underline cursor-pointer font-sans bg-white hover:bg-indigo-50/30 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100"
                            >
                              تحديد الكل ({filteredImportCount})
                            </button>
                            <span className="text-slate-200">|</span>
                            <button
                              type="button"
                              onClick={() => {
                                const next: Record<string, boolean> = {
                                  ...importSelectedBqIds,
                                };
                                filteredImportQuestions.forEach((q) => {
                                  next[q.id] = false;
                                });
                                setImportSelectedBqIds(next);
                              }}
                              className="text-xs text-slate-500 font-extrabold hover:underline cursor-pointer font-sans bg-white hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors border border-slate-150"
                            >
                              إلغاء تحديد الكل
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Content Area - Scrollable Questions */}
                      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {(() => {
                          const filteredImport = filteredImportQuestions;

                          if (filteredImport.length === 0) {
                            return (
                              <div className="py-20 text-center text-slate-400">
                                <Database className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                <p className="text-xs font-bold font-sans">
                                  تنبيه: لا يوجد أسئلة مطابقة للخيارات المفلترة في البنك حالياً.
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              {filteredImport.map((q) => {
                                const isAlreadyAdded = builderQuestions.some(
                                  (bq) => bq.text.trim() === q.text.trim() || bq.id.endsWith(q.id) || bq.id === q.id
                                );
                                const isSelected = !isAlreadyAdded && !!importSelectedBqIds[q.id];
                                return (
                                  <div
                                    key={q.id}
                                    onClick={() => {
                                      if (isAlreadyAdded) return;
                                      setImportSelectedBqIds((prev) => ({
                                        ...prev,
                                        [q.id]: !prev[q.id],
                                      }));
                                    }}
                                    className={`p-4 rounded-2xl border-2 transition-all flex items-start gap-3.5 text-right ${
                                      isAlreadyAdded
                                        ? "bg-slate-50 border-slate-200/60 cursor-not-allowed opacity-70"
                                        : isSelected
                                          ? "bg-emerald-50/45 border-emerald-500 shadow-xs cursor-pointer"
                                          : "bg-white border-slate-200/85 hover:border-slate-350 cursor-pointer"
                                    }`}
                                  >
                                    {/* Checkbox control */}
                                    <div
                                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                                        isAlreadyAdded
                                          ? "bg-slate-100 border-slate-300 text-slate-400"
                                          : isSelected
                                            ? "bg-emerald-600 border-emerald-600 text-white"
                                            : "border-slate-350 text-transparent bg-white"
                                      }`}
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 space-y-2">
                                      <div className="flex flex-wrap gap-1 items-center">
                                        <span className="text-[9px] font-sans font-bold text-slate-400">
                                          [{q.stage} - {q.grade} - {q.subject}]
                                        </span>
                                        {q.unit && (
                                          <span className="text-[9px] font-sans text-indigo-500 font-bold bg-indigo-50/50 px-1.5 py-0.5 rounded-md">
                                            {q.unit}
                                          </span>
                                        )}
                                        {q.lesson && (
                                          <span className="text-[9px] font-sans text-teal-600 font-bold bg-teal-50/50 px-1.5 py-0.5 rounded-md">
                                            {q.lesson}
                                          </span>
                                        )}
                                        {isAlreadyAdded && (
                                          <span className="text-[9px] font-sans font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md shrink-0">
                                            مضاف مسبقاً للاختبار
                                          </span>
                                        )}
                                        <span className="mr-auto text-[9px] font-sans font-extrabold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                          {q.points} نقاط
                                        </span>
                                      </div>
                                      <p className="text-[15px] font-black text-slate-900 leading-relaxed font-sans">
                                        {q.text}
                                      </p>

                                      {/* Options and correct answer display - Stacked vertically with numbered badges */}
                                      <div className="flex flex-col gap-2.5 pt-1.5 w-full">
                                        {(q.options || [])
                                          .map((opt, oIdx) => ({ opt, oIdx }))
                                          .filter(item => {
                                            if (!item.opt) return false;
                                            const t = item.opt.trim();
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
                                          .map(({ opt, oIdx }) => {
                                            const isCorrect =
                                              q.type === "multiple_choice"
                                                ? String(oIdx) === q.correctAnswer
                                                : (oIdx === 0 &&
                                                    (q.correctAnswer === "true" || q.correctAnswer === "0" || q.correctAnswer === "صح" || q.correctAnswer === "صحيح" || q.correctAnswer === "صواب")) ||
                                                  (oIdx === 1 &&
                                                    (q.correctAnswer === "false" || q.correctAnswer === "1" || q.correctAnswer === "خطأ" || q.correctAnswer === "خاطئ" || q.correctAnswer === "خاطئة"));

                                            return (
                                              <div
                                                key={oIdx}
                                                className={`p-3 rounded-xl text-[13px] font-sans border flex items-center justify-between transition-all ${
                                                  isCorrect
                                                    ? "bg-emerald-50/70 border-emerald-500 text-emerald-800 font-extrabold shadow-3xs"
                                                    : "bg-slate-50 border-slate-200/80 text-slate-650 hover:bg-slate-100/70"
                                                }`}
                                              >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                  <span className={`inline-flex items-center justify-center w-5.5 h-5.5 rounded-lg text-xs font-black shrink-0 ${
                                                    isCorrect 
                                                      ? 'bg-emerald-200 text-emerald-900' 
                                                      : 'bg-slate-200 text-slate-650'
                                                  }`}>
                                                    {oIdx + 1}
                                                  </span>
                                                  <span className="truncate pr-1 text-slate-800 font-bold text-[13px]">
                                                    {opt}
                                                  </span>
                                                </div>
                                                {isCorrect && (
                                                  <span className="text-[10px] bg-emerald-600 text-white font-black px-2.5 py-0.5 rounded-md flex items-center gap-0.5 shrink-0 select-none">
                                                    <Check className="w-3 h-3 stroke-[3.5px]" />
                                                    الإجابة الصحيحة
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Footer and confirm button */}
                  <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span className="text-[11px] text-slate-400 font-bold">
                        يرجى تأكيد الاستيراد بعد الانتهاء من تحديد الأسئلة بالكامل.
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowBankImportModal(false)}
                        className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={handleImportSelectedQuestions}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-100 cursor-pointer transition-all"
                      >
                        تأكيد استيراد الأسئلة المحددة
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* --- SHADED MODAL: AUTOMATIC QUIZ CREATION FROM BANK FILTERS --- */}
          <AnimatePresence>
            {showBuilderAutoQuizModal && (() => {
              const isTf = (q: BankQuestion) => {
                if (q.type === 'true_false' || (q.type as string) === 'tf' || (q.type as string) === 'boolean') return true;
                if (q.options && Array.isArray(q.options) && q.options.length === 2) {
                  const o1 = (q.options[0] || '').trim().toLowerCase();
                  const o2 = (q.options[1] || '').trim().toLowerCase();
                  const tfWords = ['صح', 'خطأ', 'صحيح', 'خاطئ', 'خاطئة', 'صواب', 'true', 'false'];
                  if (tfWords.includes(o1) || tfWords.includes(o2)) return true;
                }
                return false;
              };
              const availableMcqs = filteredImportQuestions.filter((q) => !isTf(q));
              const availableTfs = filteredImportQuestions.filter((q) => isTf(q));

              return (
                <div className="fixed inset-0 bg-slate-900/60 z-[60] backdrop-blur-xs flex items-center justify-center p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-right font-sans border border-slate-100"
                  >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                          <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-800">
                            توليد اختبار تلقائي ذكي
                          </h3>
                          <p className="text-[10px] text-slate-400 font-medium">
                            إنشاء اختبار مخصص من الأسئلة المتوفرة في الفلترة الحالية.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBuilderAutoQuizModal(false)}
                        className="p-1 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                      >
                        إغلاق
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                      {/* Current Filters Overview */}
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 block">التصنيف الحالي المختار:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {importFilterStage !== "all" && (
                            <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-md">
                              {importFilterStage}
                            </span>
                          )}
                          {importFilterGrade !== "all" && (
                            <span className="text-[10px] font-bold text-violet-650 bg-violet-50 px-2 py-0.5 rounded-md">
                              {importFilterGrade}
                            </span>
                          )}
                          {importFilterSubject !== "all" && (
                            <span className="text-[10px] font-bold text-sky-650 bg-sky-50 px-2 py-0.5 rounded-md">
                              {importFilterSubject}
                            </span>
                          )}
                          {importFilterSemester !== "all" && (
                            <span className="text-[10px] font-bold text-emerald-650 bg-emerald-50 px-2 py-0.5 rounded-md">
                              الفصل {importFilterSemester === "1" ? "الأول" : importFilterSemester === "2" ? "الثاني" : importFilterSemester}
                            </span>
                          )}
                          {importFilterLessons.length > 0 && (
                            <span className="text-[10px] font-bold text-amber-650 bg-amber-50 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                              {importFilterLessons.length} دروس محددة
                            </span>
                          )}
                        </div>
                      </div>

                      {/* MCQs Controls */}
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-slate-700">أسئلة الاختيار من متعدد (MCQ)</span>
                          <span className="text-sm font-black text-red-600 bg-red-50/70 px-2.5 py-1 rounded-xl border border-red-100/50">المتاح: {availableMcqs.length}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled={autoBuilderMcqCount <= 0}
                            onClick={() => setAutoBuilderMcqCount(prev => Math.max(0, prev - 1))}
                            className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shrink-0"
                          >
                            -
                          </button>
                          <input
                            type="range"
                            min="0"
                            max={availableMcqs.length}
                            value={autoBuilderMcqCount}
                            onChange={(e) => setAutoBuilderMcqCount(Math.min(availableMcqs.length, parseInt(e.target.value, 10) || 0))}
                            className="flex-1 accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                          />
                          <div className="w-14 text-center font-sans font-black text-sm text-slate-800 bg-slate-50 border border-slate-100 py-2 rounded-xl shrink-0">
                            {autoBuilderMcqCount}
                          </div>
                          <button
                            type="button"
                            disabled={autoBuilderMcqCount >= availableMcqs.length}
                            onClick={() => setAutoBuilderMcqCount(prev => Math.min(availableMcqs.length, prev + 1))}
                            className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shrink-0"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* True/False Controls */}
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-slate-700">أسئلة الصواب والخطأ (T/F)</span>
                          <span className="text-sm font-black text-red-600 bg-red-50/70 px-2.5 py-1 rounded-xl border border-red-100/50">المتاح: {availableTfs.length}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled={autoBuilderTfCount <= 0}
                            onClick={() => setAutoBuilderTfCount(prev => Math.max(0, prev - 1))}
                            className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shrink-0"
                          >
                            -
                          </button>
                          <input
                            type="range"
                            min="0"
                            max={availableTfs.length}
                            value={autoBuilderTfCount}
                            onChange={(e) => setAutoBuilderTfCount(Math.min(availableTfs.length, parseInt(e.target.value, 10) || 0))}
                            className="flex-1 accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                          />
                          <div className="w-14 text-center font-sans font-black text-sm text-slate-800 bg-slate-50 border border-slate-100 py-2 rounded-xl shrink-0">
                            {autoBuilderTfCount}
                          </div>
                          <button
                            type="button"
                            disabled={autoBuilderTfCount >= availableTfs.length}
                            onClick={() => setAutoBuilderTfCount(prev => Math.min(availableTfs.length, prev + 1))}
                            className="w-10 h-10 rounded-xl border border-slate-200 hover:bg-slate-50 flex items-center justify-center font-bold text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all shrink-0"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Sum counter card */}
                      <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100/40 flex justify-between items-center">
                        <span className="text-xs font-black text-indigo-900">مجموع الأسئلة المختارة للاختبار</span>
                        <div className="bg-indigo-600 text-white font-sans font-black px-3 py-1.5 rounded-xl text-xs">
                          {autoBuilderMcqCount + autoBuilderTfCount} أسئلة
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-100 bg-slate-50/30 flex justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowBuilderAutoQuizModal(false)}
                        className="px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmBuilderAutoQuiz}
                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md shadow-indigo-100 cursor-pointer transition-all flex items-center gap-1.5 group"
                      >
                        <span>توليد الاختبار الآن</span>
                        <Sparkles className="w-3.5 h-3.5 group-hover:animate-pulse text-indigo-200" />
                      </button>
                    </div>
                  </motion.div>
                </div>
              );
            })()}
          </AnimatePresence>

          {/* --- SHADED MODAL: NEW QUIZ CREATION OPTION SELECTOR --- */}
          <AnimatePresence>
            {showQuizCreationModal && (
              <div className="fixed inset-0 bg-slate-900/65 z-50 backdrop-blur-xs flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl relative p-8 md:p-10 flex flex-col text-right font-sans border border-slate-100 overflow-hidden"
                >
                  {/* Close handle at top-left */}
                  <button
                    type="button"
                    onClick={() => setShowQuizCreationModal(false)}
                    className="absolute top-6 left-6 w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-all border border-slate-100"
                    title="إغلاق النافذة"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Centered Heading */}
                  <div className="text-center mt-3 mb-8 md:mb-10">
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-tight">
                      إنشاء اختبار جديد
                    </h3>
                    <p className="text-sm font-bold text-slate-400 mt-2">
                      اختر طريقة إنشاء الاختبار
                    </p>
                  </div>

                  {/* Three Option Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
                    {/* Option 1: Question Bank (RTL first column) */}
                    <button
                      type="button"
                      onClick={() => handleStartNewQuizWithMethod("bank")}
                      className="bg-white border-2 border-slate-150 hover:border-indigo-600 hover:shadow-2xl hover:shadow-indigo-100 rounded-[24px] p-6 py-8 flex flex-col items-center justify-center text-center transition-all duration-300 transform hover:-translate-y-3 hover:scale-[1.05] active:scale-[0.97] group cursor-pointer h-full min-h-[250px]"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center shadow-xs border border-indigo-100 transition-colors">
                        <Library className="w-8 h-8 text-indigo-600" />
                      </div>
                      <span className="font-extrabold text-[#111827] text-lg mt-4 text-center">
                        بنك الأسئلة
                      </span>
                      <span className="text-[#6b7280] text-xs font-semibold mt-2.5 text-center leading-relaxed font-sans block max-w-[160px]">
                        اختر من أسئلة المناهج المتاحة
                      </span>
                    </button>

                    {/* Option 2: AI Question Extraction (Middle column) */}
                    <button
                      type="button"
                      onClick={() => handleStartNewQuizWithMethod("ai")}
                      className="bg-white border-2 border-slate-150 hover:border-emerald-600 hover:shadow-2xl hover:shadow-emerald-100 rounded-[24px] p-6 py-8 flex flex-col items-center justify-center text-center transition-all duration-300 transform hover:-translate-y-3 hover:scale-[1.05] active:scale-[0.97] group cursor-pointer h-full min-h-[250px]"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center shadow-xs border border-emerald-100 transition-colors">
                        <ClipboardList className="w-8 h-8 text-emerald-600" />
                      </div>
                      <span className="font-extrabold text-[#111827] text-lg mt-4 text-center">
                        استخراج الأسئلة
                      </span>
                      <span className="text-[#6b7280] text-xs font-semibold mt-2.5 text-center leading-relaxed font-sans block max-w-[160px]">
                        حلل محتوى نصي أو صور أو ملفات واستخرج الأسئلة تلقائياً
                      </span>
                    </button>

                    {/* Option 3: Manual Addition (Left column) */}
                    <button
                      type="button"
                      onClick={() => handleStartNewQuizWithMethod("manual")}
                      className="bg-white border-2 border-slate-150 hover:border-amber-500 hover:shadow-2xl hover:shadow-amber-100 rounded-[24px] p-6 py-8 flex flex-col items-center justify-center text-center transition-all duration-300 transform hover:-translate-y-3 hover:scale-[1.05] active:scale-[0.97] group cursor-pointer h-full min-h-[250px]"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-amber-50 group-hover:bg-amber-100 flex items-center justify-center shadow-xs border border-amber-100 transition-colors">
                        <Pencil className="w-8 h-8 text-amber-600" />
                      </div>
                      <span className="font-extrabold text-[#111827] text-lg mt-4 text-center">
                        إضافة يدوياً
                      </span>
                      <span className="text-[#6b7280] text-xs font-semibold mt-2.5 text-center leading-relaxed font-sans block max-w-[160px]">
                        أنشئ أسئلتك بنفسك وصمم الاختبار مباشرة
                      </span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* --- SHADED MODAL: BUILDER QUESTIONS FROM PDF --- */}
          <AnimatePresence>
            {showBuilderPdfModal && (
              <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-right font-sans"
                >
                  {/* Header */}
                  <div className="p-6 border-b border-slate-150 bg-gradient-to-r from-emerald-50/50 to-teal-50/50 flex justify-between items-center animate-fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-800">
                          توليد الأسئلة الذكي من المستندات (PDF / Word / Excel)
                        </h3>
                        <p className="text-xs text-slate-400 font-medium font-sans">
                          قم بتحميل ملف PDF أو Word أو Excel وسيقوم الذكاء الاصطناعي بتحليله فوراً واستخراج أسئلة مصنفة منه.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setBuilderPdfFile(null);
                        setBuilderPdfBase64("");
                        setBuilderPdfCustomPrompt("");
                        setBuilderPdfDrafts([]);
                        setBuilderPdfSelectedDraftIndexes({});
                        setBuilderPdfError(null);
                        setShowBuilderPdfModal(false);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 p-6 overflow-y-auto space-y-6">
                    {!isBuilderPdfGenerating &&
                    builderPdfDrafts.length === 0 ? (
                      <div className="space-y-5">
                        {/* File Dropzone */}
                        <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl p-8 bg-slate-50/50 transition-all text-center flex flex-col items-center justify-center gap-3">
                          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <Upload className="w-6 h-6 text-emerald-600 animate-bounce" />
                          </div>

                          {builderPdfFile ? (
                            <div className="space-y-1.5">
                              <p className="text-sm font-extrabold text-emerald-700 flex items-center gap-1.5 justify-center">
                                <FileText className="w-4 h-4 text-emerald-650" />
                                <span>{builderPdfFile.name}</span>
                              </p>
                              <p className="text-[11px] text-slate-450 font-sans">
                                {(builderPdfFile.size / 1024 / 1024).toFixed(2)}{" "}
                                ميغابايت • ملف جاهز للتحليل
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="text-sm font-bold text-slate-700">
                                اسحب ملف الـ PDF أو Word أو Excel هنا أو انقر لتحديد الملف
                              </p>
                              <p className="text-xs text-slate-400 font-sans">
                                مثال: كتب الوزارة، الشروحات، الكتيبات، ملخصات المعلم، أو ملفات البيانات والأسئلة
                              </p>
                            </div>
                          )}

                          <input
                            type="file"
                            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv"
                            onChange={handleBuilderPdfUpload}
                            className="hidden"
                            id="builder-pdf-picker-input"
                          />
                          <label
                            htmlFor="builder-pdf-picker-input"
                            className="mt-2 px-4.5 py-2 border border-slate-200 hover:border-slate-300 rounded-xl bg-white text-xs font-bold text-slate-650 cursor-pointer transition shadow-xs"
                          >
                            {builderPdfFile
                              ? "تغيير الملف المحدد"
                              : "تصفح ملفات جهازك"}
                          </label>
                        </div>

                        {/* Choice of MCQ and True/False questions counts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2 text-right">
                            <label className="text-xs font-black text-slate-700 block select-none">
                              عدد أسئلة الاختيار من متعدد:
                            </label>
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                max={25}
                                value={builderPdfMcqCount}
                                onChange={(e) =>
                                  setBuilderPdfMcqCount(
                                    Math.max(0, parseInt(e.target.value) || 0),
                                  )
                                }
                                className="bg-transparent font-black text-slate-800 text-sm focus:outline-none flex-1 font-sans text-center"
                              />
                              <span className="text-xs font-bold text-slate-400">
                                سؤال
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2 text-right">
                            <label className="text-xs font-black text-slate-700 block select-none">
                              عدد أسئلة الصواب والخطأ:
                            </label>
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                              <input
                                type="number"
                                min={0}
                                max={25}
                                value={builderPdfTfCount}
                                onChange={(e) =>
                                  setBuilderPdfTfCount(
                                    Math.max(0, parseInt(e.target.value) || 0),
                                  )
                                }
                                className="bg-transparent font-black text-slate-800 text-sm focus:outline-none flex-1 font-sans text-center"
                              />
                              <span className="text-xs font-bold text-slate-400">
                                سؤال
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Custom prompt options */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-slate-500 flex items-center gap-1 justify-start">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>
                              توجيهات مخصصة لنموذج الذكاء الاصطناعي (اختياري)
                            </span>
                          </label>
                          <textarea
                            rows={3}
                            placeholder="مثال: ركز الأسئلة على الفصل الدراسي الثاني، أرشد النظام لتوليد 4 أسئلة في مستويات التفكير العليا..."
                            value={builderPdfCustomPrompt}
                            onChange={(e) =>
                              setBuilderPdfCustomPrompt(e.target.value)
                            }
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        {/* Generate button */}
                        <div className="flex justify-center pt-2">
                          <button
                            type="button"
                            disabled={
                              isBuilderPdfGenerating || !builderPdfBase64
                            }
                            onClick={handleGenerateBuilderQuestionsFromPdf}
                            className={`w-full sm:w-auto px-10 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-sm shadow-md transition duration-150 flex items-center justify-center gap-2 ${
                              !builderPdfBase64
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:from-emerald-700 hover:to-teal-700 cursor-pointer shadow-emerald-100"
                            }`}
                          >
                            <Sparkles className="w-4.5 h-4.5 text-emerald-100" />
                            <span>صياغة الأسئلة آلياً</span>
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Question drafts list review */}
                    {!isBuilderPdfGenerating && builderPdfDrafts.length > 0 ? (
                      <div className="space-y-4">
                        {/* Select helpers row */}
                        <div className="flex justify-between items-center text-xs text-slate-500 pb-2 border-b border-slate-100">
                          <div className="flex gap-2 font-sans">
                            <button
                              type="button"
                              onClick={() => {
                                const next: Record<number, boolean> = {};
                                builderPdfDrafts.forEach((_, idx) => {
                                  next[idx] = true;
                                });
                                setBuilderPdfSelectedDraftIndexes(next);
                              }}
                              className="text-emerald-700 font-extrabold hover:underline cursor-pointer"
                            >
                              تحديد الكل
                            </button>
                            <span>|</span>
                            <button
                              type="button"
                              onClick={() =>
                                setBuilderPdfSelectedDraftIndexes({})
                              }
                              className="text-slate-500 font-extrabold hover:underline cursor-pointer"
                            >
                              إلغاء تحديد الكل
                            </button>
                          </div>
                          <span className="font-bold">
                            تم استخراج{" "}
                            <span className="text-emerald-600 text-sm font-sans">
                              {builderPdfDrafts.length}
                            </span>{" "}
                            أسئلة منسقة. اختر الأسئلة المراد إدراجها بالامتحان
                            الحالي:
                          </span>
                        </div>

                        {/* Draft question Cards */}
                        <div className="space-y-3.5">
                          {builderPdfDrafts.map((draft, idx) => {
                            const isSelected =
                              !!builderPdfSelectedDraftIndexes[idx];
                            return (
                              <div
                                key={idx}
                                onClick={() => {
                                  setBuilderPdfSelectedDraftIndexes((prev) => ({
                                    ...prev,
                                    [idx]: !prev[idx],
                                  }));
                                }}
                                className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-4 ${
                                  isSelected
                                    ? "bg-emerald-50/20 border-emerald-500 shadow-xs"
                                    : "bg-white border-slate-200/80 hover:border-slate-300"
                                }`}
                              >
                                {/* Checkbox */}
                                <div
                                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition ${
                                    isSelected
                                      ? "bg-emerald-600 border-emerald-600 text-white"
                                      : "border-slate-350 text-transparent bg-white"
                                  }`}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </div>

                                {/* Details */}
                                <div className="flex-1 space-y-3 w-full">
                                  {/* Metadata labels row */}
                                  <div className="flex flex-wrap gap-1.5 items-center">
                                    {draft.stage && (
                                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] font-bold">
                                        {draft.stage}
                                      </span>
                                    )}
                                    {draft.grade && (
                                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 text-[9px] font-bold">
                                        {draft.grade}
                                      </span>
                                    )}
                                    {draft.subject && (
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-bold">
                                        {draft.subject}
                                      </span>
                                    )}
                                    {draft.semester && (
                                      <span className="px-2 py-0.5 rounded-md bg-orange-50 border border-orange-100 text-orange-700 text-[9px] font-bold">
                                        {draft.semester}
                                      </span>
                                    )}
                                    {draft.unit && (
                                      <span className="px-2 py-0.5 rounded-md bg-indigo-50/50 text-indigo-600 text-[9px] font-sans font-semibold">
                                        {draft.unit}
                                      </span>
                                    )}
                                    {draft.lesson && (
                                      <span className="px-2 py-0.5 rounded-md bg-teal-50/50 text-teal-600 text-[9px] font-sans font-semibold">
                                        {draft.lesson}
                                      </span>
                                    )}
                                    <span className="mr-auto text-[10px] font-bold text-slate-400 font-sans">
                                      {draft.points || 1}{" "}
                                      {(draft.points || 1) === 1
                                        ? "نقطة"
                                        : "نقاط"}
                                    </span>
                                  </div>

                                  {/* Question TEXT */}
                                  <p className="text-xs font-bold text-slate-800 leading-relaxed font-sans">
                                    {draft.text}
                                  </p>

                                  {/* Options */}
                                  {Array.isArray(draft.options) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
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
                                          const isCorrect =
                                            draft.type === "true_false"
                                              ? (oIdx === 0 &&
                                                  (draft.correctAnswer === "true" || draft.correctAnswer === "0" || draft.correctAnswer === "صح" || draft.correctAnswer === "صحيح" || draft.correctAnswer === "صواب")) ||
                                                (oIdx === 1 &&
                                                  (draft.correctAnswer === "false" || draft.correctAnswer === "1" || draft.correctAnswer === "خطأ" || draft.correctAnswer === "خاطئ" || draft.correctAnswer === "خاطئة"))
                                              : String(oIdx) ===
                                                draft.correctAnswer;
                                          return (
                                            <div
                                              key={oIdx}
                                              className={`p-2.5 rounded-xl text-xs font-sans border-r-4 flex items-center justify-between ${
                                                isCorrect
                                                  ? "bg-emerald-50/60 border-emerald-500 text-emerald-800 font-bold"
                                                  : "bg-slate-50 border-transparent text-slate-500"
                                              }`}
                                            >
                                              <span className="truncate">
                                                {optionText}
                                              </span>
                                              {isCorrect && (
                                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                              )}
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
                    {isBuilderPdfGenerating && (
                      <div className="flex flex-col items-center justify-center py-12 space-y-4">
                        <div className="w-12 h-12 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin"></div>
                        <div className="text-center space-y-1.5">
                          <p className="text-sm font-bold text-slate-800 font-sans">
                            يقوم الذكاء الاصطناعي بقراءة وتوليد الأسئلة للامتحان
                          </p>
                          <p className="text-xs text-slate-450 leading-relaxed font-sans max-w-md mx-auto">
                            نحلل محتوى ملف الـ PDF المدرج لاستخراج الأسئلة،
                            الخيارات، نقاط التقييم، وتحديد الإجابات الصحيحة لك
                            بدقة عالية...
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Exception/Error Display */}
                    {builderPdfError && (
                      <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-800">
                        <AlertTriangle className="w-5 h-5 text-rose-650 shrink-0 mt-0.5" />
                        <div className="text-right">
                          <p className="text-xs font-bold font-sans">
                            فشل معالجة المستند:
                          </p>
                          <p className="text-[11px] mt-0.5 leading-relaxed font-sans">
                            {builderPdfError}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    {builderPdfDrafts.length > 0 ? (
                      <>
                        <span className="text-xs font-bold text-indigo-850 font-sans">
                          تم تحديد{" "}
                          <span className="text-emerald-600 text-sm font-bold">
                            {
                              Object.values(
                                builderPdfSelectedDraftIndexes,
                              ).filter(Boolean).length
                            }
                          </span>{" "}
                          أسئلة لإضافتها لمسودتك.
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setBuilderPdfFile(null);
                              setBuilderPdfBase64("");
                              setBuilderPdfCustomPrompt("");
                              setBuilderPdfDrafts([]);
                              setBuilderPdfSelectedDraftIndexes({});
                              setBuilderPdfError(null);
                            }}
                            className="px-4.5 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-650 cursor-pointer transition font-sans"
                          >
                            إلغاء وتعديل الملف
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveBuilderPdfDrafts}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-100 cursor-pointer transition font-sans"
                          >
                            إدراج الأسئلة المحددة إلى الاختبار
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] text-slate-400 font-sans font-medium">
                          سري وحسابي بواسطة خدمات الذكاء الاصطناعي الآمن جولو.
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setBuilderPdfFile(null);
                            setBuilderPdfBase64("");
                            setBuilderPdfCustomPrompt("");
                            setBuilderPdfDrafts([]);
                            setBuilderPdfSelectedDraftIndexes({});
                            setBuilderPdfError(null);
                            setShowBuilderPdfModal(false);
                          }}
                          className="px-5 py-2 border border-slate-250 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition font-sans"
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

          {/* --- MODAL 1: QUIZ DETAIL VIEW --- */}
          <AnimatePresence>
            {selectedQuiz && (
              <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                >
                  {/* Header */}
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div className="space-y-1">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md uppercase">
                        مقرر {selectedQuiz.subject}
                      </span>
                      <h3 className="font-extrabold text-slate-800 text-base">
                        {selectedQuiz.title}
                      </h3>
                    </div>

                    <button
                      onClick={() => setSelectedQuiz(null)}
                      className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content body */}
                  <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Meta stats inside popup */}
                    <div className="grid grid-cols-3 gap-4 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 text-center">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">
                          زمن الاختبار التقديري
                        </span>
                        <span className="text-sm font-extrabold text-indigo-600 font-sans">
                          {selectedQuiz.durationMinutes} دقيقة
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">
                          عدد الأسئلة المدرجة
                        </span>
                        <span className="text-sm font-extrabold text-slate-700 font-sans">
                          {selectedQuiz.questions.length} أسئلة
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">
                          مجموع درجات الأسئلة
                        </span>
                        <span className="text-sm font-extrabold text-slate-700 font-sans">
                          {selectedQuiz.questions.reduce(
                            (sum, q) => sum + Number(q.points || 0),
                            0,
                          )}{" "}
                          درجة
                        </span>
                      </div>
                    </div>

                    {/* List of constructed Questions */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-sm text-slate-800">
                        تفاصيل هيكل الأسئلة الملحقة:
                      </h4>

                      {selectedQuiz.questions.map((q, idx) => (
                        <div
                          key={q.id}
                          className="p-4 rounded-xl border border-slate-100 hover:border-indigo-100 transition-colors bg-slate-50/30 space-y-3"
                        >
                          <div className="flex justify-between items-start gap-3">
                            <span className="font-bold text-xs text-indigo-600 font-sans shrink-0">
                              س{idx + 1}.
                            </span>
                            <p className="font-bold text-sm text-slate-800 flex-1">
                              {q.text}
                            </p>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-sans">
                              {q.points} د
                            </span>
                          </div>

                          {/* Options preview */}
                          {q.type === "multiple_choice" ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1.5 pr-6">
                              {q.options
                                .map((opt, oIdx) => ({ opt, oIdx }))
                                .filter(item => {
                                  if (!item.opt) return false;
                                  const t = item.opt.trim();
                                  return t !== '' && 
                                    t !== 'الخيار الثالث' && 
                                    t !== 'الخيار الرابع' && 
                                    t !== 'الخيار الثالث...' && 
                                    t !== 'الخيار الرابع...';
                                })
                                .map(({ opt, oIdx }) => (
                                  <div
                                    key={oIdx}
                                    className={`p-2 rounded-lg border flex items-center gap-2 ${
                                      q.correctAnswer === String(oIdx)
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold"
                                        : "bg-white border-slate-100 text-slate-500"
                                    }`}
                                  >
                                    {q.correctAnswer === String(oIdx) ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300"></span>
                                    )}
                                    <span>{opt}</span>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <div className="flex gap-4.5 pt-1.5 pr-6 text-xs">
                              <span
                                className={`px-3 py-1.5 rounded-lg border ${
                                  (q.correctAnswer === "true" || q.correctAnswer === "0" || q.correctAnswer === "صح" || q.correctAnswer === "صحيح" || q.correctAnswer === "صواب")
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-800 font-bold"
                                    : "bg-slate-50 border-slate-100 text-slate-400"
                                }`}
                              >
                                صحيح (True)
                              </span>
                              <span
                                className={`px-3 py-1.5 rounded-lg border ${
                                  (q.correctAnswer === "false" || q.correctAnswer === "1" || q.correctAnswer === "خطأ" || q.correctAnswer === "خاطئ" || q.correctAnswer === "خاطئة")
                                    ? "bg-rose-50 border-rose-250 text-rose-800 font-bold"
                                    : "bg-slate-50 border-slate-100 text-slate-400"
                                }`}
                              >
                                خطأ (False)
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer close */}
                  <div className="p-4 border-t border-slate-100 gap-3 justify-end flex bg-slate-50/50">
                    <button
                      onClick={() => {
                        const studentLink = `${window.location.origin}/?quizId=${selectedQuiz.id}&teacherId=${currentUser?.uid || selectedQuiz.teacherId || "demo_teacher"}`;
                        navigator.clipboard.writeText(studentLink);
                        triggerToast(
                          "تم نسخ رابط التقديم الفعلي بنجاح لمشاركته مع الطلاب",
                          "success",
                        );
                      }}
                      className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl font-bold text-xs text-indigo-700 flex items-center gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>نسخ رابط التقديم للطلاب</span>
                    </button>

                    <button
                      onClick={() => {
                        handleEditQuiz(selectedQuiz);
                        setSelectedQuiz(null);
                      }}
                      className="px-4 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl font-bold text-xs text-amber-700 flex items-center gap-2"
                    >
                      <Pencil className="w-4 h-4" />
                      <span>تعديل هذا الاختبار</span>
                    </button>

                    <button
                      onClick={() => setSelectedQuiz(null)}
                      className="px-5 py-2 hover:bg-slate-200 border border-transparent rounded-xl text-xs font-bold text-slate-600 transition-colors"
                    >
                      إغلاق النافذة
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* --- MODAL 2: STUDENT DETAILS BRIEF --- */}
          <AnimatePresence>
            {selectedStudent && (
              <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                >
                  {/* Header */}
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center text-sm">
                        {selectedStudent.name.substring(0, 2)}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm">
                          {selectedStudent.name}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                          {selectedStudent.gradeClass} | {selectedStudent.email}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedStudent(null)}
                      className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content body */}
                  <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Detailed average summary */}
                    <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">
                          المعدل التراكمي العام
                        </span>
                        <span
                          className={`text-lg font-extrabold font-sans ${
                            selectedStudent.averageScore >= 90
                              ? "text-emerald-650"
                              : "text-indigo-600"
                          }`}
                        >
                          {selectedStudent.averageScore}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-1">
                          الرتبة في التقييمات
                        </span>
                        <div className="pt-0.5">
                          {getStatusBadge(selectedStudent.status)}
                        </div>
                      </div>
                    </div>

                    {/* List of QuizzesTaken and Grades */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-sm text-slate-850">
                        كشف نتائج الكشوفات والاختبارات الفردية:
                      </h4>

                      <div className="space-y-2.5">
                        {selectedStudent.detailedGrades.map((grade, idx) => (
                          <div
                            key={idx}
                            className="p-4 rounded-xl border border-slate-100 flex justify-between items-center bg-slate-50/20"
                          >
                            <div className="space-y-1">
                              <span className="text-sm font-bold text-slate-800">
                                {grade.quizTitle}
                              </span>
                              <div className="flex items-center gap-3 text-xs text-slate-400 font-sans">
                                <span>التاريخ: {grade.date}</span>
                              </div>
                            </div>

                            <div className="text-left space-y-1">
                              <div className="text-sm font-extrabold text-slate-700 font-sans">
                                {grade.score} / {grade.maxScore}{" "}
                                <span className="text-[10px] text-slate-400">
                                  نقطة
                                </span>
                              </div>
                              <div>
                                {grade.passed ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-sm px-1.5 py-0.5">
                                    تم الاجتياز
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 border border-rose-100 rounded-sm px-1.5 py-0.5">
                                    يحتاج متابعة
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 gap-2 justify-end flex bg-slate-50/50">
                    <button
                      onClick={() => setSelectedStudent(null)}
                      className="px-5 py-2 hover:bg-slate-200 border border-transparent rounded-xl text-xs font-bold text-slate-600 transition-colors"
                    >
                      إغلاق النافذة
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>



          {/* --- TRASH BIN DIALOG --- */}
          <AnimatePresence>
            {showTrashModal && (
              <div className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                  dir="rtl"
                >
                  {/* Header */}
                  <div className="p-6 border-b border-slate-100 bg-amber-50/40 flex justify-between items-center text-right">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-amber-100/60 rounded-xl text-amber-700">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                          سلة المحذوفات وسلامة البيانات
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          تستعرض هذه السلة الطلاب المزالين؛ لمنع الحذف بالخطأ والحفاظ على كشوف النقاط.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTrashModal(false)}
                      className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Actions Bar */}
                  {trashStudents.length > 0 && (
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-100/70 flex justify-between items-center gap-4 text-xs font-sans">
                      <span className="text-slate-500 font-bold">
                        إجمالي المحذوفات المتاحة للاسترجاع:{" "}
                        <span className="text-slate-800 font-extrabold font-mono text-sm leading-none bg-slate-200/50 px-2 py-0.5 rounded-md">
                          {trashStudents.length}
                        </span>
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleRestoreAllTrash}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-3xs"
                        >
                          استعادة الكل 🔁
                        </button>
                        <button
                          type="button"
                          onClick={handleEmptyTrash}
                          className="bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700 font-bold px-3.5 py-1.5 rounded-xl transition-all cursor-pointer"
                        >
                          إفراغ السلة كلياً 🗑️
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Body Content */}
                  <div className="p-6 overflow-y-auto flex-1 min-h-[250px] bg-slate-50/20 text-right">
                    {trashStudents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                          <Trash2 className="w-8 h-8" />
                        </div>
                        <h4 className="font-extrabold text-slate-700 text-sm">سلة المحذوفات فارغة!</h4>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-sm leading-relaxed font-sans">
                          لم يتم نقل أي طالب لسلة المحذوفات المؤقتة في حسابك بعد. أي طالب ستقوم بحذفه مستقبلاً سيظهر هنا لحمايته من الفقدان المباشر والنهائي.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-[10px] text-amber-700 bg-amber-50 rounded-xl px-3 py-2 border border-amber-100 font-sans leading-relaxed">
                          ⚠️ ملحوظة: يمكنك استرجاع أي طالب مدرج أدناه وسيعود فوراً إلى مكانه المناسب بنفس درجاته ونتائجه واختباراته السابقة بدون أي نقص.
                        </p>
                        <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-3xs">
                          {trashStudents.map((student) => {
                            const originalGrade = student.grade || "غير محدد";
                            const originalSemester = student.semester || "غير محدد";
                            const deletedDate = student.deletedAt 
                              ? new Date(student.deletedAt).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }) 
                              : "غير معروف";

                            return (
                              <div
                                key={student.id}
                                className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors gap-4 text-right"
                              >
                                <div className="text-right">
                                  <h4 className="font-extrabold text-slate-800 text-xs">
                                    {student.name}
                                  </h4>
                                  <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 font-sans mt-1">
                                    <span>
                                      المرحلة: <span className="font-bold text-slate-600">{originalGrade}</span>
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                    <span>
                                      الفصل: <span className="font-bold text-slate-600">{originalSemester}</span>
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                    <span className="text-rose-500 font-bold">
                                      حُذف بتاريخ: {deletedDate}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleRestoreStudent(student.id)}
                                    className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-[10.5px] font-black transition-all cursor-pointer shadow-3xs"
                                  >
                                    إرجاع واستعادة 🔁
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePermanentDeleteStudent(student.id)}
                                    className="hover:bg-rose-50 text-slate-400 hover:text-rose-600 p-2 rounded-xl transition-all cursor-pointer"
                                    title="حذف نهائي مبرم"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowTrashModal(false)}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-3xs"
                    >
                      إغلاق نافذة السلة
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>



          {/* --- MODAL 4: MANAGE GRADES & SEMESTERS OPTIONS --- */}
          <AnimatePresence>
            {showGradesSemestersModal && (
              <div
                className="fixed inset-0 bg-slate-900/60 z-50 backdrop-blur-xs flex items-center justify-center p-4 font-sans"
                dir="rtl"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                  {/* Header */}
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-sm">
                        إدارة صفوف وفصول المدرسة
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        إضافة وتعديل وحذف الفصول الأكاديمية والمستويات الدراسية في المدرسة.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGrade(null);
                        setEditingSemester(null);
                        setShowGradesSemestersModal(false);
                      }}
                      className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Loading State or Seeding defaults indication */}
                  {modalSeeding ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center space-y-4">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      <p className="text-xs text-slate-500 font-bold">
                        جاري تهيئة خياراتك الافتراضية، يرجى الانتظار...
                      </p>
                    </div>
                  ) : (
                    <div className="p-6 overflow-y-auto space-y-6 flex-1">
                      <div className="space-y-4 pt-2">
                        <div className="space-y-4 pt-4 md:pt-0">
                          {/* Batch Add Grade Container (Multi-line / Excel Paste) */}
                          <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 space-y-3 shadow-3xs">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <label className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                                <span>إضافة صفوف دراسية (كل صف في سطر):</span>
                              </label>
                              <span className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-2xs">
                                <span>سطر لكل صف او يمكنك نسخ ولصق من ملف اكسل</span>
                              </span>
                            </div>

                            <textarea
                              rows={3}
                              placeholder={`مثال:\nالصف الأول الثانوي\nالصف الثاني الثانوي\nالصف الثالث الثانوي`}
                              value={newGradeInput}
                              onChange={(e) => setNewGradeInput(e.target.value)}
                              onKeyDown={(e) => {
                                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddGrade();
                                }
                              }}
                              className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans resize-none placeholder:text-slate-400 leading-relaxed"
                            />

                            <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
                              <button
                                type="button"
                                onClick={handleAddGrade}
                                className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                <Plus className="w-4 h-4" />
                                <span>إضافة الصفوف</span>
                              </button>
                              <span className="text-[11px] font-medium text-slate-400">
                                ملاحظة: اضغط Ctrl + Enter أو زر الإضافة للحفظ
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <h4 className="font-bold text-xs text-indigo-600 flex items-center gap-1.5 pb-2">
                              <Layers className="w-4 h-4" />
                              <span>
                                الصفوف الدراسية المتاحة ({gradesList.length})
                              </span>
                            </h4>
                          </div>

                          {/* List */}
                          <div className="space-y-3 max-h-[480px] overflow-y-auto scrollbar-thin p-0.5">
                            {gradesList.map((g) => {
                              const isEditing = editingGrade?.original === g;
                              const isSelected = selectedManageGrade === g;
                              const activeSemList = getSemestersForGrade(g);
                              const gradeStudentsCount = students.filter(
                                (student) => {
                                  const sGrade =
                                    student.grade ||
                                    (student.gradeClass &&
                                    student.gradeClass.includes(" - ")
                                      ? student.gradeClass
                                          .split(" - ")[0]
                                          .trim()
                                      : "الصف العاشر");
                                  const sSemester =
                                    student.semester ||
                                    (student.gradeClass &&
                                    student.gradeClass.includes(" - ")
                                      ? student.gradeClass.split(" - ")[1].trim()
                                      : "الفصل الأول");
                                  return (
                                    normalizeGradeName(sGrade) ===
                                      normalizeGradeName(g) &&
                                    activeSemList.some(
                                      (sem) => normalizeSemesterName(sem) === normalizeSemesterName(sSemester)
                                    )
                                  );
                                },
                              ).length;

                              return (
                                <div
                                  key={g}
                                  onClick={() => {
                                    if (!isEditing) {
                                      setSelectedManageGrade(g);
                                      setSelectedSemesterNumbers([]);
                                    }
                                  }}
                                  className={`flex flex-col p-3.5 rounded-2xl border-2 transition-all gap-2.5 cursor-pointer shadow-2xs ${
                                    isSelected
                                      ? "bg-indigo-50/90 border-indigo-500 text-indigo-700 shadow-sm ring-2 ring-indigo-500/20"
                                      : "bg-white border-slate-300 hover:border-indigo-400 hover:shadow-sm text-slate-700"
                                  }`}
                                >
                                  {/* Grade Header */}
                                  <div className="flex items-center justify-between gap-2 w-full">
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={editingGrade.current}
                                        onChange={(e) =>
                                          setEditingGrade({
                                            ...editingGrade,
                                            current: e.target.value,
                                          })
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex-1 bg-white border border-indigo-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                                      />
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                                        <span
                                          className="text-xs font-black text-indigo-700 bg-indigo-100/80 border border-indigo-200/80 px-2.5 py-0.5 rounded-lg shadow-2xs"
                                        >
                                          {g}
                                        </span>
                                      </div>
                                    )}

                                    <div
                                      className="flex items-center gap-1.5"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {!isEditing && gradeStudentsCount > 0 && (
                                        <span
                                          className="text-xs font-black text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-md border border-rose-100/50 flex items-center gap-0.5"
                                          title="عدد الطلاب"
                                        >
                                          <span>{gradeStudentsCount}</span>
                                          <span className="text-[10px] opacity-80">
                                            طالب
                                          </span>
                                        </span>
                                      )}

                                      {isEditing ? (
                                        <>
                                          <button
                                            type="button"
                                            onClick={handleUpdateGrade}
                                            className="p-1 hover:bg-emerald-100 hover:text-emerald-750 rounded-lg text-emerald-600 transition-colors cursor-pointer"
                                            title="حفظ التعديل"
                                          >
                                            <Check className="w-4 h-4" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingGrade(null)}
                                            className="p-1 hover:bg-slate-200 hover:text-slate-700 rounded-lg text-slate-400 transition-colors cursor-pointer"
                                            title="إلغاء التعديل"
                                          >
                                            <X className="w-4 h-4 text-slate-400" />
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setEditingGrade({
                                                original: g,
                                                current: g,
                                              })
                                            }
                                            className="p-1 hover:bg-indigo-100 hover:text-indigo-700 rounded-lg text-slate-400 transition-colors cursor-pointer"
                                            title="تعديل المسمى"
                                          >
                                            <Settings className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteGrade(g)}
                                            className="p-1 hover:bg-rose-100 hover:text-rose-700 rounded-lg text-slate-400 transition-colors cursor-pointer"
                                            title="حذف الصف"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Number Buttons (1 to 10) inside the Grade Box */}
                                  <div
                                    className="pt-2.5 border-t-2 border-slate-200/90 w-full"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* Check if grade has any semesters */}
                                    {(() => {
                                      const hasSemesters = semesters.some(
                                        (s) => normalizeGradeName(s.gradeName) === normalizeGradeName(g)
                                      );
                                      return (
                                        <>
                                          {/* Alert notice if no semesters added yet */}
                                          {!hasSemesters && (
                                            <div className="mb-2 p-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] flex items-center gap-1.5 shadow-2xs animate-pulse">
                                              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                              <span className="font-extrabold leading-tight">
                                                تنبيه: اضغط على أرقام الفصول أدناه (1، 2...) لإضافة فصول هذا الصف.
                                              </span>
                                            </div>
                                          )}

                                          {/* Numbers 1 to 10 for direct toggle (add / delete) */}
                                          <div className="w-full">
                                            <div className="flex items-center justify-between mb-1.5">
                                              <span className="text-[10.5px] font-black text-indigo-900 block">
                                                فصول الصف (اضغط على الرقم للإضافة أو الحذف):
                                              </span>
                                            </div>
                                            <div className="grid grid-cols-10 gap-1.5 w-full">
                                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                                                const semName = `الفصل ${num}`;
                                                const sDoc = semesters.find(
                                                  (s) =>
                                                    normalizeGradeName(s.gradeName) === normalizeGradeName(g) &&
                                                    (s.number === num || normalizeSemesterName(s.name) === normalizeSemesterName(semName))
                                                );
                                                const isAdded = !!sDoc;

                                                const semStudentsCount = students.filter((student) => {
                                                  const sGrade =
                                                    student.grade ||
                                                    (student.gradeClass && student.gradeClass.includes(" - ")
                                                      ? student.gradeClass.split(" - ")[0].trim()
                                                      : "");
                                                  const sSemester =
                                                    student.semester ||
                                                    (student.gradeClass && student.gradeClass.includes(" - ")
                                                      ? student.gradeClass.split(" - ")[1].trim()
                                                      : "");

                                                  if (normalizeGradeName(sGrade) !== normalizeGradeName(g)) return false;

                                                  if (sDoc && normalizeSemesterName(sSemester) === normalizeSemesterName(sDoc.name)) {
                                                    return true;
                                                  }
                                                  return (
                                                    normalizeSemesterName(sSemester) === normalizeSemesterName(semName) ||
                                                    normalizeSemesterName(sSemester) === normalizeSemesterName(`${num}`)
                                                  );
                                                }).length;

                                                return (
                                                  <div key={num} className="w-full">
                                                    {isAdded ? (
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          if (sDoc) {
                                                            handleDeleteSemester(sDoc.id, sDoc.name, g);
                                                          }
                                                        }}
                                                        className="w-full rounded-md overflow-hidden flex flex-col border border-indigo-600 shadow-3xs cursor-pointer group active:scale-95 transition-all"
                                                        title={`${semName} مضاف (${semStudentsCount} طالب) — اضغط لحذفه`}
                                                      >
                                                        <div className="w-full bg-indigo-600 group-hover:bg-rose-600 text-white py-1 px-0.5 text-[11px] font-black flex items-center justify-center gap-0.5 transition-colors">
                                                          <Check className="w-2.5 h-2.5 text-white shrink-0 group-hover:hidden" />
                                                          <X className="w-2.5 h-2.5 text-white shrink-0 hidden group-hover:block" />
                                                          <span>{num}</span>
                                                        </div>
                                                        <div className="w-full bg-rose-50 text-rose-600 py-0.5 px-0.5 text-[9.5px] font-black text-center leading-tight border-t border-rose-200/60 flex flex-col items-center justify-center">
                                                          <span>{semStudentsCount}</span>
                                                          <span className="text-[7.5px] font-bold text-rose-500 leading-none">طالب</span>
                                                        </div>
                                                      </button>
                                                    ) : (
                                                      <button
                                                        type="button"
                                                        onClick={() => addSingleSemesterToGrade(g, num)}
                                                        className="w-full rounded-md overflow-hidden flex flex-col border border-indigo-200 hover:border-indigo-600 shadow-3xs cursor-pointer group active:scale-95 transition-all"
                                                        title={`إضافة ${semName} لـ ${g}`}
                                                      >
                                                        <div className="w-full bg-white group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white py-1 px-0.5 text-[11px] font-bold flex items-center justify-center gap-0.5 transition-colors">
                                                          <Plus className="w-2 h-2 text-indigo-500 group-hover:text-white shrink-0" />
                                                          <span>{num}</span>
                                                        </div>
                                                        <div className="w-full bg-rose-50 text-rose-600 py-0.5 px-0.5 text-[9.5px] font-black text-center leading-tight border-t border-indigo-100 flex flex-col items-center justify-center">
                                                          <span>{semStudentsCount}</span>
                                                          <span className="text-[7.5px] font-bold text-rose-500 leading-none">طالب</span>
                                                        </div>
                                                      </button>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer close */}
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={handleResetAllData}
                      className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-3xs"
                    >
                      <Trash2 className="w-4 h-4 shrink-0" />
                      <span>مسح وإعادة تعيين كافة الفصول والطلاب</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingGrade(null);
                        setEditingSemester(null);
                        setShowGradesSemestersModal(false);
                      }}
                      className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      حفظ التغييرات وإغلاق
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
              dir="rtl"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 text-slate-900 mb-3">
                  <AlertTriangle className="w-6 h-6 shrink-0 text-amber-500 animate-pulse" />
                  <h3 className="text-base font-black text-slate-900">
                    {confirmDialog.title}
                  </h3>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed font-semibold">
                  {confirmDialog.message}
                </p>
              </div>
              <div className="bg-slate-50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-3 justify-start">
                <button
                  type="button"
                  disabled={isConfirmLoading}
                  onClick={confirmDialog.onConfirm}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                    isConfirmLoading
                      ? "bg-slate-400 text-white border-slate-400 cursor-not-allowed shadow-none"
                      : "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-100"
                  }`}
                >
                  {isConfirmLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0"></span>
                      <span>جاري التنفيذ...</span>
                    </>
                  ) : (
                    confirmDialog.confirmText || "تأكيد"
                  )}
                </button>
                <button
                  type="button"
                  disabled={isConfirmLoading}
                  onClick={confirmDialog.onCancel}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all border border-transparent ${
                    isConfirmLoading
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "hover:bg-slate-200 bg-slate-100 text-slate-700 cursor-pointer"
                  }`}
                >
                  {confirmDialog.cancelText || "إلغاء الإجراء"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Loader with Progress Indicator */}
      <AnimatePresence>
        {globalLoading && globalLoading.active && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-150 p-6 flex flex-col items-center justify-center text-center"
              dir="rtl"
            >
              <div className="relative flex items-center justify-center w-16 h-16 mb-4">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-t-emerald-600 border-r-emerald-500 rounded-full animate-spin"></div>
                <Sparkles className="w-6 h-6 text-emerald-600 animate-pulse absolute" />
              </div>
              <h3 className="text-base font-black text-slate-800 mb-2">
                {globalLoading.message || "جاري التنفيذ..."}
              </h3>
              <p className="text-xs text-slate-400 font-medium animate-pulse">
                يرجى عدم إغلاق الصفحة حتى اكتمال العملية
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
