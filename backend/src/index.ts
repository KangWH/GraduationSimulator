import express, { type Request, type Response } from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('You\'ve accessed the backend server');
});

app.use('/auth', authRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
