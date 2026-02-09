import express, { type Request, type Response } from 'express';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' })
const prisma = new PrismaClient({ adapter });
const router = express.Router();

// 관리자 인증 정보
const ADMIN_ID = 'applemincho';
const ADMIN_PASSWORD = 'yeeheehee';

// UUID 검증 헬퍼 함수
const validateUUID = (id: string | string[] | undefined): string | null => {
  const idStr = typeof id === 'string' ? id : id?.[0];
  if (!idStr) {
    return null;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(idStr)) {
    return null;
  }
  return idStr;
};

// 관리자 인증 미들웨어
const authenticateAdmin = async (req: Request, res: Response, next: express.NextFunction) => {
  const { adminId, adminPassword } = req.body;
  
  if (adminId === ADMIN_ID && adminPassword === ADMIN_PASSWORD) {
    next();
  } else {
    return res.status(401).json({
      success: false,
      message: '관리자 인증에 실패했습니다.'
    });
  }
};

// 관리자 로그인
router.post('/login', async (req: Request, res: Response) => {
  const { adminId, adminPassword } = req.body;
  
  if (adminId === ADMIN_ID && adminPassword === ADMIN_PASSWORD) {
    res.json({
      success: true,
      message: '관리자 로그인 성공'
    });
  } else {
    res.status(401).json({
      success: false,
      message: '관리자 ID 또는 비밀번호가 올바르지 않습니다.'
    });
  }
});

// CSV 파일 업로드를 위한 multer 설정
const upload = multer({ storage: multer.memoryStorage() });

// 과목 정보 업데이트 (CSV 업로드)
router.post('/courses/upload', upload.single('csv'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'CSV 파일을 업로드해주세요.'
      });
    }

    const results: any[] = [];
    const buffer = req.file.buffer;
    const stream = Readable.from(buffer.toString('utf-8'));

    stream
      .pipe(csv())
      .on('data', (data) => {
        results.push({
          code: data.code,
          title: data.title,
          department: data.department,
          category: data.category,
          credit: parseInt(data.credit),
          au: parseInt(data.au),
          tags: data.tags ? data.tags.trim().split('|').map((text: string) => text.trim()) : [],
        });
      })
      .on('end', async () => {
        try {
          await prisma.courseOffering.createMany({
            data: results,
            skipDuplicates: true,
          });
          res.json({
            success: true,
            message: `${results.length}개의 과목 정보가 업데이트되었습니다.`
          });
        } catch (error) {
          console.error('Error inserting courses:', error);
          res.status(500).json({
            success: false,
            message: '과목 정보 업데이트 중 오류가 발생했습니다.'
          });
        }
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        res.status(400).json({
          success: false,
          message: 'CSV 파일 파싱 중 오류가 발생했습니다.'
        });
      });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// GeneralEdRequirement CRUD

// 목록 조회
router.get('/general-ed-requirements', async (req: Request, res: Response) => {
  try {
    const requirements = await prisma.generalEdRequirement.findMany({
      orderBy: [
        { year: 'desc' },
        { type: 'asc' }
      ]
    });
    res.json({
      success: true,
      data: requirements
    });
  } catch (error) {
    console.error('Error fetching general ed requirements:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 단일 조회
router.get('/general-ed-requirements/:id', async (req: Request, res: Response) => {
  try {
    const id = validateUUID(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 ID 형식입니다.'
      });
    }
    const requirement = await prisma.generalEdRequirement.findUnique({
      where: { id }
    });
    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: '요건을 찾을 수 없습니다.'
      });
    }
    res.json({
      success: true,
      data: requirement
    });
  } catch (error) {
    console.error('Error fetching general ed requirement:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 생성
router.post('/general-ed-requirements', async (req: Request, res: Response) => {
  try {
    const { year, type, requirements } = req.body;
    
    if (!year || !type || requirements === undefined) {
      return res.status(400).json({
        success: false,
        message: 'year, type, requirements를 모두 입력해주세요.'
      });
    }

    // requirements가 문자열이면 JSON으로 파싱
    let parsedRequirements = requirements;
    if (typeof requirements === 'string') {
      try {
        parsedRequirements = JSON.parse(requirements);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'requirements는 유효한 JSON 형식이어야 합니다.'
        });
      }
    }

    const requirement = await prisma.generalEdRequirement.create({
      data: {
        year: parseInt(year),
        type,
        requirements: parsedRequirements
      }
    });

    res.json({
      success: true,
      message: '요건이 생성되었습니다.',
      data: requirement
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: '이미 존재하는 year와 type 조합입니다.'
      });
    }
    console.error('Error creating general ed requirement:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 수정
router.put('/general-ed-requirements/:id', async (req: Request, res: Response) => {
  try {
    const id = validateUUID(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 ID 형식입니다.'
      });
    }
    const { year, type, requirements } = req.body;
    
    if (requirements === undefined) {
      return res.status(400).json({
        success: false,
        message: 'requirements를 입력해주세요.'
      });
    }

    // requirements가 문자열이면 JSON으로 파싱
    let parsedRequirements = requirements;
    if (typeof requirements === 'string') {
      try {
        parsedRequirements = JSON.parse(requirements);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'requirements는 유효한 JSON 형식이어야 합니다.'
        });
      }
    }

    const updateData: any = { requirements: parsedRequirements };
    if (year !== undefined) {
      const yearValue = typeof year === 'string' ? year : Array.isArray(year) ? year[0] : year;
      updateData.year = parseInt(String(yearValue));
    }
    if (type !== undefined) {
      updateData.type = typeof type === 'string' ? type : Array.isArray(type) ? type[0] : type;
    }

    const requirement = await prisma.generalEdRequirement.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: '요건이 수정되었습니다.',
      data: requirement
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '요건을 찾을 수 없습니다.'
      });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: '이미 존재하는 year와 type 조합입니다.'
      });
    }
    console.error('Error updating general ed requirement:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 삭제
router.delete('/general-ed-requirements/:id', async (req: Request, res: Response) => {
  try {
    const id = validateUUID(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 ID 형식입니다.'
      });
    }
    
    await prisma.generalEdRequirement.delete({
      where: { id }
    });
    res.json({
      success: true,
      message: '요건이 삭제되었습니다.'
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '요건을 찾을 수 없습니다.'
      });
    }
    console.error('Error deleting general ed requirement:', error);
    const errorMessage = error.message || '서버 오류가 발생했습니다.';
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

// MajorRequirement CRUD

// 목록 조회
router.get('/major-requirements', async (req: Request, res: Response) => {
  try {
    const requirements = await prisma.majorRequirement.findMany({
      orderBy: [
        { year: 'desc' },
        { department: 'asc' },
        { type: 'asc' }
      ]
    });
    res.json({
      success: true,
      data: requirements
    });
  } catch (error) {
    console.error('Error fetching major requirements:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 단일 조회
router.get('/major-requirements/:id', async (req: Request, res: Response) => {
  try {
    const id = validateUUID(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 ID 형식입니다.'
      });
    }
    const requirement = await prisma.majorRequirement.findUnique({
      where: { id }
    });
    if (!requirement) {
      return res.status(404).json({
        success: false,
        message: '요건을 찾을 수 없습니다.'
      });
    }
    res.json({
      success: true,
      data: requirement
    });
  } catch (error) {
    console.error('Error fetching major requirement:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 생성
router.post('/major-requirements', async (req: Request, res: Response) => {
  try {
    const { year, department, type, requirements } = req.body;
    
    if (!year || !department || !type || requirements === undefined) {
      return res.status(400).json({
        success: false,
        message: 'year, department, type, requirements를 모두 입력해주세요.'
      });
    }

    // requirements가 문자열이면 JSON으로 파싱
    let parsedRequirements = requirements;
    if (typeof requirements === 'string') {
      try {
        parsedRequirements = JSON.parse(requirements);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'requirements는 유효한 JSON 형식이어야 합니다.'
        });
      }
    }

    const requirement = await prisma.majorRequirement.create({
      data: {
        year: parseInt(year),
        department,
        type,
        requirements: parsedRequirements
      }
    });

    res.json({
      success: true,
      message: '요건이 생성되었습니다.',
      data: requirement
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: '이미 존재하는 year, department, type 조합입니다.'
      });
    }
    console.error('Error creating major requirement:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 수정
router.put('/major-requirements/:id', async (req: Request, res: Response) => {
  try {
    const id = validateUUID(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 ID 형식입니다.'
      });
    }
    const { year, department, type, requirements } = req.body;
    
    if (requirements === undefined) {
      return res.status(400).json({
        success: false,
        message: 'requirements를 입력해주세요.'
      });
    }

    // requirements가 문자열이면 JSON으로 파싱
    let parsedRequirements = requirements;
    if (typeof requirements === 'string') {
      try {
        parsedRequirements = JSON.parse(requirements);
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: 'requirements는 유효한 JSON 형식이어야 합니다.'
        });
      }
    }

    const updateData: any = { requirements: parsedRequirements };
    if (year !== undefined) {
      const yearValue = typeof year === 'string' ? year : Array.isArray(year) ? year[0] : year;
      updateData.year = parseInt(String(yearValue));
    }
    if (department !== undefined) {
      updateData.department = typeof department === 'string' ? department : Array.isArray(department) ? department[0] : department;
    }
    if (type !== undefined) {
      updateData.type = typeof type === 'string' ? type : Array.isArray(type) ? type[0] : type;
    }

    const requirement = await prisma.majorRequirement.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: '요건이 수정되었습니다.',
      data: requirement
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '요건을 찾을 수 없습니다.'
      });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: '이미 존재하는 year, department, type 조합입니다.'
      });
    }
    console.error('Error updating major requirement:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 삭제
router.delete('/major-requirements/:id', async (req: Request, res: Response) => {
  try {
    const id = validateUUID(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 ID 형식입니다.'
      });
    }
    
    await prisma.majorRequirement.delete({
      where: { id }
    });
    res.json({
      success: true,
      message: '요건이 삭제되었습니다.'
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '요건을 찾을 수 없습니다.'
      });
    }
    console.error('Error deleting major requirement:', error);
    const errorMessage = error.message || '서버 오류가 발생했습니다.';
    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

// ========== 대체과목 관리 ==========

// 목록 조회
router.get('/substitutions', async (req: Request, res: Response) => {
  try {
    const substitutions = await prisma.courseSubstitution.findMany({
      orderBy: [
        { department: 'asc' },
        { originalCourseCode: 'asc' },
        { startYear: 'desc' },
      ],
    });
    res.json({
      success: true,
      data: substitutions
    });
  } catch (error: any) {
    console.error('Error fetching substitutions:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 생성
router.post('/substitutions', async (req: Request, res: Response) => {
  try {
    const { originalCourseCode, substituteCourseCode, department, startYear, endYear, description } = req.body;
    
    if (!originalCourseCode || !substituteCourseCode || !startYear) {
      return res.status(400).json({
        success: false,
        message: 'originalCourseCode, substituteCourseCode, startYear를 모두 입력해주세요.'
      });
    }

    const substitution = await prisma.courseSubstitution.create({
      data: {
        originalCourseCode,
        substituteCourseCode,
        department: department || null,
        startYear: parseInt(startYear),
        endYear: endYear ? parseInt(endYear) : null,
        description: description || null,
      }
    });

    res.json({
      success: true,
      message: '대체과목이 생성되었습니다.',
      data: substitution
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: '이미 존재하는 대체과목 조합입니다.'
      });
    }
    console.error('Error creating substitution:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 수정
router.put('/substitutions/:id', async (req: Request, res: Response) => {
  try {
    const id = validateUUID(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 ID 형식입니다.'
      });
    }
    const { originalCourseCode, substituteCourseCode, department, startYear, endYear, description } = req.body;
    
    const updateData: any = {};
    if (originalCourseCode !== undefined) updateData.originalCourseCode = originalCourseCode;
    if (substituteCourseCode !== undefined) updateData.substituteCourseCode = substituteCourseCode;
    if (department !== undefined) updateData.department = department || null;
    if (startYear !== undefined) updateData.startYear = parseInt(String(startYear));
    if (endYear !== undefined) updateData.endYear = endYear ? parseInt(String(endYear)) : null;
    if (description !== undefined) updateData.description = description || null;

    const substitution = await prisma.courseSubstitution.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: '대체과목이 수정되었습니다.',
      data: substitution
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '대체과목을 찾을 수 없습니다.'
      });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: '이미 존재하는 대체과목 조합입니다.'
      });
    }
    console.error('Error updating substitution:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

// 삭제
router.delete('/substitutions/:id', async (req: Request, res: Response) => {
  try {
    const id = validateUUID(req.params.id);
    if (!id) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 ID 형식입니다.'
      });
    }
    
    await prisma.courseSubstitution.delete({
      where: { id }
    });
    res.json({
      success: true,
      message: '대체과목이 삭제되었습니다.'
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        message: '대체과목을 찾을 수 없습니다.'
      });
    }
    console.error('Error deleting substitution:', error);
    res.status(500).json({
      success: false,
      message: '서버 오류가 발생했습니다.'
    });
  }
});

export default router;
