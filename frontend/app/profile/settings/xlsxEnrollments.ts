import type { RawEnrollment, Semester, Grade } from './types';

const VALID_GRADES: Grade[] = ['A+', 'A0', 'A-', 'B+', 'B0', 'B-', 'C+', 'C0', 'C-', 'D+', 'D0', 'D-', 'F', 'S', 'U', 'P', 'NR', 'W'];

export interface ParsedXlsxRow {
  year: number;
  semester: Semester;
  courseCode: string;
  categoryBaseLabel: string;
  requiredTags: string[];
  grade: Grade;
}

function parseXlsxCategoryLabel(input: string): { baseLabel: string; requiredTags: string[] } {
  const raw = String(input ?? '').trim();
  if (!raw) return { baseLabel: '', requiredTags: [] };

  const m = raw.match(/^(.+?)\((.+?)\)$/);
  const baseLabel = (m ? m[1] : raw).trim();
  const inside = (m ? m[2] : '').trim();
  if (!inside) return { baseLabel, requiredTags: [] };

  const groupMap: Record<string, string> = { 사: '사회', 인: '인문', 문: '문학예술' };
  const typeMap: Record<string, string> = { 일: '일반', 융: '융합', 핵: '핵심' };

  const chars = Array.from(inside);
  const groupChar = chars.find((c) => c in groupMap) ?? '';
  const typeChar = chars.find((c) => c in typeMap) ?? '';

  const requiredTags = [groupChar ? groupMap[groupChar] : '', typeChar ? typeMap[typeChar] : ''].filter(Boolean);
  return { baseLabel, requiredTags };
}

export function parseXlsxRow(row: Record<string, unknown>): ParsedXlsxRow | null {
  const termStr = String(row['학년도-학기'] ?? '').trim();
  const codeRaw = row['교과목'];
  const categoryLabelRaw = String(row['구분'] ?? '').trim();
  const gradeStr = String(row['성적'] ?? '').trim();
  if (!termStr || codeRaw == null || codeRaw === '') return null;

  let year: number;
  let semester: Semester;
  if (termStr === '기이수 인정 학점') {
    year = 0;
    semester = 'SPRING';
  } else {
    const m = termStr.match(/(\d{4})년\s*(봄|여름|가을|겨울)학기/);
    if (!m) return null;
    year = parseInt(m[1], 10);
    const semMap: Record<string, Semester> = { 봄: 'SPRING', 여름: 'SUMMER', 가을: 'FALL', 겨울: 'WINTER' };
    semester = semMap[m[2]] ?? 'SPRING';
  }

  const courseCode = String(codeRaw).trim();
  const grade = (VALID_GRADES.includes(gradeStr as Grade) ? gradeStr : 'NR') as Grade;
  const { baseLabel: categoryBaseLabel, requiredTags } = parseXlsxCategoryLabel(categoryLabelRaw);
  return { year, semester, courseCode, categoryBaseLabel, requiredTags, grade };
}

export function parseXlsxRows(rows: Record<string, unknown>[]): ParsedXlsxRow[] {
  const parsed: ParsedXlsxRow[] = [];
  for (const row of rows) {
    const p = parseXlsxRow(row);
    if (p) parsed.push(p);
  }
  return parsed;
}

export interface ApplyXlsxResult {
  rawEnrollments: RawEnrollment[];
  notFoundCodes: string[];
  tagMismatch: string[];
  categoryMismatch: string[];
  unknownCategory: string[];
}

export async function applyXlsxParsedRows(
  parsed: ParsedXlsxRow[],
  apiBase: string
): Promise<ApplyXlsxResult> {
  const courseCategoriesRes = await fetch(`${apiBase}/courseCategories`);
  const courseCategoriesJson = await courseCategoriesRes.json();
  const courseCategories: Array<{ id: string; name: string }> = Array.isArray(courseCategoriesJson) ? courseCategoriesJson : [];
  const categoryNameToId = new Map(courseCategories.map((c) => [String(c.name).trim(), String(c.id).trim()]));
  const categoryIdToName = new Map(courseCategories.map((c) => [String(c.id).trim(), String(c.name).trim()]));
  const categoryAliasToName: Record<string, string> = {
    교필: '교양필수',
    자선: '자유선택',
    기필: '기초필수',
    기선: '기초선택',
    전필: '전공필수',
    전선: '전공선택',
    인선: '인문사회선택',
    선택: '선택(석/박사)',
  };
  const getCategoryId = (label: string): string | null => {
    const t = String(label ?? '').trim();
    if (!t) return null;
    if (categoryIdToName.has(t)) return t;
    if (categoryNameToId.has(t)) return categoryNameToId.get(t)!;
    const aliased = categoryAliasToName[t];
    if (aliased && categoryNameToId.has(aliased)) return categoryNameToId.get(aliased)!;
    return null;
  };

  const hasAllTags = (courseTags: unknown, required: string[]) => {
    if (!required || required.length === 0) return true;
    const tags = Array.isArray(courseTags) ? courseTags.map((t) => String(t)) : [];
    return required.every((r) => tags.includes(r));
  };

  const pickCourse = (courses: any[], expectedCategoryId: string | null, requiredTags: string[], allowFallback = false) => {
    const list = Array.isArray(courses) ? courses : [];
    const exactMatch = list.find((c) => {
      if (expectedCategoryId && String(c?.category ?? '').trim() !== expectedCategoryId) return false;
      if (!hasAllTags(c?.tags, requiredTags)) return false;
      return true;
    });
    if (exactMatch) return exactMatch;

    if (allowFallback && expectedCategoryId === 'HSE' && requiredTags.length === 2) {
      const firstTag = requiredTags[0];
      const firstTagPlusCore = list.find((c) => {
        if (String(c?.category ?? '').trim() !== expectedCategoryId) return false;
        const tags = Array.isArray(c?.tags) ? c.tags.map((t: unknown) => String(t)) : [];
        return tags.includes(firstTag) && tags.includes('핵심');
      });
      if (firstTagPlusCore) return firstTagPlusCore;

      const noTags = list.find((c) => {
        if (String(c?.category ?? '').trim() !== expectedCategoryId) return false;
        const tags = Array.isArray(c?.tags) ? c.tags : [];
        return tags.length === 0;
      });
      if (noTags) return noTags;
    }

    return null;
  };

  const rawMap = new Map<string, RawEnrollment>();
  const notFoundCodes: string[] = [];
  const categoryMismatch: string[] = [];
  const unknownCategory: string[] = [];
  const tagMismatch: string[] = [];

  for (const p of parsed) {
    const expectedCategoryId = getCategoryId(p.categoryBaseLabel);
    if (!expectedCategoryId) {
      unknownCategory.push(`${p.courseCode}(${p.categoryBaseLabel || '구분없음'})`);
    }

    let course: any | null = null;
    if (expectedCategoryId) {
      const res = await fetch(`${apiBase}/courses?code=${encodeURIComponent(p.courseCode)}&category=${encodeURIComponent(expectedCategoryId)}`);
      const courses = await res.json();
      const isHSE = expectedCategoryId === 'HSE';
      course = pickCourse(courses, expectedCategoryId, p.requiredTags, isHSE);
      if (!course && Array.isArray(courses) && courses.length > 0 && p.requiredTags.length > 0 && !isHSE) {
        tagMismatch.push(`${p.courseCode}(${p.requiredTags.join('+')})`);
      }
    }

    if (!course) {
      const res2 = await fetch(`${apiBase}/courses?code=${encodeURIComponent(p.courseCode)}`);
      const courses2 = await res2.json();
      const isHSE = expectedCategoryId === 'HSE';
      const fallback = pickCourse(courses2, expectedCategoryId, p.requiredTags, isHSE);
      if (!fallback?.id) {
        if (Array.isArray(courses2) && courses2.length > 0 && p.requiredTags.length > 0 && !isHSE) {
          tagMismatch.push(`${p.courseCode}(${p.requiredTags.join('+')})`);
          continue;
        }
        notFoundCodes.push(p.courseCode);
        continue;
      }
      course = fallback;
    }

    if (course?.id) {
      const key = `${course.id}-${p.year}-${p.semester}`;
      rawMap.set(key, {
        courseId: course.id,
        enrolledYear: p.year,
        enrolledSemester: p.semester,
        grade: p.grade,
      });
    } else {
      notFoundCodes.push(p.courseCode);
    }
  }

  return {
    rawEnrollments: Array.from(rawMap.values()),
    notFoundCodes,
    tagMismatch,
    categoryMismatch,
    unknownCategory,
  };
}
