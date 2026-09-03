import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { questionText, options, correctAnswer, subject, unit, lesson } = req.body || {};

    if (!questionText) {
      return res.status(400).json({ error: "Missing question text" });
    }

    const apiKey = process.env.GEMINI_API_KEY || 
                   process.env.API_KEY || 
                   process.env.GOOGLE_API_KEY || 
                   process.env.GOOGLE_GENAI_API_KEY || 
                   process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("No Gemini API key found in Vercel environment variables");
      // Fallback with rich context
      const lessonInfo = lesson ? ` في درس (${lesson})` : (subject ? ` في مادة (${subject})` : "");
      return res.status(200).json({
        success: true,
        hint: `💡 **فكرة السؤال:** يدور هذا السؤال حول المفاهيم الأساسية${lessonInfo}.\n🔍 **تلميح ذكي:** حلل الكلمات المفتاحية في نص السؤال وقارن بين الخيارات المطروحة لاستبعاد الخيارات غير المنطقية.\n🌟 **تشجيع:** ركز وستصل للإجابة الصحيحة بكل سهولة!`
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

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

    const candidateModels = [
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
      "gemini-flash-latest"
    ];

    let hintText = "";
    for (const model of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: "أنت موجه تعليمي خبير يقدم إرشادات وتلميحات تربوية ذكية ومحفزة لمساعدة الطلاب على الفهم والحل الذاتي.",
            temperature: 0.7,
            maxOutputTokens: 800,
          }
        });

        if (response?.text) {
          hintText = response.text.trim();
          break;
        }
      } catch (err: any) {
        console.warn(`Model ${model} failed in Vercel function:`, err?.message || err);
      }
    }

    if (!hintText) {
      const lessonInfo = lesson ? ` في درس (${lesson})` : (subject ? ` في مادة (${subject})` : "");
      hintText = `💡 **فكرة السؤال:** يدور هذا السؤال حول المفاهيم الأساسية${lessonInfo}.\n🔍 **تلميح ذكي:** حلل الكلمات المفتاحية في نص السؤال وقارن بين الخيارات للوصول للإجابة الصحيحة.\n🌟 **تشجيع:** ثق بقدراتك وأنت قادر على الحل الصحيح!`;
    }

    return res.status(200).json({ success: true, hint: hintText });
  } catch (error: any) {
    console.error("Error in serverless generate-question-hint:", error);
    const reqSubject = req.body?.subject || "";
    const reqLesson = req.body?.lesson || "";
    const contextText = reqLesson ? ` في درس (${reqLesson})` : (reqSubject ? ` في مادة (${reqSubject})` : "");
    return res.status(200).json({
      success: true,
      hint: `💡 **فكرة السؤال:** تذكر القواعد والمفاهيم الأساسية${contextText}.\n🔍 **تلميح ذكي:** اربط بين معطيات السؤال والخيارات المتاحة لاختيار الإجابة الأكثر دقة.\n🌟 **تشجيع:** استعن بالله وركز وستجيب بشكل صحيح بإذن الله!`
    });
  }
}
