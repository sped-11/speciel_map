import { useState, useMemo, useRef, useEffect } from "react";
import type { School } from "@/data/schools";
import { loadAllData } from "@/data/googleSheets";
import type { StudentData } from "@/data/students";
import KakaoMap from "@/components/KakaoMap";
import SchoolDetailModal from "@/components/SchoolDetailModal";

const PASSWORD = "dg2895";
const ADMIN_PASSWORD = "1338";
const SESSION_KEY = "special_edu_auth";

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (value === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      onUnlock();
    } else {
      setError(true);
      setValue("");
      setTimeout(() => {
        setError(false);
        inputRef.current?.focus();
      }, 1200);
    }
  }

  return (
    <div className="min-h-screen bg-[#1B4FA8] flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="text-4xl">🔒</div>
          <h1 className="text-lg font-bold text-gray-800 text-center">2026 특수교육대상자 배치 현황</h1>
          <p className="text-sm text-gray-500 text-center">동작구 · 관악구 (내부자료)</p>
        </div>
        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            ref={inputRef}
            type="password"
            autoFocus
            placeholder="암호를 입력하세요"
            value={value}
            onChange={e => setValue(e.target.value)}
            className={`w-full border rounded-lg px-4 py-3 text-sm outline-none transition-all
              ${error
                ? "border-red-400 bg-red-50 text-red-700 placeholder-red-400 shake"
                : "border-gray-300 focus:border-[#1B4FA8] focus:ring-2 focus:ring-[#1B4FA8]/20"
              }`}
          />
          {error && (
            <p className="text-xs text-red-500 text-center -mt-1">암호가 올바르지 않습니다.</p>
          )}
          <button
            type="submit"
            className="w-full bg-[#1B4FA8] hover:bg-[#1640880] text-white font-semibold rounded-lg py-3 text-sm transition-colors"
          >
            확인
          </button>
        </form>
      </div>
    </div>
  );
}

const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_MAP_KEY ?? "";

type FilterKey =
  | "전체"
  | "동작구"
  | "관악구"
  | "유"
  | "초"
  | "중"
  | "고"
  | "특수학교"
  | "특수학급 설치교"
  | "특수에듀케어 설치교"
  | "과밀학급"
  | "남학교"
  | "여학교"
  | "남녀공학";

const DISTRICT_FILTERS: FilterKey[] = ["동작구", "관악구"];
const GRADE_FILTERS: FilterKey[] = ["유", "초", "중", "고"];
const CATEGORY_FILTERS: FilterKey[] = ["특수학교", "특수학급 설치교", "특수에듀케어 설치교", "과밀학급"];
const GENDER_FILTERS: FilterKey[] = ["남학교", "여학교", "남녀공학"];

function gradeMatch(학교급: string, key: FilterKey) {
  return (
    (key === "유" && 학교급 === "유치원") ||
    (key === "초" && 학교급 === "초등학교") ||
    (key === "중" && 학교급 === "중학교") ||
    (key === "고" && 학교급 === "고등학교")
  );
}

function categoryMatch(school: School, key: FilterKey) {
  if (key === "특수학교") return school.학교급 === "특수학교";
  if (key === "특수학급 설치교") return school.특수학급수 > 0;
  if (key === "특수에듀케어 설치교") return school.학교급 === "유치원" && school.에듀케어수 > 0;
  if (key === "과밀학급") return school.잔여 < 0;
  return false;
}

function genderMatch(school: School, key: FilterKey) {
  if (key === "남학교") return school.성별 === "남";
  if (key === "여학교") return school.성별 === "녀";
  if (key === "남녀공학") return school.성별 === "남녀공학";
  return false;
}

function applyFilters(list: School[], activeFilters: Set<FilterKey>): School[] {
  if (activeFilters.size === 0) return list;

  const districtActive = DISTRICT_FILTERS.filter(f => activeFilters.has(f));
  const gradeActive = GRADE_FILTERS.filter(f => activeFilters.has(f));
  const catActive = CATEGORY_FILTERS.filter(f => activeFilters.has(f));
  const genderActive = GENDER_FILTERS.filter(f => activeFilters.has(f));

  const 특수학교CatActive = catActive.includes("특수학교");
  const nonSpecialCatActive = catActive.filter(k => k !== "특수학교");

  return list.filter(school => {
    const isSpecialSchool = school.학교급 === "특수학교";

    // District filter applies to all schools
    if (districtActive.length > 0 && !districtActive.includes(school.구 as FilterKey)) return false;

    if (isSpecialSchool) {
      // Special schools appear when "특수학교" is selected, or "과밀학급" is selected and they're overcrowded
      return 특수학교CatActive || (activeFilters.has("과밀학급") && school.잔여 < 0);
    }

    // Regular schools: grade filter
    if (gradeActive.length > 0 && !gradeActive.some(k => gradeMatch(school.학교급, k))) return false;

    // Regular schools: category filter ("특수학교" cat is irrelevant for regular schools)
    if (nonSpecialCatActive.length > 0 && !nonSpecialCatActive.some(k => categoryMatch(school, k))) return false;

    // Gender filter (only applies to schools that have 성별 set, i.e. middle/high)
    if (genderActive.length > 0 && !genderActive.some(k => genderMatch(school, k))) return false;

    return true;
  });
}

type ViewMode = "map" | "list";

function levelBadge(학교급: string) {
  const styles: Record<string, string> = {
    유치원: "bg-pink-100 text-pink-700",
    초등학교: "bg-orange-100 text-orange-700",
    중학교: "bg-violet-100 text-violet-700",
    고등학교: "bg-indigo-100 text-indigo-700",
    특수학교: "bg-purple-100 text-purple-700",
  };
  const labels: Record<string, string> = { 유치원: "유", 초등학교: "초", 중학교: "중", 고등학교: "고", 특수학교: "특수" };
  return { cls: styles[학교급] ?? "bg-gray-100 text-gray-700", label: labels[학교급] ?? 학교급 };
}

function getJanyeoBadge(잔여: number) {
  if (잔여 < 0) return { cls: "bg-red-100 text-red-700", label: `${잔여}명(과밀)` };
  if (잔여 === 0) return { cls: "bg-amber-100 text-amber-700", label: "Full" };
  if (잔여 >= 5) return { cls: "bg-emerald-100 text-emerald-700", label: `${잔여}명` };
  return { cls: "bg-blue-100 text-blue-700", label: `${잔여}명` };
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [schools, setSchools] = useState<School[]>([]);
  const [studentData, setStudentData] = useState<StudentData>({});
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [search, setSearch] = useState("");
  const [showRefreshModal, setShowRefreshModal] = useState(false);
  const [adminPw, setAdminPw] = useState("");
  const [adminPwError, setAdminPwError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const adminInputRef = useRef<HTMLInputElement>(null);

  function fetchData() {
    setDataLoading(true);
    setDataError(null);
    loadAllData()
      .then(({ schools, studentData }) => {
        setSchools(schools);
        setStudentData(studentData);
      })
      .catch(err => setDataError(String(err?.message ?? err)))
      .finally(() => setDataLoading(false));
  }

  useEffect(() => {
    fetchData();
  }, []);

  function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (adminPw === ADMIN_PASSWORD) {
      setShowRefreshModal(false);
      setAdminPw("");
      setAdminPwError(false);
      setRefreshing(true);
      setDataError(null);
      loadAllData()
        .then(({ schools, studentData }) => {
          setSchools(schools);
          setStudentData(studentData);
        })
        .catch(err => setDataError(String(err?.message ?? err)))
        .finally(() => setRefreshing(false));
    } else {
      setAdminPwError(true);
      setAdminPw("");
      setTimeout(() => {
        setAdminPwError(false);
        adminInputRef.current?.focus();
      }, 1200);
    }
  }

  function openRefreshModal() {
    setAdminPw("");
    setAdminPwError(false);
    setShowRefreshModal(true);
    setTimeout(() => adminInputRef.current?.focus(), 50);
  }

  const filteredSchools = useMemo(() => {
    let list = applyFilters(schools, activeFilters);
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(s => s.학교명.includes(q) || s.약칭.includes(q));
    }
    return list;
  }, [schools, activeFilters, search]);

  function toggleFilter(key: FilterKey) {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (key === "전체") {
        next.clear();
      } else {
        if (next.has(key)) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  function isActive(key: FilterKey) {
    if (key === "전체") return activeFilters.size === 0;
    return activeFilters.has(key);
  }

  const totalSpecial = filteredSchools.reduce((s, sc) => s + sc.특수배치, 0);
  const totalGeneral = filteredSchools.reduce((s, sc) => s + sc.일반배치, 0);
  const totalCapacity = filteredSchools.reduce((s, sc) => s + sc.정원, 0);
  const schoolsWithSpace = filteredSchools.filter(s => s.잔여 > 0).length;

  const FilterButton = ({ label }: { label: FilterKey }) => (
    <button
      onClick={() => toggleFilter(label)}
      className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all border ${
        isActive(label)
          ? "bg-[#1B4FA8] text-white border-[#1B4FA8] shadow-sm"
          : "bg-white text-foreground border-border hover:border-[#1B4FA8] hover:text-[#1B4FA8]"
      }`}
    >
      {label}
    </button>
  );

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  if (dataLoading) return (
    <div className="min-h-screen bg-[#1B4FA8] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
      <p className="text-white font-medium text-sm">데이터를 불러오는 중입니다...</p>
    </div>
  );

  if (dataError) return (
    <div className="min-h-screen bg-[#1B4FA8] flex flex-col items-center justify-center gap-4 p-6">
      <div className="text-4xl">⚠️</div>
      <p className="text-white font-bold text-lg">데이터 불러오기 실패</p>
      <p className="text-white/70 text-sm text-center max-w-sm">{dataError}</p>
      <button
        onClick={() => window.location.reload()}
        className="mt-2 bg-white text-[#1B4FA8] font-semibold px-5 py-2 rounded-lg text-sm hover:bg-white/90 transition-colors"
      >
        다시 시도
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="bg-red-600 text-white text-center text-xs font-bold py-1.5 tracking-widest flex items-center justify-center gap-4 flex-shrink-0">
        <span>🔒 외부유출 금지</span>
        <span className="w-px h-3 bg-white/40" />
        <span>내부자료</span>
        <span className="w-px h-3 bg-white/40" />
        <span>🔒 외부유출 금지</span>
      </div>
      <header className="bg-[#1B4FA8] text-white px-6 py-4 shadow-lg flex-shrink-0">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">2026 특수교육대상자 배치 현황</h1>
              <p className="text-sm text-white/70 mt-0.5">2026. 7. 1. 기준 · 동작구 · 관악구</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Stats */}
              <div className="flex items-center gap-5 text-sm">
                <div className="text-center">
                  <div className="text-xl font-bold">{filteredSchools.length}</div>
                  <div className="text-white/60 text-xs">대상 학교</div>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div className="text-center">
                  <div className="text-xl font-bold">{totalSpecial + totalGeneral}</div>
                  <div className="text-white/60 text-xs">전체 배치</div>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <div className="text-center">
                  <div className="text-xl font-bold text-emerald-300">{schoolsWithSpace}</div>
                  <div className="text-white/60 text-xs">잔여 있는 학교</div>
                </div>
              </div>
              {/* 현행화 button */}
              <button
                onClick={openRefreshModal}
                disabled={refreshing}
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-3 py-2 rounded-lg border border-white/30 transition-colors"
              >
                {refreshing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    현행화 중…
                  </>
                ) : (
                  <>
                    <span>🔄</span>
                    현행화
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <div className="bg-white border-b border-border px-6 py-2 flex-shrink-0">
        <div className="max-w-screen-2xl mx-auto flex flex-col gap-1.5">
          {/* Row 1: 전체 | 구 | 학교급 | 특수에듀케어 + 검색/뷰 토글 */}
          <div className="flex items-center gap-2 flex-wrap">
            <FilterButton label="전체" />
            <span className="text-border text-xs">|</span>
            <FilterButton label="동작구" />
            <FilterButton label="관악구" />
            <span className="text-border text-xs">|</span>
            <FilterButton label="유" />
            <FilterButton label="초" />
            <FilterButton label="중" />
            <FilterButton label="고" />
            <FilterButton label="특수학교" />
            <span className="text-border text-xs">|</span>
            <FilterButton label="특수에듀케어 설치교" />
            <div className="ml-auto flex items-center gap-2">
              <input
                type="text"
                placeholder="학교 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="text-sm border border-border rounded-full px-4 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-[#1B4FA8]/30 w-40"
              />
              <div className="flex border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("map")}
                  className={`px-3 py-1.5 text-sm font-medium ${viewMode === "map" ? "bg-[#1B4FA8] text-white" : "text-muted-foreground hover:bg-muted"}`}
                >
                  지도
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 text-sm font-medium ${viewMode === "list" ? "bg-[#1B4FA8] text-white" : "text-muted-foreground hover:bg-muted"}`}
                >
                  목록
                </button>
              </div>
            </div>
          </div>
          {/* Row 2: 특수학급 설치교 | 과밀학급 | 남학교, 여학교, 남녀공학 */}
          <div className="flex items-center gap-2 flex-wrap">
            <FilterButton label="특수학급 설치교" />
            <span className="text-border text-xs">|</span>
            <button
              onClick={() => toggleFilter("과밀학급")}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all border ${
                isActive("과밀학급")
                  ? "bg-red-600 text-white border-red-600 shadow-sm"
                  : "bg-white text-red-600 border-red-200 hover:border-red-500 hover:bg-red-50"
              }`}
            >
              과밀학급
            </button>
            <span className="text-border text-xs">|</span>
            <button
              onClick={() => toggleFilter("남학교")}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all border ${
                isActive("남학교")
                  ? "bg-sky-600 text-white border-sky-600 shadow-sm"
                  : "bg-white text-sky-700 border-sky-200 hover:border-sky-500 hover:bg-sky-50"
              }`}
            >
              남학교
            </button>
            <button
              onClick={() => toggleFilter("여학교")}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all border ${
                isActive("여학교")
                  ? "bg-rose-500 text-white border-rose-500 shadow-sm"
                  : "bg-white text-rose-600 border-rose-200 hover:border-rose-400 hover:bg-rose-50"
              }`}
            >
              여학교
            </button>
            <button
              onClick={() => toggleFilter("남녀공학")}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all border ${
                isActive("남녀공학")
                  ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                  : "bg-white text-teal-700 border-teal-200 hover:border-teal-500 hover:bg-teal-50"
              }`}
            >
              남녀공학
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden max-w-screen-2xl mx-auto w-full p-4 flex gap-4">
        {viewMode === "map" ? (
          <>
            {/* Map */}
            <div className="flex-1 min-h-0">
              <KakaoMap
                schools={filteredSchools}
                onSelectSchool={setSelectedSchool}
                selectedSchool={selectedSchool}
                apiKey={KAKAO_API_KEY}
              />
            </div>

            {/* Side panel - school list */}
            <div className="w-80 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
              <div className="text-xs text-muted-foreground px-1 mb-1">
                {filteredSchools.length}개 학교 · 특수배치 {totalSpecial}명 · 일반배치 {totalGeneral}명
              </div>
              {filteredSchools.map(school => {
                const lv = levelBadge(school.학교급);
                const jr = getJanyeoBadge(school.잔여);
                const isSelected = selectedSchool?.id === school.id;
                return (
                  <button
                    key={school.id}
                    onClick={() => setSelectedSchool(school)}
                    className={`text-left bg-white rounded-lg border p-3 transition-all hover:shadow-md ${
                      isSelected ? "border-[#1B4FA8] ring-2 ring-[#1B4FA8]/20 shadow-md" : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${lv.cls}`}>{lv.label}</span>
                          <span className="text-xs text-muted-foreground">{school.구}</span>
                          {school.성별 === "남" && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 font-semibold">남학교</span>
                          )}
                          {school.성별 === "녀" && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold">여학교</span>
                          )}
                          {school.에듀케어수 > 0 && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 font-semibold">에듀케어</span>
                          )}
                        </div>
                        <div className="font-medium text-sm truncate">{school.학교명}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {school.학교급 === "특수학교" ? (
                          <div className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                            {school.일반배치}명
                          </div>
                        ) : school.특수학급수 > 0 ? (
                          <>
                            <div className={`text-xs font-bold px-2 py-0.5 rounded ${jr.cls}`}>{jr.label}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {school.특수배치}/{school.정원}명
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground">미설치교</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {filteredSchools.length === 0 && (
                <div className="text-center text-muted-foreground text-sm py-12">
                  해당 조건의 학교가 없습니다.
                </div>
              )}
            </div>
          </>
        ) : (
          /* List View */
          <div className="flex-1 min-h-0 overflow-auto">
            <div className="mb-3 text-sm text-muted-foreground">
              {filteredSchools.length}개 학교 · 특수배치 {totalSpecial}명 · 일반학급 배치 {totalGeneral}명 · 정원 {totalCapacity}명
            </div>
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#1B4FA8] text-white">
                    <th className="text-left px-4 py-3 font-semibold">구</th>
                    <th className="text-left px-4 py-3 font-semibold">학교급</th>
                    <th className="text-left px-4 py-3 font-semibold">설치별</th>
                    <th className="text-left px-4 py-3 font-semibold">학교명</th>
                    <th className="text-center px-4 py-3 font-semibold">특수학급 수</th>
                    <th className="text-center px-4 py-3 font-semibold">정원</th>
                    <th className="text-center px-4 py-3 font-semibold">특수학급 배치</th>
                    <th className="text-center px-4 py-3 font-semibold">일반학급 배치</th>
                    <th className="text-center px-4 py-3 font-semibold">잔여 자리</th>
                    <th className="text-center px-4 py-3 font-semibold">에듀케어</th>
                    <th className="text-center px-4 py-3 font-semibold">상세보기</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSchools.map((school, i) => {
                    const lv = levelBadge(school.학교급);
                    const jr = getJanyeoBadge(school.잔여);
                    return (
                      <tr
                        key={school.id}
                        className={`border-t border-border hover:bg-blue-50/50 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-muted/20"}`}
                      >
                        <td className="px-4 py-2.5">{school.구}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${lv.cls}`}>{school.학교급}</span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{school.설치별}</td>
                        <td className="px-4 py-2.5 font-medium">{school.학교명}</td>
                        <td className="px-4 py-2.5 text-center">{school.특수학급수 > 0 ? school.특수학급수 : "-"}</td>
                        <td className="px-4 py-2.5 text-center">{school.정원 > 0 ? school.정원 + "명" : "-"}</td>
                        <td className="px-4 py-2.5 text-center">
                          {school.특수배치 > 0 ? (
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-semibold">{school.특수배치}명</span>
                          ) : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {school.일반배치 > 0 ? (
                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-xs font-semibold">{school.일반배치}명</span>
                          ) : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {school.특수학급수 > 0 ? (
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${jr.cls}`}>{jr.label}</span>
                          ) : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {school.에듀케어수 > 0 ? (
                            <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs font-semibold">{school.에듀케어수}개</span>
                          ) : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => setSelectedSchool(school)}
                            className="text-xs text-[#1B4FA8] hover:underline font-medium"
                          >
                            상세보기
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSchools.length === 0 && (
                    <tr>
                      <td colSpan={11} className="text-center py-12 text-muted-foreground">
                        해당 조건의 학교가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedSchool && (
        <SchoolDetailModal
          school={selectedSchool}
          onClose={() => setSelectedSchool(null)}
          studentData={studentData}
        />
      )}

      {/* 현행화 Admin Modal */}
      {showRefreshModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={e => { if (e.target === e.currentTarget) { setShowRefreshModal(false); setAdminPw(""); setAdminPwError(false); } }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs p-8 flex flex-col items-center gap-6">
            <div className="flex flex-col items-center gap-2">
              <div className="text-4xl">🔄</div>
              <h2 className="text-lg font-bold text-gray-800 text-center">현행화</h2>
              <p className="text-sm text-gray-500 text-center">구글 시트에서 최신 데이터를 다시 불러옵니다.<br />관리자 비밀번호를 입력하세요.</p>
            </div>
            <form onSubmit={handleAdminSubmit} className="w-full flex flex-col gap-3">
              <input
                ref={adminInputRef}
                type="password"
                placeholder="관리자 비밀번호"
                value={adminPw}
                onChange={e => setAdminPw(e.target.value)}
                className={`w-full border rounded-lg px-4 py-3 text-sm outline-none transition-all
                  ${adminPwError
                    ? "border-red-400 bg-red-50 text-red-700 placeholder-red-400 shake"
                    : "border-gray-300 focus:border-[#1B4FA8] focus:ring-2 focus:ring-[#1B4FA8]/20"
                  }`}
              />
              {adminPwError && (
                <p className="text-xs text-red-500 text-center -mt-1">비밀번호가 올바르지 않습니다.</p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowRefreshModal(false); setAdminPw(""); setAdminPwError(false); }}
                  className="flex-1 border border-gray-300 text-gray-600 font-semibold rounded-lg py-3 text-sm hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#1B4FA8] hover:bg-[#1640880] text-white font-semibold rounded-lg py-3 text-sm transition-colors"
                >
                  확인
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
