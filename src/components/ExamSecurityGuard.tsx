import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ShieldAlert,
  Maximize2,
  AlertTriangle,
  Lock,
  Eye,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { LiveStudentSession, ProctoringViolation } from "../types";

interface ExamSecurityGuardProps {
  quizId: string;
  quizTitle: string;
  studentId: string;
  studentName: string;
  gradeClass: string;
  teacherId?: string;
  enableAntiCheat?: boolean;
  maxViolationsAllowed?: number;
  currentQuestionIdx: number;
  totalQuestions: number;
  answeredQuestions: number;
  onAutoSubmitDueToViolations: (reason: string) => void;
  children: React.ReactNode;
}

// Generate simple beep via Web Audio API
const playWarningBeep = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Audio might fail if user hasn't interacted, safe ignore
  }
};

export const ExamSecurityGuard: React.FC<ExamSecurityGuardProps> = ({
  quizId,
  quizTitle,
  studentId,
  studentName,
  gradeClass,
  teacherId,
  enableAntiCheat = true,
  maxViolationsAllowed = 3,
  currentQuestionIdx,
  totalQuestions,
  answeredQuestions,
  onAutoSubmitDueToViolations,
  children,
}) => {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    return Boolean(document.fullscreenElement);
  });
  const [violationsCount, setViolationsCount] = useState<number>(0);
  const [violationsList, setViolationsList] = useState<ProctoringViolation[]>([]);
  const [showWarningModal, setShowWarningModal] = useState<boolean>(false);
  const [latestWarningMessage, setLatestWarningMessage] = useState<string>("");
  const [temporaryBanner, setTemporaryBanner] = useState<string | null>(null);
  const [isDisqualified, setIsDisqualified] = useState<boolean>(false);
  const [startedAt] = useState<string>(() => new Date().toISOString());
  const sessionStartTimeRef = useRef<number>(Date.now());

  const sessionId = `${quizId}_${studentId}`;
  const bannerTimeoutRef = useRef<any>(null);
  const isAutoSubmittingRef = useRef<boolean>(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const showBanner = useCallback((msg: string) => {
    setTemporaryBanner(msg);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => {
      setTemporaryBanner(null);
    }, 3500);
  }, []);

  // Sync to Firestore & BroadcastChannel
  const syncSessionState = useCallback(
    async (
      updatedCount: number,
      updatedViolations: ProctoringViolation[],
      currentStatus: LiveStudentSession["status"],
      fsState: boolean,
      disqualifiedAtTime?: number
    ) => {
      const sessionData: LiveStudentSession & { sessionStartTime?: number; disqualifiedAt?: number } = {
        id: sessionId,
        quizId,
        quizTitle,
        studentId,
        studentName,
        gradeClass,
        teacherId,
        status: currentStatus,
        isFullscreen: fsState,
        currentQuestionIdx,
        totalQuestions,
        answeredQuestions,
        violationsCount: updatedCount,
        maxViolations: maxViolationsAllowed,
        violations: updatedViolations,
        lastHeartbeat: Date.now(),
        startedAt,
        sessionStartTime: sessionStartTimeRef.current,
        ...(disqualifiedAtTime ? { disqualifiedAt: disqualifiedAtTime } : {}),
      };

      // Local storage backup for cross-tab communication
      try {
        localStorage.setItem(`seb_exam_proctoring_${sessionId}`, JSON.stringify(sessionData));
      } catch {}

      // Broadcast channel for instantaneous local sync
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage({ type: "STUDENT_HEARTBEAT", data: sessionData });
        } catch {}
      }

      // Firestore sync
      try {
        const ref = doc(db, "exam_proctoring", sessionId);
        await setDoc(ref, sessionData, { merge: true });
      } catch (err) {
        // Fallback gracefully if network/offline
      }
    },
    [
      sessionId,
      quizId,
      quizTitle,
      studentId,
      studentName,
      gradeClass,
      teacherId,
      currentQuestionIdx,
      totalQuestions,
      answeredQuestions,
      maxViolationsAllowed,
      startedAt,
    ]
  );

  // Initialize fresh session on mount - clear stale locks so student can re-take freely
  useEffect(() => {
    if (!enableAntiCheat) return;

    isAutoSubmittingRef.current = false;
    setIsDisqualified(false);
    setViolationsCount(0);
    setViolationsList([]);
    setShowWarningModal(false);

    try {
      localStorage.removeItem(`seb_exam_proctoring_${sessionId}`);
    } catch {}

    const initData: LiveStudentSession & { sessionStartTime: number } = {
      id: sessionId,
      quizId,
      quizTitle,
      studentId,
      studentName,
      gradeClass,
      teacherId,
      status: "active",
      isFullscreen: Boolean(document.fullscreenElement),
      currentQuestionIdx,
      totalQuestions,
      answeredQuestions,
      violationsCount: 0,
      maxViolations: maxViolationsAllowed,
      violations: [],
      lastHeartbeat: Date.now(),
      startedAt,
      sessionStartTime: sessionStartTimeRef.current,
    };

    try {
      const ref = doc(db, "exam_proctoring", sessionId);
      setDoc(ref, initData);
    } catch {}

    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: "STUDENT_HEARTBEAT", data: initData });
      } catch {}
    }
  }, [sessionId, enableAntiCheat, quizId, quizTitle, studentId, studentName, gradeClass, teacherId, maxViolationsAllowed, startedAt]);

  // Initialize BroadcastChannel and listen for reset actions from Teacher
  useEffect(() => {
    try {
      broadcastChannelRef.current = new BroadcastChannel("exam_proctoring_channel");
      broadcastChannelRef.current.onmessage = (event) => {
        if (event.data?.type === "RESET_STUDENT_SESSION") {
          const { studentId: targetSId, quizId: targetQId } = event.data;
          if (
            (!targetSId || targetSId === studentId) &&
            (!targetQId || targetQId === quizId)
          ) {
            // Teacher explicitly allowed student to retake or reset
            isAutoSubmittingRef.current = false;
            setIsDisqualified(false);
            setViolationsCount(0);
            setViolationsList([]);
            setShowWarningModal(false);
            showBanner("تمت إعادة ضبط جلسة الاختبار وإتاحة المحاولة من قِبل المعلم 🟢");
            syncSessionState(0, [], "active", Boolean(document.fullscreenElement));
          }
        }
      };
    } catch {}
    return () => {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
    };
  }, [studentId, quizId, syncSessionState, showBanner]);

  // Listen to remote teacher actions (e.g. Teacher resetting strikes or teacher forcing disqualify)
  useEffect(() => {
    if (!enableAntiCheat) return;

    let unsub: (() => void) | null = null;
    try {
      const ref = doc(db, "exam_proctoring", sessionId);
      unsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<LiveStudentSession> & {
            disqualifiedAt?: number;
            sessionStartTime?: number;
          };

          // If snapshot is from an old stale session (before this fresh session started), ignore it!
          const isStalePreviousSession =
            data.startedAt &&
            data.startedAt !== startedAt &&
            (!data.lastHeartbeat || data.lastHeartbeat < sessionStartTimeRef.current - 1000);

          if (isStalePreviousSession) {
            // Overwrite stale attempt with current active session
            syncSessionState(0, [], "active", Boolean(document.fullscreenElement));
            return;
          }

          if (typeof data.violationsCount === "number") {
            if (data.violationsCount === 0) {
              // Teacher reset strikes or allowed retake
              setViolationsCount(0);
              setViolationsList([]);
              setShowWarningModal(false);
              setIsDisqualified(false);
              isAutoSubmittingRef.current = false;
              showBanner("تمت إعادة ضبط سجل الإنذارات من قِبل المعلم 🟢");
            } else if (data.violationsCount !== violationsCount && data.startedAt === startedAt) {
              setViolationsCount(data.violationsCount);
            }
          }

          // Disqualification check: ONLY trigger if it was for THIS session
          if (data.status === "disqualified" && !isAutoSubmittingRef.current) {
            const isDisqualifiedForCurrentSession =
              data.startedAt === startedAt ||
              (data.disqualifiedAt && data.disqualifiedAt >= sessionStartTimeRef.current);

            if (isDisqualifiedForCurrentSession) {
              isAutoSubmittingRef.current = true;
              setIsDisqualified(true);
              setShowWarningModal(false);
              onAutoSubmitDueToViolations("تم استبعادك من قِبل المعلم المشرف على المعمل");
            } else {
              // Stale status from previous attempt that teacher deleted - restore active!
              syncSessionState(0, [], "active", Boolean(document.fullscreenElement));
            }
          }
        }
      });
    } catch {}

    return () => {
      if (unsub) unsub();
    };
  }, [enableAntiCheat, sessionId, violationsCount, showBanner, onAutoSubmitDueToViolations, startedAt, syncSessionState]);

  // Record a Violation
  const recordViolation = useCallback(
    (type: ProctoringViolation["type"], message: string) => {
      if (!enableAntiCheat || isAutoSubmittingRef.current) return;

      playWarningBeep();
      const newViolation: ProctoringViolation = {
        id: `v_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type,
        message,
        timestamp: new Date().toLocaleTimeString("ar-SA", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };

      setViolationsCount((prev) => {
        const nextCount = prev + 1;
        const nextList = [...violationsList, newViolation];
        setViolationsList(nextList);
        setLatestWarningMessage(message);

        if (nextCount >= maxViolationsAllowed) {
          isAutoSubmittingRef.current = true;
          setIsDisqualified(true);
          setShowWarningModal(false);
          const disqTime = Date.now();
          syncSessionState(nextCount, nextList, "disqualified", false, disqTime);
          onAutoSubmitDueToViolations(
            `تم إنهاء الاختبار تلقائياً لاستنفاد الحد الأقصى من إنذارات مغادرة شاشة الاختبار (${nextCount}/${maxViolationsAllowed})`
          );
        } else {
          setShowWarningModal(true);
          syncSessionState(nextCount, nextList, "warning", isFullscreen);
        }

        return nextCount;
      });
    },
    [
      enableAntiCheat,
      violationsList,
      maxViolationsAllowed,
      syncSessionState,
      isFullscreen,
      onAutoSubmitDueToViolations,
    ]
  );

  // Fullscreen Request Handler
  const enterFullscreen = useCallback(async () => {
    try {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
      setShowWarningModal(false);
      syncSessionState(violationsCount, violationsList, "active", true);
    } catch (err) {
      showBanner("يرجى النقر على الشاشة للسماح بالانتقال لملء الشاشة");
    }
  }, [violationsCount, violationsList, syncSessionState, showBanner]);

  // Monitor Fullscreen Change
  useEffect(() => {
    if (!enableAntiCheat) return;

    const handleFullscreenChange = () => {
      const inFs = Boolean(
        document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).msFullscreenElement
      );
      setIsFullscreen(inFs);

      if (!inFs && !isAutoSubmittingRef.current) {
        recordViolation(
          "fullscreen_exit",
          "الخروج من وضع ملء الشاشة أو محاولة تصغير نافذة الاختبار"
        );
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("msfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("msfullscreenchange", handleFullscreenChange);
    };
  }, [enableAntiCheat, recordViolation]);

  // Monitor Tab Switching (Visibility Change & Window Blur)
  useEffect(() => {
    if (!enableAntiCheat) return;

    let blurTimeout: any = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        recordViolation("tab_switch", "مغادرة تبويب الاختبار أو فتح تبويب/نافذة جديدة");
      }
    };

    const handleWindowBlur = () => {
      // Small debounce to avoid false triggers during browser prompt confirmations
      blurTimeout = setTimeout(() => {
        if (!document.hasFocus() && !isAutoSubmittingRef.current) {
          recordViolation(
            "blur",
            "فقدان التركيز على شاشة الاختبار أو استخدام اختصارات التبديل (Alt+Tab/Win)"
          );
        }
      }, 300);
    };

    const handleWindowFocus = () => {
      if (blurTimeout) clearTimeout(blurTimeout);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("focus", handleWindowFocus);
      if (blurTimeout) clearTimeout(blurTimeout);
    };
  }, [enableAntiCheat, recordViolation]);

  // Monitor Keyboard Shortcuts & Mouse Context Menu
  useEffect(() => {
    if (!enableAntiCheat) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Block developer tools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
      if (
        e.key === "F12" ||
        (isCtrlOrMeta && e.shiftKey && ["i", "j", "c"].includes(key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        showBanner("🚫 أدوات المطورين محظورة تماماً أثناء الاختبار!");
        recordViolation("devtools", "محاولة فتح أدوات المطورين (Inspect Element)");
        return false;
      }

      // Block copy, cut, paste, select all, print, save, view-source (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A, Ctrl+P, Ctrl+S, Ctrl+U)
      if (isCtrlOrMeta && ["c", "v", "x", "a", "p", "s", "u"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        showBanner("🚫 تم حظر النسخ واللصق وتحديد النص لضمان نزاهة الاختبار!");
        return false;
      }

      // Block opening new tabs / windows via keyboard (Ctrl+T, Ctrl+N, Ctrl+W)
      if (isCtrlOrMeta && ["t", "n", "w"].includes(key)) {
        e.preventDefault();
        e.stopPropagation();
        showBanner("🚫 فتح التبويبات محظور في وضع الاختبار المقفل!");
        recordViolation("tab_switch", "محاولة فتح تبويب جديد عبر اختصارات لوحة المفاتيح");
        return false;
      }
    };

    const handleCopyCutPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      showBanner("🚫 النسخ واللصق معطل في قاعة الاختبار!");
      return false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      showBanner("🚫 القائمة المنبثقة للزر الأيمن معطلة في الاختبار!");
      return false;
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("copy", handleCopyCutPaste, true);
    window.addEventListener("cut", handleCopyCutPaste, true);
    window.addEventListener("paste", handleCopyCutPaste, true);
    window.addEventListener("contextmenu", handleContextMenu, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("copy", handleCopyCutPaste, true);
      window.removeEventListener("cut", handleCopyCutPaste, true);
      window.removeEventListener("paste", handleCopyCutPaste, true);
      window.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [enableAntiCheat, showBanner, recordViolation]);

  // Periodic heartbeat every 4 seconds
  useEffect(() => {
    if (!enableAntiCheat) return;

    const interval = setInterval(() => {
      const inFs = Boolean(document.fullscreenElement);
      const curStatus: LiveStudentSession["status"] = isDisqualified
        ? "disqualified"
        : !inFs
        ? "warning"
        : "active";
      syncSessionState(violationsCount, violationsList, curStatus, inFs);
    }, 4000);

    return () => clearInterval(interval);
  }, [enableAntiCheat, violationsCount, violationsList, isDisqualified, syncSessionState]);

  if (!enableAntiCheat) {
    return <>{children}</>;
  }

  return (
    <div className="relative w-full min-h-screen select-none font-sans" dir="rtl">
      {/* Top Security Status Bar for Student */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-2 text-xs font-bold flex flex-wrap items-center justify-between gap-3 border-b border-indigo-900/60 shadow-inner">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-amber-300 font-extrabold flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            وضع الاختبار الآمن للمعمل مفعل
          </span>
          <span className="text-slate-400 hidden sm:inline">|</span>
          <span className="text-slate-300 hidden sm:inline">
            النسخ والتبويبات مقفلة ومراقبة لحظياً
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Fullscreen indicator */}
          <div
            className={`px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 ${
              isFullscreen
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
            }`}
          >
            <Maximize2 className="w-3 h-3" />
            <span>{isFullscreen ? "ملء الشاشة نشط" : "خارج ملء الشاشة"}</span>
          </div>

          {/* Violations Strike Badge */}
          <div
            className={`px-2.5 py-0.5 rounded-md text-[11px] font-black flex items-center gap-1.5 ${
              violationsCount === 0
                ? "bg-indigo-500/20 text-indigo-200 border border-indigo-500/30"
                : violationsCount < maxViolationsAllowed
                ? "bg-amber-500/25 text-amber-200 border border-amber-500/40"
                : "bg-rose-500/30 text-rose-200 border border-rose-500/50"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>
              الإنذارات: {violationsCount} / {maxViolationsAllowed}
            </span>
          </div>
        </div>
      </div>

      {/* Floating Temporary Warning Banner */}
      <AnimatePresence>
        {temporaryBanner && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-12 left-1/2 -translate-x-1/2 z-[300] bg-rose-900/95 text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-rose-500/50 backdrop-blur-md flex items-center gap-2.5 text-xs font-black"
          >
            <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 animate-bounce" />
            <span>{temporaryBanner}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Initial / Interrupted Fullscreen Enforcement Modal */}
      <AnimatePresence>
        {!isFullscreen && !showWarningModal && !isDisqualified && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[260] bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-4 text-center"
          >
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 text-slate-800 space-y-5">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center border border-indigo-100 shadow-sm">
                <Maximize2 className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-xl font-black text-slate-900">
                  الانتقال إلى وضع ملء الشاشة مطلوب
                </h3>
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  لضمان نزاهة الاختبار ومنع فتح النوافذ والتبويبات الجانبية، يتطلب هذا الاختبار
                  البقاء في وضع ملء الشاشة الكامل.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-right text-xs text-amber-900 space-y-1">
                <div className="font-extrabold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>تنبيه هام للطلاب:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  أي خروج من وضع ملء الشاشة أو محاولة فتح تبويب آخر يتم رصده وتسجيله كإنذار فوري
                  في شاشة المعلم.
                </p>
              </div>

              <button
                type="button"
                onClick={enterFullscreen}
                className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-500/25 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
                <span>تفعيل ملء الشاشة ومتابعة الاختبار 🚀</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Warning Strike Modal Overlay (Locks screen during violation) */}
      <AnimatePresence>
        {showWarningModal && !isDisqualified && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[280] bg-rose-950/95 backdrop-blur-xl flex items-center justify-center p-4 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border-4 border-rose-500 text-slate-800 space-y-6"
            >
              <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl mx-auto flex items-center justify-center border-2 border-rose-300 shadow-lg animate-bounce">
                <ShieldAlert className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <span className="inline-block px-3.5 py-1 bg-rose-100 text-rose-800 text-xs font-black rounded-full border border-rose-200">
                  إنذار أمني لمخالفة الاختبار رقم ({violationsCount} من {maxViolationsAllowed})
                </span>
                <h3 className="text-2xl font-black text-slate-900">
                  تم رصد مغادرة شاشة الاختبار!
                </h3>
                <p className="text-xs text-rose-700 font-bold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                  سبب المخالفة: {latestWarningMessage || "فتح تبويب آخر أو محاولة التبديل خارج المتصفح"}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right text-xs text-slate-700 space-y-1.5">
                <p className="font-extrabold text-slate-900">
                  ⚠️ نظام المراقبة المشدد في المعمل:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
                  <li>تم تسجيل هذه المخالفة في لوحة مراقبة المعلم اللحظية مع وقت وتاريخ الحادثة.</li>
                  <li>
                    متبقي لك{" "}
                    <strong className="text-rose-600 font-extrabold">
                      {Math.max(0, maxViolationsAllowed - violationsCount)}
                    </strong>{" "}
                    إنذار فقط قبل الإلغاء والتسليم الإجباري للاختبار!
                  </li>
                  <li>يمنع منعاً باتاً فتح أي تبويب أو نافذة أو استخدام محركات البحث.</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={enterFullscreen}
                className="w-full py-4 bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-black text-sm rounded-2xl shadow-xl shadow-rose-600/30 transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
                <span>العودة للاختبار والالتزام بالشاشة الكاملة ⏎</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Children content (Exam questions and controls) */}
      <div className="user-select-none select-none">{children}</div>
    </div>
  );
};
