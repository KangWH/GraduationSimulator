# Graduation Simulator

대학 졸업 요건을 시뮬레이션하고 이수 현황을 관리할 수 있는 풀스택 웹 애플리케이션입니다.

**테스트 서버**: [http://158.180.69.191:3000](http://158.180.69.191:3000)

## 주요 기능

- **회원가입/로그인**: 이메일 기반 인증
- **프로필 관리**: 학번, 입학연도, 전공, 복수전공, 부전공 등 학생 정보 설정
- **수강 내역 관리**: 이수한 과목 등록 및 관리 (엑셀 파일 업로드 지원)
- **졸업 요건 시뮬레이션**: 전공별 졸업 요건 대비 이수 현황 확인
- **시나리오 저장**: 여러 시나리오를 저장하고 불러오기
- **졸업 보고서**: PDF 형식으로 졸업 요건 이수 현황 다운로드
- **과목 대체 규칙**: 과목 대체 인정 규칙 적용
- **관리자 기능**: 과목 및 졸업 요건 데이터 관리

## 기술 스택

### Frontend
- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS 4**
- **@react-pdf/renderer** (PDF 생성)
- **xlsx** (엑셀 파일 파싱)

### Backend
- **Express.js**
- **Prisma** (ORM)
- **PostgreSQL**
- **JWT** (인증)
- **bcryptjs** (비밀번호 해싱)

## 프로젝트 구조

```
GraduationSimulator/
├── frontend/          # Next.js 프론트엔드
│   ├── app/
│   │   ├── login/     # 로그인
│   │   ├── signup/    # 회원가입
│   │   ├── profile/   # 프로필 설정
│   │   ├── simulation/# 졸업 시뮬레이션 메인
│   │   └── admin/     # 관리자 페이지
│   └── ...
├── backend/           # Express 백엔드
│   ├── prisma/        # DB 스키마
│   ├── src/
│   │   ├── routes/    # API 라우트
│   │   └── ...
│   └── ...
└── README.md
```

## 시작하기

### 사전 요구사항

- Node.js 18+
- PostgreSQL
- npm 또는 yarn

### 1. 저장소 클론

```bash
git clone https://github.com/woohyun-kang/GraduationSimulator.git
cd GraduationSimulator
```

### 2. 환경 변수 설정

**Backend** (`backend/` 디렉토리):

`.env` 파일을 생성하고 다음 변수를 설정하세요:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="your-jwt-secret-key"
PORT=4000
```

**Frontend** (`frontend/` 디렉토리):

`.env.local` 파일을 생성하세요:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. 데이터베이스 설정

```bash
cd backend
npm install
npx prisma generate
npx prisma db push   # 또는 npx prisma migrate dev
```

### 4. 서버 실행

**터미널 1 - 백엔드:**

```bash
cd backend
npm run dev
```

**터미널 2 - 프론트엔드:**

```bash
cd frontend
npm install
npm run dev
```

### 5. 접속

- **로컬 개발**: 프론트엔드 [http://localhost:3000](http://localhost:3000), 백엔드 API [http://localhost:4000](http://localhost:4000)
- **테스트 서버**: [http://158.180.69.191:3000](http://158.180.69.191:3000)

## API 엔드포인트

| 경로 | 설명 |
|------|------|
| `/auth` | 회원가입, 로그인, 로그아웃 |
| `/profile` | 프로필 관리 |
| `/courses` | 과목 조회 |
| `/simulation` | 시뮬레이션 CRUD |
| `/rules` | 졸업 요건 규칙 |
| `/substitutions` | 과목 대체 규칙 |
| `/admin` | 관리자 기능 |

## 데이터베이스 스키마

- **User**: 사용자 계정
- **Profile**: 학생 프로필 (학번, 전공, 수강 내역 등)
- **Simulation**: 저장된 시뮬레이션 시나리오
- **CourseOffering**: 과목 정보
- **GeneralEdRequirement**: 교양 졸업 요건
- **MajorRequirement**: 전공 졸업 요건
- **CourseSubstitution**: 과목 대체 규칙

## 라이선스

ISC
