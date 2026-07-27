import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Gamepad2, 
  Trophy, 
  Play, 
  Check, 
  X, 
  Clock, 
  Timer, 
  Zap, 
  Star, 
  Award, 
  ChevronLeft, 
  Sparkles,
  Volume2,
  VolumeX,
  Send,
  Car,
  Users
} from "lucide-react";
import { ReviewChallenge, ReviewScore, Question } from "../types";
import { isTrueFalseQuestion, normalizeQuestion } from "../utils/questionUtils";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { setDoc, doc, collection, query, where, getDocs, deleteDoc, onSnapshot, updateDoc, deleteField, writeBatch } from "firebase/firestore";
import { LivePodiumView, FIXED_GAMES } from "./ReviewsAdminTab";

// Helper to normalize Arabic strings for robust grade/class comparisons
const normalizeArabicText = (str: string): string => {
  if (!str) return "";
  return str
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[-\s]+/g, " ") // normalize dashes and spaces to a single space
    .trim();
};

// --- RETRO SOUND SYNTHESIZER ENGINE ---
class GameSoundSynth {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  playCorrect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
    osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.5);
  }

  playIncorrect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playLaser() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.15);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playExplosion() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
    
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.35);
  }

  private bgmInterval: any = null;
  private bgmStep = 0;

  startBGM() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.bgmInterval) return;

    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    this.bgmStep = 0;
    
    const playStep = () => {
      if (!this.enabled || !this.ctx) return;
      
      const now = this.ctx.currentTime;
      
      // 1. Bassline (8-step loop) on even steps (0, 2, 4, 6)
      if (this.bgmStep % 2 === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = "triangle";
        
        // Dynamic, exciting progression
        const progression = [110.00, 130.81, 146.83, 164.81]; // A2, C3, D3, E3
        const stepIdx = Math.floor(this.bgmStep / 2) % progression.length;
        bassOsc.frequency.setValueAtTime(progression[stepIdx], now);
        
        bassGain.gain.setValueAtTime(0.05, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        
        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.4);
      }
      
      // 2. High-energy lead chiptune arpeggio (16-step melody)
      const leadOsc = this.ctx.createOscillator();
      const leadGain = this.ctx.createGain();
      leadOsc.type = "sine";
      
      const melody = [
        329.63, 392.00, 440.00, 523.25,
        587.33, 523.25, 440.00, 392.00,
        440.00, 523.25, 587.33, 659.25,
        783.99, 659.25, 587.33, 440.00
      ];
      const noteFreq = melody[this.bgmStep % melody.length];
      leadOsc.frequency.setValueAtTime(noteFreq, now);
      
      leadGain.gain.setValueAtTime(0.015, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      
      leadOsc.connect(leadGain);
      leadGain.connect(this.ctx.destination);
      leadOsc.start(now);
      leadOsc.stop(now + 0.2);

      // 3. Dynamic drum beat tick for an exciting tempo
      if (this.bgmStep % 2 === 1) {
        const snareOsc = this.ctx.createOscillator();
        const snareGain = this.ctx.createGain();
        snareOsc.type = "triangle";
        snareOsc.frequency.setValueAtTime(2500, now);
        snareOsc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
        
        snareGain.gain.setValueAtTime(0.015, now);
        snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        
        snareOsc.connect(snareGain);
        snareGain.connect(this.ctx.destination);
        snareOsc.start(now);
        snareOsc.stop(now + 0.07);
      }
      
      this.bgmStep = (this.bgmStep + 1) % 16;
    };

    // Run first step and set interval
    playStep();
    this.bgmInterval = setInterval(playStep, 200); // Upbeat 150 BPM feel
  }

  stopBGM() {
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }

  playCountdown() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now);
    
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playCountdownGo() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, now);
    
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.45);
  }

  playGameOver() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(392, now);
    osc1.frequency.setValueAtTime(349.23, now + 0.2);
    osc1.frequency.setValueAtTime(293.66, now + 0.4);
    
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(494, now);
    osc2.frequency.setValueAtTime(440, now + 0.2);
    osc2.frequency.setValueAtTime(349.23, now + 0.4);
    
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.75);
    osc2.stop(now + 0.75);
  }

  playBronzeReveal() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00]; // C4, E4, G4
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.15);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.15 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.6);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.65);
    });
  }

  playSilverReveal() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [329.63, 392.00, 523.25]; // E4, G4, C5
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.15);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.15 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.7);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.75);
    });
  }

  playGoldReveal() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = i === notes.length - 1 ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      if (i > 3) {
        const lfo = this.ctx!.createOscillator();
        const lfoGain = this.ctx!.createGain();
        lfo.frequency.value = 8;
        lfoGain.gain.value = 15;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(now);
        lfo.stop(now + 1.5);
      }
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 1.2);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 1.3);
    });
  }
}

const sfx = new GameSoundSynth();

// Helper function to shuffle an array (Fisher-Yates)
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Helper to randomize a challenge (shuffle questions randomly and shuffle options/answers of each multiple-choice question)
function randomizeChallenge(challenge: ReviewChallenge): ReviewChallenge {
  if (!challenge || !challenge.questions || challenge.questions.length === 0) return challenge;

  // Shuffle the questions list randomly
  const shuffledQuestions = shuffleArray([...challenge.questions]).map(q => {
    if (isTrueFalseQuestion(q)) {
      // For True/False questions, standardize options ("صحيح" / "خطأ") without shuffling order
      let opt1 = "صحيح";
      let opt2 = "خطأ";
      if (Array.isArray(q.options) && q.options.length >= 2) {
        const o1 = q.options[0]?.trim();
        const o2 = q.options[1]?.trim();
        if (o1 && o1 !== '' && o1 !== 'الخيار الثالث') opt1 = o1;
        if (o2 && o2 !== '' && o2 !== 'الخيار الثالث') opt2 = o2;
      }
      return {
        ...q,
        type: 'true_false' as const,
        options: [opt1, opt2],
      };
    }

    // For Multiple Choice questions: preserve all valid options
    const rawOptions = (q.options || []).filter(o => o !== undefined && o !== null && String(o).trim() !== '');
    if (rawOptions.length > 0) {
      const correctIdx = parseInt(q.correctAnswer);
      let targetCorrectText = "";
      if (!isNaN(correctIdx) && q.options && q.options[correctIdx] !== undefined) {
        targetCorrectText = q.options[correctIdx];
      } else if (q.correctAnswer) {
        targetCorrectText = q.correctAnswer;
      }

      // Track correct option cleanly based on original index and text
      const optionObjs = rawOptions.map((opt, idx) => {
        const originalIndexMatches = !isNaN(correctIdx) && q.options && q.options[correctIdx] === opt && idx === correctIdx;
        const textMatches = opt === targetCorrectText || opt === q.correctAnswer;
        return {
          text: opt,
          isCorrect: originalIndexMatches || textMatches
        };
      });

      const shuffledObjs = shuffleArray([...optionObjs]);
      let newCorrectIdx = shuffledObjs.findIndex(o => o.isCorrect);
      if (newCorrectIdx === -1) newCorrectIdx = 0;

      return {
        ...q,
        type: 'multiple_choice' as const,
        options: shuffledObjs.map(o => o.text),
        correctAnswer: newCorrectIdx.toString()
      };
    }

    return {
      ...q,
      type: 'multiple_choice' as const,
      options: q.options || [],
      correctAnswer: q.correctAnswer
    };
  });

  return {
    ...challenge,
    questions: shuffledQuestions
  };
}

const checkIsCorrect = (q: Question | undefined, ansIdx: number): boolean => {
  if (!q) return false;
  const isTf = isTrueFalseQuestion(q);
  if (isTf) {
    const val = q.correctAnswer;
    // index 0 is True/Correct, index 1 is False/Incorrect
    if (val === 'true' || val === '0' || val === 'صحيح' || val === 'صواب' || val === 'صح') {
      return ansIdx === 0;
    }
    if (val === 'false' || val === '1' || val === 'خطأ' || val === 'خاطئ') {
      return ansIdx === 1;
    }
  }
  
  // Multiple choice
  const parsed = parseInt(q.correctAnswer);
  if (!isNaN(parsed)) {
    return ansIdx === parsed;
  }
  
  // Text matching fallback
  if (q.options && q.options[ansIdx] === q.correctAnswer) {
    return true;
  }
  
  return false;
};

const getCumulativeLeaderboard = (
  scores: ReviewScore[],
  gradeClass: string,
  studentsList?: any[],
  activeStudentId?: string,
  activeChallengeId?: string,
  liveScore?: number
) => {
  const studentMap: { [studentId: string]: { studentId: string; studentName: string; score: number; correctCount: number; totalCount: number } } = {};
  
  if (studentsList) {
    studentsList.forEach(st => {
      if (st.gradeClass === gradeClass) {
        studentMap[st.id] = {
          studentId: st.id,
          studentName: st.name,
          score: 0,
          correctCount: 0,
          totalCount: 0
        };
      }
    });
  }

  scores.forEach(s => {
    if (s.gradeClass === gradeClass) {
      if (!studentMap[s.studentId]) {
        studentMap[s.studentId] = {
          studentId: s.studentId,
          studentName: s.studentName,
          score: 0,
          correctCount: 0,
          totalCount: 0
        };
      }
      studentMap[s.studentId].score += s.score || 0;
      studentMap[s.studentId].correctCount += s.correctCount || 0;
      studentMap[s.studentId].totalCount += s.totalCount || 0;
    }
  });

  if (activeStudentId && activeChallengeId && liveScore !== undefined && liveScore > 0) {
    const previousBestScoreForChallenge = scores.find(
      s => s.studentId === activeStudentId && s.challengeId === activeChallengeId
    );
    const prevScore = previousBestScoreForChallenge ? previousBestScoreForChallenge.score || 0 : 0;
    if (liveScore > prevScore) {
      const difference = liveScore - prevScore;
      if (studentMap[activeStudentId]) {
        studentMap[activeStudentId].score += difference;
      } else {
        studentMap[activeStudentId] = {
          studentId: activeStudentId,
          studentName: "أنت",
          score: liveScore,
          correctCount: 0,
          totalCount: 0
        };
      }
    }
  }
  
  return Object.values(studentMap).sort((a, b) => b.score - a.score);
};

interface StudentReviewsTabProps {
  activeStudent: any;
  reviewChallenges: ReviewChallenge[];
  reviewScores: ReviewScore[];
  students?: any[];
  triggerToast: (msg: string, type: "success" | "error" | "info") => void;
  onGameStateChange?: (state: "idle" | "playing" | "finished") => void;
  teacherId?: string;
}

export default function StudentReviewsTab({
  activeStudent,
  reviewChallenges,
  reviewScores,
  students,
  triggerToast,
  onGameStateChange,
  teacherId
}: StudentReviewsTabProps) {
  const [activeChallenge, setActiveChallenge] = useState<ReviewChallenge | null>(null);
  const [selectedLeaderboardChallengeId, setSelectedLeaderboardChallengeId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Game Play States
  const [gameState, setGameState] = useState<"idle" | "playing" | "finished">("idle");
  const [waygroundCountdown, setWaygroundCountdown] = useState<number | null>(null);
  const [showGameOverIntro, setShowGameOverIntro] = useState(false);
  const [hasFinishedWaygroundQuestions, setHasFinishedWaygroundQuestions] = useState(false);
  const [podiumSecondsLeft, setPodiumSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    onGameStateChange?.(gameState);
  }, [gameState, onGameStateChange]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState<number | null>(null);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  
  // Sub-game: Time Attack & Space Invaders states
  const [timeLeft, setTimeLeft] = useState(60);
  const [fallingMeteors, setFallingMeteors] = useState<{ id: number; answer: string; idx: number; isCorrect?: boolean; x: number; y: number; speed: number }[]>([]);
  const [laserEffect, setLaserEffect] = useState<{ active: boolean; targetX: number } | null>(null);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [shipX, setShipX] = useState(50);
  const [carAngle, setCarAngle] = useState(0);
  const [isBoostingState, setIsBoostingState] = useState(false);
  // Lifelines and streaks for Waygground Arena
  const [doubleScoreActive, setDoubleScoreActive] = useState(false);
  const [doubleScoreUsed, setDoubleScoreUsed] = useState(false);
  const [skipUsed, setSkipUsed] = useState(false);
  const [fiftyFiftyUsed, setFiftyFiftyUsed] = useState(false);
  const [disabledOptionIndices, setDisabledOptionIndices] = useState<number[]>([]);
  const [streak, setStreak] = useState(0);
  
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});
  const shipXRef = useRef(50);
  const carVelocityRef = useRef(0);
  const carAngleRef = useRef(0);

  const [isQuestionIntro, setIsQuestionIntro] = useState(false);
  const [introCountdown, setIntroCountdown] = useState(3);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isQuestionIntroRef = useRef(false);
  const introIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestionIdxRef = useRef(0);
  const isAnswerRevealedRef = useRef(false);
  const activeChallengeRef = useRef<ReviewChallenge | null>(null);
  const sessionBestScoresRef = useRef<Record<string, number>>({});
  const fallingMeteorsRef = useRef<any[]>([]);
  const gameStateRef = useRef<"idle" | "playing" | "finished">("idle");
  const enterLobbyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (activeChallenge) {
      enterLobbyTimeRef.current = Date.now();
    } else {
      enterLobbyTimeRef.current = 0;
    }
  }, [activeChallenge?.id]);

  useEffect(() => {
    shipXRef.current = shipX;
  }, [shipX]);

  useEffect(() => {
    currentQuestionIdxRef.current = currentQuestionIdx;
  }, [currentQuestionIdx]);

  useEffect(() => {
    isAnswerRevealedRef.current = isAnswerRevealed;
  }, [isAnswerRevealed]);

  useEffect(() => {
    activeChallengeRef.current = activeChallenge;
  }, [activeChallenge]);

  useEffect(() => {
    fallingMeteorsRef.current = fallingMeteors;
  }, [fallingMeteors]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    isQuestionIntroRef.current = isQuestionIntro;
  }, [isQuestionIntro]);

  const [leaderboardTab, setLeaderboardTab] = useState<"live" | "cumulative">("live");
  const [liveActivePlayers, setLiveActivePlayers] = useState<any[]>([]);

  // 1. Keep track of highest score achieved in this session per challenge
  useEffect(() => {
    if (!activeChallenge) return;
    if (score > (sessionBestScoresRef.current[activeChallenge.id] || 0)) {
      sessionBestScoresRef.current[activeChallenge.id] = score;
    }
  }, [score, activeChallenge]);

  // 2. Sync live playroom presence on game start / state updates / score changes
  useEffect(() => {
    if (!activeStudent || !activeStudent.id) return;

    const presenceRef = doc(db, "livePlayroomPresence", activeStudent.id);

    const liveSessionScore = activeChallenge 
      ? Math.max(score, sessionBestScoresRef.current[activeChallenge.id] || 0)
      : 0;

    const currentChallengeTitle = activeChallenge
      ? (gameState === "playing" || gameState === "finished" ? activeChallenge.title : "في صالة الانتظار 💬")
      : "في صالة الانتظار 💬";

    setDoc(presenceRef, {
      id: activeStudent.id,
      studentId: activeStudent.id,
      studentName: activeStudent.name,
      gradeClass: activeStudent.gradeClass || "غير محدد",
      challengeId: activeChallenge?.id || "",
      challengeTitle: currentChallengeTitle,
      score: liveSessionScore,
      updatedAt: new Date().toISOString(),
      active: true,
      teacherId: teacherId || activeStudent.teacherId || "",
      finished: hasFinishedWaygroundQuestions,
      currentQuestionIdx: currentQuestionIdx,
      totalQuestions: activeChallenge?.questions.length || 0
    }, { merge: true }).catch(err => {
      console.warn("Failed to set live presence:", err);
    });
  }, [
    activeStudent.id,
    activeStudent.name,
    activeStudent.gradeClass,
    activeStudent.teacherId,
    activeChallenge?.id,
    activeChallenge?.title,
    gameState,
    score,
    teacherId,
    hasFinishedWaygroundQuestions,
    currentQuestionIdx
  ]);

  // 3. Cleanup presence ONLY on unmount or when student ID changes (avoids race condition deletions on re-render)
  useEffect(() => {
    if (!activeStudent || !activeStudent.id) return;
    const studentIdToClean = activeStudent.id;

    return () => {
      const presenceRef = doc(db, "livePlayroomPresence", studentIdToClean);
      deleteDoc(presenceRef).catch(err => {
        console.warn("Failed to cleanup presence on unmount/id change:", err);
      });
    };
  }, [activeStudent.id]);

  // 4. Listen to active players for the playroom
  useEffect(() => {
    if (!activeStudent || !activeStudent.id) return;

    const currentTeacherId = teacherId || activeChallenge?.teacherId || activeStudent.teacherId || "";

    // Listen to all live playroom presence documents
    const q = query(collection(db, "livePlayroomPresence"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const players: any[] = [];
      const teacherStudentIds = new Set((students || []).map(s => s.id));
      let currentStudentInSnapshot = false;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        
        const isCurrentStudent = data.studentId === activeStudent.id;
        const isSameTeacherByList = teacherStudentIds.has(data.studentId);
        const isSameTeacherByField = currentTeacherId && data.teacherId === currentTeacherId;
        const isSameActiveChallenge = activeChallenge && data.challengeId === activeChallenge.id;

        if (isCurrentStudent) {
          if (activeChallenge) {
            if (data.challengeId === activeChallenge.id) {
              currentStudentInSnapshot = true;
            }
          } else {
            currentStudentInSnapshot = true;
          }
        }

        // Include if we are in an active challenge and the player is in this same challenge (or is the current student)
        if (activeChallenge) {
          if (isSameActiveChallenge || isCurrentStudent) {
            players.push(data);
          }
        } else {
          if (isCurrentStudent || isSameTeacherByList || isSameTeacherByField) {
            players.push(data);
          }
        }
      });

      // Check if the current student is missing from the active challenge's presence
      if (activeChallenge && !currentStudentInSnapshot) {
        const elapsed = Date.now() - enterLobbyTimeRef.current;
        if (elapsed > 4000) {
          // The teacher deleted our presence or kicked us!
          setTimeout(() => {
            handleExitGame();
            triggerToast("تم إخراجك من صالة الانتظار أو إعادة تعيين التحدي 🔄", "info");
          }, 0);
          return;
        }
      }

      // Sort players by:
      // 1. If playing the same active challenge as us, put them first
      // 2. Then sort by score descending
      players.sort((a, b) => {
        const aSameChallenge = activeChallenge && a.challengeId === activeChallenge.id ? 1 : 0;
        const bSameChallenge = activeChallenge && b.challengeId === activeChallenge.id ? 1 : 0;
        if (aSameChallenge !== bSameChallenge) {
          return bSameChallenge - aSameChallenge;
        }
        return (b.score || 0) - (a.score || 0);
      });

      setLiveActivePlayers(players);
    }, (error) => {
      console.warn("Failed to listen to live playroom presence:", error);
    });

    return () => {
      unsubscribe();
    };
  }, [activeStudent.id, students, activeChallenge?.id, activeChallenge?.teacherId, teacherId, activeStudent.teacherId]);

  const startWaygroundCountdown = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    sfx.stopBGM();
    setWaygroundCountdown(3);
    sfx.playCountdown();
    setHasFinishedWaygroundQuestions(false);
    setPodiumSecondsLeft(null);
    
    let current = 3;
    const interval = setInterval(() => {
      current -= 1;
      if (current > 0) {
        setWaygroundCountdown(current);
        sfx.playCountdown();
      } else if (current === 0) {
        setWaygroundCountdown(0);
        sfx.playCountdownGo();
      } else {
        clearInterval(interval);
        setWaygroundCountdown(null);
        setTimeLeft(15);
        startWaygroundTimer();
        sfx.startBGM();
      }
    }, 1000);
  };

  // Keep activeChallenge in sync with live prop updates from Firestore
  useEffect(() => {
    if (!activeChallenge) return;
    const matchingChallenge = reviewChallenges.find(c => c.id === activeChallenge.id) || reviewChallenges.find(c => c.gameType === activeChallenge.gameType);
    if (!matchingChallenge || matchingChallenge.status !== "active") {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      sfx.stopBGM();
      handleExitGame();
      triggerToast("تم إيقاف اللعبة وتجميدها من قبل المعلم ⏸️", "info");
      return;
    }

      const oldLiveState = activeChallenge.liveState;
      const newLiveState = matchingChallenge.liveState;
      
      if (oldLiveState !== "playing" && newLiveState === "playing") {
        // Teacher just started the game!
        // Reset state values for a fresh live contest
        setCurrentQuestionIdx(0);
        setSelectedAnswerIdx(null);
        setIsAnswerRevealed(false);
        setLastAnswerCorrect(null);
        setScore(0);
        setCorrectCount(0);
        setTimeSpent(0);
        setStreak(0);
        setDoubleScoreUsed(false);
        setDoubleScoreActive(false);
        setSkipUsed(false);
        setFiftyFiftyUsed(false);
        setDisabledOptionIndices([]);

        // Start 3-to-1 countdown
        startWaygroundCountdown();
        triggerToast("انطلق! تم بدء المواجهة الحماسية الآن! 🚀", "success");
      } else if (newLiveState === "waiting") {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        sfx.stopBGM();
        if (gameState === "playing" || gameState === "finished" || hasFinishedWaygroundQuestions) {
          handleExitGame();
          triggerToast("تمت إعادة تعيين التحدي وصالة الانتظار من قبل المعلم 🔄🗑️", "info");
        }
      } else if (oldLiveState !== "podium" && newLiveState === "podium") {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        sfx.stopBGM();
        sfx.playGameOver();
        setShowGameOverIntro(true);
        setTimeout(() => {
          setShowGameOverIntro(false);
        }, 4000);
      }
      
      // Check if questions in matchingChallenge changed from what we currently have stored
      const rawCurrent = (activeChallenge as any)._rawQuestions || [];
      const rawNew = matchingChallenge.questions || [];
      const questionsHaveChanged = JSON.stringify(rawNew) !== JSON.stringify(rawCurrent);

      if (questionsHaveChanged) {
        const newlyRandomized = {
          ...randomizeChallenge(matchingChallenge),
          _rawQuestions: matchingChallenge.questions
        };
        setActiveChallenge(newlyRandomized as ReviewChallenge);
        activeChallengeRef.current = newlyRandomized as ReviewChallenge;
        if (gameState === "playing") {
          setCurrentQuestionIdx(0);
          setSelectedAnswerIdx(null);
          setIsAnswerRevealed(false);
          triggerToast("تم تحديث أسئلة التحدي من قبل المعلم ⚡", "info");
        }
      } else {
        // Preserve randomized options/answers and only update metadata fields
        const updatedChallenge: ReviewChallenge = {
          ...activeChallenge,
          title: matchingChallenge.title,
          subject: matchingChallenge.subject,
          grade: matchingChallenge.grade,
          semester: matchingChallenge.semester,
          status: matchingChallenge.status,
          liveState: matchingChallenge.liveState,
          podiumAt: matchingChallenge.podiumAt,
        };
        setActiveChallenge(updatedChallenge);
        activeChallengeRef.current = updatedChallenge;
      }
  }, [reviewChallenges, activeChallenge?.id]);

  // 1. Auto-transition live game to podium state when all students completed all questions
  useEffect(() => {
    if (
      activeChallenge &&
      activeChallenge.gameType === "wayground_arena" &&
      activeChallenge.liveState === "playing" &&
      liveActivePlayers.length > 0 &&
      liveActivePlayers.every(p => p.finished === true)
    ) {
      // All active players have completed their questions!
      // Automatically end the live challenge and transition to the podium state
      const challengeRef = doc(db, "reviewChallenges", activeChallenge.id);
      updateDoc(challengeRef, {
        liveState: "podium",
        podiumAt: new Date().toISOString()
      }).catch(err => {
        console.warn("Failed to auto-transition live challenge to podium:", err);
      });
    }
  }, [activeChallenge, liveActivePlayers]);

  // 2. Clean up and reset game after 30 seconds in podium state
  useEffect(() => {
    let interval: any = null;
    if (
      activeChallenge &&
      activeChallenge.gameType === "wayground_arena" &&
      activeChallenge.liveState === "podium" &&
      activeChallenge.podiumAt
    ) {
      const podiumTime = new Date(activeChallenge.podiumAt).getTime();
      
      const checkAndCleanup = async () => {
        const now = Date.now();
        const diffSeconds = (now - podiumTime) / 1000;
        
        // Update countdown state for student UI
        const left = Math.max(0, Math.ceil(30 - diffSeconds));
        setPodiumSecondsLeft(left);

        if (diffSeconds >= 30) {
          if (interval) clearInterval(interval);
          
          try {
            // 1. Reset the challenge state back to waiting to close the playroom
            const challengeRef = doc(db, "reviewChallenges", activeChallenge.id);
            await updateDoc(challengeRef, {
              liveState: "waiting",
              podiumAt: deleteField()
            });

            // 2. Clear presence
            const q = query(
              collection(db, "livePlayroomPresence"),
              where("challengeId", "==", activeChallenge.id)
            );
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.forEach((docSnap) => {
              batch.delete(docSnap.ref);
            });
            await batch.commit();
          } catch (err) {
            console.warn("Error during automatic podium cleanup:", err);
          }

          // 3. Exit game locally back to challenge list
          handleExitGame();
        }
      };

      // Run check immediately
      checkAndCleanup();

      // Check every second
      interval = setInterval(checkAndCleanup, 1000);
      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      setPodiumSecondsLeft(null);
    }
  }, [activeChallenge]);

  // Refs for timers
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameLoopRef = useRef<number | null>(null);
  const gameSecondsRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    sfx.enabled = soundEnabled;
    if (gameState === "playing" && soundEnabled) {
      if (activeChallenge?.gameType === "wayground_arena") {
        if (activeChallenge.liveState === "playing") {
          sfx.startBGM();
        } else {
          sfx.stopBGM();
        }
      } else {
        sfx.startBGM();
      }
    } else {
      sfx.stopBGM();
    }
    return () => {
      sfx.stopBGM();
    };
  }, [soundEnabled, gameState, activeChallenge?.id, activeChallenge?.liveState]);

  // Handle keyboard events to move the spaceship/car left/right and fire or boost
  useEffect(() => {
    if (gameState !== "playing") {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent standard browser scrolling when playing
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Spacebar"].includes(e.key)) {
        e.preventDefault();
      }
      keysPressedRef.current[e.key] = true;
      if (e.key === " ") {
        setIsBoostingState(true);
      }

      const challenge = activeChallengeRef.current;
      if (!challenge || isAnswerRevealedRef.current) return;

      if (challenge.gameType === "space_invaders") {
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
          setShipX(prev => {
            const val = Math.max(5, prev - 6);
            shipXRef.current = val;
            return val;
          });
        } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
          setShipX(prev => {
            const val = Math.min(95, prev + 6);
            shipXRef.current = val;
            return val;
          });
        } else if (e.key === " " || e.key === "Enter") {
          const currentMeteors = fallingMeteorsRef.current;
          const currentShipX = shipXRef.current;
          if (currentMeteors && currentMeteors.length > 0) {
            let closestMeteor = currentMeteors[0];
            let minDiff = Math.abs(currentMeteors[0].x - currentShipX);
            for (let i = 1; i < currentMeteors.length; i++) {
              const diff = Math.abs(currentMeteors[i].x - currentShipX);
              if (diff < minDiff) {
                minDiff = diff;
                closestMeteor = currentMeteors[i];
              }
            }
            handleShootMeteor(closestMeteor);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key] = false;
      if (e.key === " ") {
        setIsBoostingState(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState]);

  // Mouse & Touch movement handlers over the canvas area
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const challenge = activeChallengeRef.current;
    const isGameWithMovement = challenge && (challenge.gameType === "space_invaders" || challenge.gameType === "car_racing");
    if (isAnswerRevealedRef.current || !isGameWithMovement) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setShipX(percentage);
    shipXRef.current = percentage;
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const challenge = activeChallengeRef.current;
    const isGameWithMovement = challenge && (challenge.gameType === "space_invaders" || challenge.gameType === "car_racing");
    if (isAnswerRevealedRef.current || !isGameWithMovement) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    if (!touch) return;
    const x = touch.clientX - rect.left;
    const percentage = Math.max(5, Math.min(95, (x / rect.width) * 100));
    setShipX(percentage);
    shipXRef.current = percentage;
  };

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (gameSecondsRef.current) clearInterval(gameSecondsRef.current);
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    };
  }, []);

  // Helper for grade normalization inside StudentReviewsTab
  const normalizeGradeStr = (str: string) => {
    if (!str) return "";
    return str
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/\s+/g, " ");
  };

  // Filter challenges appropriate for this student's grade
  const getMyChallenges = () => {
    return reviewChallenges.filter(c => {
      // Hide non-active (completed, draft, archived, etc.) challenges
      const statusStr = (c.status as string) || "active";
      if (statusStr !== "active") return false;
      
      const challengeGrade = (c.grade || "").trim();
      // If the challenge grade is empty, general, or "جميع الفصول (عام)", show it to all students
      if (
        !challengeGrade || 
        challengeGrade === "جميع الفصول (عام)" || 
        challengeGrade === "عام" || 
        challengeGrade === "جميع الفصول" || 
        challengeGrade === "الكل" ||
        challengeGrade === "جميع المراحل"
      ) {
        return true;
      }
      
      const sGrade = (activeStudent?.grade || "").trim();
      const sGradeClass = (activeStudent?.gradeClass || "").trim();
      
      // If student has no grade specified, show all published challenges
      if (!sGrade && !sGradeClass) return true;
      
      const normCGrade = normalizeGradeStr(challengeGrade);
      const normSGrade = normalizeGradeStr(sGrade);
      const normSGradeClass = normalizeGradeStr(sGradeClass);
      
      if (normCGrade && normSGrade && normCGrade === normSGrade) return true;
      if (normCGrade && normSGradeClass && normSGradeClass.includes(normCGrade)) return true;
      if (sGrade && (challengeGrade.includes(sGrade) || sGrade.includes(challengeGrade))) return true;
      if (sGradeClass && (sGradeClass.includes(challengeGrade) || challengeGrade.includes(sGradeClass))) return true;
      
      // Fallback: If no strict grade filtering blocks it, allow student to view
      return true;
    });
  };

  // Start a challenge
  const handleStartGame = (challenge: ReviewChallenge) => {
    const randomizedChallenge = {
      ...randomizeChallenge(challenge),
      _rawQuestions: challenge.questions
    };
    setActiveChallenge(randomizedChallenge as ReviewChallenge);
    setGameState("playing");
    setCurrentQuestionIdx(0);
    setSelectedAnswerIdx(null);
    setIsAnswerRevealed(false);
    setLastAnswerCorrect(null);
    setScore(0);
    setCorrectCount(0);
    setTimeSpent(0);

    // Reset Waygground Arena Lifelines and Streaks
    setDoubleScoreActive(false);
    setDoubleScoreUsed(false);
    setSkipUsed(false);
    setFiftyFiftyUsed(false);
    setDisabledOptionIndices([]);
    setStreak(0);

    // Initialize refs immediately to guarantee zero-lag and avoid stale closure checks on startup
    activeChallengeRef.current = randomizedChallenge;
    currentQuestionIdxRef.current = 0;
    isAnswerRevealedRef.current = false;
    gameStateRef.current = "playing";
    shipXRef.current = 50;
    setShipX(50);
    carVelocityRef.current = 0;
    carAngleRef.current = 0;

    // Audio cue
    sfx.playCorrect();

    if (randomizedChallenge.gameType === "time_attack") {
      setTimeLeft(60);
      // Start time attack secondary timer
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current!);
            handleFinishGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (randomizedChallenge.gameType === "space_invaders") {
      // Setup first question falling items with 3-second center-of-arena presentation
      startQuestionWithIntro(0, "space_invaders", randomizedChallenge);
    } else if (randomizedChallenge.gameType === "car_racing") {
      // Setup road items with 3-second center-of-arena presentation
      startQuestionWithIntro(0, "car_racing", randomizedChallenge);
    } else if (randomizedChallenge.gameType === "wayground_arena") {
      setTimeLeft(15);
      setHasFinishedWaygroundQuestions(false);
      setPodiumSecondsLeft(null);
      if (randomizedChallenge.liveState === "playing") {
        startWaygroundTimer();
      }
    } else {
      // Classic Quiz Show Question timer (e.g., 15s per question)
      setTimeLeft(15);
      startQuestionTimer();
    }

    // Measure total game time seconds
    if (gameSecondsRef.current) clearInterval(gameSecondsRef.current);
    gameSecondsRef.current = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);
  };

  // Start question with a beautiful 3-second center-of-arena presentation
  const startQuestionWithIntro = (qIdx: number, gameType: string, customChallenge?: ReviewChallenge) => {
    const challenge = customChallenge || activeChallenge || activeChallengeRef.current;
    if (!challenge) return;
    const q = challenge.questions[qIdx];
    if (!q) return;

    // 1. Reset any existing game loop, clear falling items, and stop active timers during intro
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setFallingMeteors([]);
    fallingMeteorsRef.current = [];

    // 2. Set Intro phase state
    setIsQuestionIntro(true);
    isQuestionIntroRef.current = true;
    setIsTransitioning(false);
    setIntroCountdown(3);

    // Play a starting tick sound
    sfx.playLaser();

    // 3. Clear existing intro interval if any
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);

    let currentSeconds = 3;
    const interval = setInterval(() => {
      currentSeconds -= 1;
      if (currentSeconds > 0) {
        setIntroCountdown(currentSeconds);
        sfx.playLaser(); // countdown tick sound
      } else {
        clearInterval(interval);
        introIntervalRef.current = null;
        
        // Activate transition phase
        setIsTransitioning(true);
        setIntroCountdown(0);
        sfx.playLaser();

        // 4. Wait for transition (800ms) before starting gameplay
        setTimeout(() => {
          setIsQuestionIntro(false);
          isQuestionIntroRef.current = false;
          setIsTransitioning(false);

          // Trigger the actual gameplay items!
          if (gameType === "space_invaders") {
            setupSpaceMeteors(q);
            startInteractiveGameTimer("space_invaders");
          } else if (gameType === "car_racing") {
            setupRoadItems(q);
            startInteractiveGameTimer("car_racing");
          }
        }, 800);
      }
    }, 1000);
    introIntervalRef.current = interval;
  };

  // Classic Question Timer
  const startQuestionTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimeLeft(15);
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto incorrect due to time-out
          handleSelectAnswerClassic(-1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Interactive Games (Space Invaders & Car Racing) Question Timer
  const startInteractiveGameTimer = (gameType: "space_invaders" | "car_racing") => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimeLeft(25); // 25 seconds per question for interactive games
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          if (gameType === "space_invaders") {
            handleShootMeteor({
              isCorrect: false,
              x: shipXRef.current,
              y: 30,
              idx: -1
            });
          } else if (gameType === "car_racing") {
            handleCarCollision({
              isCorrect: false,
              x: shipXRef.current,
              y: 80,
              idx: -1
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Setup Space Invader falling meteors
  const setupSpaceMeteors = (q: Question) => {
    if (!q) return;
    const items = q.options.map((opt, i) => ({
      id: Math.random(),
      answer: opt,
      idx: i,
      isCorrect: checkIsCorrect(q, i),
      x: 10 + i * 22, // space them out horizontally
      y: -10 - Math.random() * 20, // offset entry times
      speed: 0.15 + Math.random() * 0.08
    }));
    setFallingMeteors(items);
    fallingMeteorsRef.current = items;

    // Start Animation frame loop for falling
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    
    const animate = () => {
      if (isAnswerRevealedRef.current) {
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        return;
      }
      setFallingMeteors(prev => {
        const updated = prev.map(m => {
          let newY = m.y + m.speed;
          if (newY > 80) {
            // Respawn at top if it hits the ground
            newY = -10;
          }
          return { ...m, y: newY };
        });
        fallingMeteorsRef.current = updated;
        return updated;
      });
      gameLoopRef.current = requestAnimationFrame(animate);
    };
    gameLoopRef.current = requestAnimationFrame(animate);
  };

  // Setup Road Items for Car Racing Game
  const setupRoadItems = (q: Question) => {
    if (!q) return;
    
    // Position options horizontally based on number of choices, distributed as lanes
    const count = q.options.length;
    const laneWidth = 100 / count;
    
    const items = q.options.map((opt, i) => {
      // spread them horizontally across lanes
      const x = laneWidth / 2 + i * laneWidth;
      return {
        id: Math.random(),
        answer: opt,
        idx: i,
        isCorrect: checkIsCorrect(q, i),
        x: x,
        y: -15 - (i * 25), // staggered vertical offsets so they do not fall aligned
        speed: 0.18 // slower descend speed as per user request
      };
    });
    setFallingMeteors(items);
    fallingMeteorsRef.current = items;

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    
    let isColliding = false;

    const animate = () => {
      // If answer is revealed, immediately cancel this loop and return
      if (isAnswerRevealedRef.current) {
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        return;
      }

      // 1. Process Drift Physics: Acceleration, Inertia, Friction
      let accel = 0;
      const leftPressed = keysPressedRef.current["ArrowLeft"] || keysPressedRef.current["a"] || keysPressedRef.current["A"];
      const rightPressed = keysPressedRef.current["ArrowRight"] || keysPressedRef.current["d"] || keysPressedRef.current["D"];

      if (leftPressed) {
        accel = -0.75; // responsive left acceleration
        carVelocityRef.current = (carVelocityRef.current + accel) * 0.85;
      } else if (rightPressed) {
        accel = 0.75; // responsive right acceleration
        carVelocityRef.current = (carVelocityRef.current + accel) * 0.85;
      } else {
        // Stop very quickly in the same place immediately when arrow key is released!
        carVelocityRef.current = 0;
      }
      
      let nextX = shipXRef.current + carVelocityRef.current;
      if (nextX < 6) {
        nextX = 6;
        carVelocityRef.current = 0;
      } else if (nextX > 94) {
        nextX = 94;
        carVelocityRef.current = 0;
      }
      shipXRef.current = nextX;
      setShipX(nextX);

      // Calculate Drift angle based on velocity (max 22 degrees tilt)
      const targetAngle = carVelocityRef.current * 4.5;
      carAngleRef.current = carAngleRef.current * 0.75 + targetAngle * 0.25;
      setCarAngle(carAngleRef.current);

      // Check booster speed modifier (Space key)
      const isBoosting = !!keysPressedRef.current[" "];

      setFallingMeteors(prev => {
        let collisionDetected = false;
        let collidingMeteor: any = null;

        prev.forEach(m => {
          if (!isColliding && m.y >= 72 && m.y <= 85) {
            // Check horizontal proximity (if within 11% width)
            if (Math.abs(m.x - nextX) < 11) {
              collisionDetected = true;
              collidingMeteor = m;
            }
          }
        });

        if (collisionDetected && collidingMeteor && !isColliding) {
          isColliding = true;
          const targetMeteor = collidingMeteor;
          setTimeout(() => {
            handleCarCollision(targetMeteor, nextX);
          }, 0);
        }

        const boosterMultiplier = isBoosting ? 2.5 : 1.0;

        const updated = prev.map(m => {
          let newY = m.y + m.speed * boosterMultiplier;
          if (newY > 95) {
            // Respawn at top if it passed the bottom
            newY = -20;
          }
          return { ...m, y: newY };
        });
        fallingMeteorsRef.current = updated;
        return updated;
      });

      gameLoopRef.current = requestAnimationFrame(animate);
    };
    gameLoopRef.current = requestAnimationFrame(animate);
  };

  // Handle Car Collision in Car Racing Game
  const handleCarCollision = (item: any, currentShipX?: number) => {
    const challenge = activeChallengeRef.current;
    if (!challenge || isAnswerRevealedRef.current) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    setIsAnswerRevealed(true);
    isAnswerRevealedRef.current = true;
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);

    const currentIdx = currentQuestionIdxRef.current;
    const currentQ = challenge.questions[currentIdx];
    if (!currentQ) return;
    const isCorrect = item.isCorrect !== undefined ? item.isCorrect : checkIsCorrect(currentQ, item.idx);
    const activeX = currentShipX !== undefined ? currentShipX : shipXRef.current;

    // sparks/particles effect
    const colors = isCorrect ? ["#fbbf24", "#34d399", "#10b981"] : ["#ef4444", "#f87171", "#f59e0b"];
    const newParticles = Array.from({ length: 15 }).map(() => ({
      id: Math.random(),
      x: activeX + (Math.random() - 0.5) * 8,
      y: 80 + (Math.random() - 0.5) * 6,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    setParticles(newParticles);

    setTimeout(() => {
      setParticles([]);
    }, 600);

    if (isCorrect) {
      sfx.playCorrect();
      setCorrectCount(prev => prev + 1);
      setScore(prev => prev + 150);
    } else {
      sfx.playIncorrect();
      setScore(prev => Math.max(0, prev - 40));
    }
    setLastAnswerCorrect(isCorrect);

    // Go to next question after 2.5 seconds
    setTimeout(() => {
      setIsAnswerRevealed(false);
      isAnswerRevealedRef.current = false;
      setLastAnswerCorrect(null);
      
      const latestChallenge = activeChallengeRef.current;
      const latestIdx = currentQuestionIdxRef.current;
      if (latestChallenge && latestIdx + 1 < latestChallenge.questions.length) {
        const nextIdx = latestIdx + 1;
        setCurrentQuestionIdx(nextIdx);
        currentQuestionIdxRef.current = nextIdx;
        startQuestionWithIntro(nextIdx, "car_racing");
      } else {
        handleFinishGame();
      }
    }, 2500);
  };

  // Start Waygground Arena Timer
  const startWaygroundTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimeLeft(15);
    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          handleSelectAnswerWayground(-1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Save Waygground Arena Final Score and enter waiting state
  const saveWaygroundFinalScore = async () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (gameSecondsRef.current) clearInterval(gameSecondsRef.current);
    
    setHasFinishedWaygroundQuestions(true);
    sfx.playCorrect();

    if (!activeChallenge) return;

    const scoreId = `${activeChallenge.id}_${activeStudent.id}`;
    const finalScoreData: ReviewScore = {
      id: scoreId,
      challengeId: activeChallenge.id,
      studentId: activeStudent.id,
      studentName: activeStudent.name,
      gradeClass: activeStudent.gradeClass || "غير محدد",
      score: score,
      correctCount: correctCount,
      totalCount: activeChallenge.questions.length,
      timeSpentSeconds: timeSpent || 1,
      completedAt: new Date().toISOString(),
      teacherId: activeChallenge.teacherId || activeStudent.teacherId || teacherId || ""
    };

    try {
      const existing = reviewScores.find(s => s.id === scoreId);
      if (!existing || score > existing.score) {
        await setDoc(doc(db, "reviewScores", scoreId), finalScoreData);
        triggerToast("كفو! تم تسجيل نتيجتك الرائعة على لوحة المتصدرين فوراً 🏆🔥", "success");
      } else {
        triggerToast("أنهيت التحدي! وبانتظار منصة التتويج من قبل المعلم 👍", "info");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reviewScores/${scoreId}`);
    }
  };

  // Select Waygground Arena Answer
  const handleSelectAnswerWayground = (ansIdx: number) => {
    if (isAnswerRevealed || !activeChallenge) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    setSelectedAnswerIdx(ansIdx);
    setIsAnswerRevealed(true);

    const currentQ = activeChallenge.questions[currentQuestionIdx];
    if (!currentQ) return;
    const isCorrect = ansIdx !== -1 && checkIsCorrect(currentQ, ansIdx);
    setLastAnswerCorrect(isCorrect);

    if (isCorrect) {
      sfx.playCorrect();
      setCorrectCount(prev => prev + 1);
      setStreak(prev => prev + 1);
      
      // 100 points maximum per question, decreasing based on speed
      const basePoints = Math.max(10, Math.round(100 * (timeLeft / 15)));
      const gained = basePoints * (doubleScoreActive ? 2 : 1);
      setScore(prev => prev + gained);
    } else {
      sfx.playIncorrect();
      setStreak(0);
    }

    // Go to next question after 2.5 seconds
    setTimeout(() => {
      setDoubleScoreActive(false);
      setDisabledOptionIndices([]);
      if (currentQuestionIdx + 1 < activeChallenge.questions.length) {
        setCurrentQuestionIdx(prev => prev + 1);
        setSelectedAnswerIdx(null);
        setIsAnswerRevealed(false);
        setLastAnswerCorrect(null);
        startWaygroundTimer();
      } else {
        saveWaygroundFinalScore();
      }
    }, 2500);
  };

  // Waygground 50/50 Lifeline
  const useFiftyFifty = () => {
    if (fiftyFiftyUsed || isAnswerRevealed || !activeChallenge) return;
    const currentQ = activeChallenge.questions[currentQuestionIdx];
    if (!currentQ || currentQ.options.length <= 2) {
      triggerToast("لا يمكن استخدام وسيلة حذف الإجابات على هذا السؤال!", "info");
      return;
    }

    // Identify incorrect option indices
    const incorrectIndices: number[] = [];
    currentQ.options.forEach((_, idx) => {
      if (!checkIsCorrect(currentQ, idx)) {
        incorrectIndices.push(idx);
      }
    });

    // Pick 2 random incorrect indices to disable
    const shuffledIncorrect = shuffleArray(incorrectIndices);
    const toDisable = shuffledIncorrect.slice(0, 2);

    setDisabledOptionIndices(toDisable);
    setFiftyFiftyUsed(true);
    sfx.playLaser();
    triggerToast("تم حذف إجابتين خاطئتين! 💥", "success");
  };

  // Waygground Double Score Lifeline
  const useDoubleScore = () => {
    if (doubleScoreUsed || isAnswerRevealed) return;
    setDoubleScoreActive(true);
    setDoubleScoreUsed(true);
    sfx.playLaser();
    triggerToast("تفعيل مضاعف النقاط للسؤال الحالي! ⚡🔥", "success");
  };

  // Waygground Skip Question Lifeline
  const useSkipQuestion = () => {
    if (skipUsed || isAnswerRevealed || !activeChallenge) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    setSkipUsed(true);
    sfx.playLaser();
    setIsAnswerRevealed(true);
    setLastAnswerCorrect(true); // Treat as visual correct so it turns green
    triggerToast("تم تخطي السؤال الحالي بنجاح! 🛡️✨", "success");

    setTimeout(() => {
      setDoubleScoreActive(false);
      setDisabledOptionIndices([]);
      if (currentQuestionIdx + 1 < activeChallenge.questions.length) {
        setCurrentQuestionIdx(prev => prev + 1);
        setSelectedAnswerIdx(null);
        setIsAnswerRevealed(false);
        setLastAnswerCorrect(null);
        startWaygroundTimer();
      } else {
        handleFinishGame();
      }
    }, 1500);
  };

  // Handle Classic Answer select
  const handleSelectAnswerClassic = (ansIdx: number) => {
    if (isAnswerRevealed || !activeChallenge) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    setSelectedAnswerIdx(ansIdx);
    setIsAnswerRevealed(true);

    const currentQ = activeChallenge.questions[currentQuestionIdx];
    if (!currentQ) return;
    const isCorrect = checkIsCorrect(currentQ, ansIdx);
    setLastAnswerCorrect(isCorrect);

    if (isCorrect) {
      sfx.playCorrect();
      setCorrectCount(prev => prev + 1);
      // Base score 100 + speed multiplier bonus points
      const speedBonus = Math.round(timeLeft * 3.33); // up to 50 pts
      setScore(prev => prev + 100 + speedBonus);
    } else {
      sfx.playIncorrect();
    }

    // Go to next question after 2.5 seconds to allow full feedback impact
    setTimeout(() => {
      if (currentQuestionIdx + 1 < activeChallenge.questions.length) {
        setCurrentQuestionIdx(prev => prev + 1);
        setSelectedAnswerIdx(null);
        setIsAnswerRevealed(false);
        setLastAnswerCorrect(null);
        startQuestionTimer();
      } else {
        handleFinishGame();
      }
    }, 2500);
  };

  // Handle Time Attack Answer select
  const handleSelectAnswerTimeAttack = (ansIdx: number) => {
    if (!activeChallenge) return;
    const currentQ = activeChallenge.questions[currentQuestionIdx];
    if (!currentQ) return;
    const isCorrect = checkIsCorrect(currentQ, ansIdx);

    if (isCorrect) {
      sfx.playCorrect();
      setCorrectCount(prev => prev + 1);
      setScore(prev => prev + 100);
    } else {
      sfx.playIncorrect();
      // small deduction to penalize guessing
      setScore(prev => Math.max(0, prev - 25));
    }

    // Instantly go to next question
    if (currentQuestionIdx + 1 < activeChallenge.questions.length) {
      setCurrentQuestionIdx(prev => prev + 1);
    } else {
      // Loop questions if they finished all before 60 seconds!
      setCurrentQuestionIdx(0);
    }
  };

  // Handle Space Invader shooting a meteor
  const handleShootMeteor = (meteor: any) => {
    const challenge = activeChallengeRef.current;
    if (!challenge || isAnswerRevealedRef.current) return;
    
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // Smoothly or instantly move spaceship under the targeted meteor
    setShipX(meteor.x);
    shipXRef.current = meteor.x;
    
    sfx.playLaser();
    setLaserEffect({ active: true, targetX: meteor.x });
    setIsAnswerRevealed(true);
    isAnswerRevealedRef.current = true;

    const currentIdx = currentQuestionIdxRef.current;
    const currentQ = challenge.questions[currentIdx];
    if (!currentQ) return;
    const isCorrect = meteor.isCorrect !== undefined ? meteor.isCorrect : checkIsCorrect(currentQ, meteor.idx);

    // trigger particles
    const colors = ["#fbbf24", "#f59e0b", "#ef4444", "#3b82f6", "#10b981"];
    const newParticles = Array.from({ length: 15 }).map(() => ({
      id: Math.random(),
      x: meteor.x + (Math.random() - 0.5) * 8,
      y: meteor.y + (Math.random() - 0.5) * 8,
      color: colors[Math.floor(Math.random() * colors.length)]
    }));
    setParticles(newParticles);

    setTimeout(() => {
      setLaserEffect(null);
      setParticles([]);
    }, 400);

    if (isCorrect) {
      sfx.playExplosion();
      setCorrectCount(prev => prev + 1);
      setScore(prev => prev + 150); // space invaders grants high points!
    } else {
      sfx.playIncorrect();
    }
    setLastAnswerCorrect(isCorrect);

    // Move to next question after 2.2 seconds
    setTimeout(() => {
      setIsAnswerRevealed(false);
      isAnswerRevealedRef.current = false;
      setLastAnswerCorrect(null);
      
      const latestChallenge = activeChallengeRef.current;
      const latestIdx = currentQuestionIdxRef.current;
      if (latestChallenge && latestIdx + 1 < latestChallenge.questions.length) {
        const nextIdx = latestIdx + 1;
        setCurrentQuestionIdx(nextIdx);
        currentQuestionIdxRef.current = nextIdx;
        startQuestionWithIntro(nextIdx, "space_invaders");
      } else {
        handleFinishGame();
      }
    }, 2200);
  };

  // Finish Game and save Score
  const handleFinishGame = async () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (gameSecondsRef.current) clearInterval(gameSecondsRef.current);
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);
    setIsQuestionIntro(false);
    isQuestionIntroRef.current = false;

    setGameState("finished");
    sfx.playCorrect();

    if (!activeChallenge) return;

    // Check if score is higher than their previous score for this challenge
    const scoreId = `${activeChallenge.id}_${activeStudent.id}`;
    
    const finalScoreData: ReviewScore = {
      id: scoreId,
      challengeId: activeChallenge.id,
      studentId: activeStudent.id,
      studentName: activeStudent.name,
      gradeClass: activeStudent.gradeClass || "غير محدد",
      score: score,
      correctCount: correctCount,
      totalCount: activeChallenge.questions.length,
      timeSpentSeconds: timeSpent || 1,
      completedAt: new Date().toISOString(),
      teacherId: activeChallenge.teacherId || activeStudent.teacherId || teacherId || ""
    };

    try {
      // Find if they already have an existing score
      const existing = reviewScores.find(s => s.id === scoreId);
      if (!existing || score > existing.score) {
        await setDoc(doc(db, "reviewScores", scoreId), finalScoreData);
        triggerToast("كفو! تم تسجيل نتيجتك الرائعة على لوحة المتصدرين فوراً 🏆🔥", "success");
      } else {
        triggerToast("أنهيت التحدي! لكن نتيجتك السابقة كانت أعلى، لذا احتفظنا بالأعلى 👍", "info");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reviewScores/${scoreId}`);
    }
  };

  // Exit game to list
  const handleExitGame = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (gameSecondsRef.current) clearInterval(gameSecondsRef.current);
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);
    setIsQuestionIntro(false);
    isQuestionIntroRef.current = false;

    setGameState("idle");
    setActiveChallenge(null);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Sound Controller & Next Challenge Float (Visible in Idle state) */}
      {gameState === "idle" && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-3xs">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5.5 h-5.5 text-indigo-600" />
              <h3 className="font-black text-sm text-slate-800">صالة الألعاب والتحديات بالمعمل 🎮</h3>
            </div>
            
            {/* Next Challenge Info */}
            {(() => {
              const myChallenges = getMyChallenges();
              let nextCh: ReviewChallenge | null = null;
              const unplayed = myChallenges.find(c => !reviewScores.some(s => s.challengeId === c.id && s.studentId === activeStudent.id));
              nextCh = unplayed || (myChallenges.length > 0 ? myChallenges[0] : null);

              if (!nextCh) return null;

              return (
                <div className="flex items-center gap-2 bg-indigo-50/80 px-3 py-1.5 rounded-xl border border-indigo-100 text-indigo-950 text-xs">
                  <span className="font-black text-indigo-600 animate-pulse">⚡ التحدي التالي المقترح:</span>
                  <span className="font-bold font-sans">{nextCh.title}</span>
                  <button
                    onClick={() => handleStartGame(nextCh!)}
                    className="mr-2 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] rounded-lg transition transform hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    ابدأ التحدي
                  </button>
                </div>
              );
            })()}
          </div>
          
          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl transition cursor-pointer border ${
                soundEnabled ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-slate-100 border-slate-200 text-slate-500"
              }`}
              title={soundEnabled ? "إيقاف المؤثرات الصوتية" : "تشغيل المؤثرات الصوتية"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* Game Idle: list active challenges in 3 approved games card grid */}
        {gameState === "idle" && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="max-w-6xl mx-auto space-y-6 w-full"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                  <Play className="w-5 h-5 text-indigo-600 fill-current" />
                  ألعاب التحدي والمراجعة المعتمدة 🎮
                </h4>
                <span className="text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
                  الألعاب المتاحة ({getMyChallenges().length} تحديات)
                </span>
              </div>

              {/* 3 Approved Games Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    gameType: "wayground_arena",
                    id: "fixed_game_wayground_arena",
                    badgeLabel: "KAHOOT STYLE 🎪",
                    gameTitle: "كاهوت 🎪",
                    defaultTitle: "كاهوت 🎪",
                    desc: "مواجهة حية ومباشرة بين كافة الطلاب بنظام خيارات الألوان وسرعة الإجابة",
                    headerBg: "bg-gradient-to-br from-purple-950 via-indigo-900 to-purple-900 border-b-2 border-purple-500/50",
                  },
                  {
                    gameType: "space_invaders",
                    id: "fixed_game_space_invaders",
                    badgeLabel: "SPACE INVADERS 🚀",
                    gameTitle: "الفضاء 🚀",
                    defaultTitle: "معركة الفضاء 🚀",
                    desc: "لعبة تحريك المركبة الفضائية وإطلاق النار على الإجابات الصحيحة",
                    headerBg: "bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 border-b-2 border-emerald-500/50",
                  },
                  {
                    gameType: "car_racing",
                    id: "fixed_game_car_racing",
                    badgeLabel: "RACING ARENA 🏎️",
                    gameTitle: "سباق السيارات 🏎️",
                    defaultTitle: "سباق السيارات السريع 🏎️",
                    desc: "قيادة السيارة على مضمار المراجعة وتجاوز العقبات بالإجابات الصحيحة",
                    headerBg: "bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border-b-2 border-indigo-500/50",
                  }
                ].map((fg) => {
                  const challenge = reviewChallenges.find(c => c.id === fg.id) || reviewChallenges.find(c => c.gameType === fg.gameType);
                  const isActivated = challenge ? (challenge.status === "active" && challenge.questions && challenge.questions.length > 0) : false;
                  
                  const questionsCount = challenge?.questions?.length || 0;
                  const totalScoresCount = challenge ? reviewScores.filter(s => s.challengeId === challenge.id).length : 0;
                  const myBestScore = challenge ? reviewScores.find(s => s.challengeId === challenge.id && s.studentId === activeStudent.id) : null;

                  return (
                    <div
                      key={fg.gameType}
                      className="bg-white rounded-3xl border border-slate-200/90 shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between group"
                    >
                      {/* Top Banner */}
                      <div className={`w-full h-36 ${fg.headerBg} flex flex-col justify-between p-3.5 relative overflow-hidden`}>
                        {fg.gameType === "car_racing" && (
                          <div className="absolute inset-0 bg-slate-900 flex justify-around opacity-30 pointer-events-none">
                            <div className="w-0.5 h-full border-r border-dashed border-slate-400" />
                            <div className="w-0.5 h-full border-r border-dashed border-slate-400" />
                          </div>
                        )}
                        {fg.gameType === "space_invaders" && (
                          <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
                        )}

                        <div className="relative z-10 flex justify-between items-center">
                          <span className="text-[10px] font-black text-white/90 bg-black/40 px-2.5 py-1 rounded-full border border-white/20 backdrop-blur-xs shadow-xs">
                            {fg.badgeLabel}
                          </span>
                          {isActivated ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-xs animate-pulse">
                              مفعلة 🟢
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-slate-300 border border-slate-700">
                              غير مفعلة ⏸️
                            </span>
                          )}
                        </div>

                        <div className="relative z-10 my-auto text-center space-y-1">
                          {fg.gameType === "car_racing" && <div className="text-3xl">🏎️</div>}
                          {fg.gameType === "space_invaders" && <div className="text-3xl animate-bounce">🚀</div>}
                          {fg.gameType === "wayground_arena" && (
                            <div className="space-y-1">
                              <div className="text-2xl">🎪</div>
                              <div className="flex justify-center gap-1.5 text-[9px] font-black text-white">
                                <span className="bg-rose-600 px-1.5 py-0.5 rounded shadow-xs">▲ أحمر</span>
                                <span className="bg-blue-600 px-1.5 py-0.5 rounded shadow-xs">◆ أزرق</span>
                                <span className="bg-amber-500 px-1.5 py-0.5 rounded shadow-xs">● أصفر</span>
                                <span className="bg-emerald-600 px-1.5 py-0.5 rounded shadow-xs">■ أخضر</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Full Width Game Title Header */}
                      <div className="w-full bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border-y border-indigo-200/90 py-2.5 px-4 text-center">
                        <span className="text-sm sm:text-base font-black text-indigo-900 tracking-wide">
                          {fg.gameTitle}
                        </span>
                      </div>

                      {/* Card Body */}
                      <div className="p-5 pt-3.5 space-y-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-2 text-center">
                          <p className="text-xs text-slate-600 font-bold leading-relaxed">
                            {fg.desc}
                          </p>
                          <h4 className="font-black text-slate-900 text-base sm:text-lg leading-snug pt-2 border-t border-slate-100">
                            {challenge?.title || fg.defaultTitle}
                          </h4>
                        </div>

                        {/* Metadata Pills */}
                        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-700 pt-2 border-t border-slate-100">
                          <span className="bg-slate-100 text-slate-800 border border-slate-200 px-2.5 py-1 rounded-lg">
                            📚 {challenge?.subject || "عام"}
                          </span>
                          <span className="bg-indigo-50 text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-lg">
                            ❓ {questionsCount} أسئلة
                          </span>
                          <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 px-2.5 py-1 rounded-lg">
                            👥 {totalScoresCount} إجابات
                          </span>
                        </div>

                        {/* Best Score Badge if Played */}
                        {myBestScore && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-2.5 text-center font-sans">
                            <span className="text-[10px] text-emerald-700 block font-black">🏆 أعلى نتيجة لك:</span>
                            <span className="text-xs font-black text-emerald-800">
                              {myBestScore.score} نقطة ({myBestScore.correctCount} صح)
                            </span>
                          </div>
                        )}

                        {/* Action Button */}
                        <div className="pt-2 border-t border-slate-100">
                          {isActivated && challenge ? (
                            <button
                              onClick={() => handleStartGame(challenge)}
                              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-95"
                            >
                              <Play className="w-4 h-4 fill-current" />
                              <span>ابدأ التحدي الآن 🚀</span>
                            </button>
                          ) : (
                            <button
                              disabled
                              className="w-full py-3 bg-slate-100 border border-slate-200 text-slate-400 rounded-xl text-xs font-black cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                              <span>غير متاحة حالياً ⏸️</span>
                            </button>
                          )}
                        </div>

                        {/* Independent Leaderboard & Results Section for this Game */}
                        {(() => {
                          const gameLeaderboard = (() => {
                            if (!challenge) return [];
                            const challengeScores = reviewScores.filter(s => s.challengeId === challenge.id);
                            const studentMap: { [studentId: string]: ReviewScore } = {};
                            challengeScores.forEach(s => {
                              if (!studentMap[s.studentId] || (s.score || 0) > (studentMap[s.studentId].score || 0)) {
                                studentMap[s.studentId] = s;
                              }
                            });
                            return Object.values(studentMap).sort((a, b) => (b.score || 0) - (a.score || 0));
                          })();

                          return (
                            <div className="pt-3 border-t border-slate-100 space-y-2 text-right">
                              {/* Leaderboard entries */}

                              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {gameLeaderboard.slice(0, 5).map((scoreItem, idx) => {
                                  const isMe = scoreItem.studentId === activeStudent?.id;
                                  return (
                                    <div
                                      key={scoreItem.id || idx}
                                      className={`p-2 rounded-xl text-xs flex items-center justify-between gap-2 border font-sans ${
                                        isMe
                                          ? "bg-amber-50 border-amber-300 text-amber-900 font-black shadow-xs"
                                          : "bg-slate-50/80 border-slate-200 text-slate-700"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <span
                                          className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] shrink-0 ${
                                            idx === 0
                                              ? "bg-amber-400 text-slate-950"
                                              : idx === 1
                                              ? "bg-slate-300 text-slate-950"
                                              : idx === 2
                                              ? "bg-amber-700 text-white"
                                              : "bg-slate-200 text-slate-600"
                                          }`}
                                        >
                                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                                        </span>
                                        <span className="truncate font-bold text-[11px]">
                                          {scoreItem.studentName} {isMe && <span className="text-amber-600 font-bold">(أنت)</span>}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0 font-extrabold text-[11px]">
                                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-sans">
                                          {scoreItem.score} ن
                                        </span>
                                        <span className="text-slate-400 text-[10px] font-sans">
                                          ({scoreItem.correctCount}/{scoreItem.totalCount})
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}

                                {gameLeaderboard.length === 0 && (
                                  <p className="text-center text-[11px] text-slate-400 font-bold py-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                    لا توجد نتائج مسجلة لهذه اللعبة بعد. كن أول المتصدرين! 🚀
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Game Active Arena (Playing / Finished) - Merged top bar header, game arena, and competitors list into one container with zero gaps */}
        {(gameState === "playing" || gameState === "finished") && activeChallenge && (
          <div className="bg-white text-slate-800 rounded-3xl border border-indigo-100 shadow-lg w-full">
            {/* Merged Active Top Bar Header - Sticky Top Bar containing controls, stats, and sticky Question Box */}
            <div className="w-full p-3.5 sm:p-4 bg-white/95 backdrop-blur-md border-b border-indigo-100 sticky top-0 z-50 rounded-t-3xl shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Right Group: Exit button & Challenge Title */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleExitGame}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-xl cursor-pointer transition-all duration-150 flex items-center gap-1.5 shadow-xs border border-rose-200 shrink-0"
                  >
                    <ChevronLeft className="w-4 h-4 rotate-180" />
                    <span>خروج للصالة الرئيسية</span>
                  </button>
                  <div className="h-6 w-px bg-slate-200 hidden xs:block" />
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block font-bold">التحدي الحالي:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-black text-indigo-800">{activeChallenge.title}</span>
                    </div>
                  </div>
                </div>

                {/* Left Group: Stats & Sound */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 sm:gap-3 w-full sm:w-auto shrink-0 font-sans">
                  {/* Streak */}
                  {gameState === "playing" && (
                    <motion.div 
                      animate={streak > 0 ? { scale: [1, 1.15, 1] } : {}}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border font-black text-xs ${
                        streak > 0 ? "bg-amber-50 text-amber-700 border-amber-300" : "bg-slate-50 text-slate-500 border-slate-200"
                      }`}
                    >
                      <span>🔥</span>
                      <span className="font-sans text-xs">{streak}</span>
                    </motion.div>
                  )}

                  {/* Progress Badge */}
                  {gameState === "playing" && (
                    <div className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-950 font-extrabold text-xs rounded-xl font-sans">
                      {currentQuestionIdx + 1} / {activeChallenge.questions.length}
                    </div>
                  )}

                  {/* Score Badge */}
                  <div className="bg-amber-50 border border-amber-200/80 px-3 py-1 rounded-xl text-right shadow-2xs">
                    <span className="text-[9px] text-amber-800 block font-bold">النقاط:</span>
                    <span className="text-xs sm:text-sm font-black text-amber-600 block leading-none">
                      {score} <span className="text-[9px]">ن</span>
                    </span>
                  </div>

                  {/* Time Remaining Badge */}
                  {gameState === "playing" && (
                    <div className={`px-3 py-1 rounded-xl text-right border transition-all duration-300 ${
                      timeLeft <= 5 
                        ? "bg-rose-50 border-rose-200 text-rose-700 animate-pulse" 
                        : "bg-emerald-50 border-emerald-200 text-emerald-800"
                    }`}>
                      <span className={`text-[9px] block font-bold ${timeLeft <= 5 ? "text-rose-700" : "text-emerald-700"}`}>المتبقي:</span>
                      <span className="text-xs sm:text-sm font-black block leading-none">
                        {timeLeft} <span className="text-[9px]">ث</span>
                      </span>
                    </div>
                  )}

                  <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                  {/* Sound Toggle */}
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-2 rounded-xl transition cursor-pointer border ${
                      soundEnabled ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-slate-100 border-slate-200 text-slate-500"
                    }`}
                    title={soundEnabled ? "إيقاف المؤثرات الصوتية" : "تشغيل المؤثرات الصوتية"}
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Inner Grid with Arena (3 cols) and Competitors List (1 col) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-indigo-100/90 w-full">
              <motion.div
                key="game-room"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="lg:col-span-3 p-4 sm:p-6 space-y-4 select-none relative overflow-hidden w-full"
              >
              {/* Visual game glows */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

              {/* HIGH-IMPACT EXTREMELY VISUAL FEEDBACK OVERLAY */}
              <AnimatePresence>
                {isAnswerRevealed && lastAnswerCorrect !== null && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 z-50 flex flex-col items-center justify-center p-6 text-center select-none"
                    style={{
                      background: lastAnswerCorrect 
                        ? "radial-gradient(circle, rgba(6,78,59,0.95) 0%, rgba(2,15,10,0.98) 100%)"
                        : "radial-gradient(circle, rgba(127,29,29,0.95) 0%, rgba(20,5,5,0.98) 100%)"
                    }}
                  >
                    {/* Pulsing ring background glow */}
                    <div className={`absolute w-72 h-72 rounded-full blur-3xl animate-pulse pointer-events-none ${
                      lastAnswerCorrect ? "bg-emerald-500/20" : "bg-rose-500/20"
                    }`} />

                    <motion.div
                      initial={{ scale: 0.3, y: 50, opacity: 0 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      exit={{ scale: 0.5, y: -30, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 280, damping: 18 }}
                      className="relative z-10 max-w-sm w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center gap-6"
                      style={{
                        boxShadow: lastAnswerCorrect 
                          ? "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(16, 185, 129, 0.35)"
                          : "0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(239, 68, 68, 0.35)",
                        borderColor: lastAnswerCorrect ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"
                      }}
                    >
                      {/* Big animated Check or Cross icon */}
                      <motion.div
                        initial={{ rotate: -90, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                        className={`w-24 h-24 rounded-full flex items-center justify-center border-4 shadow-lg ${
                          lastAnswerCorrect 
                            ? "bg-emerald-500/10 border-emerald-400 text-emerald-400 shadow-emerald-500/20" 
                            : "bg-rose-500/10 border-rose-400 text-rose-400 shadow-rose-500/20"
                        }`}
                      >
                        {lastAnswerCorrect ? (
                          <svg className="w-12 h-12 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3">
                            <motion.path 
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ delay: 0.2, duration: 0.4 }}
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              d="M5 13l4 4L19 7" 
                            />
                          </svg>
                        ) : (
                          <svg className="w-12 h-12 stroke-current" fill="none" viewBox="0 0 24 24" strokeWidth="3">
                            <motion.path 
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ delay: 0.2, duration: 0.4 }}
                              strokeLinecap="round" 
                              strokeLinejoin="round" 
                              d="M6 18L18 6M6 6l12 12" 
                            />
                          </svg>
                        )}
                      </motion.div>

                      {/* Main result heading */}
                      <div className="space-y-2">
                        <h3 className={`text-2xl font-black ${
                          lastAnswerCorrect 
                            ? "text-emerald-400 drop-shadow-[0_2px_8px_rgba(52,211,153,0.5)]" 
                            : "text-rose-400 drop-shadow-[0_2px_8px_rgba(248,113,113,0.5)]"
                        }`}>
                          {lastAnswerCorrect ? "إجابة صحيحة مذهلة! 🎉" : "إجابة غير صحيحة ❌"}
                        </h3>
                        
                        <p className="text-xs text-slate-300 font-bold leading-relaxed px-4">
                          {lastAnswerCorrect 
                            ? "عمل رائع ومثالي! نقاطك تزداد وسرعتك ممتازة، واصل هذا التقدم المذهل."
                            : "لا بأس! كل محاولة خاطئة هي فرصة ذهبية للتعلم وحفظ المعلومة الصحيحة."
                          }
                        </p>
                      </div>

                      {/* Points / Badge */}
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className={`px-6 py-2 rounded-2xl font-black text-sm flex items-center gap-1.5 border ${
                          lastAnswerCorrect 
                            ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]" 
                            : "bg-rose-950/60 text-rose-300 border-rose-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                        }`}
                      >
                        <span>{lastAnswerCorrect ? "أحسنت:" : "النتيجة:"}</span>
                        <span className="font-sans text-base">
                          {lastAnswerCorrect 
                            ? `+${activeChallenge.gameType === "space_invaders" || activeChallenge.gameType === "car_racing" ? 150 : 100 + Math.round(timeLeft * 3.33)}` 
                            : activeChallenge.gameType === "car_racing" ? "-40" : "0"
                          }
                        </span>
                        <span>درجة</span>
                      </motion.div>

                      {/* Moving Indicator */}
                      <div className="w-full flex items-center gap-2 pt-2 border-t border-slate-800/80">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                        <span className="text-[10px] text-slate-400 font-black">جاري الانتقال التلقائي للسؤال القادم...</span>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {gameState === "playing" ? (
                // GAME IN PROGRESS SCREEN
                <>
                  {/* GAME TYPE 5: WAYGROUND ARENA */}
                  {activeChallenge.gameType === "wayground_arena" && (
                    <div className="space-y-6 relative z-10 p-2 md:p-4 rounded-3xl bg-gradient-to-b from-indigo-50/90 via-purple-50/80 to-white border border-indigo-100/80 shadow-md min-h-[580px] flex flex-col justify-between">
                      {showGameOverIntro ? (
                        /* GAME OVER INTRO SCREEN */
                        <div className="flex flex-col flex-1 items-center justify-center p-8 text-center space-y-6">
                          <motion.div
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: [1, 1.2, 1], rotate: 0 }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="w-24 h-24 bg-rose-500/10 rounded-full border-2 border-rose-500 flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(239,68,68,0.4)]"
                          >
                            🏁
                          </motion.div>
                          <div className="space-y-2">
                            <motion.h3
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: 0.3 }}
                              className="text-4xl md:text-6xl font-black text-rose-500 tracking-wider font-sans drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                            >
                              انتهت اللعبة!
                            </motion.h3>
                            <motion.p
                              initial={{ y: 20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              transition={{ delay: 0.6 }}
                              className="text-lg text-purple-300 font-bold"
                            >
                              مستعدون لإعلان الفرسان الأبطال على منصة التتويج؟ 🏆🔥
                            </motion.p>
                          </div>
                          
                          {/* Pulsing neon progress bar */}
                          <div className="w-64 h-1.5 bg-purple-950 rounded-full overflow-hidden relative border border-purple-900/40">
                            <motion.div 
                              initial={{ left: "-100%" }}
                              animate={{ left: "100%" }}
                              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                              className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-rose-500 to-transparent"
                            />
                          </div>
                        </div>
                      ) : waygroundCountdown !== null ? (
                        /* COUNTDOWN VIEW */
                        <div className="flex flex-col flex-1 items-center justify-center p-8 text-center">
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={`wayground-countdown-${waygroundCountdown}`}
                              initial={{ scale: 0, opacity: 0, rotate: -45 }}
                              animate={{ 
                                scale: [1.2, 1], 
                                opacity: 1, 
                                rotate: 0,
                                filter: ["drop-shadow(0 0 30px rgba(168,85,247,0.8))", "drop-shadow(0 0 10px rgba(168,85,247,0.3))"]
                              }}
                              exit={{ scale: 2, opacity: 0, filter: "drop-shadow(0 0 50px rgba(168,85,247,0))" }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="flex flex-col items-center justify-center"
                            >
                              <span className="text-[120px] md:text-[180px] font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 drop-shadow-[0_10px_20px_rgba(0,0,0,0.6)]">
                                {waygroundCountdown === 0 ? "🚀" : waygroundCountdown}
                              </span>
                              
                              <span className="text-xl md:text-3xl font-black text-purple-200 mt-4 tracking-wide">
                                {waygroundCountdown === 3 && "استعد للتحدي! 🛡️"}
                                {waygroundCountdown === 2 && "التركيز والسرعة! ⚡"}
                                {waygroundCountdown === 1 && "جاهز؟ 🔥"}
                                {waygroundCountdown === 0 && "انطلق! 🚀"}
                              </span>
                            </motion.div>
                          </AnimatePresence>
                        </div>
                      ) : (!activeChallenge.liveState || activeChallenge.liveState === "waiting") ? (
                        /* LOBBY VIEW */
                        <div className="flex flex-col flex-1 justify-between p-4 space-y-6 text-center">
                          <div className="space-y-2 mt-6">
                            <motion.div
                              animate={{ scale: [1, 1.05, 1] }}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-black"
                            >
                              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                              <span>صالة الانتظار المباشرة للمعمل 🏟️</span>
                            </motion.div>
                            <h3 className="text-xl md:text-2xl font-black text-white">
                              {activeChallenge.title}
                            </h3>
                            <p className="text-xs text-purple-300 max-w-md mx-auto leading-relaxed font-bold">
                              أهلاً بك في المعركة الحاسمة! بمجرد اكتمال دخول زملائك الفرسان، سيطلق المعلم شارة بدء التحدي المباشر. استعد! 🔥
                            </p>
                          </div>

                          <div className="bg-slate-950/40 rounded-2xl border border-purple-950 p-6 space-y-4 my-auto max-w-3xl mx-auto w-full">
                            <div className="flex justify-between items-center pb-3 border-b border-purple-900/20">
                              <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-purple-400" />
                                الفرسان المتواجدون بساحة الانتظار المباشرة ({liveActivePlayers.length})
                              </span>
                              <span className="text-[10px] font-bold text-yellow-400 animate-pulse">مزامنة حية للمعمل ⚡</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto p-1">
                              <AnimatePresence>
                                {liveActivePlayers.map((player) => (
                                  <motion.div
                                    key={player.studentId}
                                    initial={{ opacity: 0, scale: 0.7, y: 15 }}
                                    animate={{ 
                                      opacity: 1, 
                                      scale: 1, 
                                      y: [0, -6, 0],
                                      x: [0, 4, 0]
                                    }}
                                    transition={{
                                      y: {
                                        repeat: Infinity,
                                        repeatType: "reverse",
                                        duration: 2 + (Math.random() * 2),
                                        ease: "easeInOut"
                                      },
                                      x: {
                                        repeat: Infinity,
                                        repeatType: "reverse",
                                        duration: 1.5 + (Math.random() * 2),
                                        ease: "easeInOut"
                                      },
                                      scale: { duration: 0.3 }
                                    }}
                                    className="p-3.5 rounded-2xl bg-purple-900/10 border border-purple-800/30 flex flex-col items-center justify-center text-center shadow-md hover:border-purple-500/20 transition duration-300"
                                  >
                                    <div className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center font-black text-xs mb-1.5 shadow-md">
                                      {player.studentName.charAt(0)}
                                    </div>
                                    <span className="text-xs font-black text-white block truncate max-w-[110px]">
                                      {player.studentName}
                                    </span>
                                    <span className="text-[9px] text-purple-400 font-bold mt-0.5">
                                      {player.gradeClass || "عام"}
                                    </span>
                                  </motion.div>
                                ))}
                              </AnimatePresence>

                              {liveActivePlayers.length === 0 && (
                                <div className="col-span-full py-12 text-center text-slate-500 text-xs font-bold space-y-2">
                                  <Gamepad2 className="w-10 h-10 text-slate-600 mx-auto animate-bounce" />
                                  <p className="text-slate-400">في انتظار انضمام الفرسان... ابدأوا بالانضمام فوراً! 🏟️</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-purple-950/30 border border-purple-900/40 p-4 rounded-2xl max-w-xl mx-auto w-full flex items-center gap-3 text-right">
                            <span className="text-xl">💡</span>
                            <div>
                              <h5 className="text-xs font-black text-purple-300">تعليمات المعركة الحاسمة:</h5>
                              <p className="text-[10px] text-slate-400 leading-relaxed font-bold mt-0.5">
                                ستحصل على 15 ثانية لكل سؤال. استخدم وسائل المساعدة كحذف إجابتين (50:50) أو مضاعفة النقاط (2x) أو تخطي السؤال بحكمة لتتصدر الفرسان! 🎖️
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : activeChallenge.liveState === "podium" ? (
                        /* PODIUM VIEW */
                        <div className="w-full flex flex-col items-center justify-center p-2">
                          <LivePodiumView
                            scores={liveActivePlayers.slice(0, 3)}
                            onReset={() => {}}
                            isAdmin={false}
                          />
                          {podiumSecondsLeft !== null && (
                            <div className="mt-4 px-4 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-full text-xs font-bold animate-pulse text-center">
                              ⏳ سيتم إغلاق ساحة المعركة التنافسية وإرجاع الطلاب بعد{" "}
                              <span className="font-sans font-black text-rose-400">
                                {podiumSecondsLeft}
                              </span>{" "}
                              ثانية
                            </div>
                          )}
                          <div className="mt-4">
                            <button
                              onClick={() => setGameState("idle")}
                              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-black transition cursor-pointer"
                            >
                              العودة لرئيسية التحديات 🏟️
                            </button>
                          </div>
                        </div>
                      ) : hasFinishedWaygroundQuestions ? (
                        /* WAITING FOR OTHER PLAYERS SCREEN */
                        <div className="flex flex-col flex-1 items-center justify-center p-8 text-center space-y-6">
                          <motion.div
                            animate={{ scale: [1, 1.1, 1], rotate: [0, 10, -10, 0] }}
                            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                            className="w-20 h-20 bg-indigo-500/10 rounded-full border border-indigo-500/30 flex items-center justify-center text-4xl shadow-[0_0_30px_rgba(99,102,241,0.2)]"
                          >
                            ⌛
                          </motion.div>
                          <div className="space-y-2">
                            <h3 className="text-2xl font-black text-white">لقد أكملت جميع الأسئلة بنجاح! 🎉</h3>
                            <p className="text-sm text-slate-300 font-bold max-w-md mx-auto leading-relaxed">
                              بانتظار بقية فرسان الفصل لإكمال إجاباتهم، أو إنهاء المعلم للمنافسة لعرض منصة التتويج والأبطال الفائزين! 🏆🔥
                            </p>
                          </div>
                          
                          <div className="bg-slate-900 border border-purple-950 p-4 rounded-xl max-w-sm w-full space-y-2">
                            <div className="text-right flex justify-between text-xs font-bold text-indigo-300 mb-1">
                              <span>نتيجتك الإجمالية:</span>
                              <span className="font-sans text-yellow-400">{score} نقطة</span>
                            </div>
                            <div className="text-right flex justify-between text-xs font-bold text-indigo-300">
                              <span>الإجابات الصحيحة:</span>
                              <span className="font-sans text-emerald-400">{correctCount} / {activeChallenge.questions.length}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* PLAYING ACTIVE GAMEPLAY SCREEN */
                        <>
                          {/* Options Container with Question Card */}
                          <div className="my-auto py-2 space-y-4">
                            {/* Question Card */}
                            <motion.div 
                              key={`wayground-q-${currentQuestionIdx}`}
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="bg-slate-900/95 border border-indigo-500/30 p-5 md:p-6 rounded-3xl text-center space-y-2 max-w-4xl mx-auto shadow-xl backdrop-blur-md"
                            >
                              {(streak >= 3 || doubleScoreActive) && (
                                <div className="flex items-center justify-center gap-2 mb-1">
                                  {streak >= 3 && (
                                    <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded-lg shadow-2xs animate-pulse">
                                      مكافأة الحماس! ⚡
                                    </span>
                                  )}
                                  {doubleScoreActive && (
                                    <span className="px-2.5 py-0.5 bg-indigo-500 text-white font-black text-[10px] rounded-lg shadow-2xs animate-bounce">
                                      النقاط مضاعفة 2x! ⚡
                                    </span>
                                  )}
                                </div>
                              )}
                              <h3 className="text-base sm:text-lg md:text-xl font-black text-white leading-relaxed">
                                {activeChallenge.questions[currentQuestionIdx]?.text}
                              </h3>
                            </motion.div>

                            {/* Interactive Large Option Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto pt-2">
                              {activeChallenge.questions[currentQuestionIdx]?.options.map((opt, i) => {
                                const isSelected = selectedAnswerIdx === i;
                                const isCorrect = checkIsCorrect(activeChallenge.questions[currentQuestionIdx], i);
                                const isDisabled = disabledOptionIndices.includes(i);

                                if (isDisabled) {
                                  return (
                                    <div 
                                      key={`disabled-opt-${i}`}
                                      className="opacity-0 pointer-events-none transition-all duration-300 h-28 md:h-32"
                                    />
                                  );
                                }

                                // Waygground 3D colors
                                const colorPresets = [
                                  // 0: Green/Olive
                                  { bg: "bg-gradient-to-b from-[#8ea604] to-[#7a9302] border-[#a2bd05]", shadow: "shadow-[0_8px_0_#5e6e02]" },
                                  // 1: Purple
                                  { bg: "bg-gradient-to-b from-[#9b5de5] to-[#833ab4] border-[#af7bf3]", shadow: "shadow-[0_8px_0_#5c2090]" },
                                  // 2: Orange
                                  { bg: "bg-gradient-to-b from-[#f77f00] to-[#e06d00] border-[#f99222]", shadow: "shadow-[0_8px_0_#9a5300]" },
                                  // 3: Pink/Blue
                                  { bg: "bg-gradient-to-b from-[#00bbf9] to-[#0096c7] border-[#33ccff]", shadow: "shadow-[0_8px_0_#00668a]" },
                                ];
                                const preset = colorPresets[i % colorPresets.length];

                                let statusClass = `${preset.bg} ${preset.shadow} border-2 hover:brightness-110 active:translate-y-1 active:shadow-[0_4px_0_#000]`;
                                
                                if (isAnswerRevealed) {
                                  if (isCorrect) {
                                    statusClass = "bg-emerald-600 border-emerald-400 border-2 shadow-[0_8px_0_#065f46] shadow-emerald-950/20 ring-4 ring-emerald-400/40";
                                  } else if (isSelected) {
                                    statusClass = "bg-rose-600 border-rose-400 border-2 shadow-[0_8px_0_#991b1b] opacity-90 scale-95 duration-200 shake-animation";
                                  } else {
                                    statusClass = "bg-slate-900 border-slate-800 border-2 shadow-none opacity-20 scale-95 duration-300 pointer-events-none";
                                  }
                                }

                                return (
                                  <motion.button
                                    key={`wayground-opt-${currentQuestionIdx}-${i}`}
                                    whileHover={isAnswerRevealed ? {} : { scale: 1.02 }}
                                    whileTap={isAnswerRevealed ? {} : { scale: 0.98 }}
                                    onClick={() => handleSelectAnswerWayground(i)}
                                    disabled={isAnswerRevealed}
                                    className={`h-28 md:h-32 rounded-3xl p-6 flex flex-col justify-center items-center text-center font-black text-white cursor-pointer select-none relative transition-all duration-200 ${statusClass}`}
                                  >
                                    {/* Text option with custom shadow */}
                                    <span className="text-base md:text-lg tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] leading-relaxed">
                                      {opt}
                                    </span>

                                    {/* Icon Overlay on Reveal */}
                                    {isAnswerRevealed && isCorrect && (
                                      <motion.div 
                                        initial={{ scale: 0 }} 
                                        animate={{ scale: 1 }} 
                                        className="absolute top-4 right-4 bg-emerald-100 text-emerald-800 rounded-full p-1 border border-emerald-300 shadow-md"
                                      >
                                        <Check className="w-5 h-5 stroke-[3]" />
                                      </motion.div>
                                    )}

                                    {isAnswerRevealed && isSelected && !isCorrect && (
                                      <motion.div 
                                        initial={{ scale: 0 }} 
                                        animate={{ scale: 1 }} 
                                        className="absolute top-4 right-4 bg-rose-100 text-rose-800 rounded-full p-1 border border-rose-300 shadow-md"
                                      >
                                        <X className="w-5 h-5 stroke-[3]" />
                                      </motion.div>
                                    )}
                                  </motion.button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Bottom Bar Container */}
                          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-indigo-100">
                            {/* Profile Info */}
                            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-indigo-100 shadow-2xs w-full md:w-auto">
                              <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center font-black text-sm text-white shadow-xs">
                                {activeStudent.name ? activeStudent.name[0] : "👤"}
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] text-indigo-600 font-extrabold tracking-widest uppercase block">بطل المعمل</span>
                                <span className="text-xs font-black text-slate-800">{activeStudent.name}</span>
                              </div>
                            </div>

                            {/* Interactive Lifelines Panel */}
                            <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-indigo-100 shadow-2xs">
                              <div className="text-xs font-bold text-slate-700 mr-1 pl-2 border-l border-slate-200">وسائل المساعدة:</div>
                              
                              {/* Lifeline 1: 50/50 */}
                              <button
                                type="button"
                                onClick={useFiftyFifty}
                                disabled={fiftyFiftyUsed || isAnswerRevealed}
                                title="حذف خيارين خاطئين"
                                className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-sans font-black text-[11px] border-2 transition-all cursor-pointer ${
                                  fiftyFiftyUsed 
                                    ? "bg-slate-900 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed" 
                                    : isAnswerRevealed 
                                      ? "bg-purple-900/30 border-purple-800 text-purple-500 opacity-60" 
                                      : "bg-gradient-to-b from-indigo-500 to-indigo-700 border-indigo-400 hover:brightness-110 active:scale-95 text-white shadow-lg"
                                }`}
                              >
                                <span className="text-[13px] font-sans">50</span>
                                <span className="text-[10px] font-sans -mt-1.5">50</span>
                              </button>

                              {/* Lifeline 2: Double points */}
                              <button
                                type="button"
                                onClick={useDoubleScore}
                                disabled={doubleScoreUsed || isAnswerRevealed}
                                title="مضاعفة نقاط الإجابة الصحيحة"
                                className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all cursor-pointer ${
                                  doubleScoreUsed 
                                    ? "bg-slate-900 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed" 
                                    : isAnswerRevealed 
                                      ? "bg-purple-900/30 border-purple-800 text-purple-500 opacity-60" 
                                      : "bg-gradient-to-b from-yellow-500 to-amber-600 border-yellow-400 hover:brightness-110 active:scale-95 text-slate-950 shadow-lg"
                                }`}
                              >
                                <Zap className="w-5 h-5 stroke-[2.5]" />
                              </button>

                              {/* Lifeline 3: Skip Question */}
                              <button
                                type="button"
                                onClick={useSkipQuestion}
                                disabled={skipUsed || isAnswerRevealed}
                                title="تخطي السؤال الحالي والانتقال دون خسارة"
                                className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all cursor-pointer ${
                                  skipUsed 
                                    ? "bg-slate-900 border-slate-800 text-slate-600 opacity-40 cursor-not-allowed" 
                                    : isAnswerRevealed 
                                      ? "bg-purple-900/30 border-purple-800 text-purple-500 opacity-60" 
                                      : "bg-gradient-to-b from-[#f15bb5] to-[#d6228f] border-[#ff7bc3] hover:brightness-110 active:scale-95 text-white shadow-lg"
                                }`}
                              >
                                <motion.div animate={!skipUsed && !isAnswerRevealed ? { rotate: [0, 5, -5, 0] } : {}} transition={{ repeat: Infinity, duration: 1.5 }}>
                                  <Star className="w-5 h-5 fill-current" />
                                </motion.div>
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* GAME TYPE 1: CLASSIC QUIZ SHOW */}
                  {activeChallenge.gameType === "quiz_game" && (
                    <div className="space-y-6 relative z-10">
                      {/* Question Card */}
                      <motion.div 
                        key={`quiz-q-${currentQuestionIdx}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-indigo-900/90 border border-indigo-400/30 p-5 rounded-2xl text-center shadow-md text-white backdrop-blur-md"
                      >
                        <h3 className="text-base sm:text-lg font-black leading-relaxed">
                          {activeChallenge.questions[currentQuestionIdx]?.text}
                        </h3>
                      </motion.div>

                      {/* Visual Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                          <span>السؤال {currentQuestionIdx + 1} من {activeChallenge.questions.length}</span>
                          <span className="font-sans">مؤقت: {timeLeft} ث</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-indigo-600 transition-all duration-300"
                            style={{ width: `${((currentQuestionIdx + 1) / activeChallenge.questions.length) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Answers Choice List */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeChallenge.questions[currentQuestionIdx]?.options.map((opt, i) => {
                          const isSelected = selectedAnswerIdx === i;
                          const isCorrect = checkIsCorrect(activeChallenge.questions[currentQuestionIdx], i);
                          
                          let bgClass = "bg-white hover:bg-indigo-50/70 border-indigo-100 text-slate-800 shadow-3xs";
                          if (isAnswerRevealed) {
                            if (isCorrect) {
                              bgClass = "bg-emerald-50 border-emerald-400 text-emerald-900 font-black shadow-xs";
                            } else if (isSelected) {
                              bgClass = "bg-rose-50 border-rose-400 text-rose-900 shadow-xs";
                            } else {
                              bgClass = "bg-slate-50/60 border-slate-200 text-slate-400 opacity-50";
                            }
                          }

                          return (
                            <motion.button
                              key={`classic-opt-${i}`}
                              whileHover={{ scale: isAnswerRevealed ? 1 : 1.02 }}
                              whileTap={{ scale: isAnswerRevealed ? 1 : 0.98 }}
                              onClick={() => handleSelectAnswerClassic(i)}
                              className={`p-4 rounded-xl border text-right font-bold text-xs cursor-pointer transition ${bgClass}`}
                              disabled={isAnswerRevealed}
                            >
                              {opt}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* GAME TYPE 2: TIME ATTACK */}
                  {activeChallenge.gameType === "time_attack" && (
                    <div className="space-y-6 relative z-10">
                      {/* Question Card */}
                      <motion.div 
                        key={`ta-q-${currentQuestionIdx}`}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-amber-950/90 border border-amber-500/30 p-5 rounded-2xl text-center shadow-md text-amber-100 backdrop-blur-md"
                      >
                        <h3 className="text-base sm:text-lg font-black leading-relaxed">
                          {activeChallenge.questions[currentQuestionIdx]?.text}
                        </h3>
                      </motion.div>

                      <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Timer className="w-5 h-5 text-amber-600 animate-pulse" />
                          <span className="text-xs font-black text-amber-800">سباق السرعة المجنون!</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">كل إجابة صحيحة +100 درجة. والخطأ يخصم -25.</span>
                      </div>

                      {/* Answers Choice List */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {activeChallenge.questions[currentQuestionIdx]?.options.map((opt, i) => (
                          <motion.button
                            key={`time-attack-opt-${i}`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSelectAnswerTimeAttack(i)}
                            className="p-4 rounded-xl border border-indigo-100 bg-white hover:bg-indigo-50/70 text-slate-800 text-right font-bold text-xs cursor-pointer shadow-3xs"
                          >
                            {opt}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* GAME TYPE 3: SPACE INVADERS */}
                  {activeChallenge.gameType === "space_invaders" && (
                    <div className="space-y-4 relative z-10">
                      {/* Visual Canvas Area - Expanded height for massive play field */}
                      <div 
                        onMouseMove={handleCanvasMouseMove}
                        onTouchMove={handleCanvasTouchMove}
                        className="w-full h-[480px] md:h-[520px] bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden flex flex-col justify-end cursor-crosshair select-none"
                      >
                        {/* Space backdrop stars */}
                        <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]" />

                        {/* Floating Question Card during Space Invaders gameplay */}
                        {!isQuestionIntro && (
                          <motion.div
                            key={`space-q-${currentQuestionIdx}`}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute top-3 inset-x-4 z-20 bg-slate-900/90 border border-indigo-500/40 p-3.5 sm:p-4 rounded-2xl text-center shadow-xl backdrop-blur-md"
                          >
                            <h3 className="text-sm sm:text-base font-black text-white leading-snug">
                              {activeChallenge.questions[currentQuestionIdx]?.text}
                            </h3>
                          </motion.div>
                        )}

                        {/* Beautiful Large Question Intro Overlay */}
                        {isQuestionIntro && (
                          <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center p-6 text-center">
                            <div className="space-y-6 max-w-lg flex flex-col items-center">
                              <span className={`px-3 py-1 bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 rounded-full text-xs font-black tracking-widest uppercase transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-75' : 'opacity-100 animate-pulse'}`}>
                                الاستعداد للمهمة القادمة 🚀
                              </span>
                              
                              <h2 
                                className={`text-2xl md:text-3xl lg:text-4xl font-black text-white leading-relaxed drop-shadow-[0_2px_15px_rgba(129,140,248,0.4)] transition-all duration-700 cubic-bezier(0.25, 1, 0.5, 1) transform ${
                                  isTransitioning 
                                    ? '-translate-y-[220px] scale-50 opacity-0 pointer-events-none' 
                                    : 'translate-y-0 scale-100 opacity-100'
                                }`}
                              >
                                {activeChallenge.questions[currentQuestionIdx]?.text}
                              </h2>

                              <div className={`flex flex-col items-center gap-2 pt-4 transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-75' : 'opacity-100'}`}>
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase">انطلاق الخيارات خلال</span>
                                <div className="w-14 h-14 rounded-full bg-indigo-600/20 border-2 border-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-950/50">
                                  <span className="text-2xl font-sans font-black text-yellow-400 animate-bounce">
                                    {introCountdown}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Falling Meteors */}
                        {!isQuestionIntro && fallingMeteors.map(m => (
                          <motion.div
                            key={m.id}
                            style={{ left: `${m.x}%`, top: `${m.y}%` }}
                            className="absolute transform -translate-x-1/2 p-2.5 rounded-xl bg-slate-900/90 border border-indigo-500/30 text-center select-none cursor-pointer max-w-[150px] shadow-lg shadow-indigo-950"
                            onClick={() => handleShootMeteor(m)}
                          >
                            <div className="flex flex-col items-center gap-1.5">
                              <span className="w-3.5 h-3.5 bg-indigo-500 rounded-full animate-ping" />
                              <span className="text-[11px] text-white font-extrabold line-clamp-2 leading-tight">
                                {m.answer}
                              </span>
                            </div>
                          </motion.div>
                        ))}

                        {/* Particle explosion effects */}
                        {particles.map(p => (
                          <div
                            key={p.id}
                            style={{ left: `${p.x}%`, top: `${p.y}%`, backgroundColor: p.color }}
                            className="absolute w-2 h-2 rounded-full animate-ping"
                          />
                        ))}

                        {/* Laser Beam effect */}
                        {laserEffect?.active && (
                          <div
                            style={{ left: `${laserEffect.targetX}%` }}
                            className="absolute top-0 bottom-12 w-1.5 bg-gradient-to-t from-yellow-400 via-amber-300 to-transparent transform -translate-x-1/2 animate-pulse"
                          />
                        )}

                        {/* Spaceship at the bottom - animated to shipX */}
                        <div className="w-full h-14 bg-slate-950/90 border-t border-slate-800 relative z-20 overflow-visible">
                          <motion.div
                            animate={{ left: `${shipX}%` }}
                            transition={{ type: "spring", stiffness: 350, damping: 25 }}
                            className="absolute bottom-2.5 w-14 h-11 flex flex-col items-center justify-end -translate-x-1/2 select-none pointer-events-none"
                          >
                            {/* Dual Laser Blaster Barrels (with cyan pulsing energy) */}
                            <div className="absolute top-0 left-2.5 w-1 h-3.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_#22d3ee]" />
                            <div className="absolute top-0 right-2.5 w-1 h-3.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_#22d3ee]" />

                            {/* Spaceship Body Container */}
                            <div className="relative w-12 h-8 flex flex-col items-center">
                              {/* Cockpit Canopy */}
                              <div className="absolute top-0.5 w-3.5 h-4 bg-gradient-to-b from-cyan-300 via-cyan-400 to-indigo-650 rounded-t-full border border-cyan-100 shadow-[0_0_12px_rgba(34,211,238,0.9)] z-20" />
                              
                              {/* Nose Cone / Main Fuselage */}
                              <div className="absolute top-1.5 w-5 h-6 bg-gradient-to-b from-slate-100 via-slate-400 to-slate-800 rounded-t-full border border-slate-600/50 shadow-lg z-10" />

                              {/* Left Wing (Swept wing with wingtip gun mount) */}
                              <div 
                                className="absolute bottom-0 left-0 w-5 h-4.5 bg-gradient-to-tr from-slate-800 via-indigo-950 to-indigo-600 rounded-bl-3xl border-l border-b border-indigo-400/40"
                                style={{ transform: "skewY(-12deg)" }}
                              />

                              {/* Right Wing (Swept wing with wingtip gun mount) */}
                              <div 
                                className="absolute bottom-0 right-0 w-5 h-4.5 bg-gradient-to-tl from-slate-800 via-indigo-950 to-indigo-600 rounded-br-3xl border-r border-b border-indigo-400/40"
                                style={{ transform: "skewY(12deg)" }}
                              />

                              {/* Jet Engine Thruster Nozzle Left */}
                              <div className="absolute -bottom-1.5 left-3.5 w-1.5 h-2 bg-slate-800 rounded-b border-x border-slate-700" />
                              {/* Jet Engine Thruster Nozzle Right */}
                              <div className="absolute -bottom-1.5 right-3.5 w-1.5 h-2 bg-slate-800 rounded-b border-x border-slate-700" />

                              {/* Dual Ion Engine Fire Trails (bouncing glowing blue/yellow thrust) */}
                              <div className="absolute -bottom-4.5 left-[15.5px] w-1.5 h-4 bg-gradient-to-b from-cyan-400 via-indigo-500 to-transparent rounded-full animate-bounce" />
                              <div className="absolute -bottom-4.5 right-[15.5px] w-1.5 h-4 bg-gradient-to-b from-cyan-400 via-indigo-500 to-transparent rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                            </div>
                          </motion.div>
                        </div>
                      </div>

                      {/* Mobile / Direct Touch Controls and Instructions */}
                      <div className="space-y-3">
                        <p className="text-[11px] text-center text-slate-400 font-bold leading-relaxed">
                          💡 <span className="text-indigo-400">طريقة اللعب:</span> حرك الماوس أو اسحب إصبعك على الشاشة لتحريك المركبة، أو اضغط على الإجابة مباشرة لضربها بمدفع الليزر! يمكنك استخدام <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-sans text-[10px]">الأسهم ◀ ▶</kbd> و <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-white font-sans text-[10px]">المسافة ⌴</kbd> بالكيبورد.
                        </p>

                        <div className="grid grid-cols-3 gap-2 bg-slate-900/40 p-2.5 rounded-2xl border border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => setShipX(prev => Math.max(5, prev - 12))}
                            className="py-3 bg-slate-850 hover:bg-slate-800 active:scale-95 text-slate-200 rounded-xl text-xs font-black transition cursor-pointer select-none flex items-center justify-center gap-1 border border-slate-800"
                          >
                            <span>◀ يسار</span>
                          </button>
                          
                          <button
                            type="button"
                            onClick={() => {
                              if (fallingMeteors.length > 0) {
                                let closestMeteor = fallingMeteors[0];
                                let minDiff = Math.abs(fallingMeteors[0].x - shipX);
                                for (let i = 1; i < fallingMeteors.length; i++) {
                                  const diff = Math.abs(fallingMeteors[i].x - shipX);
                                  if (diff < minDiff) {
                                    minDiff = diff;
                                    closestMeteor = fallingMeteors[i];
                                  }
                                }
                                handleShootMeteor(closestMeteor);
                              }
                            }}
                            className="py-3 bg-red-650 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-extrabold transition cursor-pointer select-none shadow-lg shadow-red-950/40 border border-red-800/40 animate-pulse"
                          >
                            🔥 إطلاق!
                          </button>

                          <button
                            type="button"
                            onClick={() => setShipX(prev => Math.min(95, prev + 12))}
                            className="py-3 bg-slate-850 hover:bg-slate-800 active:scale-95 text-slate-200 rounded-xl text-xs font-black transition cursor-pointer select-none flex items-center justify-center gap-1 border border-slate-800"
                          >
                            <span>يمين ▶</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* GAME TYPE 4: CAR RACING */}
                  {activeChallenge.gameType === "car_racing" && (
                    <div className="space-y-4 relative z-10" dir="rtl">
                      {/* Visual Highway Area */}
                      <div 
                        onMouseMove={handleCanvasMouseMove}
                        onTouchMove={handleCanvasTouchMove}
                        className="w-full h-[480px] md:h-[520px] bg-slate-900 rounded-2xl border border-slate-800 relative overflow-hidden flex flex-col justify-end cursor-pointer select-none"
                        style={{
                          backgroundImage: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.8))"
                        }}
                      >
                        {/* Highway Margins */}
                        <div className="absolute left-0 top-0 bottom-0 w-4 bg-emerald-800 border-r-2 border-yellow-500 z-10" />
                        <div className="absolute right-0 top-0 bottom-0 w-4 bg-emerald-800 border-l-2 border-yellow-500 z-10" />

                        {/* Highlighted Question Card Overlay on Highway while driving */}
                        {!isQuestionIntro && (
                          <motion.div
                            key={`car-q-${currentQuestionIdx}`}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute top-3 inset-x-4 z-20 bg-slate-950/90 border border-cyan-500/50 p-3.5 sm:p-4 rounded-2xl text-center shadow-2xl backdrop-blur-md ring-1 ring-cyan-400/30"
                          >
                            <h3 className="text-sm sm:text-base md:text-lg font-black text-white leading-snug drop-shadow-md">
                              {activeChallenge.questions[currentQuestionIdx]?.text}
                            </h3>
                          </motion.div>
                        )}

                        {/* Beautiful Large Question Intro Overlay */}
                        {isQuestionIntro && (
                          <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center p-6 text-center">
                            <div className="space-y-6 max-w-lg flex flex-col items-center">
                              <span className={`px-3 py-1 bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 rounded-full text-xs font-black tracking-widest uppercase transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-75' : 'opacity-100 animate-pulse'}`}>
                                الاستعداد للسباق والوصول للجواب 🏎️💨
                              </span>
                              
                              <h2 
                                className={`text-2xl md:text-3xl lg:text-4xl font-black text-white leading-relaxed drop-shadow-[0_2px_15px_rgba(129,140,248,0.4)] transition-all duration-700 cubic-bezier(0.25, 1, 0.5, 1) transform ${
                                  isTransitioning 
                                    ? '-translate-y-[220px] scale-50 opacity-0 pointer-events-none' 
                                    : 'translate-y-0 scale-100 opacity-100'
                                }`}
                              >
                                {activeChallenge.questions[currentQuestionIdx]?.text}
                              </h2>

                              <div className={`flex flex-col items-center gap-2 pt-4 transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-75' : 'opacity-100'}`}>
                                <span className="text-[10px] text-slate-400 font-extrabold uppercase">انطلاق الخيارات خلال</span>
                                <div className="w-14 h-14 rounded-full bg-indigo-600/20 border-2 border-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-950/50">
                                  <span className="text-2xl font-sans font-black text-yellow-400 animate-bounce">
                                    {introCountdown}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Dynamic White Lane Lines dividing options */}
                        {(() => {
                          const count = activeChallenge.questions[currentQuestionIdx]?.options.length || 3;
                          return Array.from({ length: count - 1 }).map((_, i) => {
                            const leftPos = ((i + 1) * 100) / count;
                            return (
                              <div
                                key={`highway-lane-${i}`}
                                style={{ left: `${leftPos}%` }}
                                className={`absolute top-0 bottom-0 w-[2px] pointer-events-none z-0 ${
                                  isBoostingState ? "lane-line-fast" : "lane-line"
                                }`}
                              />
                            );
                          });
                        })()}

                        {/* Rolling Asphalt Effect lines */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                          <div className={`w-full h-1 bg-white/5 absolute ${isBoostingState ? "animate-[moveDown_0.5s_linear_infinite]" : "animate-[moveDown_2s_linear_infinite]"}`} style={{ animationDelay: "0s" }} />
                          <div className={`w-full h-1 bg-white/5 absolute ${isBoostingState ? "animate-[moveDown_0.5s_linear_infinite]" : "animate-[moveDown_2s_linear_infinite]"}`} style={{ animationDelay: "0.5s" }} />
                          <div className={`w-full h-1 bg-white/5 absolute ${isBoostingState ? "animate-[moveDown_0.5s_linear_infinite]" : "animate-[moveDown_2s_linear_infinite]"}`} style={{ animationDelay: "1s" }} />
                          <div className={`w-full h-1 bg-white/5 absolute ${isBoostingState ? "animate-[moveDown_0.5s_linear_infinite]" : "animate-[moveDown_2s_linear_infinite]"}`} style={{ animationDelay: "1.5s" }} />
                        </div>

                        {/* Falling Answers / Vehicles on Highway */}
                        {!isQuestionIntro && fallingMeteors.map(m => {
                          const isCorrect = m.isCorrect !== undefined ? m.isCorrect : checkIsCorrect(activeChallenge.questions[currentQuestionIdx], m.idx);
                          
                          // options look entirely identical until hit!
                          let cardClasses = "";
                          let cardContent = null;
                          
                          if (!isAnswerRevealed) {
                            cardClasses = "bg-slate-900/95 border-2 border-cyan-400 text-cyan-100 shadow-cyan-950/40";
                            cardContent = (
                              <div className="flex flex-col items-center gap-1.5 py-1">
                                <span className="text-base animate-pulse">🏁</span>
                                <span className="text-[11px] font-black line-clamp-2 leading-tight select-none">{m.answer}</span>
                              </div>
                            );
                          } else {
                            if (isCorrect) {
                              cardClasses = "bg-emerald-950/95 border-2 border-emerald-400 text-emerald-200 shadow-emerald-900/50 scale-105";
                              cardContent = (
                                <div className="flex flex-col items-center gap-1 py-1">
                                  <span className="text-base animate-bounce">✅</span>
                                  <span className="text-[11px] font-black line-clamp-2 leading-tight">{m.answer}</span>
                                  <span className="text-[8px] bg-emerald-500 text-slate-950 px-1 rounded font-extrabold">الإجابة الصحيحة</span>
                                </div>
                              );
                            } else {
                              cardClasses = "bg-rose-950/80 border-2 border-rose-500 text-rose-300 opacity-60";
                              cardContent = (
                                <div className="flex flex-col items-center gap-1 py-1">
                                  <span className="text-base">❌</span>
                                  <span className="text-[11px] font-black line-clamp-2 leading-tight">{m.answer}</span>
                                  <span className="text-[8px] bg-rose-600 text-white px-1 rounded font-bold">خيار خاطئ</span>
                                </div>
                              );
                            }
                          }

                          return (
                            <motion.div
                              key={m.id}
                              style={{ left: `${m.x}%`, top: `${m.y}%` }}
                              className="absolute transform -translate-x-1/2 p-2 rounded-2xl text-center select-none w-[140px] max-w-[155px] shadow-lg transition-transform hover:scale-105 z-10"
                            >
                              <div className={`rounded-xl p-2.5 shadow-md ${cardClasses}`}>
                                {cardContent}
                              </div>
                            </motion.div>
                          );
                        })}

                        {/* Particle sparks effects from crash or acceleration */}
                        {particles.map(p => (
                          <div
                            key={p.id}
                            style={{ left: `${p.x}%`, top: `${p.y}%`, backgroundColor: p.color }}
                            className="absolute w-2.5 h-2.5 rounded-full animate-ping z-20"
                          />
                        ))}

                        {/* Player Drift Sports Car at the bottom */}
                        <div className="w-full h-24 bg-slate-950/30 border-t border-white/5 relative z-20 overflow-hidden">
                          <motion.div
                            animate={{ 
                              left: `${shipX}%`,
                              rotate: carAngle
                            }}
                            transition={{ type: "spring", stiffness: 220, damping: 24 }}
                            className="absolute bottom-3 w-16 h-16 flex flex-col items-center -translate-x-1/2"
                          >
                            {/* Neon Drift Underglow */}
                            <div className="absolute inset-x-2 bottom-1 top-2 bg-cyan-400/30 blur-md rounded-full animate-pulse" />

                            {/* Exhaust Fire / Booster flames */}
                            {isBoostingState ? (
                              <div className="absolute -bottom-4 flex gap-1.5">
                                <div className="w-2.5 h-6 bg-gradient-to-t from-red-500 via-orange-400 to-yellow-300 rounded-b-full animate-bounce" />
                                <div className="w-2.5 h-6 bg-gradient-to-t from-red-500 via-orange-400 to-yellow-300 rounded-b-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                              </div>
                            ) : (
                              <div className="absolute -bottom-2 flex gap-2">
                                <div className="w-1.5 h-3 bg-orange-500/80 rounded-b-full animate-pulse" />
                                <div className="w-1.5 h-3 bg-orange-500/80 rounded-b-full animate-pulse" style={{ animationDelay: "0.1s" }} />
                              </div>
                            )}

                            {/* Drifting tire tracks / smoke sparks */}
                            {Math.abs(carAngle) > 6 && (
                              <>
                                <div className="absolute -left-3 bottom-1 text-xs opacity-80 animate-ping">💨</div>
                                <div className="absolute -right-3 bottom-1 text-xs opacity-80 animate-ping" style={{ animationDelay: "0.1s" }}>💨</div>
                              </>
                            )}

                            {/* Sleek sports car structure */}
                            <div className="w-11 h-14 relative flex flex-col justify-between">
                              {/* Rear Spoiler */}
                              <div className="w-14 h-2.5 bg-slate-900 border border-slate-700 rounded absolute -top-1 -left-1.5 shadow-md flex items-center justify-between px-1">
                                <div className="w-1 h-2.5 bg-red-500" />
                                <div className="w-1 h-2.5 bg-red-500" />
                              </div>

                              {/* Rear Tires */}
                              <div className="absolute -left-2.5 bottom-1 w-2.5 h-4.5 bg-neutral-900 border border-neutral-700 rounded" />
                              <div className="absolute -right-2.5 bottom-1 w-2.5 h-4.5 bg-neutral-900 border border-neutral-700 rounded" />

                              {/* Front Tires */}
                              <div className="absolute -left-2 top-2.5 w-2 h-3.5 bg-neutral-900 border border-neutral-700 rounded" />
                              <div className="absolute -right-2 top-2.5 w-2 h-3.5 bg-neutral-900 border border-neutral-700 rounded" />

                              {/* Car Body */}
                              <div className="w-9 h-12 bg-red-600 rounded-xl mx-auto border-2 border-red-400 shadow-lg relative flex flex-col items-center justify-between py-1">
                                <div className="absolute top-0 bottom-0 w-1.5 bg-yellow-400 left-1/2 -translate-x-1/2 opacity-90" />
                                
                                {/* Windshield */}
                                <div className="w-5 h-4 bg-slate-950/90 rounded-b-md border border-slate-600 relative z-10 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                                </div>

                                {/* Headlights */}
                                <div className="w-full flex justify-between px-1.5 relative z-10 mt-1">
                                  <div className="w-2 h-1 bg-yellow-300 rounded shadow-yellow-400/80 animate-pulse" />
                                  <div className="w-2 h-1 bg-yellow-300 rounded shadow-yellow-400/80 animate-pulse" />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </div>
                      </div>

                      {/* Instructions and Steering buttons for mobile/tablet */}
                      <div className="space-y-3">
                        <p className="text-[11px] text-center text-slate-400 font-bold leading-relaxed">
                          💡 <span className="text-indigo-400">طريقة اللعب:</span> وجه سيارتك واصطدم بالمسار الذي يحتوي على الإجابة الصحيحة للتقدم! يمكنك **الضغط مع الاستمرار على زر المسافة (Space) لزيادة سرعة الطريق والخيارات بشكل خارق 🚀**
                        </p>

                        <div className="grid grid-cols-2 gap-3 bg-slate-900/40 p-2.5 rounded-2xl border border-slate-800/80">
                          <button
                            type="button"
                            onClick={() => setShipX(prev => Math.max(5, prev - 12))}
                            className="py-3.5 bg-slate-850 hover:bg-slate-800 active:scale-95 text-slate-200 rounded-xl text-xs font-black transition cursor-pointer select-none flex items-center justify-center gap-2 border border-slate-800"
                          >
                            <span>🏎️ انعطف يساراً ◀</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShipX(prev => Math.min(95, prev + 12))}
                            className="py-3.5 bg-slate-850 hover:bg-slate-800 active:scale-95 text-slate-200 rounded-xl text-xs font-black transition cursor-pointer select-none flex items-center justify-center gap-2 border border-slate-800"
                          >
                            <span>▶ انعطف يميناً 🏎️</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                // GAME FINISHED / RESULTS SCREEN (Kept inside the same dark space-arena container!)
                <div className="py-6 space-y-8 relative z-10 max-w-2xl mx-auto text-center">
                  <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto border border-yellow-500/30 animate-bounce">
                    <Trophy className="w-10 h-10 text-yellow-400" />
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-black tracking-widest text-indigo-400 uppercase">اكتمل التحدي بنجاح 🏆</span>
                    <h4 className="text-2xl font-black text-white">بيضت الوجه يا بطل المراجعة! 🎖️</h4>
                    <p className="text-sm text-slate-300 font-bold">{activeChallenge.title}</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 grid grid-cols-2 gap-4 text-right">
                    <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5">
                      <span className="text-[11px] text-slate-400 block font-bold">النقاط الإجمالية:</span>
                      <span className="text-2xl font-black text-yellow-400 block font-sans">{score} ن</span>
                    </div>
                    <div className="bg-slate-950/50 p-4 rounded-xl border border-white/5">
                      <span className="text-[11px] text-slate-400 block font-bold">الإجابات الصحيحة:</span>
                      <span className="text-2xl font-black text-emerald-400 block font-sans">{correctCount} / {activeChallenge.questions.length}</span>
                    </div>
                    <div className="col-span-2 bg-slate-950/50 p-3 rounded-xl border border-white/5 text-center">
                      <span className="text-[10px] text-slate-400 block font-bold">إجمالي زمن التحدي:</span>
                      <span className="text-sm font-black text-slate-200 block font-sans">{timeSpent} ثانية</span>
                    </div>
                  </div>

                  {/* Integrated Next Challenge Element / Navigation right here */}
                  <div className="pt-4 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => handleStartGame(activeChallenge)}
                      className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-black transition cursor-pointer border border-slate-700"
                    >
                      إعادة اللعب والتحدي 🔄
                    </button>

                    {(() => {
                      const myChallenges = getMyChallenges();
                      const curIdx = myChallenges.findIndex(c => c.id === activeChallenge.id);
                      const nextCh = curIdx !== -1 && curIdx + 1 < myChallenges.length ? myChallenges[curIdx + 1] : null;

                      if (nextCh) {
                        return (
                          <button
                            onClick={() => handleStartGame(nextCh)}
                            className="flex-1 py-3.5 bg-gradient-to-r from-indigo-500 to-purple-650 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-indigo-950"
                          >
                            <span>التحدي التالي: {nextCh.title} ➡️</span>
                          </button>
                        );
                      } else {
                        return (
                          <div className="flex-1 py-3 px-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-black flex items-center justify-center">
                            🎉 أبدعت! أنجزت كافة التحديات التنافسية بالمعمل!
                          </div>
                        );
                      }
                    })()}

                    <button
                      onClick={handleExitGame}
                      className="px-6 py-3.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      خروج لصالة التحديات
                    </button>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Always visible Class Leaderboard - placed beside the game room on the left in RTL! */}
            <div className="lg:col-span-1 lg:sticky lg:top-[150px] z-30 self-start p-5 space-y-4 w-full max-h-[calc(100vh-10rem)] overflow-y-auto bg-slate-50/40">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Trophy className="w-5.5 h-5.5 text-amber-500 animate-pulse" />
                <h4 className="font-black text-sm text-slate-800">المتنافسون في هذه اللعبة ⚡</h4>
              </div>

              <div className="space-y-3">
                <p className="text-[11px] text-indigo-700 leading-relaxed font-bold">
                  🟢 الطلاب النشطون حالياً في هذا التحدي من نفس فصلك ({activeStudent.gradeClass}):
                </p>
                
                <div className="grid grid-cols-1 gap-2 font-sans max-h-[500px] overflow-y-auto pr-1">
                  {(() => {
                    const sortedActiveGamePlayers = liveActivePlayers
                      .filter(player => 
                        player.challengeId === activeChallenge.id && 
                        normalizeArabicText(player.gradeClass) === normalizeArabicText(activeStudent.gradeClass)
                      )
                      .sort((a, b) => (b.score || 0) - (a.score || 0));

                    return (
                      <>
                        {sortedActiveGamePlayers.map((player, idx) => {
                          const isMe = player.studentId === activeStudent.id;
                          return (
                            <motion.div
                              key={player.id || player.studentId}
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className={`p-3 rounded-xl border flex items-center justify-between gap-2 font-sans transition-all duration-300 ${
                                isMe
                                  ? "bg-amber-50/90 border-amber-300 text-amber-900 shadow-2xs font-bold"
                                  : "bg-slate-50/80 border-slate-200 text-slate-700 hover:bg-slate-100/60"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] ${
                                  idx === 0 ? "bg-amber-400 text-slate-950" : idx === 1 ? "bg-slate-300 text-slate-800" : idx === 2 ? "bg-amber-600 text-white" : "bg-slate-200 text-slate-600"
                                }`}>
                                  {idx + 1}
                                </span>
                                <div className="flex flex-col text-right">
                                  <span className="font-extrabold text-xs block text-slate-800">
                                    {player.studentName} {isMe && <span className="text-[10px] text-amber-600 font-bold mr-1">(أنت)</span>}
                                  </span>
                                  <span className="text-[9px] text-slate-500 block font-normal">
                                    فصل: {player.gradeClass}
                                  </span>
                                </div>
                              </div>
                              <span className="font-black text-xs text-indigo-700">{player.score || 0} ن</span>
                            </motion.div>
                          );
                        })}

                        {sortedActiveGamePlayers.length === 0 && (
                          <p className="col-span-full text-center text-xs text-slate-500 font-bold py-8">
                            لا يوجد لاعبون آخرون نشطون حالياً من نفس فصلك. أبدع وسجل أعلى النقاط! ✨
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </AnimatePresence>

      {/* Game Independent Leaderboard & Live Results Modal */}
      <AnimatePresence>
        {selectedLeaderboardChallengeId && (() => {
          const targetChallenge = reviewChallenges.find(c => c.id === selectedLeaderboardChallengeId) ||
            reviewChallenges.find(c => c.gameType === selectedLeaderboardChallengeId);
          const fixedGameMeta = FIXED_GAMES.find(fg => fg.id === selectedLeaderboardChallengeId || fg.gameType === targetChallenge?.gameType) || FIXED_GAMES[0];
          
          const gameDocId = targetChallenge?.id || selectedLeaderboardChallengeId;
          const gameScores = reviewScores.filter(s => s.challengeId === gameDocId || s.challengeId === selectedLeaderboardChallengeId);
          const studentMap: { [studentId: string]: ReviewScore } = {};
          gameScores.forEach(s => {
            if (!studentMap[s.studentId] || (s.score || 0) > (studentMap[s.studentId].score || 0)) {
              studentMap[s.studentId] = s;
            }
          });
          const leaderboardList = Object.values(studentMap).sort((a, b) => (b.score || 0) - (a.score || 0));
          const myScore = leaderboardList.find(s => s.studentId === activeStudent?.id);

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
              dir="rtl"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                className="w-full max-w-5xl bg-slate-100/95 rounded-3xl border border-slate-200 shadow-2xl overflow-hidden p-4 sm:p-6 flex flex-col gap-4 max-h-[92vh]"
              >
                {/* Modal Top Bar Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/90">
                  <div className="flex items-center gap-2.5">
                    <span className="p-2 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-300/40 shadow-xs">
                      <Trophy className="w-5 h-5 text-amber-500 fill-amber-500" />
                    </span>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900">
                        لوحة نتائج وتحدي لعبة: {targetChallenge?.title || fixedGameMeta.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-bold">
                        {targetChallenge?.subject || "مراجعة شاملة"} • {targetChallenge?.questions?.length || 0} أسئلة
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedLeaderboardChallengeId(null)}
                    className="p-2 rounded-2xl bg-slate-200/80 hover:bg-rose-50 hover:text-rose-600 text-slate-700 font-black text-xs transition cursor-pointer border border-slate-300/80"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Grid Container split into 2 cards like user image */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 overflow-y-auto">
                  {/* Left Column: Live Leaderboard Panel (2/3 width) */}
                  <div className="lg:col-span-7 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-150">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-xl bg-purple-50 text-purple-700 border border-purple-200/60">
                          <Award className="w-4 h-4 text-purple-600" />
                        </span>
                        <h4 className="text-sm font-black text-slate-900">
                          قائمة الصدارة الحية ({leaderboardList.length})
                        </h4>
                      </div>

                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-purple-50 text-purple-700 border border-purple-200/80">
                        <span>تحديث فوري نشط</span>
                        <Zap className="w-3.5 h-3.5 text-purple-600 fill-purple-600 animate-pulse" />
                      </div>
                    </div>

                    {/* Leaderboard Entries List */}
                    <div className="flex-1 min-h-[250px] max-h-[420px] overflow-y-auto space-y-2 pr-1">
                      {leaderboardList.length === 0 ? (
                        <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center py-12 space-y-3 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-xs sm:text-sm font-black text-slate-400 leading-relaxed max-w-md">
                            المنافسة جارية حالياً! لم يقم أي بطل بإنهاء التحدي بعد.
                          </p>
                          <p className="text-xs font-black text-purple-600">
                            بمجرد إنهاء الإجابة، ستتألق أسماؤهم على اللوحة! ✨
                          </p>
                        </div>
                      ) : (
                        leaderboardList.map((scoreItem, idx) => {
                          const isMe = scoreItem.studentId === activeStudent?.id;
                          return (
                            <div
                              key={scoreItem.id || idx}
                              className={`p-3 rounded-2xl text-xs flex items-center justify-between gap-3 border font-sans transition ${
                                isMe
                                  ? "bg-amber-100/90 border-amber-400 text-slate-950 font-black ring-2 ring-amber-300 shadow-xs"
                                  : idx === 0
                                  ? "bg-amber-50/80 border-amber-300 text-slate-950 font-black shadow-xs"
                                  : idx === 1
                                  ? "bg-slate-100/80 border-slate-300 text-slate-900 font-bold"
                                  : idx === 2
                                  ? "bg-amber-900/10 border-amber-700/30 text-slate-900 font-bold"
                                  : "bg-slate-50/90 border-slate-200/90 text-slate-800"
                              }`}
                            >
                              <div className="flex items-center gap-3 truncate">
                                <span
                                  className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                                    idx === 0
                                      ? "bg-amber-400 text-slate-950 shadow-xs"
                                      : idx === 1
                                      ? "bg-slate-300 text-slate-950"
                                      : idx === 2
                                      ? "bg-amber-700 text-white"
                                      : "bg-slate-200 text-slate-600"
                                  }`}
                                >
                                  {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                                </span>
                                <div className="truncate text-right">
                                  <span className="truncate font-black text-xs block text-slate-900">
                                    {scoreItem.studentName} {isMe && <span className="text-amber-700 font-bold mr-1">(أنت)</span>}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-bold font-sans">
                                    {scoreItem.gradeClass || "عام"} • أجاب {scoreItem.correctCount}/{scoreItem.totalCount} صحيح ({scoreItem.timeSpentSeconds || 0}ث)
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 font-extrabold text-xs">
                                <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200 font-sans shadow-2xs">
                                  {scoreItem.score} ن
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Column: Dark Control Card (1/3 width) matching user screenshot */}
                  <div className="lg:col-span-5 bg-gradient-to-b from-[#1c0f0d] via-[#281510] to-[#140a08] text-white rounded-3xl p-6 border border-amber-500/20 shadow-2xl flex flex-col items-center justify-between text-center space-y-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="space-y-4 w-full flex flex-col items-center pt-2">
                      {/* Yellow circular lightning badge */}
                      <div className="w-16 h-16 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 p-0.5 shadow-xl shadow-amber-500/20 flex items-center justify-center">
                        <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-amber-400">
                          <Zap className="w-8 h-8 text-amber-400 fill-amber-400 animate-pulse" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-xl font-black text-amber-400 flex items-center justify-center gap-2">
                          <span>التحدي مستمر حالياً</span>
                          <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                        </h3>
                        <p className="text-xs text-slate-300 font-bold leading-relaxed px-2">
                          الطلاب يجاوبون على الأسئلة الحماسية الآن في صالة المعمل! تظهر نتائجهم فاعلة ومحدثة في قائمة الصدارة على اليسار.
                        </p>
                      </div>
                    </div>

                    {/* Action controls for student */}
                    <div className="space-y-2.5 w-full pt-2">
                      {targetChallenge && targetChallenge.questions && targetChallenge.questions.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLeaderboardChallengeId(null);
                            handleStartGame(targetChallenge);
                          }}
                          className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 hover:scale-[1.01] active:scale-95"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          <span>{myScore ? "إعادة اللعب وتحسين النتيجة 🔄" : "ابدأ التحدي الآن 🚀"}</span>
                        </button>
                      ) : (
                        <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-bold">
                          يرجى انتظار المعلم لتجهيز وتفعيل أسئلة اللعبة ⏳
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedLeaderboardChallengeId(null)}
                        className="w-full py-3 px-4 bg-slate-800/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 rounded-2xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                      >
                        <X className="w-4 h-4" />
                        <span>إغلاق النافذة</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
