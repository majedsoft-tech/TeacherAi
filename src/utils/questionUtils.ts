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
    ig === 'all' ||
    ig.toLowerCase() === 'all' ||
    ig === 'general' ||
    ig.toLowerCase() === 'general' ||
    ig === 'عام' ||
    ig === 'الكل' ||
    ig === 'معاينة' ||
    ig === 'معاينة تجريبية' ||
    ig.includes('جميع الصفوف') ||
    ig.includes('جميع الفصول') ||
    ig.includes('جميع الشعب') ||
    ig.includes('جميع المراحل') ||
    ig.includes('(عام)')
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
 * Checks whether a target class section matches a student's semester or gradeClass.
 */
export function isClassMatching(
  targetClass?: string | null,
  studentClassOrSemester?: string | null,
  studentGradeClass?: string | null
): boolean {
  if (!targetClass) return true;
  const tc = targetClass.trim();
  if (
    !tc ||
    tc === 'all' ||
    tc.toLowerCase() === 'all' ||
    tc === 'general' ||
    tc.toLowerCase() === 'general' ||
    tc === 'عام' ||
    tc === 'الكل' ||
    tc.includes('جميع الفصول') ||
    tc.includes('جميع الشعب') ||
    tc.includes('جميع الصفوف') ||
    tc.includes('(عام)')
  ) {
    return true;
  }

  const sCS = (studentClassOrSemester || '').trim();
  const sGC = (studentGradeClass || '').trim();
  if (!sCS && !sGC) return true; // If student record has no specific class section, allow

  // Comma-separated list support (e.g. "1/1, 1/2")
  if (tc.includes(',')) {
    const parts = tc.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.some((p) => isClassMatching(p, studentClassOrSemester, studentGradeClass));
    }
  }

  const normTC = normalizeGradeStr(tc);
  const normSCS = normalizeGradeStr(sCS);
  const normSGC = normalizeGradeStr(sGC);

  if (normTC === normSCS || normTC === normSGC) return true;
  if (normSCS && (normSCS.includes(normTC) || normTC.includes(normSCS))) return true;
  if (normSGC && (normSGC.includes(normTC) || normTC.includes(normSGC))) return true;

  return false;
}

/**
 * Normalizes Arabic text for robust comparison:
 * - Trims whitespace and trailing punctuation
 * - Normalizes Alef forms (إ, أ, آ -> ا)
 * - Normalizes Teh Marbuta to Heh (ة -> ه)
 * - Normalizes Alif Maqsura to Ya (ى -> ي)
 * - Removes Arabic diacritics / tashkeel and tatweel
 * - Collapses repeated spaces
 * - Lowercases Latin characters
 */
export function normalizeArabicText(val: any): string {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  // Remove trailing punctuation
  str = str.replace(/[.\u06D4!؟?،,:;]+$/g, '').trim();
  // Arabic normalization
  str = str
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // remove tashkeel/diacritics and tatweel
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return str;
}

/**
 * Helper to check if a string represents TRUE in Arabic or English.
 * Note: Does NOT treat "1" as truthy (in Arabic tests, 0 is often True, 1 is False).
 */
export function isArabicTruthy(val: any): boolean {
  if (val === true) return true;
  const s = normalizeArabicText(val);
  return s === 'true' || s === 'صح' || s === 'صحيح' || s === 'صواب' || s === 'نعم';
}

/**
 * Helper to check if a string represents FALSE in Arabic or English.
 */
export function isArabicFalsy(val: any): boolean {
  if (val === false) return true;
  const s = normalizeArabicText(val);
  return (
    s === 'false' ||
    s === 'خطا' ||
    s === 'خاطي' ||
    s === 'خاطيه' ||
    s === 'لا'
  );
}

/**
 * Resolves whether a given value (from answer or question) represents TRUE or FALSE.
 * Handles boolean types, text ("صح", "خطأ", "true", "false"), and numeric indices (0 vs 1).
 */
export function resolveTrueFalseBoolean(val: any, options?: any[]): boolean | null {
  if (val === undefined || val === null) return null;
  if (val === true) return true;
  if (val === false) return false;

  const raw = String(val).trim();
  if (raw === '') return null;

  // Direct truthy / falsy word checks
  if (isArabicTruthy(raw)) return true;
  if (isArabicFalsy(raw)) return false;

  // Check if options array provides mapping
  const idx = parseInt(raw, 10);
  if (!isNaN(idx) && Array.isArray(options) && idx >= 0 && idx < options.length) {
    const optText = options[idx];
    if (isArabicTruthy(optText)) return true;
    if (isArabicFalsy(optText)) return false;
  }

  // Standard index convention for True/False (0 = True, 1 = False)
  if (raw === '0') return true;
  if (raw === '1') return false;

  return null;
}

/**
 * Resolves the display text of the correct answer for a question.
 */
export function resolveQuestionCorrectText(question: any): string {
  if (!question) return '';

  if (isTrueFalseQuestion(question)) {
    const boolVal = resolveTrueFalseBoolean(question.correctAnswer, question.options);
    if (boolVal === true) return 'صحيح (True)';
    if (boolVal === false) return 'خطأ (False)';
    return String(question.correctAnswer || '').trim();
  }

  const cRaw = String(question.correctAnswer ?? '').trim();
  if (Array.isArray(question.options) && question.options.length > 0) {
    const cIdx = parseInt(cRaw, 10);
    if (!isNaN(cIdx) && cRaw === String(cIdx) && cIdx >= 0 && cIdx < question.options.length) {
      return String(question.options[cIdx] || '').trim();
    }
    // If cRaw is text, check if it matches an option
    const normCRaw = normalizeArabicText(cRaw);
    const found = question.options.find((opt: any) => normalizeArabicText(opt) === normCRaw);
    if (found) return String(found).trim();
  }

  return cRaw;
}

/**
 * Universally evaluates if a student's answer is correct for any question (MCQ or T/F).
 * Covers text answers, index answers, normalized Arabic, diacritics, and edge cases.
 */
export function checkAnswerCorrectness(question: any, studentAnswer: any): boolean {
  if (!question || studentAnswer === undefined || studentAnswer === null) return false;
  const sRaw = String(studentAnswer).trim();
  if (sRaw === '') return false;

  // 1. True / False Question Evaluation
  if (isTrueFalseQuestion(question)) {
    const studentBool = resolveTrueFalseBoolean(studentAnswer, question.options);
    const correctBool = resolveTrueFalseBoolean(question.correctAnswer, question.options);

    if (studentBool !== null && correctBool !== null) {
      return studentBool === correctBool;
    }
  }

  // 2. Multiple Choice Evaluation
  const cRaw = String(question.correctAnswer ?? '').trim();
  if (cRaw === '') return false;

  const normStudent = normalizeArabicText(sRaw);
  const normCorrect = normalizeArabicText(cRaw);

  // Exact or normalized match between student answer and raw correct answer
  if (normStudent === normCorrect || sRaw === cRaw) {
    return true;
  }

  const options: any[] = Array.isArray(question.options) ? question.options : [];

  // Resolve correct option text and correct option index if options exist
  let correctOptIndex = -1;
  let correctOptText = '';

  const parsedCIdx = parseInt(cRaw, 10);
  if (!isNaN(parsedCIdx) && cRaw === String(parsedCIdx) && parsedCIdx >= 0 && parsedCIdx < options.length) {
    correctOptIndex = parsedCIdx;
    correctOptText = String(options[parsedCIdx] || '').trim();
  }

  if (!correctOptText && options.length > 0) {
    const foundIdx = options.findIndex(
      (opt: any) => normalizeArabicText(opt) === normCorrect || String(opt).trim() === cRaw
    );
    if (foundIdx >= 0) {
      correctOptIndex = foundIdx;
      correctOptText = String(options[foundIdx] || '').trim();
    }
  }

  const normResolvedCorrectText = normalizeArabicText(correctOptText);

  // If student answer matches resolved correct option text
  if (correctOptText && (normStudent === normResolvedCorrectText || sRaw === correctOptText)) {
    return true;
  }

  // If student submitted an index (e.g. "0", "1", "2", "3")
  const parsedSIdx = parseInt(sRaw, 10);
  if (!isNaN(parsedSIdx) && sRaw === String(parsedSIdx) && parsedSIdx >= 0 && parsedSIdx < options.length) {
    // Matches correct index directly
    if (correctOptIndex >= 0 && parsedSIdx === correctOptIndex) {
      return true;
    }
    // Student's chosen option text matches correct text or cRaw
    const studentSelectedText = String(options[parsedSIdx] || '').trim();
    const normStudentSelectedText = normalizeArabicText(studentSelectedText);
    if (
      normStudentSelectedText === normCorrect ||
      (correctOptText && normStudentSelectedText === normResolvedCorrectText) ||
      studentSelectedText === cRaw ||
      studentSelectedText === correctOptText
    ) {
      return true;
    }
  }

  // If student submitted text, check if that text corresponds to options[correctOptIndex]
  if (correctOptIndex >= 0 && correctOptIndex < options.length) {
    const textAtCorrectIndex = String(options[correctOptIndex] || '').trim();
    if (
      normalizeArabicText(textAtCorrectIndex) === normStudent ||
      textAtCorrectIndex === sRaw ||
      normalizeQuestionText(textAtCorrectIndex) === normalizeQuestionText(sRaw)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Normalizes question text for flexible comparison:
 * Strips diacritics, all punctuation, spaces around parentheses/brackets, extra whitespace,
 * and normalizes Arabic letters.
 */
export function normalizeQuestionText(val: any): string {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  // Normalize whitespace characters
  str = str.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');
  // Replace punctuation and symbols with spaces to prevent punctuation differences from breaking matching
  str = str.replace(/[\p{P}\p{S}]+/gu, ' ');
  return normalizeArabicText(str).replace(/\s+/g, ' ').trim();
}

/**
 * Robustly finds the matching question or result item from a list (such as detailedQuestionResults or original questions list).
 * Prioritizes:
 * 1. Question ID match (targetQ.id === item.questionId || item.id)
 * 2. Normalized Arabic question text match
 * 3. Deep cleaned text match (ignoring punctuation, parentheses, casing)
 * 4. Compressed text match (no spaces/punctuation)
 * NEVER blindly matches by index in a way that overrides ID or text matching.
 */
export function findMatchingQuestionItem<T extends { id?: string; questionId?: string; text?: string; [key: string]: any }>(
  targetQ: { id?: string; text?: string; [key: string]: any } | null | undefined,
  candidates: T[] | null | undefined
): T | null {
  if (!targetQ || !Array.isArray(candidates) || candidates.length === 0) return null;

  const targetId = targetQ.id ? String(targetQ.id).trim() : '';
  const targetText = targetQ.text ? String(targetQ.text).trim() : '';

  // 1. Match by ID
  if (targetId) {
    const byId = candidates.find((c) => {
      const cId = c.questionId ? String(c.questionId).trim() : c.id ? String(c.id).trim() : '';
      return Boolean(cId && cId === targetId);
    });
    if (byId) return byId;
  }

  // 2. Match by exact normalized Arabic text
  if (targetText) {
    const normTarget = normalizeArabicText(targetText);
    if (normTarget) {
      const byNormText = candidates.find((c) => c.text && normalizeArabicText(c.text) === normTarget);
      if (byNormText) return byNormText;
    }

    // 3. Match by deep cleaned text (stripping parentheses, punctuation, formatting)
    const cleanTarget = normalizeQuestionText(targetText);
    if (cleanTarget) {
      const byCleanText = candidates.find((c) => c.text && normalizeQuestionText(c.text) === cleanTarget);
      if (byCleanText) return byCleanText;

      // 4. Match by compressed text (no spaces, no punctuation)
      const compressedTarget = cleanTarget.replace(/\s+/g, '');
      if (compressedTarget.length >= 4) {
        const byCompressed = candidates.find((c) => {
          if (!c.text) return false;
          const cleanC = normalizeQuestionText(c.text).replace(/\s+/g, '');
          return cleanC === compressedTarget;
        });
        if (byCompressed) return byCompressed;
      }
    }
  }

  return null;
}
