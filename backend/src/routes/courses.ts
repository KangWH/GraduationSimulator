import express, { type Request, type Response } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' })
const prisma = new PrismaClient({ adapter });
const router = express.Router();

// 개설 과목 검색
router.get('/', async (req, res) => {
  try {
    const { query, title, code, category, department } = req.query

    if (query && typeof query === 'string') {
      const courses = await prisma.courseOffering.findMany({
        where: {
          OR: [
            { title: { contains: query } },
            { code: query }
          ]
        },
        orderBy: { code: 'asc' }
      });
      res.json(courses);
      return;
    }

    const titleExists = title && typeof title === 'string';
    const codeExists = code && typeof code === 'string';
    const categoryExists = category && typeof category === 'string';
    const departmentExists = department && typeof department === 'string';
    if (titleExists || codeExists || categoryExists || departmentExists) {
      const query = [];
      if (titleExists) {
        query.push({ title: { contains: title } });
      }
      if (codeExists) {
        query.push({ code });
      }
      if (categoryExists) {
        query.push({ category });
      }
      if (departmentExists) {
        query.push({ department });
      }
      const courses = await prisma.courseOffering.findMany({
        where: {
          AND: query
        },
        orderBy: { code: 'asc' }
      })
      res.json(courses);
      return;
    }

    const courses = await prisma.courseOffering.findMany({
      orderBy: { code: 'asc' }
    });
    
    res.json(courses);
  } catch (error: any) {
    console.error('과목 목록 조회 오류:', error);
    res.status(500).json({ error: '과목 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

export default router;
