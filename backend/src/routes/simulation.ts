import express, { type Request, type Response } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' })
const prisma = new PrismaClient({ adapter });
const router = express.Router();

// 시뮬레이션 저장
router.post('/', async (req: Request, res: Response) => {
  try {
    const { userId, title, referenceYear, major, doubleMajors, minors, courses } = req.body;

    // 필수 필드 검증
    if (!userId || !title || !referenceYear || !major) {
      return res.status(400).json({
        success: false,
        message: '필수 정보를 모두 입력해주세요.'
      });
    }

    // 사용자 프로필 확인
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: '프로필을 찾을 수 없습니다. 먼저 프로필을 설정해주세요.'
      });
    }

    // 시뮬레이션 생성
    const simulation = await prisma.simulation.create({
      data: {
        profileId: profile.id,
        title: title.trim(),
        updatedAt: new Date(),
        referenceYear: parseInt(referenceYear),
        major: major,
        doubleMajors: Array.isArray(doubleMajors) ? doubleMajors : [],
        minors: Array.isArray(minors) ? minors : [],
        courses: courses || [],
      },
    });

    return res.status(201).json({
      success: true,
      message: '시뮬레이션이 저장되었습니다.',
      simulation: {
        id: simulation.id,
        title: simulation.title,
        updatedAt: simulation.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('시뮬레이션 저장 오류:', error);
    return res.status(500).json({
      success: false,
      message: '시뮬레이션 저장 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// 사용자의 시뮬레이션 목록 조회
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : null;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId가 필요합니다.'
      });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: {
        simulations: {
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: '프로필을 찾을 수 없습니다.',
      });
    }

    return res.json({
      success: true,
      simulations: profile.simulations.map((sim) => ({
        id: sim.id,
        title: sim.title,
        updatedAt: sim.updatedAt,
        referenceYear: sim.referenceYear,
        major: sim.major,
        doubleMajors: sim.doubleMajors,
        minors: sim.minors,
      })),
    });
  } catch (error: any) {
    console.error('시뮬레이션 목록 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '시뮬레이션 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
