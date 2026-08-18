import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Uncaught error inside React Tree:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            boxSizing: "border-box",
            zIndex: 9999999,
            fontFamily: "'Cairo', system-ui, sans-serif",
            direction: "rtl",
          }}
        >
          <div 
            style={{
              backgroundColor: "white",
              maxWidth: "550px",
              width: "100%",
              border: "1px solid #e2e8f0",
              borderRadius: "20px",
              boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.08)",
              padding: "30px",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            <div 
              style={{
                width: "52px",
                height: "52px",
                backgroundColor: "#fef2f2",
                borderRadius: "14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <svg 
                style={{ width: "26px", height: "26px", color: "#ef4444" }} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: "0 0 8px 0" }}>
              حدث خطأ غير متوقع في تطبيق الاختبار
            </h2>
            <p style={{ fontSize: "13px", color: "#64748b", lineHeight: "1.6", margin: "0 0 18px 0" }}>
              نعتذر عن هذا الخلل. لقد رصدنا خطأ داخلياً أثناء تشغيل واجهة الامتحان. يرجى تزويد المعلم بصورة أو تفاصيل الخطأ أدناه لحله.
            </p>

            <div 
              style={{
                backgroundColor: "#f8fafc",
                border: "1px solid rgba(239, 68, 68, 0.15)",
                borderRadius: "12px",
                padding: "12px 14px",
                marginBottom: "20px",
                textAlign: "right",
                boxSizing: "border-box",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 800, color: "#475569", marginBottom: "4px" }}>
                تفاصيل الخطأ الفني (Technical Info):
              </div>
              <div style={{ fontSize: "12px", fontWeight: "bold", color: "#e11d48", fontFamily: "monospace", wordBreak: "break-all" }}>
                {this.state.error && this.state.error.toString()}
              </div>
              {this.state.errorInfo && (
                <div 
                  style={{
                    fontSize: "10px",
                    color: "#94a3b8",
                    marginTop: "6px",
                    fontFamily: "monospace",
                    maxHeight: "100px",
                    overflowY: "auto",
                    whiteSpace: "pre-wrap",
                    direction: "ltr",
                    textAlign: "left",
                    wordBreak: "break-all",
                  }}
                >
                  {this.state.errorInfo.componentStack}
                </div>
              )}
            </div>

            <div style={{ textAlign: "right", fontSize: "12.5px", color: "#334155", lineHeight: "1.6", borderTop: "1px solid #f1f5f9", paddingTop: "16px" }}>
              <strong style={{ color: "#0f172a", display: "block", margin: "0 0 8px 0" }}>
                🛠️ كيفية تجاوز هذه المشكلة:
              </strong>
              <ul style={{ margin: 0, paddingRight: "20px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <li>تأكد من تشغيل الاختبار من خلال جهاز مدعوم بمتصفح حديث ومحدث ومكتمل التكوين.</li>
                <li>تحديث الصفحة بالضغط على زر التحديث بالأسفل أو بالضغط على مفتاح <code style={{ backgroundColor: "#f1f5f9", padding: "1px 5px", borderRadius: "4px" }}>F5</code>.</li>
              </ul>
            </div>

            <button 
              onClick={() => {
                window.location.reload();
              }}
              style={{
                marginTop: "22px",
                width: "100%",
                padding: "12px",
                backgroundColor: "#4f46e5",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontSize: "13px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              إعادة تحميل الصفحة والامتحان ↻
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
