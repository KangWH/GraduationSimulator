import express, { type Request, type Response } from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import simulationRouter from './routes/simulation.js';

import departments from './departments.json' with { type: 'json' };

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

app.use(cors({
  origin: 'http://localhost:3000', // 프론트엔드 주소
  credentials: true, // 쿠키 및 인증 정보 허용
}));
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('You\'ve accessed the backend server');
});

app.get('/departments', (req, res) => {
  res.json(departments);
});

// 과목 목록 조회 (임시로 빈 배열 반환, 나중에 DB에서 가져오도록 수정)
app.get('/courses', async (req, res) => {
  try {
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const { PrismaClient } = await import('./generated/prisma/client.js');
    const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' });
    const prisma = new PrismaClient({ adapter });
    
    const courses = await prisma.courseOffering.findMany({
      orderBy: { title: 'asc' },
    });
    
    res.json(courses);
  } catch (error: any) {
    console.error('과목 목록 조회 오류:', error);
    res.status(500).json({ error: '과목 목록을 가져오는 중 오류가 발생했습니다.' });
  }
});

app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/simulation', simulationRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
