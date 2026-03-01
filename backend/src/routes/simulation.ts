import express, { type Request, type Response } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { authenticate } from '../middleware/auth.js';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' })
const prisma = new PrismaClient({ adapter });
const router = express.Router();

// 시뮬레이션 저장
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { title, referenceYear, major, doubleMajors, minors, advancedMajor, individuallyDesignedMajor, earlyGraduation, courses } = req.body;

    // 필수 필드 검증
    if (!title || !referenceYear || !major) {
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
        advancedMajor: Boolean(advancedMajor),
        individuallyDesignedMajor: Boolean(individuallyDesignedMajor),
        earlyGraduation: Boolean(earlyGraduation),
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
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
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
      simulations: profile.simulations.map((sim: any) => ({
        id: sim.id,
        title: sim.title,
        updatedAt: sim.updatedAt,
        referenceYear: sim.referenceYear,
        major: sim.major,
        doubleMajors: sim.doubleMajors,
        minors: sim.minors,
        advancedMajor: sim.advancedMajor,
        individuallyDesignedMajor: sim.individuallyDesignedMajor,
        earlyGraduation: sim.earlyGraduation,
        courses: sim.courses,
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

// 개별 시뮬레이션 조회
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === 'string' ? idParam : null;
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: '시뮬레이션 ID가 필요합니다.'
      });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: '프로필을 찾을 수 없습니다.',
      });
    }

    const simulation = await prisma.simulation.findUnique({
      where: { id },
    });

    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: '시뮬레이션을 찾을 수 없습니다.',
      });
    }

    // 시뮬레이션이 해당 프로필에 속하는지 확인
    if (simulation.profileId !== profile.id) {
      return res.status(403).json({
        success: false,
        message: '이 시뮬레이션에 접근할 권한이 없습니다.',
      });
    }

    return res.json({
      success: true,
      simulation: {
        id: simulation.id,
        title: simulation.title,
        updatedAt: simulation.updatedAt,
        referenceYear: simulation.referenceYear,
        major: simulation.major,
        doubleMajors: simulation.doubleMajors,
        minors: simulation.minors,
        advancedMajor: simulation.advancedMajor,
        individuallyDesignedMajor: simulation.individuallyDesignedMajor,
        earlyGraduation: simulation.earlyGraduation,
        courses: simulation.courses,
      },
    });
  } catch (error: any) {
    console.error('시뮬레이션 조회 오류:', error);
    return res.status(500).json({
      success: false,
      message: '시뮬레이션 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// 시나리오(시뮬레이션) 이름 변경
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === 'string' ? idParam : null;
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { title } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: '시뮬레이션 ID가 필요합니다.',
      });
    }

    if (title === undefined || title === null || typeof title !== 'string') {
      return res.status(400).json({
        success: false,
        message: '변경할 시나리오 이름(title)을 입력해주세요.',
      });
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return res.status(400).json({
        success: false,
        message: '시나리오 이름은 비어 있을 수 없습니다.',
      });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: '프로필을 찾을 수 없습니다.',
      });
    }

    const simulation = await prisma.simulation.findUnique({
      where: { id },
    });

    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: '시뮬레이션을 찾을 수 없습니다.',
      });
    }

    if (simulation.profileId !== profile.id) {
      return res.status(403).json({
        success: false,
        message: '이 시뮬레이션을 수정할 권한이 없습니다.',
      });
    }

    const updated = await prisma.simulation.update({
      where: { id },
      data: {
        title: trimmedTitle,
        updatedAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: '시나리오 이름이 변경되었습니다.',
      simulation: {
        id: updated.id,
        title: updated.title,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('시나리오 이름 변경 오류:', error);
    return res.status(500).json({
      success: false,
      message: '시나리오 이름 변경 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// 시뮬레이션 삭제
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === 'string' ? idParam : null;
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }

    if (!id) {
      return res.status(400).json({
        success: false,
        message: '시뮬레이션 ID가 필요합니다.'
      });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: '프로필을 찾을 수 없습니다.',
      });
    }

    const simulation = await prisma.simulation.findUnique({
      where: { id },
    });

    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: '시뮬레이션을 찾을 수 없습니다.',
      });
    }

    // 시뮬레이션이 해당 프로필에 속하는지 확인
    if (simulation.profileId !== profile.id) {
      return res.status(403).json({
        success: false,
        message: '이 시뮬레이션을 삭제할 권한이 없습니다.',
      });
    }

    await prisma.simulation.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: '시뮬레이션이 삭제되었습니다.',
    });
  } catch (error: any) {
    console.error('시뮬레이션 삭제 오류:', error);
    return res.status(500).json({
      success: false,
      message: '시뮬레이션 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// 시뮬레이션 업데이트
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const id = typeof idParam === 'string' ? idParam : null;
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { title, referenceYear, major, doubleMajors, minors, advancedMajor, individuallyDesignedMajor, earlyGraduation, courses } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: '시뮬레이션 ID가 필요합니다.'
      });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: '프로필을 찾을 수 없습니다.',
      });
    }

    const simulation = await prisma.simulation.findUnique({
      where: { id },
    });

    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: '시뮬레이션을 찾을 수 없습니다.',
      });
    }

    // 시뮬레이션이 해당 프로필에 속하는지 확인
    if (simulation.profileId !== profile.id) {
      return res.status(403).json({
        success: false,
        message: '이 시뮬레이션을 수정할 권한이 없습니다.',
      });
    }

    // 업데이트
    const updated = await prisma.simulation.update({
      where: { id },
      data: {
        ...(title && { title: title.trim() }),
        updatedAt: new Date(),
        ...(referenceYear !== undefined && { referenceYear: parseInt(String(referenceYear)) }),
        ...(major !== undefined && { major }),
        ...(doubleMajors !== undefined && { doubleMajors: Array.isArray(doubleMajors) ? doubleMajors : [] }),
        ...(minors !== undefined && { minors: Array.isArray(minors) ? minors : [] }),
        ...(advancedMajor !== undefined && { advancedMajor: Boolean(advancedMajor) }),
        ...(individuallyDesignedMajor !== undefined && { individuallyDesignedMajor: Boolean(individuallyDesignedMajor) }),
        ...(earlyGraduation !== undefined && { earlyGraduation: Boolean(earlyGraduation) }),
        ...(courses !== undefined && { courses }),
      },
    });

    return res.json({
      success: true,
      message: '시뮬레이션이 업데이트되었습니다.',
      simulation: {
        id: updated.id,
        title: updated.title,
        updatedAt: updated.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('시뮬레이션 업데이트 오류:', error);
    return res.status(500).json({
      success: false,
      message: '시뮬레이션 업데이트 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
