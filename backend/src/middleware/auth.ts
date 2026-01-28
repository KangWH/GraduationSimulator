import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT 시크릿 키 (환경변수에서 가져오거나 기본값 사용)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Request 타입 확장
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export interface AuthRequest extends Request {
  userId: string;
}

/**
 * 인증 미들웨어 - 쿠키에서 JWT 토큰을 읽고 검증합니다.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    // 쿠키에서 토큰 읽기
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '인증이 필요합니다.',
      });
    }

    // JWT 토큰 검증
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 토큰입니다.',
      });
    }
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: '인증 처리 중 오류가 발생했습니다.',
    });
  }
};

/**
 * 선택적 인증 미들웨어 - 토큰이 있으면 검증하고, 없어도 통과합니다.
 */
export const optionalAuthenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.token;
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      req.userId = decoded.userId;
    }
    next();
  } catch (error) {
    // 토큰이 유효하지 않아도 통과 (선택적 인증)
    next();
  }
};

export { JWT_SECRET };
