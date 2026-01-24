import express, { type Request, type Response } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' })
const prisma = new PrismaClient({ adapter });
const router = express.Router();

// Profile 생성 (기본 정보 입력)
router.post('/', async (req: Request, res: Response) => {
  try {
    // TODO: 실제로는 JWT 토큰에서 userId를 가져와야 함
    // 임시로 body에서 userId를 받음 (나중에 인증 미들웨어로 변경)
    const { userId, studentId, name, admissionYear, isFallAdmission, major, doubleMajor, minor, advancedMajor, individuallyDesignedMajor } = req.body;

    // 필수 필드 검증
    if (!userId || !name || !studentId || !admissionYear || !major) {
      return res.status(400).json({ 
        success: false,
        message: '필수 정보를 모두 입력해주세요.'
      });
    }

    // 사용자 존재 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: '사용자를 찾을 수 없습니다.' 
      });
    }

    // 이미 Profile이 있는지 확인
    if (user.profile) {
      return res.status(409).json({ 
        success: false,
        message: '이미 기본 정보가 등록되어 있습니다.' 
      });
    }

    // 2016년 이전 입학생은 가입 제한
    if (admissionYear < 2016) {
      return res.status(400).json({ 
        success: false,
        message: '2016년 및 그 이후 입학생만 가입할 수 있습니다.' 
      });
    }

    // 학번 중복 체크
    const existingProfile = await prisma.profile.findUnique({
      where: { studentId },
    });

    if (existingProfile) {
      return res.status(409).json({ 
        success: false,
        message: '이미 사용 중인 학번입니다.' 
      });
    }

    // Profile 생성
    const profile = await prisma.profile.create({
      data: {
        userId,
        studentId,
        name,
        admissionYear: parseInt(admissionYear.toString()),
        isFallAdmission: isFallAdmission || false,
        major,
        doubleMajor: doubleMajor || null,
        minor: minor || null,
        advancedMajor: advancedMajor || false,
        individuallyDesignedMajor: individuallyDesignedMajor || false,
      },
    });

    res.status(201).json({
      success: true,
      message: '기본 정보가 저장되었습니다.',
      profile: {
        id: profile.id,
        studentId: profile.studentId,
        major: profile.major,
      },
    });
  } catch (error) {
    console.error('Profile creation error:', error);
    res.status(500).json({ 
      success: false,
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// Profile 조회
router.get('/', async (req: Request, res: Response) => {
  try {
    // TODO: 실제로는 JWT 토큰에서 userId를 가져와야 함
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ 
        success: false,
        message: '사용자 ID가 필요합니다.' 
      });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: { enrollments: { include: { course: true } } },
    });

    if (!profile) {
      return res.status(404).json({ 
        success: false,
        message: '기본 정보를 찾을 수 없습니다.' 
      });
    }

    res.status(200).json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      success: false,
      message: '서버 오류가 발생했습니다.' 
    });
  }
});

// Profile 수정
router.patch('/', async (req: Request, res: Response) => {
  try {
    const { userId, name, admissionYear, isFallAdmission, major, doubleMajor, minor, advancedMajor, individuallyDesignedMajor } = req.body;

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ success: false, message: '사용자 ID가 필요합니다.' });
    }

    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, message: '기본 정보를 찾을 수 없습니다.' });
    }

    const data: {
      name?: string;
      admissionYear?: number;
      isFallAdmission?: boolean;
      major?: string;
      doubleMajor?: string | null;
      minor?: string | null;
      advancedMajor?: boolean;
      individuallyDesignedMajor?: boolean;
    } = {};
    if (name !== undefined) data.name = name;
    if (admissionYear !== undefined) data.admissionYear = parseInt(admissionYear.toString());
    if (isFallAdmission !== undefined) data.isFallAdmission = !!isFallAdmission;
    if (major !== undefined) data.major = major;
    if (doubleMajor !== undefined) data.doubleMajor = doubleMajor || null;
    if (minor !== undefined) data.minor = minor || null;
    if (advancedMajor !== undefined) data.advancedMajor = !!advancedMajor;
    if (individuallyDesignedMajor !== undefined) data.individuallyDesignedMajor = !!individuallyDesignedMajor;

    const updated = await prisma.profile.update({
      where: { userId },
      data,
    });

    res.status(200).json({ success: true, message: '프로필이 수정되었습니다.', profile: updated });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 수강 과목 삭제 (들은 과목 변경용)
router.delete('/enrollments/:id', async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const userIdParam = req.query.userId;
    const id = typeof idParam === 'string' ? idParam : Array.isArray(idParam) ? idParam[0] : undefined;
    let userId: string | undefined;
    if (typeof userIdParam === 'string') {
      userId = userIdParam;
    } else if (Array.isArray(userIdParam) && userIdParam.length > 0 && typeof userIdParam[0] === 'string') {
      userId = userIdParam[0];
    }
    if (!userId || !id) {
      return res.status(400).json({ success: false, message: 'userId와 enrollment id가 필요합니다.' });
    }
    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, message: '프로필을 찾을 수 없습니다.' });
    }
    const enrollment = await prisma.enrollment.findFirst({
      where: { id: id as string, profileId: profile.id },
    });
    if (!enrollment) {
      return res.status(404).json({ success: false, message: '수강 과목을 찾을 수 없습니다.' });
    }
    await prisma.enrollment.delete({ where: { id: id as string } });
    res.status(200).json({ success: true, message: '수강 과목이 삭제되었습니다.' });
  } catch (error) {
    console.error('Enrollment delete error:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
