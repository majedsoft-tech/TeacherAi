import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

dotenv.config();

// Ensure Gemini Client is initialized lazy/safely
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY || 
                   process.env.API_KEY || 
                   process.env.GOOGLE_API_KEY || 
                   process.env.GOOGLE_GENAI_API_KEY || 
                   process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables. Please check Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Lazy/Safe Server Firestore Instance
let firestoreDbInstance: any = null;
function getServerDb() {
  if (!firestoreDbInstance) {
    try {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const existingApps = getApps();
        const appInstance = existingApps.length > 0 
          ? existingApps[0] 
          : initializeApp(firebaseConfig, "server-app");
        firestoreDbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId || "(default)");
      }
    } catch (err) {
      console.error("Error initializing server Firestore:", err);
    }
  }
  return firestoreDbInstance;
}

// Robust JSON Sanitizer and Truncation Repair Utilities
function cleanAndExtractJson(raw: string): string {
  let cleaned = (raw || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return cleaned.trim();
}

function safeParseQuestionsArray(rawText: string): any[] {
  const cleaned = cleanAndExtractJson(rawText);
  if (!cleaned) return [];

  // 1. Direct JSON.parse
  try {
    const result = JSON.parse(cleaned);
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.questions)) return result.questions;
  } catch (e1) {
    // Proceed to repair
  }

  // 2. Fix unescaped control characters
  try {
    const sanitized = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => {
      if (c === '\n') return '\\n';
      if (c === '\r') return '\\r';
      if (c === '\t') return '\\t';
      return '';
    });
    const result = JSON.parse(sanitized);
    if (Array.isArray(result)) return result;
    if (result && Array.isArray(result.questions)) return result.questions;
  } catch (e2) {
    // Proceed
  }

  // 3. Truncation recovery: find last valid question object closure '}'
  try {
    let lastClosingBrace = cleaned.lastIndexOf('}');
    while (lastClosingBrace > 0) {
      const sliceCandidate = cleaned.slice(0, lastClosingBrace + 1).trim();
      const firstBracket = sliceCandidate.indexOf('[');
      if (firstBracket !== -1) {
        const candidateJson = sliceCandidate.slice(firstBracket) + ']';
        try {
          const res = JSON.parse(candidateJson);
          if (Array.isArray(res) && res.length > 0) {
            console.log(`[Recovery] Successfully rescued ${res.length} complete questions from truncated Gemini output.`);
            return res;
          }
        } catch (err) {
          // Continue scanning backwards
        }
      }
      lastClosingBrace = cleaned.lastIndexOf('}', lastClosingBrace - 1);
    }
  } catch (e3) {
    // Proceed
  }

  // 4. Regex object recovery: Extract individual complete JSON question objects
  try {
    const recovered: any[] = [];
    const objRegex = /\{[\s\S]*?\}(?=\s*,\s*\{|\s*\]|\s*$)/g;
    let match;
    while ((match = objRegex.exec(cleaned)) !== null) {
      try {
        const obj = JSON.parse(match[0]);
        if (obj && (obj.text || obj.question)) {
          recovered.push(obj);
        }
      } catch (_) {}
    }
    if (recovered.length > 0) {
      console.log(`[Recovery] Rescued ${recovered.length} question objects via regex scanner.`);
      return recovered;
    }
  } catch (e4) {
    // Proceed
  }

  throw new Error("تعذر تحليل الأسئلة المولدة نظراً لعدم اكتمال بيانات الاستجابة من الذكاء الاصطناعي. يرجى تجربة توليد عدد أقل من الأسئلة أو اختيار دروس محددة.");
}

function safeParseBookStructure(rawText: string): any {
  const cleaned = cleanAndExtractJson(rawText);
  if (!cleaned) {
    throw new Error("فشل الذكاء الاصطناعي في استخراج هيكلية الكتاب.");
  }

  // 1. Direct parse
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // Proceed
  }

  // 2. Sanitize unescaped control chars
  try {
    const sanitized = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, (c) => {
      if (c === '\n') return '\\n';
      if (c === '\r') return '\\r';
      if (c === '\t') return '\\t';
      return '';
    });
    return JSON.parse(sanitized);
  } catch (e2) {
    // 3. Try appending missing closing braces/brackets for truncated structure
    for (const suffix of ['}', ']}', '"]}', '"}]}', '"]}}', '"}]}}', '}]}}']) {
      try {
        return JSON.parse(cleaned + suffix);
      } catch (_) {}
    }
  }

  throw new Error("فشل تحليل فهرس ووحدات الكتاب من الملف المرفق.");
}

// Robust Gemini API Caller with 429 Rate-Limit Quota Backoff & Multi-Tier Model Fallbacks
async function generateGeminiContentWithRetry(
  ai: GoogleGenAI,
  params: {
    model?: string;
    contents: any;
    config?: any;
  },
  maxRetries = 6
): Promise<any> {
  const defaultModel = "gemini-3.8-flash";
  const rawRequested = params.model;
  // Automatically sanitize deprecated models
  const requestedModel = (!rawRequested || rawRequested.includes("2.5") || rawRequested.includes("1.5") || rawRequested.includes("2.0"))
    ? defaultModel
    : rawRequested;
  
  // Multi-tier pool of high-capacity modern models with distinct fallback order
  const candidateModels = Array.from(new Set([
    requestedModel,
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-flash-latest"
  ])).filter(Boolean);

  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const currentModel = candidateModels[Math.min(attempt, candidateModels.length - 1)];
    try {
      const response = await ai.models.generateContent({
        ...params,
        model: currentModel
      });
      return response;
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err?.message || err);
      const isQuotaOr429 = errMsg.includes("429") || 
                           errMsg.includes("RESOURCE_EXHAUSTED") || 
                           errMsg.includes("quota") || 
                           errMsg.includes("Quota exceeded") ||
                           errMsg.includes("rate-limits");
      const isUnavailableOr503 = errMsg.includes("503") || 
                                 errMsg.includes("UNAVAILABLE") || 
                                 errMsg.includes("high demand") ||
                                 errMsg.includes("overloaded");
      const isNotFoundOr404 = errMsg.includes("404") || 
                              errMsg.includes("NOT_FOUND") || 
                              errMsg.includes("no longer available") ||
                              errMsg.includes("not found");

      console.warn(`[Gemini API Attempt ${attempt + 1}/${maxRetries}] Model "${currentModel}" encountered ${isNotFoundOr404 ? '404 Deprecated/Not Found' : isQuotaOr429 ? '429 Quota/Rate-limit' : isUnavailableOr503 ? '503 Unavailable' : 'Error'}: ${errMsg.slice(0, 180)}`);

      if (attempt < maxRetries - 1) {
        let waitTimeMs = 3000 * (attempt + 1);

        if (isNotFoundOr404) {
          // Instant switch to modern supported model without wasted delay
          waitTimeMs = 50;
        } else {
          // Extract explicit retryDelay if provided in the Gemini API error body
          const retryMatch = errMsg.match(/retry in\s+([\d\.]+)\s*s/i) || 
                             errMsg.match(/retryDelay["']?:\s*["']?(\d+)/i);
          if (retryMatch && retryMatch[1]) {
            const parsedSec = parseFloat(retryMatch[1]);
            if (!isNaN(parsedSec) && parsedSec > 0) {
              waitTimeMs = Math.min(Math.ceil(parsedSec * 1000) + 1000, 15000);
            }
          } else if (isUnavailableOr503) {
            // Instant failover to alternate model cluster for temporary model high-demand spikes
            waitTimeMs = 250;
          } else if (isQuotaOr429) {
            // Exponential backoff to allow RPM/TPM quota windows to refresh
            waitTimeMs = Math.min(4000 * (attempt + 1), 18000);
          }
        }

        const nextModel = candidateModels[Math.min(attempt + 1, candidateModels.length - 1)];
        console.log(`[Gemini Fallback] Switching to model "${nextModel}" (pause ${(waitTimeMs / 1000).toFixed(1)}s)...`);
        await new Promise((resolve) => setTimeout(resolve, waitTimeMs));
      }
    }
  }

  // If last error is 429 quota or 503, provide user-friendly Arabic explanation
  const finalErrMsg = String(lastError?.message || lastError);
  if (finalErrMsg.includes("429") || finalErrMsg.includes("quota") || finalErrMsg.includes("RESOURCE_EXHAUSTED")) {
    throw new Error("تم بلوغ الحد الأقصى المؤقت لطلبات الذكاء الاصطناعي في الدقيقة. يرجى الانتظار بضع لحظات ثم إعادة المحاولة.");
  }
  if (finalErrMsg.includes("503") || finalErrMsg.includes("UNAVAILABLE")) {
    throw new Error("خوادم الذكاء الاصطناعي تشهد ضغطاً مؤقتاً. يرجى إعادة المحاولة بعد لحظات.");
  }

  throw lastError;
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  // Increase body limit to handle large PDFs
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Extract Book Units & Lessons Structure API Route
  app.post("/api/extract-book-structure", async (req, res) => {
    try {
      const { pdfBase64, mimeType } = req.body;

      if (!pdfBase64) {
        return res.status(400).json({ error: "البيانات المرفقة للملف مفقودة، يرجى إعادة رفع الملف." });
      }

      const ai = getGeminiClient();
      const fileMimeType = mimeType || "application/pdf";
      const isWord = fileMimeType.includes("word") || fileMimeType.includes("msword") || fileMimeType.includes("officedocument.wordprocessingml");
      const isExcel = fileMimeType.includes("excel") || fileMimeType.includes("spreadsheet") || fileMimeType.includes("csv");

      let extractedText = "";
      let isOfficeDoc = false;

      if (isWord || isExcel) {
        isOfficeDoc = true;
        const buffer = Buffer.from(pdfBase64, "base64");
        if (isWord) {
          try {
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
          } catch (err: any) {
            console.error("Error parsing Word doc with mammoth:", err);
            throw new Error(`فشل في قراءة ملف Word: ${err.message || err}`);
          }
        } else if (isExcel) {
          try {
            const workbook = XLSX.read(buffer, { type: "buffer" });
            let tempText = "";
            workbook.SheetNames.forEach((sheetName) => {
              const worksheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_txt(worksheet);
              tempText += `Sheet: ${sheetName}\n${csv}\n\n`;
            });
            extractedText = tempText;
          } catch (err: any) {
            console.error("Error parsing Excel with xlsx:", err);
            throw new Error(`فشل في قراءة ملف Excel: ${err.message || err}`);
          }
        }
      }

      const systemInstruction = `
أنت خبير تربوي متخصص في تحليل الكتب الدراسية والمناهج التعليمية والمستندات.
مهمتك هي فحص المستند المرفق بدقة شديدة (سواء كان كتاباً مدرسياً بصيغة PDF أو Word أو كشف موضوعات بـ Excel)، وقراءة الفهرس والغلاف وعناوين الفصول والأبواب والوحدات والدروس.

المطلوب:
1. التحقق مما إذا كان المستند عبارة عن كتاب مدرسي أو منهج تعليمي يحتوي على وحدات وفصول أو دروس:
   - اجعل isTextbook: true إذا وجدت وحدات وفصول أو دروس أو موضوعات دراسية منظمة.
   - اجعل isTextbook: false فقط إذا كان المستند مجرد ورقة عمل عشوائية واحدة أو مستند غير تعليمي.
2. استخراج اسم الكتاب أو المادة الأساسية (bookTitle).
3. استنتاج المرحلة الدراسية بدقة (stage: "المرحلة الابتدائية" أو "المرحلة المتوسطة" أو "المرحلة الثانوية" أو فارغ إن تعذر).
4. استنتاج الصف الدراسي بدقة (grade: مثل "الصف الأول المتوسط", "السنة الأولى المشتركة (أول ثانوي)", إلخ).
5. استنتاج الفصل الدراسي بدقة (semester: "الفصل الدراسي الأول" أو "الفصل الدراسي الثاني" أو "الفصل الدراسي الثالث" أو فارغ).
6. استنتاج اسم المادة (subject: مثل "التقنية الرقمية", "العلوم", "الرياضيات", إلخ).
7. استخراج قائمة شاملة ومرتبة بالوحدات الدراسية (units)، ولكل وحدة استخرج قائمة الدروس (lessons) التابعة لها بالتفصيل.
   - كل وحدة تحتوي على:
     - id: معرف تسلسلي مثل "unit_1"
     - unitTitle: اسم ورقم الوحدة (مثال: "الوحدة الأولى: علم الحاسوب والبيانات")
     - lessons: قائمة الدروس، وكل درس يحتوي على:
       - id: معرف تسلسلي مثل "lesson_1_1"
       - lessonTitle: اسم ورقم وموضوع الدرس (مثال: "الدرس الأول: البيانات والمعلومات")
       - pageOrSection: رقم الصفحة أو التبويب إن ذكر (اختياري)
8. وضع ملخص تربوي مقتضب في جملة واحدة (summary).

يجب صياغة جميع العناوين باللغة العربية الفصحى الواضحة والمنظمة.
`;

      let contentsParts: any[] = [];
      if (isOfficeDoc) {
        contentsParts = [{
          text: `إليك المحتوى النصي للمستند المرفق. الرجاء قراءته وفحص الفهرس والوحدات والدروس التفصيلية فيه:\n\n${extractedText.slice(0, 80000)}`
        }];
      } else {
        contentsParts = [
          {
            inlineData: {
              mimeType: fileMimeType,
              data: pdfBase64,
            }
          },
          {
            text: `الرجاء فحص وقراءة هذا الكتاب المدرسي / المستند، واستخراج الفهرس وهيكلية الوحدات والدروس التفصيلية منه بدقة كاملة.`
          }
        ];
      }

      const response = await generateGeminiContentWithRetry(ai, {
        model: "gemini-3.8-flash",
        contents: {
          parts: contentsParts
        },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW
          },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bookTitle: { type: Type.STRING, description: "عنوان الكتاب أو المنهج" },
              isTextbook: { type: Type.BOOLEAN, description: "هل يحتوي على وحدات ودروس منظمة" },
              stage: { type: Type.STRING, description: "المرحلة الدراسية" },
              grade: { type: Type.STRING, description: "الصف الدراسي" },
              semester: { type: Type.STRING, description: "الفصل الدراسي" },
              subject: { type: Type.STRING, description: "اسم المادة" },
              summary: { type: Type.STRING, description: "ملخص سريع" },
              units: {
                type: Type.ARRAY,
                description: "قائمة الوحدات والدروس",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING, description: "معرف الوحدة" },
                    unitTitle: { type: Type.STRING, description: "اسم الوحدة الدراسية" },
                    lessons: {
                      type: Type.ARRAY,
                      description: "قائمة الدروس داخل هذه الوحدة",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          id: { type: Type.STRING, description: "معرف الدرس" },
                          lessonTitle: { type: Type.STRING, description: "اسم وموضوع الدرس" },
                          pageOrSection: { type: Type.STRING, description: "الصفحة أو القسم" }
                        },
                        required: ["id", "lessonTitle"]
                      }
                    }
                  },
                  required: ["id", "unitTitle", "lessons"]
                }
              }
            },
            required: ["bookTitle", "isTextbook", "units"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("فشل الذكاء الاصطناعي في استخراج هيكلية الكتاب.");
      }

      const parsedStructure = safeParseBookStructure(responseText);
      return res.json({ success: true, structure: parsedStructure });
    } catch (error: any) {
      console.error("Error extracting book structure in Gemini:", error);
      return res.status(500).json({ error: error.message || "فشل تحليل فهرس ووحدات الكتاب من الملف المرفق." });
    }
  });

  // Server API Routes: Generate questions from document
  app.post("/api/generate-questions-from-pdf", async (req, res) => {
    try {
      const {
        pdfBase64,
        mimeType,
        customPrompt,
        mcqCount,
        tfCount,
        stageOverride,
        gradeOverride,
        semesterOverride,
        subjectOverride,
        unitOverride,
        lessonOverride,
        selectedLessons,
        selectedUnits,
        lessonsDetail
      } = req.body;

      if (!pdfBase64) {
        return res.status(400).json({ error: "Missing file data. please try uploading again." });
      }

      const ai = getGeminiClient();

      const fileMimeType = mimeType || "application/pdf";
      const isWord = fileMimeType.includes("word") || fileMimeType.includes("msword") || fileMimeType.includes("officedocument.wordprocessingml");
      const isExcel = fileMimeType.includes("excel") || fileMimeType.includes("spreadsheet") || fileMimeType.includes("csv");

      let extractedText = "";
      let isOfficeDoc = false;

      if (isWord || isExcel) {
        isOfficeDoc = true;
        const buffer = Buffer.from(pdfBase64, "base64");
        
        if (isWord) {
          try {
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
          } catch (err: any) {
            console.error("Error parsing Word doc with mammoth:", err);
            throw new Error(`فشل في استخراج النصوص من ملف Word المرفق: ${err.message || err}`);
          }
        } else if (isExcel) {
          try {
            const workbook = XLSX.read(buffer, { type: "buffer" });
            let tempText = "";
            workbook.SheetNames.forEach((sheetName) => {
              const worksheet = workbook.Sheets[sheetName];
              const csv = XLSX.utils.sheet_to_txt(worksheet);
              tempText += `Sheet Name: ${sheetName}\n${csv}\n\n`;
            });
            extractedText = tempText;
          } catch (err: any) {
            console.error("Error parsing Excel sheet with xlsx:", err);
            throw new Error(`فشل في استخراج البيانات من ملف Excel المرفق: ${err.message || err}`);
          }
        }
      }

      const filePart = {
        inlineData: {
          mimeType: fileMimeType,
          data: pdfBase64,
        }
      };

      const parsedMcqCount = typeof mcqCount === 'number' ? Math.max(0, mcqCount) : 15;
      const parsedTfCount = typeof tfCount === 'number' ? Math.max(0, tfCount) : 5;

      // Build specific target lessons with unit association
      interface GenerationTarget {
        unit: string;
        lesson: string;
      }

      let targets: GenerationTarget[] = [];
      if (Array.isArray(lessonsDetail) && lessonsDetail.length > 0) {
        targets = lessonsDetail.map((item: any) => ({
          unit: (item.unitTitle || "").trim() || (unitOverride?.trim() || "الوحدة الأولى"),
          lesson: (item.lessonTitle || "").trim() || (lessonOverride?.trim() || "الدرس الأول")
        }));
      } else if (Array.isArray(selectedLessons) && selectedLessons.length > 0) {
        targets = selectedLessons.map((l: string) => ({
          unit: (Array.isArray(selectedUnits) && selectedUnits.length > 0 ? selectedUnits[0] : (unitOverride?.trim() || "الوحدة الأولى")),
          lesson: l.trim()
        }));
      } else if (Array.isArray(selectedUnits) && selectedUnits.length > 0) {
        targets = selectedUnits.map((u: string) => ({
          unit: u.trim(),
          lesson: lessonOverride?.trim() || "كامل موضوعات الوحدة"
        }));
      } else {
        targets = [{
          unit: unitOverride?.trim() || "الوحدة الأولى",
          lesson: lessonOverride?.trim() || "الدرس الأول"
        }];
      }

      const questionResponseSchema = {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "نص السؤال بالتفصيل" },
            type: { type: Type.STRING, description: "نوع السؤال: multiple_choice أو true_false" },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "الخيارات المتاحة (4 خيارات لـ multiple_choice، أو ['صحيح', 'خطأ'] لـ true_false)"
            },
            correctAnswer: { type: Type.STRING, description: "الإجابة الصحيحة: 0 أو 1 أو 2 أو 3 للخيارات، أو true أو false للصواب والخطأ" },
            points: { type: Type.INTEGER, description: "درجة السؤال (1)" },
            stage: { type: Type.STRING, description: "المرحلة الدراسية" },
            grade: { type: Type.STRING, description: "الصف الدراسي" },
            semester: { type: Type.STRING, description: "الفصل الدراسي" },
            subject: { type: Type.STRING, description: "المادة الدراسية" },
            unit: { type: Type.STRING, description: "الوحدة الدراسية" },
            lesson: { type: Type.STRING, description: "الدرس" }
          },
          required: [
            "text",
            "type",
            "options",
            "correctAnswer",
            "points",
            "stage",
            "grade",
            "semester",
            "subject",
            "unit",
            "lesson"
          ]
        }
      };

      // Helper function to generate questions for a batch of target lessons in a single call
      const generateForBatch = async (batchTargets: GenerationTarget[]): Promise<any[]> => {
        const formattedTargetsTable = batchTargets
          .map((t, idx) => `  ${idx + 1}. [الوحدة: "${t.unit}"] -> [الدرس: "${t.lesson}"] => المطلوب: (${parsedMcqCount}) أسئلة اختيار من متعدد و (${parsedTfCount}) أسئلة صواب وخطأ.`)
          .join("\n");

        const targetSystemInstruction = `
أنت خبير تربوي ومصمم اختبارات ومناهج تعليمية معتمدة.
مهمتك: صياغة واستخراج أسئلة تعليمية رفيعة المستوى ودقيقة علمياً من المستند المرفق وفق الدروس والوحدات المحددة في الجدول أدناه:

🎯 جدول الدروس المستهدفة:
${formattedTargetsTable}

قواعد التوليد الإلزامية:
1. لكل درس في الجدول: قم بتوليد بالضبط (${parsedMcqCount}) اختيار من متعدد (4 خيارات) و (${parsedTfCount}) صواب وخطأ (خيارات ["صحيح", "خطأ"]).
2. قاعدة الإجابة الصحيحة:
   - في multiple_choice: الإجابة الصحيحة تكون دائماً الخيار الأول (index 0)، والمشتتات الثلاثة (1 و 2 و 3) خاطئة، وحقل correctAnswer="0".
   - في true_false: الخيارات دائماً ["صحيح", "خطأ"]. **مهم جداً**: نوّع ووازن بين العبارات الصحيحة والخاطئة في كل درس، فلا تجعل جميع أسئلة الصواب والخطأ صحيحة، بل وزّع بين العبارات الصحيحة علمياً (وحقل correctAnswer="true") والعبارات الخاطئة علمياً (وحقل correctAnswer="false") بشكل متنوع ومتوازن.
3. في كل كائن سؤال:
   - "unit": اسم الوحدة كما في الجدول.
   - "lesson": اسم الدرس كما في الجدول.
   - "type": "multiple_choice" أو "true_false".
   - "points": 1.
${stageOverride && stageOverride !== "auto" ? `   - "stage": "${stageOverride}".` : ""}
${gradeOverride && gradeOverride !== "auto" ? `   - "grade": "${gradeOverride}".` : ""}
${semesterOverride && semesterOverride !== "auto" ? `   - "semester": "${semesterOverride}".` : ""}
${subjectOverride && subjectOverride !== "auto" ? `   - "subject": "${subjectOverride}".` : ""}
`;

        let targetPrompt = "";
        let targetParts: any[] = [];
        if (isOfficeDoc) {
          targetPrompt = `هنا محتوى المستند:\n\n--- بداية المحتوى ---\n${extractedText.slice(0, 100000)}\n--- نهاية المحتوى ---\n\nقم بصياغة الأسئلة المطلوبة في الجدول (${parsedMcqCount} اختيار من متعدد و ${parsedTfCount} صواب وخطأ لكل درس محدد) في مصفوفة JSON. ${customPrompt || ""}`;
          targetParts = [{ text: targetPrompt }];
        } else {
          targetPrompt = `من الكتاب/الملف المرفق، قم بصياغة الأسئلة المطلوبة لكل درس ووحدة في الجدول (${parsedMcqCount} اختيار من متعدد و ${parsedTfCount} صواب وخطأ لكل درس محدد) بدقة في مصفوفة JSON. ${customPrompt || ""}`;
          targetParts = [filePart, { text: targetPrompt }];
        }

        const response = await generateGeminiContentWithRetry(ai, {
          model: "gemini-3.8-flash",
          contents: {
            parts: targetParts
          },
          config: {
            systemInstruction: targetSystemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 16384,
            temperature: 0.2,
            thinkingConfig: {
              thinkingLevel: ThinkingLevel.LOW
            },
            responseSchema: questionResponseSchema
          }
        });

        const questionsText = response?.text;
        if (!questionsText) return [];
        return safeParseQuestionsArray(questionsText);
      };

      // Smart Batch Grouping: keep batch size small (1-3 lessons) to guarantee sub-8s response times
      const totalPerLesson = parsedMcqCount + parsedTfCount;
      let BATCH_SIZE = 2;
      if (targets.length === 1) {
        BATCH_SIZE = 1;
      } else if (totalPerLesson > 12) {
        BATCH_SIZE = 1;
      } else if (totalPerLesson <= 5) {
        BATCH_SIZE = 3;
      }

      const batches: GenerationTarget[][] = [];
      for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        batches.push(targets.slice(i, i + BATCH_SIZE));
      }

      console.log(`[Generation] Processing ${targets.length} target lessons across ${batches.length} sequential batches...`);
      const rawCollectedQuestions: any[] = [];
      let lastBatchError: any = null;

      for (let bIdx = 0; bIdx < batches.length; bIdx++) {
        const currentBatch = batches[bIdx];
        try {
          console.log(`[Generation] Executing batch ${bIdx + 1}/${batches.length} (${currentBatch.map(t => t.lesson).join(', ')})...`);
          const batchQuestions = await generateForBatch(currentBatch);
          if (Array.isArray(batchQuestions) && batchQuestions.length > 0) {
            rawCollectedQuestions.push(...batchQuestions);
            console.log(`[Generation] Batch ${bIdx + 1} succeeded: got ${batchQuestions.length} questions.`);
          }
        } catch (batchErr: any) {
          lastBatchError = batchErr;
          console.error(`[Generation] Batch ${bIdx + 1} failed:`, batchErr?.message || batchErr);
        }

        // Inter-batch pause to respect RPM quota windows
        if (bIdx < batches.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1200));
        }
      }

      if (rawCollectedQuestions.length === 0) {
        if (lastBatchError) {
          throw lastBatchError;
        }
        throw new Error("تعذر استخراج وتوليد الأسئلة من الملف. قد يكون المستند بحاجة إلى صياغة أو تقليل عدد الدروس المختارة.");
      }

      // Ensure all questions have consistent properties, sanitized defaults, and the correct answer is ALWAYS the first option (index 0)
      const sanitizedQuestions = rawCollectedQuestions.map((q: any, idx: number) => {
        const text = typeof q.text === 'string' ? q.text.trim() : (q.question || `سؤال ${idx + 1}`);
        const type = q.type === 'true_false' ? 'true_false' : 'multiple_choice';

        let finalOptions: string[] = [];
        let finalCorrectAnswer = '0';

        if (type === 'true_false') {
          // True/False: Always ['صحيح', 'خطأ'] with varied true or false correct answers
          finalOptions = ['صحيح', 'خطأ'];
          const rawCorrect = String(q.correctAnswer ?? '').toLowerCase().trim();
          if (rawCorrect === 'false' || rawCorrect === '1' || rawCorrect === 'خطأ' || rawCorrect === 'خطا') {
            finalCorrectAnswer = 'false';
          } else {
            finalCorrectAnswer = 'true';
          }
        } else {
          // Multiple Choice: Always ensure 4 options with the correct answer at index 0
          let rawOpts = Array.isArray(q.options) && q.options.length > 0 
            ? q.options.map((opt: any) => String(opt).trim()).filter((o: string) => o.length > 0)
            : ['الخيار الصحيح', 'الخيار الثاني', 'الخيار الثالث', 'الخيار الرابع'];
          
          while (rawOpts.length < 4) {
            rawOpts.push(`الخيار البديل ${rawOpts.length + 1}`);
          }

          // Locate the intended correct answer
          let correctOptionText = '';
          const rawCorrect = String(q.correctAnswer ?? '0').trim();

          if (/^[0-3]$/.test(rawCorrect)) {
            const parsedIdx = parseInt(rawCorrect, 10);
            if (parsedIdx >= 0 && parsedIdx < rawOpts.length) {
              correctOptionText = rawOpts[parsedIdx];
            }
          } else {
            // Check if string matches any option text
            const matchIdx = rawOpts.findIndex((o: string) => o.toLowerCase() === rawCorrect.toLowerCase());
            if (matchIdx !== -1) {
              correctOptionText = rawOpts[matchIdx];
            }
          }

          if (!correctOptionText) {
            correctOptionText = rawOpts[0];
          }

          // Filter out the correct option to get the 3 distractor choices
          const distractors = rawOpts.filter((o: string) => o !== correctOptionText);
          while (distractors.length < 3) {
            distractors.push(`خيار إضافي ${distractors.length + 1}`);
          }

          finalOptions = [correctOptionText, distractors[0], distractors[1], distractors[2]];
          finalCorrectAnswer = '0';
        }

        const points = typeof q.points === 'number' ? q.points : 1;
        const stage = typeof q.stage === 'string' && q.stage.trim() ? q.stage.trim() : (stageOverride || 'المرحلة الثانوية');
        const grade = typeof q.grade === 'string' && q.grade.trim() ? q.grade.trim() : (gradeOverride || 'الصف الأول');
        const semester = typeof q.semester === 'string' && q.semester.trim() ? q.semester.trim() : (semesterOverride || 'الفصل الدراسي الأول');
        const subject = typeof q.subject === 'string' && q.subject.trim() ? q.subject.trim() : (subjectOverride || 'المادة العامة');
        const unit = typeof q.unit === 'string' && q.unit.trim() ? q.unit.trim() : (unitOverride || 'الوحدة الأولى');
        const lesson = typeof q.lesson === 'string' && q.lesson.trim() ? q.lesson.trim() : (lessonOverride || 'الدرس الأول');

        return {
          text,
          type,
          options: finalOptions,
          correctAnswer: finalCorrectAnswer,
          points,
          stage,
          grade,
          semester,
          subject,
          unit,
          lesson
        };
      });

      return res.json({ success: true, questions: sanitizedQuestions });
    } catch (error: any) {
      console.error("Error processing file in Gemini:", error);
      return res.status(500).json({ error: error.message || "فشل معالجة واستخراج الأسئلة من الملف المرفق عبر الذكاء الاصطناعي." });
    }
  });

  // AI Question Hint & Smart Guidance Generator
  app.post("/api/generate-question-hint", async (req, res) => {
    try {
      const { questionText, options, correctAnswer, subject, unit, lesson } = req.body;

      if (!questionText) {
        return res.status(400).json({ error: "Missing question text" });
      }

      const ai = getGeminiClient();

      const optionsStr = Array.isArray(options) && options.length > 0
        ? options.map((opt: string, idx: number) => `(${idx + 1}) ${opt}`).join(" - ")
        : "";

      const prompt = `أنت معلم خبير وموجه تربوي ذكي وودود.
المطلوب: قدم للطالب إرشاداً تربوياً وتلميحاً ذكياً لمساعدته على حل هذا السؤال بنفسه وفهم فكرته دون إعطائه الإجابة الصريحة بشكل مباشر:
- السؤال: "${questionText}"
${optionsStr ? `- الخيارات: ${optionsStr}` : ""}
${correctAnswer ? `- الإجابة الصحيحة: "${correctAnswer}"` : ""}
- المادة / الدرس: ${subject || ""} / ${lesson || ""}

يرجى صياغة الإرشاد بدقة في 3 نقاط واضحة باللغة العربية:
💡 **فكرة السؤال:** (توضيح المفهوم الأساسي أو القاعدة التي يدور حولها السؤال بشكل مبسط)
🔍 **تلميح ذكي:** (توجيه تفكير الطالب لكيفية تحليل السؤال واستبعاد الخيارات الخاطئة أو ربط المعطيات)
🌟 **تشجيع:** (عبارة تحفيزية إيجابية قصيرة تدعم ثقة الطالب بنفسه)

الشروط:
- لا تذكر الإجابة الصحيحة صراحة، بل وجه الطالب للوصول إليها بنفسه.
- أسلوب تربوي ومحفز ومناسب للطلاب.`;

      let hintText = "";
      try {
        const response = await generateGeminiContentWithRetry(ai, {
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            systemInstruction: "أنت موجه تعليمي خبير يقدم إرشادات وتلميحات تربوية ذكية ومحفزة لمساعدة الطلاب على الفهم والحل الذاتي.",
            temperature: 0.7,
            maxOutputTokens: 800,
          }
        });

        if (response?.text) {
          hintText = response.text.trim();
        }
      } catch (hErr: any) {
        console.warn("Hint generation error with Gemini:", hErr?.message || hErr);
      }

      if (!hintText) {
        const lessonInfo = lesson ? ` في درس (${lesson})` : (subject ? ` في مادة (${subject})` : "");
        hintText = `💡 **فكرة السؤال:** يدور هذا السؤال حول المفاهيم الأساسية${lessonInfo}. ركز على قراءة السؤال بعناية لفهم المطلوب بدقة.\n🔍 **تلميح ذكي:** حلل الكلمات المفتاحية واستبعد الخيارات غير المتوافقة مع منطق السؤال للوصول للإجابة الصحيحة.\n🌟 **تشجيع:** ثق بقدراتك وركز خطوة بخطوة وستصل للحل الصحيح!`;
      }

      return res.json({ success: true, hint: hintText });
    } catch (error: any) {
      console.error("Error generating question hint:", error);
      const reqSubject = req.body?.subject || "";
      const reqLesson = req.body?.lesson || "";
      const contextText = reqLesson ? ` في درس (${reqLesson})` : (reqSubject ? ` في مادة (${reqSubject})` : "");
      return res.json({
        success: true,
        hint: `💡 **فكرة السؤال:** تذكر القواعد والمفاهيم الأساسية${contextText}.\n🔍 **تلميح ذكي:** اربط بين معطيات السؤال والخيارات المتاحة لاختيار الإجابة الأكثر دقة.\n🌟 **تشجيع:** استعن بالله وركز وستجيب بشكل صحيح بإذن الله!`
      });
    }
  });

  // Secure Student Quiz Fetching Endpoint (Server-Side Answer Stripping)
  app.get("/api/student/get-quiz/:id", async (req, res) => {
    try {
      const quizId = req.params.id;
      if (!quizId) {
        return res.status(400).json({ error: "معرّف الاختبار مفقود" });
      }

      const firestoreDb = getServerDb();
      if (!firestoreDb) {
        return res.status(500).json({ error: "قاعدة البيانات غير متصلة بالخادم" });
      }

      const quizDoc = await getDoc(doc(firestoreDb, "quizzes", quizId));
      if (!quizDoc.exists()) {
        return res.status(404).json({ error: "لم يتم العثور على الاختبار المطلوب" });
      }

      const quizData = quizDoc.data() as any;

      // Check availability scheduling
      const now = Date.now();
      if (quizData.status === "closed") {
        return res.status(403).json({ error: "عفواً، هذا الاختبار مغلق حالياً من قبل المعلم." });
      }
      if (quizData.availabilityStart) {
        const startTime = new Date(quizData.availabilityStart).getTime();
        if (!isNaN(startTime) && now < startTime) {
          const formattedStart = new Date(quizData.availabilityStart).toLocaleString("ar-SA", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return res.status(403).json({ error: `الاختبار مجدول وسيكون متاحاً للطلاب بدءاً من: ${formattedStart}` });
        }
      }
      if (quizData.availabilityEnd) {
        const endTime = new Date(quizData.availabilityEnd).getTime();
        if (!isNaN(endTime) && now > endTime) {
          const formattedEnd = new Date(quizData.availabilityEnd).toLocaleString("ar-SA", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return res.status(403).json({ error: `عفواً، انتهت فترة إتاحة هذا الاختبار في تاريخ: ${formattedEnd}` });
        }
      }

      // Strip correctAnswer from questions before sending to student client
      const sanitizedQuestions = (quizData.questions || []).map((q: any) => {
        const { correctAnswer, ...safeQuestion } = q;
        return safeQuestion;
      });

      const sanitizedQuiz = {
        ...quizData,
        id: quizDoc.id,
        questions: sanitizedQuestions,
      };

      return res.json({ success: true, quiz: sanitizedQuiz });
    } catch (error: any) {
      console.error("Error in /api/student/get-quiz:", error);
      return res.status(500).json({ error: "فشل جلب بيانات الاختبار بشكل آمن من الخادم" });
    }
  });

  // Secure Student Quiz Submission & Evaluation Endpoint
  app.post("/api/student/submit-quiz", async (req, res) => {
    try {
      const { quizId, answers, studentInfo } = req.body;
      if (!quizId || !answers || !studentInfo) {
        return res.status(400).json({ error: "بيانات تسليم الاختبار غير مكتملة" });
      }

      const firestoreDb = getServerDb();
      if (!firestoreDb) {
        return res.status(500).json({ error: "قاعدة البيانات غير متصلة بالخادم" });
      }

      const quizDoc = await getDoc(doc(firestoreDb, "quizzes", quizId));
      if (!quizDoc.exists()) {
        return res.status(404).json({ error: "لم يتم العثور على الاختبار المطلوب للتقييم" });
      }

      const quizData = quizDoc.data() as any;

      // Check availability on submission
      const now = Date.now();
      if (quizData.status === "closed") {
        return res.status(403).json({ error: "عفواً، هذا الاختبار مغلق حالياً من قبل المعلم ولا يمكن قبول الإجابات." });
      }
      if (quizData.availabilityEnd) {
        const endTime = new Date(quizData.availabilityEnd).getTime();
        if (!isNaN(endTime) && now > endTime) {
          const formattedEnd = new Date(quizData.availabilityEnd).toLocaleString("ar-SA", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          return res.status(403).json({ error: `عفواً، انتهت فترة إتاحة هذا الاختبار في تاريخ (${formattedEnd}) ولا يمكن تسليم الإجابات الآن.` });
        }
      }

      const questions: any[] = quizData.questions || [];

      let earnedPoints = 0;
      let totalPoints = 0;
      const detailedQuestionResults: any[] = [];

      questions.forEach((q: any) => {
        const qPoints = typeof q.points === "number" ? q.points : 1;
        totalPoints += qPoints;
        const studentAns = answers[q.id];
        const isCorrect = studentAns !== undefined && String(studentAns).trim() === String(q.correctAnswer).trim();

        if (isCorrect) {
          earnedPoints += qPoints;
        }

        detailedQuestionResults.push({
          questionId: q.id,
          text: q.text,
          type: q.type,
          options: q.options,
          points: qPoints,
          isCorrect,
          studentAnswer: studentAns ?? null,
          correctAnswer: quizData.showResultToStudent !== false ? q.correctAnswer : undefined,
        });
      });

      const pct = Math.round((earnedPoints / (totalPoints || 1)) * 100);
      const passed = pct >= 60;

      const gRecord = {
        quizTitle: quizData.title || "اختبار مدرسي",
        score: earnedPoints,
        maxScore: totalPoints,
        date: new Date().toISOString().split("T")[0],
        passed,
      };

      const targetStudentId = studentInfo.studentId || `s-${Date.now()}`;
      const teacherUid = quizData.teacherId || "";

      // Store in standalone_results if quiz is marked standalone or submission is standalone
      if (quizData.isStandalone || studentInfo.isStandalone) {
        const submissionId = `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const standaloneDoc = {
          id: submissionId,
          quizId: quizId,
          quizTitle: quizData.title || "اختبار برابط مستقل",
          studentName: studentInfo.name || "طالب زائر",
          gradeClass: studentInfo.gradeClass || studentInfo.grade || "عام",
          score: earnedPoints,
          maxScore: totalPoints,
          percentage: pct,
          passed,
          submittedAt: new Date().toISOString(),
          teacherId: teacherUid,
          answers: answers,
          detailedQuestionResults: detailedQuestionResults
        };
        await setDoc(doc(firestoreDb, "standalone_results", submissionId), standaloneDoc);
      }

      if (studentInfo.isNewStudent || !studentInfo.studentId) {
        const newStudentObj = {
          id: targetStudentId,
          name: studentInfo.name,
          gradeClass: studentInfo.gradeClass || `${studentInfo.grade || ""} - ${studentInfo.semester || ""}`,
          grade: studentInfo.grade || "",
          semester: studentInfo.semester || "",
          email: studentInfo.email || `${Date.now()}@student.edu`,
          averageScore: pct,
          status: pct >= 90 ? "excellent" : pct >= 75 ? "good" : pct >= 60 ? "average" : "needs_improvement",
          detailedGrades: [gRecord],
          teacherId: teacherUid,
        };

        await setDoc(doc(firestoreDb, "students", targetStudentId), newStudentObj);
      } else {
        const studentDocRef = doc(firestoreDb, "students", targetStudentId);
        const sDoc = await getDoc(studentDocRef);
        if (sDoc.exists()) {
          const sData = sDoc.data() as any;
          const updatedGrades = [...(sData.detailedGrades || []), gRecord];
          let sumEarned = 0;
          let sumMax = 0;
          updatedGrades.forEach((g: any) => {
            sumEarned += g.score || 0;
            sumMax += g.maxScore || 0;
          });
          const newAvg = Math.round((sumEarned / (sumMax || 1)) * 100);
          const newStatus = newAvg >= 90 ? "excellent" : newAvg >= 75 ? "good" : newAvg >= 60 ? "average" : "needs_improvement";

          await updateDoc(studentDocRef, {
            detailedGrades: updatedGrades,
            averageScore: newAvg,
            status: newStatus,
          });
        }
      }

      return res.json({
        success: true,
        score: earnedPoints,
        totalPoints,
        percentage: pct,
        passed,
        targetStudentId,
        detailedQuestionResults: quizData.showResultToStudent !== false ? detailedQuestionResults : [],
      });
    } catch (error: any) {
      console.error("Error in /api/student/submit-quiz:", error);
      return res.status(500).json({ error: "فشل تسليم وتقييم الاختبار في الخادم" });
    }
  });

  // Vite middleware for development or SPA server for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
