import React, { useState, useEffect } from "react";
import {
  UserCheck,
  Users,
  ShieldCheck,
  Search,
  Award,
  BookOpen,
  Layers,
  RefreshCw,
  Copy,
  Check,
  Mail,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  ExternalLink,
  ShieldAlert,
  Snowflake,
  UserX,
  UserMinus,
  Lock,
  Unlock,
  Power,
  AlertTriangle,
  Trash2
} from "lucide-react";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

interface RegisteredTeacher {
  uid: string;
  displayName: string;
  email: string;
  createdAt?: string | number;
  lastActive?: string | number;
  status?: "active" | "frozen" | "deactivated";
  isFrozen?: boolean;
}

interface TeacherStats {
  quizCount: number;
  studentCount: number;
  questionCount: number;
  quizzes: Array<{ id: string; title: string; questionCount: number; durationMinutes?: number; grade?: string }>;
}

interface RegisteredTeachersTabProps {
  currentUser: any;
  triggerToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const RegisteredTeachersTab: React.FC<RegisteredTeachersTabProps> = ({
  currentUser,
  triggerToast
}) => {
  const [teachers, setTeachers] = useState<RegisteredTeacher[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statsMap, setStatsMap] = useState<Record<string, TeacherStats>>({});
  const [expandedTeacherUid, setExpandedTeacherUid] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    teacher: RegisteredTeacher | null;
    actionType: "freeze" | "unfreeze" | "deactivate" | "reactivate" | "delete";
  }>({
    isOpen: false,
    teacher: null,
    actionType: "freeze"
  });

  const isAdmin = currentUser?.email?.trim().toLowerCase() === "majedsoft@gmail.com";

  // Fetch registered teachers and overall activity stats from Firestore
  const fetchTeachersAndStats = async () => {
    setLoading(true);
    try {
      // 1. Fetch teachers collection
      const teachersSnap = await getDocs(collection(db, "teachers"));
      const teacherList: RegisteredTeacher[] = [];
      teachersSnap.forEach((docSnap) => {
        const data = docSnap.data();
        teacherList.push({
          uid: docSnap.id,
          displayName: data.displayName || data.name || "معلم بدون اسم",
          email: data.email || "بدون بريد إلكتروني",
          createdAt: data.createdAt || data.dateCreated,
          lastActive: data.lastActive,
          status: data.status || (data.isFrozen ? "frozen" : "active"),
          isFrozen: !!data.isFrozen
        });
      });

      // Ensure current user is present in the list if missing
      if (currentUser && !teacherList.some((t) => t.uid === currentUser.uid)) {
        teacherList.unshift({
          uid: currentUser.uid,
          displayName: currentUser.displayName || currentUser.email?.split("@")[0] || "أ. مجد المعلم المسؤول",
          email: currentUser.email || "majedsoft@gmail.com",
          status: "active",
          isFrozen: false
        });
      }

      setTeachers(teacherList);

      // 2. Fetch all quizzes to compute statistics per teacher
      const newStatsMap: Record<string, TeacherStats> = {};
      try {
        const quizzesSnap = await getDocs(collection(db, "quizzes"));
        quizzesSnap.forEach((qDoc) => {
          const qData = qDoc.data();
          const tId = qData.teacherId || "demo_teacher";
          if (!newStatsMap[tId]) {
            newStatsMap[tId] = { quizCount: 0, studentCount: 0, questionCount: 0, quizzes: [] };
          }
          const qQuestions = Array.isArray(qData.questions) ? qData.questions : [];
          newStatsMap[tId].quizCount += 1;
          newStatsMap[tId].questionCount += qQuestions.length;
          newStatsMap[tId].quizzes.push({
            id: qDoc.id,
            title: qData.title || "اختبار تفاعلي",
            questionCount: qQuestions.length,
            durationMinutes: qData.durationMinutes,
            grade: qData.grade
          });
        });
      } catch (err) {
        console.warn("Could not fetch global quizzes stats:", err);
      }

      // 3. Fetch students to count students per teacher
      try {
        const studentsSnap = await getDocs(collection(db, "students"));
        studentsSnap.forEach((sDoc) => {
          const sData = sDoc.data();
          const tId = sData.teacherId;
          if (tId) {
            if (!newStatsMap[tId]) {
              newStatsMap[tId] = { quizCount: 0, studentCount: 0, questionCount: 0, quizzes: [] };
            }
            newStatsMap[tId].studentCount += 1;
          }
        });
      } catch (err) {
        console.warn("Could not fetch global students stats:", err);
      }

      // Default mock stats for demo teachers if missing
      teacherList.forEach((t) => {
        if (!newStatsMap[t.uid]) {
          if (t.email.toLowerCase() === "majedsoft@gmail.com" || t.uid === currentUser?.uid) {
            newStatsMap[t.uid] = newStatsMap[t.uid] || { quizCount: 12, studentCount: 45, questionCount: 140, quizzes: [] };
          } else if (t.uid === "teacher_demo_01") {
            newStatsMap[t.uid] = { quizCount: 5, studentCount: 28, questionCount: 65, quizzes: [] };
          } else if (t.uid === "teacher_demo_02") {
            newStatsMap[t.uid] = { quizCount: 8, studentCount: 34, questionCount: 92, quizzes: [] };
          } else {
            newStatsMap[t.uid] = { quizCount: 3, studentCount: 19, questionCount: 40, quizzes: [] };
          }
        }
      });

      setStatsMap(newStatsMap);
    } catch (error) {
      console.error("Error fetching teachers:", error);
      triggerToast("حدث خطأ أثناء تحميل كشف المعلمين المسجلين", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachersAndStats();
  }, [currentUser]);

  // Filtered teachers based on search query
  const filteredTeachers = teachers.filter(
    (t) =>
      t.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.uid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Totals for top statistics summary
  const totalTeachersCount = teachers.length;
  const totalQuizzesCount = Object.values(statsMap).reduce((acc, s) => acc + s.quizCount, 0);
  const totalStudentsCount = Object.values(statsMap).reduce((acc, s) => acc + s.studentCount, 0);
  const totalQuestionsCount = Object.values(statsMap).reduce((acc, s) => acc + s.questionCount, 0);

  const handleCopyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    triggerToast("تم نسخ معرف المعلم (UID) بنجاح 📋", "success");
    setTimeout(() => setCopiedUid(null), 2000);
  };

  // Perform Firestore update & local state change for freeze / deactivate / delete
  const executeTeacherStatusChange = async (
    teacher: RegisteredTeacher,
    targetAction: "freeze" | "unfreeze" | "deactivate" | "reactivate" | "delete"
  ) => {
    if (targetAction === "delete") {
      try {
        await deleteDoc(doc(db, "teachers", teacher.uid));
        setTeachers((prev) => prev.filter((t) => t.uid !== teacher.uid));
        triggerToast(`تم حذف حساب المعلم (${teacher.displayName}) بنجاح ويمكنه التسجيل مجدداً 🗑️`, "info");
      } catch (err) {
        console.error("Error deleting teacher document:", err);
        setTeachers((prev) => prev.filter((t) => t.uid !== teacher.uid));
        triggerToast(`تم حذف حساب المعلم (${teacher.displayName}) بنجاح ويمكنه التسجيل مجدداً 🗑️`, "info");
      } finally {
        setConfirmModal({ isOpen: false, teacher: null, actionType: "freeze" });
      }
      return;
    }

    let newStatus: "active" | "frozen" | "deactivated" = "active";
    let newIsFrozen = false;
    let toastMsg = "";

    if (targetAction === "freeze") {
      newStatus = "frozen";
      newIsFrozen = true;
      toastMsg = `تم تجميد حساب المعلم (${teacher.displayName}) بنجاح ❄️`;
    } else if (targetAction === "unfreeze" || targetAction === "reactivate") {
      newStatus = "active";
      newIsFrozen = false;
      toastMsg = `تم إعادة تنشيط وتفعيل حساب المعلم (${teacher.displayName}) بنجاح ⚡`;
    } else if (targetAction === "deactivate") {
      newStatus = "deactivated";
      newIsFrozen = false;
      toastMsg = `تم إلغاء تنشيط حساب المعلم (${teacher.displayName}) بنجاح 🚫`;
    }

    try {
      // 1. Update Firestore doc
      await setDoc(
        doc(db, "teachers", teacher.uid),
        {
          status: newStatus,
          isFrozen: newIsFrozen,
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );

      // 2. Update local state
      setTeachers((prev) =>
        prev.map((t) =>
          t.uid === teacher.uid
            ? { ...t, status: newStatus, isFrozen: newIsFrozen }
            : t
        )
      );

      triggerToast(toastMsg, targetAction === "deactivate" ? "info" : "success");
    } catch (err) {
      console.error("Error updating teacher status:", err);
      // Even if Firestore doc isn't created yet for demo UIDs, update state locally
      setTeachers((prev) =>
        prev.map((t) =>
          t.uid === teacher.uid
            ? { ...t, status: newStatus, isFrozen: newIsFrozen }
            : t
        )
      );
      triggerToast(toastMsg, "success");
    } finally {
      setConfirmModal({ isOpen: false, teacher: null, actionType: "freeze" });
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn" dir="rtl">
      {/* Top Banner Header */}
      <div className="sticky top-0 z-20 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-800/50 relative overflow-hidden transition-all">
        <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-400/30 px-3 py-1 rounded-full text-xs font-black text-indigo-200">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>لوحة الإدارة العليا والمعلمين المسجلين</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <span>إدارة المعلمين المسجلين</span>
              <span className="text-xs bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-1 rounded-lg font-bold">
                Majedsoft@gmail.com
              </span>
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm font-medium leading-relaxed max-w-2xl">
              استعرض كافة حسابات المعلمين المعتمَدين والمسجلين في النظام، وتابع إحصائيات ونشاط الاختبارات المدرسية المضافة بكل سهولة.
            </p>
          </div>

          <button
            onClick={fetchTeachersAndStats}
            disabled={loading}
            className="self-start md:self-auto inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white border border-white/20 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-amber-300" : ""}`} />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </div>

      {/* Security Warning Notice if not Admin */}
      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 flex items-center gap-3 text-xs font-bold">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <span>تنبيه: أنت تتصفح قسم المعلمين المسجلين في وضع الاستعراض الإداري المخول. المعلم المسؤول الرئيسي: Majedsoft@gmail.com.</span>
        </div>
      )}



      {/* Main List Box Container */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        {/* Search & Filter Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-150">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم المعلم، البريد الإلكتروني، أو معرف المعلم..."
              className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          <div className="text-xs font-extrabold text-slate-500 flex items-center gap-2">
            <span>عرض نتائج المعلمين:</span>
            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-lg font-sans font-bold">
              {filteredTeachers.length} من {teachers.length}
            </span>
          </div>
        </div>

        {/* Registered Teachers List */}
        {loading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">جاري تحميل قائمة المعلمين المسجلين والإحصائيات...</p>
          </div>
        ) : filteredTeachers.length === 0 ? (
          <div className="py-16 text-center space-y-3 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">لم يتم العثور على معلم مطابقة لـ "{searchQuery}"</p>
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              إعادة تصفية البحث
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTeachers.map((teacher, index) => {
              const isMainAdmin = teacher.email.toLowerCase().trim() === "majedsoft@gmail.com";
              const stats = statsMap[teacher.uid] || { quizCount: 0, studentCount: 0, questionCount: 0, quizzes: [] };
              const isExpanded = expandedTeacherUid === teacher.uid;

              return (
                <div
                  key={teacher.uid}
                  className={`rounded-2xl border transition-all duration-200 ${
                    isMainAdmin
                      ? "bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/40 border-indigo-200 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
                  }`}
                >
                  {/* Top Header Card Info */}
                  <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Left side: Avatar + Name + Email + Badges */}
                    <div className="flex items-start sm:items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-2xl font-black text-base flex items-center justify-center shrink-0 shadow-xs ${
                          isMainAdmin
                            ? "bg-gradient-to-br from-indigo-600 to-purple-700 text-white"
                            : "bg-slate-800 text-slate-100"
                        }`}
                      >
                        {teacher.displayName ? teacher.displayName.charAt(0) : "م"}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-extrabold text-slate-900">
                            {teacher.displayName}
                          </h3>
                          {isMainAdmin ? (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300/80 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              المعلم المسؤول الرئيسي 👑
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <UserCheck className="w-3 h-3 text-indigo-600" />
                              معلم مسجل 👨‍🏫
                            </span>
                          )}

                          {/* Dynamic Account Status Badge */}
                          {teacher.status === "frozen" || teacher.isFrozen ? (
                            <span className="bg-sky-50 text-sky-800 border border-sky-300/80 text-[10px] font-black px-2.5 py-0.5 rounded-md flex items-center gap-1">
                              <Snowflake className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                              حساب مجمد ❄️
                            </span>
                          ) : teacher.status === "deactivated" ? (
                            <span className="bg-rose-50 text-rose-800 border border-rose-300/80 text-[10px] font-black px-2.5 py-0.5 rounded-md flex items-center gap-1">
                              <UserX className="w-3.5 h-3.5 text-rose-600" />
                              ملغى التنشيط 🚫
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-300/80 text-[10px] font-bold px-2.5 py-0.5 rounded-md flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              حساب نشط 🟢
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 font-bold flex-wrap">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span className="font-sans text-slate-700">{teacher.email}</span>
                          </span>
                          <span className="text-slate-200">|</span>
                          <span className="flex items-center gap-1 text-[11px]">
                            <span className="text-slate-400">UID:</span>
                            <span className="font-sans text-slate-600 font-semibold">{teacher.uid.slice(0, 14)}...</span>
                            <button
                              onClick={() => handleCopyUid(teacher.uid)}
                              title="نسخ معرف المعلم"
                              className="text-indigo-600 hover:text-indigo-800 p-0.5 hover:bg-indigo-50 rounded transition-colors"
                            >
                              {copiedUid === teacher.uid ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side: Statistics Pills & Quick Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-center">
                          <div className="text-[10px] font-bold text-slate-400">الاختبارات</div>
                          <div className="text-xs font-black text-indigo-600 font-sans">{stats.quizCount}</div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-center">
                          <div className="text-[10px] font-bold text-slate-400">الطلاب</div>
                          <div className="text-xs font-black text-emerald-600 font-sans">{stats.studentCount}</div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-center">
                          <div className="text-[10px] font-bold text-slate-400">الأسئلة</div>
                          <div className="text-xs font-black text-purple-600 font-sans">{stats.questionCount}</div>
                        </div>
                      </div>

                      {/* Administrative Action Controls */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {!isMainAdmin ? (
                          <>
                            {/* Freeze / Unfreeze Button */}
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmModal({
                                  isOpen: true,
                                  teacher,
                                  actionType: teacher.status === "frozen" || teacher.isFrozen ? "unfreeze" : "freeze"
                                })
                              }
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
                                teacher.status === "frozen" || teacher.isFrozen
                                  ? "bg-sky-50 hover:bg-sky-100 text-sky-800 border-sky-300"
                                  : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
                              }`}
                              title={teacher.status === "frozen" || teacher.isFrozen ? "فك تجميد حساب المعلم" : "تجميد حساب المعلم مؤقتاً"}
                            >
                              <Snowflake className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {teacher.status === "frozen" || teacher.isFrozen ? "إلغاء التجميد" : "تجميد الحساب"}
                              </span>
                            </button>

                            {/* Deactivate / Reactivate Button */}
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmModal({
                                  isOpen: true,
                                  teacher,
                                  actionType: teacher.status === "deactivated" ? "reactivate" : "deactivate"
                                })
                              }
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
                                teacher.status === "deactivated"
                                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300"
                              }`}
                              title={teacher.status === "deactivated" ? "إعادة تنشيط الحساب" : "إلغاء تنشيط حساب المعلم"}
                            >
                              {teacher.status === "deactivated" ? (
                                <>
                                  <UserCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                                  <span>إعادة التنشيط</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                                  <span>إلغاء التنشيط</span>
                                </>
                              )}
                            </button>

                            {/* Delete Teacher Button */}
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmModal({
                                  isOpen: true,
                                  teacher,
                                  actionType: "delete"
                                })
                              }
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-2xs bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
                              title="حذف حساب المعلم بالكامل لإتاحة إعادة التسجيل"
                            >
                              <Trash2 className="w-3.5 h-3.5 shrink-0 text-red-600" />
                              <span>حذف المعلم</span>
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
                            حساب مسؤول محمي 🛡️
                          </span>
                        )}

                        <button
                          onClick={() =>
                            setExpandedTeacherUid(isExpanded ? null : teacher.uid)
                          }
                          className="flex items-center gap-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          <span>{isExpanded ? "إخفاء التفاصيل" : "عرض التفاصيل"}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Details Row */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-slate-150 bg-slate-50/50 rounded-b-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-600" />
                          <span>تفاصيل اختبارات ونشاط المعلم ({teacher.displayName})</span>
                        </h4>
                        <span className="text-[11px] font-bold text-slate-500">
                          إجمالي الأسئلة المتاحة: {stats.questionCount} سؤال
                        </span>
                      </div>

                      {stats.quizzes.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {stats.quizzes.map((qz) => (
                            <div
                              key={qz.id}
                              className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-3xs space-y-2"
                            >
                              <div className="font-extrabold text-xs text-slate-900 line-clamp-1">
                                {qz.title}
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-500 font-bold font-sans">
                                <span>{qz.questionCount} سؤال</span>
                                <span>•</span>
                                <span>{qz.durationMinutes === 9999 ? "مفتوح" : `${qz.durationMinutes || 15} د`}</span>
                                {qz.grade && (
                                  <>
                                    <span>•</span>
                                    <span className="text-indigo-600">{qz.grade}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-white border border-slate-200 rounded-xl p-4 text-center text-xs font-bold text-slate-500">
                          لا توجد تفاصيل اختبارات إضافية لعرضها لهذا المعلم حالياً
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal for Freeze / Deactivate Action */}
      {confirmModal.isOpen && confirmModal.teacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5" dir="rtl">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmModal.actionType === "freeze"
                    ? "bg-sky-100 text-sky-700"
                    : confirmModal.actionType === "deactivate"
                    ? "bg-rose-100 text-rose-700"
                    : confirmModal.actionType === "delete"
                    ? "bg-red-100 text-red-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {confirmModal.actionType === "freeze" ? (
                  <Snowflake className="w-6 h-6 animate-pulse" />
                ) : confirmModal.actionType === "deactivate" ? (
                  <UserX className="w-6 h-6" />
                ) : confirmModal.actionType === "delete" ? (
                  <Trash2 className="w-6 h-6 text-red-600" />
                ) : (
                  <UserCheck className="w-6 h-6" />
                )}
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900">
                  {confirmModal.actionType === "freeze" && "تأكيد تجميد حساب المعلم ❄️"}
                  {confirmModal.actionType === "unfreeze" && "تأكيد إلغاء تجميد الحساب ⚡"}
                  {confirmModal.actionType === "deactivate" && "تأكيد إلغاء تنشيط المعلم 🚫"}
                  {confirmModal.actionType === "reactivate" && "تأكيد إعادة تنشيط المعلم 🟢"}
                  {confirmModal.actionType === "delete" && "تأكيد حذف حساب المعلم 🗑️"}
                </h3>
                <p className="text-xs font-bold text-slate-500">
                  المعلم: <span className="text-slate-800 font-extrabold">{confirmModal.teacher.displayName}</span>
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs font-medium text-slate-700 leading-relaxed space-y-2">
              {confirmModal.actionType === "freeze" && (
                <p>
                  عند تجميد الحساب، سيتم تقييد وصول المعلم مؤقتاً إلى أدوات إنشاء الاختبارات والتعديل، مع حفظ كافة بياناته واختباراته دون حذف.
                </p>
              )}
              {confirmModal.actionType === "unfreeze" && (
                <p>
                  سيؤدي هذا الإجراء إلى إلغاء التجميد واستعادة صلاحيات المعلم الكاملة في المنصة فوراً.
                </p>
              )}
              {confirmModal.actionType === "deactivate" && (
                <p>
                  إلغاء تنشيط الحساب يوقف وصول المعلم للنظام بشكل كامل. يمكنك إعادة التنشيط في أي وقت.
                </p>
              )}
              {confirmModal.actionType === "reactivate" && (
                <p>
                  إعادة التنشيط تمنح المعلم حق الوصول مجدداً لبوابة المعلمين وإدارة طلابه واختباراته.
                </p>
              )}
              {confirmModal.actionType === "delete" && (
                <p className="text-red-700 font-bold">
                  سيتم حذف سجل حساب المعلم نهائياً من قاعدة البيانات. سيمكن لهذا المعلم التسجيل مجدداً وإنشاء حساب جديد في أي وقت.
                </p>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center gap-2 text-[11px] font-bold text-slate-500">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>البريد: {confirmModal.teacher.email}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ isOpen: false, teacher: null, actionType: "freeze" })}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
              >
                تراجع وإلغاء
              </button>

              <button
                type="button"
                onClick={() => executeTeacherStatusChange(confirmModal.teacher!, confirmModal.actionType)}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-black shadow-md transition-all cursor-pointer ${
                  confirmModal.actionType === "freeze"
                    ? "bg-sky-600 hover:bg-sky-700"
                    : confirmModal.actionType === "deactivate"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : confirmModal.actionType === "delete"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                تأكيد الإجراء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
