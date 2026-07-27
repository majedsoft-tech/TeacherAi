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
