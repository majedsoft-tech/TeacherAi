import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Gamepad2, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Trophy, 
  Play, 
  Square, 
  Check, 
  Import, 
  Users, 
  BookOpen, 
  Clock, 
  ArrowRight, 
  ChevronLeft, 
  Award, 
  Timer, 
  Zap, 
  Star,
  Tv,
  Search,
  Database,
  Car,
  UserMinus,
  Sparkles,
  Wand2,
  Loader2,
  ExternalLink,
  X,
  RotateCcw,
  UserX
} from "lucide-react";
import { Quiz, Question, ReviewChallenge, ReviewScore, BankQuestion } from "../types";
import { isTrueFalseQuestion, normalizeQuestion } from "../utils/questionUtils";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { addDoc, collection, doc, updateDoc, deleteDoc, writeBatch, getDocs, query, where, onSnapshot, deleteField, setDoc } from "firebase/firestore";
import { UnitLessonMultiSelect } from "./UnitLessonMultiSelect";

class AdminSoundSynth {
  private ctx: AudioContext | null = null;
  enabled = true;

  private init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      this.ctx = new AudioCtx();
    }
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

  private bgInterval: any = null;
  private bgBpm = 120;

  startBackgroundMusic() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    if (this.bgInterval) return;

    let step = 0;
    const intervalTime = 60 / this.bgBpm / 2; // Eighth notes
    
    this.bgInterval = setInterval(() => {
      if (!this.ctx || this.ctx.state === "suspended") return;
      const now = this.ctx.currentTime;
      
      const notes = [55.00, 65.41, 73.42, 82.41]; // A1, C2, D2, E2 frequencies
      const freq = notes[step % notes.length];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(120, now);
      
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.23);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.24);

      if (step % 4 === 0) {
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        leadOsc.type = "triangle";
        const leadNotes = [220.00, 261.63, 293.66, 329.63]; // A3, C4, D4, E4
        const leadFreq = leadNotes[(step / 4) % leadNotes.length];
        leadOsc.frequency.setValueAtTime(leadFreq, now);
        
        leadGain.gain.setValueAtTime(0.02, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        
        leadOsc.connect(leadGain);
        leadGain.connect(this.ctx.destination);
        
        leadOsc.start(now);
        leadOsc.stop(now + 0.45);
      }

      if (step % 2 === 1) {
        const hatOsc = this.ctx.createOscillator();
        const hatGain = this.ctx.createGain();
        hatOsc.type = "triangle";
        hatOsc.frequency.setValueAtTime(8000, now);
        
        hatGain.gain.setValueAtTime(0.012, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        
        hatOsc.connect(hatGain);
        hatGain.connect(this.ctx.destination);
        
        hatOsc.start(now);
        hatOsc.stop(now + 0.06);
      }
      
      step++;
    }, intervalTime * 1000);
  }

  stopBackgroundMusic() {
    if (this.bgInterval) {
      clearInterval(this.bgInterval);
      this.bgInterval = null;
    }
  }
}
const adminSfx = new AdminSoundSynth();

// Presets matching the QuestionBankTab
const STAGE_PRESETS = ['المرحلة الابتدائية', 'المرحلة المتوسطة', 'المرحلة الثانوية'];

const GRADE_PRESETS: Record<string, string[]> = {
  'المرحلة الابتدائية': [
    'الصف الأول الابتدائي',
    'الصف الثاني الابتدائي',
    'الصف الثالث الابتدائي',
    'الصف الرابع الابتدائي',
    'الصف الخامس الابتدائي',
    'الصف السادس الابتدائي'
  ],
  'المرحلة المتوسطة': [
    'الصف الأول المتوسط',
    'الصف الثاني المتوسط',
    'الصف الثالث المتوسط'
  ],
  'المرحلة الثانوية': [
    'السنة الأولى المشتركة (أول ثانوي)',
    'الصف الثاني الثانوي - مسارات',
    'الصف الثالث الثانوي - مسارات'
  ]
};

const SEMESTER_PRESETS = ['الفصل الدراسي الأول', 'الفصل الدراسي الثاني', 'الفصل الدراسي الثالث'];

const STAGE_SUBJECT_PRESETS: Record<string, string[]> = {
  'المرحلة الابتدائية': [
    'القرآن الكريم والدراسات الإسلامية',
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'الدراسات الاجتماعية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'المرحلة المتوسطة': [
    'الدراسات الإسلامية',
    'القرآن الكريم وتجويده',
    'الرياضيات',
    'العلوم',
    'لغتي الخالدة',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'الدراسات الاجتماعية',
    'التفكير الناقد',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'المرحلة الثانوية': [
    'الكفايات اللغوية 1-1',
    'الكفايات اللغوية 1-2',
    'الكفايات اللغوية 2-1',
    'الكفايات اللغوية 2-2',
    'الرياضيات 1-1',
    'الرياضيات 1-2',
    'الرياضيات 1-3',
    'الرياضيات 2-1',
    'الرياضيات 2-2',
    'الرياضيات 3',
    'الفيزياء 1',
    'الفيزياء 2',
    'الفيزياء 3',
    'الكيمياء 1',
    'الكيمياء 2',
    'الكيمياء 3',
    'الأحياء 1',
    'الأحياء 2',
    'الأحياء 3',
    'علم الأرض والفضاء',
    'علم البيئة',
    'اللغة الإنجليزية 1-1',
    'اللغة الإنجليزية 1-2',
    'اللغة الإنجليزية 1-3',
    'اللغة الإنجليزية 2-1',
    'اللغة الإنجليزية 2-2',
    'اللغة الإنجليزية 3',
    'التقنية الرقمية 1-1',
    'التقنية الرقمية 1-2',
    'التقنية الرقمية 1-3',
    'التقنية الرقمية 2-1',
    'التقنية الرقمية 2-2',
    'التقنية الرقمية 3',
    'الدراسات الاجتماعية',
    'التاريخ',
    'الجغرافيا',
    'التفكير الناقد',
    'المعرفة المالية',
    'اللياقة والثقافة الصحية',
    'التربية الصحية والبدنية',
    'التربية المهنية',
    'المواطنة الرقمية',
    'الفنون'
  ]
};

const GRADE_SUBJECT_PRESETS: Record<string, string[]> = {
  'الصف الأول الابتدائي': [
    'القرآن الكريم والدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الثاني الابتدائي': [
    'القرآن الكريم والدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الثالث الابتدائي': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الرابع الابتدائي': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'الدراسات الاجتماعية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الخامس الابتدائي': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'الدراسات الاجتماعية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف السادس الابتدائي': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'الرياضيات',
    'العلوم',
    'لغتي الجميلة',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'الدراسات الاجتماعية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الأول المتوسط': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'لغتي الخالدة',
    'الرياضيات',
    'العلوم',
    'الدراسات الاجتماعية',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الثاني المتوسط': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'لغتي الخالدة',
    'الرياضيات',
    'العلوم',
    'الدراسات الاجتماعية',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'الصف الثالث المتوسط': [
    'القرآن الكريم وتجويده',
    'الدراسات الإسلامية',
    'لغتي الخالدة',
    'الرياضيات',
    'العلوم',
    'الدراسات الاجتماعية',
    'اللغة الإنجليزية',
    'المهارات الرقمية',
    'التفكير الناقد',
    'التربية الفنية',
    'المهارات الحياتية والأسرية',
    'التربية البدنية والدفاع عن النفس'
  ],
  'السنة الأولى المشتركة (أول ثانوي)': [
    'الكفايات اللغوية 1-1',
    'الكفايات اللغوية 1-2',
    'الرياضيات 1-1',
    'الرياضيات 1-2',
    'الرياضيات 1-3',
    'الفيزياء 1',
    'الكيمياء 1',
    'الأحياء 1',
    'علم البيئة',
    'التقنية الرقمية 1-1',
    'التقنية الرقمية 1-2',
    'التقنية الرقمية 1-3',
    'اللغة الإنجليزية 1-1',
    'اللغة الإنجليزية 1-2',
    'اللغة الإنجليزية 1-3',
    'التفكير الناقد',
    'التربية الصحية والبدنية'
  ],
  'الصف الثاني الثانوي - مسارات': [
    'الكفايات اللغوية 2-1',
    'الكفايات اللغوية 2-2',
    'الرياضيات 2-1',
    'الرياضيات 2-2',
    'الفيزياء 2',
    'الكيمياء 2',
    'الأحياء 2',
    'التاريخ',
    'اللغة الإنجليزية 2-1',
    'اللغة الإنجليزية 2-2',
    'التقنية الرقمية 2-1',
    'التقنية الرقمية 2-2',
    'المعرفة المالية',
    'اللياقة والثقافة الصحية',
    'الفنون'
  ],
  'الصف الثالث الثانوي - مسارات': [
    'الدراسات الإسلامية',
    'الرياضيات 3',
    'الفيزياء 3',
    'الكيمياء 3',
    'الأحياء 3',
    'علم الأرض والفضاء',
    'اللغة الإنجليزية 3',
    'التقنية الرقمية 3',
    'الجغرافيا',
    'التربية المهنية',
    'المواطنة الرقمية'
  ]
};

interface LivePodiumViewProps {
  scores: any[];
  onReset?: () => void;
  isAdmin?: boolean;
}

export function LivePodiumView({ scores, onReset, isAdmin }: LivePodiumViewProps) {
  const [revealed, setRevealed] = useState<number[]>([]);

  useEffect(() => {
    const timer3 = setTimeout(() => {
      setRevealed(prev => [...prev, 3]);
      adminSfx.playBronzeReveal();
    }, 1500);

    const timer2 = setTimeout(() => {
      setRevealed(prev => [...prev, 2]);
      adminSfx.playSilverReveal();
    }, 3500);

    const timer1 = setTimeout(() => {
      setRevealed(prev => [...prev, 1]);
      adminSfx.playGoldReveal();
    }, 5500);

    return () => {
      clearTimeout(timer3);
      clearTimeout(timer2);
      clearTimeout(timer1);
    };
  }, []);

  const p1 = scores[0];
  const p2 = scores[1];
  const p3 = scores[2];

  return (
    <div className="flex flex-col items-center justify-center p-6 md:p-12 text-center text-white relative min-h-[500px] bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-indigo-950 w-full">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCI+PGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iMC41IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==')] opacity-40 pointer-events-none" />

      {revealed.includes(1) && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
          {Array.from({ length: 45 }).map((_, i) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 2;
            const duration = 2 + Math.random() * 3;
            const scale = 0.5 + Math.random() * 1;
            const colors = ["bg-yellow-400", "bg-purple-400", "bg-pink-400", "bg-blue-400", "bg-amber-400", "bg-teal-400"];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            return (
              <motion.div
                key={i}
                initial={{ y: -20, x: `${left}%`, opacity: 1, rotate: 0 }}
                animate={{ y: "120vh", x: `${left + (Math.random() * 20 - 10)}%`, opacity: 0, rotate: 360 }}
                transition={{ duration, repeat: Infinity, delay, ease: "linear" }}
                className={`absolute w-3 h-3 ${randomColor} rounded-full`}
                style={{ transform: `scale(${scale})` }}
              />
            );
          })}
        </div>
      )}

      <div className="z-10 mb-8 space-y-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="px-4 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-full text-xs font-black inline-flex items-center gap-1.5"
        >
          <Trophy className="w-4 h-4 text-yellow-400 animate-bounce" />
          <span>منصة تتويج الفرسان الثلاثة 🏆</span>
        </motion.div>
        <h2 className="text-2xl md:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-200">
          النتائج النهائية للمنافسة المباشرة 🎉
        </h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          نحيي جميع الطلاب الأبطال على هذا الحماس والتنافس الرائع في حصة اليوم!
        </p>
      </div>

      <div className="z-10 flex items-end justify-center gap-4 md:gap-10 w-full max-w-2xl mt-12 mb-8 font-sans h-[350px]">
        
        {/* 2nd Place (Silver) */}
        <div className="flex flex-col items-center flex-1 h-full justify-end">
          <AnimatePresence>
            {revealed.includes(2) && p2 ? (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="flex flex-col items-center space-y-2 mb-2 w-full"
              >
                <div className="w-12 h-12 rounded-full bg-slate-700/60 border border-slate-500 flex items-center justify-center text-slate-100 font-bold text-sm shadow-lg shadow-black/20">
                  🥈
                </div>
                <div className="text-center">
                  <span className="text-xs md:text-sm font-black text-white block truncate max-w-[120px]">{p2.studentName}</span>
                  <span className="text-[10px] text-slate-400 block font-bold">{p2.gradeClass}</span>
                </div>
                <div className="px-2.5 py-0.5 rounded-full bg-slate-100/10 border border-slate-500/20 text-slate-300 text-[10px] font-black">
                  {p2.score} ن
                </div>
              </motion.div>
            ) : (
              <div className="h-[100px]" />
            )}
          </AnimatePresence>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "130px" }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="w-full bg-gradient-to-b from-slate-400 to-slate-600 rounded-t-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),_0_10px_20px_rgba(0,0,0,0.4)] flex items-center justify-center relative overflow-hidden border-t border-slate-300"
          >
            <span className="font-sans font-black text-4xl text-slate-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">٢</span>
          </motion.div>
        </div>

        {/* 1st Place (Gold) */}
        <div className="flex flex-col items-center flex-1 h-full justify-end">
          <AnimatePresence>
            {revealed.includes(1) && p1 ? (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="flex flex-col items-center space-y-2 mb-2 w-full"
              >
                <motion.div 
                  animate={{ rotate: [0, -5, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 2, repeatDelay: 1 }}
                  className="text-3xl mb-1 filter drop-shadow-md"
                >
                  👑
                </motion.div>
                <div className="w-16 h-16 rounded-full bg-yellow-500/20 border-2 border-yellow-400 flex items-center justify-center text-yellow-300 font-bold text-lg shadow-xl shadow-yellow-500/10">
                  🥇
                </div>
                <div className="text-center">
                  <span className="text-sm md:text-base font-black text-yellow-300 block truncate max-w-[140px] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">{p1.studentName}</span>
                  <span className="text-xs text-yellow-400 block font-black">{p1.gradeClass}</span>
                </div>
                <div className="px-3 py-1 rounded-full bg-yellow-400 text-slate-950 text-xs font-black shadow-lg shadow-yellow-500/20 animate-pulse">
                  {p1.score} ن
                </div>
              </motion.div>
            ) : (
              <div className="h-[150px]" />
            )}
          </AnimatePresence>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "180px" }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="w-full bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-t-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),_0_10px_20px_rgba(0,0,0,0.4)] flex items-center justify-center relative overflow-hidden border-t border-yellow-300 z-10"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-yellow-300/30 via-transparent to-transparent" />
            <span className="font-sans font-black text-5xl text-yellow-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">١</span>
          </motion.div>
        </div>

        {/* 3rd Place (Bronze) */}
        <div className="flex flex-col items-center flex-1 h-full justify-end">
          <AnimatePresence>
            {revealed.includes(3) && p3 ? (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="flex flex-col items-center space-y-2 mb-2 w-full"
              >
                <div className="w-12 h-12 rounded-full bg-amber-900/40 border border-amber-600 flex items-center justify-center text-amber-200 font-bold text-sm shadow-lg shadow-black/20">
                  🥉
                </div>
                <div className="text-center">
                  <span className="text-xs md:text-sm font-black text-white block truncate max-w-[120px]">{p3.studentName}</span>
                  <span className="text-[10px] text-slate-400 block font-bold">{p3.gradeClass}</span>
                </div>
                <div className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-600/20 text-amber-300 text-[10px] font-black">
                  {p3.score} ن
                </div>
              </motion.div>
            ) : (
              <div className="h-[90px]" />
            )}
          </AnimatePresence>
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "90px" }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="w-full bg-gradient-to-b from-amber-600 to-amber-800 rounded-t-2xl shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),_0_10px_20px_rgba(0,0,0,0.4)] flex items-center justify-center relative overflow-hidden border-t border-amber-500"
          >
            <span className="font-sans font-black text-3xl text-amber-100 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">٣</span>
          </motion.div>
        </div>

      </div>

      {isAdmin && onReset && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 7.5 }}
          onClick={onReset}
          className="z-20 px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-extrabold text-xs transition flex items-center gap-2 cursor-pointer shadow-md"
        >
          <RefreshCw className="w-4 h-4 text-indigo-300" />
          <span>إعادة تعيين وبدء تنافس جديد 🔄</span>
        </motion.button>
      )}
    </div>
  );
}

import { useEffect } from "react";

interface ReviewsAdminTabProps {
  currentUser: any;
  quizzes: Quiz[];
  reviewChallenges: ReviewChallenge[];
  reviewScores: ReviewScore[];
  bankQuestions: BankQuestion[];
  triggerToast: (msg: string, type: "success" | "error" | "info") => void;
  triggerConfirm: (title: string, desc: string, onConfirm: () => void) => void;
}

// 3 Fixed Games Configuration
export const FIXED_GAMES = [
  {
    gameType: "wayground_arena",
    id: "fixed_game_wayground_arena",
    title: "كاهوت التفاعلي 🎪",
    badge: "🎪 كاهوت التفاعلي",
    desc: "مواجهة حية ومباشرة بين كافة الطلاب بنظام خيارات الألوان وسرعة الإجابة"
  },
  {
    gameType: "space_invaders",
    id: "fixed_game_space_invaders",
    title: "حرب الفضاء - المركبة الفضائية 🚀",
    badge: "🚀 حرب الفضاء",
    desc: "لعبة تحريك المركبة الفضائية وإطلاق النار على الإجابات الصحيحة"
  },
  {
    gameType: "car_racing",
    id: "fixed_game_car_racing",
    title: "سباق السيارات السريع 🏎️",
    badge: "🏎️ سباق السيارات",
    desc: "قيادة السيارة على مضمار المراجعة وتجاوز العقبات بالإجابات الصحيحة"
  }
];

export default function ReviewsAdminTab({
  currentUser,
  quizzes,
  reviewChallenges,
  reviewScores,
  bankQuestions = [],
  triggerToast,
  triggerConfirm
}: ReviewsAdminTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"list" | "create" | "leaderboard">("list");
  
  // Create Challenge form states
  const [newTitle, setNewTitle] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newGrade, setNewGrade] = useState("جميع الفصول (عام)"); // Available to everyone by default
  const [newSemester, setNewSemester] = useState("عام"); // Default/cancelled semester
  const [newGameType, setNewGameType] = useState<'quiz_game' | 'time_attack' | 'space_invaders' | 'car_racing' | 'wayground_arena'>("space_invaders");
  const [selectedQuizIdForImport, setSelectedQuizIdForImport] = useState("");
  const [selectedQuestions, setSelectedQuestions] = useState<Question[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Question Bank search / selection states
  const [questionSource, setQuestionSource] = useState<"quiz" | "bank">("bank");
  const [bqSearchQuery, setBqSearchQuery] = useState("");
  const [bqSubjectFilter, setBqSubjectFilter] = useState("all");

  const [bqFilterStage, setBqFilterStage] = useState("all");
  const [bqFilterGrade, setBqFilterGrade] = useState("all");
  const [bqFilterSubject, setBqFilterSubject] = useState("all");
  const [bqFilterSemester, setBqFilterSemester] = useState("all");
  const [bqFilterLessons, setBqFilterLessons] = useState<string[]>([]);

  // Auto Test Generator Modal state
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [autoMcqCount, setAutoMcqCount] = useState(5);
  const [autoTfCount, setAutoTfCount] = useState(5);

  // Manual Question & Question Editing states
  const [editingQIdx, setEditingQIdx] = useState<number | null>(null);
  const [isAddingManualQ, setIsAddingManualQ] = useState(false);
  const [manualQText, setManualQText] = useState("");
  const [manualQType, setManualQType] = useState<'multiple_choice' | 'true_false'>("multiple_choice");
  const [manualQOptions, setManualQOptions] = useState<string[]>(["", "", "", ""]);
  const [manualQCorrect, setManualQCorrect] = useState(0);

  const bqAvailableStages = STAGE_PRESETS.filter(stg =>
    bankQuestions.some(q => q.stage === stg)
  );

  const gradesForSelectedStage = Array.from(new Set(
    bqFilterStage === "all" 
      ? Object.values(GRADE_PRESETS).flat() 
      : (GRADE_PRESETS[bqFilterStage] || [])
  )).filter(grd =>
    bankQuestions.some(q => 
      q.grade === grd && 
      (bqFilterStage === "all" || q.stage === bqFilterStage)
    )
  );

  const subjectsForSelectedGrade = Array.from(new Set(
    bqFilterGrade === "all"
      ? (bqFilterStage === "all" 
          ? Object.values(GRADE_SUBJECT_PRESETS).flat() 
          : (STAGE_SUBJECT_PRESETS[bqFilterStage] || []))
      : (GRADE_SUBJECT_PRESETS[bqFilterGrade] || [])
  )).filter(subj =>
    bankQuestions.some(q =>
      q.subject === subj &&
      (bqFilterStage === "all" || q.stage === bqFilterStage) &&
      (bqFilterGrade === "all" || q.grade === bqFilterGrade)
    )
  );

  const semestersForSelectedSubject = SEMESTER_PRESETS.filter(sem =>
    bankQuestions.some(q =>
      q.semester === sem &&
      (bqFilterStage === "all" || q.stage === bqFilterStage) &&
      (bqFilterGrade === "all" || q.grade === bqFilterGrade) &&
      (bqFilterSubject === "all" || q.subject === bqFilterSubject)
    )
  );

  const questionsForUnitSelect = bankQuestions.filter(q => {
    const matchesStage = bqFilterStage === "all" || q.stage === bqFilterStage;
    const matchesGrade = bqFilterGrade === "all" || q.grade === bqFilterGrade;
    const matchesSubject = bqFilterSubject === "all" || q.subject === bqFilterSubject;
    const matchesSemester = bqFilterSemester === "all" || q.semester === bqFilterSemester;
    return matchesStage && matchesGrade && matchesSubject && matchesSemester;
  });

  const filteredBankQuestions = bankQuestions.filter(bq => {
    const matchesStage = bqFilterStage === "all" || bq.stage === bqFilterStage;
    const matchesGrade = bqFilterGrade === "all" || bq.grade === bqFilterGrade;
    const matchesSubject = bqFilterSubject === "all" || bq.subject === bqFilterSubject;
    const matchesSemester = bqFilterSemester === "all" || bq.semester === bqFilterSemester;
    
    // Units and Lessons filter
    let matchesUnitLesson = true;
    if (bqFilterLessons.length > 0) {
      matchesUnitLesson = bqFilterLessons.some(val => {
        const parts = val.split(" | ");
        const u = parts[0] || "";
        const l = parts[1] || "";
        return bq.unit === u && bq.lesson === l;
      });
    }

    const matchesSearch = !bqSearchQuery.trim() || bq.text.toLowerCase().includes(bqSearchQuery.toLowerCase());
    return matchesStage && matchesGrade && matchesSubject && matchesSemester && matchesUnitLesson && matchesSearch;
  });

  // Scoreboard filter states
  const [selectedChallengeId, setSelectedChallengeId] = useState("");
  const [selectedLeaderboardChallengeId, setSelectedLeaderboardChallengeId] = useState<string | null>(null);
  const [selectedClassGroupFilter, setSelectedClassGroupFilter] = useState("all");
  const [isFullscreenScoreboard, setIsFullscreenScoreboard] = useState(false);
  const [livePlayers, setLivePlayers] = useState<any[]>([]);

  // Open Fullscreen in a new tab helper
  const handleOpenFullscreenNewTab = (challengeId?: string) => {
    const targetId = challengeId || selectedChallengeId || (reviewChallenges.find(c => c.gameType === "wayground_arena")?.id || reviewChallenges[0]?.id || "");
    if (targetId) {
      setSelectedChallengeId(targetId);
    }
    setIsFullscreenScoreboard(true);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set("fullscreen", "true");
      if (targetId) {
        url.searchParams.set("challengeId", targetId);
      }
      url.searchParams.set("subtab", "leaderboard");
      window.open(url.toString(), "_blank");
    } catch (err) {
      console.warn("Could not open new window tab:", err);
    }
  };

  // Check URL query parameters on mount for direct fullscreen mode in new tab
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fullscreenParam = params.get("fullscreen");
    const challengeIdParam = params.get("challengeId");
    const subtabParam = params.get("subtab");

    if (challengeIdParam) {
      setSelectedChallengeId(challengeIdParam);
    } else if (reviewChallenges.length > 0) {
      const wayground = reviewChallenges.find(c => c.gameType === "wayground_arena");
      if (wayground) setSelectedChallengeId(wayground.id);
    }

    if (subtabParam === "leaderboard" || fullscreenParam === "true") {
      setActiveSubTab("leaderboard");
    }
    if (fullscreenParam === "true") {
      setIsFullscreenScoreboard(true);
    }
  }, [reviewChallenges]);

  // Listen to players in livePlayroomPresence for the currently selected challenge in real-time
  React.useEffect(() => {
    if (!selectedChallengeId) {
      setLivePlayers([]);
      return;
    }
    const q = query(
      collection(db, "livePlayroomPresence"),
      where("challengeId", "==", selectedChallengeId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const players: any[] = [];
      snapshot.forEach((doc) => {
        players.push(doc.data());
      });
      setLivePlayers(players);
    }, (err) => {
      console.warn("Failed to listen to live playroom presence:", err);
    });

    return () => unsubscribe();
  }, [selectedChallengeId]);

  // Listen to liveState change to trigger background music
  React.useEffect(() => {
    const activeChallenge = reviewChallenges.find(c => c.id === selectedChallengeId);
    if (activeChallenge?.gameType === "wayground_arena" && activeChallenge.liveState === "playing") {
      adminSfx.startBackgroundMusic();
    } else {
      adminSfx.stopBackgroundMusic();
    }
    return () => {
      adminSfx.stopBackgroundMusic();
    };
  }, [selectedChallengeId, reviewChallenges]);

  // Auto-cleanup live game after 30 seconds in podium state on teacher side
  React.useEffect(() => {
    const activeChallenge = reviewChallenges.find(c => c.id === selectedChallengeId);
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
        
        if (diffSeconds >= 30) {
          if (interval) clearInterval(interval);
          try {
            // Reset the challenge state
            await updateDoc(doc(db, "reviewChallenges", activeChallenge.id), {
              liveState: "waiting",
              podiumAt: deleteField()
            });

            // Automatically clear scores for this game session
            await handleClearScores(activeChallenge.id, activeChallenge.gameType, true);

            // Clear presence
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
            triggerToast("اكتمل التحدي وتم إغلاق ساحة المعركة التنافسية وتصفير النقاط للجولة الجديدة بنجاح 👍", "info");
          } catch (err) {
            console.warn("Failed to auto-cleanup live challenge:", err);
          }
        }
      };

      checkAndCleanup();
      interval = setInterval(checkAndCleanup, 1000);
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [selectedChallengeId, reviewChallenges]);

  // Sync Basic Data (البيانات الأساسية) fields in Step 2 automatically whenever Step 1 selections/lessons change
  React.useEffect(() => {
    if (bqFilterGrade && bqFilterGrade !== "all") {
      setNewGrade(bqFilterGrade);
    } else if (bqFilterGrade === "all") {
      setNewGrade("جميع الفصول (عام)");
    }

    if (bqFilterSemester && bqFilterSemester !== "all") {
      setNewSemester(bqFilterSemester);
    } else if (bqFilterSemester === "all") {
      setNewSemester("عام");
    }

    if (bqFilterSubject && bqFilterSubject !== "all") {
      setNewSubject(bqFilterSubject);
    } else if (bqFilterSubject === "all") {
      setNewSubject("");
    }

    // Auto-construct dynamic title based on selected lessons and/or subject (without 'مراجعة')
    if (bqFilterLessons.length > 0) {
      const lessonNames = bqFilterLessons.map(l => {
        const parts = l.split(" | ");
        return parts[1] || parts[0];
      });
      const subjectPrefix = (bqFilterSubject && bqFilterSubject !== "all") ? `${bqFilterSubject} - ` : "";
      if (lessonNames.length === 1) {
        setNewTitle(`${subjectPrefix}${lessonNames[0]}`);
      } else {
        setNewTitle(`${subjectPrefix}${lessonNames.slice(0, 3).join(" و ")}`);
      }
    } else if (bqFilterSubject && bqFilterSubject !== "all") {
      setNewTitle(bqFilterSubject);
    }
  }, [bqFilterGrade, bqFilterSemester, bqFilterSubject, bqFilterLessons]);

  // Auto-fill from a selected Quiz
  const handleImportFromQuiz = (quizId: string) => {
    const found = quizzes.find(q => q.id === quizId);
    if (found) {
      setSelectedQuestions(found.questions || []);
      setNewSubject(found.subject || "");
      triggerToast(`تم استيراد ${found.questions.length} أسئلة من اختبار "${found.title}" بنجاح`, "success");
    }
  };

  // Helper to accurately identify if a question is True/False
  const isTfQuestion = (q: BankQuestion | Question) => isTrueFalseQuestion(q);

  // Open modal to configure auto question generation counts
  const handleOpenAutoModal = () => {
    if (filteredBankQuestions.length === 0) {
      triggerToast("لا توجد أسئلة متوفرة تطابق الوحدات والدروس والمحددات الحالية في بنك الأسئلة", "error");
      return;
    }

    const mcqs = filteredBankQuestions.filter(q => !isTfQuestion(q));
    const tfs = filteredBankQuestions.filter(q => isTfQuestion(q));

    // Default counts: default up to 5 for each type based on availability
    setAutoMcqCount(Math.min(5, mcqs.length));
    setAutoTfCount(Math.min(5, tfs.length));
    setIsAutoModalOpen(true);
  };

  // Generate auto test questions based on selected counts (random sampling) and automatically save & launch challenge
  const handleGenerateAutoTest = async () => {
    const shuffleArray = <T,>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const mcqs = filteredBankQuestions.filter(q => !isTfQuestion(q));
    const tfs = filteredBankQuestions.filter(q => isTfQuestion(q));

    // Randomize sampling from available bank questions
    const selectedMcqs = shuffleArray(mcqs).slice(0, autoMcqCount);
    const selectedTfs = shuffleArray(tfs).slice(0, autoTfCount);

    // Shuffle combined selection order randomly
    const combinedToSelect = shuffleArray([...selectedMcqs, ...selectedTfs]);

    if (combinedToSelect.length === 0) {
      triggerToast("الرجاء تحديد سؤال واحد على الأقل لتوليد الاختبار", "error");
      return;
    }

    const formattedQuestions: Question[] = combinedToSelect.map(bq => {
      const isTf = isTfQuestion(bq);
      return {
        id: bq.id,
        text: bq.text,
        type: isTf ? 'true_false' : 'multiple_choice',
        options: isTf ? (bq.options && bq.options.length === 2 ? bq.options : ['صحيح', 'خطأ']) : (bq.options || []),
        correctAnswer: bq.correctAnswer,
        points: bq.points || 1
      };
    });

    const existingIds = new Set(selectedQuestions.map(q => q.id));
    const newQuestions = formattedQuestions.filter(q => !existingIds.has(q.id));

    const finalQuestions = [...selectedQuestions, ...newQuestions];

    if (finalQuestions.length === 0) {
      triggerToast("جميع الأسئلة المختارة موجودة بالفعل في قائمة المسودة", "info");
      setIsAutoModalOpen(false);
      return;
    }

    // Auto-fill title if empty
    let autoTitle = newTitle.trim();
    if (!autoTitle) {
      autoTitle = "تحدي مراجعة";
      if (bqFilterSubject !== "all") {
        autoTitle += ` - ${bqFilterSubject}`;
      } else if (newSubject.trim()) {
        autoTitle += ` - ${newSubject}`;
      }
      if (bqFilterLessons.length > 0) {
        const lessonNames = bqFilterLessons.map(l => {
          const parts = l.split(" | ");
          return parts[1] || parts[0];
        });
        autoTitle += ` (${lessonNames.slice(0, 2).join(" و ")})`;
      }
    }

    // Auto-fill subject if empty
    const autoSubject = newSubject.trim() || (bqFilterSubject !== "all" ? bqFilterSubject : "مراجعة عامة");

    setIsSubmitting(true);
    const fixedId = `fixed_game_${currentUser.uid}_${newGameType}`;
    const fg = FIXED_GAMES.find(g => g.gameType === newGameType) || FIXED_GAMES[0];
    const existing = reviewChallenges.find(c => c.id === fixedId || c.gameType === newGameType);

    const challengeData = {
      id: fixedId,
      title: autoTitle || fg.title,
      subject: autoSubject,
      grade: newGrade,
      semester: newSemester,
      questions: finalQuestions,
      status: "draft" as const,
      teacherId: currentUser.uid,
      createdAt: existing?.createdAt || new Date().toISOString(),
      gameType: newGameType
    };

    try {
      await setDoc(doc(db, "reviewChallenges", fixedId), challengeData, { merge: true });
      triggerToast(`تم توليد وحفظ أسئلة لعبة ${autoTitle || fg.title} بـ ${finalQuestions.length} سؤالاً بنجاح (مسودة دون تفعيل) 💾✨`, "success");
      
      // Reset form states and switch to active challenges list
      setNewTitle("");
      setSelectedQuestions([]);
      setSelectedQuizIdForImport("");
      setIsAutoModalOpen(false);
      setIsEditModalOpen(false);
      setActiveSubTab("list");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reviewChallenges/${fixedId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleQuestionSelection = (bq: BankQuestion) => {
    const isSelected = selectedQuestions.some(q => q.id === bq.id);
    if (isSelected) {
      setSelectedQuestions(selectedQuestions.filter(q => q.id !== bq.id));
    } else {
      const isTf = isTfQuestion(bq);
      const newQ: Question = {
        id: bq.id,
        text: bq.text,
        type: isTf ? 'true_false' : 'multiple_choice',
        options: isTf ? (bq.options && bq.options.length === 2 ? bq.options : ['صحيح', 'خطأ']) : (bq.options || []),
        correctAnswer: bq.correctAnswer,
        points: bq.points || 1
      };
      setSelectedQuestions([...selectedQuestions, newQ]);
    }
  };

  const handleSelectAllFilteredBankQuestions = () => {
    if (filteredBankQuestions.length === 0) {
      triggerToast("لا توجد أسئلة مفلترة لإضافتها", "info");
      return;
    }
    const converted: Question[] = filteredBankQuestions.map((bq, idx) => {
      const isTf = isTfQuestion(bq);
      let normAnswer = bq.correctAnswer;
      if (isTf) {
        let ansText = String(bq.correctAnswer).trim();
        if (ansText === '0' || ansText === 'true' || ansText === 'صح' || ansText === 'صحيح' || ansText === 'صواب') {
          normAnswer = '0';
        } else {
          normAnswer = '1';
        }
      }
      return {
        id: bq.id || `bq_${idx}`,
        text: bq.text,
        type: isTf ? 'true_false' : 'multiple_choice',
        options: isTf ? (bq.options && bq.options.length === 2 ? bq.options : ['صحيح', 'خطأ']) : (bq.options || []),
        correctAnswer: normAnswer,
        points: bq.points || 10
      };
    });
    setSelectedQuestions(converted);
    triggerToast(`تم تحديد وتعيين جميع أسئلة المادة المفلترة (${converted.length} سؤال) بنجاح 🎯⚡`, "success");
  };

  // Helper to check if option is correct
  const checkOptionIsCorrect = (q: Question, optIdx: number): boolean => {
    const isTf = isTrueFalseQuestion(q);
    if (isTf) {
      const val = (q.correctAnswer || '').toString().toLowerCase().trim();
      if (val === '0' || val === 'true' || val === 'صحيح' || val === 'صح' || val === 'صواب') return optIdx === 0;
      if (val === '1' || val === 'false' || val === 'خطأ' || val === 'خاطئ') return optIdx === 1;
    }
    const parsed = parseInt(q.correctAnswer);
    if (!isNaN(parsed)) return parsed === optIdx;
    if (q.options && q.options[optIdx] === q.correctAnswer) return true;
    return false;
  };

  const handleUpdateQuestionText = (qIdx: number, text: string) => {
    const updated = [...selectedQuestions];
    updated[qIdx] = { ...updated[qIdx], text };
    setSelectedQuestions(updated);
  };

  const handleUpdateQuestionOptionText = (qIdx: number, optIdx: number, text: string) => {
    const updated = [...selectedQuestions];
    const q = { ...updated[qIdx] };
    const newOpts = [...(q.options || [])];
    newOpts[optIdx] = text;
    q.options = newOpts;
    updated[qIdx] = q;
    setSelectedQuestions(updated);
  };

  const handleUpdateQuestionCorrectAnswer = (qIdx: number, correctIdx: number) => {
    const updated = [...selectedQuestions];
    const q = { ...updated[qIdx] };
    q.correctAnswer = correctIdx.toString();
    updated[qIdx] = q;
    setSelectedQuestions(updated);
  };

  const handleDeleteQuestion = (qIdx: number) => {
    const updated = selectedQuestions.filter((_, idx) => idx !== qIdx);
    setSelectedQuestions(updated);
  };

  const handleMoveQuestion = (qIdx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && qIdx === 0) return;
    if (direction === 'down' && qIdx === selectedQuestions.length - 1) return;
    const targetIdx = direction === 'up' ? qIdx - 1 : qIdx + 1;
    const updated = [...selectedQuestions];
    const temp = updated[qIdx];
    updated[qIdx] = updated[targetIdx];
    updated[targetIdx] = temp;
    setSelectedQuestions(updated);
  };

  const handleAddManualQuestion = () => {
    if (!manualQText.trim()) {
      triggerToast("يرجى كتابة نص السؤال أولاً", "error");
      return;
    }

    const isTf = manualQType === "true_false";
    const finalOptions = isTf ? ["صحيح", "خطأ"] : manualQOptions.map((o, i) => o.trim() || `خيار ${i + 1}`);

    const newQ: Question = {
      id: `manual_q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      text: manualQText.trim(),
      type: manualQType,
      options: finalOptions,
      correctAnswer: manualQCorrect.toString(),
      points: 1,
      isManual: true
    };

    setSelectedQuestions([...selectedQuestions, newQ]);
    setManualQText("");
    setManualQOptions(["", "", "", ""]);
    setManualQCorrect(0);
    setIsAddingManualQ(false);
    triggerToast("تم إضافة السؤال إلى التحدي بنجاح ➕✨", "success");
  };

  // Open question editor for a specific fixed game
  const handleEditGameQuestions = (gameTypeStr: string) => {
    const fg = FIXED_GAMES.find(g => g.gameType === gameTypeStr) || FIXED_GAMES[0];
    const existing = reviewChallenges.find(c => c.id === fg.id || c.gameType === fg.gameType);

    setNewGameType(fg.gameType as any);
    setSelectedQuestions(existing?.questions ? [...existing.questions] : []);
    setNewTitle(existing?.title || fg.title);
    setNewSubject(existing?.subject || (bqFilterSubject !== "all" ? bqFilterSubject : ""));
    setNewGrade(existing?.grade || (bqFilterGrade !== "all" ? bqFilterGrade : "جميع الفصول (عام)"));
    setNewSemester(existing?.semester || (bqFilterSemester !== "all" ? bqFilterSemester : "عام"));
    setEditingQIdx(null);
    setIsAddingManualQ(false);
    setIsEditModalOpen(true);
  };

  // Save/Update Game Questions & Optionally Activate
  const handleSaveGameQuestions = async (isActivating: boolean = true) => {
    const fg = FIXED_GAMES.find(g => g.gameType === newGameType) || FIXED_GAMES[0];
    const targetTitle = newTitle.trim() || fg.title;

    let effectiveQuestions = selectedQuestions;
    if (effectiveQuestions.length === 0) {
      effectiveQuestions = filteredBankQuestions.map((bq, idx) => {
        const isTf = isTfQuestion(bq);
        let normAnswer = bq.correctAnswer;
        if (isTf) {
          let ansText = String(bq.correctAnswer).trim();
          if (ansText === '0' || ansText === 'true' || ansText === 'صح' || ansText === 'صحيح' || ansText === 'صواب') {
            normAnswer = '0';
          } else {
            normAnswer = '1';
          }
        }
        return {
          id: bq.id || `bq_${idx}`,
          text: bq.text,
          type: isTf ? 'true_false' : 'multiple_choice',
          options: isTf ? (bq.options && bq.options.length === 2 ? bq.options : ['صحيح', 'خطأ']) : (bq.options || []),
          correctAnswer: normAnswer,
          points: bq.points || 10
        };
      });
    }

    if (effectiveQuestions.length === 0) {
      triggerToast("لا توجد أسئلة متوفرة للعبة المحددة. يرجى اختيار مادة أو درس يحتوي على أسئلة أولاً.", "error");
      return;
    }

    setIsSubmitting(true);
    const fixedId = `fixed_game_${currentUser.uid}_${newGameType}`;
    const matchingChallenges = reviewChallenges.filter(c => c.id === fixedId || c.gameType === newGameType);
    const existing = reviewChallenges.find(c => c.id === fixedId) || matchingChallenges[0];

    const challengeData = {
      id: fixedId,
      title: targetTitle,
      subject: newSubject || (bqFilterSubject !== "all" ? bqFilterSubject : "مراجعة عامة"),
      grade: newGrade,
      semester: newSemester,
      questions: effectiveQuestions,
      status: isActivating ? ("active" as const) : ("draft" as const),
      teacherId: currentUser.uid,
      createdAt: existing?.createdAt || new Date().toISOString(),
      gameType: newGameType
    };

    try {
      await setDoc(doc(db, "reviewChallenges", fixedId), challengeData, { merge: true });

      // Synchronize questions across all documents matching this gameType
      for (const ch of matchingChallenges) {
        if (ch.id && ch.id !== fixedId) {
          await setDoc(doc(db, "reviewChallenges", ch.id), {
            questions: effectiveQuestions,
            title: targetTitle,
            subject: challengeData.subject,
            grade: newGrade,
            semester: newSemester,
            status: isActivating ? "active" : "draft"
          }, { merge: true }).catch(() => {});
        }
      }

      triggerToast(
        isActivating
          ? `تم حفظ الأسئلة وتفعيل لعبة (${targetTitle}) للطلاب بنجاح! ⚡🟢`
          : `تم حفظ أسئلة لعبة (${targetTitle}) كمسودة 💾`,
        "success"
      );
      
      // Reset & switch to list view
      setNewTitle("");
      setSelectedQuestions([]);
      setSelectedQuizIdForImport("");
      setIsEditModalOpen(false);
      setActiveSubTab("list");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reviewChallenges/${fixedId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Activation directly from Fixed Games List
  const handleToggleGameActivation = async (fg: typeof FIXED_GAMES[0]) => {
    const fixedId = fg.id;
    const matchingChallenges = reviewChallenges.filter(c => c.id === fixedId || c.gameType === fg.gameType);
    const challenge = reviewChallenges.find(c => c.id === fixedId) || matchingChallenges[0];

    if (!challenge || !challenge.questions || challenge.questions.length === 0) {
      triggerToast(`يرجى تحديد وتعيين أسئلة للعبة (${fg.title}) أولاً لتفعيلها للطلاب`, "info");
      handleEditGameQuestions(fg.gameType);
      return;
    }

    const targetDocId = challenge.id || fixedId;
    const newStatus = challenge.status === "active" ? "completed" : "active";
    try {
      await setDoc(doc(db, "reviewChallenges", targetDocId), {
        ...challenge,
        id: targetDocId,
        status: newStatus
      }, { merge: true });

      // Synchronize any other documents matching this gameType so no stale active challenge exists
      for (const ch of matchingChallenges) {
        if (ch.id && ch.id !== targetDocId) {
          await setDoc(doc(db, "reviewChallenges", ch.id), { status: newStatus }, { merge: true }).catch(() => {});
        }
      }

      // If pausing/stopping the game, eject all students and clear existing scores/presence
      if (newStatus === "completed") {
        await handleClearScores(targetDocId, fg.gameType, true);
      }

      triggerToast(
        newStatus === "active"
          ? `تم تفعيل لعبة (${challenge.title}) للطلاب بالمعمل بنجاح 🟢`
          : `تم إيقاف اللعبة وإخراج جميع الطلاب وتصفير لوحة النتائج بنجاح ⏸️`,
        "success"
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reviewChallenges/${targetDocId}`);
    }
  };

  // Toggle status
  const toggleChallengeStatus = async (challenge: ReviewChallenge) => {
    const newStatus = challenge.status === "active" ? "completed" : "active";
    try {
      await updateDoc(doc(db, "reviewChallenges", challenge.id), {
        status: newStatus
      });
      if (newStatus === "completed") {
        await handleClearScores(challenge.id, challenge.gameType, true);
      }
      triggerToast(
        newStatus === "active" ? "تم تفعيل التحدي للطلاب بنجاح" : "تم إيقاف وتجميد المراجعة وإخراج جميع الطلاب بنجاح",
        "success"
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reviewChallenges/${challenge.id}`);
    }
  };

  // Clear challenge scores for a specific game (إعادة تصفير نقاط اللعبة منفصلة)
  const handleClearScores = async (challengeId: string, gameType?: string, silent: boolean = false) => {
    try {
      const targetChallengeIds = new Set<string>([challengeId]);
      if (gameType) {
        reviewChallenges.filter(c => c.gameType === gameType).forEach(c => targetChallengeIds.add(c.id));
      }

      const docsToDelete: any[] = [];
      for (const chId of Array.from(targetChallengeIds)) {
        const qSnap = await getDocs(
          query(collection(db, "reviewScores"), where("challengeId", "==", chId))
        );
        qSnap.forEach((docSnap) => docsToDelete.push(docSnap));

        const pSnap = await getDocs(
          query(collection(db, "livePlayroomPresence"), where("challengeId", "==", chId))
        );
        pSnap.forEach((docSnap) => docsToDelete.push(docSnap));
      }

      if (docsToDelete.length === 0) {
        if (!silent) {
          triggerToast("لا يوجد نتائج أو نقاط مسجلة لهذه اللعبة لتصفيرها بعد", "info");
        }
        return;
      }

      const batch = writeBatch(db);
      docsToDelete.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      if (!silent) {
        triggerToast("تم تصفير جميع نقاط ونتائج هذه اللعبة بنجاح! جاهزة لبدء جولة جديدة من 0 نقاط ⚡", "success");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, "reviewScores");
    }
  };

  // Delete challenge
  const handleDeleteChallenge = async (challengeId: string) => {
    try {
      await deleteDoc(doc(db, "reviewChallenges", challengeId));
      triggerToast("تم حذف تحدي المراجعة بنجاح", "success");
      
      // Also delete corresponding scores in background
      const qSnap = await getDocs(
        query(collection(db, "reviewScores"), where("challengeId", "==", challengeId))
      );
      const batch = writeBatch(db);
      qSnap.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reviewChallenges/${challengeId}`);
    }
  };

  const handleStartLiveGame = async (challengeId: string) => {
    try {
      const targetChallenge = reviewChallenges.find(c => c.id === challengeId);
      await updateDoc(doc(db, "reviewChallenges", challengeId), {
        liveState: "playing"
      });
      // Clear previous scores for this game when starting a fresh live session
      await handleClearScores(challengeId, targetChallenge?.gameType, true);
      triggerToast("تم بدء اللعبة المباشرة! الطلاب الآن في مواجهة حماسية 🚀", "success");
    } catch (err) {
      console.error(err);
      triggerToast("فشل بدء اللعبة", "error");
    }
  };

  const handleEndLiveGame = async (challengeId: string) => {
    try {
      await updateDoc(doc(db, "reviewChallenges", challengeId), {
        liveState: "podium",
        podiumAt: new Date().toISOString()
      });
      triggerToast("تم إنهاء اللعبة! جاري تحضير منصة تتويج الأبطال الثلاثة 🏆", "success");
    } catch (err) {
      console.error(err);
      triggerToast("فشل إنهاء اللعبة", "error");
    }
  };

  const handleResetLiveGame = async (challengeId: string) => {
    try {
      const targetChallenge = reviewChallenges.find(c => c.id === challengeId);
      await updateDoc(doc(db, "reviewChallenges", challengeId), {
        liveState: "waiting",
        podiumAt: deleteField()
      });
      // Also clear scores of the live challenge so we can play fresh
      await handleClearScores(challengeId, targetChallenge?.gameType, true);
      triggerToast("تمت إعادة تعيين اللعبة وصالة الانتظار وتصفير النقاط لتحدي جديد 🔄", "success");
    } catch (err) {
      console.error(err);
      triggerToast("فشل إعادة تعيين اللعبة", "error");
    }
  };

  const handleKickAllAndReset = async (challengeId: string) => {
    try {
      const targetChallenge = reviewChallenges.find(c => c.id === challengeId);
      // 1. Delete all presence records for this challenge
      const q = query(
        collection(db, "livePlayroomPresence"),
        where("challengeId", "==", challengeId)
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();

      // 2. Reset the challenge's live state to waiting and delete podiumAt
      await updateDoc(doc(db, "reviewChallenges", challengeId), {
        liveState: "waiting",
        podiumAt: deleteField()
      });

      // 3. Clear the leaderboard/scores of the live challenge
      await handleClearScores(challengeId, targetChallenge?.gameType, true);

      triggerToast("تم إخراج جميع الطلاب وإعادة تعيين التحدي وصالة الانتظار وتصفير النقاط بنجاح 🔄🗑️", "success");
    } catch (err) {
      console.error(err);
      triggerToast("فشل إخراج الطلاب وإعادة التعيين", "error");
    }
  };

  const handleQuickStartWayground = async (challenge: ReviewChallenge) => {
    try {
      // 1. Make sure challenge is active
      if (challenge.status !== "active") {
        await updateDoc(doc(db, "reviewChallenges", challenge.id), {
          status: "active"
        });
      }
      // 2. Set liveState to "playing"
      await updateDoc(doc(db, "reviewChallenges", challenge.id), {
        liveState: "playing"
      });
      // 3. Select it and go to leaderboard
      setSelectedChallengeId(challenge.id);
      setActiveSubTab("leaderboard");
      triggerToast("تم بدء لعبة ساحة وايقراند مباشرة بنجاح! الفرسان يواجهون الأسئلة الآن 🚀🎪", "success");
    } catch (err) {
      console.error(err);
      triggerToast("فشل بدء اللعبة السريع", "error");
    }
  };

  // Get active student scores for selected challenge
  const getFilteredScores = () => {
    const challengeScores = reviewScores.filter(s => s.challengeId === selectedChallengeId);
    if (selectedClassGroupFilter === "all") {
      return challengeScores.sort((a, b) => b.score - a.score);
    }
    return challengeScores
      .filter(s => s.gradeClass === selectedClassGroupFilter)
      .sort((a, b) => b.score - a.score);
  };

  // Unique class groups available for filtering
  const getAvailableClassGroups = () => {
    const challengeScores = reviewScores.filter(s => s.challengeId === selectedChallengeId);
    const classes = Array.from(new Set(challengeScores.map(s => s.gradeClass)));
    return classes.filter(Boolean);
  };



  const handleOpenCreateTab = () => {
    if (bqFilterGrade && bqFilterGrade !== "all") {
      setNewGrade(bqFilterGrade);
    } else {
      setNewGrade("جميع الفصول (عام)");
    }
    if (bqFilterSemester && bqFilterSemester !== "all") {
      setNewSemester(bqFilterSemester);
    } else {
      setNewSemester("عام");
    }
    if (bqFilterSubject && bqFilterSubject !== "all") {
      setNewSubject(bqFilterSubject);
    } else {
      setNewSubject("");
    }
    setIsEditModalOpen(true);
  };

  const availableBqSubjects = Array.from(new Set(bankQuestions.map(bq => bq.subject).filter(Boolean)));
  const activeChallenges = reviewChallenges.filter(c => c.status === "active");

  return (
    <div className="space-y-6" dir="rtl">
      {/* Subtabs Switch Panel */}
      <div className="bg-slate-200/90 p-1 rounded-xl flex flex-wrap items-center gap-1.5 w-full sm:w-fit border border-slate-300/80 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveSubTab("list")}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-black transition-all duration-200 cursor-pointer ${
            activeSubTab === "list"
              ? "bg-gradient-to-r from-indigo-600 via-blue-600 to-blue-700 text-white shadow-xs scale-[1.01] border border-indigo-400/30"
              : "bg-white/80 hover:bg-white text-slate-700 hover:text-indigo-700 border border-slate-200/80 font-bold"
          }`}
        >
          <div className={`p-0.5 rounded shrink-0 ${activeSubTab === "list" ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-600"}`}>
            <Gamepad2 className="w-3.5 h-3.5" />
          </div>
          <span>الألعاب والتحديات المثبتة 🎮</span>
        </button>
      </div>

      {/* Main Subtab Renderer */}
      <AnimatePresence mode="wait">
        {activeSubTab === "list" && (
          <motion.div
            key="list-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-4"
          >
            {/* Fixed Games List Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-indigo-600" />
                  الألعاب والتحديات التفاعلية المثبتة (3 ألعاب)
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">
                  الألعاب مثبتة بصفحة المعلم والطالب. اضغط "تغيير الأسئلة" لتعديل أو استيراد أسئلة اللعبة وتفعيلها فوراً للطلاب!
                </p>
              </div>
              <button
                onClick={() => {
                  if (reviewChallenges.length > 0) {
                    setSelectedChallengeId(reviewChallenges[0].id);
                    setActiveSubTab("leaderboard");
                  } else {
                    triggerToast("يرجى تفعيل لعبة وتحديد أسئلتها أولاً لفتح المتصدرين", "info");
                  }
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black transition flex items-center gap-2 cursor-pointer shadow-xs self-start sm:self-auto shrink-0"
              >
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span>شاشة النتائج والمتصدرين</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {FIXED_GAMES.map((fg) => {
                const challenge = reviewChallenges.find(c => c.id === fg.id) || reviewChallenges.find(c => c.gameType === fg.gameType);
                const isActivated = challenge && challenge.status === "active" && (challenge.questions?.length || 0) > 0;
                const questionsCount = challenge?.questions?.length || 0;
                const totalScoresCount = challenge ? reviewScores.filter(s => s.challengeId === challenge.id).length : 0;

                return (
                  <div
                    key={fg.gameType}
                    className={`bg-white rounded-3xl border-2 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md flex flex-col justify-between ${
                      isActivated
                        ? "border-emerald-400 ring-4 ring-emerald-100/60"
                        : "border-slate-200 opacity-95"
                    }`}
                  >
                    {/* Top Large Thumbnail Banner */}
                    <div className="relative h-40 w-full overflow-hidden select-none">
                      {fg.gameType === "space_invaders" ? (
                        <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 border-b-2 border-emerald-500/50 flex flex-col justify-between p-3.5 relative">
                          <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
                          <div className="relative z-10 flex justify-between items-center">
                            <span className="text-[10px] font-black text-emerald-300 bg-slate-900/90 px-2.5 py-1 rounded-full border border-emerald-500/40 shadow-xs">
                              🚀 SPACE INVADERS
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
                            <div className="text-3xl animate-bounce">🚀</div>
                            <div className="text-[11px] font-black text-emerald-300 tracking-wide uppercase">
                              معركة الفضاء
                            </div>
                          </div>
                        </div>
                      ) : fg.gameType === "car_racing" ? (
                        <div className="w-full h-full bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 border-b-2 border-indigo-500/50 flex flex-col justify-between p-3.5 relative">
                          <div className="absolute inset-0 bg-slate-900/50 flex justify-around opacity-30 pointer-events-none">
                            <div className="w-1 h-full border-r-2 border-dashed border-indigo-400" />
                            <div className="w-1 h-full border-r-2 border-dashed border-indigo-400" />
                          </div>
                          <div className="relative z-10 flex justify-between items-center">
                            <span className="text-[10px] font-black text-indigo-300 bg-slate-950/90 px-2.5 py-1 rounded-full border border-indigo-500/40 shadow-xs">
                              🏎️ RACING ARENA
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
                            <div className="text-3xl">🏎️</div>
                            <div className="text-[11px] font-black text-indigo-200 tracking-wide uppercase">
                              سباق السيارات
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-purple-950 via-indigo-900 to-purple-900 border-b-2 border-purple-500/50 flex flex-col justify-between p-3.5 relative">
                          <div className="relative z-10 flex justify-between items-center">
                            <span className="text-[10px] font-black text-purple-200 bg-purple-900/80 px-2.5 py-1 rounded-full border border-purple-500/40 shadow-xs">
                              🎪 KAHOOT STYLE
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
                            <div className="text-2xl">🎪</div>
                            <div className="flex justify-center gap-1.5 text-[10px] font-black text-white">
                              <span className="bg-rose-600 px-1.5 py-0.5 rounded shadow-xs">▲ أحمر</span>
                              <span className="bg-blue-600 px-1.5 py-0.5 rounded shadow-xs">◆ أزرق</span>
                              <span className="bg-amber-500 px-1.5 py-0.5 rounded shadow-xs">● أصفر</span>
                              <span className="bg-emerald-600 px-1.5 py-0.5 rounded shadow-xs">■ أخضر</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Full Width Game Type Bar attached to Top Banner */}
                    <div className="w-full bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-50 border-y border-indigo-200/90 py-2.5 px-4 text-center">
                      <span className="text-sm sm:text-base font-black text-indigo-900 tracking-wide">
                        {fg.gameType === "space_invaders" ? "الفضاء 🚀" : fg.gameType === "car_racing" ? "السيارات 🏎️" : "كاهوت 🎪"}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-5 pt-3.5 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600 font-bold leading-relaxed">
                          {fg.desc}
                        </p>
                        <h4 className="font-bold text-amber-950 text-[11px] sm:text-xs leading-snug p-2 rounded-xl border border-amber-200/90 bg-amber-50/90 text-center shadow-2xs">
                          {challenge?.title || fg.title}
                        </h4>
                      </div>

                      {/* Metadata badges */}
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700 pt-2 border-t border-slate-100">
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

                      {/* Card Action Buttons */}
                      <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">


                        <button
                          onClick={() => handleEditGameQuestions(fg.gameType)}
                          className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs hover:scale-[1.02]"
                        >
                          <Wand2 className="w-4 h-4 text-yellow-300" />
                          <span>تغيير وتعديل الأسئلة 📝</span>
                        </button>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleGameActivation(fg)}
                            className={`flex-1 py-2 rounded-xl text-xs font-black border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                              isActivated
                                ? "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100"
                                : "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {isActivated ? (
                              <>
                                <Square className="w-3.5 h-3.5" />
                                <span>إيقاف ⏸️</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5" />
                                <span>تفعيل 🟢</span>
                              </>
                            )}
                          </button>

                          <button
                            disabled={!isActivated}
                            onClick={() => {
                              if (!isActivated) return;
                              const targetChallenge = challenge || reviewChallenges.find(c => c.gameType === fg.gameType) || reviewChallenges.find(c => c.id === fg.id);
                              const targetId = targetChallenge?.id || fg.id;
                              setSelectedChallengeId(targetId);
                              setActiveSubTab("leaderboard");
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                              isActivated
                                ? "bg-slate-900 hover:bg-slate-800 text-white shadow-2xs cursor-pointer active:scale-95"
                                : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                            }`}
                          >
                            <Trophy className={`w-4 h-4 ${isActivated ? "text-yellow-400" : "text-slate-400"}`} />
                            <span>المتصدرين والنتائج</span>
                          </button>
                        </div>

                        {/* Independent Leaderboard & Results Section for this Game in Teacher View */}
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
                                {gameLeaderboard.slice(0, 5).map((scoreItem, idx) => (
                                  <div
                                    key={scoreItem.id || idx}
                                    className="p-2 rounded-xl text-xs flex items-center justify-between gap-2 border border-slate-200 bg-slate-50/80 text-slate-700 font-sans"
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
                                        {scoreItem.studentName}
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
                                ))}

                                {gameLeaderboard.length === 0 && (
                                  <p className="text-center text-[11px] text-slate-400 font-bold py-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                    لا توجد نتائج مسجلة لهذه اللعبة بعد.
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {(isEditModalOpen || activeSubTab === "create") && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto">
            <motion.div
              key="create-modal"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white w-full max-w-4xl rounded-3xl p-5 md:p-8 border border-slate-200 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto my-auto relative"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-150 sticky -top-5 md:-top-8 bg-white/95 backdrop-blur-md z-30 pt-2 -mx-5 -mt-5 px-5 md:-mx-8 md:-mt-8 md:px-8">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                    <Wand2 className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-black text-slate-900">
                      نافذة تغيير وتعديل أسئلة اللعبة 📝
                    </h3>
                    <p className="text-xs text-slate-500 font-bold">
                      إضافة وتعديل الأسئلة وإدارتها وتفعيلها فوراً للطلاب بالمعمل
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    if (activeSubTab === "create") setActiveSubTab("list");
                  }}
                  className="w-9 h-9 flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-full text-sm font-bold transition cursor-pointer"
                  title="إغلاق النافذة"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSaveGameQuestions(true); }} className="space-y-8">
              {/* Question Selection Section */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 md:p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">١</span>
                    <h4 className="text-xs md:text-sm font-black text-slate-800">تحديد اختيار أسئلة التحدي من بنك الأسئلة 📚</h4>
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
                    اللعبة: {newGameType === "space_invaders" ? "الفضاء 🚀" : newGameType === "car_racing" ? "السيارات 🏎️" : "كاهوت 🎪"}
                  </span>
                </div>

                <div id="bank-question-selector-container" className="space-y-5 bg-white border border-indigo-200/80 rounded-3xl p-4 md:p-5 shadow-sm transition-all duration-300">
                  {/* Header with Icon */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div className="space-y-1 text-right">
                      <h4 className="text-sm sm:text-base font-black text-indigo-950">
                        تصفح واختيار الأسئلة من بنك الأسئلة
                      </h4>
                      <p className="text-xs text-slate-500 font-bold">
                        تصفح الأسئلة المصنفة وحصّل ما يناسب اختبارك لإدراجه مباشرة في المسودة.
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                      <Database className="w-5 h-5" />
                    </div>
                  </div>

                    {/* Filters Grid with Arabic Steps */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {/* Step 1: المرحلة الدراسية */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 justify-end">
                          <span className="text-xs font-black text-indigo-950">المرحلة الدراسية</span>
                          <span className={`w-5 h-5 text-[10px] rounded-full flex items-center justify-center font-sans font-black transition-all duration-300 ${bqFilterStage === "all" ? "bg-indigo-600 text-white ring-4 ring-indigo-100" : "bg-emerald-100 text-emerald-700"}`}>
                            {bqFilterStage === "all" ? "١" : "✓"}
                          </span>
                        </label>
                        <select
                          value={bqFilterStage}
                          onChange={(e) => {
                            setBqFilterStage(e.target.value);
                            setBqFilterGrade("all");
                            setBqFilterSubject("all");
                            setBqFilterLessons([]);
                          }}
                          className={`w-full px-3 py-2 border text-xs font-bold rounded-xl focus:outline-none transition-all duration-300 ${
                            bqFilterStage === "all" 
                              ? "border-indigo-500 ring-2 ring-indigo-100 shadow-xs bg-white text-indigo-950" 
                              : "border-slate-200 bg-white text-slate-800 hover:border-slate-300"
                          }`}
                        >
                          <option value="all">الكل</option>
                          {bqAvailableStages.map((stg) => (
                            <option key={stg} value={stg}>{stg}</option>
                          ))}
                        </select>
                      </div>

                      {/* Step 2: الصف */}
                      <div className={`space-y-1.5 transition-all duration-300 ${bqFilterStage === "all" ? "opacity-60" : ""}`}>
                        <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 justify-end">
                          <span className="text-xs font-black text-indigo-950">الصف</span>
                          <span className={`w-5 h-5 text-[10px] rounded-full flex items-center justify-center font-sans font-black transition-all duration-300 ${bqFilterStage !== "all" && bqFilterGrade === "all" ? "bg-indigo-600 text-white ring-4 ring-indigo-100" : bqFilterGrade !== "all" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                            {bqFilterGrade === "all" ? "٢" : "✓"}
                          </span>
                        </label>
                        <select
                          value={bqFilterGrade}
                          onChange={(e) => {
                            setBqFilterGrade(e.target.value);
                            setBqFilterSubject("all");
                            setBqFilterLessons([]);
                          }}
                          disabled={bqFilterStage === "all"}
                          className={`w-full px-3 py-2 border text-xs font-bold rounded-xl focus:outline-none transition-all duration-300 ${
                            bqFilterStage !== "all" && bqFilterGrade === "all"
                              ? "border-indigo-500 ring-2 ring-indigo-100 shadow-xs bg-white text-indigo-950" 
                              : bqFilterGrade !== "all"
                                ? "border-slate-200 bg-white text-slate-800 hover:border-slate-300" 
                                : "border-slate-200 text-slate-400 bg-slate-50"
                          }`}
                        >
                          <option value="all">الكل</option>
                          {gradesForSelectedStage.map((grd) => (
                            <option key={grd} value={grd}>{grd}</option>
                          ))}
                        </select>
                      </div>

                      {/* Step 3: الفصل الدراسي */}
                      <div className={`space-y-1.5 transition-all duration-300 ${bqFilterGrade === "all" ? "opacity-60" : ""}`}>
                        <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 justify-end">
                          <span className="text-xs font-black text-indigo-950">الفصل الدراسي</span>
                          <span className={`w-5 h-5 text-[10px] rounded-full flex items-center justify-center font-sans font-black transition-all duration-300 ${bqFilterGrade !== "all" && bqFilterSemester === "all" ? "bg-indigo-600 text-white ring-4 ring-indigo-100" : bqFilterSemester !== "all" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                            {bqFilterSemester === "all" ? "٣" : "✓"}
                          </span>
                        </label>
                        <select
                          value={bqFilterSemester}
                          onChange={(e) => {
                            setBqFilterSemester(e.target.value);
                            setBqFilterLessons([]);
                          }}
                          disabled={bqFilterGrade === "all"}
                          className={`w-full px-3 py-2 border text-xs font-bold rounded-xl focus:outline-none transition-all duration-300 ${
                            bqFilterGrade !== "all" && bqFilterSemester === "all"
                              ? "border-indigo-500 ring-2 ring-indigo-100 shadow-xs bg-white text-indigo-950" 
                              : bqFilterSemester !== "all"
                                ? "border-slate-200 bg-white text-slate-800 hover:border-slate-300" 
                                : "border-slate-200 text-slate-400 bg-slate-50"
                          }`}
                        >
                          <option value="all">الكل</option>
                          {semestersForSelectedSubject.map((sem) => (
                            <option key={sem} value={sem}>{sem}</option>
                          ))}
                        </select>
                      </div>

                      {/* Step 4: المادة */}
                      <div className={`space-y-1.5 transition-all duration-300 ${bqFilterSemester === "all" ? "opacity-60" : ""}`}>
                        <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 justify-end">
                          <span className="text-xs font-black text-indigo-950">المادة</span>
                          <span className={`w-5 h-5 text-[10px] rounded-full flex items-center justify-center font-sans font-black transition-all duration-300 ${bqFilterSemester !== "all" && bqFilterSubject === "all" ? "bg-indigo-600 text-white ring-4 ring-indigo-100" : bqFilterSubject !== "all" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                            {bqFilterSubject === "all" ? "٤" : "✓"}
                          </span>
                        </label>
                        <select
                          value={bqFilterSubject}
                          onChange={(e) => {
                            setBqFilterSubject(e.target.value);
                            setBqFilterLessons([]);
                          }}
                          disabled={bqFilterGrade === "all"}
                          className={`w-full px-3 py-2 border text-xs font-bold rounded-xl focus:outline-none transition-all duration-300 ${
                            bqFilterSemester !== "all" && bqFilterSubject === "all"
                              ? "border-indigo-500 ring-2 ring-indigo-100 shadow-xs bg-white text-indigo-950" 
                              : bqFilterSubject !== "all"
                                ? "border-slate-200 bg-white text-slate-800 hover:border-slate-300" 
                                : "border-slate-200 text-slate-400 bg-slate-50"
                          }`}
                        >
                          <option value="all">الكل</option>
                          {subjectsForSelectedGrade.map((subj) => (
                            <option key={subj} value={subj}>{subj}</option>
                          ))}
                        </select>
                      </div>

                      {/* Step 5: Search Input */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-700 block text-right">البحث بالنص</label>
                        <div className="relative border border-slate-200 rounded-xl">
                          <input
                            type="text"
                            value={bqSearchQuery}
                            onChange={(e) => setBqSearchQuery(e.target.value)}
                            placeholder="ابحث بالنص..."
                            className="w-full pl-3 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                          />
                          <Search className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5" />
                        </div>
                      </div>
                    </div>

                    {/* Step 6: Units & Lessons Selector + Automatic Test Generation Button */}
                    <div className="space-y-3 pt-2">
                      <UnitLessonMultiSelect
                        questions={questionsForUnitSelect}
                        selected={bqFilterLessons}
                        onChange={setBqFilterLessons}
                        stepActive={bqFilterSemester !== "all" && bqFilterLessons.length === 0}
                        stepCompleted={bqFilterLessons.length > 0}
                        stepDisabled={bqFilterSemester === "all"}
                      />

                      {/* Auto Test Generation & Select All Filtered Actions */}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleSelectAllFilteredBankQuestions}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5"
                        >
                          <span>＋ تحديد كافة أسئلة الفلترة ({filteredBankQuestions.length})</span>
                        </button>
                        <button
                          type="button"
                          id="bank-question-selector-container"
                          onClick={handleOpenAutoModal}
                          className="px-5 py-2.5 bg-[#ffbe76] hover:bg-[#f0a85d] text-white rounded-2xl text-xs md:text-sm font-black transition-all duration-200 shadow-sm hover:shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-amber-200/80"
                        >
                          <Sparkles className="w-4 h-4 text-white animate-bounce" />
                          <span>✨ إنشاء اختبار تلقائي 🪄</span>
                        </button>
                      </div>
                    </div>

                    {/* Scrollable list of questions */}
                    <div className="border border-slate-150 rounded-xl bg-white max-h-[220px] overflow-y-auto divide-y divide-slate-100 mt-4">
                      {bankQuestions.length === 0 ? (
                        <p className="text-center text-[11px] text-slate-400 font-bold py-6">
                          بنك الأسئلة فارغ حالياً. يمكنك إضافة أسئلة إليه من قسم بنك الأسئلة.
                        </p>
                      ) : (
                        (() => {
                          const filtered = filteredBankQuestions;

                          if (filtered.length === 0) {
                            return (
                              <p className="text-center text-[11px] text-slate-400 font-bold py-6">
                                لا توجد أسئلة تطابق البحث ببنك الأسئلة.
                              </p>
                            );
                          }

                          return filtered.map(bq => {
                            const isSelected = selectedQuestions.some(sq => sq.id === bq.id);
                            return (
                              <div key={bq.id} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition">
                                <div className="space-y-1 min-w-0 text-right">
                                  <p className="text-[11px] font-extrabold text-slate-800 line-clamp-1">{bq.text}</p>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9px] font-black bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">
                                      {bq.subject}
                                    </span>
                                    {bq.grade && (
                                      <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                        {bq.grade}
                                      </span>
                                    )}
                                    <span className="text-[9px] font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                      {isTfQuestion(bq) ? "صح/خطأ" : "اختيار متعدد"}
                                    </span>
                                    <span className="text-[9px] font-black text-slate-400 font-sans">
                                      {bq.points} نقاط
                                    </span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => toggleQuestionSelection(bq)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition shrink-0 cursor-pointer ${
                                    isSelected
                                      ? "bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200"
                                      : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200"
                                  }`}
                                >
                                  {isSelected ? "✕ إزالة" : "＋ إضافة"}
                                </button>
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>
                  </div>
              </div>

              {/* STEP 2: Basic Information */}
              <div className="bg-slate-50/80 border border-slate-200/90 rounded-2xl p-5 md:p-6 space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center">٢</span>
                  <h4 className="text-xs md:text-sm font-black text-slate-800">البيانات الأساسية للتحدي والمادة 📝</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 block text-right">عنوان المراجعة (مثال: مراجعة الوحدة الأولى)</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="أدخل اسماً شيقاً للمراجعة..."
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 block text-right">المادة العلمية</label>
                    <input
                      type="text"
                      required
                      value={newSubject}
                      onChange={(e) => setNewSubject(e.target.value)}
                      placeholder="مثال: مهارات رقمية، كيمياء، اجتماعيات..."
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 block text-right">الصف المستهدف للتحفيز</label>
                    <select
                      value={newGrade}
                      onChange={(e) => setNewGrade(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="جميع الفصول (عام)">جميع الفصول (عام)</option>
                      {Object.values(GRADE_PRESETS).flat().map((grd) => (
                        <option key={grd} value={grd}>{grd}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 block text-right">الفصل الدراسي</label>
                    <select
                      value={newSemester}
                      onChange={(e) => setNewSemester(e.target.value)}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="عام">عام / كل الفصول</option>
                      {SEMESTER_PRESETS.map((sem) => (
                        <option key={sem} value={sem}>{sem}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:bg-slate-300 text-white rounded-xl text-xs sm:text-sm font-black transition duration-200 shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>{isSubmitting ? "جاري الحفظ والتفعيل..." : "حفظ وتفعيل اللعبة للطلاب فوراً ⚡🟢"}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

        {activeSubTab === "leaderboard" && (
          <motion.div
            key="leaderboard-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Control line for scores */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-center gap-2.5">
                <button
                  onClick={() => setActiveSubTab("list")}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition cursor-pointer"
                  title="رجوع"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-extrabold text-[#1e3a8a] block">شاشة العرض الكبرى بالمعمل 🖥️</span>
                  <select
                    value={selectedChallengeId}
                    onChange={(e) => setSelectedChallengeId(e.target.value)}
                    className="font-black text-slate-900 bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-base cursor-pointer"
                  >
                    <option value="">-- اختر مراجعة لعرض نتائجها --</option>
                    {reviewChallenges.map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedChallengeId && (
                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                  <div className="flex items-center gap-1 shrink-0">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-500">فصل التنافس:</span>
                  </div>
                  <select
                    value={selectedClassGroupFilter}
                    onChange={(e) => setSelectedClassGroupFilter(e.target.value)}
                    className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="all">كل الفصول المتواجدة في المعمل 🌍</option>
                    {getAvailableClassGroups().map(cl => (
                      <option key={cl} value={cl}>{cl}</option>
                    ))}
                  </select>

                </div>
              )}
            </div>

            {/* Scoreboard Render Area */}
            {!selectedChallengeId ? (
              <div className="bg-white rounded-3xl p-12 border border-slate-200 text-center text-slate-400 text-xs font-bold">
                يرجى تحديد تحدي مراجعة من القائمة بالأعلى لعرض المتصدرين له.
              </div>
            ) : (() => {
              const matchedFixedGame = FIXED_GAMES.find(fg => fg.id === selectedChallengeId || fg.gameType === selectedChallengeId);
              const activeChallenge = reviewChallenges.find(c => c.id === selectedChallengeId) ||
                reviewChallenges.find(c => c.gameType === selectedChallengeId) ||
                reviewChallenges.find(c => matchedFixedGame && (c.gameType === matchedFixedGame.gameType || c.id === matchedFixedGame.id)) ||
                (matchedFixedGame ? {
                  id: matchedFixedGame.id,
                  title: matchedFixedGame.title,
                  subject: "عام",
                  grade: "الكل",
                  gameType: matchedFixedGame.gameType,
                  status: "active",
                  questions: [],
                  liveState: "waiting"
                } as ReviewChallenge : undefined);

              const gameTitleName = activeChallenge?.gameType === "wayground_arena"
                ? "كاهوت (KAHOOT) 🎪"
                : activeChallenge?.gameType === "space_invaders"
                ? "معركة الفضاء 🚀"
                : activeChallenge?.gameType === "car_racing"
                ? "سباق السيارات 🏎️"
                : FIXED_GAMES.find(g => g.gameType === activeChallenge?.gameType)?.title || activeChallenge?.gameType || "لعبة مراجعة";

              return (
                <div className="space-y-6">
                  {/* Game Details Info Banner (اسم اللعبة - اسم الدرس - اسم التحدي) */}
                  {activeChallenge && (
                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 rounded-3xl p-5 border border-indigo-800/80 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                          <Trophy className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                        </div>
                        <div className="space-y-1.5 text-right">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-purple-500/30 text-purple-200 border border-purple-400/40">
                              🎮 اسم اللعبة: {gameTitleName}
                            </span>
                            <span className="px-3.5 py-1 rounded-full text-xs font-black bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                              📚 اسم الدرس / المادة: {activeChallenge.subject || "عام"}
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                            <span>🏆 اسم التحدي:</span>
                            <span className="text-amber-300">{activeChallenge.title}</span>
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-300 bg-white/10 px-3.5 py-2 rounded-2xl border border-white/10 shrink-0">
                          <span>الأسئلة: {activeChallenge.questions?.length || 0}</span>
                          <span>•</span>
                          <span>المشاركات: {getFilteredScores().length}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeChallenge?.gameType === 'wayground_arena' ? (
                    (() => {
                      // Compute live players sorted strictly by score & rank
                      const sortedLivePlayers = (() => {
                        const playerMap = new Map<string, {
                          studentId: string;
                          studentName: string;
                          gradeClass: string;
                          score: number;
                          correctCount: number;
                          totalCount: number;
                        }>();

                        // 1. Add all presence players
                        livePlayers.forEach((p) => {
                          const key = (p.studentId || p.studentName || "").toString();
                          if (!key) return;
                          playerMap.set(key, {
                            studentId: p.studentId || key,
                            studentName: p.studentName || "طالب",
                            gradeClass: p.gradeClass || "عام",
                            score: 0,
                            correctCount: 0,
                            totalCount: 0,
                          });
                        });

                        // 2. Overlay scores from reviewScores matching activeChallenge
                        const challengeScores = reviewScores.filter(s => s.challengeId === activeChallenge.id);
                        challengeScores.forEach((s) => {
                          const key = (s.studentId || s.studentName || "").toString();
                          if (!key) return;
                          const existing = playerMap.get(key);
                          if (existing) {
                            existing.score = Math.max(existing.score, s.score || 0);
                            existing.correctCount = s.correctCount || 0;
                            existing.totalCount = s.totalCount || 0;
                            if (s.gradeClass) existing.gradeClass = s.gradeClass;
                          } else {
                            playerMap.set(key, {
                              studentId: s.studentId || key,
                              studentName: s.studentName || "طالب",
                              gradeClass: s.gradeClass || "عام",
                              score: s.score || 0,
                              correctCount: s.correctCount || 0,
                              totalCount: s.totalCount || 0,
                            });
                          }
                        });

                        // 3. Sort by score descending, then correctCount descending
                        return Array.from(playerMap.values()).sort((a, b) => {
                          if (b.score !== a.score) return b.score - a.score;
                          if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
                          return a.studentName.localeCompare(b.studentName, "ar");
                        });
                      })();

                      return (
                        <div className="space-y-6">
                          {/* Live Arena Flow */}
                          {(!activeChallenge.liveState || activeChallenge.liveState === 'waiting') && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* Control Card */}
                              <div className="lg:col-span-1 bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 text-white text-center flex flex-col justify-center items-center relative overflow-hidden shadow-xl border border-indigo-950">
                                <div className="absolute top-0 left-0 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none" />
                                <Timer className="w-16 h-16 text-yellow-300 mb-4 animate-pulse" />
                                <h4 className="font-black text-base text-yellow-300">غرفة الانتظار والمواجهة 💻</h4>
                                <p className="text-[11px] text-slate-300 mt-2 max-w-xs mx-auto leading-relaxed">
                                  الطلاب يتدفقون الآن إلى صالة الانتظار المباشرة بالمعمل. بمجرد اكتمال دخول جميع الطلاب، اضغط على زر البدء أدناه لإطلاق التحدي الحماسي!
                                </p>
                                
                                <div className="w-full mt-6 space-y-3">
                                  <button
                                    onClick={() => handleStartLiveGame(activeChallenge.id)}
                                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-sm font-black transition-all duration-300 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer animate-bounce"
                                  >
                                    <Play className="w-5 h-5 text-white" />
                                    <span>ابدأ المواجهة للطلاب الآن 🚀</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      triggerConfirm(
                                        "إخراج جميع الطلاب والبدء من جديد؟",
                                        "سيتم مسح حضور كافة الطلاب الحاضرين في صالة الانتظار وتصفير نقاط هذا التحدي للبدء من جديد بالكامل. هل تود الاستمرار؟",
                                        () => handleKickAllAndReset(activeChallenge.id)
                                      );
                                    }}
                                    className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <UserMinus className="w-4 h-4 text-rose-300" />
                                    <span>إخراج الجميع والبدء من جديد 🔄</span>
                                  </button>
                                </div>
                              </div>

                              {/* Joined Players Grid */}
                              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100 flex-wrap gap-2">
                                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-indigo-600 animate-pulse" />
                                    <span>الطلاب المتواجدون بساحة الانتظار ({sortedLivePlayers.length})</span>
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md flex items-center gap-1">
                                      <Trophy className="w-3 h-3 text-amber-500 fill-amber-500" />
                                      <span>مرتبون حسب الترتيب والنقاط 🏆</span>
                                    </span>
                                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md animate-pulse">
                                      في انتظار بدء المعلم ⏳
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto p-1">
                                  <AnimatePresence>
                                    {sortedLivePlayers.map((player, rankIdx) => {
                                      const isTop1 = rankIdx === 0 && player.score > 0;
                                      const isTop2 = rankIdx === 1 && player.score > 0;
                                      const isTop3 = rankIdx === 2 && player.score > 0;

                                      return (
                                        <motion.div
                                          key={player.studentId}
                                          initial={{ opacity: 0, scale: 0.7, y: 15 }}
                                          animate={{ 
                                            opacity: 1, 
                                            scale: 1,
                                            y: [0, -4, 0],
                                          }}
                                          exit={{ opacity: 0, scale: 0.7 }}
                                          transition={{
                                            y: {
                                              repeat: Infinity,
                                              repeatType: "reverse",
                                              duration: 2 + (Math.random() * 2),
                                              ease: "easeInOut"
                                            },
                                            scale: { duration: 0.3 }
                                          }}
                                          className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center shadow-xs transition duration-300 relative overflow-hidden ${
                                            isTop1
                                              ? "bg-gradient-to-br from-amber-500/15 via-yellow-400/20 to-amber-500/10 border-amber-400/90 ring-2 ring-amber-400/40 shadow-amber-200/50"
                                              : isTop2
                                              ? "bg-gradient-to-br from-slate-200/60 via-slate-100 to-slate-200/60 border-slate-300 ring-2 ring-slate-300/40"
                                              : isTop3
                                              ? "bg-gradient-to-br from-amber-800/10 via-amber-700/15 to-amber-800/10 border-amber-600/40 ring-2 ring-amber-600/30"
                                              : "bg-gradient-to-br from-indigo-50/80 to-purple-50/40 border-indigo-100 hover:border-indigo-300"
                                          }`}
                                        >
                                          {/* Rank Badge */}
                                          <div className={`absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[9px] font-black font-sans flex items-center gap-0.5 shadow-2xs ${
                                            isTop1
                                              ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 border border-amber-300"
                                              : isTop2
                                              ? "bg-slate-300 text-slate-950 border border-slate-200"
                                              : isTop3
                                              ? "bg-amber-700 text-white border border-amber-600"
                                              : "bg-indigo-100 text-indigo-900 border border-indigo-200"
                                          }`}>
                                            <span>{isTop1 ? "🥇 المركز 1" : isTop2 ? "🥈 المركز 2" : isTop3 ? "🥉 المركز 3" : `#${rankIdx + 1}`}</span>
                                          </div>

                                          {/* Avatar Circle */}
                                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm mb-1.5 shadow-md mt-3 ${
                                            isTop1
                                              ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 border-2 border-amber-300 ring-2 ring-amber-400/50"
                                              : isTop2
                                              ? "bg-slate-300 text-slate-950 border-2 border-slate-200"
                                              : isTop3
                                              ? "bg-amber-700 text-white border-2 border-amber-600"
                                              : "bg-indigo-600 text-white"
                                          }`}>
                                            {player.studentName.charAt(0)}
                                          </div>

                                          {/* Student Name */}
                                          <span className="text-xs font-black text-slate-900 block truncate max-w-[110px]">
                                            {player.studentName}
                                          </span>

                                          {/* Score & Class Tag */}
                                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap justify-center">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black font-sans shadow-2xs ${
                                              isTop1
                                                ? "bg-amber-500 text-slate-950 font-black"
                                                : player.score > 0
                                                ? "bg-emerald-600 text-white font-black"
                                                : "bg-indigo-600 text-white font-black"
                                            }`}>
                                              {player.score || 0} ن
                                            </span>
                                            <span className="text-[9px] text-slate-500 font-bold bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
                                              {player.gradeClass || "عام"}
                                            </span>
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </AnimatePresence>

                                  {sortedLivePlayers.length === 0 && (
                                    <div className="col-span-full py-16 text-center text-slate-400 text-xs font-bold space-y-2">
                                      <Gamepad2 className="w-12 h-12 text-slate-300 mx-auto animate-bounce" />
                                      <p className="text-slate-500">في انتظار انضمام الطلاب الأبطال...</p>
                                      <p className="text-[10px] text-indigo-600 font-bold">اطلب من الطلاب فتح صفحة "التحديات والألعاب المباشرة" والدخول للتحدي!</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {activeChallenge.liveState === 'playing' && (
                            <div className="space-y-6">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Game Running Controls */}
                                <div className="lg:col-span-1 bg-gradient-to-br from-amber-950 to-slate-950 rounded-3xl p-6 text-white text-center flex flex-col justify-center items-center relative overflow-hidden shadow-xl border border-amber-900">
                                  <div className="absolute top-0 left-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                                  <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center mb-4 animate-spin text-amber-400">
                                    <Zap className="w-8 h-8 fill-amber-400" />
                                  </div>
                                  <h4 className="font-black text-base text-amber-400">التحدي مستمر حالياً ⚡</h4>
                                  <p className="text-[11px] text-slate-300 mt-2 max-w-xs mx-auto leading-relaxed">
                                    الطلاب يجاوبون على الأسئلة الحماسية الآن في صالة المعمل! تظهر نتائجهم وترتيبهم فاعلاً ومحدثاً بساحة المنافسة اللحظية.
                                  </p>
                                  
                                  <div className="w-full mt-6 space-y-3">
                                    <button
                                      onClick={() => handleEndLiveGame(activeChallenge.id)}
                                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-500 to-amber-600 hover:from-red-600 hover:to-amber-700 text-white text-sm font-black transition-all duration-300 shadow-lg shadow-red-500/20 flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                      <Square className="w-5 h-5 text-white" />
                                      <span>إنهاء التحدي وتتويج الأبطال 🏆</span>
                                    </button>
                                    <button
                                      onClick={() => handleResetLiveGame(activeChallenge.id)}
                                      className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-slate-300 text-xs font-extrabold transition cursor-pointer"
                                    >
                                      إعادة تعيين اللعبة 🔄
                                    </button>
                                    <button
                                      onClick={() => {
                                        triggerConfirm(
                                          "إخراج جميع الطلاب والبدء من جديد؟",
                                          "سيتم مسح حضور كافة الطلاب الحاضرين وتصفير نقاط هذا التحدي بالكامل والعودة للانتظار. هل تود الاستمرار؟",
                                          () => handleKickAllAndReset(activeChallenge.id)
                                        );
                                      }}
                                      className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                      <UserMinus className="w-4 h-4 text-rose-300" />
                                      <span>إخراج الجميع والبدء من جديد 🔄</span>
                                    </button>
                                  </div>
                                </div>

                                {/* Live Leaderboard */}
                                <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
                                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                                    <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                                      <Award className="w-4 h-4 text-indigo-600" />
                                      <span>قائمة الصدارة الحية ({getFilteredScores().length})</span>
                                    </h4>
                                    <span className="text-[10px] font-black text-indigo-650 bg-indigo-50 px-2 py-1 rounded-md animate-pulse">
                                      تحديث فوري نشط ⚡
                                    </span>
                                  </div>

                                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    {getFilteredScores().map((score, index) => (
                                      <motion.div
                                        key={score.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-150 rounded-2xl transition hover:bg-indigo-50/20"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className={`w-7 h-7 font-sans font-black text-xs flex items-center justify-center rounded-lg ${
                                            index === 0 ? "bg-yellow-400 text-slate-950" : index === 1 ? "bg-slate-300 text-slate-950" : index === 2 ? "bg-amber-600 text-white" : "bg-white border border-slate-200"
                                          }`}>
                                            {index + 1}
                                          </div>
                                          <div>
                                            <span className="text-xs font-black text-slate-900 block">
                                              {score.studentName}
                                            </span>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold font-sans">
                                              <span>{score.gradeClass}</span>
                                              <span>•</span>
                                              <span>أجاب {score.correctCount} / {score.totalCount}</span>
                                              <span>•</span>
                                              <span>الوقت: {score.timeSpentSeconds} ث</span>
                                            </div>
                                          </div>
                                        </div>
                                        <span className="text-sm font-black text-indigo-700 font-sans">
                                          {score.score} ن
                                        </span>
                                      </motion.div>
                                    ))}

                                    {getFilteredScores().length === 0 && (
                                      <div className="py-16 text-center text-xs text-slate-400 font-bold space-y-2">
                                        <p>المنافسة جارية حالياً! لم يقم أي بطل بإنهاء التحدي بعد.</p>
                                        <p className="text-[10px] text-indigo-600 animate-pulse font-bold">
                                          بمجرد إنهاء الإجابة، ستتألق أسماؤهم على اللوحة! ✨
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Joined Players Grid during active play as well */}
                              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                                <div className="flex justify-between items-center pb-3 border-b border-slate-100 flex-wrap gap-2">
                                  <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-indigo-600 animate-pulse" />
                                    <span>ساحة بطاقات الطلاب والمواجهة ({sortedLivePlayers.length})</span>
                                  </h4>
                                  <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md flex items-center gap-1">
                                    <Trophy className="w-3 h-3 text-amber-500 fill-amber-500" />
                                    <span>مرتبون حسب الترتيب والنقاط 🏆</span>
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[350px] overflow-y-auto p-1">
                                  <AnimatePresence>
                                    {sortedLivePlayers.map((player, rankIdx) => {
                                      const isTop1 = rankIdx === 0 && player.score > 0;
                                      const isTop2 = rankIdx === 1 && player.score > 0;
                                      const isTop3 = rankIdx === 2 && player.score > 0;

                                      return (
                                        <motion.div
                                          key={player.studentId}
                                          initial={{ opacity: 0, scale: 0.7 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.7 }}
                                          className={`p-3 rounded-2xl border flex flex-col items-center justify-center text-center shadow-xs transition duration-300 relative overflow-hidden ${
                                            isTop1
                                              ? "bg-gradient-to-br from-amber-500/15 via-yellow-400/20 to-amber-500/10 border-amber-400/90 ring-2 ring-amber-400/40 shadow-amber-200/50"
                                              : isTop2
                                              ? "bg-gradient-to-br from-slate-200/60 via-slate-100 to-slate-200/60 border-slate-300 ring-2 ring-slate-300/40"
                                              : isTop3
                                              ? "bg-gradient-to-br from-amber-800/10 via-amber-700/15 to-amber-800/10 border-amber-600/40 ring-2 ring-amber-600/30"
                                              : "bg-gradient-to-br from-indigo-50/80 to-purple-50/40 border-indigo-100 hover:border-indigo-300"
                                          }`}
                                        >
                                          <div className={`absolute top-1.5 right-1.5 px-2 py-0.5 rounded-full text-[9px] font-black font-sans flex items-center gap-0.5 shadow-2xs ${
                                            isTop1
                                              ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 border border-amber-300"
                                              : isTop2
                                              ? "bg-slate-300 text-slate-950 border border-slate-200"
                                              : isTop3
                                              ? "bg-amber-700 text-white border border-amber-600"
                                              : "bg-indigo-100 text-indigo-900 border border-indigo-200"
                                          }`}>
                                            <span>{isTop1 ? "🥇 1" : isTop2 ? "🥈 2" : isTop3 ? "🥉 3" : `#${rankIdx + 1}`}</span>
                                          </div>

                                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs mb-1 shadow-md mt-3 ${
                                            isTop1
                                              ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 border-2 border-amber-300"
                                              : isTop2
                                              ? "bg-slate-300 text-slate-950 border-2 border-slate-200"
                                              : isTop3
                                              ? "bg-amber-700 text-white border-2 border-amber-600"
                                              : "bg-indigo-600 text-white"
                                          }`}>
                                            {player.studentName.charAt(0)}
                                          </div>

                                          <span className="text-xs font-black text-slate-900 block truncate max-w-[100px]">
                                            {player.studentName}
                                          </span>

                                          <div className="flex items-center gap-1 mt-1 flex-wrap justify-center">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black font-sans shadow-2xs ${
                                              isTop1
                                                ? "bg-amber-500 text-slate-950 font-black"
                                                : player.score > 0
                                                ? "bg-emerald-600 text-white font-black"
                                                : "bg-indigo-600 text-white font-black"
                                            }`}>
                                              {player.score || 0} ن
                                            </span>
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </AnimatePresence>
                                </div>
                              </div>
                            </div>
                          )}
                          {activeChallenge.liveState === 'podium' && (
                            <div className="w-full">
                              <LivePodiumView
                                scores={getFilteredScores()}
                                isAdmin={true}
                                onReset={() => handleResetLiveGame(activeChallenge.id)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    /* Normal non-arena flow */
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Top 3 Visual Podiums */}
                  <div className="lg:col-span-1 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white text-center flex flex-col justify-center items-center relative overflow-hidden shadow-xl border border-indigo-900">
                    <div className="absolute top-0 left-0 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none" />
                    <Trophy className="w-16 h-16 text-yellow-400 mb-4 animate-bounce" />
                    <h4 className="font-black text-base text-yellow-400">ملوك منصة التتويج 👑</h4>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                      يتنافس الطلاب الآن على أعلى الدرجات والسرعة في الإجابة لكسب نقاط إضافية وتصدر القائمة.
                    </p>

                    {/* High Scores summary */}
                    <div className="w-full mt-6 space-y-2 text-right font-sans">
                      {getFilteredScores().slice(0, 3).map((item, idx) => (
                        <div
                          key={item.id}
                          className={`p-3 rounded-2xl flex items-center justify-between gap-2 border bg-white/5 border-white/10 ${
                            idx === 0 ? "border-yellow-500/40 bg-yellow-500/5" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-xs ${
                              idx === 0 ? "bg-yellow-400 text-slate-950" : idx === 1 ? "bg-slate-300 text-slate-900" : "bg-amber-600 text-white"
                            }`}>
                              {idx + 1}
                            </span>
                            <div className="text-right">
                              <span className="font-extrabold text-xs block text-white font-sans">{item.studentName}</span>
                              <span className="text-[9px] text-slate-400 block font-bold">{item.gradeClass}</span>
                            </div>
                          </div>
                          <div className="text-left font-sans text-yellow-400 font-black text-xs">
                            {item.score} ن
                          </div>
                        </div>
                      ))}
                      {getFilteredScores().length === 0 && (
                        <p className="text-center text-[11px] text-slate-400 font-bold py-4">في انتظار أول المتحدين للبدء...</p>
                      )}
                    </div>
                  </div>

                  {/* Scoreboard List */}
                  <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-5 shadow-xs space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100 flex-wrap gap-2">
                      <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-indigo-600" />
                        ترتيب الطلاب المشاركين ({getFilteredScores().length})
                      </h4>
                      <span className="text-[10px] font-black text-indigo-650 bg-indigo-50 px-2 py-1 rounded-md">
                        تحديث تلقائي فوري ⚡
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {getFilteredScores().map((score, index) => {
                        return (
                          <div
                            key={score.id}
                            className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-150 rounded-2xl transition hover:bg-indigo-50/20"
                          >
                            <div className="flex items-center gap-3">
                              {/* Rank Indicator */}
                              <div className="w-7 h-7 font-sans font-black text-xs flex items-center justify-center rounded-lg bg-white border border-slate-200">
                                {index + 1}
                              </div>
                              
                              <div>
                                <span className="text-xs font-black text-slate-900 block">
                                  {score.studentName}
                                </span>
                                <div className="text-[10px] text-slate-400 font-bold font-sans">
                                  <span>{score.gradeClass}</span>
                                  <span>•</span>
                                  <span>الوقت: {score.timeSpentSeconds} ثانية</span>
                                  <span>•</span>
                                  <span>أجاب {score.correctCount} / {score.totalCount} صحيح</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 font-sans">
                              <div className="text-left">
                                <span className="text-sm font-black text-indigo-700 block text-left">
                                  {score.score}
                                </span>
                                <span className="text-[9px] text-slate-400 block font-black">
                                  نقطة كسبها
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {getFilteredScores().length === 0 && (
                        <div className="py-12 text-center text-xs text-slate-400 font-bold space-y-2">
                          <p>لم يقم أي طالب بإنهاء هذا التحدي بعد.</p>
                          <p className="text-[10px] text-indigo-600 font-black">
                            وجه الطلاب لتسجيل الدخول إلى بوابتهم وفتح التحدي والبدء فوراً!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
            })()}
          </motion.div>
        )}


      </AnimatePresence>

      {/* Fullscreen Big Classroom Scoreboard Overlay Modal */}
      <AnimatePresence>
        {isFullscreenScoreboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-slate-950 text-white flex flex-col p-6 md:p-12 overflow-y-auto"
            dir="rtl"
          >
            {/* Header row */}
            <div className="flex justify-between items-center pb-5 border-b border-white/10">
              <div className="space-y-1">
                <span className="text-[10px] font-black tracking-wider text-yellow-400 block bg-yellow-450/10 px-2.5 py-0.5 rounded border border-yellow-400/20 w-fit">
                  تحدي معمل الحاسوب المباشر 💻
                </span>
                <h2 className="text-xl md:text-2xl font-black text-white">
                  المتصدرين: {reviewChallenges.find(c => c.id === selectedChallengeId)?.title}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right text-[11px] font-black text-indigo-300 bg-indigo-900/40 border border-indigo-800/50 px-3.5 py-1.5 rounded-xl">
                  {selectedClassGroupFilter === "all" ? "جميع الطلاب بالمعمل" : `الفصل: ${selectedClassGroupFilter}`}
                </div>

                <button
                  onClick={() => handleOpenFullscreenNewTab(selectedChallengeId)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-400 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="فتح هذه الشاشة بملء الشاشة في تبويب جديد متصفح آخر"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-yellow-300" />
                  <span>فتح في تبويب جديد ↗</span>
                </button>

                <button
                  onClick={() => setIsFullscreenScoreboard(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/25 border border-white/20 text-white rounded-xl text-xs font-black transition cursor-pointer"
                >
                  إغلاق ملء الشاشة ✕
                </button>
              </div>
            </div>

            {/* Huge list of top students */}
            <div className="max-w-4xl w-full mx-auto mt-8 flex-1 space-y-4">
              {(() => {
                const activeChallenge = reviewChallenges.find(c => c.id === selectedChallengeId);
                if (activeChallenge?.gameType === "wayground_arena") {
                  return (
                    <div className="space-y-6">
                      {/* Waiting Lobby */}
                      {(!activeChallenge.liveState || activeChallenge.liveState === "waiting") && (
                        <div className="space-y-8">
                          <div className="p-8 rounded-3xl bg-indigo-950/40 border border-indigo-900/60 text-center max-w-2xl mx-auto space-y-4">
                            <Users className="w-16 h-16 text-indigo-400 mx-auto animate-bounce" />
                            <h3 className="text-2xl font-black text-white">صالة انتظار الأبطال المباشرة 💻</h3>
                            <p className="text-sm text-slate-300 leading-relaxed">
                              أهلاً بكم يا أبطال في المواجهة الحاسمة اليوم! الرجاء الدخول للتحدي من أجهزتكم فوراً لتنضموا لساحة الانتظار، وبمجرد اكتمال دخول الجميع سيطلق المعلم شارة البدء!
                            </p>
                            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-black animate-pulse">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                              <span>في انتظار شارة بدء التحدي من المعلم... ⏳</span>
                            </div>
                          </div>

                          <div className="bg-slate-900/40 rounded-3xl border border-white/5 p-8 space-y-6">
                            <div className="flex justify-between items-center pb-4 border-b border-white/10">
                              <h4 className="font-black text-base text-indigo-300 flex items-center gap-2">
                                <Gamepad2 className="w-5 h-5 text-indigo-400" />
                                <span>الفرسان المنضمون بساحة الانتظار المباشرة ({livePlayers.length})</span>
                              </h4>
                              <span className="text-xs font-black text-yellow-400">بث حي فوري للمعمل ⚡</span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                              <AnimatePresence>
                                {livePlayers.map((player) => (
                                  <motion.div
                                    key={player.studentId}
                                    initial={{ opacity: 0, scale: 0.7, y: 15 }}
                                    animate={{ 
                                      opacity: 1, 
                                      scale: 1, 
                                      y: [0, -6, 0],
                                      x: [0, 4, 0]
                                    }}
                                    exit={{ opacity: 0, scale: 0.7 }}
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
                                    className="p-5 rounded-2xl bg-indigo-900/20 border border-indigo-800/40 flex flex-col items-center justify-center text-center shadow-lg hover:border-indigo-50/40 transition duration-300"
                                  >
                                    <div className="w-11 h-11 rounded-full bg-indigo-600 text-white flex items-center justify-center font-black text-sm mb-2 shadow-md">
                                      {player.studentName.charAt(0)}
                                    </div>
                                    <span className="text-xs font-black text-white block truncate max-w-[120px]">
                                      {player.studentName}
                                    </span>
                                    <span className="text-[10px] text-indigo-300 font-bold mt-0.5">
                                      {player.gradeClass || "عام"}
                                    </span>
                                  </motion.div>
                                ))}
                              </AnimatePresence>

                              {livePlayers.length === 0 && (
                                <div className="col-span-full py-24 text-center text-slate-500 text-sm font-bold space-y-3">
                                  <Gamepad2 className="w-16 h-16 text-slate-600 mx-auto animate-bounce" />
                                  <p className="text-slate-400">في انتظار انضمام الفرسان... افتحوا بوابتكم وابدأوا فوراً! ⚡</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Playing Screen (Lobby names hidden, only real-time leaderboard shown) */}
                      {activeChallenge.liveState === "playing" && (
                        <div className="space-y-6">
                          <div className="p-6 rounded-3xl bg-amber-950/20 border border-amber-900/30 text-center max-w-2xl mx-auto space-y-2">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-black animate-pulse">
                              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                              <span>المعركة جارية ومشتعلة حالياً! 🔥</span>
                            </div>
                            <p className="text-xs text-slate-300">
                              تم إخفاء أسماء ساحة الانتظار للتركيز الكامل... الفرسان يتنافسون الآن على الصدارة المباشرة أدناه!
                            </p>
                          </div>

                          <div className="bg-slate-900/40 rounded-3xl border border-white/5 p-6 space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-white/10">
                              <h4 className="font-black text-base text-indigo-400 flex items-center gap-1.5">
                                <Award className="w-5 h-5 text-indigo-500" />
                                <span>قائمة الصدارة المباشرة للمعمل ({getFilteredScores().length})</span>
                              </h4>
                              <span className="text-[10px] font-black text-yellow-400 bg-yellow-500/10 px-3 py-1 rounded border border-yellow-500/20">تحديث فوري ⚡</span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                              {getFilteredScores().map((score, index) => (
                                <motion.div
                                  key={score.id}
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className={`flex items-center justify-between p-4 rounded-2xl border ${
                                    index === 0 
                                      ? "bg-yellow-500/15 border-yellow-500/30 text-white" 
                                      : index === 1
                                        ? "bg-slate-800/60 border-slate-600/30 text-white"
                                        : index === 2
                                          ? "bg-amber-900/20 border-amber-800/30 text-white"
                                          : "bg-slate-950/40 border-white/5 text-white"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-sans font-black text-xs ${
                                      index === 0 ? "bg-yellow-400 text-slate-950" : index === 1 ? "bg-slate-300 text-slate-950" : index === 2 ? "bg-amber-600 text-white" : "bg-slate-850 border border-white/10"
                                    }`}>
                                      {index + 1}
                                    </span>
                                    <div>
                                      <span className="text-xs font-black block">{score.studentName}</span>
                                      <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{score.gradeClass}</span>
                                    </div>
                                  </div>
                                  <span className="text-sm font-black text-yellow-400 font-sans">{score.score} ن</span>
                                </motion.div>
                              ))}

                              {getFilteredScores().length === 0 && (
                                <div className="col-span-full py-24 text-center text-slate-500 text-sm font-bold">
                                  الطلاب يجيبون حالياً... في انتظار صعود البطل الأول لعرش اللوحة! ✨
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Podium Screen */}
                      {activeChallenge.liveState === "podium" && (
                        <div className="w-full">
                          <LivePodiumView
                            scores={getFilteredScores()}
                            isAdmin={true}
                            onReset={() => handleResetLiveGame(activeChallenge.id)}
                          />
                        </div>
                      )}
                    </div>
                  );
                }

                // Normal challenge non-arena flow
                return (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Big Podium for top 1 */}
                    <div className="md:col-span-4 bg-gradient-to-b from-yellow-500/20 via-slate-900 to-slate-950 border border-yellow-500/30 rounded-3xl p-6 text-center flex flex-col items-center justify-center space-y-3 relative overflow-hidden shadow-2xl">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl pointer-events-none" />
                      <Trophy className="w-16 h-16 text-yellow-400 animate-bounce" />
                      <span className="text-[10px] font-black tracking-widest text-yellow-400 block">البطل المتصدر 👑</span>
                      <h3 className="text-xl font-black text-white">{getFilteredScores()[0]?.studentName}</h3>
                      <span className="text-xs text-slate-300 font-bold">{getFilteredScores()[0]?.gradeClass}</span>
                      <div className="text-2xl font-black text-yellow-400 font-sans mt-3">
                        {getFilteredScores()[0]?.score} <span className="text-xs font-bold text-slate-300">نقطة</span>
                      </div>
                    </div>

                    {/* Rest of students in high contrast big rows */}
                    <div className="md:col-span-8 space-y-2.5">
                      {getFilteredScores().slice(0, 8).map((score, index) => {
                        return (
                          <div
                            key={score.id}
                            className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 ${
                              index === 0 
                                ? "bg-yellow-500/10 border-yellow-500/30 text-white shadow-lg" 
                                : index === 1
                                  ? "bg-slate-800/60 border-slate-600/30 text-white"
                                  : index === 2
                                    ? "bg-amber-900/20 border-amber-800/30 text-white"
                                    : "bg-slate-900/40 border-slate-800/30 text-white hover:bg-slate-800/40"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center font-sans font-black text-xs ${
                                index === 0 ? "bg-yellow-400 text-slate-950" : index === 1 ? "bg-slate-300 text-slate-950" : index === 2 ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300"
                              }`}>
                                {index + 1}
                              </span>
                              <div>
                                <span className="text-sm font-black block">
                                  {score.studentName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold block">
                                  {score.gradeClass} • أجاب {score.correctCount} / {score.totalCount} صحيح • الوقت: {score.timeSpentSeconds} ث
                                </span>
                              </div>
                            </div>

                            <span className="text-base font-black text-yellow-400 font-sans">
                              {score.score} ن
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto Test Generator Modal */}
      <AnimatePresence>
        {isAutoModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[32px] p-6 md:p-8 max-w-lg w-full shadow-2xl border border-slate-100 space-y-6 relative overflow-hidden text-right"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center shrink-0">
                    <Sparkles className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      توليد اختبار تلقائي ذكي
                    </h3>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">
                      إنشاء اختبار مخصص من الأسئلة المتوفرة في الفلترة الحالية.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAutoModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xs px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>

              {/* Selected Classification Box */}
              {(() => {
                const mcqs = filteredBankQuestions.filter(q => !isTfQuestion(q));
                const tfs = filteredBankQuestions.filter(q => isTfQuestion(q));

                return (
                  <>
                    <div className="bg-slate-50/90 border border-slate-150 rounded-2xl p-4 space-y-2.5">
                      <span className="text-[11px] font-bold text-slate-400 block">
                        التصنيف الحالي المختار:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {bqFilterStage !== "all" && (
                          <span className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 text-xs font-black border border-purple-100/60">
                            {bqFilterStage}
                          </span>
                        )}
                        {bqFilterGrade !== "all" && (
                          <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-100/60">
                            {bqFilterGrade}
                          </span>
                        )}
                        {bqFilterSubject !== "all" && (
                          <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 text-xs font-black border border-blue-100/60">
                            {bqFilterSubject}
                          </span>
                        )}
                        {bqFilterSemester !== "all" && (
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-100/60">
                            {bqFilterSemester}
                          </span>
                        )}
                        <span className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-700 text-xs font-black border border-amber-100/60">
                          {bqFilterLessons.length > 0 ? `${bqFilterLessons.length} دروس محددة` : "جميع الدروس"}
                        </span>
                      </div>
                    </div>

                    {/* MCQ Question Slider */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs md:text-sm font-black text-slate-800">
                          أسئلة الاختيار من متعدد (MCQ)
                        </span>
                        <span className="px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 text-[11px] font-black">
                          المتاح: {mcqs.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setAutoMcqCount(c => Math.max(0, c - 1))}
                          className="w-9 h-9 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base cursor-pointer shrink-0"
                        >
                          -
                        </button>
                        <div className="w-14 h-9 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs text-slate-800 flex items-center justify-center shrink-0">
                          {autoMcqCount}
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={mcqs.length}
                          value={autoMcqCount}
                          onChange={(e) => setAutoMcqCount(Number(e.target.value))}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none accent-indigo-600 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => setAutoMcqCount(c => Math.min(mcqs.length, c + 1))}
                          className="w-9 h-9 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base cursor-pointer shrink-0"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* T/F Question Slider */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs md:text-sm font-black text-slate-800">
                          أسئلة الصواب والخطأ (T/F)
                        </span>
                        <span className="px-3 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 text-[11px] font-black">
                          المتاح: {tfs.length}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setAutoTfCount(c => Math.max(0, c - 1))}
                          className="w-9 h-9 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base cursor-pointer shrink-0"
                        >
                          -
                        </button>
                        <div className="w-14 h-9 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs text-slate-800 flex items-center justify-center shrink-0">
                          {autoTfCount}
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={tfs.length}
                          value={autoTfCount}
                          onChange={(e) => setAutoTfCount(Number(e.target.value))}
                          className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none accent-indigo-600 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => setAutoTfCount(c => Math.min(tfs.length, c + 1))}
                          className="w-9 h-9 border border-slate-200 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 flex items-center justify-center text-base cursor-pointer shrink-0"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Total Badge Container */}
                    <div className="bg-indigo-50/70 border border-indigo-100/80 rounded-2xl p-4 flex items-center justify-between">
                      <span className="text-xs md:text-sm font-black text-indigo-950">
                        مجموع الأسئلة المختارة للاختبار
                      </span>
                      <span className="px-4 py-2 bg-indigo-600 text-white font-black text-xs rounded-2xl shadow-sm">
                        {autoMcqCount + autoTfCount} أسئلة
                      </span>
                    </div>

                    {/* Modal Action Footer */}
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleGenerateAutoTest}
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs shadow-md shadow-indigo-200 transition hover:scale-[1.02] active:scale-95 cursor-pointer flex items-center gap-2"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-white" />
                        )}
                        <span>{isSubmitting ? "جاري التوليد..." : "توليد الأسئلة وحفظها ✨"}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setIsAutoModalOpen(false)}
                        className="px-6 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-2xl font-black text-xs transition cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
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
                    <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-300/40 shadow-xs shrink-0">
                      <Trophy className="w-6 h-6 text-amber-500 fill-amber-500" />
                    </span>
                    <div className="space-y-1 text-right">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-900 border border-purple-200">
                          🎮 اللعبة: {
                            targetChallenge?.gameType === "wayground_arena" || fixedGameMeta.gameType === "wayground_arena"
                              ? "كاهوت (KAHOOT) 🎪"
                              : targetChallenge?.gameType === "space_invaders" || fixedGameMeta.gameType === "space_invaders"
                              ? "معركة الفضاء 🚀"
                              : targetChallenge?.gameType === "car_racing" || fixedGameMeta.gameType === "car_racing"
                              ? "سباق السيارات 🏎️"
                              : fixedGameMeta.title
                          }
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-900 border border-emerald-200">
                          📚 الدرس / المادة: {targetChallenge?.subject || "عام"}
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-1.5">
                        <span className="text-slate-600">🏆 التحدي:</span>
                        <span className="text-indigo-900">{targetChallenge?.title || fixedGameMeta.title}</span>
                      </h3>
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
                        leaderboardList.map((scoreItem, idx) => (
                          <div
                            key={scoreItem.id || idx}
                            className={`p-3 rounded-2xl text-xs flex items-center justify-between gap-3 border font-sans transition ${
                              idx === 0
                                ? "bg-amber-50/80 border-amber-300 text-slate-950 font-black shadow-xs ring-2 ring-amber-200/50"
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
                                  {scoreItem.studentName}
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
                        ))
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

                    {/* Controls buttons */}
                    <div className="space-y-2.5 w-full pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (gameDocId) handleEndLiveGame(gameDocId);
                        }}
                        className="w-full py-3.5 px-4 bg-gradient-to-r from-orange-500 via-rose-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-orange-950/50 hover:scale-[1.01] active:scale-95"
                      >
                        <Trophy className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                        <span>إنهاء التحدي وتتويج الأبطال 🏆</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (gameDocId) handleResetLiveGame(gameDocId);
                        }}
                        className="w-full py-3 px-4 bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded-2xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                      >
                        <RotateCcw className="w-4 h-4 text-slate-400" />
                        <span>إعادة تعيين اللعبة 🔄</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (gameDocId) handleKickAllAndReset(gameDocId);
                        }}
                        className="w-full py-3 px-4 bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 border border-rose-800/60 rounded-2xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                      >
                        <UserX className="w-4 h-4 text-rose-400" />
                        <span>إخراج الجميع والبدء من جديد 🔄</span>
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
