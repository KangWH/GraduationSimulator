import express, { type Request, type Response } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { CourseSubstitutionModel } from '../generated/prisma/models/CourseSubstitution.js';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' })
const prisma = new PrismaClient({ adapter });
const router = express.Router();

/**
 * 대체과목 조회 API
 * GET /api/substitutions?year=2020&department=EE
 * - year: 적용 연도 (입학연도 또는 기준연도)
 * - department: 학과 코드 (선택, null이면 전역 규칙만)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year);
    if (isNaN(year)) {
      return res.status(400).json({
        success: false,
        message: '연도가 지정되지 않았습니다.'
      });
    }

    const department = req.query.department as string | undefined;

    // 해당 연도에 적용되는 대체과목 조회
    // startYear <= year && (endYear === null || endYear >= year)
    const substitutions = await prisma.courseSubstitution.findMany({
      where: {
        startYear: {
          lte: year,
        },
        OR: [
          { endYear: null },
          { endYear: { gte: year } },
        ],
        ...(department !== undefined ? { department } : {}),
      },
      orderBy: [
        { department: 'asc' },
        { originalCourseCode: 'asc' },
        { startYear: 'desc' },
      ],
    });

    // 대체과목 맵 생성
    // 1. 원본 과목 코드 → 대체 과목 코드 배열
    const substitutionMap: Record<string, string[]> = {};
    // 2. 대체 과목 코드 → 원본 과목 코드 배열 (역방향)
    const reverseMap: Record<string, string[]> = {};
    // 3. 대체과목 그룹 (상호 배타적인 과목 그룹)
    const groups: Record<string, string[]> = {};

    substitutions.forEach((sub: CourseSubstitutionModel) => {
      const original = sub.originalCourseCode;
      const substitute = sub.substituteCourseCode;

      // 원본 → 대체 맵
      if (!substitutionMap[original]) {
        substitutionMap[original] = [];
      }
      if (!substitutionMap[original].includes(substitute)) {
        substitutionMap[original].push(substitute);
      }

      // 대체 → 원본 맵 (역방향)
      if (!reverseMap[substitute]) {
        reverseMap[substitute] = [];
      }
      if (!reverseMap[substitute].includes(original)) {
        reverseMap[substitute].push(original);
      }

      // 대체과목 그룹 생성 (상호 배타적인 과목 그룹)
      // 원본과 대체과목을 모두 포함하는 그룹
      const group = [original, substitute];
      
      // 기존 그룹에 포함되어 있는지 확인하고 병합
      let mergedGroup = [...group];
      for (const code of group) {
        if (groups[code]) {
          mergedGroup = [...new Set([...mergedGroup, ...groups[code]])];
        }
      }
      
      // 모든 그룹 멤버에 대해 그룹 업데이트
      mergedGroup.forEach(code => {
        groups[code] = mergedGroup;
      });
    });

    return res.json({
      success: true,
      substitutions: substitutions,
      map: substitutionMap,
      reverse: reverseMap,
      groups: groups,
    });
  } catch (error: any) {
    console.error('Error fetching substitutions:', error);
    return res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.',
      error: error.message,
    });
  }
});

export default router;
