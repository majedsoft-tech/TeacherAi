import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

dotenv.config();

// Ensure Gemini Client is initialized lazy/safely
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
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

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

async function startServer() {
  // Increase body limit to handle large PDFs
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Server API Routes
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
        lessonOverride
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

      let overridesInstruction = "";
      if (stageOverride && stageOverride !== "auto") {
        overridesInstruction += `\n- حقل المرحلة الدراسية (stage) يجب أن يكون دائماً القيمة النصية: "${stageOverride}" لجميع الأسئلة المولدة.`;
      }
      if (gradeOverride && gradeOverride !== "auto") {
        overridesInstruction += `\n- حقل الصف الدراسي (grade) يجب أن يكون دائماً القيمة النصية: "${gradeOverride}" لجميع الأسئلة المولدة.`;
      }
      if (semesterOverride && semesterOverride !== "auto") {
        overridesInstruction += `\n- حقل الفصل الدراسي (semester) يجب أن يكون دائماً القيمة النصية: "${semesterOverride}" لجميع الأسئلة المولدة.`;
      }
      if (subjectOverride && subjectOverride !== "auto") {
        overridesInstruction += `\n- حقل المادة الدراسية (subject) يجب أن يكون دائماً القيمة النصية: "${subjectOverride}" لجميع الأسئلة المولدة.`;
      }
      if (unitOverride && unitOverride.trim() !== "") {
        overridesInstruction += `\n- حقل الوحدة الدراسية (unit) يجب أن يكون دائماً القيمة النصية: "${unitOverride.trim()}" لجميع الأسئلة المولدة.`;
      }
      if (lessonOverride && lessonOverride.trim() !== "") {
        overridesInstruction += `\n- حقل الدرس (lesson) يجب أن يكون دائماً القيمة النصية: "${lessonOverride.trim()}" لجميع الأسئلة المولدة.`;
      }

      const systemInstruction = `
أنت خبير تعليمي ومصمم اختبارات ذكي للمناهج العربية والخليجية. مهمتك هي قراءة غلاف ومحتوى الملف المرفق بدقة (سواء كان ملف PDF أو Word أو Excel)، وفهم المواضيع الأكاديمية والدروس وتفاصيل المنهج المدرسي فيه.
ثم، قم بصياغة وطرح مجموعة من الأسئلة المتنوعة والممتازة لتضاف إلى "بنك الأسئلة" الخاص بالمعلم.

يجب صياغة الأسئلة باللغة العربية الفصحى السليمة وتصنيفها بدقة تامة.
تأكد من استخراج الأسئلة وتعبئة الحقول التالية لكل سؤال بدقة وبشكل يتلاءم تماماً مع محتوى الملف المرفق:
1. text: نص السؤال المفصل بوضوح تام، وبدون اختصارات.
2. type: يجب تحديد نوع السؤال المناسب: إما "multiple_choice" (اختيار من متعدد بـ 4 خيارات) أو "true_false" (سؤال صواب وخطأ).
3. options: الخيارات المتاحة كقائمة نصوص:
   - في حال كان اختيار من متعدد (multiple_choice): يجب أن تحتوي القائمة على 4 خيارات واضحة للمقارنة والحل وتكون فريدة ومقنعة وصحيحة لغوياً.
   - في حال كان صواب أو خطأ (true_false): يجب أن تكون القائمة ["صحيح", "خطأ"] تماماً وبنفس الترتيب.
4. correctAnswer: الإجابة النموذجية الصحيحة:
   - لأسئلة الاختيار من متعدد: الرقم التسلسلي التعريفي للترتيب من صفر (أي "0" للخيار الأول، "1" للثاني، "2" للثالث، "3" للرابع).
   - لأسئلة الصواب والخطأ: السلسلة النصية "true" إذا كانت الإجابة صحيح، أو "false" إذا كانت خطأ.
5. points: الدرجة المستحقة أو النقاط المقدرة (يجب أن تكون دائماً نقطة واحدة: 1).
6. stage: المرحلة الدراسية المستنتجة أو المحددة من الملف بشكل صحيح (يجب الاختيار من التسميات التالية حصراً: "المرحلة الابتدائية" أو "المرحلة المتوسطة" أو "المرحلة الثانوية").
7. grade: الصف الدراسي بدقة (مثل: "الصف العاشر", "الصف الثالث متوسط", "الصف الخامس الابتدائي"، إلخ).
8. semester: الفصل الدراسي المستنتج من البيانات أو افتراض التخمين الأكثر شيوعاً وتكاملاً (يجب الاختيار من التسميات التالية حصراً: "الفصل الدراسي الأول" أو "الفصل الدراسي الثاني" أو "الفصل الدراسي الثالث").
9. subject: اسم المادة الدراسية بدقة (مثل: "التقنية الرقمية", "العلوم الطبيعية", "الرياضيات المتقدمة", "اللغة العربية ولغة الضاد", "الاجتماعيات والتربية الوطنية"، إلخ).
10. unit: اسم الوحدة الدراسية المقابلة محلياً في الكتاب (مثل: "الوحدة الأولى: علم الحاسوب ورؤية البيانات").
11. lesson: اسم ومحل الدرس التفصيلي (مثل: "الدرس الأول: البيانات والمعلومات والاتصال السحابي").

${overridesInstruction ? `تنبيه هام جداً بخصوص قيم التصنيفات الثابتة التي يجب استخدامها:\n${overridesInstruction}\nيرجى تعبئة الحقول المذكورة حرفياً بالقيم المحددة أعلاه لجميع الأسئلة المنتجة دون أي تغيير أو تخمين أو استنتاج بديل.` : ""}

يجب أن تعود النتيجة بتنسيق صفيف JSON متناسق ومدعوم مباشرة بالبرنامج.
`;

      const parsedMcqCount = typeof mcqCount === 'number' ? mcqCount : 3;
      const parsedTfCount = typeof tfCount === 'number' ? tfCount : 2;

      let promptText = "";
      let contentsParts: any[] = [];

      if (isOfficeDoc) {
        promptText = `هنا المحتوى النصي الكامل للمستند المرفق (ملف Word أو Excel) والذي يجب عليك قراءته وفهمه بدقة عالية:\n\n--- بداية المحتوى ---\n${extractedText}\n--- نهاية المحتوى ---\n\nالرجاء استخراج وتوليد عدد ${parsedMcqCount} أسئلة من نوع "multiple_choice" (اختيار من متعدد بـ 4 خيارات) وعدد ${parsedTfCount} أسئلة من نوع "true_false" (صواب وخطأ) من هذا المستند بالتفصيل وبشكل منسق ومميز متطابق مع محتواه. يرجى التركيز التام وتوليد التعداد والنوع بدقة متناهية. ${customPrompt || ""}`;
        contentsParts = [{ text: promptText }];
      } else {
        promptText = `الرجاء استخراج وتوليد عدد ${parsedMcqCount} أسئلة من نوع "multiple_choice" (اختيار من متعدد بـ 4 خيارات) وعدد ${parsedTfCount} أسئلة من نوع "true_false" (صواب وخطأ) من هذا الملف بالتفصيل وبشكل منسق ومميز متطابق مع محتوى الملف المرفق. يرجى التركيز التام وتوليد التعداد والنوع بدقة متناهية. ${customPrompt || ""}`;
        contentsParts = [
          filePart,
          { text: promptText }
        ];
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: {
          parts: contentsParts
        },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING, description: "نص السؤال" },
                type: { type: Type.STRING, description: "نوع السؤال: multiple_choice أو true_false" },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "الخيارات المتاحة"
                },
                correctAnswer: { type: Type.STRING, description: "الإجابة الصحيحة: 0 أو 1 أو 2 أو 3 للخيارات، أو true أو false للصواب والخطأ" },
                points: { type: Type.INTEGER, description: "النقاط" },
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
          }
        }
      });

      const questionsText = response.text;
      if (!questionsText) {
        throw new Error("Failed to generate content from Gemini API.");
      }

      const parsedQuestions = JSON.parse(questionsText.trim());
      return res.json({ success: true, questions: parsedQuestions });
    } catch (error: any) {
      console.error("Error processing file in Gemini:", error);
      return res.status(500).json({ error: error.message || "فشل معالجة واستخراج الأسئلة من الملف المرفق عبر الذكاء الاصطناعي." });
    }
  });

  // AI Question Hint Generator
  app.post("/api/generate-question-hint", async (req, res) => {
    try {
      const { questionText, options, subject, unit, lesson } = req.body;

      if (!questionText) {
        return res.status(400).json({ error: "Missing question text" });
      }

      const ai = getGeminiClient();

      const optionsStr = Array.isArray(options) && options.length > 0
        ? options.map((opt: string, idx: number) => `  ${idx + 1}. ${opt}`).join("\n")
        : "";

      const prompt = `أنت معلم خبير وموجه تربوي ذكي وداعم للطلاب.
أمامك السؤال التالي الذي يقوم الطالب بحله الآن:
- المادة الدراسية: ${subject || "غير محدد"}
- الوحدة / الدرس: ${unit || ""} / ${lesson || ""}
- نص السؤال: "${questionText}"
${optionsStr ? `- الخيارات المتاحة:\n${optionsStr}` : ""}

المطلوب:
اكتب تلميحاً وإرشاداً تربوياً ذكياً ومبسطاً للغاية يساعد الطالب على التفكير الصحيح وفهم فكرة السؤال وتوجيهه للحل، دون إعطائه الإجابة المباشرة أو الحل الجاهز بشكل صريح.
اجعل الأسلوب مشجعاً ومحفزاً باللغة العربية الفصحى البسيطة في 2 إلى 3 جمل قصيرة وواضحة.`;

      const candidateModels = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
      let hintText = "";

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: "أنت موجه تعليمي افتراضي ذكي يشجع الطلاب ويساعدهم بأسلوب تربوي مبسط ومحفز دون كشف الإجابة المباشرة.",
              temperature: 0.7,
            }
          });

          if (response.text) {
            hintText = response.text.trim();
            break;
          }
        } catch (mErr: any) {
          console.warn(`Attempt with ${modelName} failed/quota exceeded, trying next candidate if available:`, mErr?.message || mErr);
        }
      }

      if (!hintText) {
        hintText = "فكر في المفهوم الأساسي للسؤال وتذكر القواعد والتعاريف الأساسية التي درستها في هذا الدرس.";
      }

      return res.json({ success: true, hint: hintText });
    } catch (error: any) {
      console.error("Error generating question hint:", error);
      return res.json({
        success: true,
        hint: "تذكر القواعد والتعاريف الأساسية في هذا الدرس وحاول تحليل المعطيات للوصول للحل الصحيح."
      });
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
