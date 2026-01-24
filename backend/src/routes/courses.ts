import express, { type Request, type Response } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' })
const prisma = new PrismaClient({ adapter });
const router = express.Router();

// 개설 과목 검색
router.get('/', async (req, res) => {
  try {
    const { query, title, code, category, department } = req.query;

    const conditions: any[] = [];

    // 검색어 필터 (query가 있으면 제목 또는 코드로 검색)
    if (query && typeof query === 'string') {
      conditions.push({
        OR: [
          { title: { contains: query } },
          { code: { contains: query } }
        ]
      });
    }

    // 개별 필터
    if (title && typeof title === 'string') {
      conditions.push({ title: { contains: title } });
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
