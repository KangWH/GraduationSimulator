import express, { type Request, type Response } from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import coursesRouter from './routes/courses.js';
import simulationRouter from './routes/simulation.js';

import departments from './departments.json' with { type: 'json' };
import courseCategories from './categories.json' with { type: 'json' };

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

app.get('/courseCategories', (req, res) => {
  res.json(courseCategories);
});
app.get('/departments', (req, res) => {
  res.json(departments);
});

app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/courses', coursesRouter);
app.use('/simulation', simulationRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
