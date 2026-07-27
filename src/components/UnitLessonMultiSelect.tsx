import React, { useState, useRef, useEffect } from "react";
import { Folder, ChevronDown, ChevronUp, Check, X } from "lucide-react";

const parseArabicOrdinal = (text: string): number => {
  const digitMatch = text.match(/\d+/);
  if (digitMatch) {
    return parseInt(digitMatch[0], 10);
  }

  const ordinals: { [key: string]: number } = {
    "الأولى": 1,
    "الأول": 1,
    "الثانية": 2,
    "الثاني": 2,
    "الثالثة": 3,
    "الثالث": 3,
    "الرابعة": 4,
    "الرابع": 4,
    "الخامسة": 5,
    "الخامس": 5,
    "السادسة": 6,
    "السادس": 6,
    "السابعة": 7,
    "السابع": 7,
    "الثامنة": 8,
    "الثامن": 8,
    "التاسعة": 9,
    "التاسع": 9,
    "العاشرة": 10,
    "العاشر": 10,
    "الحادي عشر": 11,
    "الثاني عشر": 12,
    "الثالث عشر": 13,
    "الرابع عشر": 14,
    "الخامس عشر": 15,
    "السادس عشر": 16,
    "السابع عشر": 17,
    "الثامن عشر": 18,
    "التاسع عشر": 19,
    "العشرون": 20,
    "العشرين": 20,
  };

  for (const [key, val] of Object.entries(ordinals)) {
    if (text.includes(key)) {
      return val;
    }
  }

  return 999;
};

const arabicSort = (a: string, b: string) => {
  const scoreA = parseArabicOrdinal(a);
  const scoreB = parseArabicOrdinal(b);
  if (scoreA !== scoreB) {
    return scoreA - scoreB;
  }
  return a.localeCompare(b, "ar");
};

const COLOR_SCHEMES = [
  {
    bg: "bg-blue-50/90 border-blue-200 text-blue-900 hover:bg-blue-100/85",
    btn: "text-blue-600 hover:text-blue-950 hover:bg-blue-200/50",
  },
  {
    bg: "bg-emerald-50/90 border-emerald-200 text-emerald-900 hover:bg-emerald-100/85",
    btn: "text-emerald-600 hover:text-emerald-950 hover:bg-emerald-200/50",
  },
  {
    bg: "bg-amber-50/90 border-amber-200 text-amber-900 hover:bg-amber-100/85",
    btn: "text-amber-600 hover:text-amber-950 hover:bg-amber-200/50",
  },
  {
    bg: "bg-rose-50/90 border-rose-200 text-rose-900 hover:bg-rose-100/85",
    btn: "text-rose-600 hover:text-rose-950 hover:bg-rose-200/50",
  },
  {
    bg: "bg-violet-50/90 border-violet-200 text-violet-900 hover:bg-violet-100/85",
    btn: "text-violet-600 hover:text-violet-950 hover:bg-violet-200/50",
  },
  {
    bg: "bg-teal-50/90 border-teal-200 text-teal-900 hover:bg-teal-100/85",
    btn: "text-teal-600 hover:text-teal-950 hover:bg-teal-200/50",
  },
  {
    bg: "bg-sky-50/90 border-sky-200 text-sky-900 hover:bg-sky-100/85",
    btn: "text-sky-600 hover:text-sky-950 hover:bg-sky-200/50",
  },
  {
    bg: "bg-fuchsia-50/90 border-fuchsia-200 text-fuchsia-900 hover:bg-fuchsia-100/85",
    btn: "text-fuchsia-600 hover:text-fuchsia-950 hover:bg-fuchsia-200/50",
  }
];

const getUnitColorScheme = (unitName: string, allUnits: string[]) => {
  const index = allUnits.indexOf(unitName);
  if (index === -1) {
    let hash = 0;
    for (let i = 0; i < unitName.length; i++) {
      hash = unitName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % COLOR_SCHEMES.length;
    return COLOR_SCHEMES[idx];
  }
  return COLOR_SCHEMES[index % COLOR_SCHEMES.length];
};

interface UnitLessonMultiSelectProps {
  // Array of questions from which we extract Units and Lessons
  questions: { unit: string; lesson: string }[];
  // Selected values: list of "unit | lesson"
  selected: string[];
  onChange: (selected: string[]) => void;
  stepActive?: boolean;
  stepCompleted?: boolean;
  stepDisabled?: boolean;
}

export const UnitLessonMultiSelect: React.FC<UnitLessonMultiSelectProps> = ({
  questions,
  selected,
  onChange,
  stepActive,
  stepCompleted,
  stepDisabled,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Extract units and their lessons dynamically
  const getUnitsAndLessons = () => {
    const map = new Map<string, Set<string>>();
    questions.forEach((q) => {
      if (q.unit && q.lesson) {
        const u = q.unit.trim();
        const l = q.lesson.trim();
        if (u && l) {
          if (!map.has(u)) {
            map.set(u, new Set());
          }
          map.get(u)!.add(l);
        }
      }
    });

    const result: { unit: string; lessons: string[] }[] = [];
    Array.from(map.keys())
      .sort(arabicSort)
      .forEach((unit) => {
        result.push({
          unit,
          lessons: Array.from(map.get(unit)!).sort(arabicSort),
        });
      });
    return result;
  };

  const unitsAndLessons = getUnitsAndLessons();
  const allUnitNames = unitsAndLessons.map((u) => u.unit);

  const handleToggleLesson = (unit: string, lesson: string) => {
    const val = `${unit} | ${lesson}`;
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const handleToggleUnit = (unit: string, unitLessons: string[]) => {
    const lessonValues = unitLessons.map((l) => `${unit} | ${l}`);
    const allSelected = lessonValues.every((val) => selected.includes(val));

    if (allSelected) {
      // Deselect all lessons in this unit
      onChange(selected.filter((val) => !lessonValues.includes(val)));
    } else {
      // Select all lessons in this unit (avoiding duplicates)
      const newSelected = [...selected];
      lessonValues.forEach((val) => {
        if (!newSelected.includes(val)) {
          newSelected.push(val);
        }
      });
      onChange(newSelected);
    }
  };

  const handleRemovePill = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    onChange(selected.filter((item) => item !== val));
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  return (
    <div className={`relative w-full font-sans transition-all duration-300 ${stepDisabled ? "opacity-60 pointer-events-none" : ""}`} ref={containerRef}>
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm sm:text-base font-black text-slate-700 block flex items-center gap-2">
          <span className={`w-6 h-6 text-xs sm:text-sm rounded-full flex items-center justify-center font-sans font-black transition-all duration-300 ${stepActive ? "bg-indigo-600 text-white ring-4 ring-indigo-100 animate-pulse" : stepCompleted ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}>
            {stepCompleted ? "✓" : "٥"}
          </span>
          <span>الوحدات والدروس الدراسية</span>
        </label>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-extrabold transition-colors"
          >
            إعادة تعيين (الكل)
          </button>
        )}
      </div>

      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[52px] bg-white border-2 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-all duration-300 ${
          isOpen
            ? "border-indigo-600 ring-4 ring-indigo-105 shadow-sm"
            : stepActive
            ? "border-indigo-500 ring-4 ring-indigo-100 shadow-md scale-[1.01]"
            : stepCompleted
            ? "border-emerald-300 bg-emerald-50/5 hover:border-emerald-400"
            : "border-slate-200 hover:border-indigo-300"
        }`}
      >
        {selected.length === 0 ? (
          <span className="text-sm sm:text-base text-slate-400 font-bold select-none">
            الكل (جميع الوحدات والدروس)
          </span>
        ) : (
          <div className="flex flex-wrap gap-2 py-0.5 w-full">
            {[...selected].sort((a, b) => {
              const partsA = a.split(" | ");
              const partsB = b.split(" | ");
              const unitA = partsA[0] || "";
              const unitB = partsB[0] || "";
              const unitSort = arabicSort(unitA, unitB);
              if (unitSort !== 0) return unitSort;
              const lessonA = partsA[1] || "";
              const lessonB = partsB[1] || "";
              return arabicSort(lessonA, lessonB);
            }).map((val) => {
              const parts = val.split(" | ");
              const unitName = parts[0] || "";
              const lesson = parts[1] || val;
              const scheme = getUnitColorScheme(unitName, allUnitNames);
              return (
                <div
                  key={val}
                  className={`inline-flex items-center gap-2 border-2 text-sm sm:text-base font-extrabold px-3.5 py-1.5 rounded-2xl transition-all duration-150 ${scheme.bg}`}
                >
                  <span>{lesson}</span>
                  <button
                    type="button"
                    onClick={(e) => handleRemovePill(e, val)}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-150 ${scheme.btn}`}
                  >
                    <X className="w-3.5 h-3.5 stroke-[3]" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="text-slate-400 flex-shrink-0 mr-1">
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-[110] mt-1.5 w-full bg-white border border-slate-200/95 rounded-2xl shadow-xl max-h-[350px] overflow-y-auto py-1 animate-fadeIn">
          {unitsAndLessons.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400 font-semibold select-none">
              لا توجد وحدات أو دروس مطابقة للتصفية الحالية
            </div>
          ) : (
            unitsAndLessons.map(({ unit, lessons }) => {
              const unitValues = lessons.map((l) => `${unit} | ${l}`);
              const allSelected = unitValues.every((val) => selected.includes(val));
              const isUnitExpanded = !!expandedUnits[unit];

              return (
                <div key={unit} className="mb-1">
                  {/* Unit Folder Header */}
                  <div
                    onClick={() =>
                      setExpandedUnits((prev) => ({
                        ...prev,
                        [unit]: !prev[unit],
                      }))
                    }
                    className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 hover:bg-slate-100/90 border-y border-slate-100 text-xs sm:text-sm font-bold text-slate-700 cursor-pointer select-none transition-colors duration-150"
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                          isUnitExpanded ? "rotate-180" : ""
                        }`}
                      />
                      <span className="text-amber-500 text-base">📁</span>
                      <span>{unit}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleUnit(unit, lessons);
                      }}
                      className="flex items-center gap-1 text-[11px] text-indigo-600 font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-200/80 hover:bg-indigo-50/40 transition-colors"
                    >
                      <span>{allSelected ? "إلغاء الكل" : "تحديد الكل"}</span>
                    </button>
                  </div>

                  {/* Lessons List (Collapsed by default) */}
                  {isUnitExpanded && (
                    <div className="divide-y divide-slate-50">
                      {lessons.map((lesson) => {
                        const lessonVal = `${unit} | ${lesson}`;
                        const isSel = selected.includes(lessonVal);
                        return (
                          <div
                            key={lesson}
                            onClick={() => handleToggleLesson(unit, lesson)}
                            className={`flex items-center gap-3 px-8 py-3 text-xs sm:text-sm text-slate-600 cursor-pointer select-none transition-colors duration-150 ${
                              isSel
                                ? "bg-indigo-50/25 text-indigo-700 font-semibold"
                                : "hover:bg-slate-50/60"
                            }`}
                          >
                            <div
                              className={`w-4.5 h-4.5 rounded border flex items-center justify-center transition-all duration-150 ${
                                isSel
                                  ? "bg-indigo-600 border-indigo-600 text-white"
                                  : "border-slate-300 bg-white hover:border-slate-400"
                              }`}
                            >
                              {isSel && <Check className="w-3 h-3 stroke-[3.5px]" />}
                            </div>
                            <span>{lesson}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
