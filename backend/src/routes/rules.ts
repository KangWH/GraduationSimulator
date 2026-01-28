import express, { type Request, type Response } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' })
const prisma = new PrismaClient({ adapter });
const router = express.Router();

router.get('/general', async (req, res) => {
  const year = Number(req.query.year);
  if (isNaN(year)) {
    return res.status(400).json({
      success: false,
      message: '연도가 지정되지 않았습니다.'
    });
  }

  const typeParam = req.query.type;
  if (!typeParam || (typeof typeParam !== 'string') || typeParam === '') {
    return res.status(400).json({
      success: false,
      message: '종류가 지정되지 않았습니다.'
    });
  }
  const type: string = typeParam;

  const entry = await prisma.generalEdRequirement.findFirst({
    where: {
      year: {
        lte: year,
      },
      type,
    },
    orderBy: {
      year: 'desc',
    }
  });

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: '지정된 요건을 찾을 수 없습니다.'
    })
  }

  return res.json({
    success: true,
    requirements: entry.requirements
  });
});

router.get('/major', async (req, res) => {
  const year = Number(req.query.year);
  if (isNaN(year)) {
    return res.status(400).json({
      success: false,
      message: '연도가 지정되지 않았습니다.'
    });
  }

  const departmentParam = req.query.department;
  if (!departmentParam || (typeof departmentParam !== 'string') || departmentParam === '') {
    return res.status(400).json({
      success: false,
      message: '학과가 지정되지 않았습니다.'
    });
  }
  const department: string = departmentParam;

  const typeParam = req.query.type;
  if (!typeParam || (typeof typeParam !== 'string') || typeParam === '') {
    return res.status(400).json({
      success: false,
      message: '종류가 지정되지 않았습니다.'
    });
  }
  const type: string = typeParam;

  const entry = await prisma.majorRequirement.findFirst({
    where: {
      year: {
        lte: year,
      },
      department,
      type,
    },
    orderBy: {
      year: 'desc',
    }
  });

  if (!entry) {
    return res.status(404).json({
      success: false,
      message: '지정된 요건을 찾을 수 없습니다.'
    })
  }

  return res.json({
    success: true,
    requirements: entry.requirements
  });
});

export default router;
