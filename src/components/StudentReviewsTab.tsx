import React, { useState, useEffect, useRef } from "react";

const RetroRocketGraphic = ({ className = "w-12 h-20" }: { className?: string }) => (
  <svg viewBox="0 0 120 180" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Left Red Fin */}
    <path d="M 32 95 L 8 118 C 6 120 6 132 12 138 L 16 142 L 34 128 Z" fill="#EF4444" stroke="#B91C1C" strokeWidth="2.5" strokeLinejoin="round" />
    
    {/* Right Red Fin */}
    <path d="M 88 95 L 112 118 C 114 120 114 132 108 138 L 104 142 L 86 128 Z" fill="#EF4444" stroke="#B91C1C" strokeWidth="2.5" strokeLinejoin="round" />
    
    {/* Cream Rocket Fuselage Body */}
    <path d="M 60 10 C 35 55 30 90 30 132 L 90 132 C 90 90 85 55 60 10 Z" fill="#FFFBEB" stroke="#D1D5DB" strokeWidth="2.5" />
    
    {/* Red Nose Cap */}
    <path d="M 60 10 C 47 38 41 58 39 68 L 81 68 C 79 58 73 38 60 10 Z" fill="#EF4444" stroke="#B91C1C" strokeWidth="1.5" />
    
    {/* Blue Lower Base */}
    <path d="M 31 118 C 42 130 78 130 89 118 L 90 132 L 30 132 Z" fill="#2563EB" stroke="#1D4ED8" strokeWidth="1" />
    
    {/* Center Porthole Red Outer Ring */}
    <circle cx="60" cy="84" r="18" fill="#EF4444" stroke="#B91C1C" strokeWidth="2" />
    
    {/* Porthole Window Cyan Glass */}
    <circle cx="60" cy="84" r="13" fill="#38BDF8" stroke="#0284C7" strokeWidth="2" />
    
    {/* Reflection Highlight */}
    <ellipse cx="55" cy="79" rx="4" ry="2.5" fill="#FFFFFF" opacity="0.85" transform="rotate(-30 55 79)" />
    
    {/* Center Main Thruster Flame */}
    <path d="M 50 132 Q 60 178 60 178 Q 60 178 70 132 Z" fill="#FACD15" stroke="#EAB308" strokeWidth="1.5" />
    <path d="M 53 132 Q 60 162 60 162 Q 60 162 67 132 Z" fill="#EF4444" />
    
    {/* Left Thruster Flame */}
    <path d="M 36 132 Q 41 160 41 160 Q 41 160 46 132 Z" fill="#FACD15" stroke="#EAB308" strokeWidth="1" />
    <path d="M 38 132 Q 41 150 41 150 Q 41 150 44 132 Z" fill="#EF4444" />
    
    {/* Right Thruster Flame */}
    <path d="M 74 132 Q 79 160 79 160 Q 79 160 84 132 Z" fill="#FACD15" stroke="#EAB308" strokeWidth="1" />
    <path d="M 76 132 Q 79 150 79 150 Q 79 150 82 132 Z" fill="#EF4444" />
  </svg>
);

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
  Users,
  LogOut,
  Maximize2,
  Minimize2
} from "lucide-react";
import { ReviewChallenge, ReviewScore, Question } from "../types";
import { isTrueFalseQuestion, normalizeQuestion, isGradeMatching } from "../utils/questionUtils";
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

  playWhistle() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Dual high-pitch modulated whistle
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(2600, now);

    lfo.type = "sawtooth";
    lfo.frequency.setValueAtTime(28, now);
    lfoGain.gain.setValueAtTime(140, now);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.04);
    gain.gain.setValueAtTime(0.18, now + 0.28);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.46);
    osc.stop(now + 0.46);
  }

  playBallKick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Deep punchy ball thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.16);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  playNetGoal() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Triumphant crowd burst + chord
    const freqs = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);
      gain.gain.setValueAtTime(0.08, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.8);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.85);
    });
  }

  playKeeperSave() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Glove slap deflection
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.14);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  playAirplaneSwoop() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.35);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.37);
  }

  playCloudBurst() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Sparkling chord
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);
      gain.gain.setValueAtTime(0.12, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.65);
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.7);
    });
  }

  playLightningBuzz() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Storm lightning zap
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.32);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
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

export const DEFAULT_DEMO_QUESTIONS: Question[] = [
  {
    id: "demo-q1",
    text: "ما هو الكوكب الأقرب إلى الشمس في المجموعة الشمسية؟",
    type: "multiple_choice",
    options: ["عطارد", "الزهرة", "الأرض", "المريخ"],
    correctAnswer: "0",
    points: 100
  },
  {
    id: "demo-q2",
    text: "ما هي عاصمة المملكة العربية السعودية؟",
    type: "multiple_choice",
    options: ["الرياض", "جدة", "مكة المكرمة", "الدمام"],
    correctAnswer: "0",
    points: 100
  },
  {
    id: "demo-q3",
    text: "ما هو أسرع حيوان بري في العالم؟",
    type: "multiple_choice",
    options: ["الفهد", "الأسد", "الغزال", "الحصان"],
    correctAnswer: "0",
    points: 100
  },
  {
    id: "demo-q4",
    text: "ما هي العملية التي تصنع بها النباتات غذاءها بمساعدة ضوء الشمس؟",
    type: "multiple_choice",
    options: ["البناء الضوئي", "التنفس الخلوي", "التبخر", "التكثف"],
    correctAnswer: "0",
    points: 100
  },
  {
    id: "demo-q5",
    text: "كم عدد أركان الإسلام الخمسة؟",
    type: "multiple_choice",
    options: ["خمسة أركان", "ثلاثة أركان", "ستة أركان", "أربعة أركان"],
    correctAnswer: "0",
    points: 100
  }
];

interface StudentRoundProgress {
  challengeId: string;
  gameType: string;
  currentQuestionIdx: number;
  score: number;
  correctCount: number;
  streak: number;
  hasFinishedWaygroundQuestions: boolean;
  gameState: "playing" | "finished" | "idle";
  doubleScoreUsed?: boolean;
  skipUsed?: boolean;
  fiftyFiftyUsed?: boolean;
  timeSpent?: number;
  updatedAt: string;
}

interface StudentReviewsTabProps {
  activeStudent: any;
  reviewChallenges: ReviewChallenge[];
  reviewScores: ReviewScore[];
  students?: any[];
  triggerToast: (msg: string, type: "success" | "error" | "info") => void;
  onGameStateChange?: (state: "idle" | "playing" | "finished") => void;
  teacherId?: string;
  isDemoMode?: boolean;
  autoStartChallengeId?: string;
  onExitDemo?: () => void;
}

export default function StudentReviewsTab({
  activeStudent,
  reviewChallenges,
  reviewScores,
  students,
  triggerToast,
  onGameStateChange,
  teacherId,
  isDemoMode = false,
  autoStartChallengeId,
  onExitDemo
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
  const [launchedRocket, setLaunchedRocket] = useState<{ active: boolean; startX: number; targetX: number; targetY: number } | null>(null);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [shipX, setShipX] = useState(50);
  const [carAngle, setCarAngle] = useState(0);
  const [isBoostingState, setIsBoostingState] = useState(false);

  // --- PENALTY SHOOTOUT STATES ---
  const [penaltyBallState, setPenaltyBallState] = useState<{
    isShooting: boolean;
    targetIdx: number | null;
    startX?: number;
    startY?: number;
    x: number;
    y: number;
    isGoal?: boolean;
    scale?: number;
    rotation?: number;
    deflectedX?: number;
    deflectedY?: number;
  }>({ isShooting: false, targetIdx: null, startX: 50, startY: 82, x: 50, y: 82, scale: 1, rotation: 0 });
  const [penaltyHoverIdx, setPenaltyHoverIdx] = useState<number | null>(null);
  const [penaltyKeeperState, setPenaltyKeeperState] = useState<{
    diveDirection: "left" | "right" | "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center" | "none";
    isDiving: boolean;
    hasDeflected?: boolean;
  }>({ diveDirection: "none", isDiving: false, hasDeflected: false });
  const [penaltyStrikerState, setPenaltyStrikerState] = useState<{
    phase: "idle" | "runup" | "kick" | "celebrate" | "disappointed";
  }>({ phase: "idle" });
  const [penaltyKicksHistory, setPenaltyKicksHistory] = useState<("goal" | "miss")[]>([]);
  const [penaltyShotSpeed, setPenaltyShotSpeed] = useState<number | null>(null);
  const [keeperGloveSpark, setKeeperGloveSpark] = useState<{ x: number; y: number } | null>(null);
  const [penaltyGoalBanner, setPenaltyGoalBanner] = useState<string | null>(null);
  const [netShaking, setNetShaking] = useState(false);

  // --- CLOUD AIRPLANE STATES ✈️☁️ ---
  const [airplanePos, setAirplanePos] = useState<{ x: number; y: number }>({ x: 18, y: 48 });
  const [airplaneAngle, setAirplaneAngle] = useState(0);
  const [airplaneTargetCloud, setAirplaneTargetCloud] = useState<number | null>(null);
  const [airplaneLives, setAirplaneLives] = useState(3);
  const [airplaneBanner, setAirplaneBanner] = useState<string | null>(null);
  const [airplaneBannerType, setAirplaneBannerType] = useState<"correct" | "wrong" | "info">("info");
  const [airplaneState, setAirplaneState] = useState<"flying" | "zooming" | "celebrating" | "hit_wrong">("flying");
  const [cloudBurstEffect, setCloudBurstEffect] = useState<{ cloudIdx: number; type: "correct" | "wrong" } | null>(null);
  const [airplaneHoverIdx, setAirplaneHoverIdx] = useState<number | null>(null);
  const [isAirplaneFullscreen, setIsAirplaneFullscreen] = useState(false);
  const [airplaneClouds, setAirplaneClouds] = useState<{
    idx: number;
    text: string;
    x: number;
    y: number;
    baseY: number;
    speed: number;
    waveOffset: number;
  }[]>([]);
  const airplaneCloudsRef = useRef<{
    idx: number;
    text: string;
    x: number;
    y: number;
    baseY: number;
    speed: number;
    waveOffset: number;
  }[]>([]);
  const airplaneLoopRef = useRef<number | null>(null);
  const airplanePosRef = useRef<{ x: number; y: number }>({ x: 18, y: 48 });
  const airplaneAngleRef = useRef(0);
  const airplaneArenaRef = useRef<HTMLDivElement | null>(null);
  const cloudDomRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const airplaneSpriteRef = useRef<HTMLDivElement | null>(null);
  const airplaneVelocityRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });
  const airplaneArrowHoldRef = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const arenaRectCacheRef = useRef<{ top: number; left: number; width: number; height: number } | null>(null);
  const isTouchDraggingRef = useRef(false);
  const touchTargetYRef = useRef<number | null>(null);
  const touchTargetXRef = useRef<number | null>(null);

  // --- MAZE CHASE GAME STATES ---
  const [mazePlayerPos, setMazePlayerPos] = useState<{ r: number; c: number }>({ r: 3, c: 4 });
  const [mazeMonsters, setMazeMonsters] = useState<{ id: number; r: number; c: number; type: string }[]>([
    { id: 1, r: 1, c: 4, type: "👾" },
    { id: 2, r: 5, c: 4, type: "👹" },
    { id: 3, r: 3, c: 2, type: "👾" },
    { id: 4, r: 3, c: 6, type: "👾" }
  ]);
  const [mazeLives, setMazeLives] = useState(3);
  const mazePlayerPosRef = useRef(mazePlayerPos);
  const mazeMonstersRef = useRef(mazeMonsters);
  const mazeLivesRef = useRef(mazeLives);
  const mazeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [showLiveLeaderboardModal, setShowLiveLeaderboardModal] = useState(false);

  // Lifelines and streaks for Waygground Arena
  const [doubleScoreActive, setDoubleScoreActive] = useState(false);
  const [doubleScoreUsed, setDoubleScoreUsed] = useState(false);
  const [skipUsed, setSkipUsed] = useState(false);
  const [fiftyFiftyUsed, setFiftyFiftyUsed] = useState(false);
  const [disabledOptionIndices, setDisabledOptionIndices] = useState<number[]>([]);
  const [streak, setStreak] = useState(0);
  
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});
  const shipXRef = useRef(50);
  const shipVelocityRef = useRef(0);
  const shipArrowHoldRef = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const carVelocityRef = useRef(0);
  const carAngleRef = useRef(0);
  const carArrowHoldRef = useRef<{ left: boolean; right: boolean; boost: boolean }>({ left: false, right: false, boost: false });
  const playerShipRef = useRef<HTMLDivElement | null>(null);
  const playerCarRef = useRef<HTMLDivElement | null>(null);
  const meteorDomRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});
  const roadCarDomRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const [isQuestionIntro, setIsQuestionIntro] = useState(false);
  const [introCountdown, setIntroCountdown] = useState(3);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [gameIntroStage, setGameIntroStage] = useState<"none" | "preview" | "countdown">("none");
  const isQuestionIntroRef = useRef(false);
  const introIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameIntroTimerRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestionIdxRef = useRef(0);
  const isAnswerRevealedRef = useRef(false);
  const activeChallengeRef = useRef<ReviewChallenge | null>(null);
  const sessionBestScoresRef = useRef<Record<string, number>>({});
  const fallingMeteorsRef = useRef<any[]>([]);
  const gameStateRef = useRef<"idle" | "playing" | "finished">("idle");
  const enterLobbyTimeRef = useRef<number>(0);
  const dismissedChallengeIdsRef = useRef<Set<string>>(new Set());
  const notifiedActivatedGamesRef = useRef<Set<string>>(new Set());
  const savedRoundProgressRef = useRef<Record<string, StudentRoundProgress>>({});

  // Initialize saved progress from localStorage and reset active game state for new active student
  useEffect(() => {
    const studentId = activeStudent?.id || "teacher-demo-user";
    try {
      const raw = localStorage.getItem(`student_round_progress_${studentId}`);
      if (raw) {
        savedRoundProgressRef.current = JSON.parse(raw);
      } else {
        savedRoundProgressRef.current = {};
      }
    } catch (err) {
      console.warn("Failed to load saved round progress:", err);
      savedRoundProgressRef.current = {};
    }

    // Reset active game state variables so a new student starts completely fresh
    setHasFinishedWaygroundQuestions(false);
    setGameState("idle");
    setActiveChallenge(null);
    setScore(0);
    setCorrectCount(0);
    setStreak(0);
    setCurrentQuestionIdx(0);
    setSelectedAnswerIdx(null);
    setIsAnswerRevealed(false);
    setLastAnswerCorrect(null);
    setWaygroundCountdown(null);
    setPodiumSecondsLeft(null);
  }, [activeStudent?.id]);

  // Helper to clear saved progress for a challenge
  const clearSavedProgressForChallenge = (chId: string, gameType?: string) => {
    const studentId = activeStudent?.id || "teacher-demo-user";
    delete savedRoundProgressRef.current[chId];
    if (gameType) {
      delete savedRoundProgressRef.current[gameType];
    }
    try {
      localStorage.setItem(`student_round_progress_${studentId}`, JSON.stringify(savedRoundProgressRef.current));
    } catch (err) {}
  };

  // Helper to persist current game progress
  const persistCurrentProgress = (override?: Partial<StudentRoundProgress>) => {
    if (!activeChallenge) return;
    const studentId = activeStudent?.id || "teacher-demo-user";
    const chId = activeChallenge.id;

    const currentData: StudentRoundProgress = {
      challengeId: chId,
      gameType: activeChallenge.gameType || "",
      currentQuestionIdx: override?.currentQuestionIdx !== undefined ? override.currentQuestionIdx : currentQuestionIdx,
      score: override?.score !== undefined ? override.score : score,
      correctCount: override?.correctCount !== undefined ? override.correctCount : correctCount,
      streak: override?.streak !== undefined ? override.streak : streak,
      hasFinishedWaygroundQuestions: override?.hasFinishedWaygroundQuestions !== undefined ? override.hasFinishedWaygroundQuestions : hasFinishedWaygroundQuestions,
      gameState: override?.gameState !== undefined ? override.gameState : gameState,
      doubleScoreUsed: override?.doubleScoreUsed !== undefined ? override.doubleScoreUsed : doubleScoreUsed,
      skipUsed: override?.skipUsed !== undefined ? override.skipUsed : skipUsed,
      fiftyFiftyUsed: override?.fiftyFiftyUsed !== undefined ? override.fiftyFiftyUsed : fiftyFiftyUsed,
      timeSpent: override?.timeSpent !== undefined ? override.timeSpent : timeSpent,
      updatedAt: new Date().toISOString()
    };

    savedRoundProgressRef.current[chId] = currentData;

    try {
      localStorage.setItem(`student_round_progress_${studentId}`, JSON.stringify(savedRoundProgressRef.current));
    } catch (e) {}
  };

  // Auto-persist whenever key game variables change during play or finish
  useEffect(() => {
    if (activeChallenge && (gameState === "playing" || gameState === "finished")) {
      persistCurrentProgress();
    }
  }, [
    activeChallenge?.id,
    currentQuestionIdx,
    score,
    correctCount,
    streak,
    hasFinishedWaygroundQuestions,
    gameState,
    doubleScoreUsed,
    skipUsed,
    fiftyFiftyUsed
  ]);

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
    mazePlayerPosRef.current = mazePlayerPos;
  }, [mazePlayerPos]);

  useEffect(() => {
    mazeMonstersRef.current = mazeMonsters;
  }, [mazeMonsters]);

  useEffect(() => {
    mazeLivesRef.current = mazeLives;
  }, [mazeLives]);

  useEffect(() => {
    isQuestionIntroRef.current = isQuestionIntro;
  }, [isQuestionIntro]);

  const [leaderboardTab, setLeaderboardTab] = useState<"live" | "cumulative">("live");
  const [liveActivePlayers, setLiveActivePlayers] = useState<any[]>([]);

  // Helper to compute top 3 podium scores combining live presence, final submitted scores, and current session score
  const getPodiumScores = () => {
    const scoresMap = new Map<string, {
      studentId: string;
      studentName: string;
      gradeClass: string;
      score: number;
    }>();

    // 1. From liveActivePlayers
    liveActivePlayers.forEach((p) => {
      const key = (p.studentId || p.studentName || "").toString();
      if (!key) return;
      scoresMap.set(key, {
        studentId: p.studentId || key,
        studentName: p.studentName || "طالب",
        gradeClass: p.gradeClass || activeStudent?.gradeClass || "عام",
        score: p.score || 0
      });
    });

    // 2. From reviewScores (persisted final scores for this challenge / gameType)
    if (activeChallenge) {
      const challengeScores = reviewScores.filter(s => 
        s.challengeId === activeChallenge.id || 
        s.challengeId === activeChallenge.gameType || 
        s.challengeId === `fixed_game_${activeChallenge.gameType}`
      );
      challengeScores.forEach(s => {
        const key = (s.studentId || s.studentName || "").toString();
        if (!key) return;
        const existing = scoresMap.get(key);
        if (existing) {
          existing.score = Math.max(existing.score, s.score || 0);
          if (s.gradeClass) existing.gradeClass = s.gradeClass;
        } else {
          scoresMap.set(key, {
            studentId: s.studentId || key,
            studentName: s.studentName || "طالب",
            gradeClass: s.gradeClass || "عام",
            score: s.score || 0
          });
        }
      });
    }

    // 3. Make sure current student's score is present
    if (activeStudent) {
      const myKey = activeStudent.id;
      const existing = scoresMap.get(myKey);
      if (existing) {
        existing.score = Math.max(existing.score, score);
      } else if (score > 0) {
        scoresMap.set(myKey, {
          studentId: activeStudent.id,
          studentName: activeStudent.name,
          gradeClass: activeStudent.gradeClass,
          score: score
        });
      }
    }

    return Array.from(scoresMap.values())
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 3);
  };

  // 1. Keep track of highest score achieved in this session per challenge
  useEffect(() => {
    if (!activeChallenge) return;
    if (score > (sessionBestScoresRef.current[activeChallenge.id] || 0)) {
      sessionBestScoresRef.current[activeChallenge.id] = score;
    }
  }, [score, activeChallenge]);

  // Auto-start game if autoStartChallengeId or isDemoMode is enabled
  useEffect(() => {
    if (autoStartChallengeId && reviewChallenges && reviewChallenges.length > 0) {
      const targetCh = reviewChallenges.find(c => c.id === autoStartChallengeId) || reviewChallenges[0];
      if (targetCh && gameState === "idle") {
        handleStartGame(targetCh);
      }
    } else if (isDemoMode && reviewChallenges && reviewChallenges.length > 0 && gameState === "idle") {
      handleStartGame(reviewChallenges[0]);
    }
  }, [autoStartChallengeId, isDemoMode, reviewChallenges]);

  // Notify student when teacher activates a game (shows game is available in games section without auto-launching)
  useEffect(() => {
    if (!reviewChallenges || reviewChallenges.length === 0 || isDemoMode || activeStudent?.id === "teacher-demo-user") return;
    
    const activeGames = reviewChallenges.filter(c => c.status === "active" && c.questions && c.questions.length > 0);
    activeGames.forEach(c => {
      const key = `${c.id}_${c.liveState || 'active'}`;
      if (!notifiedActivatedGamesRef.current.has(key)) {
        notifiedActivatedGamesRef.current.add(key);
        if (gameState === "idle") {
          triggerToast(`🎮 اللعبة "${c.title}" أصبحت متاحة للعب الآن! يمكنك الدخول إليها من قسم الألعاب.`, "success");
        }
      }
    });
  }, [reviewChallenges, gameState, isDemoMode, activeStudent?.id]);

  // 2. Sync live playroom presence on game start / state updates / score changes
  useEffect(() => {
    const studentIdToUse = activeStudent?.id || "teacher-demo-user";
    const studentNameToUse = activeStudent?.name || "طالب تجريبي (معاينة)";

    const presenceRef = doc(db, "livePlayroomPresence", studentIdToUse);

    const liveSessionScore = activeChallenge 
      ? Math.max(score, sessionBestScoresRef.current[activeChallenge.id] || 0)
      : 0;

    const currentChallengeTitle = activeChallenge
      ? (gameState === "playing" || gameState === "finished" ? activeChallenge.title : activeChallenge.title)
      : "في صالة الانتظار 💬";

    const isStudentActiveInGame = !!activeChallenge && gameState !== "idle";

    setDoc(presenceRef, {
      id: studentIdToUse,
      studentId: studentIdToUse,
      studentName: studentNameToUse,
      gradeClass: activeStudent?.gradeClass || "الصف الاول - الفصل 1",
      challengeId: isStudentActiveInGame ? (activeChallenge?.id || "") : "",
      gameType: isStudentActiveInGame ? (activeChallenge?.gameType || "") : "",
      challengeTitle: isStudentActiveInGame ? currentChallengeTitle : "في صالة الانتظار 💬",
      score: isStudentActiveInGame ? liveSessionScore : 0,
      shipX: shipXRef.current || shipX || 50,
      updatedAt: new Date().toISOString(),
      active: isStudentActiveInGame,
      teacherId: teacherId || activeStudent?.teacherId || "",
      finished: isStudentActiveInGame ? (hasFinishedWaygroundQuestions || gameState === "finished") : false,
      currentQuestionIdx: isStudentActiveInGame ? currentQuestionIdx : 0,
      totalQuestions: isStudentActiveInGame ? (activeChallenge?.questions?.length || 0) : 0
    }, { merge: true }).catch(err => {
      console.warn("Failed to set live presence:", err);
    });
  }, [
    activeStudent?.id,
    activeStudent?.name,
    activeStudent?.gradeClass,
    activeStudent?.teacherId,
    activeChallenge?.id,
    activeChallenge?.title,
    activeChallenge?.gameType,
    gameState,
    score,
    shipX,
    teacherId,
    hasFinishedWaygroundQuestions,
    currentQuestionIdx
  ]);

  // 3. Keep presence active during session (avoid dropping players on unmount re-renders)

  // 4. Listen to active players for the playroom
  useEffect(() => {
    const currentStudentId = activeStudent?.id || "teacher-demo-user";
    const currentTeacherId = teacherId || activeChallenge?.teacherId || activeStudent?.teacherId || "";

    // Listen to all live playroom presence documents
    const q = query(collection(db, "livePlayroomPresence"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const players: any[] = [];
      const teacherStudentIds = new Set((students || []).map(s => s.id));
      let currentStudentInSnapshot = false;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data || data.active === false) return;
        
        const isCurrentStudent = data.studentId === currentStudentId;
        const isSameTeacherByList = teacherStudentIds.has(data.studentId);
        const isSameTeacherByField = currentTeacherId && data.teacherId === currentTeacherId;
        const isSameActiveChallenge = activeChallenge && (
          data.challengeId === activeChallenge.id ||
          (data.gameType && data.gameType === activeChallenge.gameType) ||
          (data.challengeId && data.challengeId === activeChallenge.gameType) ||
          (data.challengeId && data.challengeId === `fixed_game_${activeChallenge.gameType}`)
        );

        if (isCurrentStudent) {
          currentStudentInSnapshot = true;
        }

        // Include if we are in an active challenge and the player is in this same challenge (or is the current student)
        if (activeChallenge) {
          if (isSameActiveChallenge || isCurrentStudent || (data.challengeId && data.challengeId !== "")) {
            players.push(data);
          }
        } else {
          if (isCurrentStudent || isSameTeacherByList || isSameTeacherByField || (data.challengeId && data.challengeId !== "")) {
            players.push(data);
          }
        }
      });

      // Check if the current student is missing from the active challenge's presence
      if (activeChallenge && gameState !== "idle" && !currentStudentInSnapshot) {
        // Auto repair/re-publish presence instead of kicking the student out!
        const studentIdToUse = activeStudent?.id || "teacher-demo-user";
        const studentNameToUse = activeStudent?.name || "طالب تجريبي (معاينة)";
        const presenceRef = doc(db, "livePlayroomPresence", studentIdToUse);
        
        setDoc(presenceRef, {
          id: studentIdToUse,
          studentId: studentIdToUse,
          studentName: studentNameToUse,
          gradeClass: activeStudent?.gradeClass || "الصف الاول - الفصل 1",
          challengeId: activeChallenge?.id || "",
          gameType: activeChallenge?.gameType || "",
          challengeTitle: activeChallenge?.title || "تحدي المراجعة",
          updatedAt: new Date().toISOString(),
          active: true,
          teacherId: teacherId || activeStudent?.teacherId || "",
          finished: hasFinishedWaygroundQuestions,
          currentQuestionIdx: currentQuestionIdx,
          totalQuestions: activeChallenge?.questions?.length || 0
        }, { merge: true }).catch(() => {});
      }

      // Sort players by:
      // 1. If playing the same active challenge as us, put them first
      // 2. Then sort by score descending
      players.sort((a, b) => {
        const aSameChallenge = activeChallenge && (a.challengeId === activeChallenge.id || a.challengeId === activeChallenge.gameType) ? 1 : 0;
        const bSameChallenge = activeChallenge && (b.challengeId === activeChallenge.id || b.challengeId === activeChallenge.gameType) ? 1 : 0;
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
  }, [activeStudent?.id, students, activeChallenge?.id, activeChallenge?.gameType, activeChallenge?.teacherId, teacherId, activeStudent?.teacherId]);

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

  // Track previous liveState to prevent duplicate toasts / sounds / flickering
  const prevLiveStateRef = useRef<string | undefined>(undefined);

  // Keep activeChallenge in sync with live prop updates from Firestore
  useEffect(() => {
    if (!activeChallenge || !reviewChallenges || reviewChallenges.length === 0) return;
    
    // 1. First check if ANY challenge with same ID or same gameType is in podium state!
    let matchingChallenge = reviewChallenges.find(
      c => (c.id === activeChallenge.id || c.gameType === activeChallenge.gameType) && c.liveState === "podium"
    );

    // 2. If no podium, try exact ID match
    if (!matchingChallenge) {
      matchingChallenge = reviewChallenges.find(c => c.id === activeChallenge.id);
    }

    // 3. Fallback to any challenge matching the gameType
    if (!matchingChallenge) {
      matchingChallenge = reviewChallenges.find(
        c => c.gameType === activeChallenge.gameType && (c.status === "active" || c.liveState === "podium")
      );
    }

    // 4. Last fallback to any matching gameType
    if (!matchingChallenge) {
      matchingChallenge = reviewChallenges.find(c => c.gameType === activeChallenge.gameType);
    }

    if (!matchingChallenge) return;
    if (dismissedChallengeIdsRef.current.has(matchingChallenge.id) || dismissedChallengeIdsRef.current.has(matchingChallenge.gameType)) return;

    // Check if the game has been deactivated or stopped by the teacher (when not in podium)
    const isDeactivatedOrStopped = (
      (matchingChallenge.status !== "active" && matchingChallenge.liveState !== "podium") ||
      (matchingChallenge.liveState === "waiting" && (prevLiveStateRef.current === "playing" || prevLiveStateRef.current === "podium"))
    );

    if (isDeactivatedOrStopped) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      sfx.stopBGM();
      handleExitGame();
      clearSavedProgressForChallenge(matchingChallenge.id, matchingChallenge.gameType);
      setScore(0);
      setCorrectCount(0);
      setHasFinishedWaygroundQuestions(false);
      setCurrentQuestionIdx(0);
      setSelectedAnswerIdx(null);
      setIsAnswerRevealed(false);
      sessionBestScoresRef.current = {};
      triggerToast("تم إيقاف اللعبة وتجميدها من قبل المعلم وتصفير النقاط ⏸️", "info");
      return;
    }

    const oldLiveState = prevLiveStateRef.current ?? activeChallenge.liveState;
    const newLiveState = matchingChallenge.liveState;

    if (prevLiveStateRef.current !== newLiveState) {
      prevLiveStateRef.current = newLiveState;
      
      if (oldLiveState && oldLiveState !== "playing" && newLiveState === "playing") {
        // Teacher just started the game! Start the specific game mode cleanly!
        handleStartGame(matchingChallenge);
        triggerToast("انطلق! تم بدء المواجهة الحماسية الآن! 🚀", "success");
      } else if (newLiveState === "waiting" && (oldLiveState === "playing" || oldLiveState === "podium")) {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        sfx.stopBGM();
        setGameState("idle");
        setScore(0);
        setCorrectCount(0);
        setHasFinishedWaygroundQuestions(false);
        setCurrentQuestionIdx(0);
        setSelectedAnswerIdx(null);
        setIsAnswerRevealed(false);
        sessionBestScoresRef.current = {};
        clearSavedProgressForChallenge(matchingChallenge.id, matchingChallenge.gameType);
        triggerToast("تمت العودة لصالة الانتظار للتحضير للجولة القادمة 🏟️", "info");
      } else if (newLiveState === "podium") {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        sfx.stopBGM();
        sfx.playGameOver();
        setShowGameOverIntro(true);
        setTimeout(() => {
          setShowGameOverIntro(false);
        }, 1500);
        if (gameState !== "finished") {
          handleFinishGame();
        }
      }
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

  // Clean up and reset game after 20 full seconds in podium state for student
  useEffect(() => {
    let interval: any = null;
    if (
      activeChallenge &&
      activeChallenge.liveState === "podium"
    ) {
      setPodiumSecondsLeft(20);

      interval = setInterval(() => {
        setPodiumSecondsLeft(prev => {
          if (prev === null || prev <= 1) {
            if (interval) clearInterval(interval);
            handleExitGame();
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (interval) clearInterval(interval);
      };
    } else {
      setPodiumSecondsLeft(null);
    }
  }, [activeChallenge?.id, activeChallenge?.liveState]);

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
      if (e.repeat && (e.key === " " || e.key === "Spacebar")) return;

      keysPressedRef.current[e.key] = true;
      if (e.key === " " || e.key === "Spacebar") {
        setIsBoostingState(true);
      }

      const challenge = activeChallengeRef.current;
      if (!challenge || isAnswerRevealedRef.current) return;

      if (challenge.gameType === "space_invaders") {
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A" || e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
          // Handled smoothly with velocity & damping in animation loop
        } else if (e.key === " " || e.key === "Enter") {
          if (e.repeat) return;
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
      } else if (challenge.gameType === "penalty_shootout" && !isAnswerRevealedRef.current && !isQuestionIntroRef.current) {
        if (e.key === "1") handlePenaltyShot(0);
        else if (e.key === "2") handlePenaltyShot(1);
        else if (e.key === "3") handlePenaltyShot(2);
        else if (e.key === "4") handlePenaltyShot(3);
      } else if (challenge.gameType === "cloud_airplane" && !isAnswerRevealedRef.current && !isQuestionIntroRef.current) {
        if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key] = false;
      if (e.key === " " || e.key === "Spacebar") {
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

  // Mouse & Touch movement handlers over the canvas area - 60 FPS hardware direct manipulation
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const challenge = activeChallengeRef.current;
    const isGameWithMovement = challenge && (challenge.gameType === "space_invaders" || challenge.gameType === "car_racing");
    if (isAnswerRevealedRef.current || !isGameWithMovement) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(5, Math.min(95, (x / rect.width) * 100));
    shipXRef.current = percentage;
    if (playerShipRef.current) playerShipRef.current.style.left = `${percentage}%`;
    if (playerCarRef.current) playerCarRef.current.style.left = `${percentage}%`;
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
    shipXRef.current = percentage;
    if (playerShipRef.current) playerShipRef.current.style.left = `${percentage}%`;
    if (playerCarRef.current) playerCarRef.current.style.left = `${percentage}%`;
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

  // Filter challenges appropriate for this student's grade and teacher
  const getMyChallenges = () => {
    const currentTeacherId = teacherId || activeStudent?.teacherId;
    return reviewChallenges.filter(c => {
      // Must be strictly active
      const statusStr = (c.status as string) || "active";
      if (statusStr !== "active") return false;

      // Must have actual questions to be considered active/playable
      if (!c.questions || c.questions.length === 0) return false;
      
      // If student has a specific teacher, do not show challenges from other teachers
      if (currentTeacherId && c.teacherId && c.teacherId !== currentTeacherId) {
        return false;
      }

      return isGradeMatching(c.grade, activeStudent?.grade, activeStudent?.gradeClass);
    });
  };

  // Helper to accurately resolve a fixed game and its activation state for this student
  const resolveFixedGameForStudent = (gameType: string, defaultId: string) => {
    const myActiveChallenges = getMyChallenges();
    const currentTeacherId = teacherId || activeStudent?.teacherId;

    // 1. Is there an active, question-populated challenge for this student?
    const activeChallenge = myActiveChallenges.find(
      c => c.gameType === gameType || c.id === defaultId || (c.id && c.id.endsWith(`_${gameType}`))
    );
    if (activeChallenge) {
      return { challenge: activeChallenge, isActivated: true };
    }

    // 2. Otherwise, find the best reference challenge (to display title, questions count, etc.)
    const candidates = reviewChallenges.filter(
      c => c.gameType === gameType || c.id === defaultId || (c.id && c.id.endsWith(`_${gameType}`))
    );

    const teacherCandidateWithQuestions = candidates.find(
      c => currentTeacherId && c.teacherId === currentTeacherId && (c.questions?.length || 0) > 0
    );
    const candidateWithQuestions = candidates.find(c => (c.questions?.length || 0) > 0);
    const teacherCandidate = candidates.find(c => currentTeacherId && c.teacherId === currentTeacherId);
    const fallbackCandidate = candidates[0] || null;

    const resolved = teacherCandidateWithQuestions || candidateWithQuestions || teacherCandidate || fallbackCandidate;
    return { challenge: resolved, isActivated: false };
  };

  // Start or resume a challenge
  const handleStartGame = (challenge: ReviewChallenge) => {
    if (challenge) {
      dismissedChallengeIdsRef.current.delete(challenge.id);
      if (challenge.gameType) {
        dismissedChallengeIdsRef.current.delete(challenge.gameType);
      }
    }
    const chKey = challenge.id;
    const saved = savedRoundProgressRef.current[chKey] || null;

    const isLiveWaiting = false;

    // Check if current student has already completed and recorded a final score for this active challenge session
    const existingScoreForMe = reviewScores.find(
      s => (s.challengeId === challenge.id || s.challengeId === challenge.gameType || s.challengeId === `fixed_game_${challenge.gameType}`) &&
           s.studentId === (activeStudent?.id || "teacher-demo-user")
    );

    // If the game was stopped and reactivated / reset by the teacher, existingScoreForMe was deleted from Firestore.
    // Clear any stale local progress so the student starts completely fresh from 0 points and question 0.
    if (!existingScoreForMe) {
      clearSavedProgressForChallenge(challenge.id, challenge.gameType);
    }

    const activeSaved = existingScoreForMe ? saved : null;

    if (activeSaved) {
      // RESUME EXISTING ROUND IN PROGRESS
      const randomizedChallenge = {
        ...randomizeChallenge(challenge),
        _rawQuestions: challenge.questions
      };
      setActiveChallenge(randomizedChallenge as ReviewChallenge);
      activeChallengeRef.current = randomizedChallenge;

      const savedIdx = Math.min(activeSaved.currentQuestionIdx || 0, challenge.questions.length - 1);
      const isFinished = activeSaved.hasFinishedWaygroundQuestions || activeSaved.gameState === "finished" || activeSaved.currentQuestionIdx >= challenge.questions.length;

      setScore(activeSaved.score || 0);
      setCorrectCount(activeSaved.correctCount || 0);
      setStreak(activeSaved.streak || 0);
      setDoubleScoreUsed(!!activeSaved.doubleScoreUsed);
      setSkipUsed(!!activeSaved.skipUsed);
      setFiftyFiftyUsed(!!activeSaved.fiftyFiftyUsed);
      setTimeSpent(activeSaved.timeSpent || 0);

      if (isFinished) {
        setHasFinishedWaygroundQuestions(true);
        setCurrentQuestionIdx(challenge.questions.length - 1);
        currentQuestionIdxRef.current = challenge.questions.length - 1;
        setGameState(challenge.gameType === "wayground_arena" ? "playing" : "finished");
        triggerToast("لقد شاركت في هذه الجولة المباشرة بالفعل وبانتظار نتائج التتويج 🏆", "info");
      } else {
        setHasFinishedWaygroundQuestions(false);
        setCurrentQuestionIdx(savedIdx);
        currentQuestionIdxRef.current = savedIdx;
        setGameState("playing");
        setSelectedAnswerIdx(null);
        setIsAnswerRevealed(false);
        setLastAnswerCorrect(null);

        // Resume timers for current question index
        if (randomizedChallenge.gameType === "wayground_arena") {
          setTimeLeft(15);
          startWaygroundTimer();
        } else if (randomizedChallenge.gameType === "time_attack") {
          setTimeLeft(60);
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
        } else {
          setTimeLeft(15);
          startQuestionTimer();
        }

        triggerToast(`تم استكمال الجولة الحالية من السؤال ${savedIdx + 1} بنجاح! 🚀`, "success");
      }

      // Measure total game time seconds
      if (gameSecondsRef.current) clearInterval(gameSecondsRef.current);
      gameSecondsRef.current = setInterval(() => {
        setTimeSpent(prev => prev + 1);
      }, 1000);

      return;
    }

    // FRESH START (No active saved progress or game reset)
    setHasFinishedWaygroundQuestions(false);

    // For Quiz Plus live arena, students can participate when liveState is playing or waiting
    if (challenge.gameType === "wayground_arena" && !isDemoMode && activeStudent?.id !== "teacher-demo-user") {
      const existingScore = reviewScores.find(
        s => (s.challengeId === challenge.id || s.challengeId === "fixed_game_wayground_arena") &&
             s.studentId === activeStudent?.id
      );
      if (challenge.liveState !== "playing" && challenge.liveState !== "waiting" && (hasFinishedWaygroundQuestions || existingScore)) {
        triggerToast("⚠️ عذراً! لقد شاركت بالفعل في هذه الجولة المباشرة من لعبة Quiz Plus (تقتصر المشاركة على جولة واحدة فقط لكل تفعيل). يرجى انتظار المعلم لتفعيل جولة جديدة.", "info");
        return;
      }
    }

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
    } else if (randomizedChallenge.gameType === "penalty_shootout") {
      // Setup penalty shootout first question with presentation
      setPenaltyKicksHistory([]);
      startQuestionWithIntro(0, "penalty_shootout", randomizedChallenge);
    } else if (randomizedChallenge.gameType === "cloud_airplane") {
      // Setup cloud airplane first question with presentation
      setAirplaneLives(3);
      setAirplaneBanner(null);
      setupCloudAirplane(randomizedChallenge.questions[0]);
      startQuestionWithIntro(0, "cloud_airplane", randomizedChallenge);
    } else if (randomizedChallenge.gameType === "wayground_arena") {
      setTimeLeft(15);
      setHasFinishedWaygroundQuestions(false);
      setPodiumSecondsLeft(null);
      if (isDemoMode || randomizedChallenge.liveState === "playing") {
        startWaygroundCountdown();
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

  // Trigger high-energy countdown phase from preview or question intro
  const triggerGameCountdown = (qIdx: number, gameType: string, q: Question) => {
    if (gameIntroTimerRef.current) clearTimeout(gameIntroTimerRef.current);
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);

    setGameIntroStage("countdown");
    setIntroCountdown(3);
    sfx.playLaser();

    let currentSeconds = 3;
    introIntervalRef.current = setInterval(() => {
      currentSeconds -= 1;
      if (currentSeconds > 0) {
        setIntroCountdown(currentSeconds);
        sfx.playLaser();
      } else if (currentSeconds === 0) {
        setIntroCountdown(0);
        sfx.playCorrect();
      } else {
        if (introIntervalRef.current) clearInterval(introIntervalRef.current);
        introIntervalRef.current = null;
        setGameIntroStage("none");

        setIsTransitioning(true);
        setTimeout(() => {
          setIsQuestionIntro(false);
          isQuestionIntroRef.current = false;
          setIsTransitioning(false);

          if (gameType === "space_invaders") {
            setupSpaceMeteors(q);
            startInteractiveGameTimer("space_invaders");
          } else if (gameType === "car_racing") {
            setupRoadItems(q);
            startInteractiveGameTimer("car_racing");
          } else if (gameType === "penalty_shootout") {
            setupPenaltyShootout(q);
            startInteractiveGameTimer("penalty_shootout");
          } else if (gameType === "cloud_airplane") {
            setupCloudAirplane(q);
            startInteractiveGameTimer("cloud_airplane");
          }
        }, 600);
      }
    }, 1000);
  };

  const runStandardQuestionIntroCountdown = (qIdx: number, gameType: string, q: Question) => {
    setIntroCountdown(3);
    sfx.playLaser();

    let currentSeconds = 3;
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);

    introIntervalRef.current = setInterval(() => {
      currentSeconds -= 1;
      if (currentSeconds > 0) {
        setIntroCountdown(currentSeconds);
        sfx.playLaser();
      } else {
        if (introIntervalRef.current) clearInterval(introIntervalRef.current);
        introIntervalRef.current = null;

        setIsTransitioning(true);
        setIntroCountdown(0);
        sfx.playLaser();

        setTimeout(() => {
          setIsQuestionIntro(false);
          isQuestionIntroRef.current = false;
          setIsTransitioning(false);

          if (gameType === "space_invaders") {
            setupSpaceMeteors(q);
            startInteractiveGameTimer("space_invaders");
          } else if (gameType === "car_racing") {
            setupRoadItems(q);
            startInteractiveGameTimer("car_racing");
          } else if (gameType === "penalty_shootout") {
            setupPenaltyShootout(q);
            startInteractiveGameTimer("penalty_shootout");
          } else if (gameType === "cloud_airplane") {
            setupCloudAirplane(q);
            startInteractiveGameTimer("cloud_airplane");
          }
        }, 800);
      }
    }, 1000);
  };

  // Start question with a beautiful center-of-arena presentation or animated game preview
  const startQuestionWithIntro = (qIdx: number, gameType: string, customChallenge?: ReviewChallenge) => {
    const challenge = customChallenge || activeChallenge || activeChallengeRef.current;
    if (!challenge) return;
    const q = challenge.questions[qIdx];
    if (!q) return;

    // 1. Reset any existing game loop, clear falling items, and stop active timers during intro
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);
    if (gameIntroTimerRef.current) clearTimeout(gameIntroTimerRef.current);

    setFallingMeteors([]);
    fallingMeteorsRef.current = [];
    setIsAnswerRevealed(false);
    isAnswerRevealedRef.current = false;

    // 2. Set Intro phase state
    setIsQuestionIntro(true);
    isQuestionIntroRef.current = true;
    setIsTransitioning(false);

    // 3. If launching Game (qIdx === 0) for Space Invaders, Car Racing, Penalty Shootout, or Cloud Airplane, show Game Intro Preview first!
    if (qIdx === 0 && (gameType === "space_invaders" || gameType === "car_racing" || gameType === "penalty_shootout" || gameType === "cloud_airplane")) {
      setGameIntroStage("preview");
      setIntroCountdown(3);
      sfx.playLaser();

      // Auto-advance to Countdown after 3.5 seconds if user doesn't click "Start" button
      gameIntroTimerRef.current = setTimeout(() => {
        triggerGameCountdown(qIdx, gameType, q);
      }, 3500);
    } else {
      setGameIntroStage("none");
      runStandardQuestionIntroCountdown(qIdx, gameType, q);
    }
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

  // Interactive Games (Space Invaders, Car Racing, Penalty Shootout & Cloud Airplane) Question Timer
  const startInteractiveGameTimer = (gameType: "space_invaders" | "car_racing" | "penalty_shootout" | "cloud_airplane") => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimeLeft(gameType === "cloud_airplane" ? 40 : gameType === "penalty_shootout" ? 20 : 25);
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
          } else if (gameType === "penalty_shootout") {
            handlePenaltyShot(-1);
          } else if (gameType === "cloud_airplane") {
            handleAirplaneHitCloud(-1);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Setup Space Invader falling meteors (options fall continuously from top to bottom)
  const setupSpaceMeteors = (q?: Question) => {
    const targetQ = q || activeChallengeRef.current?.questions[currentQuestionIdxRef.current];
    if (!targetQ || !targetQ.options || targetQ.options.length === 0) return;

    // Reset answer revealed flags to ensure loop runs smoothly
    isAnswerRevealedRef.current = false;
    setIsAnswerRevealed(false);
    meteorDomRefs.current = {};
    shipVelocityRef.current = 0;
    shipArrowHoldRef.current = { left: false, right: false };

    const numOpts = targetQ.options.length;
    const spacing = 80 / Math.max(1, numOpts);
    const items = targetQ.options.map((opt, i) => ({
      id: Math.random(),
      answer: opt,
      idx: i,
      isCorrect: checkIsCorrect(targetQ, i),
      x: 10 + i * spacing + (spacing / 4), // Distributed horizontally across arena
      y: 2 + (i % 2) * 8, // Immediate initial visible top position
      speed: 0.22 + (i % 2) * 0.04 // Smooth, continuous downwards descent speed
    }));

    fallingMeteorsRef.current = items;
    setFallingMeteors(items);

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);

    let lastTime = performance.now();
    const animate = (now: number) => {
      if (isAnswerRevealedRef.current) {
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        return;
      }

      const dt = Math.min((now - lastTime) / 16.66, 2.0);
      lastTime = now;

      // Smooth keyboard & on-screen button steering directly in animation loop
      const keys = keysPressedRef.current;
      const hold = shipArrowHoldRef.current;
      const left = keys["ArrowLeft"] || keys["a"] || keys["A"] || hold.left;
      const right = keys["ArrowRight"] || keys["d"] || keys["D"] || hold.right;

      const maxVx = 1.35;
      let targetVx = 0;
      if (left) targetVx -= maxVx;
      if (right) targetVx += maxVx;

      if (targetVx !== 0) {
        shipVelocityRef.current += (targetVx - shipVelocityRef.current) * Math.min(1, 0.22 * dt);
      } else {
        // Smooth aerodynamic glide damping
        shipVelocityRef.current *= Math.pow(0.86, dt);
      }

      let nextX = shipXRef.current + shipVelocityRef.current * dt;
      if (nextX < 6) {
        nextX = 6;
        shipVelocityRef.current = 0;
      } else if (nextX > 94) {
        nextX = 94;
        shipVelocityRef.current = 0;
      }
      shipXRef.current = nextX;

      if (playerShipRef.current) {
        playerShipRef.current.style.left = `${nextX}%`;
      }

      // Smooth downward descent of target meteors with zero GC allocation
      const list = fallingMeteorsRef.current || items;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        let newY = m.y + (m.speed || 0.22) * dt;
        if (newY > 78) {
          newY = -12; // Continuous smooth wrap-around descent from top
        }
        m.y = newY;
        const el = meteorDomRefs.current[m.idx];
        if (el) {
          el.style.top = `${newY}%`;
          el.style.left = `${m.x}%`;
        }
      }

      gameLoopRef.current = requestAnimationFrame(animate);
    };

    gameLoopRef.current = requestAnimationFrame(animate);
  };

  // Setup Road Items for Car Racing Game
  const setupRoadItems = (q: Question) => {
    if (!q) return;
    
    isAnswerRevealedRef.current = false;
    setIsAnswerRevealed(false);
    roadCarDomRefs.current = {};
    carVelocityRef.current = 0;
    carAngleRef.current = 0;
    carArrowHoldRef.current = { left: false, right: false, boost: false };

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
        speed: 0.18 // slower descend speed
      };
    });
    fallingMeteorsRef.current = items;
    setFallingMeteors(items);

    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    
    let isColliding = false;
    let lastTime = performance.now();

    const animate = (now: number) => {
      if (isAnswerRevealedRef.current) {
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        return;
      }

      const dt = Math.min((now - lastTime) / 16.66, 2.0);
      lastTime = now;

      // 1. Process Drift Physics: Velocity, Natural Inertia, Exponential Damping
      const keys = keysPressedRef.current;
      const hold = carArrowHoldRef.current;
      const left = keys["ArrowLeft"] || keys["a"] || keys["A"] || hold.left;
      const right = keys["ArrowRight"] || keys["d"] || keys["D"] || hold.right;
      const isBoosting = keys[" "] || keys["Spacebar"] || hold.boost;

      const maxVx = isBoosting ? 1.75 : 1.35;
      let targetVx = 0;
      if (left) targetVx -= maxVx;
      if (right) targetVx += maxVx;

      if (targetVx !== 0) {
        carVelocityRef.current += (targetVx - carVelocityRef.current) * Math.min(1, 0.24 * dt);
      } else {
        // Natural drift friction damping
        carVelocityRef.current *= Math.pow(0.86, dt);
      }
      
      let nextX = shipXRef.current + carVelocityRef.current * dt;
      if (nextX < 6) {
        nextX = 6;
        carVelocityRef.current = 0;
      } else if (nextX > 94) {
        nextX = 94;
        carVelocityRef.current = 0;
      }
      shipXRef.current = nextX;

      const targetAngle = Math.max(-18, Math.min(18, carVelocityRef.current * 7.5));
      carAngleRef.current = carAngleRef.current * 0.72 + targetAngle * 0.28;

      // Direct player car DOM update - 60 FPS hardware accelerated without React re-render
      if (playerCarRef.current) {
        playerCarRef.current.style.left = `${nextX}%`;
        playerCarRef.current.style.transform = `translateX(-50%) rotate(${carAngleRef.current.toFixed(1)}deg)`;
      }

      // Check booster speed modifier (Space key or on-screen button)
      const boosterMultiplier = isBoosting ? 2.3 : 1.0;

      let collisionDetected = false;
      let collidingMeteor: any = null;

      const list = fallingMeteorsRef.current || items;
      for (let i = 0; i < list.length; i++) {
        const m = list[i];
        let newY = m.y + (m.speed || 0.18) * boosterMultiplier * dt;
        if (newY > 95) {
          // Respawn at top if it passed the bottom
          newY = -20;
        }
        m.y = newY;

        // Proximity collision check
        if (!isColliding && newY >= 72 && newY <= 86) {
          if (Math.abs(m.x - nextX) < 11) {
            collisionDetected = true;
            collidingMeteor = { ...m, y: newY };
          }
        }

        const el = roadCarDomRefs.current[m.idx];
        if (el) {
          el.style.top = `${newY}%`;
          el.style.left = `${m.x}%`;
        }
      }

      if (collisionDetected && collidingMeteor && !isColliding) {
        isColliding = true;
        if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
        handleCarCollision(collidingMeteor, nextX);
        return;
      }

      gameLoopRef.current = requestAnimationFrame(animate);
    };

    gameLoopRef.current = requestAnimationFrame(animate);
  };

  // Handle Car Collision in Car Racing Game
  const handleCarCollision = (item: any, currentShipX?: number) => {
    const challenge = activeChallengeRef.current;
    if (!challenge || isAnswerRevealedRef.current) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);

    setIsAnswerRevealed(true);
    isAnswerRevealedRef.current = true;
    if (fallingMeteorsRef.current) {
      setFallingMeteors([...fallingMeteorsRef.current]);
    }
    const activeX = currentShipX !== undefined ? currentShipX : shipXRef.current;
    setShipX(activeX);
    setCarAngle(carAngleRef.current);

    const currentIdx = currentQuestionIdxRef.current;
    const currentQ = challenge.questions[currentIdx];
    if (!currentQ) return;
    const isCorrect = item.isCorrect !== undefined ? item.isCorrect : checkIsCorrect(currentQ, item.idx);

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

  // --- PENALTY SHOOTOUT GAME ENGINE ⚽ ---
  const getPenaltyOptionX = (idx: number, total: number) => {
    if (total === 2) {
      return idx === 0 ? 30 : 70;
    }
    if (total === 3) {
      return idx === 0 ? 22 : idx === 1 ? 50 : 78;
    }
    // 4 options distributed across the stadium width
    if (idx === 0) return 16;
    if (idx === 1) return 38;
    if (idx === 2) return 62;
    return 84;
  };

  const setupPenaltyShootout = (_q?: Question) => {
    isAnswerRevealedRef.current = false;
    setIsAnswerRevealed(false);
    setPenaltyHoverIdx(null);
    setPenaltyBallState({ isShooting: false, targetIdx: null, startX: 50, startY: 82, x: 50, y: 82, scale: 1, rotation: 0 });
    setPenaltyKeeperState({ diveDirection: "none", isDiving: false, hasDeflected: false });
    setPenaltyStrikerState({ phase: "idle" });
    setPenaltyShotSpeed(null);
    setKeeperGloveSpark(null);
    setPenaltyGoalBanner(null);
    setNetShaking(false);
    // Referee whistle signal for kickoff
    sfx.playWhistle();
  };

  const handlePenaltyShot = (targetIdx: number) => {
    const challenge = activeChallengeRef.current;
    if (!challenge || isAnswerRevealedRef.current) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    setIsAnswerRevealed(true);
    isAnswerRevealedRef.current = true;
    setPenaltyHoverIdx(null);

    const currentIdx = currentQuestionIdxRef.current;
    const currentQ = challenge.questions[currentIdx];
    if (!currentQ) return;

    const isTimeout = targetIdx < 0;
    const isCorrect = !isTimeout && checkIsCorrect(currentQ, targetIdx);
    const numOpts = currentQ.options.length;

    // The ball begins at the chosen ball's exact spot at the bottom (y = 82%)
    // and launches straight into the target answer card in the upper area (y = 20%)
    const ballStartX = !isTimeout ? getPenaltyOptionX(targetIdx, numOpts) : 50;
    const ballStartY = 82;
    const ballTargetX = !isTimeout ? getPenaltyOptionX(targetIdx, numOpts) : 50;
    const ballTargetY = !isTimeout ? 20 : 65;

    let keeperDive: "left" | "right" | "top_left" | "top_right" | "bottom_left" | "bottom_right" | "center" = "center";

    if (isTimeout) {
      keeperDive = "center";
    } else if (isCorrect) {
      // Goalkeeper dives in the wrong direction or reacts late!
      if (ballTargetX < 50) {
        keeperDive = "top_right";
      } else {
        keeperDive = "top_left";
      }
    } else {
      // Goalkeeper dives directly to deflect the shot!
      if (ballTargetX <= 25) {
        keeperDive = "top_left";
      } else if (ballTargetX < 50) {
        keeperDive = "left";
      } else if (ballTargetX <= 75) {
        keeperDive = "right";
      } else {
        keeperDive = "top_right";
      }
    }

    // 1. Striker run-up animation starts towards that specific ball
    setPenaltyStrikerState({ phase: "runup" });

    // Realistic TV broadcast shot speed radar
    const speed = isCorrect 
      ? Math.floor(104 + Math.random() * 22) 
      : Math.floor(84 + Math.random() * 16);
    setPenaltyShotSpeed(speed);

    // 2. Striker kicks ball after run-up (150ms)
    setTimeout(() => {
      setPenaltyStrikerState({ phase: "kick" });
      sfx.playBallKick();

      // Ball takes off with 3D spin and perspective shrinking towards the target at the top!
      setPenaltyBallState({
        isShooting: true,
        targetIdx,
        startX: ballStartX,
        startY: ballStartY,
        x: ballTargetX,
        y: ballTargetY,
        isGoal: isCorrect,
        scale: isTimeout ? 0.85 : 0.52,
        rotation: ballTargetX < 50 ? -720 : 720,
      });
    }, 150);

    // 3. Goalkeeper reacts and dives (250ms)
    setTimeout(() => {
      setPenaltyKeeperState({
        diveDirection: keeperDive,
        isDiving: true,
        hasDeflected: !isCorrect && !isTimeout,
      });
    }, 250);

    // 4. Ball reaches destination & impact result (550ms)
    setTimeout(() => {
      if (isCorrect) {
        setNetShaking(true);
        sfx.playNetGoal();
        sfx.playCorrect();
        setPenaltyStrikerState({ phase: "celebrate" });
        setPenaltyKicksHistory(prev => [...prev, "goal"]);
        setCorrectCount(prev => prev + 1);
        setStreak(prev => prev + 1);
        const streakBonus = streak >= 2 ? 50 : 0;
        setScore(prev => prev + 150 + streakBonus);

        const cornerTag = `صاروخ في شباك الهدف [${targetIdx + 1}] 🎯🔥`;

        setPenaltyGoalBanner(
          streak >= 2 
            ? `هاتريك أسطوري! ⚽🎩🔥 (+200 نقطة) • ${cornerTag}` 
            : `هـــــــــدف عـــــالمي! ⚽🔥🥅 (+150 نقطة) • ${cornerTag}`
        );

        // Confetti / goal particles around target
        const colors = ["#fbbf24", "#34d399", "#10b981", "#60a5fa", "#f43f5e"];
        const newParticles = Array.from({ length: 24 }).map(() => ({
          id: Math.random(),
          x: ballTargetX + (Math.random() - 0.5) * 16,
          y: ballTargetY + (Math.random() - 0.5) * 12,
          color: colors[Math.floor(Math.random() * colors.length)]
        }));
        setParticles(newParticles);
        setTimeout(() => setParticles([]), 900);
      } else {
        sfx.playKeeperSave();
        sfx.playIncorrect();
        setPenaltyStrikerState({ phase: "disappointed" });
        setPenaltyKicksHistory(prev => [...prev, "miss"]);
        setKeeperGloveSpark({ x: ballTargetX, y: ballTargetY + 6 });
        setStreak(0);
        setScore(prev => Math.max(0, prev - 40));

        // Ball bounces off goalkeeper's gloves
        setPenaltyBallState(prev => ({
          ...prev,
          x: ballTargetX + (ballTargetX < 50 ? -12 : 12),
          y: ballTargetY + 16,
          scale: 0.58,
        }));

        setPenaltyGoalBanner(
          isTimeout 
            ? "انتهى الوقت! ضاعت الركلة خارج المرمى ⌛❌ (-40)" 
            : `تصدي بطولي من قفاز الحارس للكرة [${targetIdx + 1}]! 🧤🚫 (-40)`
        );
      }
      setLastAnswerCorrect(isCorrect);
    }, 550);

    // Proceed to next question after 3.2 seconds
    setTimeout(() => {
      setIsAnswerRevealed(false);
      isAnswerRevealedRef.current = false;
      setLastAnswerCorrect(null);
      setPenaltyGoalBanner(null);
      setNetShaking(false);
      setKeeperGloveSpark(null);
      setPenaltyShotSpeed(null);
      setPenaltyStrikerState({ phase: "idle" });
      setPenaltyKeeperState({ diveDirection: "none", isDiving: false, hasDeflected: false });
      setPenaltyBallState({ isShooting: false, targetIdx: null, startX: 50, startY: 82, x: 50, y: 82, scale: 1, rotation: 0 });

      const latestChallenge = activeChallengeRef.current;
      const latestIdx = currentQuestionIdxRef.current;
      if (latestChallenge && latestIdx + 1 < latestChallenge.questions.length) {
        const nextIdx = latestIdx + 1;
        setCurrentQuestionIdx(nextIdx);
        currentQuestionIdxRef.current = nextIdx;
        startQuestionWithIntro(nextIdx, "penalty_shootout");
      } else {
        handleFinishGame();
      }
    }, 3200);
  };

  // --- CLOUD AIRPLANE GAME ENGINE ✈️☁️ ---
  const setupCloudAirplane = (q?: Question) => {
    const targetQ = q || activeChallengeRef.current?.questions[currentQuestionIdxRef.current];
    if (!targetQ || !targetQ.options || targetQ.options.length === 0) return;

    if (airplaneLoopRef.current) {
      cancelAnimationFrame(airplaneLoopRef.current);
      airplaneLoopRef.current = null;
    }

    cloudDomRefs.current = {};
    setAirplanePos({ x: 18, y: 48 });
    airplanePosRef.current = { x: 18, y: 48 };
    setAirplaneAngle(0);
    airplaneAngleRef.current = 0;
    airplaneVelocityRef.current = { vx: 0, vy: 0 };
    airplaneArrowHoldRef.current = { up: false, down: false, left: false, right: false };
    setAirplaneTargetCloud(null);
    setAirplaneState("flying");
    setCloudBurstEffect(null);
    setAirplaneBanner(null);

    // Staggered vertical flight altitudes
    const numOpts = targetQ.options.length;
    const lanes = 
      numOpts === 2 ? [30, 64] :
      numOpts === 3 ? [24, 48, 72] :
      [18, 38, 58, 78];

    // Starting X positions: clouds drift smoothly into view
    const startXOffsets = 
      numOpts === 2 ? [65, 105] :
      numOpts === 3 ? [55, 85, 115] :
      [50, 75, 100, 125];

    const initialClouds = targetQ.options.map((opt, i) => {
      const baseY = lanes[i % lanes.length];
      const startX = startXOffsets[i % startXOffsets.length];
      return {
        idx: i,
        text: opt,
        x: startX,
        y: baseY,
        baseY,
        speed: 0.30 + (i % 2) * 0.05, // Upgraded from 0.18 for engaging, brisk game pacing
        waveOffset: i * 1.5
      };
    });

    airplaneCloudsRef.current = initialClouds;
    setAirplaneClouds(initialClouds);

    startCloudAirplaneLoop();
  };

  const startCloudAirplaneLoop = () => {
    if (airplaneLoopRef.current) cancelAnimationFrame(airplaneLoopRef.current);

    let lastTime = performance.now();
    let timeElapsed = 0;

    const animate = (now: number) => {
      // If answer is revealed or challenge ended, pause loop
      if (isAnswerRevealedRef.current) {
        if (airplaneLoopRef.current) cancelAnimationFrame(airplaneLoopRef.current);
        airplaneLoopRef.current = null;
        return;
      }

      // If in intro preview or countdown, keep animation frame scheduled so it begins seamlessly when intro ends!
      if (isQuestionIntroRef.current) {
        lastTime = now;
        airplaneLoopRef.current = requestAnimationFrame(animate);
        return;
      }

      const dt = Math.min((now - lastTime) / 16.66, 2.0);
      lastTime = now;
      timeElapsed += dt * 0.035;

      // Smooth keyboard & on-screen arrow steering inputs
      const keys = keysPressedRef.current;
      const hold = airplaneArrowHoldRef.current;
      let inputY = 0;
      let inputX = 0;

      if (keys["ArrowUp"] || keys["w"] || keys["W"] || hold.up) inputY -= 1;
      if (keys["ArrowDown"] || keys["s"] || keys["S"] || hold.down) inputY += 1;
      if (keys["ArrowLeft"] || keys["a"] || keys["A"] || hold.left) inputX -= 1;
      if (keys["ArrowRight"] || keys["d"] || keys["D"] || hold.right) inputX += 1;

      // Aerodynamic Physics Parameters - Upgraded for mobile agility & high performance
      const maxVy = 1.45; // % per frame (responsive vertical climb/dive)
      const maxVx = 1.15; // % per frame

      let targetVy = inputY * maxVy;
      let targetVx = inputX * maxVx;

      // Direct touch dragging tracking (overrides key steer smoothly when dragging finger)
      if (touchTargetYRef.current !== null) {
        const diffY = touchTargetYRef.current - airplanePosRef.current.y;
        targetVy = Math.max(-1.5, Math.min(1.5, diffY * 0.18));
      }

      if (targetVy !== 0) {
        // Accelerate smoothly into climb or dive
        airplaneVelocityRef.current.vy += (targetVy - airplaneVelocityRef.current.vy) * Math.min(1, 0.26 * dt);
      } else {
        // Natural aerodynamic glide friction
        airplaneVelocityRef.current.vy *= Math.pow(0.85, dt);
      }

      if (targetVx !== 0) {
        // Accelerate smoothly forward/backward
        airplaneVelocityRef.current.vx += (targetVx - airplaneVelocityRef.current.vx) * Math.min(1, 0.26 * dt);
      } else {
        airplaneVelocityRef.current.vx *= Math.pow(0.85, dt);
      }

      // Integrate positions
      let nextX = airplanePosRef.current.x + airplaneVelocityRef.current.vx * dt;
      let nextY = airplanePosRef.current.y + airplaneVelocityRef.current.vy * dt;

      // Soft borders clamping
      if (nextY < 14) {
        nextY = 14;
        airplaneVelocityRef.current.vy = 0;
      } else if (nextY > 82) {
        nextY = 82;
        airplaneVelocityRef.current.vy = 0;
      }

      if (nextX < 8) {
        nextX = 8;
        airplaneVelocityRef.current.vx = 0;
      } else if (nextX > 78) {
        nextX = 78;
        airplaneVelocityRef.current.vx = 0;
      }

      airplanePosRef.current = { x: nextX, y: nextY };

      // Realistic Aerodynamic Banking & Pitch Angle
      const targetPitch = Math.max(-20, Math.min(20, airplaneVelocityRef.current.vy * 16));
      airplaneAngleRef.current += (targetPitch - airplaneAngleRef.current) * Math.min(1, 0.18 * dt);

      // Gentle cruising oscillation
      const airFloat = Math.sin(timeElapsed * 1.8) * 0.45;
      const renderY = nextY + airFloat;

      // High-performance Direct DOM transformation (zero React reconciliation lag)
      if (airplaneSpriteRef.current) {
        airplaneSpriteRef.current.style.left = `${nextX}%`;
        airplaneSpriteRef.current.style.top = `${renderY}%`;
        airplaneSpriteRef.current.style.transform = `translate(-50%, -50%) rotate(${airplaneAngleRef.current.toFixed(1)}deg)`;
      }

      const currentClouds = airplaneCloudsRef.current;
      if (!currentClouds || currentClouds.length === 0) {
        airplaneLoopRef.current = requestAnimationFrame(animate);
        return;
      }

      const planePos = airplanePosRef.current;
      let collidingCloud: (typeof currentClouds)[0] | null = null;

      // Direct in-place mutation of clouds - zero GC allocation
      for (let i = 0; i < currentClouds.length; i++) {
        const c = currentClouds[i];
        let cloudNextX = c.x - (c.speed || 0.30) * dt;

        // If cloud flew past screen to far left (-25%), wrap around to the right
        if (cloudNextX < -25) {
          cloudNextX = 110 + (c.idx * 16);
        }

        const waveY = c.baseY + Math.sin(timeElapsed + c.waveOffset) * 2.0;
        c.x = cloudNextX;
        c.y = waveY;

        // Collision detection between airplane and cloud
        if (!collidingCloud && !isAnswerRevealedRef.current) {
          const distDx = Math.abs(cloudNextX - planePos.x);
          const distDy = Math.abs(waveY - planePos.y);
          if (distDx < 13.0 && distDy < 11.5) {
            collidingCloud = { ...c, x: cloudNextX, y: waveY };
          }
        }

        const el = cloudDomRefs.current[c.idx];
        if (el) {
          el.style.left = `${cloudNextX}%`;
          el.style.top = `${waveY}%`;
        }
      }

      // Collision triggered!
      if (collidingCloud) {
        if (airplaneLoopRef.current) cancelAnimationFrame(airplaneLoopRef.current);
        airplaneLoopRef.current = null;
        airplaneVelocityRef.current = { vx: 0, vy: 0 };
        touchTargetYRef.current = null;
        handleAirplaneCollision(collidingCloud);
        return;
      }

      airplaneLoopRef.current = requestAnimationFrame(animate);
    };

    airplaneLoopRef.current = requestAnimationFrame(animate);
  };

  const steerAirplaneVertical = (deltaY: number) => {
    if (isAnswerRevealedRef.current || isQuestionIntroRef.current) return;
    airplaneVelocityRef.current.vy = Math.max(-1.45, Math.min(1.45, airplaneVelocityRef.current.vy + (deltaY < 0 ? -0.75 : 0.75)));
  };

  const steerAirplaneHorizontal = (deltaX: number) => {
    if (isAnswerRevealedRef.current || isQuestionIntroRef.current) return;
    airplaneVelocityRef.current.vx = Math.max(-1.15, Math.min(1.15, airplaneVelocityRef.current.vx + (deltaX < 0 ? -0.55 : 0.55)));
  };

  const handleArenaPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isAnswerRevealedRef.current || isQuestionIntroRef.current) return;
    if (!airplaneArenaRef.current) return;
    const rect = airplaneArenaRef.current.getBoundingClientRect();
    arenaRectCacheRef.current = rect;
    isTouchDraggingRef.current = true;
    if (rect.height > 0) {
      const relY = ((e.clientY - rect.top) / rect.height) * 100;
      touchTargetYRef.current = Math.max(14, Math.min(82, relY));
    }
  };

  const handleArenaPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isAnswerRevealedRef.current || isQuestionIntroRef.current) return;
    if (!isTouchDraggingRef.current) return;
    let rect = arenaRectCacheRef.current;
    if (!rect && airplaneArenaRef.current) {
      rect = airplaneArenaRef.current.getBoundingClientRect();
      arenaRectCacheRef.current = rect;
    }
    if (!rect || rect.height <= 0) return;
    const relY = ((e.clientY - rect.top) / rect.height) * 100;
    touchTargetYRef.current = Math.max(14, Math.min(82, relY));
  };

  const handleArenaPointerUp = () => {
    isTouchDraggingRef.current = false;
    touchTargetYRef.current = null;
  };

  const handleAirplaneCollision = (cloudItem: { idx: number; text: string; x: number; y: number }) => {
    if (isAnswerRevealedRef.current || isQuestionIntroRef.current) return;
    const q = activeChallengeRef.current?.questions[currentQuestionIdxRef.current];
    if (!q) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (airplaneLoopRef.current) cancelAnimationFrame(airplaneLoopRef.current);
    airplaneLoopRef.current = null;

    isAnswerRevealedRef.current = true;
    setIsAnswerRevealed(true);
    setSelectedAnswerIdx(cloudItem.idx);

    const isTimeout = cloudItem.idx === -1;
    const isCorrect = !isTimeout && checkIsCorrect(q, cloudItem.idx);

    setAirplaneTargetCloud(cloudItem.idx);
    setAirplanePos({ x: cloudItem.x, y: cloudItem.y });
    airplanePosRef.current = { x: cloudItem.x, y: cloudItem.y };
    if (airplaneSpriteRef.current) {
      airplaneSpriteRef.current.style.left = `${cloudItem.x}%`;
      airplaneSpriteRef.current.style.top = `${cloudItem.y}%`;
      airplaneSpriteRef.current.style.transform = `translate(-50%, -50%) rotate(0deg)`;
    }

    if (isCorrect) {
      sfx.playCorrect();
      sfx.playCloudBurst();
      setAirplaneState("celebrating");
      setCloudBurstEffect({ cloudIdx: cloudItem.idx, type: "correct" });
      setAirplaneBanner("صحيح! 🎉");
      setAirplaneBannerType("correct");
      setCorrectCount(prev => prev + 1);
      setStreak(prev => prev + 1);
      const streakBonus = streak >= 2 ? 50 : 0;
      setScore(prev => prev + 150 + streakBonus);

      // Sparkle particles around cloud
      const colors = ["#38bdf8", "#34d399", "#fcd34d", "#f43f5e", "#a7f3d0", "#ffffff"];
      const newParticles = Array.from({ length: 24 }).map(() => ({
        id: Math.random(),
        x: cloudItem.x + (Math.random() - 0.5) * 14,
        y: cloudItem.y + (Math.random() - 0.5) * 12,
        color: colors[Math.floor(Math.random() * colors.length)]
      }));
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 900);
    } else {
      sfx.playIncorrect();
      sfx.playLightningBuzz();
      setAirplaneState("hit_wrong");
      if (cloudItem.idx >= 0) {
        setCloudBurstEffect({ cloudIdx: cloudItem.idx, type: "wrong" });
      }
      setAirplaneBanner("خطأ!");
      setAirplaneBannerType("wrong");
      setStreak(0);
      setAirplaneLives(prev => Math.max(0, prev - 1));
      setScore(prev => Math.max(0, prev - 40));
    }
    setLastAnswerCorrect(isCorrect);

    // Reset and advance to next question after 2.8 seconds
    setTimeout(() => {
      setIsAnswerRevealed(false);
      isAnswerRevealedRef.current = false;
      setLastAnswerCorrect(null);
      setAirplaneBanner(null);
      setCloudBurstEffect(null);
      setAirplaneTargetCloud(null);
      setAirplaneState("flying");
      setAirplaneAngle(0);
      airplaneAngleRef.current = 0;
      setAirplanePos({ x: 18, y: 48 });
      airplanePosRef.current = { x: 18, y: 48 };
      if (airplaneSpriteRef.current) {
        airplaneSpriteRef.current.style.left = `18%`;
        airplaneSpriteRef.current.style.top = `48%`;
        airplaneSpriteRef.current.style.transform = `translate(-50%, -50%) rotate(0deg)`;
      }

      const latestChallenge = activeChallengeRef.current;
      const latestIdx = currentQuestionIdxRef.current;
      if (latestChallenge && latestIdx + 1 < latestChallenge.questions.length) {
        const nextIdx = latestIdx + 1;
        setCurrentQuestionIdx(nextIdx);
        currentQuestionIdxRef.current = nextIdx;
        startQuestionWithIntro(nextIdx, "cloud_airplane");
      } else {
        handleFinishGame();
      }
    }, 2800);
  };

  const handleAirplaneHitCloud = (targetIdx: number) => {
    if (isAnswerRevealedRef.current || isQuestionIntroRef.current) return;
    const q = activeChallengeRef.current?.questions[currentQuestionIdxRef.current];
    if (!q) return;

    if (targetIdx === -1) {
      handleAirplaneCollision({ idx: -1, text: "", x: 50, y: 50 });
      return;
    }

    const foundCloud = airplaneCloudsRef.current.find(c => c.idx === targetIdx);
    const cloud = foundCloud || {
      idx: targetIdx,
      text: q.options[targetIdx] || "",
      x: 50,
      y: 40
    };

    setAirplaneTargetCloud(targetIdx);
    setAirplaneState("zooming");
    const dx = cloud.x - airplanePosRef.current.x;
    const dy = cloud.y - airplanePosRef.current.y;
    const angleDeg = Math.max(-30, Math.min(30, (Math.atan2(dy, dx) * 180) / Math.PI));
    setAirplaneAngle(angleDeg);
    airplaneAngleRef.current = angleDeg;
    setAirplanePos({ x: cloud.x, y: cloud.y });
    airplanePosRef.current = { x: cloud.x, y: cloud.y };
    if (airplaneSpriteRef.current) {
      airplaneSpriteRef.current.style.left = `${cloud.x}%`;
      airplaneSpriteRef.current.style.top = `${cloud.y}%`;
      airplaneSpriteRef.current.style.transform = `translate(-50%, -50%) rotate(${angleDeg}deg)`;
    }
    sfx.playAirplaneSwoop();

    setTimeout(() => {
      handleAirplaneCollision(cloud);
    }, 280);
  };

  // --- MAZE CHASE GAME ENGINE ---
  // 7 x 9 Grid
  // 1 = Wall, 0 = Path, 10 = Door 0 (Top-Left), 11 = Door 1 (Top-Right), 12 = Door 2 (Bottom-Left), 13 = Door 3 (Bottom-Right)
  const MAZE_GRID = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 10, 0, 1, 0, 1, 0, 11, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 0, 0, 1, 0, 1],
    [1, 12, 0, 1, 0, 1, 0, 13, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1]
  ];

  const setupMazeGame = (q: Question) => {
    setMazePlayerPos({ r: 3, c: 4 });
    mazePlayerPosRef.current = { r: 3, c: 4 };
    setMazeMonsters([
      { id: 1, r: 1, c: 4, type: "👾" },
      { id: 2, r: 5, c: 4, type: "👹" },
      { id: 3, r: 3, c: 2, type: "👾" },
      { id: 4, r: 3, c: 6, type: "👾" }
    ]);
    setMazeLives(3);
    mazeLivesRef.current = 3;
  };

  const startMazeGameLoop = () => {
    if (mazeIntervalRef.current) clearInterval(mazeIntervalRef.current);
    mazeIntervalRef.current = setInterval(() => {
      if (gameStateRef.current !== "playing" || isQuestionIntroRef.current || isAnswerRevealedRef.current) return;

      setMazeMonsters(prev => {
        const updated = prev.map(m => {
          const dirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
          ];
          const valid = dirs
            .map(d => ({ r: m.r + d.dr, c: m.c + d.dc }))
            .filter(pos => pos.r >= 0 && pos.r < 7 && pos.c >= 0 && pos.c < 9 && MAZE_GRID[pos.r][pos.c] !== 1);
          if (valid.length === 0) return m;
          const nextPos = valid[Math.floor(Math.random() * valid.length)];
          return { ...m, r: nextPos.r, c: nextPos.c };
        });
        mazeMonstersRef.current = updated;
        return updated;
      });

      const curPlayer = mazePlayerPosRef.current;
      const curMonsters = mazeMonstersRef.current;
      const hit = curMonsters.some(m => m.r === curPlayer.r && m.c === curPlayer.c);
      if (hit) {
        handleMazeMonsterHit();
      }
    }, 650);
  };

  const handleMazeMonsterHit = () => {
    if (isAnswerRevealedRef.current) return;
    sfx.playIncorrect();
    setScore(s => Math.max(0, s - 30));
    setMazeLives(prev => {
      const nextLives = Math.max(0, prev - 1);
      mazeLivesRef.current = nextLives;
      if (nextLives <= 0) {
        handleMazeDoorEntered(-1);
      }
      return nextLives;
    });
    setMazePlayerPos({ r: 3, c: 4 });
    mazePlayerPosRef.current = { r: 3, c: 4 };
  };

  const handleMoveMazePlayer = (dir: 'up' | 'down' | 'left' | 'right') => {
    if (gameStateRef.current !== "playing" || isQuestionIntroRef.current || isAnswerRevealedRef.current) return;

    let dr = 0, dc = 0;
    if (dir === 'up') dr = -1;
    if (dir === 'down') dr = 1;
    if (dir === 'left') dc = -1;
    if (dir === 'right') dc = 1;

    const cur = mazePlayerPosRef.current;
    const newR = cur.r + dr;
    const newC = cur.c + dc;

    if (newR < 0 || newR >= 7 || newC < 0 || newC >= 9) return;
    const cellVal = MAZE_GRID[newR][newC];
    if (cellVal === 1) return;

    setMazePlayerPos({ r: newR, c: newC });
    mazePlayerPosRef.current = { r: newR, c: newC };

    if (cellVal >= 10 && cellVal <= 13) {
      const doorIdx = cellVal - 10;
      handleMazeDoorEntered(doorIdx);
      return;
    }

    const curMonsters = mazeMonstersRef.current;
    const hit = curMonsters.some(m => m.r === newR && m.c === newC);
    if (hit) {
      handleMazeMonsterHit();
    }
  };

  const handleMazeDoorEntered = (doorIdx: number) => {
    if (isAnswerRevealedRef.current) return;
    const challenge = activeChallengeRef.current;
    if (!challenge) return;
    const q = challenge.questions[currentQuestionIdxRef.current];
    if (!q) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mazeIntervalRef.current) clearInterval(mazeIntervalRef.current);

    const isCorrect = doorIdx >= 0 && doorIdx < (q.options?.length || 0) && checkIsCorrect(q, doorIdx);

    setLastAnswerCorrect(isCorrect);
    setIsAnswerRevealed(true);
    isAnswerRevealedRef.current = true;

    if (isCorrect) {
      sfx.playCorrect();
      setScore(s => s + 150);
      setCorrectCount(c => c + 1);
    } else {
      sfx.playIncorrect();
      setScore(s => Math.max(0, s - 30));
    }

    setTimeout(() => {
      setIsAnswerRevealed(false);
      isAnswerRevealedRef.current = false;

      const nextIdx = currentQuestionIdxRef.current + 1;
      if (nextIdx < challenge.questions.length) {
        setCurrentQuestionIdx(nextIdx);
        currentQuestionIdxRef.current = nextIdx;
        startQuestionWithIntro(nextIdx, "maze_chase");
      } else {
        handleFinishGame();
      }
    }, 2000);
  };

  // Start Waygground Arena Timer
  const startWaygroundTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setTimeLeft(15);
    isAnswerRevealedRef.current = false;
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
    setIsAnswerRevealed(false);
    isAnswerRevealedRef.current = false;
    setSelectedAnswerIdx(null);
    setLastAnswerCorrect(null);
    sfx.playCorrect();

    const challenge = activeChallengeRef.current || activeChallenge;
    if (!challenge) return;

    if (isDemoMode || activeStudent?.id === "teacher-demo-user") {
      triggerToast(`🧪 تم تجربة وإكمال اللعبة بنجاح! النقاط التجريبية: ${score}`, "info");
      return;
    }

    const scoreId = `${challenge.id}_${activeStudent.id}`;
    const finalScoreData: ReviewScore = {
      id: scoreId,
      challengeId: challenge.id,
      studentId: activeStudent.id,
      studentName: activeStudent.name,
      gradeClass: activeStudent.gradeClass || "غير محدد",
      score: score,
      correctCount: correctCount,
      totalCount: challenge.questions.length,
      timeSpentSeconds: timeSpent || 1,
      completedAt: new Date().toISOString(),
      teacherId: challenge.teacherId || activeStudent.teacherId || teacherId || ""
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
    const challenge = activeChallengeRef.current || activeChallenge;
    if (isAnswerRevealedRef.current || !challenge) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    setSelectedAnswerIdx(ansIdx);
    setIsAnswerRevealed(true);
    isAnswerRevealedRef.current = true;

    const currentIdx = currentQuestionIdxRef.current;
    const currentQ = challenge.questions[currentIdx];
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
      const latestChallenge = activeChallengeRef.current || challenge;
      const latestIdx = currentQuestionIdxRef.current;
      if (latestChallenge && latestIdx + 1 < latestChallenge.questions.length) {
        const nextIdx = latestIdx + 1;
        setCurrentQuestionIdx(nextIdx);
        currentQuestionIdxRef.current = nextIdx;
        setSelectedAnswerIdx(null);
        setIsAnswerRevealed(false);
        isAnswerRevealedRef.current = false;
        setLastAnswerCorrect(null);
        startWaygroundTimer();
      } else {
        saveWaygroundFinalScore();
      }
    }, 2500);
  };

  // Waygground 50/50 Lifeline
  const useFiftyFifty = () => {
    const challenge = activeChallengeRef.current || activeChallenge;
    if (fiftyFiftyUsed || isAnswerRevealedRef.current || !challenge) return;
    const currentIdx = currentQuestionIdxRef.current;
    const currentQ = challenge.questions[currentIdx];
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
    if (doubleScoreUsed || isAnswerRevealedRef.current) return;
    setDoubleScoreActive(true);
    setDoubleScoreUsed(true);
    sfx.playLaser();
    triggerToast("تفعيل مضاعف النقاط للسؤال الحالي! ⚡🔥", "success");
  };

  // Waygground Skip Question Lifeline
  const useSkipQuestion = () => {
    const challenge = activeChallengeRef.current || activeChallenge;
    if (skipUsed || isAnswerRevealedRef.current || !challenge) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    setSkipUsed(true);
    sfx.playLaser();
    setIsAnswerRevealed(true);
    isAnswerRevealedRef.current = true;
    setLastAnswerCorrect(true); // Treat as visual correct so it turns green
    triggerToast("تم تخطي السؤال الحالي بنجاح! 🛡️✨", "success");

    setTimeout(() => {
      setDoubleScoreActive(false);
      setDisabledOptionIndices([]);
      const latestChallenge = activeChallengeRef.current || challenge;
      const latestIdx = currentQuestionIdxRef.current;
      if (latestChallenge && latestIdx + 1 < latestChallenge.questions.length) {
        const nextIdx = latestIdx + 1;
        setCurrentQuestionIdx(nextIdx);
        currentQuestionIdxRef.current = nextIdx;
        setSelectedAnswerIdx(null);
        setIsAnswerRevealed(false);
        isAnswerRevealedRef.current = false;
        setLastAnswerCorrect(null);
        startWaygroundTimer();
      } else {
        saveWaygroundFinalScore();
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

  // Handle Space Invader shooting a meteor with a fast straight-up vertical Rocket launch 🚀
  const handleShootMeteor = (meteor: any) => {
    const challenge = activeChallengeRef.current;
    if (!challenge || isAnswerRevealedRef.current) return;
        
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);

    const currentM = (fallingMeteorsRef.current || []).find(it => it.idx === meteor.idx) || meteor;
    const targetX = meteor.x;
    const targetY = currentM.y !== undefined ? currentM.y : meteor.y;
    // Impact point directly at the meteor target option card
    const impactY = Math.max(4, targetY);

    // Instantly align player spaceship directly underneath target option for straight vertical flight
    setShipX(targetX);
    shipXRef.current = targetX;
    if (playerShipRef.current) playerShipRef.current.style.left = `${targetX}%`;
        
    // Play sound effect
    sfx.playLaser();
        
    // Launch Rocket straight up vertically directly to the meteor collision spot
    setLaunchedRocket({
      active: true,
      startX: targetX,
      targetX: targetX,
      targetY: impactY
    });

    setIsAnswerRevealed(true);
    isAnswerRevealedRef.current = true;
    if (fallingMeteorsRef.current) {
      setFallingMeteors([...fallingMeteorsRef.current]);
    }

    const currentIdx = currentQuestionIdxRef.current;
    const currentQ = challenge.questions[currentIdx];
    if (!currentQ) return;

    const isCorrect = meteor.isCorrect !== undefined ? meteor.isCorrect : checkIsCorrect(currentQ, meteor.idx);

    // Rocket travels straight up and hits meteor directly upon collision after 0.3 seconds
    setTimeout(() => {
      setLaunchedRocket(null); // Rocket disappears immediately on collision impact!
      const colors = ["#fbbf24", "#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#22d3ee"];
      const newParticles = Array.from({ length: 24 }).map(() => ({
        id: Math.random(),
        x: targetX + (Math.random() - 0.5) * 8,
        y: impactY + (Math.random() - 0.5) * 8,
        color: colors[Math.floor(Math.random() * colors.length)]
      }));
      setParticles(newParticles);

      if (isCorrect) {
        sfx.playExplosion();
        setCorrectCount(prev => prev + 1);
        setScore(prev => prev + 150);
      } else {
        sfx.playIncorrect();
      }
      setLastAnswerCorrect(isCorrect);
    }, 300);

    // Clear particles / explosion after impact
    setTimeout(() => {
      setParticles([]);
    }, 1200);

    // Move to next question after 2.8 seconds
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
    }, 2800);
  };

  // Finish Game and save Score
  const handleFinishGame = async () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (gameSecondsRef.current) clearInterval(gameSecondsRef.current);
    if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
    if (airplaneLoopRef.current) cancelAnimationFrame(airplaneLoopRef.current);
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);
    if (gameIntroTimerRef.current) clearTimeout(gameIntroTimerRef.current);
    setIsQuestionIntro(false);
    isQuestionIntroRef.current = false;
    setGameIntroStage("none");

    setGameState("finished");
    setHasFinishedWaygroundQuestions(true);
    sfx.playCorrect();

    if (!activeChallenge) return;

    if (isDemoMode || activeStudent?.id === "teacher-demo-user") {
      triggerToast(`🧪 تم تجربة وإكمال اللعبة بنجاح! نتيجتك الافتراضية: ${score} نقطة`, "info");
      return;
    }

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
    if (airplaneLoopRef.current) cancelAnimationFrame(airplaneLoopRef.current);
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);
    if (gameIntroTimerRef.current) clearTimeout(gameIntroTimerRef.current);
    sfx.stopBGM();
    setIsQuestionIntro(false);
    isQuestionIntroRef.current = false;
    setGameIntroStage("none");

    if (activeChallenge) {
      dismissedChallengeIdsRef.current.add(activeChallenge.id);
      if (activeChallenge.gameType) {
        dismissedChallengeIdsRef.current.add(activeChallenge.gameType);
      }
      clearSavedProgressForChallenge(activeChallenge.id, activeChallenge.gameType);
    }

    setGameState("idle");
    setActiveChallenge(null);
    activeChallengeRef.current = null;
    prevLiveStateRef.current = undefined;
    setPodiumSecondsLeft(null);
    setScore(0);
    setCorrectCount(0);
    setHasFinishedWaygroundQuestions(false);
    setCurrentQuestionIdx(0);
    setSelectedAnswerIdx(null);
    setIsAnswerRevealed(false);
    setFallingMeteors([]);
    fallingMeteorsRef.current = [];
    setLaunchedRocket(null);
    setParticles([]);
    sessionBestScoresRef.current = {};

    // Clear live presence in Firestore so the student is marked as inactive
    const studentIdToUse = activeStudent?.id || "teacher-demo-user";
    const presenceRef = doc(db, "livePlayroomPresence", studentIdToUse);
    setDoc(presenceRef, {
      active: false,
      challengeId: "",
      gameType: "",
      finished: false,
      score: 0,
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(() => {});

    triggerToast("تم إنهاء اللعبة وإلغاؤها بنجاح والعودة للرئيسية 🚪", "info");

    if (onExitDemo) {
      onExitDemo();
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Demo Mode Top Header Banner */}
      {isDemoMode && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white p-3.5 px-5 rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3 border border-amber-300/40 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-white/20 rounded-xl text-xl backdrop-blur-xs">🧪</span>
            <div>
              <h3 className="font-black text-sm sm:text-base">وضع التجربة والمعاينة للمعلم (بيانات ونقاط تجريبية)</h3>
              <p className="text-[11px] text-amber-100 font-bold">تجري الآن محاكاة حية لتجربة الطالب في اللعبة دون تسجيل أي نتائج للطلاب الفعليين.</p>
            </div>
          </div>
          <button
            onClick={handleExitGame}
            className="px-4 py-2 bg-white text-slate-900 hover:bg-amber-100 font-black text-xs rounded-xl shadow-md transition transform hover:scale-105 active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <span>🚪 إنهاء اللعبة والعودة</span>
          </button>
        </div>
      )}

      {/* Sound Controller & Next Challenge Float (Visible in Idle state) */}
      {gameState === "idle" && (
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200/80 shadow-sm transition-all">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5.5 h-5.5 text-indigo-600" />
              <h3 className="font-black text-sm text-slate-800">صالة الألعاب والتحديات بالمعمل 🎮</h3>
            </div>
            

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

              {/* Activated Games Highlight Banner */}
              {(() => {
                const activeFixedGames = [
                  { gameType: "wayground_arena", id: "fixed_game_wayground_arena" },
                  { gameType: "space_invaders", id: "fixed_game_space_invaders" },
                  { gameType: "car_racing", id: "fixed_game_car_racing" },
                  { gameType: "penalty_shootout", id: "fixed_game_penalty_shootout" },
                  { gameType: "cloud_airplane", id: "fixed_game_cloud_airplane" },
                ].filter(fg => resolveFixedGameForStudent(fg.gameType, fg.id).isActivated);

                if (activeFixedGames.length === 0) return null;
                return (
                  <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 rounded-2xl p-4 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 border border-emerald-400/40">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-xl shrink-0 animate-pulse">
                        ⚡
                      </div>
                      <div>
                        <h5 className="font-black text-sm sm:text-base">
                          توجد ألعاب مراجعة مفعلة ومتاحة للعب الآن! 🎮
                        </h5>
                        <p className="text-xs text-emerald-100 font-bold">
                          قام المعلم بتفعيل التحدي. يمكنك اختيار اللعبة أدناه والدخول إليها وقتما تشاء!
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-black bg-white/20 border border-white/30 px-3 py-1.5 rounded-xl whitespace-nowrap">
                      متاحة حالياً 🟢
                    </span>
                  </div>
                );
              })()}

              {/* 5 Approved Games Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                {[
                  {
                    gameType: "wayground_arena",
                    id: "fixed_game_wayground_arena",
                    badgeLabel: "QUIZ PLUS STYLE 🎪",
                    gameTitle: "Quiz Plus 🎪",
                    defaultTitle: "Quiz Plus 🎪",
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
                  },
                  {
                    gameType: "penalty_shootout",
                    id: "fixed_game_penalty_shootout",
                    badgeLabel: "PENALTY CUP ⚽",
                    gameTitle: "ركلات الترجيح ⚽",
                    defaultTitle: "ركلات الترجيح وكأس الأبطال ⚽",
                    desc: "تسديد ركلات الترجيح وهز شباك المرمى باختيار زاوية الإجابة الصحيحة",
                    headerBg: "bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 border-b-2 border-emerald-500/50",
                  },
                  {
                    gameType: "cloud_airplane",
                    id: "fixed_game_cloud_airplane",
                    badgeLabel: "CLOUD AIRPLANE ✈️",
                    gameTitle: "طائرة السحاب ✈️",
                    defaultTitle: "طائرة السحاب ✈️☁️",
                    desc: "التحليق بالطائرة في السماء واختراق السحب ذات الإجابات الصحيحة",
                    headerBg: "bg-gradient-to-br from-sky-600 via-sky-500 to-blue-600 border-b-2 border-sky-300/50",
                  }
                ].map((fg) => {
                  const { challenge, isActivated } = resolveFixedGameForStudent(fg.gameType, fg.id);
                  
                  const questionsCount = challenge?.questions?.length || 0;
                  const totalScoresCount = challenge ? reviewScores.filter(s => s.challengeId === challenge.id).length : 0;
                  const myBestScore = challenge ? reviewScores.find(s => s.challengeId === challenge.id && s.studentId === activeStudent?.id) : null;

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
                          {fg.gameType === "penalty_shootout" && (
                            <div className="space-y-1">
                              <div className="text-3xl animate-bounce">⚽</div>
                              <div className="flex justify-center gap-1.5 text-[9px] font-black text-white">
                                <span className="bg-emerald-600 px-1.5 py-0.5 rounded shadow-xs">🧤 حارس المرمى</span>
                                <span className="bg-amber-600 px-1.5 py-0.5 rounded shadow-xs">🥅 4 زوايا</span>
                              </div>
                            </div>
                          )}
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
                          {fg.gameType === "cloud_airplane" && (
                            <div className="space-y-1">
                              <div className="text-3xl animate-bounce">✈️</div>
                              <div className="flex justify-center gap-1.5 text-[9px] font-black text-white">
                                <span className="bg-sky-600 px-1.5 py-0.5 rounded shadow-xs">☁️ سحب الإجابات</span>
                                <span className="bg-blue-600 px-1.5 py-0.5 rounded shadow-xs">🕹️ توجيه الطائرة</span>
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
                              className="w-full py-3 text-white rounded-xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-95 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
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
        {(gameState === "playing" || gameState === "finished" || activeChallenge?.liveState === "podium") && activeChallenge && (
          <div className="bg-white text-slate-800 rounded-3xl border border-indigo-100 shadow-lg w-full">
            {/* Merged Active Top Bar Header - Sticky Top Bar containing controls, stats, and sticky Question Box */}
            <div className="w-full p-3.5 sm:p-4 bg-white/95 backdrop-blur-md border-b border-indigo-100 sticky top-0 z-50 rounded-t-3xl shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Right Group: Exit button & Challenge Title */}
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleExitGame}
                    className={`px-3.5 py-2 text-xs font-black rounded-xl cursor-pointer transition-all duration-150 flex items-center gap-1.5 shadow-xs border shrink-0 ${
                      hasFinishedWaygroundQuestions || gameState === "finished"
                        ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-500 shadow-md animate-pulse"
                        : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                    }`}
                  >
                    <LogOut className="w-4 h-4 rotate-180" />
                    <span>
                      {hasFinishedWaygroundQuestions || gameState === "finished"
                        ? "إغلاق وإنهاء اللعبة بدون تتويج 🚪"
                        : "خروج للصالة الرئيسية"}
                    </span>
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

                  {/* Time Remaining or Waiting for Coronation Badge */}
                  {hasFinishedWaygroundQuestions || (gameState === "finished" && activeChallenge.liveState && activeChallenge.liveState !== "podium") ? (
                    <div className="px-3 py-1 rounded-xl text-right border bg-amber-50 border-amber-300 text-amber-800 animate-pulse shadow-xs">
                      <span className="text-[9px] block font-bold text-amber-700">حالة الجولة:</span>
                      <span className="text-xs font-black block leading-none text-amber-900">
                        بانتظار التتويج 🏆
                      </span>
                    </div>
                  ) : gameState === "playing" ? (
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
                  ) : null}

                  <div className="h-6 w-px bg-slate-200 hidden sm:block" />

                  {/* Live Leaderboard Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (activeChallenge?.id) {
                        setSelectedLeaderboardChallengeId(activeChallenge.id);
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-xs border border-amber-300 flex items-center gap-1.5 cursor-pointer transition active:scale-95 shrink-0"
                    title="عرض جدول المتصدرين الحية"
                  >
                    <Trophy className="w-4 h-4 fill-slate-950 text-slate-950" />
                    <span className="hidden xs:inline">المتصدرين 🏆</span>
                  </button>

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

              {(gameState === "playing" || gameState === "finished" || activeChallenge.liveState === "podium") ? (
                // GAME IN PROGRESS SCREEN
                <>
                  {/* LIVE INTERACTIVE GAME: WAYGROUND ARENA (QUIZ PLUS) */}
                  {activeChallenge.gameType === "wayground_arena" && (
                    <div className="space-y-6 relative z-10 p-3 md:p-6 rounded-3xl bg-slate-950 border border-purple-900/60 shadow-2xl min-h-[580px] flex flex-col justify-between overflow-hidden">
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
                      ) : activeChallenge.liveState === "waiting" ? (
                        /* LOBBY VIEW */
                        <div className="flex flex-col flex-1 justify-between p-4 space-y-6 text-center relative z-10">
                          <div className="space-y-3 mt-4">
                            <motion.div
                              animate={{ scale: [1, 1.05, 1] }}
                              transition={{ repeat: Infinity, duration: 2 }}
                              className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-purple-900/60 border border-purple-500/40 text-purple-200 text-xs font-black shadow-lg"
                            >
                              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
                              <span>صالة الانتظار المباشرة للمعمل 🏟️</span>
                            </motion.div>
                            <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-md">
                              {activeChallenge.title}
                            </h3>
                            <p className="text-xs md:text-sm text-purple-200 max-w-lg mx-auto leading-relaxed font-bold">
                              أهلاً بك في المعركة الحاسمة! بمجرد اكتمال دخول زملائك الفرسان، سيطلق المعلم شارة بدء التحدي المباشر. استعد! 🔥
                            </p>
                          </div>

                          <div className="bg-slate-900/95 rounded-3xl border border-purple-800/60 p-6 space-y-4 my-auto max-w-3xl mx-auto w-full shadow-2xl backdrop-blur-md">
                            <div className="flex justify-between items-center pb-3 border-b border-purple-800/40">
                              <span className="text-xs md:text-sm font-black text-purple-200 flex items-center gap-2">
                                <Users className="w-4.5 h-4.5 text-purple-400" />
                                الفرسان المتواجدون بساحة الانتظار المباشرة ({liveActivePlayers.length})
                              </span>
                              <span className="text-[11px] font-bold text-yellow-400 animate-pulse bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                                مزامنة حية للمعمل ⚡
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[280px] overflow-y-auto p-1">
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
                                    className="p-3.5 rounded-2xl bg-purple-950/80 border border-purple-700/50 flex flex-col items-center justify-center text-center shadow-md hover:border-purple-400/50 transition duration-300"
                                  >
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center font-black text-xs mb-1.5 shadow-md">
                                      {(player.studentName || "ط").charAt(0)}
                                    </div>
                                    <span className="text-xs font-black text-white block truncate max-w-[110px]">
                                      {player.studentName || "طالب"}
                                    </span>
                                    <span className="text-[9px] text-purple-300 font-bold mt-0.5">
                                      {player.gradeClass || "عام"}
                                    </span>
                                  </motion.div>
                                ))}
                              </AnimatePresence>

                              {liveActivePlayers.length === 0 && (
                                <div className="col-span-full py-12 text-center text-slate-400 text-xs font-bold space-y-2">
                                  <Gamepad2 className="w-10 h-10 text-purple-400 mx-auto animate-bounce" />
                                  <p className="text-purple-200">في انتظار انضمام الفرسان... ابدأوا بالانضمام فوراً! 🏟️</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-purple-950/80 border border-purple-800/60 p-4 rounded-2xl max-w-xl mx-auto w-full flex items-center gap-3 text-right shadow-lg">
                            <span className="text-xl">💡</span>
                            <div>
                              <h5 className="text-xs font-black text-purple-200">تعليمات المعركة الحاسمة:</h5>
                              <p className="text-[10px] text-slate-300 leading-relaxed font-bold mt-0.5">
                                ستحصل على 15 ثانية لكل سؤال. استخدم وسائل المساعدة كحذف إجابتين (50:50) أو مضاعفة النقاط (2x) أو تخطي السؤال بحكمة لتتصدر الفرسان! 🎖️
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : activeChallenge.liveState === "podium" ? (
                        /* PODIUM VIEW FOR ALL STUDENTS WHEN TEACHER ANNOUNCES PODIUM OR GAME REACHES PODIUM STATE */
                        <div className="w-full flex flex-col items-center justify-center p-2 sm:p-4 relative">
                          {/* Header Bar with Title and Close Button */}
                          <div className="w-full flex items-center justify-between gap-3 mb-4 pb-3 border-b border-purple-800/40">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-black shadow-md">
                              <span>🏆 منصة تتويج أبطال التحدي المباشر 🏆</span>
                            </div>
                            <button
                              onClick={handleExitGame}
                              className="px-3.5 py-1.5 bg-rose-600/90 hover:bg-rose-500 border border-rose-400/40 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
                              title="إغلاق والعودة للرئيسية"
                            >
                              <span>إغلاق</span>
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="text-center space-y-2 mb-4">
                            <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-md">
                              أكمل جميع الطلاب الأسئلة بنجاح! 🎉
                            </h3>
                            <p className="text-xs md:text-sm text-slate-300 font-bold max-w-lg mx-auto">
                              مبارك للفرسان الفائزين بالمراكز الأولى! لقد حصلت على <span className="text-yellow-400 font-sans font-black">{score}</span> نقطة.
                            </p>
                          </div>

                          <LivePodiumView
                            scores={getPodiumScores()}
                            onReset={() => {}}
                            onClose={handleExitGame}
                            isAdmin={false}
                            podiumAt={activeChallenge.podiumAt}
                          />

                          {/* 20-Second Countdown Display */}
                          {podiumSecondsLeft !== null && (
                            <div className="mt-5 px-5 py-2.5 bg-gradient-to-r from-rose-500/20 via-amber-500/20 to-purple-500/20 border border-amber-400/30 text-amber-200 rounded-2xl text-xs sm:text-sm font-extrabold text-center shadow-lg flex items-center justify-center gap-2">
                              <span>⏱️ التوقيت التنازلي للإغلاق:</span>
                              <span className="font-sans font-black text-lg text-amber-300 bg-amber-950/80 px-3 py-0.5 rounded-lg border border-amber-500/40 min-w-[2.5rem] inline-block shadow-inner">
                                {podiumSecondsLeft}
                              </span>
                              <span>ثانية</span>
                            </div>
                          )}

                          {/* Close & Return Button */}
                          <div className="mt-5">
                            <button
                              onClick={handleExitGame}
                              className="px-7 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-300/30 text-white rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer shadow-xl flex items-center gap-2 active:scale-95"
                            >
                              <span>إغلاق والعودة للرئيسية</span>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (hasFinishedWaygroundQuestions || gameState === "finished" || currentQuestionIdx >= activeChallenge.questions.length) ? (
                        /* WAITING FOR OTHER PLAYERS SCREEN */
                        <div className="flex flex-col flex-1 items-center justify-center p-6 md:p-8 text-center space-y-6 my-auto">
                          <motion.div
                            animate={{ scale: [1, 1.12, 1], rotate: [0, 8, -8, 0] }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                            className="w-24 h-24 bg-gradient-to-tr from-amber-500/20 via-indigo-500/20 to-purple-500/20 rounded-full border-2 border-amber-400/50 flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(245,158,11,0.25)]"
                          >
                            ⌛
                          </motion.div>

                          <div className="space-y-3 max-w-lg mx-auto">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black shadow-md">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                              <span>الرجاء الانتظار... ⏳</span>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-md">
                              أحسنت! لقد أكملت جميع الأسئلة بنجاح 🎉
                            </h3>
                            <p className="text-sm text-slate-200 font-bold leading-relaxed">
                              أنهيت الإجابة على كافة الأسئلة وحصلت على <span className="text-yellow-400 font-sans font-black">{score}</span> نقطة.
                              <br />
                              <span className="text-indigo-200 font-normal text-xs mt-1 block">
                                يرجى الانتظار حتى يقوم المعلم بإعادة إعلان منصة التتويج والأبطال الفائزين! 🔥
                              </span>
                            </p>
                          </div>

                          {/* Stats Summary Card */}
                          <div className="bg-slate-900/95 border border-purple-800/80 p-5 rounded-2xl max-w-md w-full space-y-3 shadow-xl backdrop-blur-md">
                            <div className="text-right flex justify-between items-center text-xs font-bold text-indigo-200 pb-2 border-b border-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span>🌟</span>
                                <span>النقاط الإجمالية التي حصلت عليها:</span>
                              </span>
                              <span className="font-sans font-black text-base text-yellow-400">{score} ن</span>
                            </div>
                            <div className="text-right flex justify-between items-center text-xs font-bold text-indigo-200 pb-2 border-b border-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span>✅</span>
                                <span>الإجابات الصحيحة:</span>
                              </span>
                              <span className="font-sans font-black text-sm text-emerald-400">{correctCount} / {activeChallenge.questions.length}</span>
                            </div>
                            <div className="text-right flex justify-between items-center text-xs font-bold text-indigo-200 pb-2 border-b border-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span>⏱️</span>
                                <span>الزمن المستغرق:</span>
                              </span>
                              <span className="font-sans font-black text-sm text-cyan-300">{timeSpent} ثانية</span>
                            </div>
                            <div className="text-right flex justify-between items-center text-xs font-bold text-amber-300 pt-1">
                              <span className="flex items-center gap-1.5">
                                <span>👥</span>
                                <span>الطلاب الذين أنهوا التحدي:</span>
                              </span>
                              <span className="font-sans font-black text-xs text-amber-400">
                                {liveActivePlayers.filter(p => p.finished === true).length} من أصل {liveActivePlayers.length || 1} طالب
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-indigo-950/60 border border-indigo-500/30 rounded-xl max-w-md w-full text-xs font-bold text-indigo-200 flex items-center justify-center gap-2 animate-pulse">
                            <span>📡 جاري المتابعة مباشرة... ستظهر شاشة التتويج فوراً عند إكمال جميع الطلاب للتحدي!</span>
                          </div>

                          <div className="pt-2 w-full max-w-md mx-auto">
                            <button
                              type="button"
                              onClick={handleExitGame}
                              className="w-full py-3.5 px-6 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl text-xs sm:text-sm font-black shadow-xl shadow-rose-950/60 border border-rose-400/40 transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2.5 hover:brightness-110"
                            >
                              <LogOut className="w-4 h-4 rotate-180" />
                              <span>إغلاق وإنهاء اللعبة بدون تتويج 🚪</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Classic Kahoot / Quizizz Plus Question Card */}
                          <motion.div 
                            key={`quiz-q-${currentQuestionIdx}`}
                            initial={{ opacity: 0, scale: 0.96, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="bg-gradient-to-b from-purple-950 via-indigo-950 to-slate-950 border-2 border-purple-500/50 p-5 sm:p-7 rounded-3xl text-center shadow-2xl relative text-white space-y-4 overflow-hidden backdrop-blur-xl"
                          >
                            {/* Background ambient glow */}
                            <div className="absolute -top-10 -right-10 w-36 h-36 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-rose-600/20 rounded-full blur-3xl pointer-events-none" />

                            {/* Top info header: Question Counter & Lifelines */}
                            <div className="flex items-center justify-between gap-3 border-b border-purple-800/40 pb-3 flex-wrap">
                              <span className="px-3.5 py-1.5 rounded-full bg-purple-900/80 border border-purple-400/40 text-purple-200 text-xs font-black shadow-xs flex items-center gap-2">
                                <span>🎯 السؤال</span>
                                <span className="font-sans font-black text-yellow-300 text-sm">{currentQuestionIdx + 1}</span>
                                <span>من</span>
                                <span className="font-sans font-black text-purple-200 text-sm">{activeChallenge.questions.length}</span>
                              </span>

                              {/* Quiz Plus Lifelines */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={useFiftyFifty}
                                  disabled={fiftyFiftyUsed || isAnswerRevealed}
                                  className={`px-2.5 py-1 rounded-xl text-[11px] font-black border transition ${
                                    fiftyFiftyUsed ? "bg-slate-800 text-slate-500 border-slate-700 opacity-50 cursor-not-allowed" : "bg-purple-900/80 hover:bg-purple-800 text-purple-200 border-purple-500/50 shadow-xs active:scale-95 cursor-pointer"
                                  }`}
                                  title="حذف إجابتين (50:50)"
                                >
                                  <span>💥 50:50</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={useDoubleScore}
                                  disabled={doubleScoreUsed || isAnswerRevealed}
                                  className={`px-2.5 py-1 rounded-xl text-[11px] font-black border transition ${
                                    doubleScoreUsed ? "bg-slate-800 text-slate-500 border-slate-700 opacity-50 cursor-not-allowed" : "bg-amber-900/80 hover:bg-amber-800 text-amber-200 border-amber-500/50 shadow-xs active:scale-95 cursor-pointer"
                                  }`}
                                  title="مضاعفة النقاط (2x)"
                                >
                                  <span>⚡ 2x</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={useSkipQuestion}
                                  disabled={skipUsed || isAnswerRevealed}
                                  className={`px-2.5 py-1 rounded-xl text-[11px] font-black border transition ${
                                    skipUsed ? "bg-slate-800 text-slate-500 border-slate-700 opacity-50 cursor-not-allowed" : "bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border-indigo-500/50 shadow-xs active:scale-95 cursor-pointer"
                                  }`}
                                  title="تخطي السؤال"
                                >
                                  <span>🛡️ تخطي</span>
                                </button>
                              </div>
                            </div>

                            {/* Question Image (If Available) */}
                            {(activeChallenge.questions[currentQuestionIdx] as any)?.image && (
                              <div className="max-w-xs mx-auto overflow-hidden rounded-2xl border-2 border-purple-400/40 shadow-xl max-h-48">
                                <img
                                  src={(activeChallenge.questions[currentQuestionIdx] as any)?.image}
                                  alt="صورة السؤال"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}

                            {/* Main Question Text */}
                            <h3 className="text-base sm:text-lg md:text-xl font-black leading-relaxed text-white drop-shadow-md py-1">
                              {activeChallenge.questions[currentQuestionIdx]?.text}
                            </h3>
                          </motion.div>

                          {/* Thick Dynamic Color-Changing Timer Bar */}
                          <div className="w-full h-8 sm:h-9 bg-slate-950/90 rounded-2xl border-2 border-purple-500/50 p-1 shadow-2xl relative flex items-center justify-center overflow-hidden">
                            {/* Animated Dynamic Color Fill Bar */}
                            <div
                              className={`absolute inset-y-0 right-0 h-full rounded-xl transition-all duration-1000 ease-linear shadow-lg ${
                                timeLeft > 8
                                  ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 shadow-[0_0_20px_rgba(52,211,153,0.7)]"
                                  : timeLeft > 4
                                  ? "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 shadow-[0_0_20px_rgba(251,191,36,0.7)]"
                                  : "bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 shadow-[0_0_25px_rgba(244,63,94,0.9)] animate-pulse"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, (timeLeft / 15) * 100))}%` }}
                            />

                            {/* Time Remaining Label Overlay */}
                            <div className="relative z-10 flex items-center justify-center gap-2 px-3 text-xs sm:text-sm font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                              <Timer className={`w-4 sm:w-5 h-4 sm:h-5 ${timeLeft <= 4 ? "animate-spin text-white" : "animate-pulse text-white"}`} />
                              <span>الوقت المتبقي:</span>
                              <span className="font-sans font-black tracking-wider text-sm sm:text-base">{timeLeft} ثانية</span>
                            </div>
                          </div>

                          {/* Classic Kahoot 4 Color Option Cards with Geometric Shapes */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                            {activeChallenge.questions[currentQuestionIdx]?.options.map((opt, i) => {
                              const isSelected = selectedAnswerIdx === i;
                              const isCorrect = checkIsCorrect(activeChallenge.questions[currentQuestionIdx], i);
                              const isDisabledByFiftyFifty = disabledOptionIndices.includes(i);

                              // Classic 4 Kahoot Colors & Shapes configuration
                              const optionStyles = [
                                {
                                  // Option 0: Red / Crimson (Triangle 🔺)
                                  normalBg: "bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 border-red-400/80 text-white shadow-lg shadow-red-950/40",
                                  shapeBg: "bg-white/20 text-white fill-white",
                                  shapeSvg: (
                                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                      <polygon points="12 3, 22 21, 2 21" />
                                    </svg>
                                  )
                                },
                                {
                                  // Option 1: Royal Blue (Diamond 🔷)
                                  normalBg: "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 border-blue-400/80 text-white shadow-lg shadow-blue-950/40",
                                  shapeBg: "bg-white/20 text-white fill-white",
                                  shapeSvg: (
                                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                      <polygon points="12 2, 22 12, 12 22, 2 12" />
                                    </svg>
                                  )
                                },
                                {
                                  // Option 2: Gold / Yellow (Circle 🟡)
                                  normalBg: "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-400 border-amber-300 text-slate-950 font-black shadow-lg shadow-amber-950/40",
                                  shapeBg: "bg-black/15 text-slate-950 fill-slate-950",
                                  shapeSvg: (
                                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                      <circle cx="12" cy="12" r="9" />
                                    </svg>
                                  )
                                },
                                {
                                  // Option 3: Green / Emerald (Square 🟩)
                                  normalBg: "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 border-emerald-400/80 text-white shadow-lg shadow-emerald-950/40",
                                  shapeBg: "bg-white/20 text-white fill-white",
                                  shapeSvg: (
                                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                      <rect x="3" y="3" width="18" height="18" rx="3" />
                                    </svg>
                                  )
                                }
                              ];

                              const styleConfig = optionStyles[i % optionStyles.length];

                              let cardClass = `${styleConfig.normalBg} border-2`;
                              let statusBadge = null;

                              if (isDisabledByFiftyFifty) {
                                cardClass = "bg-slate-900/40 border-slate-800 text-slate-600 opacity-20 pointer-events-none grayscale";
                              } else if (isAnswerRevealed) {
                                if (isCorrect) {
                                  cardClass = "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 border-emerald-300 text-white ring-4 ring-emerald-400/90 shadow-[0_0_35px_rgba(52,211,153,0.7)] scale-[1.02] font-black z-20 brightness-110";
                                  statusBadge = (
                                    <span className="px-3 py-1 rounded-full bg-white text-emerald-700 text-xs font-black shadow-md flex items-center gap-1 shrink-0 animate-bounce">
                                      <Check className="w-4 h-4 stroke-[3]" />
                                      <span>إجابة صحيحة!</span>
                                    </span>
                                  );
                                } else if (isSelected) {
                                  cardClass = "bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 border-rose-300 text-white ring-4 ring-rose-500/90 shadow-[0_0_25px_rgba(244,63,94,0.7)] z-20 opacity-95";
                                  statusBadge = (
                                    <span className="px-3 py-1 rounded-full bg-white text-rose-700 text-xs font-black shadow-md flex items-center gap-1 shrink-0">
                                      <X className="w-4 h-4 stroke-[3]" />
                                      <span>إجابة خاطئة</span>
                                    </span>
                                  );
                                } else {
                                  cardClass = "bg-slate-900/60 border-slate-700/50 text-slate-400 opacity-25 grayscale-[40%] scale-98 pointer-events-none";
                                }
                              } else if (isSelected) {
                                cardClass += " ring-4 ring-white shadow-2xl scale-[1.02] z-20 brightness-110";
                              }

                              return (
                                <motion.button
                                  key={`kahoot-opt-${i}`}
                                  whileHover={{ scale: isAnswerRevealed || isDisabledByFiftyFifty ? 1 : 1.02 }}
                                  whileTap={{ scale: isAnswerRevealed || isDisabledByFiftyFifty ? 1 : 0.97 }}
                                  onClick={() => handleSelectAnswerWayground(i)}
                                  className={`min-h-[75px] sm:min-h-[85px] p-4 sm:p-5 rounded-2xl transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 text-right ${cardClass}`}
                                  disabled={isAnswerRevealed || isDisabledByFiftyFifty}
                                >
                                  {/* Right side: Geometric Shape Badge */}
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${styleConfig.shapeBg} flex items-center justify-center shrink-0 shadow-inner font-sans font-black text-lg`}>
                                      {styleConfig.shapeSvg}
                                    </div>
                                    <span className="text-sm sm:text-base font-black leading-snug break-words">
                                      {opt}
                                    </span>
                                  </div>

                                  {/* Left side: Status Badge when revealed */}
                                  {statusBadge}
                                </motion.button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* GAME TYPE 2: TIME ATTACK */}
                  {activeChallenge.gameType === "time_attack" && (
                    <div className="space-y-6 relative z-10">
                      {activeChallenge.liveState === "podium" ? (
                        /* PODIUM VIEW FOR ALL STUDENTS WHEN TEACHER ANNOUNCES PODIUM OR GAME REACHES PODIUM STATE */
                        <div className="w-full flex flex-col items-center justify-center p-2 sm:p-4 relative">
                          <div className="w-full flex items-center justify-between gap-3 mb-4 pb-3 border-b border-purple-800/40">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-black shadow-md">
                              <span>🏆 منصة تتويج أبطال سباق السرعة 🏆</span>
                            </div>
                            <button
                              onClick={handleExitGame}
                              className="px-3.5 py-1.5 bg-rose-600/90 hover:bg-rose-500 border border-rose-400/40 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
                              title="إغلاق والعودة للرئيسية"
                            >
                              <span>إغلاق</span>
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <LivePodiumView
                            scores={getPodiumScores()}
                            onReset={() => {}}
                            onClose={handleExitGame}
                            isAdmin={false}
                            podiumAt={activeChallenge.podiumAt}
                          />

                          {podiumSecondsLeft !== null && (
                            <div className="mt-5 px-5 py-2.5 bg-gradient-to-r from-rose-500/20 via-amber-500/20 to-purple-500/20 border border-amber-400/30 text-amber-200 rounded-2xl text-xs sm:text-sm font-extrabold text-center shadow-lg flex items-center justify-center gap-2">
                              <span>⏱️ التوقيت التنازلي للإغلاق:</span>
                              <span className="font-sans font-black text-lg text-amber-300 bg-amber-950/80 px-3 py-0.5 rounded-lg border border-amber-500/40 min-w-[2.5rem] inline-block shadow-inner">
                                {podiumSecondsLeft}
                              </span>
                              <span>ثانية</span>
                            </div>
                          )}

                          <div className="mt-5">
                            <button
                              onClick={handleExitGame}
                              className="px-7 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-300/30 text-white rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer shadow-xl flex items-center gap-2 active:scale-95"
                            >
                              <span>إغلاق والعودة للرئيسية</span>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (hasFinishedWaygroundQuestions || gameState === "finished") ? (
                        /* WAITING FOR OTHER PLAYERS SCREEN */
                        <div className="flex flex-col flex-1 items-center justify-center p-6 md:p-8 text-center space-y-6 my-auto">
                          <motion.div
                            animate={{ scale: [1, 1.12, 1], rotate: [0, 8, -8, 0] }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                            className="w-24 h-24 bg-gradient-to-tr from-amber-500/20 via-indigo-500/20 to-purple-500/20 rounded-full border-2 border-amber-400/50 flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(245,158,11,0.25)]"
                          >
                            ⌛
                          </motion.div>

                          <div className="space-y-3 max-w-lg mx-auto">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black shadow-md">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                              <span>الرجاء الانتظار... ⏳</span>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-md">
                              أحسنت! لقد أكملت جميع الأسئلة بنجاح 🎉
                            </h3>
                            <p className="text-sm text-slate-200 font-bold leading-relaxed">
                              أنهيت الإجابة على كافة الأسئلة وحصلت على <span className="text-yellow-400 font-sans font-black">{score}</span> نقطة.
                              <br />
                              <span className="text-indigo-200 font-normal text-xs mt-1 block">
                                يرجى الانتظار حتى يقوم المعلم بإعادة إعلان منصة التتويج والأبطال الفائزين! 🔥
                              </span>
                            </p>
                          </div>

                          <div className="p-3.5 bg-indigo-950/60 border border-indigo-500/30 rounded-xl max-w-md w-full text-xs font-bold text-indigo-200 flex items-center justify-center gap-2 animate-pulse">
                            <span>📡 جاري المتابعة مباشرة... ستظهر شاشة التتويج فوراً عند إكمال جميع الطلاب للتحدي!</span>
                          </div>

                          <div className="pt-2 w-full max-w-md mx-auto">
                            <button
                              type="button"
                              onClick={handleExitGame}
                              className="w-full py-3.5 px-6 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl text-xs sm:text-sm font-black shadow-xl shadow-rose-950/60 border border-rose-400/40 transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2.5 hover:brightness-110"
                            >
                              <LogOut className="w-4 h-4 rotate-180" />
                              <span>إغلاق وإنهاء اللعبة بدون تتويج 🚪</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
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

                          {/* Thick Color-Changing Timer Bar */}
                          <div className="w-full h-8 sm:h-9 bg-slate-950/90 rounded-2xl border-2 border-indigo-500/50 p-1 shadow-2xl relative flex items-center justify-center overflow-hidden">
                            {/* Animated Dynamic Color Fill Bar */}
                            <div
                              className={`absolute inset-y-0 right-0 h-full rounded-xl transition-all duration-1000 ease-linear shadow-lg ${
                                timeLeft > 8
                                  ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 shadow-[0_0_20px_rgba(52,211,153,0.7)]"
                                  : timeLeft > 4
                                  ? "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 shadow-[0_0_20px_rgba(251,191,36,0.7)]"
                                  : "bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 shadow-[0_0_25px_rgba(244,63,94,0.9)] animate-pulse"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, (timeLeft / 15) * 100))}%` }}
                            />

                            {/* Time Remaining Label Overlay */}
                            <div className="relative z-10 flex items-center justify-center gap-2 px-3 text-xs sm:text-sm font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                              <Timer className={`w-4 sm:w-5 h-4 sm:h-5 ${timeLeft <= 4 ? "animate-spin text-white" : "animate-pulse text-white"}`} />
                              <span>الوقت المتبقي:</span>
                              <span className="font-sans font-black tracking-wider text-sm sm:text-base">{timeLeft} ثانية</span>
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
                        </>
                      )}
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
                      {activeChallenge.liveState === "podium" ? (
                        /* PODIUM VIEW FOR ALL STUDENTS WHEN TEACHER ANNOUNCES PODIUM OR GAME REACHES PODIUM STATE */
                        <div className="w-full flex flex-col items-center justify-center p-2 sm:p-4 relative">
                          {/* Header Bar with Title and Close Button */}
                          <div className="w-full flex items-center justify-between gap-3 mb-4 pb-3 border-b border-purple-800/40">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-black shadow-md">
                              <span>🏆 منصة تتويج أبطال معركة الفضاء 🏆</span>
                            </div>
                            <button
                              onClick={handleExitGame}
                              className="px-3.5 py-1.5 bg-rose-600/90 hover:bg-rose-500 border border-rose-400/40 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
                              title="إغلاق والعودة للرئيسية"
                            >
                              <span>إغلاق</span>
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="text-center space-y-2 mb-4">
                            <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-md">
                              أكمل جميع الطلاب الأسئلة بنجاح! 🎉
                            </h3>
                            <p className="text-xs md:text-sm text-slate-300 font-bold max-w-lg mx-auto">
                              مبارك لفرسان الفضاء الفائزين بالمراكز الأولى! لقد حصلت على <span className="text-yellow-400 font-sans font-black">{score}</span> نقطة.
                            </p>
                          </div>

                          <LivePodiumView
                            scores={getPodiumScores()}
                            onReset={() => {}}
                            onClose={handleExitGame}
                            isAdmin={false}
                            podiumAt={activeChallenge.podiumAt}
                          />

                          {/* 20-Second Countdown Display */}
                          {podiumSecondsLeft !== null && (
                            <div className="mt-5 px-5 py-2.5 bg-gradient-to-r from-rose-500/20 via-amber-500/20 to-purple-500/20 border border-amber-400/30 text-amber-200 rounded-2xl text-xs sm:text-sm font-extrabold text-center shadow-lg flex items-center justify-center gap-2">
                              <span>⏱️ التوقيت التنازلي للإغلاق:</span>
                              <span className="font-sans font-black text-lg text-amber-300 bg-amber-950/80 px-3 py-0.5 rounded-lg border border-amber-500/40 min-w-[2.5rem] inline-block shadow-inner">
                                {podiumSecondsLeft}
                              </span>
                              <span>ثانية</span>
                            </div>
                          )}

                          {/* Close & Return Button */}
                          <div className="mt-5">
                            <button
                              onClick={handleExitGame}
                              className="px-7 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-300/30 text-white rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer shadow-xl flex items-center gap-2 active:scale-95"
                            >
                              <span>إغلاق والعودة للرئيسية</span>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (hasFinishedWaygroundQuestions || gameState === "finished") ? (
                        /* WAITING FOR OTHER PLAYERS SCREEN */
                        <div className="flex flex-col flex-1 items-center justify-center p-6 md:p-8 text-center space-y-6 my-auto">
                          <motion.div
                            animate={{ scale: [1, 1.12, 1], rotate: [0, 8, -8, 0] }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                            className="w-24 h-24 bg-gradient-to-tr from-amber-500/20 via-indigo-500/20 to-purple-500/20 rounded-full border-2 border-amber-400/50 flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(245,158,11,0.25)]"
                          >
                            ⌛
                          </motion.div>

                          <div className="space-y-3 max-w-lg mx-auto">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black shadow-md">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                              <span>الرجاء الانتظار... ⏳</span>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-md">
                              أحسنت! لقد أكملت جميع الأسئلة بنجاح 🎉
                            </h3>
                            <p className="text-sm text-slate-200 font-bold leading-relaxed">
                              أنهيت الإجابة على كافة أسئلة معركة الفضاء وحصلت على <span className="text-yellow-400 font-sans font-black">{score}</span> نقطة.
                              <br />
                              <span className="text-indigo-200 font-normal text-xs mt-1 block">
                                يرجى الانتظار حتى يقوم المعلم بإعادة إعلان منصة التتويج والأبطال الفائزين! 🔥
                              </span>
                            </p>
                          </div>
                          
                          <div className="bg-slate-900/95 border border-purple-800/80 p-5 rounded-2xl max-w-md w-full space-y-3 shadow-xl backdrop-blur-md">
                            <div className="text-right flex justify-between items-center text-xs font-bold text-indigo-200 pb-2 border-b border-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span>🌟</span>
                                <span>النقاط الإجمالية التي حصلت عليها:</span>
                              </span>
                              <span className="font-sans font-black text-base text-yellow-400">{score} ن</span>
                            </div>
                            <div className="text-right flex justify-between items-center text-xs font-bold text-indigo-200 pb-2 border-b border-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span>✅</span>
                                <span>الإجابات الصحيحة:</span>
                              </span>
                              <span className="font-sans font-black text-sm text-emerald-400">{correctCount} / {activeChallenge.questions.length}</span>
                            </div>
                            <div className="text-right flex justify-between items-center text-xs font-bold text-indigo-200 pb-2 border-b border-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span>⏱️</span>
                                <span>الزمن المستغرق:</span>
                              </span>
                              <span className="font-sans font-black text-sm text-cyan-300">{timeSpent} ثانية</span>
                            </div>
                            <div className="text-right flex justify-between items-center text-xs font-bold text-amber-300 pt-1">
                              <span className="flex items-center gap-1.5">
                                <span>👥</span>
                                <span>الطلاب الذين أنهوا التحدي:</span>
                              </span>
                              <span className="font-sans font-black text-xs text-amber-400">
                                {liveActivePlayers.filter(p => p.finished === true).length} من أصل {liveActivePlayers.length || 1} طالب
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-indigo-950/60 border border-indigo-500/30 rounded-xl max-w-md w-full text-xs font-bold text-indigo-200 flex items-center justify-center gap-2 animate-pulse">
                            <span>📡 جاري المتابعة مباشرة... ستظهر شاشة التتويج فوراً عند إكمال جميع الطلاب للتحدي!</span>
                          </div>

                          {/* Clear & Prominent Button to Exit without waiting for coronation */}
                          <div className="pt-2 w-full max-w-md mx-auto">
                            <button
                              type="button"
                              onClick={handleExitGame}
                              className="w-full py-3.5 px-6 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl text-xs sm:text-sm font-black shadow-xl shadow-rose-950/60 border border-rose-400/40 transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2.5 hover:brightness-110"
                            >
                              <LogOut className="w-4 h-4 rotate-180" />
                              <span>إغلاق وإنهاء اللعبة بدون تتويج 🚪</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Visual Canvas Area - Expanded height for massive play field */}
                      <div 
                        onMouseMove={handleCanvasMouseMove}
                        onTouchMove={handleCanvasTouchMove}
                        className="w-full h-[480px] md:h-[520px] bg-slate-950 rounded-2xl border border-slate-800 relative overflow-hidden flex flex-col justify-end cursor-crosshair select-none"
                      >
                        {/* Deep Space Background: Starfield, Nebulae & Cosmic Objects */}
                        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#070b1a] to-[#0c0826] overflow-hidden pointer-events-none">
                          {/* Lightweight Cosmic Nebula Atmosphere without heavy CPU/GPU blur filters */}
                          <div className="absolute -top-10 -left-10 w-80 h-80 bg-[radial-gradient(circle,rgba(6,182,212,0.12)_0%,transparent_70%)] pointer-events-none" />
                          <div className="absolute bottom-0 -right-10 w-80 h-80 bg-[radial-gradient(circle,rgba(147,51,234,0.14)_0%,transparent_70%)] pointer-events-none" />
                          <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-[radial-gradient(circle,rgba(99,102,241,0.10)_0%,transparent_70%)] pointer-events-none" />

                          {/* Twinkling Space Stars - lightweight rendering */}
                          {Array.from({ length: 24 }).map((_, i) => (
                            <div
                              key={`space-bg-star-${i}`}
                              style={{
                                left: `${(i * 17 + 7) % 96}%`,
                                top: `${(i * 23 + 11) % 92}%`,
                                opacity: 0.35 + (i % 4) * 0.15,
                              }}
                              className={`absolute ${i % 3 === 0 ? "w-1.5 h-1.5 bg-cyan-300 shadow-[0_0_4px_#22d3ee]" : i % 2 === 0 ? "w-1 h-1 bg-amber-200" : "w-0.5 h-0.5 bg-white"} rounded-full`}
                            />
                          ))}

                          {/* Distant Orbiting Moon/Planet with Rings */}
                          <div className="absolute top-4 right-6 opacity-25 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 via-purple-700 to-slate-900 border border-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.4)]" />
                            <div className="absolute w-20 h-4 border-2 border-indigo-300/40 rounded-full transform -rotate-12" />
                          </div>
                        </div>

                        {/* Live Multiplayer Squad Leaderboard Bar */}
                        <div className="absolute top-2 inset-x-3 z-20 flex items-center justify-between pointer-events-none">
                          <div className="bg-slate-900/80 backdrop-blur border border-indigo-500/30 px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-black text-indigo-200">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                            <span>المواجهة المباشرة ({liveActivePlayers.length} فرسان)</span>
                          </div>
                          
                          {/* Live Ranks Pill */}
                          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[60%] no-scrollbar">
                            {liveActivePlayers.slice(0, 4).map((p, idx) => (
                              <div key={`squad-rank-${p.studentId || idx}`} className="bg-slate-950/80 border border-indigo-400/30 px-2 py-0.5 rounded-full flex items-center gap-1 text-[10px] font-extrabold text-white">
                                <span className="text-amber-400 font-sans">#{idx + 1}</span>
                                <span className="truncate max-w-[60px]">{p.studentName?.split(' ')[0]}</span>
                                <span className="text-emerald-400 font-sans">{p.score || 0}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Floating Question Card during Space Invaders gameplay */}
                        {!isQuestionIntro && (
                          <motion.div
                            key={`space-q-${currentQuestionIdx}`}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute top-12 inset-x-4 z-20 bg-slate-900/90 border border-indigo-500/40 p-3 sm:p-3.5 rounded-2xl text-center shadow-xl backdrop-blur-md space-y-2"
                          >
                            {/* Time Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-black px-0.5">
                                <div className="flex items-center gap-1.5 text-indigo-200">
                                  <Clock className="w-3.5 h-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '4s' }} />
                                  <span className="text-[11px]">الوقت المتبقي:</span>
                                </div>
                                <div className={`flex items-center gap-1 font-sans font-black text-xs ${
                                  timeLeft <= 5 
                                    ? "text-rose-400 animate-pulse text-sm" 
                                    : timeLeft <= 10 
                                    ? "text-amber-400" 
                                    : "text-emerald-400"
                                }`}>
                                  <span>{timeLeft}</span>
                                  <span className="text-[10px]">ثانية</span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-950/80 border border-indigo-900/80 rounded-full h-2 p-0.5 shadow-inner overflow-hidden relative">
                                <motion.div 
                                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                                    timeLeft <= 5 
                                      ? "bg-gradient-to-r from-rose-600 via-rose-500 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.8)]" 
                                      : timeLeft <= 10 
                                      ? "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]" 
                                      : "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                  }`}
                                  style={{ width: `${Math.max(0, Math.min(100, (timeLeft / 25) * 100))}%` }}
                                />
                              </div>
                            </div>

                            <h3 className="text-sm sm:text-base font-black text-white leading-snug">
                              {activeChallenge.questions[currentQuestionIdx]?.text}
                            </h3>
                          </motion.div>
                        )}

                        {/* Beautiful Large Question Intro & Game Preview Overlay */}
                        {isQuestionIntro && (
                          <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center p-4 sm:p-6 text-center overflow-hidden">
                            {/* Space Hyperspace Warp Particle Effect in Background */}
                            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-70">
                              {Array.from({ length: 16 }).map((_, i) => (
                                <motion.div
                                  key={`warp-star-${i}`}
                                  style={{ left: `${(i * 13) % 100}%` }}
                                  animate={{ y: [-20, 500], opacity: [0, 1, 0], scaleY: [1, 3.5, 1] }}
                                  transition={{ repeat: Infinity, duration: 0.7 + (i % 4) * 0.25, delay: (i * 0.15) % 1 }}
                                  className="absolute w-1 h-10 bg-cyan-400/80 rounded-full shadow-[0_0_10px_#22d3ee]"
                                />
                              ))}
                            </div>

                            {gameIntroStage === "preview" ? (
                              /* GAME PREVIEW & SPACESHIP WARP ANIMATION */
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="relative z-10 max-w-lg w-full bg-slate-900/90 border border-purple-500/40 p-6 rounded-3xl shadow-[0_0_50px_rgba(168,85,247,0.3)] backdrop-blur-xl space-y-5"
                              >
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-200 text-xs font-black tracking-wide">
                                  <span>🚀 معركة الفضاء الكونية</span>
                                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                                </div>

                                {/* Animated Spaceship with Plasma Engine & Laser Blasts */}
                                <div className="relative py-6 flex items-center justify-center h-28">
                                  {/* Laser energy beams shooting up */}
                                  <motion.div
                                    animate={{ y: [0, -120], opacity: [1, 0] }}
                                    transition={{ repeat: Infinity, duration: 0.5 }}
                                    className="absolute -top-2 w-1.5 h-12 bg-cyan-300 rounded-full shadow-[0_0_15px_#22d3ee]"
                                  />
                                  <motion.div
                                    animate={{ y: [0, -120], opacity: [1, 0] }}
                                    transition={{ repeat: Infinity, duration: 0.5, delay: 0.25 }}
                                    className="absolute -top-2 left-1/3 w-1.5 h-10 bg-indigo-300 rounded-full shadow-[0_0_12px_#818cf8]"
                                  />
                                  <motion.div
                                    animate={{ y: [0, -120], opacity: [1, 0] }}
                                    transition={{ repeat: Infinity, duration: 0.5, delay: 0.1 }}
                                    className="absolute -top-2 right-1/3 w-1.5 h-10 bg-indigo-300 rounded-full shadow-[0_0_12px_#818cf8]"
                                  />

                                  {/* Floating Spaceship */}
                                  <motion.div
                                    animate={{
                                      y: [8, -12, 8],
                                      x: [-12, 12, -12],
                                      rotate: [-5, 5, -5]
                                    }}
                                    transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                                    className="relative text-7xl select-none drop-shadow-[0_0_25px_rgba(34,211,238,0.8)]"
                                  >
                                    🚀
                                    {/* Plasma Thruster Flame */}
                                    <motion.div
                                      animate={{ scaleY: [0.8, 1.7, 0.8], opacity: [0.7, 1, 0.7] }}
                                      transition={{ repeat: Infinity, duration: 0.15 }}
                                      className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-7 bg-gradient-to-b from-cyan-300 via-blue-500 to-transparent rounded-b-full shadow-[0_0_15px_#22d3ee]"
                                    />
                                  </motion.div>
                                </div>

                                <div className="space-y-2">
                                  <h3 className="text-xl md:text-2xl font-black text-white drop-shadow-md">
                                    جاهز للانطلاق والتصويب؟ 💥
                                  </h3>
                                  <p className="text-xs md:text-sm text-slate-300 font-bold leading-relaxed px-2">
                                    حرك مركبتك الفضائية بحرية، أطلق أسلحة الليزر واصطدم بالنوايزج الحاملة للإجابة الصحيحة وتجنب الإجابات الخاطئة!
                                  </p>
                                </div>

                                <button
                                  onClick={() => triggerGameCountdown(0, "space_invaders", activeChallenge.questions[0])}
                                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-indigo-950 transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 border border-cyan-300/30"
                                >
                                  <span>بدء المهمة والعد التنازلي 🚀</span>
                                </button>
                              </motion.div>
                            ) : gameIntroStage === "countdown" ? (
                              /* HIGH-ENERGY ENERGETIC COUNTDOWN */
                              <div className="relative z-10 max-w-lg w-full flex flex-col items-center justify-center space-y-6">
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-black shadow-md animate-pulse">
                                  <span>🚀 جاري التجهيز لإطلاق الصاروخ...</span>
                                </div>

                                <div className="relative flex items-center justify-center w-36 h-36">
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                                    className="absolute inset-0 rounded-full border-4 border-dashed border-cyan-400/40 shadow-[0_0_30px_rgba(34,211,238,0.4)]"
                                  />

                                  <AnimatePresence mode="wait">
                                    {introCountdown === 3 && (
                                      <motion.span
                                        key="space-count-3"
                                        initial={{ scale: 0.2, opacity: 0 }}
                                        animate={{ scale: [0.2, 1.4, 1], opacity: 1 }}
                                        exit={{ scale: 1.8, opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                        className="text-7xl font-sans font-black text-rose-500 drop-shadow-[0_0_35px_#f43f5e]"
                                      >
                                        3
                                      </motion.span>
                                    )}
                                    {introCountdown === 2 && (
                                      <motion.span
                                        key="space-count-2"
                                        initial={{ scale: 0.2, opacity: 0 }}
                                        animate={{ scale: [0.2, 1.4, 1], opacity: 1 }}
                                        exit={{ scale: 1.8, opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                        className="text-7xl font-sans font-black text-amber-400 drop-shadow-[0_0_35px_#f59e0b]"
                                      >
                                        2
                                      </motion.span>
                                    )}
                                    {introCountdown === 1 && (
                                      <motion.span
                                        key="space-count-1"
                                        initial={{ scale: 0.2, opacity: 0 }}
                                        animate={{ scale: [0.2, 1.4, 1], opacity: 1 }}
                                        exit={{ scale: 1.8, opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                        className="text-7xl font-sans font-black text-emerald-400 drop-shadow-[0_0_35px_#10b981]"
                                      >
                                        1
                                      </motion.span>
                                    )}
                                    {introCountdown === 0 && (
                                      <motion.div
                                        key="space-count-go"
                                        initial={{ scale: 0.3, opacity: 0 }}
                                        animate={{ scale: [0.3, 1.3, 1], opacity: 1 }}
                                        className="text-3xl sm:text-4xl font-black text-yellow-300 drop-shadow-[0_0_40px_#fde047] whitespace-nowrap"
                                      >
                                        🚀 انطلق! ✨
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* First Question Preview Card */}
                                <div className="bg-slate-900/90 border border-indigo-500/40 p-4 rounded-2xl max-w-md w-full text-center space-y-1 shadow-xl backdrop-blur-md">
                                  <span className="text-[10px] text-cyan-300 font-extrabold uppercase tracking-widest">السؤال الأول</span>
                                  <p className="text-sm md:text-base font-black text-white line-clamp-2">
                                    {activeChallenge.questions[currentQuestionIdx]?.text}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              /* STANDARD QUESTION INTRO DISPLAY (for question > 0) */
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
                            )}
                          </div>
                        )}

                        {/* Falling Space Answer Pods / Cosmic Asteroids */}
                        {!isQuestionIntro && fallingMeteors.map((m) => {
                          const icons = ["☄️", "💎", "🛸", "🪐"];
                          const themeColors = [
                            { border: "border-cyan-400/90", bg: "from-slate-900/95 via-cyan-950/85 to-slate-950/95", shadow: "shadow-[0_0_22px_rgba(34,211,238,0.4)]", badgeBg: "bg-cyan-500/20 text-cyan-300 border-cyan-400/40" },
                            { border: "border-purple-400/90", bg: "from-slate-900/95 via-purple-950/85 to-slate-950/95", shadow: "shadow-[0_0_22px_rgba(168,85,247,0.4)]", badgeBg: "bg-purple-500/20 text-purple-300 border-purple-400/40" },
                            { border: "border-amber-400/90", bg: "from-slate-900/95 via-amber-950/85 to-slate-950/95", shadow: "shadow-[0_0_22px_rgba(245,158,11,0.4)]", badgeBg: "bg-amber-500/20 text-amber-300 border-amber-400/40" },
                            { border: "border-emerald-400/90", bg: "from-slate-900/95 via-emerald-950/85 to-slate-950/95", shadow: "shadow-[0_0_22px_rgba(16,185,129,0.4)]", badgeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40" },
                          ];
                          const theme = themeColors[m.idx % themeColors.length];

                          return (
                            <div
                              key={m.id}
                              ref={el => { meteorDomRefs.current[m.idx] = el; }}
                              style={{ left: `${m.x}%`, top: `${m.y}%`, willChange: "top, left" }}
                              className={`absolute transform -translate-x-1/2 p-2.5 rounded-2xl bg-gradient-to-b ${theme.bg} border-2 ${theme.border} text-center select-none cursor-pointer max-w-[160px] min-w-[125px] ${theme.shadow} group hover:scale-105 transition-transform duration-75 z-10`}
                              onClick={() => handleShootMeteor(m)}
                            >
                              {/* Sci-Fi HUD Corner Brackets */}
                              <span className="absolute top-0.5 left-1 text-[9px] text-cyan-400 font-mono font-black opacity-60 group-hover:opacity-100">[</span>
                              <span className="absolute top-0.5 right-1 text-[9px] text-cyan-400 font-mono font-black opacity-60 group-hover:opacity-100">]</span>
                              <span className="absolute bottom-0.5 left-1 text-[9px] text-cyan-400 font-mono font-black opacity-60 group-hover:opacity-100">[</span>
                              <span className="absolute bottom-0.5 right-1 text-[9px] text-cyan-400 font-mono font-black opacity-60 group-hover:opacity-100">]</span>

                              {/* Answer Badge Header */}
                              <div className="flex items-center justify-between gap-1 mb-1 pb-1 border-b border-white/10">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${theme.badgeBg} flex items-center gap-1`}>
                                  <span>{icons[m.idx % icons.length]}</span>
                                  <span>خيار {m.idx + 1}</span>
                                </span>
                                <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                              </div>

                              {/* Answer Content Text */}
                              <div className="text-xs font-black text-white line-clamp-2 leading-snug drop-shadow-md">
                                {m.answer}
                              </div>

                              {/* Space Ion Thruster Trail Underneath Asteroid */}
                              <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-gradient-to-b from-cyan-400/80 via-purple-500/40 to-transparent rounded-b-full blur-[1px] pointer-events-none" />
                            </div>
                          );
                        })}

                        {/* Particle explosion effects */}
                        {particles.map(p => (
                          <motion.div
                            key={p.id}
                            style={{ left: `${p.x}%`, top: `${p.y}%`, backgroundColor: p.color }}
                            initial={{ scale: 1, opacity: 1 }}
                            animate={{ scale: [1, 2.5, 0], opacity: [1, 0.8, 0] }}
                            transition={{ duration: 0.4 }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor] pointer-events-none z-30"
                          />
                        ))}

                        {/* Fast Straight-Up Vertical Rocket Launch 🚀 */}
                        {launchedRocket?.active && (
                          <motion.div
                            key="space-launched-rocket"
                            initial={{ left: `${launchedRocket.targetX}%`, top: `80%`, scale: 0.8 }}
                            animate={{ left: `${launchedRocket.targetX}%`, top: `${launchedRocket.targetY}%`, scale: 1 }}
                            transition={{ duration: 0.3, ease: "linear" }}
                            className="absolute -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center"
                          >
                            {/* Retro Rocket Icon Flying Straight Up */}
                            <RetroRocketGraphic className="w-10 h-16 sm:w-12 sm:h-20 filter drop-shadow-[0_0_25px_#f59e0b] animate-pulse" />
                            
                            {/* Thruster Flame & Flame Trail */}
                            <motion.div
                              initial={{ height: 15, opacity: 0.95 }}
                              animate={{ height: [15, 45, 20], opacity: [0.95, 0.7, 0.2] }}
                              transition={{ duration: 0.3 }}
                              className="w-3.5 bg-gradient-to-b from-yellow-300 via-amber-500 to-rose-600 rounded-full blur-[1px] shadow-[0_0_25px_#f59e0b] -mt-2"
                            />
                          </motion.div>
                        )}

                        {/* Blast Shockwave Explosion at Meteor Hit */}
                        {particles.length > 0 && (
                          <motion.div
                            initial={{ scale: 0.2, opacity: 0 }}
                            animate={{ scale: [0.5, 2.2, 0], opacity: [1, 1, 0] }}
                            transition={{ duration: 0.4 }}
                            style={{ left: `${particles[0]?.x ?? shipX}%`, top: `${particles[0]?.y ?? 35}%` }}
                            className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-rose-500 border-2 border-white shadow-[0_0_35px_#f59e0b] z-30 pointer-events-none"
                          />
                        )}

                        {/* Spaceship at the bottom - local player and live online classmates */}
                        <div className="w-full h-14 bg-slate-950/90 border-t border-slate-800 relative z-20 overflow-visible">
                          {/* Live Online Classmates' Spaceships in Multiplayer */}
                          {liveActivePlayers
                            .filter(p => p.studentId !== (activeStudent?.id || "teacher-demo-user"))
                            .map((p, idx) => {
                              const classmateX = p.shipX !== undefined ? p.shipX : (15 + (idx * 20) % 70);
                              return (
                                <motion.div
                                  key={`other-ship-${p.studentId || idx}`}
                                  animate={{ left: `${classmateX}%` }}
                                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                  className="absolute bottom-2.5 w-12 h-10 flex flex-col items-center justify-end -translate-x-1/2 select-none pointer-events-none z-10 opacity-80"
                                >
                                  {/* Name Tag & Live Score above classmate spaceship */}
                                  <div className="absolute -top-6 whitespace-nowrap bg-slate-900/90 border border-indigo-400/50 px-2 py-0.5 rounded-full text-[9px] font-black text-indigo-200 flex items-center gap-1 shadow-md z-30">
                                    <span>🚀 {p.studentName?.split(' ')[0] || "طالب"}</span>
                                    <span className="text-yellow-400 font-sans">({p.score || 0})</span>
                                  </div>

                                  {/* Classmate Spaceship Body */}
                                  <div className="relative w-10 h-7 flex flex-col items-center">
                                    <div className="absolute top-0.5 w-3 h-3 bg-purple-400 rounded-t-full border border-purple-200 shadow-[0_0_8px_rgba(168,85,247,0.8)] z-20" />
                                    <div className="absolute top-1.5 w-4 h-5 bg-gradient-to-b from-slate-200 via-purple-700 to-slate-900 rounded-t-full border border-purple-400/60 shadow z-10" />
                                    <div className="absolute bottom-0 left-0 w-4 h-3.5 bg-purple-900/80 rounded-bl-2xl border-l border-b border-purple-300/40" style={{ transform: "skewY(-10deg)" }} />
                                    <div className="absolute bottom-0 right-0 w-4 h-3.5 bg-purple-900/80 rounded-br-2xl border-r border-b border-purple-300/40" style={{ transform: "skewY(10deg)" }} />
                                    <div className="absolute -bottom-3 left-[12px] w-1 h-3 bg-gradient-to-b from-emerald-400 to-transparent rounded-full animate-pulse" />
                                    <div className="absolute -bottom-3 right-[12px] w-1 h-3 bg-gradient-to-b from-emerald-400 to-transparent rounded-full animate-pulse" style={{ animationDelay: "0.1s" }} />
                                  </div>
                                </motion.div>
                              );
                            })}

                          {/* Local Student's Main Retro Rocket */}
                          <div
                            ref={playerShipRef}
                            style={{
                              left: `${shipX}%`,
                              willChange: "left",
                            }}
                            className="absolute -bottom-1.5 w-16 h-20 flex flex-col items-center justify-end -translate-x-1/2 select-none pointer-events-none z-20"
                          >
                            <RetroRocketGraphic className="w-12 h-20" />
                          </div>
                        </div>
                      </div>

                      {/* Ergonomic Touch/Mouse Steering & Shoot Controls */}
                      <div className="space-y-2">
                        <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-slate-900/60 p-2 sm:p-2.5 rounded-2xl border border-slate-800/90 shadow-md">
                          <button
                            type="button"
                            onPointerDown={(e) => { e.preventDefault(); shipArrowHoldRef.current.left = true; }}
                            onPointerUp={() => { shipArrowHoldRef.current.left = false; }}
                            onPointerLeave={() => { shipArrowHoldRef.current.left = false; }}
                            onPointerCancel={() => { shipArrowHoldRef.current.left = false; }}
                            className="py-3 sm:py-3.5 bg-slate-800 hover:bg-slate-750 active:bg-indigo-600 active:scale-95 text-slate-100 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer select-none flex items-center justify-center gap-1.5 border border-slate-700 shadow-sm"
                            title="تحريك لليسار (◄)"
                          >
                            <span>🚀 ◄ يسار</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
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
                            }}
                            className="py-3 sm:py-3.5 bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-black transition cursor-pointer select-none flex items-center justify-center gap-1.5 border border-amber-400/40 shadow-lg shadow-amber-950/40"
                            title="إطلاق الصاروخ نحو أقرب هدف (مسافة ⌴)"
                          >
                            <span>🎯 إطلاق!</span>
                          </button>

                          <button
                            type="button"
                            onPointerDown={(e) => { e.preventDefault(); shipArrowHoldRef.current.right = true; }}
                            onPointerUp={() => { shipArrowHoldRef.current.right = false; }}
                            onPointerLeave={() => { shipArrowHoldRef.current.right = false; }}
                            onPointerCancel={() => { shipArrowHoldRef.current.right = false; }}
                            className="py-3 sm:py-3.5 bg-slate-800 hover:bg-slate-750 active:bg-indigo-600 active:scale-95 text-slate-100 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer select-none flex items-center justify-center gap-1.5 border border-slate-700 shadow-sm"
                            title="تحريك لليمين (►)"
                          >
                            <span>يمين ► 🚀</span>
                          </button>
                        </div>

                        <p className="text-[11px] text-center text-slate-400 font-bold leading-relaxed">
                          💡 <span className="text-indigo-400">طريقة اللعب:</span> حرك الصاروخ بالأسهم أو الأزرار ثم اضغط 🎯 إطلاق لإصابة الإجابة الصحيحة، أو انقر مباشرة على الخيار في الفضاء!
                        </p>
                      </div>
                      </>
                      )}
                    </div>
                  )}

                  {/* GAME TYPE 4: CAR RACING */}
                  {activeChallenge.gameType === "car_racing" && (
                    <div className="space-y-4 relative z-10" dir="rtl">
                      {activeChallenge.liveState === "podium" ? (
                        /* PODIUM VIEW FOR ALL STUDENTS WHEN TEACHER ANNOUNCES PODIUM OR GAME REACHES PODIUM STATE */
                        <div className="w-full flex flex-col items-center justify-center p-2 sm:p-4 relative">
                          {/* Header Bar with Title and Close Button */}
                          <div className="w-full flex items-center justify-between gap-3 mb-4 pb-3 border-b border-purple-800/40">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-xs font-black shadow-md">
                              <span>🏆 منصة تتويج أبطال سباق السيارات 🏆</span>
                            </div>
                            <button
                              onClick={handleExitGame}
                              className="px-3.5 py-1.5 bg-rose-600/90 hover:bg-rose-500 border border-rose-400/40 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
                              title="إغلاق والعودة للرئيسية"
                            >
                              <span>إغلاق</span>
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="text-center space-y-2 mb-4">
                            <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-md">
                              أكمل جميع الطلاب الأسئلة بنجاح! 🎉
                            </h3>
                            <p className="text-xs md:text-sm text-slate-300 font-bold max-w-lg mx-auto">
                              مبارك لأبطال سباق السيارات الفائزين بالمراكز الأولى! لقد حصلت على <span className="text-yellow-400 font-sans font-black">{score}</span> نقطة.
                            </p>
                          </div>

                          <LivePodiumView
                            scores={getPodiumScores()}
                            onReset={() => {}}
                            onClose={handleExitGame}
                            isAdmin={false}
                            podiumAt={activeChallenge.podiumAt}
                          />

                          {/* 20-Second Countdown Display */}
                          {podiumSecondsLeft !== null && (
                            <div className="mt-5 px-5 py-2.5 bg-gradient-to-r from-rose-500/20 via-amber-500/20 to-purple-500/20 border border-amber-400/30 text-amber-200 rounded-2xl text-xs sm:text-sm font-extrabold text-center shadow-lg flex items-center justify-center gap-2">
                              <span>⏱️ التوقيت التنازلي للإغلاق:</span>
                              <span className="font-sans font-black text-lg text-amber-300 bg-amber-950/80 px-3 py-0.5 rounded-lg border border-amber-500/40 min-w-[2.5rem] inline-block shadow-inner">
                                {podiumSecondsLeft}
                              </span>
                              <span>ثانية</span>
                            </div>
                          )}

                          {/* Close & Return Button */}
                          <div className="mt-5">
                            <button
                              onClick={handleExitGame}
                              className="px-7 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border border-purple-300/30 text-white rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer shadow-xl flex items-center gap-2 active:scale-95"
                            >
                              <span>إغلاق والعودة للرئيسية</span>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (hasFinishedWaygroundQuestions || gameState === "finished") ? (
                        /* WAITING FOR OTHER PLAYERS SCREEN */
                        <div className="flex flex-col flex-1 items-center justify-center p-6 md:p-8 text-center space-y-6 my-auto">
                          <motion.div
                            animate={{ scale: [1, 1.12, 1], rotate: [0, 8, -8, 0] }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                            className="w-24 h-24 bg-gradient-to-tr from-amber-500/20 via-indigo-500/20 to-purple-500/20 rounded-full border-2 border-amber-400/50 flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(245,158,11,0.25)]"
                          >
                            ⌛
                          </motion.div>

                          <div className="space-y-3 max-w-lg mx-auto">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black shadow-md">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                              <span>الرجاء الانتظار... ⏳</span>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-md">
                              أحسنت! لقد أكملت جميع الأسئلة بنجاح 🎉
                            </h3>
                            <p className="text-sm text-slate-200 font-bold leading-relaxed">
                              أنهيت الإجابة على كافة أسئلة سباق السيارات وحصلت على <span className="text-yellow-400 font-sans font-black">{score}</span> نقطة.
                              <br />
                              <span className="text-indigo-200 font-normal text-xs mt-1 block">
                                يرجى الانتظار حتى يقوم المعلم بإعادة إعلان منصة التتويج والأبطال الفائزين! 🔥
                              </span>
                            </p>
                          </div>
                          
                          <div className="bg-slate-900/95 border border-purple-800/80 p-5 rounded-2xl max-w-md w-full space-y-3 shadow-xl backdrop-blur-md">
                            <div className="text-right flex justify-between items-center text-xs font-bold text-indigo-200 pb-2 border-b border-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span>🌟</span>
                                <span>النقاط الإجمالية التي حصلت عليها:</span>
                              </span>
                              <span className="font-sans font-black text-base text-yellow-400">{score} ن</span>
                            </div>
                            <div className="text-right flex justify-between items-center text-xs font-bold text-indigo-200 pb-2 border-b border-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span>✅</span>
                                <span>الإجابات الصحيحة:</span>
                              </span>
                              <span className="font-sans font-black text-sm text-emerald-400">{correctCount} / {activeChallenge.questions.length}</span>
                            </div>
                            <div className="text-right flex justify-between items-center text-xs font-bold text-indigo-200 pb-2 border-b border-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span>⏱️</span>
                                <span>الزمن المستغرق:</span>
                              </span>
                              <span className="font-sans font-black text-sm text-cyan-300">{timeSpent} ثانية</span>
                            </div>
                            <div className="text-right flex justify-between items-center text-xs font-bold text-amber-300 pt-1">
                              <span className="flex items-center gap-1.5">
                                <span>👥</span>
                                <span>الطلاب الذين أنهوا التحدي:</span>
                              </span>
                              <span className="font-sans font-black text-xs text-amber-400">
                                {liveActivePlayers.filter(p => p.finished === true).length} من أصل {liveActivePlayers.length || 1} طالب
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-indigo-950/60 border border-indigo-500/30 rounded-xl max-w-md w-full text-xs font-bold text-indigo-200 flex items-center justify-center gap-2 animate-pulse">
                            <span>📡 جاري المتابعة مباشرة... ستظهر شاشة التتويج فوراً عند إكمال جميع الطلاب للتحدي!</span>
                          </div>

                          {/* Clear & Prominent Button to Exit without waiting for coronation */}
                          <div className="pt-2 w-full max-w-md mx-auto">
                            <button
                              type="button"
                              onClick={handleExitGame}
                              className="w-full py-3.5 px-6 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl text-xs sm:text-sm font-black shadow-xl shadow-rose-950/60 border border-rose-400/40 transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2.5 hover:brightness-110"
                            >
                              <LogOut className="w-4 h-4 rotate-180" />
                              <span>إغلاق وإنهاء اللعبة بدون تتويج 🚪</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
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
                            className="absolute top-3 inset-x-4 z-20 bg-slate-950/90 border border-cyan-500/50 p-3 sm:p-3.5 rounded-2xl text-center shadow-2xl backdrop-blur-md ring-1 ring-cyan-400/30 space-y-2"
                          >
                            {/* Time Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs font-black px-0.5">
                                <div className="flex items-center gap-1.5 text-cyan-200">
                                  <Clock className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '4s' }} />
                                  <span className="text-[11px]">الوقت المتبقي:</span>
                                </div>
                                <div className={`flex items-center gap-1 font-sans font-black text-xs ${
                                  timeLeft <= 5 
                                    ? "text-rose-400 animate-pulse text-sm" 
                                    : timeLeft <= 10 
                                    ? "text-amber-400" 
                                    : "text-emerald-400"
                                }`}>
                                  <span>{timeLeft}</span>
                                  <span className="text-[10px]">ثانية</span>
                                </div>
                              </div>
                              <div className="w-full bg-slate-950/80 border border-cyan-900/80 rounded-full h-2 p-0.5 shadow-inner overflow-hidden relative">
                                <motion.div 
                                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                                    timeLeft <= 5 
                                      ? "bg-gradient-to-r from-rose-600 via-rose-500 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.8)]" 
                                      : timeLeft <= 10 
                                      ? "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]" 
                                      : "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                  }`}
                                  style={{ width: `${Math.max(0, Math.min(100, (timeLeft / 25) * 100))}%` }}
                                />
                              </div>
                            </div>

                            <h3 className="text-sm sm:text-base md:text-lg font-black text-white leading-snug drop-shadow-md">
                              {activeChallenge.questions[currentQuestionIdx]?.text}
                            </h3>
                          </motion.div>
                        )}

                        {/* Beautiful Large Question Intro & Drift Car Preview Overlay */}
                        {isQuestionIntro && (
                          <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center p-4 sm:p-6 text-center overflow-hidden">
                            {/* Moving Highway Texture in Background */}
                            <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden">
                              <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-2 border-r-4 border-dashed border-yellow-400 animate-[moveDown_1s_linear_infinite]" />
                              <div className="absolute left-6 top-0 bottom-0 w-3 bg-emerald-700/80" />
                              <div className="absolute right-6 top-0 bottom-0 w-3 bg-emerald-700/80" />
                            </div>

                            {gameIntroStage === "preview" ? (
                              /* GAME PREVIEW & DRIFT CAR ANIMATION */
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="relative z-10 max-w-lg w-full bg-slate-900/90 border border-cyan-500/40 p-6 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.3)] backdrop-blur-xl space-y-5"
                              >
                                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-200 text-xs font-black tracking-wide">
                                  <span>🏎️ معركة سباق السيارات</span>
                                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                                </div>

                                {/* Animated Drift Car with Tire Smoke & Skid Marks */}
                                <div className="relative py-6 flex items-center justify-center h-28 overflow-hidden">
                                  {/* Tire smoke puffs */}
                                  <motion.div
                                    animate={{ scale: [0.5, 1.8, 2.2], opacity: [0.8, 0.3, 0], x: [-60, -90] }}
                                    transition={{ repeat: Infinity, duration: 1.2 }}
                                    className="absolute bottom-4 left-1/3 text-3xl opacity-70"
                                  >
                                    💨
                                  </motion.div>
                                  <motion.div
                                    animate={{ scale: [0.5, 1.8, 2.2], opacity: [0.8, 0.3, 0], x: [60, 90] }}
                                    transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
                                    className="absolute bottom-4 right-1/3 text-3xl opacity-70"
                                  >
                                    💨
                                  </motion.div>

                                  {/* Drifting Racing Car */}
                                  <motion.div
                                    animate={{
                                      x: [-85, 85, -50, 50, -15, 15, 0],
                                      rotate: [-22, 22, -15, 15, -8, 8, 0],
                                      scale: [0.95, 1.06, 0.98, 1.02, 1]
                                    }}
                                    transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
                                    className="relative text-7xl select-none drop-shadow-[0_10px_20px_rgba(6,182,212,0.8)]"
                                  >
                                    🏎️
                                    {/* Turbo Exhaust Flame */}
                                    <motion.div
                                      animate={{ scale: [0.8, 1.5, 0.8], opacity: [0.7, 1, 0.7] }}
                                      transition={{ repeat: Infinity, duration: 0.15 }}
                                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-2xl"
                                    >
                                      🔥
                                    </motion.div>
                                  </motion.div>
                                </div>

                                <div className="space-y-2">
                                  <h3 className="text-xl md:text-2xl font-black text-white drop-shadow-md">
                                    جاهز لخوض التحدي والسباق؟ 🏁
                                  </h3>
                                  <p className="text-xs md:text-sm text-slate-300 font-bold leading-relaxed px-2">
                                    قد سيارتك بسرعة، اندفع على الطرقات، اختر المسار الصحيح وتفادَ السيارات والعقبات الخاطئة للوصول للإجابة!
                                  </p>
                                </div>

                                <button
                                  onClick={() => triggerGameCountdown(0, "car_racing", activeChallenge.questions[0])}
                                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-rose-600 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-rose-950 transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 border border-amber-300/30"
                                >
                                  <span>بدء التحدي والعد التنازلي 🏁</span>
                                </button>
                              </motion.div>
                            ) : gameIntroStage === "countdown" ? (
                              /* HIGH-ENERGY ENERGETIC COUNTDOWN WITH STARTING LIGHTS */
                              <div className="relative z-10 max-w-lg w-full flex flex-col items-center justify-center space-y-6">
                                {/* Race Track Starting Lights 🚦 */}
                                <div className="flex items-center gap-3 px-6 py-2 bg-slate-900/90 border border-slate-700/80 rounded-full shadow-2xl">
                                  <div className={`w-5 h-5 rounded-full border border-rose-400/50 ${introCountdown === 3 ? "bg-rose-500 shadow-[0_0_15px_#f43f5e] animate-pulse" : "bg-rose-950/60"}`} />
                                  <div className={`w-5 h-5 rounded-full border border-amber-400/50 ${introCountdown === 2 ? "bg-amber-400 shadow-[0_0_15px_#f59e0b] animate-pulse" : "bg-amber-950/60"}`} />
                                  <div className={`w-5 h-5 rounded-full border border-emerald-400/50 ${(introCountdown === 1 || introCountdown === 0) ? "bg-emerald-400 shadow-[0_0_15px_#10b981] animate-pulse" : "bg-emerald-950/60"}`} />
                                </div>

                                <div className="relative flex items-center justify-center w-36 h-36">
                                  <motion.div
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                    className="absolute inset-0 rounded-full border-4 border-cyan-400/40 shadow-[0_0_30px_rgba(6,182,212,0.4)]"
                                  />

                                  <AnimatePresence mode="wait">
                                    {introCountdown === 3 && (
                                      <motion.span
                                        key="car-count-3"
                                        initial={{ scale: 0.2, opacity: 0 }}
                                        animate={{ scale: [0.2, 1.4, 1], opacity: 1 }}
                                        exit={{ scale: 1.8, opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                        className="text-7xl font-sans font-black text-rose-500 drop-shadow-[0_0_35px_#f43f5e]"
                                      >
                                        3
                                      </motion.span>
                                    )}
                                    {introCountdown === 2 && (
                                      <motion.span
                                        key="car-count-2"
                                        initial={{ scale: 0.2, opacity: 0 }}
                                        animate={{ scale: [0.2, 1.4, 1], opacity: 1 }}
                                        exit={{ scale: 1.8, opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                        className="text-7xl font-sans font-black text-amber-400 drop-shadow-[0_0_35px_#f59e0b]"
                                      >
                                        2
                                      </motion.span>
                                    )}
                                    {introCountdown === 1 && (
                                      <motion.span
                                        key="car-count-1"
                                        initial={{ scale: 0.2, opacity: 0 }}
                                        animate={{ scale: [0.2, 1.4, 1], opacity: 1 }}
                                        exit={{ scale: 1.8, opacity: 0 }}
                                        transition={{ duration: 0.5 }}
                                        className="text-7xl font-sans font-black text-emerald-400 drop-shadow-[0_0_35px_#10b981]"
                                      >
                                        1
                                      </motion.span>
                                    )}
                                    {introCountdown === 0 && (
                                      <motion.div
                                        key="car-count-go"
                                        initial={{ scale: 0.3, opacity: 0 }}
                                        animate={{ scale: [0.3, 1.3, 1], opacity: 1 }}
                                        className="text-3xl sm:text-4xl font-black text-yellow-300 drop-shadow-[0_0_40px_#fde047] whitespace-nowrap"
                                      >
                                        🏁 انطلق برباطة جأش! 💨
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>

                                {/* First Question Preview Card */}
                                <div className="bg-slate-900/90 border border-cyan-500/40 p-4 rounded-2xl max-w-md w-full text-center space-y-1 shadow-xl backdrop-blur-md">
                                  <span className="text-[10px] text-cyan-300 font-extrabold uppercase tracking-widest">السؤال الأول</span>
                                  <p className="text-sm md:text-base font-black text-white line-clamp-2">
                                    {activeChallenge.questions[currentQuestionIdx]?.text}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              /* STANDARD QUESTION INTRO DISPLAY (for question > 0) */
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
                            )}
                          </div>
                        )}

                        {/* Dynamic White Lane Lines dividing options - GPU Accelerated */}
                        <div className="absolute -top-14 bottom-0 inset-x-0 overflow-hidden pointer-events-none z-0">
                          {(() => {
                            const count = activeChallenge.questions[currentQuestionIdx]?.options.length || 3;
                            return Array.from({ length: count - 1 }).map((_, i) => {
                              const leftPos = ((i + 1) * 100) / count;
                              return (
                                <div
                                  key={`highway-lane-${i}`}
                                  style={{ left: `${leftPos}%` }}
                                  className={`absolute top-0 bottom-0 w-[2px] ${
                                    isBoostingState ? "lane-line-fast" : "lane-line"
                                  }`}
                                />
                              );
                            });
                          })()}
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
                            <div
                              key={m.id}
                              ref={el => { roadCarDomRefs.current[m.idx] = el; }}
                              style={{ left: `${m.x}%`, top: `${m.y}%`, willChange: "top, left" }}
                              onClick={() => handleCarCollision(m)}
                              className="absolute transform -translate-x-1/2 p-2 rounded-2xl text-center select-none w-[140px] max-w-[155px] shadow-lg hover:scale-105 z-10 cursor-pointer"
                            >
                              <div className={`rounded-xl p-2.5 shadow-md ${cardClasses}`}>
                                {cardContent}
                              </div>
                            </div>
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
                          <div
                            ref={playerCarRef}
                            style={{ 
                              left: `${shipX}%`,
                              transform: `translateX(-50%) rotate(${carAngle}deg)`,
                              willChange: "left, transform",
                            }}
                            className="absolute bottom-3 w-16 h-16 flex flex-col items-center"
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
                          </div>
                        </div>
                      </div>

                      {/* Instructions and Steering buttons for mobile/tablet */}
                      <div className="space-y-3">
                        <p className="text-[11px] text-center text-slate-400 font-bold leading-relaxed">
                          💡 <span className="text-indigo-400">طريقة اللعب:</span> وجه سيارتك واصطدم بالمسار الذي يحتوي على الإجابة الصحيحة للتقدم! يمكنك **الضغط مع الاستمرار على زر المسافة (Space) لزيادة سرعة الطريق والخيارات بشكل خارق 🚀**
                        </p>

                        <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-slate-900/60 p-2 sm:p-2.5 rounded-2xl border border-slate-800/90 shadow-md">
                          <button
                            type="button"
                            onPointerDown={(e) => { e.preventDefault(); carArrowHoldRef.current.left = true; }}
                            onPointerUp={() => { carArrowHoldRef.current.left = false; }}
                            onPointerLeave={() => { carArrowHoldRef.current.left = false; }}
                            onPointerCancel={() => { carArrowHoldRef.current.left = false; }}
                            className="py-3 sm:py-3.5 bg-slate-800 hover:bg-slate-750 active:bg-cyan-600 active:scale-95 text-slate-100 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer select-none flex items-center justify-center gap-1.5 border border-slate-700 shadow-sm"
                            title="انعطاف لليسار (◄)"
                          >
                            <span>🏎️ ◀ يسار</span>
                          </button>

                          <button
                            type="button"
                            onPointerDown={(e) => { e.preventDefault(); carArrowHoldRef.current.boost = true; setIsBoostingState(true); }}
                            onPointerUp={() => { carArrowHoldRef.current.boost = false; setIsBoostingState(false); }}
                            onPointerLeave={() => { carArrowHoldRef.current.boost = false; setIsBoostingState(false); }}
                            onPointerCancel={() => { carArrowHoldRef.current.boost = false; setIsBoostingState(false); }}
                            className="py-3 sm:py-3.5 bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 active:scale-95 text-white rounded-xl text-xs sm:text-sm font-black transition cursor-pointer select-none flex items-center justify-center gap-1.5 border border-amber-400/40 shadow-lg shadow-amber-950/40"
                            title="ضغط مستمر للتسريع الخارق نيترو 🚀"
                          >
                            <span>🚀 نيترو!</span>
                          </button>

                          <button
                            type="button"
                            onPointerDown={(e) => { e.preventDefault(); carArrowHoldRef.current.right = true; }}
                            onPointerUp={() => { carArrowHoldRef.current.right = false; }}
                            onPointerLeave={() => { carArrowHoldRef.current.right = false; }}
                            onPointerCancel={() => { carArrowHoldRef.current.right = false; }}
                            className="py-3 sm:py-3.5 bg-slate-800 hover:bg-slate-750 active:bg-cyan-600 active:scale-95 text-slate-100 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer select-none flex items-center justify-center gap-1.5 border border-slate-700 shadow-sm"
                            title="انعطاف لليمين (►)"
                          >
                            <span>يمين ► 🏎️</span>
                          </button>
                        </div>
                      </div>
                      </>
                      )}
                    </div>
                  )}

                  {/* GAME TYPE 5: PENALTY SHOOTOUT ⚽ */}
                  {activeChallenge.gameType === "penalty_shootout" && (
                    <div className="space-y-4 relative z-10" dir="rtl">
                      {activeChallenge.liveState === "podium" ? (
                        /* PODIUM VIEW FOR ALL STUDENTS */
                        <div className="w-full flex flex-col items-center justify-center p-2 sm:p-4 relative">
                          <div className="w-full flex items-center justify-between gap-3 mb-4 pb-3 border-b border-emerald-800/40">
                            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-black shadow-md">
                              <span>🏆 منصة تتويج كأس ركلات الترجيح ⚽🏆</span>
                            </div>
                            <button
                              onClick={handleExitGame}
                              className="px-3.5 py-1.5 bg-rose-600/90 hover:bg-rose-500 border border-rose-400/40 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 shrink-0"
                              title="إغلاق والعودة للرئيسية"
                            >
                              <span>إغلاق</span>
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="text-center space-y-2 mb-4">
                            <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-md">
                              انتهت بطولة ركلات الترجيح! ⚽🎉
                            </h3>
                            <p className="text-xs md:text-sm text-slate-300 font-bold max-w-lg mx-auto">
                              مبارك لهدافي وأبطال ركلات الترجيح! لقد سجلت وحصلت على <span className="text-yellow-400 font-sans font-black">{score}</span> نقطة.
                            </p>
                          </div>

                          <LivePodiumView
                            scores={getPodiumScores()}
                            onReset={() => {}}
                            onClose={handleExitGame}
                            isAdmin={false}
                            podiumAt={activeChallenge.podiumAt}
                          />

                          {podiumSecondsLeft !== null && (
                            <div className="mt-5 px-5 py-2.5 bg-gradient-to-r from-rose-500/20 via-emerald-500/20 to-teal-500/20 border border-emerald-400/30 text-emerald-200 rounded-2xl text-xs sm:text-sm font-extrabold text-center shadow-lg flex items-center justify-center gap-2">
                              <span>⏱️ التوقيت التنازلي للإغلاق:</span>
                              <span className="font-sans font-black text-lg text-emerald-300 bg-emerald-950/80 px-3 py-0.5 rounded-lg border border-emerald-500/40 min-w-[2.5rem] inline-block shadow-inner">
                                {podiumSecondsLeft}
                              </span>
                              <span>ثانية</span>
                            </div>
                          )}

                          <div className="mt-5">
                            <button
                              onClick={handleExitGame}
                              className="px-7 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-300/30 text-white rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer shadow-xl flex items-center gap-2 active:scale-95"
                            >
                              <span>إغلاق والعودة للرئيسية</span>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (hasFinishedWaygroundQuestions || gameState === "finished") ? (
                        /* WAITING FOR OTHER PLAYERS SCREEN */
                        <div className="flex flex-col flex-1 items-center justify-center p-6 md:p-8 text-center space-y-6 my-auto">
                          <motion.div
                            animate={{ scale: [1, 1.12, 1], rotate: [0, 8, -8, 0] }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                            className="w-24 h-24 bg-gradient-to-tr from-emerald-500/20 via-teal-500/20 to-green-500/20 rounded-full border-2 border-emerald-400/50 flex items-center justify-center text-5xl shadow-[0_0_40px_rgba(16,185,129,0.25)]"
                          >
                            ⚽
                          </motion.div>

                          <div className="space-y-3 max-w-lg mx-auto">
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-black shadow-md">
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                              <span>الرجاء الانتظار... ⚽</span>
                            </div>
                            <h3 className="text-2xl md:text-3xl font-black text-white drop-shadow-md">
                              أحسنت! سددت جميع ركلات الترجيح ⚽🔥
                            </h3>
                            <p className="text-sm text-slate-200 font-bold leading-relaxed">
                              أنهيت جميع الركلات بنجاح وحصلت على <span className="text-yellow-400 font-sans font-black">{score}</span> نقطة.
                              <br />
                              <span className="text-emerald-200 font-normal text-xs mt-1 block">
                                بانتظار إعلان المعلم لمنصة التتويج وكأس الأبطال! 🏆
                              </span>
                            </p>
                          </div>

                          <div className="bg-slate-900/95 border border-emerald-800/80 p-5 rounded-2xl max-w-md w-full space-y-3 shadow-xl backdrop-blur-md">
                            <div className="text-right flex justify-between items-center text-xs font-bold text-emerald-200 pb-2 border-b border-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span>🌟</span>
                                <span>النقاط الإجمالية:</span>
                              </span>
                              <span className="font-sans font-black text-base text-yellow-400">{score} ن</span>
                            </div>
                            <div className="text-right flex justify-between items-center text-xs font-bold text-emerald-200 pb-2 border-b border-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span>⚽</span>
                                <span>الأهداف المسجلة:</span>
                              </span>
                              <span className="font-sans font-black text-sm text-emerald-400">{correctCount} / {activeChallenge.questions.length}</span>
                            </div>
                            <div className="text-right flex justify-between items-center text-xs font-bold text-emerald-200 pb-2 border-b border-slate-800">
                              <span className="flex items-center gap-1.5">
                                <span>⏱️</span>
                                <span>الزمن المستغرق:</span>
                              </span>
                              <span className="font-sans font-black text-sm text-teal-300">{timeSpent} ثانية</span>
                            </div>
                            <div className="text-right flex justify-between items-center text-xs font-bold text-amber-300 pt-1">
                              <span className="flex items-center gap-1.5">
                                <span>👥</span>
                                <span>الطلاب الذين أنهوا الركلات:</span>
                              </span>
                              <span className="font-sans font-black text-xs text-amber-400">
                                {liveActivePlayers.filter(p => p.finished === true).length} من أصل {liveActivePlayers.length || 1} طالب
                              </span>
                            </div>
                          </div>

                          <div className="p-3.5 bg-emerald-950/60 border border-emerald-500/30 rounded-xl max-w-md w-full text-xs font-bold text-emerald-200 flex items-center justify-center gap-2 animate-pulse">
                            <span>📡 جاري المتابعة مباشرة... ستظهر شاشة التتويج فور اكتمال الركلات!</span>
                          </div>

                          <div className="pt-2 w-full max-w-md mx-auto">
                            <button
                              type="button"
                              onClick={handleExitGame}
                              className="w-full py-3.5 px-6 bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl text-xs sm:text-sm font-black shadow-xl shadow-rose-950/60 border border-rose-400/40 transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2.5 hover:brightness-110"
                            >
                              <LogOut className="w-4 h-4 rotate-180" />
                              <span>إغلاق وإنهاء اللعبة بدون تتويج 🚪</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Football Pitch & Ultra-Realistic Stadium Arena */}
                          <div className="w-full min-h-[520px] md:min-h-[580px] bg-slate-950 rounded-3xl border-2 border-emerald-600/40 relative overflow-hidden flex flex-col justify-between select-none shadow-2xl">
                            {/* TV Broadcast Top Match Graphics Bar */}
                            <div className="relative z-20 w-full bg-slate-950/90 border-b border-emerald-500/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2 backdrop-blur-md">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-[10px] font-black">
                                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                                  <span>بث مباشر 🔴</span>
                                </span>
                                <span className="text-xs font-black text-white hidden sm:inline">
                                  ⚽ بطولة ركلات الترجيح وكأس الأبطال
                                </span>
                              </div>

                              {/* Penalty Shootout Series Rounds Dots (FIFA/Champions League style) */}
                              <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1 rounded-xl border border-slate-700/60 shadow-inner">
                                <span className="text-[10px] font-black text-slate-400 ml-1">سلسلة الركلات:</span>
                                {activeChallenge.questions.map((_, qIdx) => {
                                  const result = penaltyKicksHistory[qIdx];
                                  const isCurrent = qIdx === currentQuestionIdx;
                                  return (
                                    <div
                                      key={`kick-dot-${qIdx}`}
                                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${
                                        result === "goal"
                                          ? "bg-emerald-600 border-emerald-400 text-white shadow-[0_0_8px_#10b981]"
                                          : result === "miss"
                                          ? "bg-rose-600 border-rose-400 text-white shadow-[0_0_8px_#f43f5e]"
                                          : isCurrent
                                          ? "bg-amber-500/30 border-amber-400 text-amber-300 animate-pulse ring-1 ring-amber-400"
                                          : "bg-slate-800 border-slate-700 text-slate-500"
                                      }`}
                                      title={`الركلة ${qIdx + 1}`}
                                    >
                                      {result === "goal" ? "✓" : result === "miss" ? "✕" : isCurrent ? "⚽" : (qIdx + 1)}
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Radar Shot Speedometer HUD */}
                              {penaltyShotSpeed && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-yellow-400/50 text-yellow-300 font-mono text-xs font-black shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-pulse"
                                >
                                  <span>⚡ سرعة التسديدة:</span>
                                  <span className="text-sm font-sans font-black text-white">{penaltyShotSpeed}</span>
                                  <span>كم/ساعة</span>
                                </motion.div>
                              )}
                            </div>

                            {/* Stadium Visual Background (Crowd, LED Boards, Floodlights, & 3D Pitch) */}
                            <div className="absolute inset-0 top-10 bg-gradient-to-b from-slate-950 via-emerald-950 to-emerald-900 overflow-hidden pointer-events-none">
                              {/* Stadium Grandstands Silhouette & Crowds */}
                              <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-slate-950 via-slate-900 to-transparent flex flex-col justify-between opacity-80 pointer-events-none">
                                {/* Spectator silhouette grandstand tiers - lightweight CSS pattern */}
                                <div className="w-full h-12 opacity-35 overflow-hidden bg-[radial-gradient(#34d399_1px,transparent_1px),radial-gradient(#fde047_1px,transparent_1px)] bg-[size:12px_8px,16px_10px] bg-[position:0_0,6px_4px]" />
                                {/* Random Camera Flashes in Stands */}
                                <div className="absolute top-2 left-1/4 w-3 h-3 bg-white rounded-full blur-[2px] animate-ping" style={{ animationDuration: "2.4s" }} />
                                <div className="absolute top-4 right-1/3 w-3 h-3 bg-white rounded-full blur-[2px] animate-ping" style={{ animationDuration: "1.8s", animationDelay: "0.9s" }} />
                                <div className="absolute top-6 left-2/3 w-3 h-3 bg-white rounded-full blur-[2px] animate-ping" style={{ animationDuration: "3.1s", animationDelay: "1.4s" }} />
                              </div>

                              {/* Glowing LED Pitchside Advertising Boards */}
                              <div className="absolute top-16 inset-x-0 h-7 bg-slate-900 border-y border-emerald-500/40 flex items-center justify-around overflow-hidden text-[10px] font-black text-emerald-300 tracking-wider shadow-md pointer-events-none">
                                <span className="text-yellow-300">🏆 كأس أبطال المراجعة • CHAMPIONS LEAGUE ⚽</span>
                                <span className="text-emerald-400">🔥 سدد بقوة وهز الشباك • STRIKE & SCORE 🔥</span>
                                <span className="text-teal-300 hidden md:inline">⚡ تحدي ركلات الترجيح الحاسم ⚡</span>
                              </div>

                              {/* Twin Stadium Floodlight Towers with Volumetric Cones */}
                              <div className="absolute -top-4 -left-8 w-96 h-96 bg-gradient-to-br from-yellow-100/20 via-emerald-400/10 to-transparent rounded-full blur-3xl pointer-events-none" />
                              <div className="absolute -top-4 -right-8 w-96 h-96 bg-gradient-to-bl from-yellow-100/20 via-teal-400/10 to-transparent rounded-full blur-3xl pointer-events-none" />

                              {/* 3D Perspective Pitch Grass & Mower Stripes */}
                              <div className="absolute top-24 inset-x-0 bottom-0 flex flex-col opacity-30 pointer-events-none">
                                {Array.from({ length: 9 }).map((_, i) => (
                                  <div
                                    key={`turf-stripe-${i}`}
                                    className={`flex-1 ${i % 2 === 0 ? "bg-emerald-800/40" : "bg-transparent"}`}
                                  />
                                ))}
                              </div>

                              {/* Authentic Pitch Markings */}
                              {/* Penalty Box Outer Lines */}
                              <div className="absolute top-24 inset-x-6 h-52 border-b-2 border-x-2 border-white/30 pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.15)]" />
                              {/* 6-Yard Box */}
                              <div className="absolute top-24 inset-x-20 h-28 border-b-2 border-x-2 border-white/35 pointer-events-none" />
                              {/* Penalty Spot Mark (White Chalk Circle) */}
                              <div className="absolute top-[85%] left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow-[0_0_12px_white] pointer-events-none border border-emerald-300" />
                              {/* Penalty Arc (D) */}
                              <div className="absolute top-[85%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-24 border-b-2 border-white/30 rounded-b-full pointer-events-none" />
                            </div>

                            {/* Floating Question & Timer Bar */}
                            {!isQuestionIntro && (
                              <motion.div
                                key={`penalty-q-${currentQuestionIdx}`}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="relative z-20 mx-4 mt-2 bg-slate-950/95 border border-emerald-500/50 p-3 sm:p-3.5 rounded-2xl text-center shadow-2xl backdrop-blur-md ring-1 ring-emerald-400/30 space-y-2"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs font-black px-1">
                                    <div className="flex items-center gap-1.5 text-emerald-200">
                                      <Clock className="w-3.5 h-3.5 text-emerald-400 animate-spin" style={{ animationDuration: "4s" }} />
                                      <span className="text-[11px]">وقت الركلة:</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {streak > 1 && (
                                        <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full animate-bounce">
                                          سلسلة {streak} أهداف 🔥
                                        </span>
                                      )}
                                      <div className={`flex items-center gap-1 font-sans font-black text-xs ${
                                        timeLeft <= 4 ? "text-rose-400 animate-pulse text-sm" : timeLeft <= 8 ? "text-amber-400" : "text-emerald-400"
                                      }`}>
                                        <span>{timeLeft}</span>
                                        <span className="text-[10px]">ثانية</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="w-full bg-slate-900/90 border border-emerald-900/80 rounded-full h-2 p-0.5 shadow-inner overflow-hidden relative">
                                    <motion.div 
                                      className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                                        timeLeft <= 4
                                          ? "bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.8)]"
                                          : timeLeft <= 8
                                          ? "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_10px_rgba(245,158,11,0.6)]"
                                          : "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                      }`}
                                      style={{ width: `${Math.max(0, Math.min(100, (timeLeft / 20) * 100))}%` }}
                                    />
                                  </div>
                                </div>

                                <h3 className="text-sm sm:text-base md:text-lg font-black text-white leading-snug">
                                  {activeChallenge.questions[currentQuestionIdx]?.text}
                                </h3>
                              </motion.div>
                            )}

                            {/* 1. TOP SECTION: ALL OPTIONS (تظهر الاختيارات في الأعلى جميعها) */}
                            {!isQuestionIntro && (
                              <div className="relative z-20 w-full px-3 sm:px-4 mt-2">
                                <div className={`grid gap-2 sm:gap-2.5 w-full max-w-3xl mx-auto ${
                                  activeChallenge.questions[currentQuestionIdx]?.options.length === 2
                                    ? "grid-cols-2"
                                    : activeChallenge.questions[currentQuestionIdx]?.options.length === 3
                                    ? "grid-cols-3"
                                    : "grid-cols-2 sm:grid-cols-4"
                                }`}>
                                  {activeChallenge.questions[currentQuestionIdx]?.options.map((opt, optIdx) => {
                                    const isTargeted = penaltyBallState.targetIdx === optIdx;
                                    const isCorrect = checkIsCorrect(activeChallenge.questions[currentQuestionIdx], optIdx);
                                    const showResult = isAnswerRevealed;
                                    const isHovered = penaltyHoverIdx === optIdx;

                                    let borderStyles = "border-white/20 hover:border-emerald-400 bg-slate-950/90 hover:bg-emerald-950/90";
                                    if (showResult) {
                                      if (isCorrect) {
                                        borderStyles = "border-emerald-400 bg-emerald-950/95 ring-2 ring-emerald-400 shadow-[0_0_25px_#10b981]";
                                      } else if (isTargeted) {
                                        borderStyles = "border-rose-500 bg-rose-950/95 ring-2 ring-rose-400 shadow-[0_0_25px_#f43f5e]";
                                      } else {
                                        borderStyles = "border-slate-800 bg-slate-950/50 opacity-30";
                                      }
                                    } else if (isHovered) {
                                      borderStyles = "border-yellow-400 bg-emerald-950/90 ring-2 ring-yellow-400/60 shadow-[0_0_20px_rgba(234,179,8,0.5)]";
                                    }

                                    return (
                                      <button
                                        key={`penalty-opt-${optIdx}`}
                                        type="button"
                                        disabled={isAnswerRevealed}
                                        onClick={() => handlePenaltyShot(optIdx)}
                                        onMouseEnter={() => setPenaltyHoverIdx(optIdx)}
                                        onMouseLeave={() => setPenaltyHoverIdx(null)}
                                        className={`relative p-2 sm:p-2.5 rounded-xl border-2 transition-all duration-200 cursor-pointer flex flex-col justify-between text-right group shadow-lg backdrop-blur-md min-h-[64px] sm:min-h-[72px] ${borderStyles}`}
                                      >
                                        {/* Target Badge & Keyboard Shortcut */}
                                        <div className="flex items-center justify-between w-full pb-1 border-b border-white/10">
                                          <span className="text-[10px] font-black text-emerald-300 group-hover:text-yellow-300 transition flex items-center gap-1">
                                            <span>🎯</span>
                                            <span>الهدف [{optIdx + 1}]</span>
                                          </span>
                                          <span className="text-[10px] font-sans font-black bg-white/20 text-white px-1.5 py-0.2 rounded border border-white/30 group-hover:bg-yellow-400 group-hover:text-slate-950 transition">
                                            [{optIdx + 1}]
                                          </span>
                                        </div>

                                        {/* Option Text */}
                                        <span className="text-xs sm:text-xs font-black text-white group-hover:text-emerald-200 leading-tight pt-1 line-clamp-2">
                                          {opt}
                                        </span>

                                        {/* Status Badges on Result Reveal */}
                                        {showResult && isCorrect && (
                                          <div className="absolute -bottom-2 -left-1 bg-emerald-500 text-white rounded-full px-2 py-0.5 shadow-lg animate-bounce text-[10px] font-black flex items-center gap-1 z-30">
                                            <span>⚽</span>
                                            <span>هدف عالمي! ✓</span>
                                          </div>
                                        )}
                                        {showResult && isTargeted && !isCorrect && (
                                          <div className="absolute -bottom-2 -left-1 bg-rose-600 text-white rounded-full px-2 py-0.5 shadow-lg text-[10px] font-black flex items-center gap-1 z-30">
                                            <span>🧤</span>
                                            <span>تصدي الحارس ✕</span>
                                          </div>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* 2. CENTER STADIUM: Realistic 3D Goal & Goalkeeper */}
                            <div className="relative flex-1 w-full max-w-2xl mx-auto px-3 sm:px-4 flex flex-col items-center justify-center my-auto min-h-[210px] sm:min-h-[240px]">
                              {/* 3D Realistic Goal Net and Tubular Metal Frame */}
                              <div className={`relative w-full max-w-xl h-44 sm:h-52 rounded-t-2xl border-t-[10px] border-x-[10px] border-white shadow-[0_15px_45px_rgba(0,0,0,0.85)] flex flex-col justify-between overflow-hidden transition-all duration-200 ${
                                netShaking ? "scale-[1.03] border-yellow-300 shadow-[0_0_35px_rgba(234,179,8,0.7)]" : ""
                              }`}>
                                {/* Goal Frame Metallic Sheen Reflection */}
                                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-b from-white via-slate-200 to-transparent shadow-[0_0_12px_white]" />
                                <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-gradient-to-r from-white via-slate-200 to-transparent shadow-[0_0_12px_white]" />
                                <div className="absolute top-0 bottom-0 right-0 w-1.5 bg-gradient-to-l from-white via-slate-200 to-transparent shadow-[0_0_12px_white]" />

                                {/* Realistic Hexagonal Net Mesh with Depth */}
                                <div className={`absolute inset-0 bg-slate-950/65 bg-[radial-gradient(#ffffff_1.4px,transparent_1.4px)] [background-size:10px_10px] opacity-45 transition-transform duration-150 ${
                                  netShaking ? "scale-[1.05] opacity-60" : ""
                                }`} />
                                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-emerald-950/90 pointer-events-none" />

                                {/* Glove Impact Sparks on Save */}
                                {keeperGloveSpark && (
                                  <motion.div
                                    initial={{ scale: 0.2, opacity: 1 }}
                                    animate={{ scale: [0.2, 1.8, 2.2], opacity: [1, 0.8, 0] }}
                                    transition={{ duration: 0.45 }}
                                    style={{ left: `${keeperGloveSpark.x}%`, top: `${keeperGloveSpark.y}%` }}
                                    className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none text-3xl select-none filter drop-shadow-[0_0_15px_#f43f5e]"
                                  >
                                    💥🧤
                                  </motion.div>
                                )}

                                {/* Realistic Athletic Goalkeeper */}
                                <motion.div
                                  animate={
                                    penaltyKeeperState.isDiving
                                      ? penaltyKeeperState.diveDirection === "top_left"
                                        ? { x: -145, y: -45, rotate: -42, scale: 1.15 }
                                        : penaltyKeeperState.diveDirection === "bottom_left"
                                        ? { x: -145, y: 35, rotate: -72, scale: 1.15 }
                                        : penaltyKeeperState.diveDirection === "top_right"
                                        ? { x: 145, y: -45, rotate: 42, scale: 1.15 }
                                        : penaltyKeeperState.diveDirection === "bottom_right"
                                        ? { x: 145, y: 35, rotate: 72, scale: 1.15 }
                                        : penaltyKeeperState.diveDirection === "left"
                                        ? { x: -125, y: 0, rotate: -38, scale: 1.1 }
                                        : penaltyKeeperState.diveDirection === "right"
                                        ? { x: 125, y: 0, rotate: 38, scale: 1.1 }
                                        : { x: 0, y: -20, rotate: 0, scale: 1.1 }
                                      : { x: 0, y: 0, rotate: 0, scale: 1 }
                                  }
                                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                                  className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none z-10 select-none"
                                >
                                  <motion.div
                                    animate={
                                      !penaltyKeeperState.isDiving
                                        ? { x: [-6, 6, -6], y: [0, -3, 0] }
                                        : { x: 0, y: 0 }
                                    }
                                    transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                                    className="flex flex-col items-center"
                                  >
                                    {/* Outstretched Goalkeeper Gloves */}
                                    <div className="flex items-center gap-7 -mb-2">
                                      <div className="text-2xl -rotate-15 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">🧤</div>
                                      <div className="text-2xl rotate-15 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">🧤</div>
                                    </div>
                                    {/* Goalkeeper Head & Face */}
                                    <div className="w-8 h-8 rounded-full bg-amber-200 border-2 border-amber-400 flex items-center justify-center text-xs shadow-md">
                                      🧢
                                    </div>
                                    {/* Fluorescent Goalkeeper Jersey with Number 1 */}
                                    <div className="w-13 h-12 bg-gradient-to-b from-lime-400 to-green-500 border-2 border-lime-200 rounded-t-lg shadow-md flex items-center justify-center text-xs font-black text-slate-950 font-sans">
                                      1
                                    </div>
                                    {/* Shorts & Cleats */}
                                    <div className="w-11 h-6 bg-slate-950 rounded-b-md flex justify-around px-1">
                                      <div className="w-4 h-6 bg-slate-900 border-x border-slate-700" />
                                      <div className="w-4 h-6 bg-slate-900 border-x border-slate-700" />
                                    </div>
                                    <div className="flex gap-4 text-xs -mt-1">
                                      <span>👟</span>
                                      <span>👟</span>
                                    </div>
                                  </motion.div>
                                </motion.div>
                              </div>

                              {/* Goal Line Turf Shadow */}
                              <div className="w-full max-w-xl h-3.5 bg-emerald-950/80 border-t-2 border-white/60 shadow-lg" />
                            </div>

                            {/* 3. BOTTOM SECTION: THE BALLS ON THE TURF (الكور في الأسفل يقوم اللاعب بركل الكرة) */}
                            {!isQuestionIntro && (
                              <div className="relative z-20 w-full px-3 sm:px-4 pb-3 pt-1">
                                {/* Instructions Pill */}
                                <div className="flex items-center justify-center mb-1.5">
                                  <div className="flex items-center gap-1.5 text-[10px] sm:text-xs font-black bg-slate-950/85 border border-emerald-500/40 text-emerald-200 px-3.5 py-1 rounded-full shadow-lg backdrop-blur-md">
                                    <span className="text-sm animate-bounce">⚽</span>
                                    <span>اضغط على أي كرة في الأسفل أو زر [1-4] لركلها نحو الإجابة الصحيحة في الأعلى!</span>
                                  </div>
                                </div>

                                {/* Balls Row directly below matching options */}
                                <div className={`grid gap-2 sm:gap-2.5 w-full max-w-3xl mx-auto ${
                                  activeChallenge.questions[currentQuestionIdx]?.options.length === 2
                                    ? "grid-cols-2"
                                    : activeChallenge.questions[currentQuestionIdx]?.options.length === 3
                                    ? "grid-cols-3"
                                    : "grid-cols-2 sm:grid-cols-4"
                                }`}>
                                  {activeChallenge.questions[currentQuestionIdx]?.options.map((_, optIdx) => {
                                    const isKicked = penaltyBallState.isShooting && penaltyBallState.targetIdx === optIdx;
                                    const isHovered = penaltyHoverIdx === optIdx;

                                    return (
                                      <div key={`penalty-ball-station-${optIdx}`} className="relative flex flex-col items-center">
                                        {/* Trajectory dotted line on hover */}
                                        {isHovered && !penaltyBallState.isShooting && !isAnswerRevealed && (
                                          <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 0.8, height: 100 }}
                                            className="absolute bottom-16 w-0.5 border-r-2 border-dashed border-yellow-300 pointer-events-none z-10"
                                          />
                                        )}

                                        {/* Kick Button / Ball Trigger */}
                                        <button
                                          type="button"
                                          disabled={isAnswerRevealed}
                                          onClick={() => handlePenaltyShot(optIdx)}
                                          onMouseEnter={() => setPenaltyHoverIdx(optIdx)}
                                          onMouseLeave={() => setPenaltyHoverIdx(null)}
                                          className={`group cursor-pointer transition-all duration-200 flex flex-col items-center p-1.5 rounded-2xl w-full ${
                                            isHovered ? "scale-105" : "hover:scale-102"
                                          } active:scale-95 disabled:cursor-not-allowed`}
                                        >
                                          {/* 3D Ball Resting on Turf Chalk Spot */}
                                          <div className="relative flex flex-col items-center">
                                            {/* Turf Chalk Spot */}
                                            <div className="w-10 h-3 rounded-full border border-white/60 bg-white/20 shadow-[0_0_8px_white]" />

                                            {/* Soccer Ball (hidden when this specific ball is the one kicked and in flight) */}
                                            <div className={`text-3xl sm:text-4xl transition-all select-none -mt-4.5 filter drop-shadow-[0_6px_6px_rgba(0,0,0,0.8)] ${
                                              isKicked ? "opacity-0" : "opacity-100"
                                            } ${isHovered ? "rotate-12 scale-110" : ""}`}>
                                              ⚽
                                            </div>
                                          </div>

                                          {/* Action Badge */}
                                          <div className={`mt-1 text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full border transition-all flex items-center gap-1 shadow-md ${
                                            isHovered
                                              ? "bg-yellow-400 text-slate-950 border-yellow-300 scale-105"
                                              : "bg-slate-900/90 text-emerald-300 border-emerald-500/50 group-hover:border-emerald-400"
                                          }`}>
                                            <span>اركل كُرة [{optIdx + 1}]</span>
                                            <span>👟</span>
                                          </div>
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Striker Player (مسدد الركلة) running dynamically to the active ball on the pitch */}
                            <motion.div
                              animate={{
                                left: penaltyBallState.isShooting && penaltyBallState.targetIdx !== null
                                  ? `${getPenaltyOptionX(penaltyBallState.targetIdx, activeChallenge.questions[currentQuestionIdx]?.options.length || 4) - 4}%`
                                  : penaltyHoverIdx !== null
                                  ? `${getPenaltyOptionX(penaltyHoverIdx, activeChallenge.questions[currentQuestionIdx]?.options.length || 4) - 4}%`
                                  : "46%",
                                y: penaltyStrikerState.phase === "runup"
                                  ? -16
                                  : penaltyStrikerState.phase === "kick"
                                  ? -22
                                  : penaltyStrikerState.phase === "celebrate"
                                  ? -18
                                  : penaltyStrikerState.phase === "disappointed"
                                  ? 4
                                  : 0,
                                rotate: penaltyStrikerState.phase === "kick" ? -8 : 0,
                                scale: penaltyStrikerState.phase === "celebrate" ? 1.15 : 1,
                              }}
                              transition={{ type: "spring", stiffness: 320, damping: 26 }}
                              className="absolute bottom-6 z-15 pointer-events-none select-none flex flex-col items-center"
                            >
                              <motion.div
                                animate={
                                  penaltyStrikerState.phase === "celebrate"
                                    ? { y: [0, -10, 0], rotate: [0, 6, -6, 0] }
                                    : { y: 0, rotate: 0 }
                                }
                                transition={
                                  penaltyStrikerState.phase === "celebrate"
                                    ? { repeat: Infinity, duration: 0.6, ease: "easeInOut" }
                                    : { duration: 0.2 }
                                }
                                className="flex flex-col items-center"
                              >
                                {/* Striker Emoji Head / Expression */}
                                <div className="text-xl">
                                  {penaltyStrikerState.phase === "celebrate" ? "🙌" : penaltyStrikerState.phase === "disappointed" ? "🤦‍♂️" : "🏃‍♂️"}
                                </div>
                                {/* Striker Jersey #9 */}
                                <div className="w-8 h-8 bg-gradient-to-b from-blue-600 to-indigo-700 rounded-t-md border border-blue-400 flex items-center justify-center text-[9px] font-black text-white font-sans shadow-md">
                                  9
                                </div>
                                <div className="w-7 h-4 bg-slate-900 rounded-b-sm" />
                                <div className="flex gap-1.5 text-[10px] -mt-1">
                                  <span>👟</span>
                                  <span>👟</span>
                                </div>
                                <span className="text-[9px] font-black text-blue-200 bg-slate-950/80 px-1.5 py-0.2 rounded mt-0.5 shadow-xs">
                                  المسدد
                                </span>
                              </motion.div>
                            </motion.div>

                            {/* Animated Kicked Football ⚽ flying up from bottom ball spot directly to target answer card */}
                            {penaltyBallState.isShooting && (
                              <>
                                {/* Dynamic Turf Ball Shadow tracking the shot */}
                                <motion.div
                                  initial={{
                                    left: `${penaltyBallState.startX}%`,
                                    top: `${penaltyBallState.startY}%`,
                                    opacity: 0.65,
                                    scale: 1,
                                  }}
                                  animate={{
                                    left: `${penaltyBallState.x}%`,
                                    top: `${penaltyBallState.y + 14}%`,
                                    opacity: 0.2,
                                    scale: 1.4,
                                  }}
                                  transition={{ duration: 0.45, ease: "easeOut" }}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-3 rounded-full bg-slate-950/80 blur-[2px] z-25 pointer-events-none"
                                />

                                {/* Kicked Football launching upwards to the chosen answer */}
                                <motion.div
                                  initial={{
                                    left: `${penaltyBallState.startX}%`,
                                    top: `${penaltyBallState.startY}%`,
                                    scale: 1.05,
                                    rotate: 0,
                                  }}
                                  animate={{
                                    left: `${penaltyBallState.x}%`,
                                    top: `${penaltyBallState.y}%`,
                                    scale: penaltyBallState.scale || 0.52,
                                    rotate: penaltyBallState.rotation || 720,
                                  }}
                                  transition={{ duration: 0.45, ease: "easeOut" }}
                                  className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none text-4xl select-none filter drop-shadow-[0_8px_14px_rgba(0,0,0,0.85)]"
                                >
                                  ⚽
                                </motion.div>
                              </>
                            )}

                            {/* Floating Goal / Save TV Replay Banner */}
                            <AnimatePresence>
                              {penaltyGoalBanner && (
                                <motion.div
                                  initial={{ scale: 0.3, y: 20, opacity: 0 }}
                                  animate={{ scale: [0.3, 1.15, 1], y: 0, opacity: 1 }}
                                  exit={{ scale: 0.8, opacity: 0 }}
                                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 px-6 py-4 rounded-3xl border-2 shadow-2xl backdrop-blur-xl text-center font-black ${
                                    penaltyBallState.isGoal
                                      ? "bg-emerald-950/95 border-emerald-400 text-yellow-300 shadow-[0_0_55px_rgba(16,185,129,0.8)] text-xl sm:text-2xl"
                                      : "bg-rose-950/95 border-rose-400 text-rose-200 shadow-[0_0_55px_rgba(244,63,94,0.8)] text-lg sm:text-xl"
                                  }`}
                                >
                                  {penaltyGoalBanner}
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Confetti Sparks on Goal */}
                            {particles.map(p => (
                              <div
                                key={p.id}
                                style={{ left: `${p.x}%`, top: `${p.y}%`, backgroundColor: p.color }}
                                className="absolute w-3.5 h-3.5 rounded-full animate-ping z-30 pointer-events-none shadow-md"
                              />
                            ))}

                            {/* Beautiful Question Intro & Penalty Cup Preview Overlay */}
                            {isQuestionIntro && (
                              <div className="absolute inset-0 bg-slate-950/95 z-30 flex flex-col items-center justify-center p-4 sm:p-6 text-center overflow-hidden">
                                {gameIntroStage === "preview" ? (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="relative z-10 max-w-lg w-full bg-slate-900/90 border border-emerald-500/40 p-6 rounded-3xl shadow-[0_0_50px_rgba(16,185,129,0.3)] backdrop-blur-xl space-y-5"
                                  >
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-black tracking-wide">
                                      <span>⚽ بطولة ركلات الترجيح وكأس الأبطال</span>
                                      <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                                    </div>

                                    {/* Animated Football Kick in preview */}
                                    <div className="relative py-6 flex items-center justify-center h-28">
                                      <motion.div
                                        animate={{
                                          y: [0, -25, 0],
                                          rotate: [0, 360],
                                        }}
                                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                                        className="text-7xl select-none drop-shadow-[0_0_25px_rgba(16,185,129,0.8)]"
                                      >
                                        ⚽
                                      </motion.div>
                                    </div>

                                    <div className="space-y-2">
                                      <h3 className="text-xl md:text-2xl font-black text-white drop-shadow-md">
                                        سدد نحو شباك المرمى وهز الشباك! 🥅🔥
                                      </h3>
                                      <p className="text-xs sm:text-sm text-slate-300 font-bold leading-relaxed">
                                        اختر زاوية الإجابة الصحيحة لتسديد ركلة ترجيح صاروخية وتجاوز تصدي حارس المرمى!
                                      </p>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const q = activeChallenge.questions[currentQuestionIdx];
                                        if (q) triggerGameCountdown(currentQuestionIdx, "penalty_shootout", q);
                                      }}
                                      className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-600 to-green-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-emerald-950 transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 border border-emerald-300/30"
                                    >
                                      <span>بدء تسديد الركلات الآن ⚽</span>
                                    </button>
                                  </motion.div>
                                ) : gameIntroStage === "countdown" ? (
                                  <div className="relative z-10 max-w-lg w-full flex flex-col items-center justify-center space-y-6">
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 text-xs font-black shadow-md animate-pulse">
                                      <span>⚽ استعد لتسديد الركلة...</span>
                                    </div>

                                    <div className="relative flex items-center justify-center w-36 h-36">
                                      <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                                        className="absolute inset-0 rounded-full border-4 border-dashed border-emerald-400/40 shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                                      />

                                      <AnimatePresence mode="wait">
                                        {introCountdown === 3 && (
                                          <motion.span
                                            key="penalty-count-3"
                                            initial={{ scale: 0.2, opacity: 0 }}
                                            animate={{ scale: [0.2, 1.4, 1], opacity: 1 }}
                                            exit={{ scale: 1.8, opacity: 0 }}
                                            className="text-7xl font-sans font-black text-rose-500 drop-shadow-[0_0_35px_#f43f5e]"
                                          >
                                            3
                                          </motion.span>
                                        )}
                                        {introCountdown === 2 && (
                                          <motion.span
                                            key="penalty-count-2"
                                            initial={{ scale: 0.2, opacity: 0 }}
                                            animate={{ scale: [0.2, 1.4, 1], opacity: 1 }}
                                            exit={{ scale: 1.8, opacity: 0 }}
                                            className="text-7xl font-sans font-black text-amber-400 drop-shadow-[0_0_35px_#f59e0b]"
                                          >
                                            2
                                          </motion.span>
                                        )}
                                        {introCountdown === 1 && (
                                          <motion.span
                                            key="penalty-count-1"
                                            initial={{ scale: 0.2, opacity: 0 }}
                                            animate={{ scale: [0.2, 1.4, 1], opacity: 1 }}
                                            exit={{ scale: 1.8, opacity: 0 }}
                                            className="text-7xl font-sans font-black text-emerald-400 drop-shadow-[0_0_35px_#10b981]"
                                          >
                                            1
                                          </motion.span>
                                        )}
                                        {introCountdown === 0 && (
                                          <motion.div
                                            key="penalty-count-go"
                                            initial={{ scale: 0.3, opacity: 0 }}
                                            animate={{ scale: [0.3, 1.3, 1], opacity: 1 }}
                                            className="text-3xl sm:text-4xl font-black text-yellow-300 drop-shadow-[0_0_40px_#fde047] whitespace-nowrap"
                                          >
                                            ⚽ سدد! ✨
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>

                                    <div className="bg-slate-900/90 border border-emerald-500/40 p-4 rounded-2xl max-w-md w-full text-center space-y-1 shadow-xl backdrop-blur-md">
                                      <span className="text-[10px] text-emerald-300 font-extrabold uppercase tracking-widest">الركلة الأولى</span>
                                      <p className="text-sm md:text-base font-black text-white line-clamp-2">
                                        {activeChallenge.questions[currentQuestionIdx]?.text}
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  /* STANDARD QUESTION INTRO DISPLAY */
                                  <div className="space-y-6 max-w-lg flex flex-col items-center">
                                    <span className={`px-3 py-1 bg-emerald-600/30 text-emerald-300 border border-emerald-500/20 rounded-full text-xs font-black tracking-widest uppercase transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-75' : 'opacity-100 animate-pulse'}`}>
                                      الركلة القادمة ⚽
                                    </span>
                                    
                                    <h2 
                                      className={`text-2xl md:text-3xl lg:text-4xl font-black text-white leading-relaxed drop-shadow-[0_2px_15px_rgba(16,185,129,0.4)] transition-all duration-700 transform ${
                                        isTransitioning 
                                          ? '-translate-y-[220px] scale-50 opacity-0 pointer-events-none' 
                                          : 'translate-y-0 scale-100 opacity-100'
                                      }`}
                                    >
                                      {activeChallenge.questions[currentQuestionIdx]?.text}
                                    </h2>

                                    <div className={`flex flex-col items-center gap-2 pt-4 transition-all duration-500 ${isTransitioning ? 'opacity-0 scale-75' : 'opacity-100'}`}>
                                      <span className="text-[10px] text-slate-400 font-extrabold uppercase">انطلاق الركلة خلال</span>
                                      <div className="w-14 h-14 rounded-full bg-emerald-600/20 border-2 border-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-950/50">
                                        <span className="text-2xl font-sans font-black text-yellow-400 animate-bounce">
                                          {introCountdown}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Quick Shot Buttons for Mobile / Tablet / Desktop */}
                          <div className="space-y-2">
                            <p className="text-[11px] text-center text-slate-400 font-bold leading-relaxed">
                              💡 <span className="text-emerald-400">طريقة التسديد:</span> اضغط مباشرة على إحدى زوايا المرمى الأربعة، أو انقر على أحد الخيارات أدناه، أو استخدم أرقام الكيبورد (1، 2، 3، 4) لتسديد ركلة الترجيح!
                            </p>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {activeChallenge.questions[currentQuestionIdx]?.options.map((opt, optIdx) => {
                                let cornerBadge = "";
                                if (optIdx === 0) cornerBadge = "📐 المقص الأيسر";
                                else if (optIdx === 1) cornerBadge = "📐 المقص الأيمن";
                                else if (optIdx === 2) cornerBadge = "⚡ زاحفة يسار";
                                else if (optIdx === 3) cornerBadge = "⚡ زاحفة يمين";

                                return (
                                  <button
                                    key={`quick-shot-btn-${optIdx}`}
                                    type="button"
                                    disabled={isAnswerRevealed}
                                    onClick={() => handlePenaltyShot(optIdx)}
                                    className="p-2.5 bg-slate-900/90 hover:bg-emerald-950 border border-slate-700/80 hover:border-emerald-500 text-slate-200 rounded-xl text-xs font-black transition cursor-pointer flex flex-col items-start gap-1 active:scale-95 disabled:opacity-50 group shadow-md"
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className="text-yellow-400 font-sans font-black text-[11px]">[{optIdx + 1}]</span>
                                      <span className="text-[10px] text-emerald-400 group-hover:text-yellow-300 transition font-bold">{cornerBadge}</span>
                                    </div>
                                    <span className="truncate w-full text-right text-white font-black">{opt}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* 5. CLOUD AIRPLANE GAME ARENA ✈️☁️ (طائرة السحاب) */}
                  {activeChallenge.gameType === "cloud_airplane" && (
                    <div 
                      className={`relative w-full ${
                        isAirplaneFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : 'h-[620px] sm:h-[680px] rounded-3xl'
                      } overflow-hidden select-none border-4 border-sky-400/40 shadow-2xl bg-gradient-to-b from-sky-400 via-sky-300 to-sky-200 flex flex-col justify-between`}
                    >
                      {/* Background Floating Atmosphere Clouds */}
                      <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {/* Distant soft background clouds - lightweight gradient shapes */}
                        <div className="absolute -top-6 -left-10 w-72 h-36 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.35)_0%,transparent_75%)] rounded-full" />
                        <div className="absolute top-20 -right-12 w-96 h-44 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.30)_0%,transparent_75%)] rounded-full" />
                        <div className="absolute top-48 left-1/3 w-80 h-32 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.25)_0%,transparent_75%)] rounded-full" />

                        {/* City Skyline Silhouette at bottom (matching screenshot) */}
                        <div className="absolute bottom-0 left-0 right-0 h-36 sm:h-44 pointer-events-none z-5 opacity-40">
                          <svg className="w-full h-full" viewBox="0 0 1200 300" preserveAspectRatio="none">
                            <defs>
                              <linearGradient id="cityGrad1" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.7" />
                              </linearGradient>
                              <linearGradient id="cityGrad2" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.6" />
                              </linearGradient>
                            </defs>
                            {/* Back layer buildings */}
                            <path
                              fill="url(#cityGrad1)"
                              d="M0 300 L0 180 L40 180 L40 150 L60 150 L60 180 L120 180 L120 110 L130 110 L130 90 L140 110 L180 110 L180 200 L240 200 L240 130 L270 130 L270 200 L320 200 L320 160 L360 160 L360 90 L390 90 L390 200 L440 200 L440 140 L480 140 L480 200 L540 200 L540 110 L550 110 L550 80 L560 110 L600 110 L600 200 L660 200 L660 150 L710 150 L710 200 L760 200 L760 120 L810 120 L810 200 L870 200 L870 140 L910 140 L910 200 L960 200 L960 100 L970 100 L970 70 L980 100 L1020 100 L1020 200 L1080 200 L1080 150 L1130 150 L1130 200 L1200 200 L1200 300 Z"
                            />
                            {/* Front layer buildings */}
                            <path
                              fill="url(#cityGrad2)"
                              d="M0 300 L0 220 L30 220 L30 190 L70 190 L70 230 L100 230 L100 160 L140 160 L140 230 L200 230 L200 170 L250 170 L250 230 L300 230 L300 180 L340 180 L340 230 L400 230 L400 150 L450 150 L450 230 L500 230 L500 190 L530 190 L530 230 L580 230 L580 170 L630 170 L630 230 L690 230 L690 180 L740 180 L740 230 L790 230 L790 160 L840 160 L840 230 L890 230 L890 190 L940 190 L940 230 L1000 230 L1000 170 L1050 170 L1050 230 L1110 230 L1110 190 L1150 190 L1150 230 L1200 230 L1200 300 Z"
                            />
                          </svg>
                        </div>
                      </div>

                      {/* TOP HEADER BAR (Exactly as shown in user screenshot) */}
                      <div className="relative z-20 w-full px-5 pt-4 flex items-center justify-between pointer-events-auto">
                        {/* Left: Timer Display (e.g. 0:38) */}
                        <div className="flex items-center">
                          <span className="text-white font-sans text-2xl sm:text-3xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] tracking-wider">
                            {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, "0")}
                          </span>
                        </div>

                        {/* Center: Result Banner (e.g. "خطأ!" or "صحيح! 🎉") */}
                        <div className="flex-1 flex items-center justify-center">
                          <AnimatePresence>
                            {airplaneBanner && (
                              <motion.div
                                key={airplaneBanner}
                                initial={{ opacity: 0, scale: 0.5, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ type: "spring", stiffness: 350, damping: 20 }}
                                className={`text-2xl sm:text-4xl font-black drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)] ${
                                  airplaneBannerType === "correct"
                                    ? "text-emerald-100 drop-shadow-[0_0_20px_rgba(16,185,129,0.9)]"
                                    : "text-white drop-shadow-[0_0_20px_rgba(239,68,68,0.9)]"
                                }`}
                              >
                                {airplaneBanner}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Right: Lives Hearts & Correct Score (e.g. 🤍 🤍 1✔) */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xl sm:text-2xl select-none">
                            {[0, 1, 2].map(idx => (
                              <span 
                                key={idx} 
                                className={`transition-all duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] ${
                                  idx < airplaneLives ? 'text-red-500 scale-100' : 'text-white/85 scale-90'
                                }`}
                              >
                                {idx < airplaneLives ? '❤️' : '🤍'}
                              </span>
                            ))}
                          </div>

                          <span className="text-white font-sans text-xl sm:text-2xl font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] mr-1">
                            {correctCount}✔
                          </span>
                        </div>
                      </div>

                      {/* FLIGHT SKY & CLOUDS INTERACTIVE STAGE */}
                      <div 
                        ref={airplaneArenaRef}
                        onPointerDown={handleArenaPointerDown}
                        onPointerMove={handleArenaPointerMove}
                        onPointerUp={handleArenaPointerUp}
                        onPointerCancel={handleArenaPointerUp}
                        className="relative flex-1 w-full overflow-hidden select-none cursor-crosshair touch-none"
                      >
                        {/* Render Floating & Moving Answer Clouds */}
                        {(airplaneClouds && airplaneClouds.length > 0
                          ? airplaneClouds
                          : (activeChallenge.questions[currentQuestionIdx]?.options || []).map((opt, i) => ({
                              idx: i,
                              text: opt,
                              x: 20 + i * 25,
                              y: 30 + (i % 2) * 30,
                              baseY: 30 + (i % 2) * 30,
                              speed: 0.30,
                              waveOffset: 0
                            }))
                        ).map((cloud) => {
                          const optIdx = cloud.idx;
                          const isSelected = selectedAnswerIdx === optIdx;
                          const isTargeted = airplaneTargetCloud === optIdx;
                          const isHovered = airplaneHoverIdx === optIdx;
                          const q = activeChallenge.questions[currentQuestionIdx];
                          const isThisCorrect = checkIsCorrect(q, optIdx);

                          let cloudSkin = "normal";
                          if (isAnswerRevealed) {
                            if (isThisCorrect) cloudSkin = "correct";
                            else if (isSelected && !isThisCorrect) cloudSkin = "wrong";
                          }

                          return (
                            <div
                              key={`cloud-option-${optIdx}`}
                              ref={(el) => { cloudDomRefs.current[optIdx] = el; }}
                              style={{
                                left: `${cloud.x}%`,
                                top: `${cloud.y}%`,
                                transform: 'translate(-50%, -50%)',
                                willChange: 'left, top',
                              }}
                              className="absolute z-15 pointer-events-none select-none"
                            >
                              {/* Lightweight Cloud Graphic without GPU-killing SVG drop-shadow filter */}
                              <div className="relative">
                                <svg
                                  className={`w-44 sm:w-56 md:w-64 h-24 sm:h-28 transition-colors duration-200 ${
                                    cloudSkin === "correct"
                                      ? "text-emerald-100"
                                      : cloudSkin === "wrong"
                                      ? "text-slate-700"
                                      : isHovered
                                      ? "text-sky-50"
                                      : "text-white"
                                  }`}
                                  viewBox="0 0 240 120"
                                  fill="currentColor"
                                >
                                  {/* Soft native SVG cloud shadow - 0ms raster overhead on mobile GPU */}
                                  <ellipse cx="120" cy="96" rx="84" ry="12" fill="rgba(15,23,42,0.12)" />
                                  {/* Puffy multi-lobed cloud path */}
                                  <path d="M 45,95 Q 15,95 15,70 Q 15,50 35,45 Q 40,20 70,20 Q 90,20 100,32 Q 115,10 145,10 Q 180,10 190,38 Q 215,35 225,58 Q 235,80 215,95 Q 200,95 185,95 Z" />
                                  <ellipse cx="65" cy="72" rx="42" ry="26" />
                                  <ellipse cx="120" cy="62" rx="55" ry="36" />
                                  <ellipse cx="175" cy="72" rx="42" ry="26" />
                                  <ellipse cx="95" cy="48" rx="35" ry="28" />
                                  <ellipse cx="150" cy="45" rx="38" ry="28" />
                                </svg>

                                {/* Storm Lightning Flash on Wrong Cloud */}
                                {cloudSkin === "wrong" && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: [0, 1, 0, 1, 0.8], scale: 1 }}
                                    transition={{ duration: 0.4 }}
                                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-3xl select-none"
                                  >
                                    ⚡
                                  </motion.div>
                                )}

                                {/* Sparkle Stars on Correct Cloud */}
                                {cloudSkin === "correct" && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: [0.8, 1.2, 1] }}
                                    transition={{ duration: 0.5 }}
                                    className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xl select-none"
                                  >
                                    <span>✨</span>
                                    <span className="text-xs font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-md">
                                      +150 🌟
                                    </span>
                                    <span>✨</span>
                                  </motion.div>
                                )}

                                {/* Option Content Inside Cloud */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center pointer-events-none">
                                  <span className={`font-black text-xs sm:text-sm md:text-base leading-snug line-clamp-2 px-3 select-none ${
                                    cloudSkin === "wrong" ? "text-white" : "text-slate-900"
                                  }`}>
                                    {cloud.text}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}

                        {/* RED PROPELLER AIRPLANE */}
                        <div
                          ref={airplaneSpriteRef}
                          style={{
                            left: `${airplanePos.x}%`,
                            top: `${airplanePos.y}%`,
                            transform: `translate(-50%, -50%) rotate(${airplaneAngle}deg)`,
                            width: "110px",
                            height: "70px",
                            willChange: "left, top, transform",
                          }}
                          className="absolute z-25 pointer-events-none"
                        >
                          {/* Propeller Vapor Trail */}
                          <div className="absolute -left-5 top-1/2 -translate-y-1/2 flex items-center space-x-1 opacity-60">
                            <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                            <span className="w-3 h-1.5 rounded-full bg-white/70" />
                          </div>

                          {/* High Quality Red Passenger Propeller Airplane SVG */}
                          <svg
                            className="w-full h-full"
                            viewBox="0 0 160 100"
                            fill="none"
                          >
                            {/* Tail Rudder (Red with white trim) */}
                            <path d="M 15 48 L 5 15 L 28 15 L 35 48 Z" fill="#b91c1c" />
                            <path d="M 5 15 L 28 15 L 24 24 L 8 24 Z" fill="#f87171" />
                            
                            {/* Horizontal Stabilizers */}
                            <path d="M 8 50 L 2 44 L 20 44 L 26 50 Z" fill="#991b1b" />

                            {/* Main Fuselage (Curved aerodynamic red cabin) */}
                            <path
                              d="M 22 52 C 20 42, 35 34, 60 33 C 95 32, 130 36, 145 48 C 150 52, 150 56, 144 60 C 130 68, 95 70, 60 69 C 35 68, 20 62, 22 52 Z"
                              fill="#dc2626"
                            />
                            {/* Fuselage top highlight */}
                            <path
                              d="M 35 42 C 55 36, 100 36, 140 48 C 120 42, 75 40, 35 42 Z"
                              fill="#f87171"
                              opacity="0.8"
                            />

                            {/* White Racing Stripe */}
                            <path
                              d="M 28 54 C 55 52, 100 52, 142 53 C 142 56, 100 55, 28 57 Z"
                              fill="#ffffff"
                            />

                            {/* Cockpit Windshield (Glass Blue) */}
                            <path
                              d="M 124 43 C 132 44, 138 48, 142 52 L 130 52 C 126 48, 124 45, 124 43 Z"
                              fill="#38bdf8"
                              stroke="#ffffff"
                              strokeWidth="1"
                            />
                            {/* Cabin Windows (Round Portholes) */}
                            <circle cx="108" cy="48" r="3.5" fill="#bae6fd" stroke="#991b1b" strokeWidth="0.8" />
                            <circle cx="92" cy="48" r="3.5" fill="#bae6fd" stroke="#991b1b" strokeWidth="0.8" />
                            <circle cx="76" cy="48" r="3.5" fill="#bae6fd" stroke="#991b1b" strokeWidth="0.8" />
                            <circle cx="60" cy="48" r="3.5" fill="#bae6fd" stroke="#991b1b" strokeWidth="0.8" />

                            {/* Main Wing (Red with darker underwing shadow) */}
                            <path
                              d="M 68 53 L 88 88 C 94 90, 102 88, 102 84 L 98 53 Z"
                              fill="#b91c1c"
                            />
                            <path
                              d="M 72 53 L 90 84 L 96 84 L 95 53 Z"
                              fill="#ef4444"
                            />
                            {/* Wingtip Light */}
                            <circle cx="96" cy="86" r="2" fill="#22c55e" />

                            {/* Front Nose Spinner Hub */}
                            <path
                              d="M 144 48 C 152 50, 155 54, 144 58 Z"
                              fill="#e2e8f0"
                            />

                            {/* High-speed Spinning Propeller Blur Effect */}
                            <g className="origin-[148px_53px]">
                              <ellipse cx="149" cy="53" rx="2.5" ry="24" fill="#f8fafc" opacity="0.75" />
                              <ellipse cx="149" cy="53" rx="1.5" ry="18" fill="#38bdf8" opacity="0.4" />
                            </g>
                          </svg>

                          {/* Airplane State Reactions */}
                          {airplaneState === "celebrating" && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: [0, 1.4, 1] }}
                              className="absolute -top-4 -right-2 text-2xl select-none"
                            >
                              🌟
                            </motion.div>
                          )}
                          {airplaneState === "hit_wrong" && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: [0, 1, 0] }}
                              transition={{ duration: 0.5 }}
                              className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl select-none"
                            >
                              💨
                            </motion.div>
                          )}
                        </div>

                        {/* Confetti & Sparkles */}
                        {particles.map(p => (
                          <div
                            key={p.id}
                            style={{ left: `${p.x}%`, top: `${p.y}%`, backgroundColor: p.color }}
                            className="absolute w-3.5 h-3.5 rounded-full animate-ping z-30 pointer-events-none shadow-md"
                          />
                        ))}

                        {/* On-Screen Aerodynamic Flight Controls (Arrow Pad for Touch & Mouse) */}
                        <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-30 pointer-events-auto flex items-center gap-1.5 bg-slate-950/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shadow-2xl select-none">
                          {/* Left Arrow Button */}
                          <button
                            type="button"
                            onPointerDown={(e) => { e.preventDefault(); airplaneArrowHoldRef.current.left = true; }}
                            onPointerUp={() => { airplaneArrowHoldRef.current.left = false; }}
                            onPointerLeave={() => { airplaneArrowHoldRef.current.left = false; }}
                            onPointerCancel={() => { airplaneArrowHoldRef.current.left = false; }}
                            className="w-10 h-10 rounded-xl bg-white/15 hover:bg-sky-500/40 active:bg-sky-500/70 text-white font-black text-sm sm:text-base flex items-center justify-center border border-white/10 transition active:scale-95 shadow-sm"
                            title="تحريك لليسار (◄)"
                          >
                            ◄
                          </button>

                          {/* Vertical Column (Up & Down) */}
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              onPointerDown={(e) => { e.preventDefault(); airplaneArrowHoldRef.current.up = true; }}
                              onPointerUp={() => { airplaneArrowHoldRef.current.up = false; }}
                              onPointerLeave={() => { airplaneArrowHoldRef.current.up = false; }}
                              onPointerCancel={() => { airplaneArrowHoldRef.current.up = false; }}
                              className="w-10 h-8 rounded-xl bg-white/15 hover:bg-sky-500/40 active:bg-sky-500/70 text-white font-black text-xs sm:text-sm flex items-center justify-center border border-white/10 transition active:scale-95 shadow-sm"
                              title="صعود للأعلى (▲)"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onPointerDown={(e) => { e.preventDefault(); airplaneArrowHoldRef.current.down = true; }}
                              onPointerUp={() => { airplaneArrowHoldRef.current.down = false; }}
                              onPointerLeave={() => { airplaneArrowHoldRef.current.down = false; }}
                              onPointerCancel={() => { airplaneArrowHoldRef.current.down = false; }}
                              className="w-10 h-8 rounded-xl bg-white/15 hover:bg-sky-500/40 active:bg-sky-500/70 text-white font-black text-xs sm:text-sm flex items-center justify-center border border-white/10 transition active:scale-95 shadow-sm"
                              title="هبوط للأسفل (▼)"
                            >
                              ▼
                            </button>
                          </div>

                          {/* Right Arrow Button */}
                          <button
                            type="button"
                            onPointerDown={(e) => { e.preventDefault(); airplaneArrowHoldRef.current.right = true; }}
                            onPointerUp={() => { airplaneArrowHoldRef.current.right = false; }}
                            onPointerLeave={() => { airplaneArrowHoldRef.current.right = false; }}
                            onPointerCancel={() => { airplaneArrowHoldRef.current.right = false; }}
                            className="w-10 h-10 rounded-xl bg-white/15 hover:bg-sky-500/40 active:bg-sky-500/70 text-white font-black text-sm sm:text-base flex items-center justify-center border border-white/10 transition active:scale-95 shadow-sm"
                            title="تحريك لليمين (►)"
                          >
                            ►
                          </button>
                        </div>
                      </div>

                      {/* BOTTOM QUESTION BAR (Identical to screenshot!) */}
                      <div className="relative z-20 w-full px-4 pb-3 flex flex-col items-center gap-2 pointer-events-auto">
                        {/* Question Card Box */}
                        <div className="w-full max-w-3xl bg-slate-900/90 border border-slate-700/80 rounded-2xl sm:rounded-3xl p-3 sm:p-4 text-center shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
                          {/* Menu Bar Icon Left */}
                          <button
                            type="button"
                            onClick={() => triggerToast("استخدم الفأرة أو اللمس لتوجيه الطائرة نحو السحابة ذات الإجابة الصحيحة ☁️✈️", "info")}
                            className="p-2 text-slate-400 hover:text-white transition rounded-xl hover:bg-slate-800 shrink-0 cursor-pointer"
                            title="تعليمات اللعبة"
                          >
                            <span className="text-lg">☰</span>
                          </button>

                          {/* Question Text in Center */}
                          <div className="flex-1 text-center">
                            <h3 className="text-white font-black text-sm sm:text-base md:text-lg leading-relaxed line-clamp-2">
                              {activeChallenge.questions[currentQuestionIdx]?.text}
                            </h3>
                          </div>

                          {/* Right Controls (Audio & Fullscreen) */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => setSoundEnabled(!soundEnabled)}
                              className="p-2 text-slate-400 hover:text-white transition rounded-xl hover:bg-slate-800 cursor-pointer"
                              title={soundEnabled ? "كتم الصوت" : "تشغيل الصوت"}
                            >
                              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsAirplaneFullscreen(!isAirplaneFullscreen)}
                              className="p-2 text-slate-400 hover:text-white transition rounded-xl hover:bg-slate-800 cursor-pointer"
                              title={isAirplaneFullscreen ? "تصغير الشاشة" : "ملء الشاشة"}
                            >
                              {isAirplaneFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Flight Guidance Indicator */}
                        <div className="flex items-center gap-2 text-xs text-sky-200/90 bg-slate-900/80 border border-sky-500/30 px-3.5 py-1.5 rounded-full backdrop-blur-md font-bold shadow-lg">
                          <span>✈️</span>
                          <span>وجّه الطائرة باللمس أو الأسهم للاصطدام بسحابة الإجابة الصحيحة</span>
                        </div>
                      </div>

                      {/* Game Intro & Preview Overlay */}
                      {isQuestionIntro && (
                        <div className="absolute inset-0 bg-slate-950/90 z-40 flex flex-col items-center justify-center p-4 sm:p-6 text-center overflow-hidden">
                          {gameIntroStage === "preview" ? (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="relative z-10 max-w-lg w-full bg-slate-900/95 border border-sky-400/40 p-6 rounded-3xl shadow-[0_0_50px_rgba(56,189,248,0.3)] backdrop-blur-xl space-y-5"
                            >
                              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-200 text-xs font-black tracking-wide">
                                <span>✈️ مغامرة طائرة السحاب</span>
                                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
                              </div>

                              <div className="relative py-4 flex items-center justify-center h-24">
                                <motion.div
                                  animate={{
                                    y: [0, -15, 0],
                                    rotate: [0, 8, -8, 0],
                                  }}
                                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                  className="text-6xl select-none drop-shadow-[0_0_20px_rgba(56,189,248,0.8)]"
                                >
                                  ✈️
                                </motion.div>
                              </div>

                              <div className="space-y-2">
                                <h3 className="text-xl md:text-2xl font-black text-white drop-shadow-md">
                                  حلّق في السماء واخترق سحب الإجابة الصحيحة! ☁️✈️
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-300 font-bold leading-relaxed">
                                  وجّه الطائرة باللمس أو الأسهم للاصطدام بسحابة الإجابة الصحيحة لكسب النقاط والتقدم! ✈️☁️
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  const q = activeChallenge.questions[currentQuestionIdx];
                                  if (q) triggerGameCountdown(currentQuestionIdx, "cloud_airplane", q);
                                }}
                                className="w-full py-3.5 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-2xl text-sm font-black shadow-lg shadow-sky-950 transition transform active:scale-95 cursor-pointer flex items-center justify-center gap-2 border border-sky-300/30"
                              >
                                <span>بدء التحليق الآن ✈️</span>
                              </button>
                            </motion.div>
                          ) : (
                            <div className="relative z-10 max-w-lg w-full flex flex-col items-center justify-center space-y-6">
                              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-sky-500/10 border border-sky-400/30 text-sky-300 text-xs font-black shadow-md animate-pulse">
                                <span>✈️ استعد للتحليق...</span>
                              </div>

                              <div className="relative flex items-center justify-center w-36 h-36">
                                <AnimatePresence mode="wait">
                                  {introCountdown > 0 && (
                                    <motion.span
                                      key={`cloud-count-${introCountdown}`}
                                      initial={{ scale: 0.2, opacity: 0 }}
                                      animate={{ scale: [0.2, 1.4, 1], opacity: 1 }}
                                      exit={{ scale: 1.8, opacity: 0 }}
                                      className="text-7xl font-sans font-black text-sky-300 drop-shadow-[0_0_35px_#38bdf8]"
                                    >
                                      {introCountdown}
                                    </motion.span>
                                  )}
                                  {introCountdown === 0 && (
                                    <motion.div
                                      key="cloud-count-go"
                                      initial={{ scale: 0.3, opacity: 0 }}
                                      animate={{ scale: [0.3, 1.3, 1], opacity: 1 }}
                                      className="text-3xl sm:text-4xl font-black text-yellow-300 drop-shadow-[0_0_40px_#fde047] whitespace-nowrap"
                                    >
                                      ✈️ حلّق الآن! ✨
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>

                              <div className="bg-slate-900/90 border border-sky-500/40 p-4 rounded-2xl max-w-md w-full text-center space-y-1 shadow-xl backdrop-blur-md">
                                <span className="text-[10px] text-sky-300 font-extrabold uppercase tracking-widest">السؤال الحالي</span>
                                <p className="text-sm md:text-base font-black text-white line-clamp-2">
                                  {activeChallenge.questions[currentQuestionIdx]?.text}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
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

                  {activeChallenge.liveState && (activeChallenge.liveState as string) !== "podium" && (
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1 text-center animate-pulse shadow-lg">
                      <div className="flex items-center justify-center gap-2 text-amber-300 font-black text-sm">
                        <span>⌛</span>
                        <span>بانتظار إكمال بقية الطلاب والتتويج 🏆</span>
                      </div>
                      <p className="text-xs text-slate-200 font-bold">
                        أنجزت جميع الأسئلة وحصلت على <span className="text-yellow-400 font-sans font-black">{score}</span> نقطة. ستظهر منصة التتويج والأبطال فور إعلان المعلم للنتائج!
                      </p>
                    </div>
                  )}

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
                      className="px-6 py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs sm:text-sm font-black transition cursor-pointer border border-rose-400/30 shadow-lg flex items-center justify-center gap-2 hover:brightness-110"
                    >
                      <LogOut className="w-4 h-4 rotate-180" />
                      <span>إغلاق وإنهاء اللعبة بدون تتويج 🚪</span>
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
          const matchedFixedGame = FIXED_GAMES.find(fg => fg.id === selectedLeaderboardChallengeId || fg.gameType === selectedLeaderboardChallengeId);
          const targetChallenge = reviewChallenges.find(c => c.id === selectedLeaderboardChallengeId) ||
            reviewChallenges.find(c => c.gameType === selectedLeaderboardChallengeId) ||
            reviewChallenges.find(c => matchedFixedGame && (c.gameType === matchedFixedGame.gameType || c.id === matchedFixedGame.id));
          const fixedGameMeta = matchedFixedGame || FIXED_GAMES.find(fg => fg.gameType === targetChallenge?.gameType) || FIXED_GAMES[0];
          
          const gameDocId = targetChallenge?.id || matchedFixedGame?.id || selectedLeaderboardChallengeId;
          const gameScores = reviewScores.filter(s => 
            s.challengeId === gameDocId || 
            s.challengeId === selectedLeaderboardChallengeId ||
            (fixedGameMeta && s.challengeId === `fixed_game_${fixedGameMeta.gameType}`) ||
            (targetChallenge?.gameType && s.challengeId === targetChallenge.gameType)
          );
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
                      {targetChallenge && targetChallenge.questions && targetChallenge.questions.length > 0 ? (() => {
                        const targetSavedProg = savedRoundProgressRef.current[targetChallenge.id] || null;
                        const isTargetFinished = targetSavedProg && (targetSavedProg.hasFinishedWaygroundQuestions || targetSavedProg.gameState === "finished" || targetSavedProg.currentQuestionIdx >= targetChallenge.questions.length);

                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLeaderboardChallengeId(null);
                              handleStartGame(targetChallenge);
                            }}
                            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-2xl text-xs sm:text-sm font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 hover:scale-[1.01] active:scale-95"
                          >
                            <Play className="w-4 h-4 fill-white" />
                            <span>
                              {isTargetFinished
                                ? "عرض نتائج الجولة المباشرة 🏆"
                                : targetSavedProg && targetSavedProg.currentQuestionIdx > 0
                                ? `متابعة واستكمال الجولة (سؤال ${targetSavedProg.currentQuestionIdx + 1}) 🚀`
                                : myScore
                                ? "متابعة التحدي 🔄"
                                : "ابدأ التحدي الآن 🚀"}
                            </span>
                          </button>
                        );
                      })() : (
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
