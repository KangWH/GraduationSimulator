import express, { type Request, type Response } from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';

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

app.use('/auth', authRouter);
app.use('/profile', profileRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
