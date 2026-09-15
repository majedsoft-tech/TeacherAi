import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  BookOpen, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  X, 
  RotateCcw, 
  LogOut, 
  Award, 
  Sparkles, 
  Trophy, 
  HelpCircle, 
  ChevronUp,
  Volume2,
  VolumeX,
  Play,
  CheckCircle2,
  AlertCircle,
  Search,
  Copy,
  CheckCheck,
  Zap,
  Lock,
  Clock,
  ArrowLeft
} from "lucide-react";
import { BankQuestion, Student } from "../types";
import { isTrueFalseQuestion as isTFHelper, normalizeQuestion, isGradeMatching, isClassMatching } from "../utils/questionUtils";
import { db } from "../firebase";
import { collection, doc, setDoc, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { BigRealisticPadlock } from "./BigRealisticPadlock";
import {
  getOngoingQuizzesForStudent,
  getLockingQuizForSubject,
  formatRemainingTime,
  OngoingQuizInfo
} from "../utils/quizLockUtils";

// --- RETRO SOUND SYNTHESIZER ENGINE FOR REVIEWS ---
class ReviewSoundSynth {
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
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.setValueAtTime(400, now + 0.05);
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playSuccess() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(440, now); // A4
    osc.frequency.setValueAtTime(554.37, now + 0.1); // C#5
    osc.frequency.setValueAtTime(659.25, now + 0.2); // E5
    osc.frequency.setValueAtTime(880, now + 0.3); // A5
    osc.frequency.setValueAtTime(1108.73, now + 0.4); // C#6
    osc.frequency.setValueAtTime(1318.51, now + 0.5); // E6
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.75);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.8);
  }
}

// Preloaded full curriculum contents matching photo and typical curriculum structure
export const PRELOADED_SUBJECTS: Record<string, {
  name: string;
  units: Array<{
    name: string;
    lessons: Array<{
      name: string;
      questions: Array<{
        id: string;
        text: string;
        type: 'multiple_choice' | 'true_false';
        options: string[];
        correctAnswer: string; // "0", "1", "2", "3" or "true", "false"
        help: string;
      }>;
    }>;
  }>;
}> = {
  "تقنية رقمية 1-2": {
    name: "تقنية رقمية 1-2",
    units: [
      {
        name: "الوحدة الاولى: معالجة الصور المتقدمة",
        lessons: [
          {
            name: "الدرس الأول: أساسيات تحرير الصور",
            questions: [
              {
                id: "tech_u1_l1_q1",
                text: "النظام الأفضل لنتائج الطباعة هو:",
                type: "multiple_choice",
                options: [
                  "نظام (RGB Mode)",
                  "نظام (CMYK Mode)",
                  "نظام (Depth Mode)",
                  "نظام (Gray Mode)"
                ],
                correctAnswer: "1",
                help: "نظام CMYK (Cyan, Magenta, Yellow, Key/Black) يعتمد على خلط الحبر المادي وهو النظام القياسي لجميع الطابعات، بينما نظام RGB مخصص للشاشات الرقمية."
              },
              {
                id: "tech_u1_l1_q2",
                text: "وحدة قياس دقة الصور الرقمية عند الطباعة هي:",
                type: "multiple_choice",
                options: [
                  "بكسل لكل بوصة (PPI)",
                  "نقطة لكل بوصة (DPI)",
                  "سنتيمتر مربع",
                  "ميجابايت"
                ],
                correctAnswer: "1",
                help: "تقاس دقة الطابعات بنقاط الحبر في كل بوصة (DPI - Dots Per Inch) بينما دقة الشاشات تقاس بالبكسل لكل بوصة (PPI)."
              },
              {
                id: "tech_u1_l1_q3",
                text: "تتكون الصور النقطية (Raster Images) من شبكة من المربعات الصغيرة الملونة تسمى:",
                type: "multiple_choice",
                options: [
                  "الخطوط (Vectors)",
                  "البكسل (Pixels)",
                  "العقد (Nodes)",
                  "الطبقات (Layers)"
                ],
                correctAnswer: "1",
                help: "البكسل هو أصغر عنصر هيكلي في الصورة النقطية وتحدد كمية البكسلات دقة ووضوح الصورة."
              },
              {
                id: "tech_u1_l1_q4",
                text: "تتميز الصور المتجهة (Vector Images) بأنها لا تفقد دقتها عند تكبيرها بأي حجم.",
                type: "true_false",
                options: ["صح", "خطأ"],
                correctAnswer: "true",
                help: "تعتمد الصور المتجهة على معادلات رياضية لرسم الخطوط والأشكال، لذلك تحتفظ بدقتها الكاملة والجودة العالية بغض النظر عن نسبة التكبير."
              },
              {
                id: "tech_u1_l1_q5",
                text: "أي صيغة من الصيغ التالية تدعم الخلفية الشفافة للصور؟",
                type: "multiple_choice",
                options: [
                  " صيغة JPEG",
                  "صيغة PNG",
                  "صيغة BMP",
                  "صيغة PDF"
                ],
                correctAnswer: "1",
                help: "صيغة PNG (Portable Network Graphics) تدعم الشفافية (Transparency) وقناة ألفا مما يجعلها مثالية للشعارات والتصاميم المفرغة."
              }
            ]
          },
          {
            name: "الدرس الثاني: الطبقات (Layers)",
            questions: [
              {
                id: "tech_u1_l2_q1",
                text: "تستخدم الطبقات (Layers) in برامج تحرير الصور لـ:",
                type: "multiple_choice",
                options: [
                  "تقليل مساحة تخزين ملف الصورة",
                  "فصل عناصر التصميم والتعديل عليها بشكل مستقل",
                  "تسريع معالجة بطاقة الرسومات",
                  "تحسين سرعة طباعة الأوراق"
                ],
                correctAnswer: "1",
                help: "تتيح الطبقات إمكانية عزل كل عنصر (نص، صورة، شكل) والتعديل عليه أو تحريكه أو حذفه دون التأثير على بقية أجزاء التصميم."
              },
              {
                id: "tech_u1_l2_q2",
                text: "عند دمج الطبقات (Merge Layers)، لا يمكن التراجع والتعديل على الطبقات المنفردة بعد حفظ الملف وإغلاق البرنامج.",
                type: "true_false",
                options: ["صح", "خطأ"],
                correctAnswer: "true",
                help: "دمج الطبقات يقوم بدمج العناصر في طبقة واحدة مسطحة بشكل دائم، مما يقلل حجم الملف ولكنه يلغي مرونة التعديل المستقبلي."
              }
            ]
          },
          {
            name: "الدرس الثالث: تحرير الصور",
            questions: [
              {
                id: "tech_u1_l3_q1",
                text: "ما هي الأداة المستخدمة لاقتصاص أجزاء غير مرغوبة من أطراف الصورة؟",
                type: "multiple_choice",
                options: [
                  "أداة الفرشاة (Brush Tool)",
                  "أداة القص (Crop Tool)",
                  "أداة الختم (Stamp Tool)",
                  "أداة التحديد السحري (Magic Wand)"
                ],
                correctAnswer: "1",
                help: "تستخدم أداة الاقتصاص (Crop Tool) لتحديد أبعاد جديدة للصورة وحذف الأجزاء الخارجية المحيطة بالإطار المحدد."
              }
            ]
          },
          {
            name: "الدرس الرابع: تنقيح الصور",
            questions: [
              {
                id: "tech_u1_l4_q1",
                text: "تُسخدم أداة 'فرشاة معالجة البقع' (Spot Healing Brush) لإزالة الشوائب والخدوش من الصور بشكل تلقائي.",
                type: "true_false",
                options: ["صح", "خطأ"],
                correctAnswer: "true",
                help: "تقوم هذه الأداة بتحليل البكسلات المحيطة بالمنطقة المحددة وتدمجها بسلاسة لإخفاء العيوب والشوائب بضغطة واحدة."
              }
            ]
          },
          {
            name: "الدرس الخامس: إنشاء رسومات 2D",
            questions: [
              {
                id: "tech_u1_l5_q1",
                text: "الرسومات ثنائية الأبعاد (2D Graphics) تمتلك بعدين أساسيين هما:",
                type: "multiple_choice",
                options: [
                  "الطول والعمق",
                  "الطول والعرض",
                  "العرض والارتفاع والعمق",
                  "الكتلة والحجم"
                ],
                correctAnswer: "1",
                help: "تمتلك الرسومات ثنائية الأبعاد المحاور الأفقية والرأسية (X, Y) وهي الطول والعرض، بينما الرسومات ثلاثية الأبعاد تضيف محور العمق Z."
              }
            ]
          }
        ]
      },
      {
        name: "الوحدة الثانية: مستندات ونماذج وتقارير الأعمال",
        lessons: [
          {
            name: "الدرس الأول: تصميم النماذج",
            questions: [
              {
                id: "tech_u2_l1_q1",
                text: "الهدف الرئيسي من تصميم نماذج الأعمال هو جمع البيانات والمعلومات بطريقة منظمة وسهلة التحليل.",
                type: "true_false",
                options: ["صح", "خطأ"],
                correctAnswer: "true",
                help: "النماذج الإلكترونية والمطبوعة تضمن توحيد صيغة البيانات المدخلة وتسهل على المؤسسات معالجتها وتخزينها بكفاءة."
              }
            ]
          },
          {
            name: "الدرس الثاني: تقارير الأعمال",
            questions: [
              {
                id: "tech_u2_l2_q1",
                text: "يجب أن تبدأ تقارير الأعمال الطويلة والمفصلة بـ:",
                type: "multiple_choice",
                options: [
                  "قائمة المراجع والمصادر",
                  "الملخص التنفيذي (Executive Summary)",
                  "الاستبيانات التفصيلية",
                  "توصيات فريق العمل"
                ],
                correctAnswer: "1",
                help: "الملخص التنفيذي يعطي القادة والمسؤولين فكرة سريعة وشاملة عن محتوى التقرير والنتائج الرئيسية دون الحاجة لقراءة التقرير كاملاً."
              }
            ]
          }
        ]
      },
      {
        name: "الوحدة الثالثة: الشبكات",
        lessons: [
          {
            name: "الدرس الأول: أساسيات الشبكات",
            questions: [
              {
                id: "tech_u3_l1_q1",
                text: "تسمى الشبكة التي تغطي منطقة جغرافية واسعة مثل مدن أو دول مختلفة بـ:",
                type: "multiple_choice",
                options: [
                  "الشبكة المحلية (LAN)",
                  "الشبكة الواسعة (WAN)",
                  "الشبكة الشخصية (PAN)",
                  "الشبكة اللاسلكية المؤقتة (Ad-Hoc)"
                ],
                correctAnswer: "1",
                help: "الشبكة الواسعة (WAN - Wide Area Network) مثل شبكة الإنترنت تربط شبكات محلية متباعدة جغرافياً."
              }
            ]
          }
        ]
      },
      {
        name: "الوحدة الرابعة: البرمجة بواسطة المايكروبت",
        lessons: [
          {
            name: "الدرس الأول: مدخل إلى المايكروبت",
            questions: [
              {
                id: "tech_u4_l1_q1",
                text: "المايكروبت (micro:bit) هو كمبيوتر صغير الحجم قابل للبرمجة يحتوي على مستشعرات مدمجة للضوء والحرارة والحركة.",
                type: "true_false",
                options: ["صح", "خطأ"],
                correctAnswer: "true",
                help: "صُمم المايكروبت بواسطة هيئة الإذاعة البريطانية BBC للمساعدة في تعليم البرمجة التفاعلية والتحكم في العتاد والأنظمة المدمجة."
              }
            ]
          }
        ]
      }
    ]
  },
  "التربية الإسلامية": {
    name: "التربية الإسلامية",
    units: [
      {
        name: "الوحدة الأولى: العقيدة والتوحيد",
        lessons: [
          {
            name: "الدرس الأول: أهمية العقيدة الإسلامية",
            questions: [
              {
                id: "islam_u1_l1_q1",
                text: "أول دعوة الرسل عليهم الصلاة والسلام هي الدعوة إلى التوحيد.",
                type: "true_false",
                options: ["صح", "خطأ"],
                correctAnswer: "true",
                help: "جميع الأنبياء والرسل بعثهم الله تعالى بالدعوة الأساسية وهي إفراد الله بالعبادة وترك عبادة ما سواه."
              }
            ]
          }
        ]
      }
    ]
  },
  "اللغة العربية": {
    name: "اللغة العربية",
    units: [
      {
        name: "الوحدة الأولى: الكفاية النحوية",
        lessons: [
          {
            name: "الدرس الأول: الجملة الاسمية ونواسخها",
            questions: [
              {
                id: "arabic_u1_l1_q1",
                text: "تدخل (كان وأخواتها) على الجملة الاسمية فـ:",
                type: "multiple_choice",
                options: [
                  "ترفع المبتدأ وتنصب الخبر",
                  "تنصب المبتدأ وترفع الخبر",
                  "تنصب المبتدأ والخبر معاً",
                  "تجر المبتدأ والخبر"
                ],
                correctAnswer: "0",
                help: "كان وأخواتها أفعال ناسخة تدخل على الجملة الاسمية، فتبقي المبتدأ مرفوعاً ويسمى اسمها، وتنصب الخبر ويسمى خبرها."
              }
            ]
          }
        ]
      }
    ]
  }
};

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  angle: number;
  speed: number;
}

function Fireworks() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const colors = ["#ff007f", "#ffdd00", "#00e5ff", "#7bf1a8", "#b388ff", "#ff6d00", "#ffeb3b", "#ff4081", "#00e676"];
    let idCounter = 0;

    const createBurst = () => {
      const originX = 15 + Math.random() * 70; // 15% to 85% width
      const originY = 20 + Math.random() * 45; // 20% to 65% height

      const newParticles: Particle[] = [];
      const particleCount = 28;
      for (let i = 0; i < particleCount; i++) {
        const angle = (i * 360) / particleCount + Math.random() * 15;
        const speed = 2.2 + Math.random() * 3.5;
        const color = colors[Math.floor(Math.random() * colors.length)];
        newParticles.push({
          id: idCounter++,
          x: originX,
          y: originY,
          color,
          angle,
          speed
        });
      }

      setParticles((prev) => [...prev, ...newParticles]);

      // clean up after 1.5s
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !newParticles.some((np) => np.id === p.id)));
      }, 1500);
    };

    // Initial bursts
    createBurst();
    createBurst();
    createBurst();

    const interval = setInterval(createBurst, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[60]">
      {particles.map((p) => {
        const radians = (p.angle * Math.PI) / 180;
        const dx = Math.cos(radians) * p.speed * 45;
        const dy = Math.sin(radians) * p.speed * 45 + 35; // added gravity effect
        return (
          <motion.div
            key={p.id}
            initial={{ x: `${p.x}vw`, y: `${p.y}vh`, scale: 1.8, opacity: 1 }}
            animate={{
              x: `calc(${p.x}vw + ${dx}px)`,
              y: `calc(${p.y}vh + ${dy}px)`,
              scale: 0.15,
              opacity: 0
            }}
            transition={{ duration: 1.4, ease: "easeOut" }}
            style={{ 
              backgroundColor: p.color,
              boxShadow: `0 0 10px ${p.color}, 0 0 20px ${p.color}`
            }}
            className="absolute w-3 h-3 rounded-full"
          />
        );
      })}
    </div>
  );
}

interface StudentCurriculumReviewProps {
  activeStudent: Student | null;
  bankQuestions: BankQuestion[];
  triggerToast: (msg: string, type: "success" | "error" | "info" | "warning") => void;
  selectedSubject: string | null;
  onSelectedSubjectChange: (subj: string | null) => void;
  onGoBackToQuizzes: () => void;
  teacherId?: string;
  ongoingQuizzes?: any[];
  onOpenOngoingQuiz?: (quiz: any) => void;
  isStandaloneReview?: boolean;
}

export default function StudentCurriculumReview({
  activeStudent,
  bankQuestions,
  triggerToast,
  selectedSubject,
  onSelectedSubjectChange,
  onGoBackToQuizzes,
  teacherId,
  ongoingQuizzes,
  onOpenOngoingQuiz,
  isStandaloneReview = false,
}: StudentCurriculumReviewProps) {
  // Sounds
  const synth = useMemo(() => new ReviewSoundSynth(), []);

  // Global toggle state set by teacher for Comprehensive Review
  const [isReviewEnabled, setIsReviewEnabled] = useState<boolean>(true);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState<boolean>(false);
  const [visibleSubjects, setVisibleSubjects] = useState<string[]>([]);
  const [lockedSubjects, setLockedSubjects] = useState<string[]>([]);
  const [subjectTargets, setSubjectTargets] = useState<Record<string, { targetGrade?: string; targetClass?: string; questionsPerLesson?: string | number; isLocked?: boolean }>>({});

  // Ongoing quizzes state to strictly enforce subject locking during active exams
  const [ongoingQuizzesState, setOngoingQuizzesState] = useState<OngoingQuizInfo[]>([]);

  // Animation state for rattling/shaking lock on interaction
  const [shakingSubjectKey, setShakingSubjectKey] = useState<string | null>(null);
  const [shakingGlobalLock, setShakingGlobalLock] = useState<boolean>(false);

  const triggerLockShake = (subKey: string) => {
    setShakingSubjectKey(subKey);
    setTimeout(() => {
      setShakingSubjectKey((current) => (current === subKey ? null : current));
    }, 650);
  };

  useEffect(() => {
    const updateOngoingQuizzes = () => {
      const studentId = activeStudent?.id;
      if (!studentId) {
        setOngoingQuizzesState([]);
        return;
      }

      // Base list from props
      const baseQuizzes: any[] = Array.isArray(ongoingQuizzes) ? [...ongoingQuizzes] : [];

      // Also scan localStorage to pick up any active quiz started for this student
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(`seb_student_${studentId}_quiz_`) && key.endsWith("_started")) {
            const started = localStorage.getItem(key) === "true";
            if (started) {
              const qKey = key.replace(`seb_student_${studentId}_quiz_`, "").replace("_started", "");
              const finished = localStorage.getItem(`seb_student_${studentId}_quiz_${qKey}_finished`) === "true";
              if (!finished) {
                const rawQuiz = localStorage.getItem(`seb_student_${studentId}_quiz_${qKey}`);
                if (rawQuiz) {
                  try {
                    const parsed = JSON.parse(rawQuiz);
                    if (!baseQuizzes.some((q) => (q.id && q.id === parsed.id) || q.title === parsed.title)) {
                      baseQuizzes.push(parsed);
                    }
                  } catch (err) {
                    // Ignore parse error
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        // Ignore localStorage error
      }

      const activeList = getOngoingQuizzesForStudent(studentId, baseQuizzes);
      setOngoingQuizzesState(activeList);
    };

    updateOngoingQuizzes();
    const timer = setInterval(updateOngoingQuizzes, 1000);
    return () => clearInterval(timer);
  }, [activeStudent?.id, ongoingQuizzes]);

  // Listen to visible subjects based on teacher settings
  useEffect(() => {
    const tid = teacherId || activeStudent?.teacherId || "demo_teacher";
    if (!tid) return;

    const ref = doc(db, "curriculum_settings", tid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setIsReviewEnabled(data.isReviewEnabled !== undefined ? Boolean(data.isReviewEnabled) : true);
        setVisibleSubjects(data.visibleSubjects || []);
        const rawTargets = data.subjectTargets || {};
        setSubjectTargets(rawTargets);

        // Collect locked subjects from array and/or target flags
        const lockedList: string[] = Array.isArray(data.lockedSubjects) ? [...data.lockedSubjects] : [];
        Object.keys(rawTargets).forEach((k) => {
          if (rawTargets[k]?.isLocked && !lockedList.includes(k)) {
            lockedList.push(k);
          }
        });
        setLockedSubjects(lockedList);
        setIsSettingsLoaded(true);
      } else {
        setIsReviewEnabled(true);
        setVisibleSubjects([]); // Default is empty, meaning all subjects are hidden
        setSubjectTargets({});
        setLockedSubjects([]);
        setIsSettingsLoaded(true);
      }
    }, (error) => {
      console.warn("Could not load curriculum settings in student view:", error);
      setIsSettingsLoaded(true);
    });

    return unsub;
  }, [teacherId, activeStudent?.teacherId]);

  // Helper to check if a subject is locked by teacher individually
  const isSubjectTeacherLocked = (subName?: string | null): boolean => {
    if (!subName) return false;
    if (lockedSubjects.includes(subName)) return true;
    if (subjectTargets[subName]?.isLocked) return true;
    return false;
  };

  // Helper to check if subject targeting matches current student's grade and class
  const isSubjectTargetingStudent = (subName: string, studentGrade?: string | null, studentGradeClass?: string | null) => {
    if (isStandaloneReview) return true;
    const target = subjectTargets[subName];
    if (!target) return true;

    const targetGrade = target.targetGrade || "جميع الصفوف (عام)";
    const targetClass = target.targetClass || "جميع الفصول (عام)";

    let gradeMatches = true;
    if (targetGrade && targetGrade !== "جميع الصفوف (عام)" && targetGrade !== "جميع الصفوف" && targetGrade !== "الكل" && targetGrade !== "عام") {
      gradeMatches = isGradeMatching(targetGrade, studentGrade, studentGradeClass);
    }

    let classMatches = true;
    if (targetClass && targetClass !== "جميع الفصول (عام)" && targetClass !== "جميع الفصول" && targetClass !== "الكل" && targetClass !== "عام") {
      classMatches = isClassMatching(targetClass, studentGradeClass);
    }

    return gradeMatches && classMatches;
  };

  // If currently viewing a subject that becomes hidden, not targeted, locked by an active quiz, locked by teacher, or review feature closed, redirect student
  useEffect(() => {
    if (selectedSubject) {
      // 0. Check if entire review is disabled by teacher
      if (!isReviewEnabled) {
        onSelectedSubjectChange(null);
        setIsPlaying(false);
        triggerToast("قام المعلم بإغلاق المراجعة الشاملة حالياً.", "warning");
        return;
      }
      // 0.5. Check if this specific subject is locked by teacher
      if (isSubjectTeacherLocked(selectedSubject)) {
        onSelectedSubjectChange(null);
        setIsPlaying(false);
        triggerToast(`قام المعلم بإغلاق وقفل مراجعة مادة (${selectedSubject}) حالياً.`, "warning");
        return;
      }
      // 1. Check if locked by ongoing quiz (skip in standalone review)
      if (!isStandaloneReview) {
        const lockingQuiz = getLockingQuizForSubject(selectedSubject, selectedSubject, ongoingQuizzesState);
        if (lockingQuiz) {
          onSelectedSubjectChange(null);
          setIsPlaying(false);
          triggerToast(
            `تم إقفال مراجعة مادة (${selectedSubject}) لوجود اختبار مدرسي نشط قيد التقديم (${lockingQuiz.title}).`,
            "warning"
          );
          return;
        }
      }

      // 2. Check visibility and targeting
      const isVisible = visibleSubjects.includes(selectedSubject);
      const isTargeted = isStandaloneReview || isSubjectTargetingStudent(selectedSubject, activeStudent?.grade, activeStudent?.gradeClass);
      if (!isVisible || !isTargeted) {
        onSelectedSubjectChange(null);
        setIsPlaying(false);
        triggerToast("عذراً، هذه المادة غير متاحة أو تم إخفاؤها مؤخراً.", "warning");
      }
    }
  }, [selectedSubject, isReviewEnabled, lockedSubjects, visibleSubjects, subjectTargets, activeStudent?.grade, activeStudent?.gradeClass, ongoingQuizzesState, onSelectedSubjectChange, triggerToast, isStandaloneReview]);

  // Dynamic Syllabus constructed ONLY from custom bankQuestions loaded from Firestore matching student's grade
  const syllabus = useMemo(() => {
    const merged: Record<string, typeof PRELOADED_SUBJECTS[string]> = {};

    // Filter bank questions to include questions for subjects targeted to this student
    const filteredBankQuestions = bankQuestions.filter((q) => {
      if (isStandaloneReview) return true;
      const subName = q.subject || "أخرى";

      // Check if subject is targeted to student according to teacher settings
      const isTargeted = isSubjectTargetingStudent(subName, activeStudent?.grade, activeStudent?.gradeClass);
      if (!isTargeted) return false;

      // If teacher explicitly set a target grade for this subject, trust the teacher's subject targeting
      const target = subjectTargets[subName];
      if (target && target.targetGrade && target.targetGrade !== "جميع الصفوف (عام)" && target.targetGrade !== "عام") {
        return true;
      }

      // If subject targeting is default/general or not set, check question grade match or allow if general
      if (!q.grade || q.grade === "عام" || q.grade === "جميع الصفوف (عام)" || q.grade === "جميع الصفوف") {
        return true;
      }

      return isGradeMatching(q.grade, activeStudent?.grade, activeStudent?.gradeClass);
    });

    // Group database bank questions
    filteredBankQuestions.forEach((q) => {
      const subName = q.subject || "أخرى";
      const unitName = q.unit || "عام";
      const lessonName = q.lesson || "عام";

      if (!merged[subName]) {
        merged[subName] = {
          name: subName,
          units: []
        };
      }

      let targetUnit = merged[subName].units.find((u) => u.name === unitName);
      if (!targetUnit) {
        targetUnit = { name: unitName, lessons: [] };
        merged[subName].units.push(targetUnit);
      }

      let targetLesson = targetUnit.lessons.find((l) => l.name === lessonName);
      if (!targetLesson) {
        targetLesson = { name: lessonName, questions: [] };
        targetUnit.lessons.push(targetLesson);
      }

      // Add if not already present
      const alreadyExists = targetLesson.questions.some((existing) => existing.id === q.id);
      if (!alreadyExists) {
        targetLesson.questions.push({
          id: q.id,
          text: q.text,
          type: q.type,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          help: `سؤال مضاف بواسطة المعلم من بنك الأسئلة للمرحلة والصف المحدد.`
        });
      }
    });

    return merged;
  }, [bankQuestions, activeStudent?.grade, activeStudent?.gradeClass, subjectTargets]);

  // Current State
  const [activeUnitIdx, setActiveUnitIdx] = useState<number>(0);
  const [activeLessonIdx, setActiveLessonIdx] = useState<number>(0);
  const [expandedUnits, setExpandedUnits] = useState<Record<number, boolean>>({});

  // Reset expanded units when selected subject changes
  useEffect(() => {
    setExpandedUnits({});
  }, [selectedSubject]);

  // Quiz Play States
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState<boolean>(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, { selected: string; isCorrect: boolean }>>({});
  const [questionAttempts, setQuestionAttempts] = useState<Record<number, number>>({});
  const [wrongChoices, setWrongChoices] = useState<Record<number, string[]>>({});
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [showCompletionModal, setShowCompletionModal] = useState<boolean>(false);
  const [completionData, setCompletionData] = useState<{
    correctCount: number;
    totalQuestions: number;
    unitName: string;
    lessonName: string;
  } | null>(null);
  const [aiHints, setAiHints] = useState<Record<string, string>>({});
  const [isGeneratingAiHint, setIsGeneratingAiHint] = useState<boolean>(false);
  const pendingAiHintKeysRef = useRef<Set<string>>(new Set());

  // Search filter states for ultra-fast instant lookups
  const [subjectSearchQuery, setSubjectSearchQuery] = useState<string>("");
  const [lessonSearchQuery, setLessonSearchQuery] = useState<string>("");
  const [copiedHintKey, setCopiedHintKey] = useState<string | null>(null);

  // High-performance Arabic text normalizer (strips diacritics, unifies alef, taa marbouta, etc.)
  const normalizeArabic = (text: string): string => {
    if (!text) return "";
    return text
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g, "") // remove tashkeel/diacritics
      .replace(/[أإآء]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/[\s\-_]+/g, " ")
      .trim();
  };

  // Robust check for True/False or 2-option binary questions
  const isTrueFalseQuestion = (q: any) => isTFHelper(q);

  // Advanced, Instant Contextual Educational Reasoning Engine (0ms Latency, 100% Cloudflare & Offline Ready)
  const buildDynamicContextualHint = (q: any, subject?: string, unitName?: string, lessonName?: string): string => {
    const text = q?.text || "";
    const opts = Array.isArray(q?.options) ? q.options : [];
    const lessonStr = lessonName ? ` في درس (${lessonName})` : (subject ? ` في مادة (${subject})` : "");
    const cleanText = text.trim();

    // 1. Detect question characteristics
    const isBinary = opts.length === 2 && (
      opts.includes("صح") || opts.includes("خطأ") || 
      opts.includes("نعم") || opts.includes("لا") || 
      opts.includes("صحيحة") || opts.includes("خاطئة") ||
      opts.includes("True") || opts.includes("False")
    );
    const isDefinition = /تعريف|المقصود|يُقصد|يُعرّف|هو|هي|ما هو|ما هي|مفهوم/i.test(cleanText);
    const isFunction = /وظيفة|فائدة|دور|أهمية|يُستخدم|تُستخدم|الغرض|مهمة/i.test(cleanText);
    const isClassification = /ينقسم|تتكون|من أنواع|من أمثلة|يصنف|تصنف|أقسام|مكونات|عناصر/i.test(cleanText);
    const isComparison = /الفرق|يختلف|مقارنة|أوجه الشبه|عكس|تميز/i.test(cleanText);
    const isCalculation = /\d+|\+|-|\*|\/|حساب|ناتج|مجموع|نسبة|معادلة/i.test(cleanText);
    const hasEnglishTerms = opts.some((o: string) => o.includes("(") || /[a-zA-Z]/.test(o));

    // 2. Formulate Core Concept Explanation
    let idea = "";
    if (isDefinition) {
      idea = `يركز هذا السؤال على استرجاع المفهوم العلمي والمصطلح الدقيق${lessonStr}. المفتاح هنا هو تحديد الخاصية الجوهرية التي تميز هذا المصطلح عن غيره في الدرس.`;
    } else if (isFunction) {
      idea = `يتناول هذا السؤال معرفة الدور الوظيفي والتطبيقي${lessonStr}. حدد العنصر المستهدف في السؤال واربطه بمهمته المباشرة والغرض الأساسي من استخدامه.`;
    } else if (isClassification) {
      idea = `يدور السؤال حول تصنيف المكونات أو التقسيمات الأساسية${lessonStr}. استرجع الأقسام الرئيسية الواردة في الدرس لتحديد العنصر المطابق لمعطيات السؤال.`;
    } else if (isComparison) {
      idea = `المطلوب هو المقارنة والتمييز الدقيق بين مفهومين أو حالتين${lessonStr}. ركز على وجه الاختلاف أو الشبه الدقيق المطلوب في نص السؤال.`;
    } else if (isCalculation) {
      idea = `يتطلب هذا السؤال تطبيق عملية حسابية أو منطقية${lessonStr}. اتبع الخطوات الرياضية والمنطقية بتأنٍ واستحضر القانون المناسب للوصول للناتج الدقيق.`;
    } else if (isBinary) {
      idea = `يقيس هذا السؤال دقة استيعابك لمعلومة علمية مقررة${lessonStr}. المطلوب هو قراءة العبارة كاملة والتحقق من صحة كل جزء فيها علمياً ومنطقياً.`;
    } else {
      idea = `يتناول هذا السؤال مفهوماً هاماً${lessonStr}. اقرأ جملة السؤال بتركيز وحدد الكلمات المفتاحية التي تدلك على المطلوب دون تسرع.`;
    }

    // 3. Strategic Elimination and Thinking Guidance
    let hint = "";
    if (isBinary) {
      hint = `اقرأ عبارة السؤال كلمة بكلمة، وانتبه لأدوات الحصر والتعميم (مثل: دائماً، فقط، جميع، لا يمكن، أبداً). تذكر القاعدة الذهبية: إذا كان أي جزء في العبارة غير سليم علمياً، فالعبارة بأكملها تعتبر خاطئة.`;
    } else if (hasEnglishTerms) {
      hint = `لاحظ دلالة المصطلحات والرموز الإنجليزية أو العلمية في الخيارات. اربط بين الحروف الأولى أو الترجمة المباشرة للرمز وبين الوظيفة المذكورة في السؤال لاستبعاد الخيارات غير المتوافقة.`;
    } else if (isClassification) {
      hint = `استخدم استراتيجية الاستبعاد الذكي: ابدأ بحذف الخيارات التي تنتمي لدروس أو موضوعات أخرى، ثم وازن بين الخيارات المتبقية ذات الصلة لحصر الخيار المطابق تماماً.`;
    } else if (opts.length > 2) {
      hint = `حلل الخيارات: ستجد غالباً خيارين بعيدين تماماً عن موضوع السؤال احذفهما فوراً، ثم ركز في المقارنة بين الخيارين الأقرب لتختار الأدق والأنسب لمعطيات السؤال.`;
    } else {
      hint = `حلل معطيات السؤال واستحضر القواعد والتعريفات الأساسية في الدرس لحصر الإجابة الصحيحة وتأكيدها.`;
    }

    return `💡 **فكرة السؤال:** ${idea}\n🔍 **تلميح واستراتيجية الحل:** ${hint}`;
  };

  const handleFetchAiHint = async (force: boolean = false) => {
    if (!currentQuestion) return;
    const qKey = currentQuestion.id || currentQuestion.text;

    // Guarantee an instant high-intelligence educational hint is already in state (0ms latency)
    if (!aiHints[qKey]) {
      const instantHint = buildDynamicContextualHint(
        currentQuestion,
        selectedSubject,
        activeUnit?.name,
        activeLesson?.name
      );
      setAiHints((prev) => ({ ...prev, [qKey]: instantHint }));
    }

    if (!force && aiHints[qKey]) {
      return;
    }
    if (pendingAiHintKeysRef.current.has(qKey)) {
      return;
    }

    pendingAiHintKeysRef.current.add(qKey);
    setIsGeneratingAiHint(true);

    try {
      // 1. Check if client-side Gemini key is available (useful for Cloudflare Pages static hosting)
      const viteGeminiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
      if (viteGeminiKey) {
        const clientController = new AbortController();
        const clientTimer = setTimeout(() => clientController.abort(), 2500);
        try {
          const promptText = `أنت معلم خبير وموجه تربوي ذكي وودود.
المطلوب: قدم للطالب إرشاداً تربوياً وتلميحاً ذكياً لمساعدته على حل هذا السؤال بنفسه وفهم فكرته دون إعطائه الإجابة الصريحة بشكل مباشر:
- السؤال: "${currentQuestion.text}"
${Array.isArray(currentQuestion.options) && currentQuestion.options.length > 0 ? `- الخيارات: ${currentQuestion.options.join(" - ")}` : ""}
- المادة / الدرس: ${selectedSubject || ""} / ${activeLesson?.name || ""}

يرجى صياغة الإرشاد بدقة في نقطتين واضحتين باللغة العربية:
💡 **فكرة السؤال:** (المفهوم الأساسي بشكل مبسط)
🔍 **تلميح واستراتيجية الحل:** (طريقة التفكير واستبعاد الخيارات)`;

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${viteGeminiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: clientController.signal,
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
              })
            }
          );
          clearTimeout(clientTimer);
          if (geminiRes.ok) {
            const data = await geminiRes.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && text.trim()) {
              setAiHints((prev) => ({ ...prev, [qKey]: text.trim() }));
              return;
            }
          }
        } catch {
          clearTimeout(clientTimer);
          // Fall through to server API or fallback
        }
      }

      // 2. Try server API with a responsive timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch("/api/generate-question-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          questionText: currentQuestion.text,
          options: currentQuestion.options,
          correctAnswer: currentQuestion.correctAnswer || currentQuestion.answer,
          subject: selectedSubject,
          unit: activeUnit?.name,
          lesson: activeLesson?.name,
        }),
      });
      clearTimeout(timeoutId);

      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data && data.success && data.hint) {
          setAiHints((prev) => ({ ...prev, [qKey]: data.hint }));
          return;
        }
      }

      // If backend API returned HTML/404 on Cloudflare static hosting, retain dynamic contextual guidance
      const dynamicHint = buildDynamicContextualHint(currentQuestion, selectedSubject, activeUnit?.name, activeLesson?.name);
      setAiHints((prev) => ({ ...prev, [qKey]: dynamicHint }));
    } catch {
      // Cloudflare / network offline / timeout: immediately ensure dynamic contextual hint is set smoothly
      const dynamicHint = buildDynamicContextualHint(currentQuestion, selectedSubject, activeUnit?.name, activeLesson?.name);
      setAiHints((prev) => ({ ...prev, [qKey]: dynamicHint }));
    } finally {
      pendingAiHintKeysRef.current.delete(qKey);
      setIsGeneratingAiHint(false);
    }
  };

  const autoNextTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (autoNextTimeoutRef.current) {
        clearTimeout(autoNextTimeoutRef.current);
      }
    };
  }, []);

  // Lesson scores saved locally in state, loaded from localStorage initially
  const [lessonStats, setLessonStats] = useState<Record<string, { solved: boolean; score: number; maxScore: number }>>(() => {
    const key = `curriculum_stats_${activeStudent?.id || "anonymous"}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : {};
  });

  // Sync with Firestore and localStorage
  const saveStats = (updated: Record<string, { solved: boolean; score: number; maxScore: number }>) => {
    setLessonStats(updated);
    const key = `curriculum_stats_${activeStudent?.id || "anonymous"}`;
    localStorage.setItem(key, JSON.stringify(updated));

    // Secure Firestore write (silent, doesn't block UI)
    if (activeStudent?.id) {
      const ref = doc(db, "student_curriculum_scores", activeStudent.id);
      setDoc(ref, {
        studentId: activeStudent.id,
        studentName: activeStudent.name,
        stats: updated,
        lastUpdated: new Date().toISOString()
      }, { merge: true }).catch((err) => {
        console.warn("Could not sync curriculum scores to Firestore:", err);
      });
    }
  };

  // Real-time synchronization from Firestore when activeStudent changes
  useEffect(() => {
    if (activeStudent?.id) {
      // Re-read latest localStorage for this specific student
      const key = `curriculum_stats_${activeStudent.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setLessonStats(JSON.parse(saved));
        } catch {
          setLessonStats({});
        }
      } else {
        setLessonStats({});
      }

      const ref = doc(db, "student_curriculum_scores", activeStudent.id);
      // Setup a real-time listener so changes and resets sync immediately
      const unsub = onSnapshot(ref, (snapshot) => {
        if (snapshot.exists()) {
          const cloudData = snapshot.data();
          const cloudStats = cloudData?.stats || {};
          setLessonStats(cloudStats);
          localStorage.setItem(`curriculum_stats_${activeStudent.id}`, JSON.stringify(cloudStats));
        } else {
          // Document was reset or deleted
          setLessonStats({});
          localStorage.removeItem(`curriculum_stats_${activeStudent.id}`);
        }
      }, (err) => {
        console.warn("Could not sync curriculum scores from Firestore:", err);
      });
      return unsub;
    } else {
      // In standalone / anonymous mode, keep local stats from localStorage
      const key = "curriculum_stats_anonymous";
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setLessonStats(JSON.parse(saved));
        } catch {
          setLessonStats({});
        }
      } else {
        setLessonStats({});
      }
    }
  }, [activeStudent?.id]);

  // Current Active Lesson details
  const activeSubjectData = selectedSubject ? syllabus[selectedSubject] : null;
  const activeUnit = activeSubjectData?.units[activeUnitIdx] || null;
  const activeLesson = activeUnit?.lessons[activeLessonIdx] || null;

  // Shuffled and cleaned questions state for the current lesson session
  const [activeQuestions, setActiveQuestions] = useState<any[]>([]);

  const questions = activeQuestions;
  const currentQuestion = questions[currentQuestionIdx] || null;

  // Pre-generate AI hint in background automatically as soon as question is displayed
  useEffect(() => {
    if (isPlaying && currentQuestion) {
      const qKey = currentQuestion.id || currentQuestion.text;
      if (!aiHints[qKey] && !pendingAiHintKeysRef.current.has(qKey)) {
        handleFetchAiHint();
      }
    }
  }, [isPlaying, currentQuestionIdx, currentQuestion?.id, currentQuestion?.text]);

  // Initialize and shuffle questions and their options when lesson loads
  const initializeLesson = (lessonQuestions: any[]) => {
    if (!lessonQuestions || lessonQuestions.length === 0) {
      setActiveQuestions([]);
      return;
    }

    // Helper to shuffle array
    const shuffleArray = <T,>(array: T[]): T[] => {
      const arr = [...array];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };

    // 1. Shuffle the questions list
    let shuffledQList = shuffleArray(lessonQuestions);

    // Apply teacher's setting for questions per lesson (defaults to 15)
    const currentSubjectTarget = selectedSubject ? subjectTargets[selectedSubject] : null;
    const qLimitRaw = currentSubjectTarget?.questionsPerLesson ?? "15";
    if (qLimitRaw && qLimitRaw !== "all" && qLimitRaw !== "الكل") {
      const limitNum = Number(qLimitRaw);
      if (!isNaN(limitNum) && limitNum > 0) {
        if (shuffledQList.length > limitNum) {
          shuffledQList = shuffledQList.slice(0, limitNum);
        }
        // If lesson questions count <= limitNum, all available questions in this lesson will be shown automatically
      }
    }

    // 2. For each question, clean and shuffle its options
    const processed = shuffledQList.map((q) => {
      const rawOptions = q.options || [];
      const cleanOptions = rawOptions.filter((opt: string) => {
        if (!opt) return false;
        const t = opt.trim();
        return (
          t !== "" &&
          t !== "الخيار الثالث" &&
          t !== "الخيار الرابع" &&
          t !== "الخيار الثالث..." &&
          t !== "الخيار الرابع..." &&
          t !== "option 3" &&
          t !== "option 4" &&
          t !== "option3" &&
          t !== "option4"
        );
      });

      // Find original correct option text from rawOptions
      let correctText = "";
      if (q.type === "true_false") {
        if (q.correctAnswer === "true" || q.correctAnswer === "0" || q.correctAnswer === "صح") {
          correctText = rawOptions[0] || "صح";
        } else {
          correctText = rawOptions[1] || "خطأ";
        }
      } else {
        const origIdx = parseInt(q.correctAnswer, 10);
        correctText = rawOptions[origIdx] || rawOptions[0] || "";
      }

      // Shuffle the cleaned options
      const shuffledOptions = shuffleArray(cleanOptions);

      // Find the new index of correctText in the shuffledOptions
      let newCorrectIdx = shuffledOptions.indexOf(correctText);
      if (newCorrectIdx === -1) {
        newCorrectIdx = 0;
      }

      return {
        ...q,
        options: shuffledOptions,
        correctAnswer: newCorrectIdx.toString()
      };
    });

    setActiveQuestions(processed);
  };

  // Watch for active lesson or subject target changes and trigger initialization
  useEffect(() => {
    if (!isPlaying) {
      if (activeLesson?.questions) {
        initializeLesson(activeLesson.questions);
      } else {
        setActiveQuestions([]);
      }
    } else if (activeQuestions.length === 0 && activeLesson?.questions) {
      initializeLesson(activeLesson.questions);
    }
  }, [activeLesson, selectedSubject, isPlaying]);

  // Toggle accordions
  const toggleUnit = (idx: number) => {
    synth.playClick();
    setExpandedUnits(prev => prev[idx] ? {} : { [idx]: true });
  };

  // Select Lesson from Sidebar
  const selectLesson = (unitIdx: number, lessonIdx: number) => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }
    synth.playClick();
    setActiveUnitIdx(unitIdx);
    setActiveLessonIdx(lessonIdx);
    
    const targetUnit = activeSubjectData?.units[unitIdx];
    const targetLesson = targetUnit?.lessons[lessonIdx];
    if (targetLesson?.questions) {
      initializeLesson(targetLesson.questions);
    }
    
    // Reset play states
    setIsPlaying(true);
    setCurrentQuestionIdx(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setUserAnswers({});
    setQuestionAttempts({});
    setWrongChoices({});
    setShowHelp(false);
    setShowCompletionModal(false);
    setCompletionData(null);
  };

  // Helper to check answer correctness robustly
  const checkCorrect = (selected: string | null, correct: string) => {
    if (!selected) return false;
    if (selected === correct) return true;
    if (currentQuestion && isTrueFalseQuestion(currentQuestion)) {
      if (selected === "0" && (correct === "true" || correct === "0" || correct === "صح")) return true;
      if (selected === "1" && (correct === "false" || correct === "1" || correct === "خطأ")) return true;
      if (selected === "true" && (correct === "0" || correct === "true" || correct === "صح")) return true;
      if (selected === "false" && (correct === "1" || correct === "false" || correct === "خطأ")) return true;
    }
    return false;
  };

  const finishCurrentQuestion = (updatedAnswers: Record<number, { selected: string; isCorrect: boolean }>) => {
    // If this is the last question, show completion directly!
    if (currentQuestionIdx >= questions.length - 1) {
      // Calculate final score
      const answersList = Object.values(updatedAnswers);
      const correctCount = answersList.filter(a => a.isCorrect).length;
      const finalScore = correctCount;

      const unitName = activeUnit?.name || "الوحدة";
      const lessonName = activeLesson?.name || "الدرس";

      // Save statistics - keep the highest score ever achieved!
      const statsKey = `${selectedSubject}_${unitName}_${lessonName}`;
      const existingStat = lessonStats[statsKey];
      const bestScore = existingStat && existingStat.solved 
        ? Math.max(existingStat.score, finalScore)
        : finalScore;

      const updated = {
        ...lessonStats,
        [statsKey]: {
          solved: true,
          score: bestScore,
          maxScore: questions.length
        }
      };
      saveStats(updated);

      // Store completion data for bulletproof display
      setCompletionData({
        correctCount,
        totalQuestions: questions.length,
        unitName,
        lessonName
      });

      // Play success sound
      synth.playSuccess();
      
      // Delay for 2 seconds so they can see the visual feedback before the modal pops up automatically
      if (autoNextTimeoutRef.current) {
        clearTimeout(autoNextTimeoutRef.current);
      }
      const t = setTimeout(() => {
        setShowCompletionModal(true);
      }, 2000);
      autoNextTimeoutRef.current = t;
    } else {
      // Automatically transition to the next question after 2 seconds
      if (autoNextTimeoutRef.current) {
        clearTimeout(autoNextTimeoutRef.current);
      }
      const t = setTimeout(() => {
        setCurrentQuestionIdx(prev => prev + 1);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setShowHelp(false);
      }, 2000);
      autoNextTimeoutRef.current = t;
    }
  };

  // Answer selection - gives second chance on 1st wrong attempt and auto-opens help
  const handleAnswerSelect = (ansIdx: string) => {
    if (isAnswered) return; // Cannot change answer once question is finished
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
    }

    const currentWrongList = wrongChoices[currentQuestionIdx] || [];
    if (currentWrongList.includes(ansIdx)) {
      return; // Already selected this option incorrectly on first attempt
    }

    synth.playClick();
    setSelectedAnswer(ansIdx);

    const isCorrect = checkCorrect(ansIdx, currentQuestion.correctAnswer);

    const isIsTrueFalse = isTrueFalseQuestion(currentQuestion);

    if (isCorrect) {
      synth.playCorrect();
      setIsAnswered(true);
      const updatedAnswers = {
        ...userAnswers,
        [currentQuestionIdx]: {
          selected: ansIdx,
          isCorrect: true
        }
      };
      setUserAnswers(updatedAnswers);

      finishCurrentQuestion(updatedAnswers);
    } else {
      synth.playIncorrect();
      const attemptsSoFar = (questionAttempts[currentQuestionIdx] || 0) + 1;
      setQuestionAttempts(prev => ({ ...prev, [currentQuestionIdx]: attemptsSoFar }));
      setWrongChoices(prev => ({ ...prev, [currentQuestionIdx]: [...(prev[currentQuestionIdx] || []), ansIdx] }));

      if (!isIsTrueFalse && attemptsSoFar === 1) {
        // First wrong attempt for multiple choice: Give second chance & auto open help
        setShowHelp(true);
        const qKey = currentQuestion.id || currentQuestion.text;
        if (!aiHints[qKey] && !pendingAiHintKeysRef.current.has(qKey)) {
          handleFetchAiHint();
        }
      } else {
        // Second wrong attempt (or 1st wrong attempt for True/False): Mark question as wrong and finish
        setIsAnswered(true);
        const updatedAnswers = {
          ...userAnswers,
          [currentQuestionIdx]: {
            selected: ansIdx,
            isCorrect: false
          }
        };
        setUserAnswers(updatedAnswers);

        finishCurrentQuestion(updatedAnswers);
      }
    }
  };

  // Keep for backwards compatibility / manual override
  const submitAnswer = () => {
    if (selectedAnswer === null || isAnswered) return;
    handleAnswerSelect(selectedAnswer);
  };

  // Go to next question
  const nextQuestion = () => {
    synth.playClick();

    // If on the last question:
    if (currentQuestionIdx >= questions.length - 1) {
      if (autoNextTimeoutRef.current) {
        clearTimeout(autoNextTimeoutRef.current);
        autoNextTimeoutRef.current = null;
      }
      // If already answered, show score completion modal immediately!
      if (isAnswered) {
        setShowCompletionModal(true);
        return;
      }
      // If selected an answer but not submitted yet, submit it
      if (selectedAnswer !== null) {
        handleAnswerSelect(selectedAnswer);
        return;
      }
      return;
    }

    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }

    if (!isAnswered) {
      if (selectedAnswer !== null) {
        handleAnswerSelect(selectedAnswer);
      }
      return;
    }

    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(prev => prev + 1);
      // Read saved or set default
      const saved = userAnswers[currentQuestionIdx + 1];
      if (saved) {
        setSelectedAnswer(saved.selected);
        setIsAnswered(true);
      } else {
        setSelectedAnswer(null);
        setIsAnswered(false);
      }
      setShowHelp(false);
    } else {
      setShowCompletionModal(true);
    }
  };

  const handleReset = () => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }
    synth.playClick();
    if (activeLesson?.questions) {
      initializeLesson(activeLesson.questions);
    }
    setCurrentQuestionIdx(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setUserAnswers({});
    setQuestionAttempts({});
    setWrongChoices({});
    setShowHelp(false);
    setShowCompletionModal(false);
    setCompletionData(null);
  };

  const handleExitLesson = () => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
      autoNextTimeoutRef.current = null;
    }
    synth.playClick();
    setIsPlaying(false);
    setCurrentQuestionIdx(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setUserAnswers({});
    setQuestionAttempts({});
    setWrongChoices({});
    setShowHelp(false);
    setShowCompletionModal(false);
    setCompletionData(null);
  };

  // Total solved count & stats for the active subject
  const subjectProgress = useMemo(() => {
    if (!selectedSubject || !syllabus[selectedSubject]) return { solved: 0, total: 0, percentage: 0 };
    const sub = syllabus[selectedSubject];
    let totalLessons = 0;
    let solvedLessons = 0;

    sub.units.forEach(u => {
      u.lessons.forEach(l => {
        totalLessons++;
        const statsKey = `${selectedSubject}_${u.name}_${l.name}`;
        if (lessonStats[statsKey]?.solved) {
          solvedLessons++;
        }
      });
    });

    return {
      solved: solvedLessons,
      total: totalLessons,
      percentage: totalLessons > 0 ? Math.round((solvedLessons / totalLessons) * 100) : 0
    };
  }, [selectedSubject, syllabus, lessonStats]);

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 p-4 md:p-6" dir="rtl">
      {/* 1. Header Area with Student Info and active Subject Badge (Only visible when subject is selected for review) */}
      {selectedSubject && (
        <div className="sticky top-0 md:top-2 z-30 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl p-5 mb-6 shadow-md flex flex-col md:flex-row justify-between items-center gap-4 transition-all">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              {isStandaloneReview ? (
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-black text-slate-950">بوابة المراجعة الشاملة المباشرة</h2>
                    <span className="text-xs bg-amber-50 text-amber-800 font-extrabold px-3 py-1 rounded-lg border border-amber-200/80 shadow-xs">
                      مراجعة المنهج تفاعلياً 📖
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 font-bold mt-1.5">
                    استعراض وحل أسئلة الوحدات والدروس المقررة
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl font-black text-slate-950">{activeStudent?.name || "طالب مجهول"}</h2>
                    <span className="text-xs bg-indigo-55 text-indigo-600 font-extrabold px-3 py-1 rounded-lg border border-indigo-100 shadow-xs">
                      بوابة المراجعة التفاعلية 📖
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 font-bold mt-1.5">
                    الصف: {activeStudent?.gradeClass || "غير محدد"} • الفصل الدراسي: {activeStudent?.semester || "غير محدد"}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-2.5 rounded-full font-black text-xs md:text-sm flex items-center gap-2 shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
              <span>{selectedSubject}</span>
            </div>
            
            <button
              onClick={() => {
                synth.playClick();
                onSelectedSubjectChange(null);
                setIsPlaying(false);
              }}
              className="text-xs md:text-sm font-black text-rose-600 hover:bg-rose-50 hover:text-rose-700 bg-white px-4.5 py-3 rounded-xl transition-all border border-rose-200 flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>{isStandaloneReview ? "قائمة المواد 📚" : "الخروج للرئيسية"}</span>
            </button>
          </div>
        </div>
      )}

      {/* --- TEACHER LOCKED SCREEN: If review is closed by the teacher --- */}
      {!isReviewEnabled ? (
        <div className="max-w-2xl mx-auto py-12 px-4 animate-fade-in text-center">
          <div 
            onClick={() => {
              setShakingGlobalLock(true);
              setTimeout(() => setShakingGlobalLock(false), 650);
            }}
            className="bg-white border-2 border-slate-200/90 rounded-3xl p-8 sm:p-12 shadow-sm space-y-6 cursor-pointer select-none"
          >
            <div className="relative inline-flex items-center justify-center">
              <motion.div 
                animate={
                  shakingGlobalLock
                    ? {
                        x: [-10, 10, -8, 8, -5, 5, -2, 2, 0],
                        rotate: [-10, 10, -7, 7, -3, 3, 0],
                        scale: [1, 1.18, 0.95, 1.1, 1],
                      }
                    : {}
                }
                whileTap={{ scale: 0.92 }}
                transition={{ duration: 0.55, ease: "easeInOut" }}
                className="w-20 h-20 bg-rose-50 border-2 border-rose-300 rounded-3xl flex items-center justify-center text-rose-600 shadow-inner hover:scale-105 transition-transform"
              >
                <Lock className="w-10 h-10" />
              </motion.div>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-black">
                <span>تم إغلاق المراجعة مؤقتاً</span>
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                المراجعة الشاملة مقفلة حالياً
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-semibold max-w-md mx-auto leading-relaxed">
                قام معلم المادة بإغلاق قسم المراجعة الشاملة في الوقت الحالي. سيتم فتح المراجعة وإتاحة الأسئلة مجدداً فور تفعيلها من قبل المعلم.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3">
              {!isStandaloneReview && onGoBackToQuizzes && (
                <button
                  type="button"
                  onClick={onGoBackToQuizzes}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>الذهاب إلى قائمة الاختبارات المدرسية</span>
                </button>
              )}
            </div>
          </div>
        </div>
      ) : !selectedSubject ? (
        <div className="max-w-4xl mx-auto py-4 animate-fade-in">
          <div className="text-center mb-10">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="inline-flex items-center justify-center p-4.5 bg-indigo-50 border border-indigo-100 rounded-2xl mb-4.5 shadow-xs"
            >
              <Trophy className="w-12 h-12 text-yellow-500 animate-bounce" />
            </motion.div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">المراجعة الشاملة للمنهج كامل</h1>
            <p className="text-slate-600 text-sm md:text-base font-semibold max-w-xl mx-auto mt-3 leading-relaxed">
              اختر المادة الدراسية لتبدأ في مراجعة المنهج كاملاً، حل الوحدات والدروس بالتوالي واحصل على النجمة الذهبية للمادة!
            </p>
          </div>

          {(() => {
            const allDisplayedKeys = Array.from(
              new Set(
                Object.keys(syllabus).filter(
                  (key) =>
                    visibleSubjects.includes(key) &&
                    (isStandaloneReview || isSubjectTargetingStudent(key, activeStudent?.grade, activeStudent?.gradeClass))
                )
              )
            );

            if (allDisplayedKeys.length === 0) {
              return (
                <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center space-y-3 shadow-xs">
                  <div className="w-16 h-16 bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-black text-slate-800">
                    {isStandaloneReview ? "لا توجد مواد مراجعة مفعّلة حالياً" : "لا توجد مواد مراجعة مفعّلة لصفك الدراسي حالياً"}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold max-w-sm mx-auto leading-relaxed">
                    {isStandaloneReview
                      ? "عندما يقوم المعلم بتفعيل مواد المراجعة من إعدادات المراجعة الشاملة، ستظهر هنا فوراً."
                      : `عندما يقوم المعلم بتفعيل مادة المراجعة الخاصة بصفك الدراسي (${activeStudent?.grade || activeStudent?.gradeClass || "صفك"})، ستظهر هنا فوراً.`}
                  </p>
                </div>
              );
            }

            const normalizedSubjectSearch = normalizeArabic(subjectSearchQuery);
            const displayedSubjectKeys = allDisplayedKeys.filter((key) => {
              if (!normalizedSubjectSearch) return true;
              const sub = syllabus[key];
              const normKey = normalizeArabic(key);
              const normName = normalizeArabic(sub?.name || "");
              const normUnits = sub?.units?.map((u) => normalizeArabic(u.name)).join(" ") || "";
              return normKey.includes(normalizedSubjectSearch) || normName.includes(normalizedSubjectSearch) || normUnits.includes(normalizedSubjectSearch);
            });

            return (
              <div className="space-y-6">
                {/* Instant Subject Search Input */}
                <div className="max-w-md mx-auto">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="بحث فوري وسريع عن مادة دراسية... 🔍"
                      value={subjectSearchQuery}
                      onChange={(e) => setSubjectSearchQuery(e.target.value)}
                      className="w-full pr-10 pl-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs md:text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all shadow-xs"
                    />
                    <span className="absolute right-3.5 text-slate-400 pointer-events-none">
                      <Search className="w-4 h-4" />
                    </span>
                    {subjectSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setSubjectSearchQuery("")}
                        className="absolute left-3 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                        title="إلغاء البحث"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {subjectSearchQuery && (
                    <div className="flex justify-between items-center mt-2 px-2 text-xs font-bold text-indigo-600">
                      <span>نتائج البحث عن "{subjectSearchQuery}":</span>
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200 text-[11px]">
                        {displayedSubjectKeys.length} مادة
                      </span>
                    </div>
                  )}
                </div>

                {displayedSubjectKeys.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-3 shadow-xs">
                    <p className="text-slate-600 font-bold text-sm">
                      لم يتم العثور على مواد مطابقة لعبارة البحث "{subjectSearchQuery}"
                    </p>
                    <button
                      type="button"
                      onClick={() => setSubjectSearchQuery("")}
                      className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black hover:bg-indigo-100 transition-colors cursor-pointer"
                    >
                      إعادة عرض كافة المواد
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {displayedSubjectKeys.map((subjectKey, sIdx) => {
                      const sub = syllabus[subjectKey];
                      let totalLessons = 0;
                      let solvedLessons = 0;
                      sub.units.forEach((u) => {
                        u.lessons.forEach((l) => {
                          totalLessons++;
                          const statsKey = `${subjectKey}_${u.name}_${l.name}`;
                          if (lessonStats[statsKey]?.solved) solvedLessons++;
                        });
                      });

                      const isCompleted = totalLessons > 0 && solvedLessons === totalLessons;

                      // Check if this subject is locked by an ongoing school quiz or by teacher
                      const lockingQuiz = getLockingQuizForSubject(subjectKey, sub.name, ongoingQuizzesState);
                      const isQuizLocked = Boolean(lockingQuiz);
                      const isTeacherLocked = isSubjectTeacherLocked(subjectKey) || isSubjectTeacherLocked(sub.name);
                      const isLocked = isQuizLocked || isTeacherLocked;

                      return (
                        <motion.div
                          key={`student-subj-${subjectKey}-${sIdx}`}
                          whileHover={!isLocked ? { y: -5, scale: 1.02 } : {}}
                          whileTap={!isLocked ? { scale: 0.98 } : {}}
                          onClick={() => {
                            if (isTeacherLocked) {
                              triggerLockShake(subjectKey);
                              triggerToast(
                                `عذراً! مادة (${sub.name}) مقفلة حالياً من قِبل المعلم 🔒. يرجى اختيار مادة أخرى مفتوحة للمراجعة.`,
                                "warning"
                              );
                              return;
                            }
                            if (isQuizLocked) {
                              triggerLockShake(subjectKey);
                              triggerToast(
                                `عذراً! مادة (${sub.name}) مقفلة حالياً لوجود اختبار مدرسي نشط (${lockingQuiz?.title}). يرجى إنهاء الاختبار أولاً لتتمكن من مراجعة المنهج.`,
                                "warning"
                              );
                              return;
                            }
                            synth.playClick();
                            onSelectedSubjectChange(subjectKey);
                          }}
                          className={`bg-white border rounded-3xl p-6 transition-all duration-200 relative overflow-hidden group shadow-md ${
                            isTeacherLocked
                              ? "border-rose-400 bg-rose-950/10 shadow-rose-500/10 cursor-not-allowed select-none"
                              : isQuizLocked
                                ? "border-amber-400 bg-slate-900/5 shadow-amber-500/10 cursor-not-allowed select-none"
                                : isCompleted 
                                  ? "border-emerald-300 bg-emerald-50/40 shadow-emerald-500/5 hover:shadow-lg cursor-pointer" 
                                  : "border-slate-200 hover:border-indigo-300 hover:shadow-lg cursor-pointer"
                          }`}
                        >
                          {/* Large Prominent Lock Overlay for Teacher-Locked Subject */}
                          {isTeacherLocked && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerLockShake(subjectKey);
                                triggerToast(
                                  `عذراً! مادة (${sub.name}) مقفلة حالياً من قِبل المعلم 🔒. يرجى اختيار مادة أخرى مفتوحة للمراجعة.`,
                                  "warning"
                                );
                              }}
                              className="absolute inset-0 z-20 bg-gradient-to-b from-slate-950/92 via-slate-900/95 to-slate-950/95 backdrop-blur-[2px] p-5 flex flex-col items-center justify-between text-center rounded-3xl border-2 border-rose-500 shadow-2xl animate-fade-in cursor-pointer select-none"
                            >
                              {/* Top Lock Badge */}
                              <div className="w-full flex items-center justify-between gap-2">
                                <motion.span 
                                  animate={
                                    shakingSubjectKey === subjectKey
                                      ? {
                                          x: [-6, 6, -5, 5, -3, 3, 0],
                                          rotate: [-14, 14, -8, 8, 0],
                                          scale: [1, 1.25, 0.95, 1.1, 1],
                                        }
                                      : {}
                                  }
                                  transition={{ duration: 0.55 }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-xs"
                                >
                                  <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                  <span>مقفلة من المعلم 🔒</span>
                                </motion.span>
                                <span className="text-[10px] text-slate-400 font-bold bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                                  مغلقة مؤقتاً
                                </span>
                              </div>

                              {/* Center: Large Padlock Graphic */}
                              <motion.div 
                                animate={
                                  shakingSubjectKey === subjectKey
                                    ? {
                                        x: [-10, 10, -8, 8, -5, 5, -2, 2, 0],
                                        rotate: [-8, 8, -6, 6, -3, 3, 0],
                                        scale: [1, 1.12, 0.96, 1.06, 1],
                                      }
                                    : {}
                                }
                                transition={{ duration: 0.55, ease: "easeInOut" }}
                                className="my-auto py-2 flex flex-col items-center cursor-pointer"
                              >
                                <BigRealisticPadlock 
                                  size={96} 
                                  glow={true} 
                                  isShaking={shakingSubjectKey === subjectKey}
                                  className="drop-shadow-2xl hover:scale-105 transition-transform" 
                                />
                                <h4 className="mt-3 text-base md:text-lg font-black text-white leading-tight">
                                  المراجعة مقفلة من المعلم
                                </h4>
                                <p className="mt-1 text-[11px] md:text-xs text-slate-300 font-bold max-w-[240px] leading-relaxed">
                                  قام المعلم بإغلاق مراجعة مادة <span className="text-amber-300 font-black">({sub.name})</span> حالياً للطلاب
                                </p>
                              </motion.div>

                              {/* Bottom notice */}
                              <div className="w-full pt-2">
                                <div className="w-full py-2.5 px-3 bg-slate-900/90 border border-rose-500/30 text-rose-200 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-inner">
                                  <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                  <span>يرجى اختيار مادة أخرى مفتوحة 📚</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Large Prominent Lock Overlay for Quiz-Locked Subject */}
                          {isQuizLocked && !isTeacherLocked && (
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerLockShake(subjectKey);
                                triggerToast(
                                  `عذراً! مادة (${sub.name}) مقفلة حالياً لوجود اختبار مدرسي نشط (${lockingQuiz?.title}). يرجى إنهاء الاختبار أولاً لتتمكن من مراجعة المنهج.`,
                                  "warning"
                                );
                              }}
                              className="absolute inset-0 z-20 bg-gradient-to-b from-slate-950/92 via-slate-900/95 to-slate-950/95 backdrop-blur-[2px] p-5 flex flex-col items-center justify-between text-center rounded-3xl border-2 border-amber-500 shadow-2xl animate-fade-in cursor-pointer select-none"
                            >
                              {/* Top Lock Badge and Timer */}
                              <div className="w-full flex items-center justify-between gap-2">
                                <motion.span 
                                  animate={
                                    shakingSubjectKey === subjectKey
                                      ? {
                                          x: [-6, 6, -5, 5, -3, 3, 0],
                                          rotate: [-14, 14, -8, 8, 0],
                                          scale: [1, 1.25, 0.95, 1.1, 1],
                                        }
                                      : {}
                                  }
                                  transition={{ duration: 0.55 }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-xs"
                                >
                                  <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                  <span>مادة مقفلة 🔒</span>
                                </motion.span>

                                {lockingQuiz && !lockingQuiz.isUntimed && lockingQuiz.remainingSeconds > 0 && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                    <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                                    <span className="font-mono">{formatRemainingTime(lockingQuiz.remainingSeconds)}</span>
                                  </span>
                                )}
                              </div>

                              {/* Center: Large, Clear 3D Realistic Padlock Graphic */}
                              <motion.div 
                                animate={
                                  shakingSubjectKey === subjectKey
                                    ? {
                                        x: [-10, 10, -8, 8, -5, 5, -2, 2, 0],
                                        rotate: [-8, 8, -6, 6, -3, 3, 0],
                                        scale: [1, 1.12, 0.96, 1.06, 1],
                                      }
                                    : {}
                                }
                                transition={{ duration: 0.55, ease: "easeInOut" }}
                                className="my-auto py-2 flex flex-col items-center cursor-pointer"
                              >
                                <BigRealisticPadlock 
                                  size={96} 
                                  glow={true} 
                                  isShaking={shakingSubjectKey === subjectKey}
                                  className="drop-shadow-2xl hover:scale-105 transition-transform" 
                                />
                                <h4 className="mt-3 text-base md:text-lg font-black text-white leading-tight">
                                  المراجعة مقفلة لاختبار نشط
                                </h4>
                                <p className="mt-1 text-[11px] md:text-xs text-slate-300 font-bold max-w-[240px] leading-relaxed line-clamp-2">
                                  اختبار قيد التقديم حالياً:
                                  <span className="text-amber-300 block font-black mt-0.5">{lockingQuiz?.title}</span>
                                </p>
                              </motion.div>

                              {/* Bottom Button to Resume/Jump to Quiz */}
                              <div className="w-full pt-2">
                                {onOpenOngoingQuiz && lockingQuiz ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenOngoingQuiz(lockingQuiz.quiz);
                                    }}
                                    className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer transform active:scale-95"
                                  >
                                    <span>متابعة الاختبار المدرسي الآن</span>
                                    <ArrowLeft className="w-4 h-4 text-slate-950" />
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onGoBackToQuizzes();
                                    }}
                                    className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/40 font-black text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <span>الذهاب لصفحة الاختبارات 📝</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full blur-2xl group-hover:bg-indigo-100 transition-colors" />
                          
                          <div className="flex justify-between items-start mb-4">
                            <div className="p-3 rounded-xl text-indigo-600 bg-indigo-50 border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-200 shadow-xs">
                              <BookOpen className="w-5 h-5" />
                            </div>
                            {isCompleted && (
                              <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-black px-3 py-1.5 rounded-full flex items-center gap-1 shadow-xs">
                                <Check className="w-3 h-3" /> مكتملة
                              </span>
                            )}
                          </div>

                          <h3 className="font-black text-base md:text-lg text-slate-900 group-hover:text-indigo-600 transition-colors">{sub.name}</h3>
                          <p className="text-slate-600 text-xs font-semibold mt-2.5">
                            يحتوي على {sub.units.length} وحدات • {totalLessons} دروس تفاعلية
                          </p>

                          <div className="mt-5 pt-4 border-t border-slate-100">
                            <div className="flex justify-between text-xs font-extrabold text-slate-500 mb-2">
                              <span>التقدم المنجز</span>
                              <span>{solvedLessons} من {totalLessons} درس</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${isCompleted ? "bg-emerald-500" : "bg-indigo-500"}`}
                                style={{ width: `${totalLessons > 0 ? (solvedLessons / totalLessons) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      ) : (
        /* --- LEVEL 2: Curriculum Playground (Active Subject) --- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Playable Board - 8 cols (Rendered in RTL) */}
          <div className="lg:col-span-8 flex flex-col gap-6 order-1 lg:order-2">
            {!isPlaying ? (
              // If not playing a specific lesson, guide them to choose
              <div className="bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-md relative overflow-hidden min-h-[400px] flex flex-col items-center justify-center">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.03),transparent_70%)]" />
                
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mb-6 shadow-xs"
                >
                  <Sparkles className="w-8 h-8" />
                </motion.div>

                <h2 className="text-xl md:text-2xl font-black text-slate-900">ابدأ رحلة مراجعة {selectedSubject}</h2>
                <p className="text-slate-600 text-sm md:text-base font-semibold max-w-md mx-auto mt-2 leading-relaxed">
                  الرجاء اختيار أحد الدروس من "سجل الإنجازات الشامل" في القائمة لبدء المراجعة التفاعلية وحل الأسئلة والتدرب.
                </p>

                <div className="mt-8 flex flex-wrap gap-4 justify-center">
                  <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2 shadow-xs">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>متاح الإعادة بلا حدود</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold text-slate-700 flex items-center gap-2 shadow-xs">
                    <HelpCircle className="w-4 h-4 text-indigo-500" />
                    <span>وسائل مساعدة لكل درس</span>
                  </div>
                </div>
              </div>
            ) : (
              // ACTIVE PLAYING BOARD
              <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-md relative">
                
                {/* Topic Header */}
                <div className="border-b border-slate-100 pb-4 mb-5 flex flex-col md:flex-row justify-between md:items-center gap-3">
                  <div>
                    <span className="text-xs text-indigo-600 font-black block mb-1">
                      {activeUnit?.name}
                    </span>
                    <h1 className="text-lg md:text-xl font-black text-slate-900">
                      {activeLesson?.name}
                    </h1>
                  </div>
                  
                  {/* Subject badge */}
                  <div className="self-start md:self-auto px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-black text-xs md:text-sm">
                    {selectedSubject}
                  </div>
                </div>

                {/* Progress Indicators & Questions Bubble pagination */}
                <div className="flex flex-col gap-4 mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center">
                    <span className="bg-indigo-600 text-white font-black text-xs md:text-sm px-4 py-2 rounded-lg shadow-sm">
                      سؤال {currentQuestionIdx + 1} من {questions.length}
                    </span>
                    
                    <span className="text-slate-500 text-sm font-bold">
                      أجب على جميع الأسئلة بدقة للحصول على التقييم الكامل
                    </span>
                  </div>

                  {/* Horizontal Bubble Pagination (Indicator only - manual jumping disabled, navigation is automatic upon answering) */}
                  <div className="flex flex-wrap gap-2 justify-start items-center" style={{ direction: "rtl" }}>
                    {questions.map((_, idx) => {
                      const ans = userAnswers[idx];
                      const isActive = idx === currentQuestionIdx;
                      
                      let bubbleStyle = "bg-white text-slate-500 border border-slate-200";
                      if (isActive) {
                        bubbleStyle = "border-2 border-indigo-500 bg-indigo-600 text-white font-black scale-105 shadow-md shadow-indigo-500/20";
                      } else if (ans) {
                        bubbleStyle = ans.isCorrect
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold"
                          : "bg-rose-50 text-rose-600 border border-rose-200 font-bold";
                      }

                      return (
                        <div
                          key={`bubble-${idx}`}
                          className={`w-9 h-9 rounded-full text-xs md:text-sm font-black flex items-center justify-center transition-all duration-150 select-none cursor-default relative ${bubbleStyle}`}
                        >
                          {idx + 1}
                          {questions[idx]?.isRephrased && !ans && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full ring-2 ring-white" title="سؤال محدث 🔄" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Question Area */}
                <div className="mb-6">
                  {/* Updated Question Indicator Badge & Encouraging Notice */}
                  {currentQuestion?.isRephrased && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl flex items-center justify-between gap-3 text-amber-950 shadow-xs"
                      dir="rtl"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-1 rounded-xl bg-amber-500 text-white font-black text-xs shrink-0 shadow-2xs">
                          سؤال محدث 🔄
                        </span>
                        <span className="text-xs font-bold text-amber-900 leading-tight">
                          تم تحديث صياغة هذا السؤال لتنويع المراجعة! أجب عليه الآن بصياغته الجديدة (دون المساس بنتيجتك العامة السابقة 🌟).
                        </span>
                      </div>
                      {currentQuestion.rephraseExplanation && (
                        <span className="hidden sm:inline-block text-[11px] font-semibold text-amber-800/90 bg-amber-100/70 px-2.5 py-1 rounded-lg shrink-0">
                          {currentQuestion.rephraseExplanation}
                        </span>
                      )}
                    </motion.div>
                  )}

                  <p className="text-lg md:text-xl font-black text-slate-900 leading-relaxed mb-6" style={{ direction: "rtl" }}>
                    {currentQuestion?.text}
                  </p>

                  {/* Second Chance Alert Banner (Multiple Choice Only) */}
                  {!isAnswered && !isTrueFalseQuestion(currentQuestion) && (questionAttempts[currentQuestionIdx] || 0) === 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-4 p-4 bg-amber-50 border-2 border-amber-300/90 rounded-2xl flex items-center justify-between gap-3 text-amber-950 shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black text-lg flex items-center justify-center shrink-0 shadow-xs">
                          💡
                        </div>
                        <div>
                          <span className="block font-black text-xs md:text-sm text-amber-950">إجابة غير صحيحة - لديك فرصة ثانية أخيره!</span>
                          <span className="block text-[11px] text-amber-800 font-bold mt-0.5">تم فتح قسم المساعدة بالأسفل تلقائياً لمساعدتك في التوصل للإجابة الصحيحة.</span>
                        </div>
                      </div>
                      <span className="bg-amber-500 text-slate-950 px-3 py-1 rounded-xl text-[11px] font-black shrink-0 shadow-xs">
                        محاولة 2 من 2 ⏱️
                      </span>
                    </motion.div>
                  )}

                  {/* Options Stack with Left Chevron Arrow */}
                  <div className="grid grid-cols-1 gap-3">
                    {(currentQuestion?.options || [])
                      .map((option, originalIdx) => ({ option, originalIdx }))
                      .filter(({ option }) => {
                        if (!option) return false;
                        const t = option.trim();
                        return (
                          t !== "" &&
                          t !== "الخيار الثالث" &&
                          t !== "الخيار الرابع" &&
                          t !== "الخيار الثالث..." &&
                          t !== "الخيار الرابع..." &&
                          t !== "option 3" &&
                          t !== "option 4" &&
                          t !== "option3" &&
                          t !== "option4"
                        );
                      })
                      .map(({ option, originalIdx }, displayIdx) => {
                        const ansIdx = originalIdx.toString();
                        const isSelected = selectedAnswer === ansIdx;
                        const isWrongOption = (wrongChoices[currentQuestionIdx] || []).includes(ansIdx);
                        
                        // Visual States
                        let optionStyle = "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:border-slate-300 shadow-sm text-sm md:text-base font-extrabold";
                        let indicatorColor = "text-slate-400";

                        if (isAnswered) {
                          const isCorrectOption = checkCorrect(ansIdx, currentQuestion.correctAnswer);
                          const isUserChoice = selectedAnswer === ansIdx;

                          if (isCorrectOption) {
                            optionStyle = "border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm text-sm md:text-base font-extrabold";
                            indicatorColor = "text-emerald-600";
                          } else if (isUserChoice) {
                            optionStyle = "border-rose-500 bg-rose-50 text-rose-900 shadow-sm text-sm md:text-base font-extrabold";
                            indicatorColor = "text-rose-600";
                          }
                        } else if (isWrongOption) {
                          optionStyle = "border-rose-300 bg-rose-50/70 text-rose-800 opacity-60 cursor-not-allowed shadow-none text-sm md:text-base font-bold";
                          indicatorColor = "text-rose-500";
                        } else if (isSelected) {
                          optionStyle = "border-indigo-500 bg-indigo-50 text-indigo-900 shadow-sm text-sm md:text-base font-extrabold";
                          indicatorColor = "text-indigo-600";
                        }

                        return (
                          <button
                            key={`option-${originalIdx}`}
                            type="button"
                            onClick={() => handleAnswerSelect(ansIdx)}
                            disabled={isAnswered || isWrongOption}
                            className={`w-full px-5 py-4 rounded-xl border text-right text-sm md:text-base font-extrabold flex justify-between items-center transition-all duration-200 cursor-pointer active:scale-[0.99] ${optionStyle}`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-slate-600 font-mono text-xs bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-black">
                                {isTrueFalseQuestion(currentQuestion) ? (originalIdx === 0 ? "أ" : "ب") : String.fromCharCode(65 + displayIdx)}
                              </span>
                              <span className="leading-relaxed">{option}</span>
                            </div>
                            
                            {/* Indicator icon/chevron */}
                            <div className={`shrink-0 transition-all ${indicatorColor}`}>
                              {isAnswered && checkCorrect(ansIdx, currentQuestion.correctAnswer) ? (
                                <Check className="w-5 h-5 text-emerald-600 font-black" />
                              ) : isAnswered && isSelected ? (
                                <X className="w-5 h-5 text-rose-600" />
                              ) : isWrongOption ? (
                                <div className="flex items-center gap-1 bg-rose-100 text-rose-700 px-2.5 py-1 rounded-lg text-xs font-black border border-rose-200">
                                  <X className="w-3.5 h-3.5" />
                                  <span>محاولة خاطئة</span>
                                </div>
                              ) : (
                                <ChevronLeft className="w-5 h-5 opacity-70 group-hover:translate-x-[-2px] transition-transform" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>

                {/* HELP ACCORDION (مساعدة وإرشاد تربوي ذكي وسريع متوافق مع كافة بيئات الاستضافة) */}
                <div className="mb-6 border border-indigo-200/90 rounded-2xl overflow-hidden bg-slate-50 shadow-xs transition-all">
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      const willShow = !showHelp;
                      setShowHelp(willShow);
                      if (willShow && currentQuestion) {
                        const qKey = currentQuestion.id || currentQuestion.text;
                        if (!aiHints[qKey]) {
                          handleFetchAiHint();
                        }
                      }
                    }}
                    className="w-full px-5 py-3.5 bg-gradient-to-r from-indigo-50/90 via-purple-50/40 to-slate-50 hover:from-indigo-100/70 hover:to-purple-100/50 text-slate-800 font-black text-xs md:text-sm flex justify-between items-center cursor-pointer transition-colors border-b border-indigo-100/70"
                  >
                    <div className="flex items-center gap-2.5 text-indigo-700">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Sparkles className="w-4 h-4 text-yellow-300" />
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          <span className="block font-black text-xs md:text-sm text-slate-900">مساعد بالذكاء الاصطناعي</span>
                          <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 shadow-2xs">
                            <Zap className="w-2.5 h-2.5" /> فوري
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold text-indigo-600 hidden sm:inline">
                        {showHelp ? "إخفاء المساعدة" : "طلب إرشاد وتلميح ذكي"}
                      </span>
                      {showHelp ? <ChevronUp className="w-5 h-5 text-indigo-600" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                    </div>
                  </button>
                  
                  <AnimatePresence>
                    {showHelp && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white p-4 md:p-5 space-y-4"
                      >
                        {/* Static Teacher Help (if custom and not generic placeholder) */}
                        {(() => {
                          const helpText = currentQuestion?.help?.trim() || "";
                          const isGeneric =
                            !helpText ||
                            helpText.includes("سؤال مضاف بواسطة المعلم") ||
                            helpText.includes("بنك الأسئلة") ||
                            helpText.includes("للمرحلة والصف المحدد");

                          if (isGeneric) return null;

                          return (
                            <div className="text-sm text-slate-700 leading-relaxed font-bold">
                              <div className="flex items-center gap-2 text-slate-900 mb-1.5 font-black text-xs">
                                <HelpCircle className="w-4 h-4 text-indigo-500" />
                                <span>ملاحظة المعلم:</span>
                              </div>
                              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                                {helpText}
                              </div>
                            </div>
                          );
                        })()}

                        {/* AI Generated Smart Hint with Instant Fallback */}
                        <div>
                          {(() => {
                            const qKey = currentQuestion ? (currentQuestion.id || currentQuestion.text) : "";
                            const hint = aiHints[qKey] || (currentQuestion ? buildDynamicContextualHint(currentQuestion, selectedSubject, activeUnit?.name, activeLesson?.name) : "");

                            return (
                              <div className="bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/50 border border-indigo-200/90 rounded-2xl p-4 md:p-5 shadow-xs space-y-3.5">
                                <div className="flex items-center justify-between pb-2.5 border-b border-indigo-100">
                                  <div className="flex items-center gap-2 text-indigo-900 font-black text-xs md:text-sm">
                                    <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                                    <span>تحليل وإرشاد السؤال بالذكاء الاصطناعي:</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {/* Copy Hint Button */}
                                    {hint && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard?.writeText(hint);
                                          setCopiedHintKey(qKey);
                                          setTimeout(() => setCopiedHintKey(null), 2000);
                                        }}
                                        className="px-2 py-1 rounded-lg text-slate-600 hover:text-indigo-700 hover:bg-indigo-100/60 transition-colors text-xs flex items-center gap-1.5 cursor-pointer font-bold border border-slate-200 bg-white shadow-2xs"
                                        title="نسخ الإرشاد"
                                      >
                                        {copiedHintKey === qKey ? (
                                          <>
                                            <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                            <span className="text-[10px] text-emerald-600">تم النسخ</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span className="text-[10px] hidden sm:inline">نسخ</span>
                                          </>
                                        )}
                                      </button>
                                    )}

                                    {/* Refresh / Re-analyze Button */}
                                    <button
                                      type="button"
                                      onClick={() => handleFetchAiHint(true)}
                                      disabled={isGeneratingAiHint}
                                      title="إعادة تدقيق الإرشاد"
                                      className="px-2 py-1 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100/60 transition-colors text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50 border border-indigo-200/60 bg-white shadow-2xs"
                                    >
                                      <RotateCcw className={`w-3.5 h-3.5 ${isGeneratingAiHint ? "animate-spin text-indigo-600" : ""}`} />
                                      <span className="text-[10px] font-bold hidden sm:inline">تحديث</span>
                                    </button>

                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-indigo-200 shrink-0">
                                      معلم ذكي 🤖✨
                                    </span>
                                  </div>
                                </div>

                                {isGeneratingAiHint && (
                                  <div className="bg-indigo-50/70 border border-indigo-200/60 rounded-xl px-3 py-2 flex items-center gap-2 text-indigo-700 font-bold text-xs animate-pulse">
                                    <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-600 shrink-0" />
                                    <span>جاري تدقيق واستكمال الإرشاد بواسطة الذكاء الاصطناعي...</span>
                                  </div>
                                )}

                                {/* Formatted Hint Cards */}
                                <div className="space-y-2.5">
                                  {(() => {
                                    // Strictly filter out any encouragement element
                                    const parts = hint
                                      .split(/(?=💡|🔍|🌟)/g)
                                      .map((s) => s.trim())
                                      .filter(Boolean)
                                      .filter((part) => !part.startsWith("🌟") && !part.includes("تشجيع"));

                                    if (parts.length >= 1) {
                                      return (
                                        <div className="grid grid-cols-1 gap-2.5">
                                          {parts.map((part, pIdx) => {
                                            let cardStyle = "bg-indigo-50/80 border-indigo-200/80 text-indigo-950";
                                            let icon = "💡";
                                            if (part.startsWith("🔍")) {
                                              cardStyle = "bg-amber-50/80 border-amber-200/80 text-amber-950";
                                              icon = "🔍";
                                            }

                                            const cleanText = part.replace(/^(💡|🔍)\s*\**([^*:]+)\**:\s*/, "");
                                            const matchTitle = part.match(/^(💡|🔍)\s*\**([^*:]+)\**/);
                                            const title = matchTitle?.[2] || (
                                              part.startsWith("💡") ? "فكرة السؤال" : "تلميح واستراتيجية الحل"
                                            );

                                            return (
                                              <div key={pIdx} className={`p-3 md:p-3.5 rounded-xl border ${cardStyle} shadow-2xs space-y-1`}>
                                                <div className="flex items-center gap-2 font-black text-xs md:text-sm">
                                                  <span>{icon}</span>
                                                  <span>{title}</span>
                                                </div>
                                                <p className="text-xs md:text-sm leading-relaxed font-semibold pr-5 text-slate-800">
                                                  {cleanText}
                                                </p>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    }

                                    const cleanFallback = hint
                                      .split("\n")
                                      .filter((l) => !l.includes("🌟") && !l.includes("تشجيع"))
                                      .join("\n")
                                      .trim();

                                    return (
                                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs md:text-sm text-slate-800 leading-relaxed font-bold whitespace-pre-line">
                                        {cleanFallback || hint}
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Final Question Solved Score Banner */}
                {isAnswered && currentQuestionIdx >= questions.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-indigo-50 to-emerald-50 border-2 border-amber-300 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                        🏆
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm md:text-base">
                          أحسنت! أكملت حل جميع أسئلة هذا الدرس
                        </h4>
                        <p className="text-xs font-bold text-slate-600 mt-0.5">
                          درجتك النهائية:{" "}
                          <span className="text-amber-700 font-mono font-black text-sm md:text-base">
                            {completionData?.correctCount ?? Object.values(userAnswers).filter(a => a.isCorrect).length} من {completionData?.totalQuestions || questions.length}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (autoNextTimeoutRef.current) {
                          clearTimeout(autoNextTimeoutRef.current);
                          autoNextTimeoutRef.current = null;
                        }
                        setShowCompletionModal(true);
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shrink-0 shadow-md cursor-pointer transition-transform hover:scale-105 flex items-center justify-center gap-1.5"
                    >
                      <Trophy className="w-4 h-4 text-yellow-300" />
                      <span>عرض بطاقة النتيجة والتقييم ⭐</span>
                    </button>
                  </motion.div>
                )}

                {/* Footer Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center border-t border-slate-100 pt-5">
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={handleExitLesson}
                      className="flex-1 sm:flex-initial px-5 py-3 rounded-xl text-xs md:text-sm font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>خروج</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex-1 sm:flex-initial px-5 py-3 rounded-xl text-xs md:text-sm font-bold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>إعادة الدرس</span>
                    </button>
                  </div>

                  {/* Next / Submit Button */}
                  <div className="w-full sm:w-auto">
                    {!isAnswered ? (
                      <div className="text-center sm:text-right text-xs md:text-sm font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-100 px-5 py-3 rounded-xl shadow-xs">
                        💡 اختر إجابة للتحقق والتنقل تلقائياً
                      </div>
                    ) : (
                      <div className="flex flex-col items-center sm:items-end gap-1.5">
                        <button
                          type="button"
                          onClick={nextQuestion}
                          className={`w-full sm:w-64 px-6 py-3.5 rounded-xl text-xs md:text-sm font-black text-white shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            currentQuestionIdx >= questions.length - 1
                              ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20"
                              : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
                          }`}
                        >
                          {currentQuestionIdx >= questions.length - 1 ? (
                            <>
                              <Trophy className="w-4.5 h-4.5 text-yellow-200" />
                              <span>عرض النتيجة النهائية 🎯</span>
                            </>
                          ) : (
                            <>
                              <span>السؤال التالي</span>
                              <ChevronLeft className="w-4.5 h-4.5" />
                            </>
                          )}
                        </button>
                        <span className="text-[10px] md:text-xs font-bold text-slate-500 animate-pulse">
                          {currentQuestionIdx >= questions.length - 1
                            ? "⏱️ جاري عرض النتيجة تلقائياً أو اضغط لعرضها فوراً"
                            : "⏱️ جاري الانتقال تلقائياً خلال ثانيتين..."}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* SIDEBAR ACCORDION FOR UNITS AND LESSONS - 4 cols (Aligned to the right side in RTL layout) */}
          <div className="lg:col-span-4 flex flex-col gap-5 order-2 lg:order-1">
            
            {/* Subject Overview Widget */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-md">
              <h3 className="text-sm font-black text-slate-900 mb-3">ملخص الأداء في المادة</h3>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center text-xs font-extrabold text-slate-600 mb-2">
                  <span>نسبة مراجعة المنهج</span>
                  <span className="text-indigo-600 font-black">{subjectProgress.percentage}%</span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                    style={{ width: `${subjectProgress.percentage}%` }}
                  />
                </div>
                <p className="text-xs font-bold text-slate-500 mt-2.5">
                  تم إكمال حل <span className="text-slate-900 font-black">{subjectProgress.solved}</span> من أصل <span className="text-slate-900 font-black">{subjectProgress.total}</span> درساً بنجاح.
                </p>
              </div>
            </div>

            {/* Achievement Log Sidebar (سجل الإنجازات الشامل) */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden flex flex-col">
              <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-500 shrink-0" />
                  <span>سجل الإنجازات الشامل</span>
                </h3>
                <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1.5 shrink-0 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-450" />
                  مباشر
                </span>
              </div>

              {/* Fast Real-Time Lesson & Unit Search Input */}
              <div className="p-3 bg-white border-b border-slate-100">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="بحث سريع عن درس أو وحدة... 🔍"
                    value={lessonSearchQuery}
                    onChange={(e) => setLessonSearchQuery(e.target.value)}
                    className="w-full pr-8 pl-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-2xs"
                  />
                  <span className="absolute right-2.5 text-slate-400 pointer-events-none">
                    <Search className="w-3.5 h-3.5" />
                  </span>
                  {lessonSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setLessonSearchQuery("")}
                      className="absolute left-2.5 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      title="مسح البحث"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Units & Lessons List container */}
              <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
                {(() => {
                  const normalizedLessonSearch = normalizeArabic(lessonSearchQuery);

                  const filteredUnits = (activeSubjectData?.units || [])
                    .map((unit, uIdx) => {
                      const normUnitName = normalizeArabic(unit.name);
                      const isUnitMatch = normalizedLessonSearch && normUnitName.includes(normalizedLessonSearch);

                      const matchingLessons = unit.lessons
                        .map((lesson, lIdx) => ({ lesson, lIdx }))
                        .filter(({ lesson }) => {
                          if (!normalizedLessonSearch) return true;
                          if (isUnitMatch) return true;
                          return normalizeArabic(lesson.name).includes(normalizedLessonSearch);
                        });

                      return {
                        unit,
                        uIdx,
                        isUnitMatch,
                        matchingLessons,
                        hasMatches: !normalizedLessonSearch || isUnitMatch || matchingLessons.length > 0,
                      };
                    })
                    .filter((item) => item.hasMatches);

                  if (filteredUnits.length === 0 && lessonSearchQuery) {
                    return (
                      <div className="p-6 text-center text-slate-500 space-y-2.5">
                        <p className="text-xs font-bold">لا توجد دروس أو وحدات مطابقة لـ "{lessonSearchQuery}"</p>
                        <button
                          type="button"
                          onClick={() => setLessonSearchQuery("")}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-black hover:bg-indigo-100 transition-colors cursor-pointer"
                        >
                          عرض كافة الدروس والوحدات
                        </button>
                      </div>
                    );
                  }

                  return filteredUnits.map(({ unit, uIdx, matchingLessons }) => {
                    // Auto-expand units when searching and there are matching lessons
                    const isAutoExpanded = !!normalizedLessonSearch && matchingLessons.length > 0;
                    const isExpanded = isAutoExpanded || !!expandedUnits[uIdx];
                    const isCurrentlySolvingInThisUnit = isPlaying && activeUnitIdx === uIdx;

                    const UNIT_COLOR_SCHEMES = [
                      {
                        collapsed: "bg-indigo-900/90 hover:bg-indigo-900 text-indigo-50 border-r-4 border-indigo-400",
                        expanded: "bg-indigo-950 text-white border-r-4 border-indigo-300 shadow-md",
                        accentDot: "bg-indigo-400",
                      },
                      {
                        collapsed: "bg-teal-900/90 hover:bg-teal-900 text-teal-50 border-r-4 border-teal-400",
                        expanded: "bg-teal-950 text-white border-r-4 border-teal-300 shadow-md",
                        accentDot: "bg-teal-400",
                      },
                      {
                        collapsed: "bg-amber-950/90 hover:bg-amber-950 text-amber-50 border-r-4 border-amber-400",
                        expanded: "bg-amber-950 text-white border-r-4 border-amber-300 shadow-md",
                        accentDot: "bg-amber-400",
                      },
                      {
                        collapsed: "bg-purple-900/90 hover:bg-purple-900 text-purple-50 border-r-4 border-purple-400",
                        expanded: "bg-purple-950 text-white border-r-4 border-purple-300 shadow-md",
                        accentDot: "bg-purple-400",
                      },
                      {
                        collapsed: "bg-rose-950/90 hover:bg-rose-950 text-rose-50 border-r-4 border-rose-400",
                        expanded: "bg-rose-950 text-white border-r-4 border-rose-300 shadow-md",
                        accentDot: "bg-rose-400",
                      },
                      {
                        collapsed: "bg-sky-900/90 hover:bg-sky-900 text-sky-50 border-r-4 border-sky-400",
                        expanded: "bg-sky-950 text-white border-r-4 border-sky-300 shadow-md",
                        accentDot: "bg-sky-400",
                      },
                      {
                        collapsed: "bg-emerald-900/90 hover:bg-emerald-900 text-emerald-50 border-r-4 border-emerald-400",
                        expanded: "bg-emerald-950 text-white border-r-4 border-emerald-300 shadow-md",
                        accentDot: "bg-emerald-400",
                      },
                      {
                        collapsed: "bg-orange-950/90 hover:bg-orange-950 text-orange-50 border-r-4 border-orange-400",
                        expanded: "bg-orange-950 text-white border-r-4 border-orange-300 shadow-md",
                        accentDot: "bg-orange-400",
                      },
                    ];

                    const theme = UNIT_COLOR_SCHEMES[uIdx % UNIT_COLOR_SCHEMES.length];
                    
                    return (
                      <div key={`unit-${uIdx}`} className="bg-white">
                        {/* Unit Accordion Trigger */}
                        <button
                          type="button"
                          onClick={() => toggleUnit(uIdx)}
                          className={`w-full p-4 text-right font-black text-xs md:text-sm flex justify-between items-center transition-all duration-200 cursor-pointer ${
                            isExpanded ? theme.expanded : theme.collapsed
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap text-right">
                            <span className={`w-2.5 h-2.5 rounded-full ${theme.accentDot} inline-block shrink-0 shadow-xs`} />
                            <span className="leading-tight">{unit.name}</span>
                            {!isExpanded && isCurrentlySolvingInThisUnit && (
                              <span className="bg-amber-400 text-slate-950 px-2.5 py-1 rounded-lg text-[11px] font-black border border-amber-300 animate-pulse flex items-center gap-1.5 shadow-sm">
                                <span>✏️</span>
                                <span>ملاحظة: جاري الحل في هذه الوحدة</span>
                              </span>
                            )}
                          </div>
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 shrink-0 mr-2 ${isExpanded ? "rotate-180 text-white" : "text-slate-300"}`} />
                        </button>

                        {/* Lessons Stack */}
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden bg-slate-50"
                            >
                              <div className="p-2 space-y-1">
                                {matchingLessons.map(({ lesson, lIdx }) => {
                                  const isActive = isPlaying && activeUnitIdx === uIdx && activeLessonIdx === lIdx;
                                  const statsKey = `${selectedSubject}_${unit.name}_${lesson.name}`;
                                  const stat = lessonStats[statsKey];
                                  
                                  let statusText: React.ReactNode = "لم يحل";
                                  let badgeColor = "bg-rose-50 text-rose-600 border border-rose-500 font-bold shadow-xs";
                                  
                                  if (isActive) {
                                    statusText = "جاري الحل";
                                    badgeColor = "bg-blue-50 text-blue-600 border border-blue-500 font-black animate-pulse shadow-xs";
                                  } else if (stat?.solved) {
                                    if (stat.score === stat.maxScore) {
                                      statusText = (
                                        <span className="flex items-center gap-1">
                                          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                          <span>مكتمل ({stat.score}/{stat.maxScore})</span>
                                        </span>
                                      );
                                      badgeColor = "bg-emerald-50 text-emerald-700 border border-emerald-500 font-bold shadow-xs";
                                    } else {
                                      statusText = `مكتمل (${stat.score}/${stat.maxScore})`;
                                      badgeColor = "bg-amber-50 text-amber-700 border border-amber-500 font-bold shadow-xs";
                                    }
                                  }

                                  return (
                                    <button
                                      key={`lesson-${lIdx}`}
                                      type="button"
                                      onClick={() => selectLesson(uIdx, lIdx)}
                                      className={`w-full p-3 rounded-xl text-right text-xs font-extrabold transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 ${
                                        isActive 
                                          ? "bg-indigo-100/40 border border-indigo-200 text-indigo-800 shadow-xs font-black" 
                                          : "hover:bg-slate-100 text-slate-700"
                                      }`}
                                    >
                                      <div className="flex flex-col text-right">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-xs md:text-sm text-slate-800">{lesson.name}</span>
                                          {normalizedLessonSearch && normalizeArabic(lesson.name).includes(normalizedLessonSearch) && (
                                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-1.5 py-0.2 rounded border border-indigo-200">
                                              مطابق 🎯
                                            </span>
                                          )}
                                        </div>
                                        <span className="text-xs text-slate-400 font-semibold mt-1">
                                          عدد الأسئلة: {lesson.questions.length} أسئلة
                                        </span>
                                      </div>

                                      {/* Status Badge matching state layout */}
                                      <span className={`text-[10.5px] font-bold px-2.5 py-1.5 rounded-lg border shrink-0 ${badgeColor}`}>
                                        {statusText}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Completion Modal/Card */}
      <AnimatePresence>
        {showCompletionModal && (() => {
          const correctCount = completionData?.correctCount ?? Object.values(userAnswers).filter(a => a.isCorrect).length;
          const totalCount = completionData?.totalQuestions || questions.length || 1;
          const lessonDisplayName = completionData?.lessonName || activeLesson?.name || "الدرس";
          const unitDisplayName = completionData?.unitName || activeUnit?.name || "الوحدة";
          const isPerfectScore = correctCount === totalCount && totalCount > 0;
          
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
              {/* Render fireworks behind the modal when getting a perfect score */}
              {isPerfectScore && <Fireworks />}

              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className={`p-6 md:p-8 rounded-3xl max-w-md w-full text-center shadow-2xl relative overflow-hidden transition-all duration-300 border ${
                  isPerfectScore
                    ? "bg-gradient-to-b from-amber-50 via-white to-white border-amber-300 shadow-amber-500/10"
                    : "bg-white border-slate-200"
                }`}
              >
                {isPerfectScore && (
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-400" />
                )}

                <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 shadow-inner relative ${
                  isPerfectScore 
                    ? "bg-amber-100 border border-amber-200 text-amber-600 animate-pulse" 
                    : "bg-indigo-50 border border-indigo-100 text-yellow-500"
                }`}>
                  <Trophy className={`w-10 h-10 ${isPerfectScore ? "animate-bounce text-amber-500" : "animate-bounce"}`} />
                  {isPerfectScore && (
                    <motion.span 
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute -top-1 -right-1 text-xl"
                    >
                      👑
                    </motion.span>
                  )}
                </div>

                <h2 className={`text-xl font-black ${isPerfectScore ? "text-amber-900" : "text-slate-900"}`}>
                  {isPerfectScore ? "كفووو يا بطل! حصلت على الدرجة الكاملة! 🎉🏆" : "لقد أكملت مراجعة الدرس بنجاح!"}
                </h2>
                <p className="text-slate-500 text-xs font-semibold mt-2 leading-relaxed">
                  مراجعة {lessonDisplayName} من {unitDisplayName}
                </p>

                {/* Score breakdown */}
                <div className={`p-5 rounded-2xl my-6 border ${
                  isPerfectScore 
                    ? "bg-amber-50/50 border-amber-200" 
                    : "bg-slate-50 border-slate-100"
                }`}>
                  <span className="text-xs text-slate-500 font-bold block mb-1">الدرجة المستحقة</span>
                  <span className={`text-3xl font-black font-mono ${isPerfectScore ? "text-amber-600" : "text-slate-900"}`}>
                    {correctCount} / {totalCount}
                  </span>
                  <span className="text-xs text-slate-500 font-extrabold block mt-2">
                    {isPerfectScore ? (
                      <span className="text-amber-700 flex items-center justify-center gap-1.5 animate-pulse">
                        <Sparkles className="w-4 h-4 text-amber-500" /> 
                        <span>إنجاز متميز ومثالي! حافظ على هذا التألق دائماً! 🚀⭐</span>
                      </span>
                    ) : (
                      <span>بإمكانك إعادة المحاولة في أي وقت للحصول على علامة 100% كاملة!</span>
                    )}
                  </span>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setShowCompletionModal(false);
                      handleReset();
                    }}
                    className="flex-1 font-bold text-xs md:text-sm px-4 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-100 text-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إعادة المحاولة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setShowCompletionModal(false);
                      handleExitLesson();
                    }}
                    className={`flex-1 font-extrabold text-xs md:text-sm px-6 py-3.5 rounded-2xl transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
                      isPerfectScore
                        ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-500/20 hover:-translate-y-0.5"
                        : "bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-indigo-500/20 hover:-translate-y-0.5"
                    }`}
                  >
                    <span>موافق 🎯</span>
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
