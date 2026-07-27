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
  AlertCircle
} from "lucide-react";
import { BankQuestion, Student } from "../types";
import { db } from "../firebase";
import { collection, doc, setDoc, getDocs, query, where, onSnapshot } from "firebase/firestore";

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
}

export default function StudentCurriculumReview({
  activeStudent,
  bankQuestions,
  triggerToast,
  selectedSubject,
  onSelectedSubjectChange,
  onGoBackToQuizzes,
  teacherId
}: StudentCurriculumReviewProps) {
  // Sounds
  const synth = useMemo(() => new ReviewSoundSynth(), []);

  const [visibleSubjects, setVisibleSubjects] = useState<string[]>([]);

  // Listen to visible subjects based on teacher settings
  useEffect(() => {
    const tid = teacherId || activeStudent?.teacherId || "demo_teacher";
    if (!tid) return;

    const ref = doc(db, "curriculum_settings", tid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setVisibleSubjects(data.visibleSubjects || []);
      } else {
        setVisibleSubjects([]); // Default is empty, meaning all subjects are hidden
      }
    }, (error) => {
      console.warn("Could not load curriculum settings in student view:", error);
    });

    return unsub;
  }, [teacherId, activeStudent?.teacherId]);

  // If currently viewing a subject that becomes hidden in real-time, redirect student
  useEffect(() => {
    if (selectedSubject && !visibleSubjects.includes(selectedSubject)) {
      onSelectedSubjectChange(null);
      setIsPlaying(false);
      triggerToast("عذراً، هذه المادة تم إخفاؤها مؤخراً بواسطة المعلم.", "warning");
    }
  }, [selectedSubject, visibleSubjects, onSelectedSubjectChange, triggerToast]);

  // Dynamic Syllabus constructed ONLY from custom bankQuestions loaded from Firestore
  const syllabus = useMemo(() => {
    const merged: Record<string, typeof PRELOADED_SUBJECTS[string]> = {};

    // Group database bank questions
    bankQuestions.forEach((q) => {
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
  }, [bankQuestions]);

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
  const [aiHints, setAiHints] = useState<Record<string, string>>({});
  const [isGeneratingAiHint, setIsGeneratingAiHint] = useState<boolean>(false);
  const pendingAiHintKeysRef = useRef<Set<string>>(new Set());

  // Robust check for True/False or 2-option binary questions
  const isTrueFalseQuestion = (q: any) => {
    if (!q) return false;
    if (q.type === "true_false" || q.type === "tf" || q.type === "boolean" || q.type === "truefalse") {
      return true;
    }
    const rawOpts = q.options || [];
    const cleanOpts = rawOpts.filter((opt: string) => {
      if (!opt) return false;
      const t = opt.trim();
      return (
        t !== "" &&
        !t.startsWith("الخيار الثالث") &&
        !t.startsWith("الخيار الرابع") &&
        !t.toLowerCase().startsWith("option 3") &&
        !t.toLowerCase().startsWith("option 4") &&
        !t.toLowerCase().startsWith("option3") &&
        !t.toLowerCase().startsWith("option4")
      );
    });

    if (cleanOpts.length <= 2) {
      return true;
    }

    const optsStr = cleanOpts.join(" ").toLowerCase();
    if (
      optsStr.includes("صح") ||
      optsStr.includes("خطأ") ||
      optsStr.includes("صواب") ||
      optsStr.includes("true") ||
      optsStr.includes("false")
    ) {
      return true;
    }

    return false;
  };

  const handleFetchAiHint = async () => {
    if (!currentQuestion) return;
    const qKey = currentQuestion.id || currentQuestion.text;
    if (aiHints[qKey] || pendingAiHintKeysRef.current.has(qKey)) {
      return;
    }

    pendingAiHintKeysRef.current.add(qKey);
    setIsGeneratingAiHint(true);
    try {
      const res = await fetch("/api/generate-question-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: currentQuestion.text,
          options: currentQuestion.options,
          subject: selectedSubject,
          unit: activeUnit?.name,
          lesson: activeLesson?.name,
        }),
      });

      const data = await res.json();
      if (data.success && data.hint) {
        setAiHints((prev) => ({ ...prev, [qKey]: data.hint }));
      } else {
        setAiHints((prev) => ({
          ...prev,
          [qKey]: "تذكر المفهوم الأساسي في هذا الدرس وحاول الربط بين المعطيات والخيارات المتاحة لاختيار الإجابة الصحيحة.",
        }));
      }
    } catch (err) {
      console.error("Error generating AI hint:", err);
      setAiHints((prev) => ({
        ...prev,
        [qKey]: "ركز على الكلمات المفتاحية في السؤال واستحضر القواعد والتعاريف الأساسية التي تعلمتها في هذا الدرس.",
      }));
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

  // Sync from cloud once upon activeStudent changes
  useEffect(() => {
    if (activeStudent?.id) {
      const ref = doc(db, "student_curriculum_scores", activeStudent.id);
      // Setup a real-time listener so their progress syncs gracefully across tabs or devices
      const unsub = onSnapshot(ref, (snapshot) => {
        if (snapshot.exists()) {
          const cloudData = snapshot.data();
          if (cloudData && cloudData.stats) {
            setLessonStats((prev) => {
              const merged = { ...prev, ...cloudData.stats };
              localStorage.setItem(`curriculum_stats_${activeStudent.id}`, JSON.stringify(merged));
              return merged;
            });
          }
        }
      });
      return unsub;
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
    const shuffledQList = shuffleArray(lessonQuestions);

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

  // Watch for active lesson changes and trigger initialization
  useEffect(() => {
    if (activeLesson?.questions) {
      initializeLesson(activeLesson.questions);
    } else {
      setActiveQuestions([]);
    }
  }, [activeLesson]);

  // Toggle accordions
  const toggleUnit = (idx: number) => {
    synth.playClick();
    setExpandedUnits(prev => prev[idx] ? {} : { [idx]: true });
  };

  // Select Lesson from Sidebar
  const selectLesson = (unitIdx: number, lessonIdx: number) => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
    }
    synth.playClick();
    setActiveUnitIdx(unitIdx);
    setActiveLessonIdx(lessonIdx);
    
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
    if (currentQuestionIdx === questions.length - 1) {
      // Calculate final score
      const answersList = Object.values(updatedAnswers);
      const correctCount = answersList.filter(a => a.isCorrect).length;
      const finalScore = correctCount;

      // Save statistics - keep the highest score ever achieved!
      const statsKey = `${selectedSubject}_${activeUnit.name}_${activeLesson.name}`;
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

      // Play success sound
      synth.playSuccess();
      
      // Delay for 2 seconds (as requested) so they can see the visual feedback before the modal pops up
      const t = setTimeout(() => {
        setShowCompletionModal(true);
      }, 2000);
      autoNextTimeoutRef.current = t;
    } else {
      // Automatically transition to the next question after 2 seconds
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
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
    }
    synth.playClick();
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
    }
  };

  const handleReset = () => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
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
  };

  const handleExitLesson = () => {
    if (autoNextTimeoutRef.current) {
      clearTimeout(autoNextTimeoutRef.current);
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
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-md flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <BookOpen className="w-7 h-7" />
            </div>
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
              <span>الخروج للرئيسية</span>
            </button>
          </div>
        </div>
      )}

      {/* --- LEVEL 1: Subject Selection Screen --- */}
      {!selectedSubject ? (
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

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {Object.keys(syllabus).filter(key => visibleSubjects.includes(key)).map((subjectKey) => {
              const sub = syllabus[subjectKey];
              let totalLessons = 0;
              let solvedLessons = 0;
              sub.units.forEach(u => {
                u.lessons.forEach(l => {
                  totalLessons++;
                  const statsKey = `${subjectKey}_${u.name}_${l.name}`;
                  if (lessonStats[statsKey]?.solved) solvedLessons++;
                });
              });

              const isCompleted = totalLessons > 0 && solvedLessons === totalLessons;

              return (
                <motion.div
                  key={subjectKey}
                  whileHover={{ y: -5, scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    synth.playClick();
                    onSelectedSubjectChange(subjectKey);
                  }}
                  className={`bg-white border rounded-3xl p-6 cursor-pointer transition-all duration-200 relative overflow-hidden group shadow-md hover:shadow-lg ${
                    isCompleted 
                      ? "border-emerald-300 bg-emerald-50/40 shadow-emerald-500/5" 
                      : "border-slate-200 hover:border-indigo-300"
                  }`}
                >
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

                  {/* Horizontal Bubble Pagination (Clickable to jump around!) */}
                  <div className="flex flex-wrap gap-2 justify-start items-center" style={{ direction: "rtl" }}>
                    {questions.map((_, idx) => {
                      const ans = userAnswers[idx];
                      const isActive = idx === currentQuestionIdx;
                      
                      let bubbleStyle = "bg-white text-slate-600 border border-slate-200 hover:bg-slate-200";
                      if (isActive) {
                        bubbleStyle = "border-2 border-indigo-500 bg-indigo-600 text-white font-black scale-105 shadow-md shadow-indigo-500/20";
                      } else if (ans) {
                        bubbleStyle = ans.isCorrect
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200 font-bold"
                          : "bg-rose-50 text-rose-600 border border-rose-200 font-bold";
                      }

                      return (
                        <button
                          key={`bubble-${idx}`}
                          type="button"
                          onClick={() => {
                            if (autoNextTimeoutRef.current) {
                              clearTimeout(autoNextTimeoutRef.current);
                            }
                            synth.playClick();
                            setCurrentQuestionIdx(idx);
                            const saved = userAnswers[idx];
                            if (saved) {
                              setSelectedAnswer(saved.selected);
                              setIsAnswered(true);
                            } else {
                              setSelectedAnswer(null);
                              setIsAnswered(false);
                            }
                            setShowHelp(false);
                          }}
                          className={`w-9 h-9 rounded-full text-xs md:text-sm font-black flex items-center justify-center transition-all duration-150 cursor-pointer ${bubbleStyle}`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Question Area */}
                <div className="mb-6">
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

                {/* HELP ACCORDION (مساعدة وإرشاد تربوي ذكي) */}
                <div className="mb-6 border border-indigo-200/80 rounded-2xl overflow-hidden bg-slate-50 shadow-xs transition-all">
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      const willShow = !showHelp;
                      setShowHelp(willShow);
                      if (willShow && currentQuestion) {
                        const qKey = currentQuestion.id || currentQuestion.text;
                        if (!aiHints[qKey] && !currentQuestion.help) {
                          handleFetchAiHint();
                        }
                      }
                    }}
                    className="w-full px-5 py-3.5 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-purple-50/80 hover:bg-indigo-100/50 text-slate-800 font-black text-xs md:text-sm flex justify-between items-center cursor-pointer transition-colors border-b border-indigo-100/60"
                  >
                    <div className="flex items-center gap-2.5 text-indigo-700">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div className="text-right">
                        <span className="block font-black text-xs md:text-sm text-slate-900">مساعدة وإرشاد تربوي للدرس</span>
                        <span className="block text-[11px] text-indigo-600 font-bold">مدعوم بالذكاء الاصطناعي 🤖</span>
                      </div>
                    </div>
                    {showHelp ? <ChevronUp className="w-5 h-5 text-indigo-600" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                  </button>
                  
                  <AnimatePresence>
                    {showHelp && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-white p-5 space-y-4"
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

                        {/* AI Generated Smart Hint */}
                        <div>
                          {(() => {
                            const qKey = currentQuestion ? (currentQuestion.id || currentQuestion.text) : "";
                            const hint = aiHints[qKey];

                            if (isGeneratingAiHint) {
                              return (
                                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 flex items-center gap-3 text-indigo-700 font-bold text-xs md:text-sm animate-pulse">
                                  <Sparkles className="w-5 h-5 animate-spin text-indigo-600 shrink-0" />
                                  <span>جاري صياغة مساعدة وإرشاد تربوي يناسب هذا السؤال بواسطة الذكاء الاصطناعي... 🤖✨</span>
                                </div>
                              );
                            }

                            if (hint) {
                              return (
                                <div className="bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 border border-indigo-200/90 rounded-xl p-4 shadow-xs">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2 text-indigo-800 font-black text-xs md:text-sm">
                                      <Sparkles className="w-4 h-4 text-indigo-600" />
                                      <span>تلميح وإرشاد ذكي من المعلم الافتراضي:</span>
                                    </div>
                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-indigo-200">
                                      ذكاء اصطناعي ✨
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-800 leading-relaxed font-bold whitespace-pre-line">
                                    {hint}
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <button
                                type="button"
                                onClick={handleFetchAiHint}
                                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Sparkles className="w-4 h-4 text-yellow-300" />
                                <span>توليد مساعدة وإرشاد ذكي للسؤال بالذكاء الاصطناعي 🤖</span>
                              </button>
                            );
                          })()}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

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
                          className="w-full sm:w-60 px-6 py-3.5 rounded-xl text-xs md:text-sm font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>
                            {currentQuestionIdx < questions.length - 1 ? "السؤال التالي" : "عرض النتيجة النهائية"}
                          </span>
                          <ChevronLeft className="w-4.5 h-4.5" />
                        </button>
                        <span className="text-[10px] md:text-xs font-bold text-slate-500 animate-pulse">
                          ⏱️ جاري الانتقال تلقائياً خلال ثانيتين...
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

              {/* Units & Lessons List container */}
              <div className="divide-y divide-slate-100 overflow-y-auto max-h-[500px]">
                {activeSubjectData?.units.map((unit, uIdx) => {
                  const isExpanded = !!expandedUnits[uIdx];
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
                              {unit.lessons.map((lesson, lIdx) => {
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
                                      <span className="font-bold text-xs md:text-sm text-slate-800">{lesson.name}</span>
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
                })}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* Completion Modal/Card */}
      <AnimatePresence>
        {showCompletionModal && activeLesson && (() => {
          const correctCount = Object.values(userAnswers).filter(a => a.isCorrect).length;
          const isPerfectScore = correctCount === questions.length && questions.length > 0;
          
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
                  مراجعة {activeLesson.name} من {activeUnit.name}
                </p>

                {/* Score breakdown */}
                <div className={`p-5 rounded-2xl my-6 border ${
                  isPerfectScore 
                    ? "bg-amber-50/50 border-amber-200" 
                    : "bg-slate-50 border-slate-100"
                }`}>
                  <span className="text-xs text-slate-500 font-bold block mb-1">الدرجة المستحقة</span>
                  <span className={`text-3xl font-black font-mono ${isPerfectScore ? "text-amber-600" : "text-slate-900"}`}>
                    {correctCount} / {questions.length}
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

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => {
                      synth.playClick();
                      setShowCompletionModal(false);
                      handleExitLesson();
                    }}
                    className={`w-full font-extrabold text-sm px-6 py-3.5 rounded-2xl transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 ${
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
