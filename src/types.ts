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
  enableSubmitLock?: boolean;
  submitLockMinutesBeforeEnd?: number;
  targetStudentIds?: string[] | null;
  enableAntiCheat?: boolean;
  maxViolationsAllowed?: number;
  requireFullscreen?: boolean;
  preventCopyPaste?: boolean;
}

export interface ProctoringViolation {
  id: string;
  type: 'tab_switch' | 'fullscreen_exit' | 'blur' | 'copy_attempt' | 'devtools';
  message: string;
  timestamp: string;
}

export interface LiveStudentSession {
  id: string; // `${quizId}_${studentId}`
  quizId: string;
  quizTitle: string;
  studentId: string;
  studentName: string;
  gradeClass: string;
  teacherId?: string;
  status: 'active' | 'warning' | 'blurred' | 'tab_left' | 'submitted' | 'disqualified';
  isFullscreen: boolean;
  currentQuestionIdx: number;
  totalQuestions: number;
  answeredQuestions: number;
  violationsCount: number;
  maxViolations: number;
  violations: ProctoringViolation[];
  lastHeartbeat: number;
  startedAt: string;
  isCompleted?: boolean;
  score?: number;
  maxScore?: number;
  percentage?: number;
  submittedAt?: number | string;
}

export interface StudentGrade {
  quizId?: string;
  quizTitle: string;
  score: number;
  maxScore: number;
  date: string;
  passed: boolean;
  answers?: Record<string, any>;
  detailedQuestionResults?: any[];
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
  isRephrased?: boolean;
  version?: number;
  updatedAt?: string;
  rephraseExplanation?: string;
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
  gameType: 'time_attack' | 'space_invaders' | 'quiz_game' | 'car_racing' | 'penalty_shootout' | 'cloud_airplane' | 'wayground_arena';
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

export interface TextbookLesson {
  id: string;
  lessonTitle: string;
  pageOrSection?: string;
}

export interface TextbookUnit {
  id: string;
  unitTitle: string;
  lessons: TextbookLesson[];
}

export interface BookStructure {
  bookTitle?: string;
  isTextbook: boolean;
  stage?: string;
  grade?: string;
  semester?: string;
  subject?: string;
  units: TextbookUnit[];
  summary?: string;
}

