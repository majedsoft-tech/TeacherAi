import { GoogleGenAI } from "@google/genai";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};

export default async function handler(req: any, res: any) {
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
    const { pdfBase64, mimeType } = req.body || {};

    if (!pdfBase64) {
      return res.status(400).json({ error: "البيانات المرفقة للملف مفقودة، يرجى إعادة رفع الملف." });
    }

    const apiKey = process.env.GEMINI_API_KEY || 
                   process.env.API_KEY || 
                   process.env.GOOGLE_API_KEY || 
                   process.env.GOOGLE_GENAI_API_KEY || 
                   process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY غير معرف في إعدادات البيئة (Environment Variables)" });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

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
          console.error("Error parsing Word doc:", err);
          return res.status(400).json({ error: `فشل في قراءة ملف Word: ${err.message || err}` });
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
          console.error("Error parsing Excel:", err);
          return res.status(400).json({ error: `فشل في قراءة ملف Excel: ${err.message || err}` });
        }
      }
    }

    const prompt = `حلل هذا الملف واستخرج هيكل الكتاب والوحدات والدروس بدقة باللغة العربية بصيغة JSON.`;

    const contents: any[] = [];
    if (isOfficeDoc) {
      contents.push(prompt + `\n\nنص المستند المرفق:\n${extractedText.slice(0, 100000)}`);
    } else {
      contents.push(
        {
          inlineData: {
            mimeType: fileMimeType,
            data: pdfBase64,
          }
        },
        prompt
      );
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: "أنت خبير تربوي متخصص في تحليل الكتب والمناهج. أخرج النتائج فقط كـ JSON صالح.",
        responseMimeType: "application/json",
      }
    });

    return res.status(200).json({
      success: true,
      rawResponse: response?.text || "{}"
    });
  } catch (error: any) {
    console.error("Error extracting book structure in Vercel:", error);
    return res.status(500).json({ error: error.message || "حدث خطأ أثناء فحص وتحليل الكتاب" });
  }
}
