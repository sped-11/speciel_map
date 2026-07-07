export type GradeData = Record<string, { 특수학급: number; 일반학급: number }>;
export type StudentData = Record<string, GradeData>;
