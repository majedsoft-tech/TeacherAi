import { Quiz } from "../types";

export interface OngoingQuizInfo {
  quiz: Quiz;
  qKey: string;
  subject: string;
  title: string;
  remainingSeconds: number;
  isUntimed: boolean;
}

/**
 * Normalizes Arabic text for strict/fuzzy subject matching
 */
export function normalizeArabicSubject(text: string): string {
  if (!text) return "";
  return text
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F]/g, "") // remove harakat/tashkeel
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strips leading definite article "ال" from Arabic words
 */
export function stripArabicDefiniteArticle(text: string): string {
  if (!text) return "";
  const parts = text.split(" ");
  const stripped = parts.map((p) => p.replace(/^ال/, ""));
  return stripped.join(" ");
}

/**
 * Checks if a syllabus subject matches a quiz's subject.
 * If the quiz has a general subject ("عام", "الكل", "جميع المواد", or empty), it locks ALL subjects.
 */
export function isSubjectMatchingQuiz(syllabusSubject: string, quizSubject?: string): boolean {
  if (!quizSubject) return false;
  const qSub = quizSubject.trim();
  const sSub = syllabusSubject.trim();

  // General or wildcard quiz subject locks every subject
  if (
    qSub === "عام" ||
    qSub === "الكل" ||
    qSub === "جميع المواد" ||
    qSub.toLowerCase() === "all" ||
    qSub.toLowerCase() === "general"
  ) {
    return true;
  }

  const normQ = normalizeArabicSubject(qSub).toLowerCase();
  const normS = normalizeArabicSubject(sSub).toLowerCase();

  if (normQ === normS) return true;
  if (normQ.length > 2 && normS.includes(normQ)) return true;
  if (normS.length > 2 && normQ.includes(normS)) return true;

  const strippedQ = stripArabicDefiniteArticle(normQ);
  const strippedS = stripArabicDefiniteArticle(normS);

  if (strippedQ === strippedS) return true;
  if (strippedQ.length > 2 && strippedS.includes(strippedQ)) return true;
  if (strippedS.length > 2 && strippedQ.includes(strippedS)) return true;

  return false;
}

/**
 * Reads all active ongoing quizzes for a student from both state and localStorage.
 */
export function getOngoingQuizzesForStudent(
  studentId: string | undefined | null,
  allQuizzes: Quiz[],
  activeStudentQuiz?: Quiz | null,
  isQuizStartedState?: boolean,
  isQuizFinishedState?: boolean
): OngoingQuizInfo[] {
  if (!studentId) return [];
  const result: OngoingQuizInfo[] = [];
  const addedKeys = new Set<string>();

  // 1. Check in-flight active state
  if (activeStudentQuiz && isQuizStartedState && !isQuizFinishedState) {
    const qKey = activeStudentQuiz.id || activeStudentQuiz.title;
    addedKeys.add(qKey);

    let remaining = (activeStudentQuiz.durationMinutes || 15) * 60;
    const endVal = localStorage.getItem(`seb_student_${studentId}_quiz_${qKey}_end_timestamp`);
    if (endVal) {
      const end = parseInt(endVal, 10);
      remaining = Math.max(0, Math.floor((end - Date.now()) / 1000));
    } else {
      const savedTimer = localStorage.getItem(`seb_student_${studentId}_quiz_${qKey}_timer`);
      if (savedTimer) {
        remaining = parseInt(savedTimer, 10);
      }
    }

    result.push({
      quiz: activeStudentQuiz,
      qKey,
      subject: activeStudentQuiz.subject || "عام",
      title: activeStudentQuiz.title,
      remainingSeconds: remaining,
      isUntimed: activeStudentQuiz.durationMinutes === 9999,
    });
  }

  // 2. Scan quizzes against localStorage
  allQuizzes.forEach((quiz) => {
    const qKey = quiz.id || quiz.title;
    if (addedKeys.has(qKey)) return;

    const started = localStorage.getItem(`seb_student_${studentId}_quiz_${qKey}_started`) === "true";
    const finished = localStorage.getItem(`seb_student_${studentId}_quiz_${qKey}_finished`) === "true";
    if (!started || finished) return;

    let remainingSeconds = 0;
    const isUntimed = quiz.durationMinutes === 9999;
    const endVal = localStorage.getItem(`seb_student_${studentId}_quiz_${qKey}_end_timestamp`);
    if (endVal) {
      remainingSeconds = Math.max(0, Math.floor((parseInt(endVal, 10) - Date.now()) / 1000));
    } else {
      const timerVal = localStorage.getItem(`seb_student_${studentId}_quiz_${qKey}_timer`);
      remainingSeconds = timerVal ? parseInt(timerVal, 10) : 0;
    }

    if (isUntimed || remainingSeconds > 0) {
      addedKeys.add(qKey);
      result.push({
        quiz,
        qKey,
        subject: quiz.subject || "عام",
        title: quiz.title,
        remainingSeconds,
        isUntimed,
      });
    }
  });

  return result;
}

/**
 * Checks if a specific syllabus subject is locked by any active ongoing quiz.
 */
export function getLockingQuizForSubject(
  subjectKey: string,
  subjectName: string,
  ongoingQuizzes: OngoingQuizInfo[]
): OngoingQuizInfo | null {
  if (!ongoingQuizzes || ongoingQuizzes.length === 0) return null;

  for (const item of ongoingQuizzes) {
    if (
      isSubjectMatchingQuiz(subjectKey, item.subject) ||
      isSubjectMatchingQuiz(subjectName, item.subject)
    ) {
      return item;
    }
  }

  return null;
}

/**
 * Formats seconds into MM:SS
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return "انتهى الوقت";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}
