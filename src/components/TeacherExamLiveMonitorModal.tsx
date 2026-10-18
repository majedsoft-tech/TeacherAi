import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Maximize2,
  AlertTriangle,
  Users,
  Clock,
  RefreshCw,
  Trash2,
  X,
  Volume2,
  VolumeX,
  Laptop,
  Copy,
  Check,
  Download,
  Search,
  RotateCcw,
  UserX,
  Eye,
  CheckCircle2,
  Terminal,
  LayoutGrid,
  List,
  Layers,
  GraduationCap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { LiveStudentSession, Quiz, Student } from "../types";

interface TeacherExamLiveMonitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  quiz?: Quiz | null;
  teacherId?: string;
  students?: Student[];
  triggerToast: (msg: string, type: "success" | "error" | "info" | "warning") => void;
}

export const TeacherExamLiveMonitorModal: React.FC<TeacherExamLiveMonitorModalProps> = ({
  isOpen,
  onClose,
  quiz,
  teacherId,
  students,
  triggerToast,
}) => {
  const [sessions, setSessions] = useState<LiveStudentSession[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedGradeClass, setSelectedGradeClass] = useState<string>("all");
  const [groupByGradeClass, setGroupByGradeClass] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedStudentForLogs, setSelectedStudentForLogs] = useState<LiveStudentSession | null>(null);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"students" | "kiosk_setup">("students");

  const [studentsList, setStudentsList] = useState<Student[]>(students || []);
  const [standaloneResults, setStandaloneResults] = useState<any[]>([]);

  const prevViolationsCountRef = useRef<Record<string, number>>({});
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Sync passed students prop
  useEffect(() => {
    if (students && students.length > 0) {
      setStudentsList(students);
    }
  }, [students]);

  // Live Firestore subscription for Students collection (to detect recorded grades)
  useEffect(() => {
    if (!isOpen) return;
    try {
      const unsub = onSnapshot(collection(db, "students"), (snapshot) => {
        const list: Student[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id } as Student);
        });
        setStudentsList(list);
      });
      return () => unsub();
    } catch (err) {
      console.warn("Could not subscribe to students in proctoring modal:", err);
    }
  }, [isOpen]);

  // Live Firestore subscription for Standalone results
  useEffect(() => {
    if (!isOpen) return;
    try {
      const q = quiz?.id
        ? query(collection(db, "standalone_results"), where("quizId", "==", quiz.id))
        : collection(db, "standalone_results");
      const unsub = onSnapshot(q, (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ ...docSnap.data(), id: docSnap.id });
        });
        setStandaloneResults(list);
      });
      return () => unsub();
    } catch {}
  }, [isOpen, quiz?.id]);

  // Play Alert Beep for Teacher when a student violates
  const playAlertSound = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.setValueAtTime(900, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  };

  // BroadcastChannel listener for local instantaneous sync
  useEffect(() => {
    try {
      broadcastChannelRef.current = new BroadcastChannel("exam_proctoring_channel");
      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data?.type === "STUDENT_HEARTBEAT" && event.data.data) {
          const incoming = event.data.data as LiveStudentSession;
          if (quiz && incoming.quizId !== quiz.id) return;

          setSessions((prev) => {
            const index = prev.findIndex((s) => s.id === incoming.id);
            if (index >= 0) {
              const updated = [...prev];
              updated[index] = incoming;
              return updated;
            } else {
              return [...prev, incoming];
            }
          });
        }
      };
    } catch {}

    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [quiz]);

  // Firestore listener
  useEffect(() => {
    if (!isOpen) return;

    let unsub: (() => void) | null = null;
    try {
      let q = collection(db, "exam_proctoring");
      unsub = onSnapshot(q, (snapshot) => {
        const list: LiveStudentSession[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as LiveStudentSession;
          if (quiz && data.quizId && data.quizId !== quiz.id) {
            return;
          }
          if (teacherId && data.teacherId && data.teacherId !== teacherId) {
            return;
          }
          list.push({ ...data, id: docSnap.id });
        });

        // Check if any student had a new violation to trigger sound
        list.forEach((s) => {
          const prev = prevViolationsCountRef.current[s.id] || 0;
          if (s.violationsCount > prev) {
            playAlertSound();
            triggerToast(
              `⚠️ مخالفة جديدة: الطالب ${s.studentName} غادر شاشة الاختبار (${s.violationsCount}/${s.maxViolations})`,
              "warning"
            );
          }
          prevViolationsCountRef.current[s.id] = s.violationsCount;
        });

        setSessions(list);
      });
    } catch (err) {
      console.error("Error subscribing to exam proctoring sessions:", err);
    }

    return () => {
      if (unsub) unsub();
    };
  }, [isOpen, quiz, teacherId, soundEnabled, triggerToast]);

  // Reset Student Violations (Teacher forgiveness)
  const handleResetStrikes = async (session: LiveStudentSession) => {
    try {
      const ref = doc(db, "exam_proctoring", session.id);
      await updateDoc(ref, {
        violationsCount: 0,
        status: "active",
        violations: [],
      });
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: "RESET_STUDENT_SESSION",
            studentId: session.studentId,
            quizId: session.quizId,
          });
        } catch {}
      }
      triggerToast(`تمت إعادة ضبط إنذارات الطالب ${session.studentName} بنجاح 🟢`, "success");
    } catch (err) {
      triggerToast("حدث خطأ أثناء إعادة ضبط الإنذارات", "error");
    }
  };

  // Disqualify / Force Submit Student
  const handleDisqualifyStudent = async (session: LiveStudentSession) => {
    if (
      !window.confirm(
        `هل أنت متأكد من استبعاد الطالب "${session.studentName}" وإنهاء اختباره فوراً؟`
      )
    ) {
      return;
    }

    try {
      const ref = doc(db, "exam_proctoring", session.id);
      await updateDoc(ref, {
        status: "disqualified",
        disqualifiedAt: Date.now(),
      });
      triggerToast(`تم استبعاد الطالب ${session.studentName} من الاختبار 🛑`, "info");
    } catch (err) {
      triggerToast("حدث خطأ أثناء استبعاد الطالب", "error");
    }
  };

  // Delete session record from list
  const handleDeleteSession = async (session: LiveStudentSession) => {
    try {
      const ref = doc(db, "exam_proctoring", session.id);
      await deleteDoc(ref);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({
            type: "RESET_STUDENT_SESSION",
            studentId: session.studentId,
            quizId: session.quizId,
          });
        } catch {}
      }
      triggerToast("تم مسح السجل", "info");
    } catch {}
  };

  // Unique Grade & Classes available across sessions
  const availableGradeClasses = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      const gc = s.gradeClass?.trim();
      if (gc) {
        set.add(gc);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ar"));
  }, [sessions]);

  // Check if a student has completed the quiz and get their recorded score
  const getStudentCompletionData = useCallback(
    (session: LiveStudentSession) => {
      // 1. Direct fields on session from exam_proctoring document
      if (
        session.isCompleted ||
        session.status === "submitted" ||
        session.score !== undefined
      ) {
        const s = Number(session.score) || 0;
        const ms = Number(session.maxScore) || session.totalQuestions || 10;
        const pct = session.percentage ?? Math.round((s / (ms || 1)) * 100);
        return {
          isCompleted: true,
          score: s,
          maxScore: ms,
          percentage: pct,
        };
      }

      // 2. Check matched student in studentsList (detailedGrades recorded for this student)
      const normName = session.studentName?.trim().toLowerCase();
      const student = studentsList.find(
        (st) =>
          st.id === session.studentId ||
          (st.name && normName && st.name.trim().toLowerCase() === normName)
      );

      if (student && Array.isArray(student.detailedGrades)) {
        const grade = student.detailedGrades.find((g: any) => {
          if (quiz && g.quizId && (g.quizId === quiz.id || g.quizId === (quiz as any).title)) return true;
          if (quiz && g.quizTitle && quiz.title && g.quizTitle.trim() === quiz.title.trim()) return true;
          if (session.quizId && g.quizId === session.quizId) return true;
          if (session.quizTitle && g.quizTitle && g.quizTitle.trim() === session.quizTitle.trim()) return true;
          return false;
        });

        if (grade) {
          const s = Number(grade.score) || 0;
          const ms = Number(grade.maxScore) || session.totalQuestions || 10;
          const pct = Math.round((s / (ms || 1)) * 100);
          return {
            isCompleted: true,
            score: s,
            maxScore: ms,
            percentage: pct,
          };
        }
      }

      // 3. Check standalone_results
      const standalone = standaloneResults.find(
        (sub) =>
          (sub.studentId === session.studentId ||
            (sub.studentName && normName && sub.studentName.trim().toLowerCase() === normName)) &&
          ((quiz && (sub.quizId === quiz.id || sub.quizTitle === quiz.title)) ||
            (session.quizId && sub.quizId === session.quizId) ||
            (session.quizTitle && sub.quizTitle === session.quizTitle))
      );

      if (standalone) {
        const s = Number(standalone.score) || 0;
        const ms = Number(standalone.maxScore) || session.totalQuestions || 10;
        const pct = standalone.percentage ?? Math.round((s / (ms || 1)) * 100);
        return {
          isCompleted: true,
          score: s,
          maxScore: ms,
          percentage: pct,
        };
      }

      return { isCompleted: false, score: 0, maxScore: 0, percentage: 0 };
    },
    [studentsList, standaloneResults, quiz]
  );

  // Filtered Students
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.gradeClass && s.gradeClass.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      const comp = getStudentCompletionData(s);

      if (filterStatus === "completed") return comp.isCompleted;
      if (filterStatus === "active") return s.status === "active" && !comp.isCompleted;
      if (filterStatus === "warning") return (s.status === "warning" || s.violationsCount > 0) && s.status !== "disqualified";
      if (filterStatus === "disqualified") return s.status === "disqualified";

      if (selectedGradeClass !== "all") {
        const studentGC = (s.gradeClass || "").trim();
        if (studentGC !== selectedGradeClass) return false;
      }

      return true;
    });
  }, [sessions, searchQuery, filterStatus, selectedGradeClass, getStudentCompletionData]);

  // Grouped Students by Grade & Class
  const groupedSessions = useMemo(() => {
    const map: Record<string, LiveStudentSession[]> = {};
    filteredSessions.forEach((s) => {
      const key = (s.gradeClass && s.gradeClass.trim()) || "غير محدد الصف والفصل";
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return map;
  }, [filteredSessions]);

  // Statistics
  const totalCount = sessions.length;
  const completedCount = useMemo(() => {
    return sessions.filter((s) => getStudentCompletionData(s).isCompleted).length;
  }, [sessions, getStudentCompletionData]);
  const compliantCount = useMemo(() => {
    return sessions.filter(
      (s) => s.status === "active" && s.isFullscreen && s.violationsCount === 0 && !getStudentCompletionData(s).isCompleted
    ).length;
  }, [sessions, getStudentCompletionData]);
  const warningCount = useMemo(() => {
    return sessions.filter(
      (s) => s.violationsCount > 0 && s.status !== "disqualified" && !getStudentCompletionData(s).isCompleted
    ).length;
  }, [sessions, getStudentCompletionData]);
  const disqualifiedCount = sessions.filter((s) => s.status === "disqualified").length;

  // Real Applet Platform URL for Kiosk shortcut
  const examUrl = typeof window !== "undefined" ? window.location.origin : "https://my-exam-lab.web.app";
  const chromeKioskCmd = `chrome.exe --kiosk --disable-features=Translate "${examUrl}"`;
  const edgeKioskCmd = `msedge.exe --kiosk "${examUrl}" --edge-kiosk-type=fullscreen`;

  const copyToClipboard = (cmd: string, key: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(key);
    triggerToast("تم نسخ أمر التشغيل بنجاح! 📋", "success");
    setTimeout(() => setCopiedCmd(null), 2500);
  };

  // Generate & Download .bat file for 1-click lab setup
  const downloadBatchScript = () => {
    const batContent = `@echo off
:: Safe Exam Kiosk Launcher for Computer Lab
:: المنصة التعليمية - تشغيل الاختبار الآمن المقفل في معمل الحاسب
title تشغيل اختبار معمل الحاسب الآلي
cls
echo ========================================================
echo جاري تشغيل شاشة الاختبار الآمن بوضع الكشك المقيد (Kiosk Mode)...
echo ========================================================

start "" chrome.exe --kiosk --disable-features=Translate "${examUrl}"
if %ERRORLEVEL% NEQ 0 (
    start "" msedge.exe --kiosk "${examUrl}" --edge-kiosk-type=fullscreen
)
exit
`;
    const blob = new Blob([batContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Safe-Exam-Lab-Launcher.bat";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    triggerToast("تم تحميل ملف التشغيل التلقائي بنجاح (Safe-Exam-Lab-Launcher.bat) 💾", "success");
  };

  const renderStudentCard = (session: LiveStudentSession) => {
    const comp = getStudentCompletionData(session);
    const isWarned = session.violationsCount > 0;
    const isDisq = session.status === "disqualified";
    const isFs = session.isFullscreen;

    return (
      <div
        key={session.id}
        className={`bg-white rounded-2xl border p-4 shadow-xs transition-all relative flex flex-col justify-between space-y-3.5 ${
          isDisq
            ? "border-rose-400 bg-rose-50/30"
            : comp.isCompleted
            ? "border-emerald-300 bg-emerald-50/20"
            : isWarned
            ? "border-amber-300 bg-amber-50/20"
            : "border-slate-200 hover:border-indigo-300"
        }`}
      >
        {/* Top Bar of Student Card */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <h4 className="font-black text-sm text-slate-900 truncate">
              {session.studentName}
            </h4>
            <span className="text-[11px] text-slate-500 font-bold block truncate">
              {session.gradeClass || "طالب اختبار"}
            </span>
          </div>

          {/* Status Tag */}
          <div>
            {isDisq ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                <UserX className="w-3 h-3 text-rose-600" />
                <span>مستبعد 🛑</span>
              </span>
            ) : comp.isCompleted ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>تم التسليم والرصد 🎓</span>
              </span>
            ) : isWarned ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1 animate-pulse">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>{session.violationsCount} إنذارات ⚠️</span>
              </span>
            ) : isFs ? (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                <span>ملتزم 🟢</span>
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                <span>خارج التكبير</span>
              </span>
            )}
          </div>
        </div>

        {/* Middle Details: Progress & Fullscreen indicator */}
        <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-150 space-y-2 text-xs font-bold text-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">موقع الطالب:</span>
            {comp.isCompleted ? (
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>انتهى الاختبار</span>
                </span>
                <span className="font-sans font-black text-xs text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                  الدرجة: <strong className="text-emerald-700 font-extrabold">{comp.score}</strong>/{comp.maxScore}
                  <span className="text-[10px] text-indigo-600 mr-1">({comp.percentage}%)</span>
                </span>
              </div>
            ) : (
              <span className="font-sans font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                السؤال {(session.currentQuestionIdx || 0) + 1} من {session.totalQuestions || "—"}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">وضع ملء الشاشة:</span>
            {comp.isCompleted ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 bg-slate-150 text-slate-600 border border-slate-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>اكتملت الجلسة بنجاح</span>
              </span>
            ) : (
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 ${
                  isFs
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-rose-100 text-rose-800 animate-pulse"
                }`}
              >
                <Maximize2 className="w-3 h-3" />
                <span>{isFs ? "مفعل (داخل الاختبار)" : "معطل / خارج المتصفح"}</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">سجل الإنذارات:</span>
            <span
              className={`font-sans font-black text-xs ${
                session.violationsCount === 0
                  ? "text-emerald-700"
                  : "text-rose-700 font-extrabold"
              }`}
            >
              {session.violationsCount} من {session.maxViolations || 3}
            </span>
          </div>
        </div>

        {/* Card Action Buttons */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedStudentForLogs(session)}
            className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-black rounded-lg transition flex items-center justify-center gap-1 cursor-pointer"
            title="عرض سجل مخالفات الطالب"
          >
            <Eye className="w-3 h-3 text-indigo-600" />
            <span>السجل ({session.violations?.length || 0})</span>
          </button>

          {session.violationsCount > 0 && (
            <button
              type="button"
              onClick={() => handleResetStrikes(session)}
              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-black rounded-lg border border-amber-200 transition flex items-center justify-center gap-1 cursor-pointer"
              title="إعادة ضبط الإنذارات وإعطاء فرصة"
            >
              <RotateCcw className="w-3 h-3 text-amber-600" />
              <span>عفو</span>
            </button>
          )}

          {!isDisq && (
            <button
              type="button"
              onClick={() => handleDisqualifyStudent(session)}
              className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-black rounded-lg border border-rose-200 transition flex items-center justify-center gap-1 cursor-pointer"
              title="استبعاد الطالب وإنهاء الاختبار فوراً"
            >
              <UserX className="w-3 h-3" />
              <span>استبعاد</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleDeleteSession(session)}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            title="مسح من القائمة"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderStudentRow = (session: LiveStudentSession) => {
    const comp = getStudentCompletionData(session);
    const isWarned = session.violationsCount > 0;
    const isDisq = session.status === "disqualified";
    const isFs = session.isFullscreen;

    return (
      <tr
        key={session.id}
        className={`border-b transition-colors ${
          isDisq
            ? "bg-rose-50/50 hover:bg-rose-50/80 border-rose-200"
            : comp.isCompleted
            ? "bg-emerald-50/30 hover:bg-emerald-50/70 border-emerald-100"
            : isWarned
            ? "bg-amber-50/40 hover:bg-amber-50/80 border-amber-200"
            : "bg-white hover:bg-slate-50/80 border-slate-150"
        }`}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                isDisq
                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                  : comp.isCompleted
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  : isWarned
                  ? "bg-amber-100 text-amber-900 border border-amber-200"
                  : "bg-indigo-50 text-indigo-700 border border-indigo-100"
              }`}
            >
              {session.studentName.trim().charAt(0) || "ط"}
            </div>
            <div className="min-w-0">
              <h4 className="font-black text-xs sm:text-sm text-slate-900 truncate">
                {session.studentName}
              </h4>
              <span className="text-[11px] text-slate-500 font-bold block truncate">
                {session.gradeClass || "غير محدد الصف/الفصل"}
              </span>
            </div>
          </div>
        </td>

        {/* Status Badge */}
        <td className="px-4 py-3 whitespace-nowrap">
          {isDisq ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
              <UserX className="w-3 h-3 text-rose-600" />
              <span>مستبعد 🛑</span>
            </span>
          ) : comp.isCompleted ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>تم التسليم والرصد 🎓</span>
            </span>
          ) : isWarned ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1 animate-pulse">
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              <span>{session.violationsCount} إنذارات ⚠️</span>
            </span>
          ) : isFs ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>ملتزم 🟢</span>
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200 inline-flex items-center gap-1">
              <span>خارج التكبير</span>
            </span>
          )}
        </td>

        {/* Fullscreen status */}
        <td className="px-4 py-3 whitespace-nowrap">
          {comp.isCompleted ? (
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>اكتملت الجلسة</span>
            </span>
          ) : (
            <span
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black inline-flex items-center gap-1 ${
                isFs
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200 animate-pulse"
              }`}
            >
              <Maximize2 className="w-3 h-3" />
              <span>{isFs ? "ملء الشاشة نشط" : "خارج المتصفح"}</span>
            </span>
          )}
        </td>

        {/* موقع الطالب / النتيجة - CSS Selector 1 */}
        <td className="px-4 py-3 whitespace-nowrap">
          {comp.isCompleted ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>انتهى الاختبار</span>
              </span>
              <span className="font-sans font-black text-xs text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 inline-flex items-center gap-1 shadow-2xs">
                <span className="text-slate-500 font-bold">الدرجة:</span>
                <span className="text-emerald-700 text-sm font-extrabold">{comp.score}</span>
                <span className="text-slate-400 font-normal">/</span>
                <span className="text-slate-700">{comp.maxScore}</span>
                <span className="text-[10px] text-indigo-600 font-bold mr-0.5">({comp.percentage}%)</span>
              </span>
            </div>
          ) : (
            <span className="font-sans font-bold text-xs text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 inline-block">
              السؤال {(session.currentQuestionIdx || 0) + 1} من {session.totalQuestions || "—"}
            </span>
          )}
        </td>

        {/* Violations Count */}
        <td className="px-4 py-3 whitespace-nowrap">
          <span
            className={`font-sans font-black text-xs ${
              session.violationsCount === 0
                ? "text-emerald-700"
                : "text-rose-700 font-extrabold"
            }`}
          >
            {session.violationsCount} من {session.maxViolations || 3}
          </span>
        </td>

        {/* Actions */}
        <td className="px-4 py-3 whitespace-nowrap text-left">
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedStudentForLogs(session)}
              className="py-1 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-black rounded-lg transition flex items-center gap-1 cursor-pointer"
              title="عرض سجل مخالفات الطالب"
            >
              <Eye className="w-3 h-3 text-indigo-600" />
              <span>السجل ({session.violations?.length || 0})</span>
            </button>

            {session.violationsCount > 0 && (
              <button
                type="button"
                onClick={() => handleResetStrikes(session)}
                className="py-1 px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-black rounded-lg border border-amber-200 transition flex items-center gap-1 cursor-pointer"
                title="إعادة ضبط الإنذارات للطالب"
              >
                <RotateCcw className="w-3 h-3 text-amber-600" />
                <span>عفو</span>
              </button>
            )}

            {!isDisq && (
              <button
                type="button"
                onClick={() => handleDisqualifyStudent(session)}
                className="py-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-black rounded-lg border border-rose-200 transition flex items-center gap-1 cursor-pointer"
                title="استبعاد الطالب"
              >
                <UserX className="w-3 h-3" />
                <span>استبعاد</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDeleteSession(session)}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="مسح من القائمة"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none font-sans"
      dir="rtl"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:px-8 sm:py-6 flex flex-wrap items-center justify-between gap-4 border-b border-indigo-900 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-300 shadow-lg">
              <ShieldAlert className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white">
                  شاشة المراقبة اللحظية للاختبار بالمعمل
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  مباشر (Live)
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                {quiz ? `مراقبة اختبار: ${quiz.title} • ${quiz.subject}` : "مراقبة نشاط الطلاب في قاعة الاختبار التزاماً بالشاشة وملء التبويب"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Sound toggle */}
            <button
              type="button"
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                triggerToast(soundEnabled ? "تم كتم التنبيه الصوتي" : "تم تفعيل التنبيه الصوتي للمخالفات 🔔", "info");
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                soundEnabled
                  ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-200 hover:bg-indigo-600/50"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
              }`}
              title="تفعيل أو كتم صوت التنبيه عند حدوث مخالفة"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-300" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? "التنبيه مفعل" : "صامت"}</span>
            </button>

            {/* Navigation between monitoring & kiosk setup */}
            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveTab("students")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "students"
                    ? "bg-indigo-600 text-white shadow-xs font-black"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>الطلاب المتصلين ({totalCount})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("kiosk_setup")}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "kiosk_setup"
                    ? "bg-indigo-600 text-white shadow-xs font-black"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Terminal className="w-3.5 h-3.5 text-amber-300" />
                <span>أمر وضع الكشك (Kiosk)</span>
              </button>
            </div>

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TAB 1: LIVE STUDENTS MONITOR */}
        {activeTab === "students" && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Quick Metrics KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-slate-500 block">إجمالي الطلاب</span>
                  <span className="text-2xl font-black text-slate-900 font-sans">{totalCount}</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-200/70 text-slate-700 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-emerald-50/90 border border-emerald-300 p-3.5 rounded-2xl flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-[11px] font-black text-emerald-800 block">أتموا ورُصدت درجتهم</span>
                  <span className="text-2xl font-black text-emerald-700 font-sans">{completedCount}</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-indigo-50/70 border border-indigo-200 p-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-indigo-800 block">مستمرون بالحل (ملتزمون)</span>
                  <span className="text-2xl font-black text-indigo-900 font-sans">{compliantCount}</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-amber-800 block">لديهم إنذارات</span>
                  <span className="text-2xl font-black text-amber-800 font-sans">{warningCount}</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-rose-50/70 border border-rose-200 p-3.5 rounded-2xl flex items-center justify-between col-span-2 sm:col-span-1">
                <div>
                  <span className="text-[11px] font-bold text-rose-700 block">مستبعدون</span>
                  <span className="text-2xl font-black text-rose-800 font-sans">{disqualifiedCount}</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <UserX className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Filter and Controls Bar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="البحث باسم الطالب أو الصف أو الفصل..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-4 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Filter controls row */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  title="تصفية حسب حالة الالتزام"
                >
                  <option value="all">كل الحالات ({sessions.length})</option>
                  <option value="completed">أتموا الاختبار ورُصدت درجتهم ({completedCount}) 🎓</option>
                  <option value="active">مستمرون في الحل ({compliantCount}) 🟢</option>
                  <option value="warning">لديهم مخالفات ({warningCount}) ⚠️</option>
                  <option value="disqualified">مستبعدون ({disqualifiedCount}) 🛑</option>
                </select>

                {/* Grade & Class Filter (عرض الطلاب بالصف والفصل) */}
                <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700">
                  <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                  <select
                    value={selectedGradeClass}
                    onChange={(e) => setSelectedGradeClass(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer max-w-[170px] truncate"
                    title="تصفية الطلاب حسب الصف والفصل"
                  >
                    <option value="all">كل الصفوف والفصول</option>
                    {availableGradeClasses.map((gc) => (
                      <option key={gc} value={gc}>
                        {gc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Group by Grade & Class toggle */}
                <button
                  type="button"
                  onClick={() => setGroupByGradeClass(!groupByGradeClass)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                    groupByGradeClass
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                  title="تجميع الطلاب وتقسيمهم حسب الصف والفصل"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>تجميع بالصف والفصل</span>
                </button>

                {/* Grid / List View Switcher */}
                <div className="flex bg-slate-200/90 p-1 rounded-xl border border-slate-300/80 text-xs font-bold shrink-0">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      viewMode === "grid"
                        ? "bg-white text-indigo-700 shadow-xs font-black"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="عرض شبكة البطاقات"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>شبكة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      viewMode === "list"
                        ? "bg-white text-indigo-700 shadow-xs font-black"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="عرض على شكل قائمة / جدول"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>قائمة</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Students Display Section */}
            {filteredSessions.length === 0 ? (
              <div className="py-16 text-center space-y-3 bg-slate-50/50 rounded-3xl border border-dashed border-slate-300">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl mx-auto flex items-center justify-center">
                  <Users className="w-7 h-7" />
                </div>
                <h4 className="text-base font-black text-slate-700">لا يوجد طلاب متصلون حالياً في المعمل</h4>
                <p className="text-xs text-slate-400 font-semibold max-w-md mx-auto">
                  {searchQuery || filterStatus !== "all" || selectedGradeClass !== "all"
                    ? "لا توجد نتائج مطابقة لمعايير البحث والتصفية المحددة."
                    : "بمجرد أن يبدأ الطالب فتح الاختبار وتقديم الإجابات، ستظهر بياناته هنا فورياً مع مؤشر التزامه وحالة شاشته."}
                </p>
              </div>
            ) : groupByGradeClass ? (
              /* Grouped by Grade & Class */
              <div className="space-y-6">
                {Object.entries(groupedSessions).map(([groupTitle, groupItems]) => {
                  if (groupItems.length === 0) return null;
                  const groupCompliant = groupItems.filter(
                    (s) => s.status === "active" && s.isFullscreen && s.violationsCount === 0
                  ).length;
                  const groupWarned = groupItems.filter(
                    (s) => s.violationsCount > 0 && s.status !== "disqualified"
                  ).length;
                  const groupDisq = groupItems.filter((s) => s.status === "disqualified").length;

                  return (
                    <div
                      key={groupTitle}
                      className="bg-slate-50/70 border border-slate-200 rounded-3xl p-4 sm:p-5 space-y-4 shadow-xs"
                    >
                      {/* Section Header */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20">
                            <GraduationCap className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-black text-base text-slate-900">{groupTitle}</h3>
                            <span className="text-xs text-slate-500 font-bold block mt-0.5">
                              {groupItems.length} طلاب مسجلين في الجلسة الحالية
                            </span>
                          </div>
                        </div>

                        {/* Group stats chips */}
                        <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                          <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {groupCompliant} ملتزمون
                          </span>
                          {groupWarned > 0 && (
                            <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              {groupWarned} إنذارات
                            </span>
                          )}
                          {groupDisq > 0 && (
                            <span className="px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                              <UserX className="w-3 h-3 text-rose-600" />
                              {groupDisq} مستبعدون
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Content inside group: Grid or List */}
                      {viewMode === "grid" ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {groupItems.map(renderStudentCard)}
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] font-black">
                              <tr>
                                <th className="px-4 py-3">الطالب والصف</th>
                                <th className="px-4 py-3">حالة الالتزام</th>
                                <th className="px-4 py-3">وضع ملء الشاشة</th>
                                <th className="px-4 py-3">موقع الطالب / النتيجة</th>
                                <th className="px-4 py-3">سجل المخالفات</th>
                                <th className="px-4 py-3 text-left">إجراءات المراقبة</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {groupItems.map(renderStudentRow)}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : viewMode === "grid" ? (
              /* Flat Grid View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSessions.map(renderStudentCard)}
              </div>
            ) : (
              /* Flat List View (عرض على شكل قائمة / جدول) */
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] font-black">
                    <tr>
                      <th className="px-4 py-3">الطالب والصف</th>
                      <th className="px-4 py-3">حالة الالتزام</th>
                      <th className="px-4 py-3">وضع ملء الشاشة</th>
                      <th className="px-4 py-3">موقع الطالب / النتيجة</th>
                      <th className="px-4 py-3">سجل المخالفات</th>
                      <th className="px-4 py-3 text-left">إجراءات المراقبة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSessions.map(renderStudentRow)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: KIOSK MODE SETUP FOR LAB COMPUTERS */}
        {activeTab === "kiosk_setup" && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6">
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 space-y-4 shadow-lg border border-indigo-800">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-amber-300 text-xs font-bold">
                <Laptop className="w-4 h-4" />
                <span>إعداد معمل الحاسب الآلي بنقرة زر واحدة</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                وضع الكشك المغلق (Kiosk Mode) لمتصفحي Chrome و Edge
              </h3>
              <p className="text-xs sm:text-sm text-slate-200 font-medium leading-relaxed max-w-3xl">
                يُعد تشغيل المتصفح في وضع الكشك الحل الأقوى على مستوى نظام ويندوز في المعامل؛ حيث يقوم بفتح صفحة الاختبار بملء الشاشة بالكامل **بدون شريط تبويبات، وبدون شريط عنوان، وبدون أزرار إغلاق أو تصغير**، مما يمنع الطالب فيزيائياً من النقر لفتح أي تبويب إضافي.
              </p>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={downloadBatchScript}
                  className="px-6 py-3.5 bg-[#f4be1c] hover:bg-[#ffca28] text-slate-900 font-black text-xs sm:text-sm rounded-2xl shadow-xl shadow-amber-400/20 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-slate-900" />
                  <span>تحميل ملف التشغيل الآلي للمعمل (Safe-Exam-Lab-Launcher.bat)</span>
                </button>
              </div>
            </div>

            {/* Ready to copy commands */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Google Chrome Command */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    <span>أمر متصفح Google Chrome:</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(chromeKioskCmd, "chrome")}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCmd === "chrome" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd === "chrome" ? "تم النسخ!" : "نسخ الأمر"}</span>
                  </button>
                </div>

                <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] leading-relaxed break-all select-all border border-slate-800">
                  {chromeKioskCmd}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  اضغط على زر (Win + R) في جهاز الطالب، ثم الصق الأمر واضغط Enter ليفتح الاختبار مقفلاً فوراً.
                </p>
              </div>

              {/* Microsoft Edge Command */}
              <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>أمر متصفح Microsoft Edge:</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(edgeKioskCmd, "edge")}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-indigo-700 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedCmd === "edge" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCmd === "edge" ? "تم النسخ!" : "نسخ الأمر"}</span>
                  </button>
                </div>

                <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-[11px] leading-relaxed break-all select-all border border-slate-800">
                  {edgeKioskCmd}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  وضع الكشك الرسمي لمتصفح إيدج على نظام ويندوز لمنع فتح النوافذ والتبويبات.
                </p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-xs text-amber-950 space-y-2">
              <h5 className="font-black flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                <span>كيفية تطبيقها في المعمل بثوانٍ:</span>
              </h5>
              <ol className="list-decimal list-inside space-y-1.5 text-[11.5px] text-amber-900 font-medium">
                <li>حمل ملف التشغيل الآلي <strong className="font-black">(Safe-Exam-Lab-Launcher.bat)</strong> بالأعلى.</li>
                <li>ضعه على سطح مكتب أجهزة الطلاب في المعمل (أو انشره عبر برنامج إدارة المعمل مثل NetSupport لمرة واحدة).</li>
                <li>يضغط الطالب على الأيقونة مرتين ليفتح المتصفح بوضع ملء الشاشة المغلق تماماً بدون تبويبات.</li>
                <li>لإغلاق الكشك بعد انتهاء الاختبار، يضغط المعلم على <strong className="font-black">Alt + F4</strong>.</li>
              </ol>
            </div>
          </div>
        )}

        {/* LOGS MODAL OVERLAY */}
        <AnimatePresence>
          {selectedStudentForLogs && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[250] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-3xl p-6 max-w-lg w-full space-y-4 border border-slate-200 shadow-2xl text-slate-800 max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-rose-600" />
                    <div>
                      <h4 className="font-black text-sm text-slate-900">
                        سجل مخالفات: {selectedStudentForLogs.studentName}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-bold block">
                        {selectedStudentForLogs.gradeClass} • {selectedStudentForLogs.violationsCount} إنذارات مسجلة
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentForLogs(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {(!selectedStudentForLogs.violations || selectedStudentForLogs.violations.length === 0) ? (
                    <div className="py-8 text-center text-xs text-slate-400 font-bold">
                      لا توجد مخالفات مسجلة على هذا الطالب حتى الآن 🟢
                    </div>
                  ) : (
                    selectedStudentForLogs.violations.map((v, idx) => (
                      <div
                        key={v.id || idx}
                        className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-rose-900 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>مخالفة #{idx + 1}</span>
                          </span>
                          <span className="text-[10px] font-mono font-bold text-rose-600 bg-white px-2 py-0.5 rounded-md border border-rose-200">
                            {v.timestamp}
                          </span>
                        </div>
                        <p className="text-[11px] text-rose-800 font-medium leading-relaxed">
                          {v.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleResetStrikes(selectedStudentForLogs);
                      setSelectedStudentForLogs(null);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>إعادة تعيين الإنذارات للطالب</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStudentForLogs(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
