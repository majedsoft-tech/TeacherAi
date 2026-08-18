import { Quiz, Student, TeacherStats, BankQuestion, ReviewChallenge, ReviewScore } from './types';

export const initialStats: TeacherStats = {
  totalStudents: 0,
  activeQuizzes: 0,
  successRate: 0,
  totalHomeworks: 0,
};

export const initialQuizzes: Quiz[] = [];

export const initialStudents: Student[] = [];

export const initialBankQuestions: BankQuestion[] = [];

export const initialGrades: string[] = [];

export const initialSemesters: Array<{ id: string; name: string; gradeName: string; number?: number }> = [];

export const initialReviewChallenges: ReviewChallenge[] = [];

export const initialReviewScores: ReviewScore[] = [];

