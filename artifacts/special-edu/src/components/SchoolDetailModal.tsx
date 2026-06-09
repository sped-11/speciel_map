import { School } from "@/data/schools";
import { studentData } from "@/data/students";

interface Props {
  school: School;
  onClose: () => void;
}

function gradeOrder(grade: string): number {
  const fixed: Record<string, number> = {
    "0세": 1, "1세": 2, "2세": 3, "3세": 4, "4세": 5, "5세": 6,
    "1학년": 10, "2학년": 11, "3학년": 12,
    "4학년": 13, "5학년": 14, "6학년": 15,
    "초1년": 20, "초2년": 21, "초3년": 22, "초4년": 23, "초5년": 24, "초6년": 25,
    "중1년": 30, "중2년": 31, "중3년": 32,
    "고1년": 40, "고2년": 41, "고3년": 42,
    "전1년": 50, "전2년": 51, "전3년": 52,
  };
  return fixed[grade] ?? 99;
}

function levelLabel(학교급: string): string {
  return {
    유치원: "유치원",
    초등학교: "초등",
    중학교: "중학교",
    고등학교: "고등학교",
    특수학교: "특수학교",
  }[학교급] ?? 학교급;
}

export default function SchoolDetailModal({ school, onClose }: Props) {
  const gradeMap = studentData[school.학교명] ?? {};
  const grades = Object.keys(gradeMap).sort((a, b) => gradeOrder(a) - gradeOrder(b));
  const totalSpecial = Object.values(gradeMap).reduce((s, v) => s + v.특수학급, 0);
  const totalGeneral = Object.values(gradeMap).reduce((s, v) => s + v.일반학급, 0);

  const isSpecialSchool = school.학교급 === "특수학교";

  const badgeColor = school.구 === "동작구" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700";
  const levelColor: Record<string, string> = {
    유치원: "bg-pink-100 text-pink-700",
    초등학교: "bg-orange-100 text-orange-700",
    중학교: "bg-violet-100 text-violet-700",
    고등학교: "bg-indigo-100 text-indigo-700",
    특수학교: "bg-purple-100 text-purple-700",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#1B4FA8] text-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeColor}`}>
                  {school.구}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${levelColor[school.학교급] ?? "bg-gray-100 text-gray-700"}`}>
                  {levelLabel(school.학교급)}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white">
                  {school.설치별}
                </span>
                {school.에듀케어수 > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-300 text-yellow-900 font-semibold">
                    에듀케어
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold">{school.학교명}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white text-xl leading-none shrink-0 mt-0.5"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {isSpecialSchool ? (
          <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
            <div className="flex flex-col items-center py-3 px-2">
              <span className="text-xs text-muted-foreground mb-0.5">총 재학생</span>
              <span className="text-lg font-bold text-purple-700">{totalGeneral}명</span>
            </div>
            <div className="flex flex-col items-center py-3 px-2">
              <span className="text-xs text-muted-foreground mb-0.5">학년 수</span>
              <span className="text-lg font-bold">{grades.length}개</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-4 divide-x divide-border border-b border-border">
            {[
              { label: "특수학급 수", value: school.특수학급수 + "개" },
              { label: "특수학급 배치", value: school.특수배치 + "명" },
              { label: "일반학급 배치", value: school.일반배치 + "명" },
              {
                label: "잔여 자리",
                value: school.잔여 > 0 ? school.잔여 + "명" : school.잔여 < 0 ? school.잔여 + "명" : "없음",
                sub: school.잔여 < 0 ? "초과" : school.잔여 === 0 ? "만원" : null,
              },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center py-3 px-2">
                <span className="text-xs text-muted-foreground mb-0.5">{item.label}</span>
                <span className={`text-lg font-bold ${
                  item.label === "잔여 자리" && school.잔여 > 0
                    ? "text-emerald-600"
                    : item.label === "잔여 자리" && school.잔여 < 0
                    ? "text-red-600"
                    : "text-foreground"
                }`}>
                  {item.value}
                </span>
                {"sub" in item && item.sub && (
                  <span className={`text-xs font-medium ${school.잔여 < 0 ? "text-red-500" : "text-muted-foreground"}`}>
                    {item.sub}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Grade breakdown */}
        <div className="p-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            {isSpecialSchool ? "학년별 재학생 현황" : "학년별 배치 현황"}
          </h3>
          {grades.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">학생 현황 데이터 없음</p>
          ) : (
            <div className="overflow-auto max-h-72 rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-muted text-muted-foreground">
                    <th className="text-left px-4 py-2 font-semibold">학년</th>
                    {isSpecialSchool ? (
                      <th className="text-center px-4 py-2 font-semibold">재학생</th>
                    ) : (
                      <>
                        <th className="text-center px-4 py-2 font-semibold">특수학급</th>
                        <th className="text-center px-4 py-2 font-semibold">일반학급(통합)</th>
                      </>
                    )}
                    <th className="text-center px-4 py-2 font-semibold">소계</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((grade, i) => {
                    const d = gradeMap[grade];
                    const total = d.특수학급 + d.일반학급;
                    return (
                      <tr key={grade} className={i % 2 === 0 ? "bg-white" : "bg-muted/40"}>
                        <td className="px-4 py-2 font-medium">{grade}</td>
                        {isSpecialSchool ? (
                          <td className="px-4 py-2 text-center">
                            <span className="inline-block bg-purple-100 text-purple-700 rounded px-2 py-0.5 font-semibold text-xs">
                              {d.일반학급}명
                            </span>
                          </td>
                        ) : (
                          <>
                            <td className="px-4 py-2 text-center">
                              {d.특수학급 > 0 ? (
                                <span className="inline-block bg-blue-100 text-blue-700 rounded px-2 py-0.5 font-semibold text-xs">
                                  {d.특수학급}명
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {d.일반학급 > 0 ? (
                                <span className="inline-block bg-orange-100 text-orange-700 rounded px-2 py-0.5 font-semibold text-xs">
                                  {d.일반학급}명
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="px-4 py-2 text-center font-semibold">{total}명</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1B4FA8]/5 border-t border-border font-bold sticky bottom-0">
                    <td className="px-4 py-2">합계</td>
                    {isSpecialSchool ? (
                      <td className="px-4 py-2 text-center text-purple-700">{totalGeneral}명</td>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-center text-blue-700">{totalSpecial}명</td>
                        <td className="px-4 py-2 text-center text-orange-700">{totalGeneral}명</td>
                      </>
                    )}
                    <td className="px-4 py-2 text-center">{totalSpecial + totalGeneral}명</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
