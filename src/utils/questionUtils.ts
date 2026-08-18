import { Question, BankQuestion } from '../types';

/**
 * Accurately determines whether a question is True/False (صح وخطأ) or Multiple Choice.
 */
export function isTrueFalseQuestion(q: {
  type?: string;
  options?: string[];
  [key: string]: any;
}): boolean {
  if (!q) return false;

  const typeStr = String(q.type || '').trim().toLowerCase();

  // Explicit true_false type check
  if (
    typeStr === 'true_false' ||
    typeStr === 'tf' ||
    typeStr === 'boolean' ||
    typeStr === 'truefalse' ||
    typeStr === 'صح_خطأ' ||
    typeStr === 'صح_و_خطأ'
  ) {
    return true;
  }

  // Check options array
  if (Array.isArray(q.options) && q.options.length > 0) {
    const isPlaceholder = (text: any) => {
      if (!text) return true;
      const t = String(text).trim().toLowerCase();
      return (
        t === '' ||
        t === 'الخيار الثالث' ||
        t === 'الخيار الرابع' ||
        t === 'الخيار الثالث...' ||
        t === 'الخيار الرابع...' ||
        t === 'option 3' ||
        t === 'option 4' ||
        t === 'option3' ||
        t === 'option4'
      );
    };

    const validOpts = q.options
      .filter((o) => !isPlaceholder(o))
      .map((o) => String(o).trim().toLowerCase());

    const tfWords = ['صح', 'خطأ', 'صحيح', 'خاطئ', 'خاطئة', 'صواب', 'true', 'false', 'صح.', 'خطأ.'];

    // If valid options are 2 or fewer, and at least one is a T/F word
    if (validOpts.length > 0 && validOpts.length <= 2) {
      if (validOpts.some((opt) => tfWords.includes(opt))) {
        return true;
      }
    } else if (validOpts.length === 0 && q.options.length >= 2) {
      const o0 = String(q.options[0] || '').trim().toLowerCase();
      const o1 = String(q.options[1] || '').trim().toLowerCase();
      if (tfWords.includes(o0) || tfWords.includes(o1)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Normalizes question type, options, and correctAnswer for consistency across the app.
 */
export function normalizeQuestion<T extends Question | BankQuestion>(q: T): T {
  if (!q) return q;

  const isTf = isTrueFalseQuestion(q);
  const normalizedPoints = typeof q.points === 'number' && q.points > 0 ? q.points : 1;

  if (isTf) {
    let tfOptions = ['صحيح', 'خطأ'];
    if (Array.isArray(q.options) && q.options.length >= 2) {
      const o0 = String(q.options[0] || '').trim();
      const o1 = String(q.options[1] || '').trim();
      if (
        o0 &&
        o1 &&
        o0 !== 'الخيار الثالث' &&
        o1 !== 'الخيار الثالث' &&
        o0 !== 'الخيار الرابع' &&
        o1 !== 'الخيار الرابع'
      ) {
        tfOptions = [o0, o1];
      }
    }

    let normAns = String(q.correctAnswer ?? '').trim().toLowerCase();
    if (
      normAns === 'true' ||
      normAns === '0' ||
      normAns === 'صح' ||
      normAns === 'صحيح' ||
      normAns === 'صواب'
    ) {
      normAns = 'true';
    } else if (
      normAns === 'false' ||
      normAns === '1' ||
      normAns === 'خطأ' ||
      normAns === 'خاطئ' ||
      normAns === 'خاطئة'
    ) {
      normAns = 'false';
    } else {
      normAns = 'true';
    }

    return {
      ...q,
      points: normalizedPoints,
      type: 'true_false' as const,
      options: tfOptions,
      correctAnswer: normAns,
    };
  }

  const rawOpts = Array.isArray(q.options) ? q.options : [];

  return {
    ...q,
    points: normalizedPoints,
    type: 'multiple_choice' as const,
    options: rawOpts,
  };
}

/**
 * Normalizes Arabic grade strings for reliable comparison.
 */
export function normalizeGradeStr(str: string): string {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\/\\\_]/g, '-')
    .replace(/\s+/g, ' ');
}

/**
 * Extracts a numeric grade level (1..6) from an Arabic grade or subject string.
 * Handles patterns like "1-3", "1/3", "ثالث ثانوي", "ثالث", "الصف الثالث", "1-1", "1/1", "أول", etc.
 */
export function extractGradeLevel(str?: string | null): number | null {
  if (!str) return null;
  const norm = normalizeGradeStr(str);
  if (!norm) return null;

  // 1. High school curriculum track codes like "1-3", "1/3", "1-2", "1/2", "1-1", "1/1"
  if (/\b1[-_ /]3\b/.test(norm) || norm.includes("1-3") || norm.includes("1/3")) return 3;
  if (/\b1[-_ /]2\b/.test(norm) || norm.includes("1-2") || norm.includes("1/2")) return 2;
  if (/\b1[-_ /]1\b/.test(norm) || norm.includes("1-1") || norm.includes("1/1")) return 1;

  // 2. Specific grade word matches (checked in order 6 down to 1 to prevent partial word overlap)
  if (norm.includes("سادس") || norm.includes("6")) return 6;
  if (norm.includes("خامس") || norm.includes("5")) return 5;
  if (norm.includes("رابع") || norm.includes("4")) return 4;
  if (norm.includes("ثالث") || norm.includes("3")) return 3;
  if (norm.includes("ثاني") || norm.includes("2")) return 2;
  if (norm.includes("اول") || norm.includes("اولى") || norm.includes("1")) return 1;

  return null;
}

/**
 * Checks whether an item's grade or subject name matches a student's grade or gradeClass.
 */
export function isGradeMatching(
  itemGrade?: string | null,
  studentGrade?: string | null,
  studentGradeClass?: string | null
): boolean {
  if (!itemGrade) return true;
  const ig = itemGrade.trim();
  if (
    !ig ||
    ig === 'جميع الصفوف (عام)' ||
    ig === 'جميع الفصول (عام)' ||
    ig === 'عام' ||
    ig === 'جميع الصفوف' ||
    ig === 'جميع الفصول' ||
    ig === 'الكل' ||
    ig === 'جميع المراحل' ||
    ig === 'معاينة' ||
    ig === 'معاينة تجريبية'
  ) {
    return true;
  }

  const sG = (studentGrade || '').trim();
  const sGC = (studentGradeClass || '').trim();

  // If student has no grade specified or is in teacher preview mode, allow viewing
  if (!sG && !sGC) return true;
  if (sG === 'معاينة' || sGC === 'معاينة تجريبية' || sGC.includes('معاينة')) return true;

  // Extract explicit numeric grade levels if available
  const itemLevel = extractGradeLevel(ig);
  const studentLevelFromG = extractGradeLevel(sG);
  const studentLevelFromGC = extractGradeLevel(sGC);
  const studentLevel = studentLevelFromG !== null ? studentLevelFromG : studentLevelFromGC;

  // If both the item/subject AND the student have identifiable grade levels, perform strict level comparison
  if (itemLevel !== null && studentLevel !== null) {
    return itemLevel === studentLevel;
  }

  const normIG = normalizeGradeStr(ig);
  const normSG = normalizeGradeStr(sG);
  const normSGC = normalizeGradeStr(sGC);

  // Direct exact equality
  if (normIG && normSG && normIG === normSG) return true;
  if (normIG && normSGC && normIG === normSGC) return true;

  // Substring inclusion ONLY if string length is sufficiently descriptive (>3 chars) to avoid single digit/letter false positives
  if (normSG && normSG.length > 3 && (normIG.includes(normSG) || normSG.includes(normIG))) return true;
  if (normSGC && normSGC.length > 3 && (normIG.includes(normSGC) || normSGC.includes(normIG))) return true;

  return false;
}

/**
 * Checks whether a target class section matches a student's gradeClass.
 */
export function isClassMatching(
  targetClass?: string | null,
  studentGradeClass?: string | null
): boolean {
  if (!targetClass) return true;
  const tc = targetClass.trim();
  if (
    !tc ||
    tc === 'جميع الفصول (عام)' ||
    tc === 'جميع الفصول' ||
    tc === 'عام' ||
    tc === 'الكل'
  ) {
    return true;
  }

  const sGC = (studentGradeClass || '').trim();
  if (!sGC) return true; // If student record has no specific class section, allow

  const normTC = normalizeGradeStr(tc);
  const normSGC = normalizeGradeStr(sGC);

  if (normTC === normSGC) return true;
  if (normSGC.includes(normTC) || normTC.includes(normSGC)) return true;

  return false;
}
