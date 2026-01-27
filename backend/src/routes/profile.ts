import express, { type Request, type Response } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { authenticate } from '../middleware/auth.js';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' })
const prisma = new PrismaClient({ adapter });
const router = express.Router();

// Profile 생성 (기본 정보 입력)
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { studentId, name, admissionYear, isFallAdmission, major, doubleMajor, minor, advancedMajor, individuallyDesignedMajor } = req.body;

    // 필수 필드 검증
    if (!name || !studentId || !admissionYear || !major) {
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
    const doubleMajorsArray = Array.isArray(doubleMajor) ? doubleMajor : doubleMajor ? [doubleMajor] : [];
    const minorsArray = Array.isArray(minor) ? minor : minor ? [minor] : [];
    // 유효한 값만 필터링 (빈 문자열, null, undefined, "none" 제거)
    const validDoubleMajors = doubleMajorsArray.filter((v) => v && typeof v === 'string' && v.trim() !== '' && v !== 'none');
    const validMinors = minorsArray.filter((v) => v && typeof v === 'string' && v.trim() !== '' && v !== 'none');

    const profile = await prisma.profile.create({
      data: {
        userId,
        studentId,
        name,
        admissionYear: parseInt(admissionYear.toString()),
        isFallAdmission: isFallAdmission || false,
        major,
        doubleMajors: validDoubleMajors,
        minors: validMinors,
        advancedMajor: advancedMajor || false,
        individuallyDesignedMajor: individuallyDesignedMajor || false,
        enrollments: [],
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
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId },
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
router.patch('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { name, admissionYear, isFallAdmission, major, doubleMajor, minor, advancedMajor, individuallyDesignedMajor, enrollments } = req.body;

    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, message: '기본 정보를 찾을 수 없습니다.' });
    }

    const data: {
      name?: string;
      admissionYear?: number;
      isFallAdmission?: boolean;
      major?: string;
      doubleMajors?: string[];
      minors?: string[];
      advancedMajor?: boolean;
      individuallyDesignedMajor?: boolean;
      enrollments?: any;
    } = {};
    if (name !== undefined) data.name = name;
    if (admissionYear !== undefined) data.admissionYear = parseInt(admissionYear.toString());
    if (isFallAdmission !== undefined) data.isFallAdmission = !!isFallAdmission;
    if (major !== undefined) data.major = major;
    if (doubleMajor !== undefined) {
      const doubleMajorsArray = Array.isArray(doubleMajor) ? doubleMajor : doubleMajor ? [doubleMajor] : [];
      data.doubleMajors = doubleMajorsArray.filter((v) => v && typeof v === 'string' && v.trim() !== '' && v !== 'none');
    }
    if (minor !== undefined) {
      const minorsArray = Array.isArray(minor) ? minor : minor ? [minor] : [];
      data.minors = minorsArray.filter((v) => v && typeof v === 'string' && v.trim() !== '' && v !== 'none');
    }
    if (advancedMajor !== undefined) data.advancedMajor = !!advancedMajor;
    if (individuallyDesignedMajor !== undefined) data.individuallyDesignedMajor = !!individuallyDesignedMajor;
    if (enrollments !== undefined) data.enrollments = enrollments;

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

// 수강 내역 저장 (POST/PUT/PATCH 모두 지원)
// 수강 내역 조회
router.get('/enrollments', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }

    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, message: '프로필을 찾을 수 없습니다.' });
    }

    let enrollments: unknown = profile.enrollments;
    if (enrollments == null) {
      enrollments = [];
    } else if (typeof enrollments === 'string') {
      try {
        enrollments = JSON.parse(enrollments);
      } catch {
        enrollments = [];
      }
    }
    if (!Array.isArray(enrollments)) {
      enrollments = [];
    }

    res.status(200).json({ success: true, enrollments });
  } catch (error) {
    console.error('Enrollment fetch error:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// 수강 내역 저장
router.post('/enrollments', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { enrollments } = req.body;

    if (!Array.isArray(enrollments)) {
      return res.status(400).json({ success: false, message: 'enrollments는 배열이어야 합니다.' });
    }

    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, message: '프로필을 찾을 수 없습니다.' });
    }

    const payload = JSON.stringify(enrollments);
    const updated = await prisma.profile.update({
      where: { userId },
      data: { enrollments: payload as any },
    });

    res.status(200).json({ success: true, message: '수강 내역이 저장되었습니다.', profile: updated });
  } catch (error) {
    console.error('Enrollment save error:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

router.put('/enrollments', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { enrollments } = req.body;

    if (!Array.isArray(enrollments)) {
      return res.status(400).json({ success: false, message: 'enrollments는 배열이어야 합니다.' });
    }

    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, message: '프로필을 찾을 수 없습니다.' });
    }

    const updated = await prisma.profile.update({
      where: { userId },
      data: { enrollments },
    });

    res.status(200).json({ success: true, message: '수강 내역이 저장되었습니다.', profile: updated });
  } catch (error) {
    console.error('Enrollment save error:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

router.patch('/enrollments', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: '인증이 필요합니다.' });
    }
    const { enrollments } = req.body;

    if (!Array.isArray(enrollments)) {
      return res.status(400).json({ success: false, message: 'enrollments는 배열이어야 합니다.' });
    }

    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      return res.status(404).json({ success: false, message: '프로필을 찾을 수 없습니다.' });
    }

    const updated = await prisma.profile.update({
      where: { userId },
      data: { enrollments },
    });

    res.status(200).json({ success: true, message: '수강 내역이 저장되었습니다.', profile: updated });
  } catch (error) {
    console.error('Enrollment save error:', error);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

export default router;
