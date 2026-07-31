export type QuestionType = 'multiple_choice' | 'true_false';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string; // "0", "1", "2", "3" for choices, or "true", "false" for T/F
  points: number;
  isManual?: boolean;
}

export interface Quiz {
  id: string;
  title: string;
  subject: string;
  durationMinutes: number;
  status: 'active' | 'closed';
  questions: Question[];
  dateCreated: string;
  grade?: string | null;
  semester?: string | null;
  showResultToStudent?: boolean;
  shuffleQuestions?: boolean;
  availabilityStart?: string | null;
  availabilityEnd?: string | null;
  requireMoeEmail?: boolean;
  requireAcademicId?: boolean;
  requireClassGroup?: boolean;
  teacherId?: string;
}

export interface StudentGrade {
  quizTitle: string;
  score: number;
  maxScore: number;
  date: string;
  passed: boolean;
}

export interface Student {
  id: string;
  name: string;
  gradeClass: string;
  grade?: string;
  semester?: string;
  email: string;
  averageScore: number; // percentage
  status: 'excellent' | 'good' | 'average' | 'needs_improvement';
  detailedGrades: StudentGrade[];
  password?: string;
  passwordRequired?: boolean;
  deletedAt?: string;
  teacherId?: string;
}

export interface BankQuestion {
  id: string;
  teacherId: string;
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswer: string; // "0", "1", "2" etc or "true"/"false"
  points: number;
  stage: string;       // المرحلة
  grade: string;       // الصف
  semester: string;    // الفصل الدراسي
  subject: string;     // المادة
  unit: string;        // الوحدة
  lesson: string;      // الدرس
}

export interface TeacherStats {
  totalStudents: number;
  activeQuizzes: number;
  successRate: number; // percentage
  totalHomeworks: number;
}

export interface ReviewChallenge {
  id: string;
  title: string;
  subject: string;
  grade: string;
  semester: string;
  questions: Question[];
  status: 'active' | 'completed';
  teacherId: string;
  createdAt: string;
  gameType: 'time_attack' | 'space_invaders' | 'quiz_game' | 'car_racing' | 'maze_chase' | 'wayground_arena';
  liveState?: 'waiting' | 'playing' | 'podium';
  podiumAt?: string;
}

export interface ReviewScore {
  id: string;
  challengeId: string;
  studentId: string;
  studentName: string;
  gradeClass: string;
  score: number;
  correctCount: number;
  totalCount: number;
  timeSpentSeconds: number;
  completedAt: string;
  teacherId?: string;
}

