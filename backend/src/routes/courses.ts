import express, { type Request, type Response } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' })
const prisma = new PrismaClient({ adapter });
const router = express.Router();

// 개설 과목 검색
router.get('/', async (req, res) => {
  try {
    const { query, title, code, category, department, id } = req.query;

    // id로 조회하는 경우 (단일 과목 조회)
    if (id && typeof id === 'string') {
      const course = await prisma.courseOffering.findUnique({
        where: { id },
      });
      if (course) {
        return res.json([course]);
      } else {
        return res.json([]);
      }
    }

    // query 파라미터가 있을 때 정규식 패턴 매칭 사용
    if (query && typeof query === 'string') {
      const searchTitle = query.replace(/[^가-힣0-9A-Za-z]/g, '').toLowerCase();
      
      // 각 글자 사이에 임의의 글자가 있어도 매칭되도록 정규식 패턴 생성
      // 예: '선대개' -> '선.*대.*개'
      const regexPattern = searchTitle.split('').map(char => {
        // 정규식 특수문자 이스케이프
        return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('.*');
      
      // WHERE 절 조건 구성
      const searchConditions: string[] = [];
      const filterConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;
      
      // 정규식 패턴 매칭 (각 글자 사이에 임의의 글자 허용)
      searchConditions.push(`LOWER("searchTitle") ~* $${paramIndex}`);
      searchConditions.push(`LOWER("title") ~* $${paramIndex}`);
      queryParams.push(regexPattern);
      paramIndex++;
      
      // 코드는 기존 contains 방식 유지
      searchConditions.push(`"code" ILIKE $${paramIndex}`);
      queryParams.push(`%${query}%`);
      paramIndex++;
      
      // contains 패턴도 추가 (정확한 매칭 우선)
      const containsPattern = `%${searchTitle}%`;
      queryParams.push(containsPattern);
      const containsParamIndex = paramIndex;
      paramIndex++;
      
      // 추가 필터
      if (category && typeof category === 'string') {
        filterConditions.push(`"category" = $${paramIndex}`);
        queryParams.push(category);
        paramIndex++;
      }
      if (department && typeof department === 'string') {
        filterConditions.push(`"department" = $${paramIndex}`);
        queryParams.push(department);
        paramIndex++;
      }
      
      // WHERE 절 구성
      const whereClause = filterConditions.length > 0
        ? `(${searchConditions.join(' OR ')}) AND ${filterConditions.join(' AND ')}`
        : `(${searchConditions.join(' OR ')})`;
      
      // 정확한 매칭을 우선으로 정렬하기 위해 CASE 문 사용
      const fuzzySearchQuery = `
        SELECT *,
          CASE 
            WHEN LOWER("searchTitle") LIKE $${containsParamIndex} THEN 3
            WHEN LOWER("searchTitle") ~* $1 THEN 2
            WHEN "code" ILIKE $2 THEN 1
            ELSE 0
          END as match_priority
        FROM "CourseOffering"
        WHERE ${whereClause}
        ORDER BY match_priority DESC, "code" ASC
        LIMIT 100
      `;
      
      const courses = await prisma.$queryRawUnsafe(fuzzySearchQuery, ...queryParams);
      return res.json(courses);
    }

    // query가 없을 때는 기존 방식 사용
    const conditions: any[] = [];

    // 개별 필터
    if (title && typeof title === 'string') {
      const searchTitle = title.replace(/[^가-힣0-9A-Za-z]/g, '').toLowerCase();
      conditions.push({ searchTitle: { contains: searchTitle } });
    }
    if (code && typeof code === 'string') {
      conditions.push({ code });
    }
    if (category && typeof category === 'string') {
      conditions.push({ category });
    }
    if (department && typeof department === 'string') {
      conditions.push({ department });
    }

    const courses = await prisma.courseOffering.findMany({
      where: conditions.length > 0 ? { AND: conditions } : {},
      orderBy: { code: 'asc' }
    });
    
    res.json(courses);
  } catch (error: any) {
    console.error('과목 목록 조회 오류:', error);
    res.status(500).json({ error: '과목 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

export default router;
