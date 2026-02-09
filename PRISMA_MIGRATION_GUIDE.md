# Docker 환경에서 Prisma 마이그레이션 가이드

이 문서는 Docker Compose를 사용하는 환경에서 Prisma 스키마 변경 시 마이그레이션을 수행하는 방법을 설명합니다.

## 목차

1. [개요](#개요)
2. [왜 Docker Compose에서 마이그레이션을 자동 실행하지 않나요?](#왜-docker-compose에서-마이그레이션을-자동-실행하지-않나요)
3. [개발 환경에서 마이그레이션](#개발-환경에서-마이그레이션)
4. [프로덕션 환경에서 마이그레이션](#프로덕션-환경에서-마이그레이션)
5. [마이그레이션 생성 및 적용 절차](#마이그레이션-생성-및-적용-절차)
6. [문제 해결](#문제-해결)

## 개요

이 프로젝트는 Docker Compose를 사용하여 다음 서비스를 실행합니다:
- **db**: PostgreSQL 데이터베이스 (포트 5432)
- **server**: 백엔드 서버 (포트 4000)
- **client**: 프론트엔드 서버 (포트 3000)

Prisma 스키마 파일은 `backend/prisma/schema.prisma`에 위치합니다.

### 데이터 보존에 대해

**Prisma 마이그레이션은 기본적으로 기존 데이터를 보존합니다.** 새로운 테이블 추가, 새로운 컬럼 추가(기본값 또는 nullable인 경우), 인덱스 추가 등의 작업은 기존 데이터에 영향을 주지 않습니다.

하지만 **컬럼 삭제, 타입 변경, 제약조건 추가** 등의 작업은 데이터 손실이나 오류가 발생할 수 있으므로 주의가 필요합니다. 자세한 내용은 [주의사항](#주의사항) 섹션을 참고하세요.

## 왜 Docker Compose에서 마이그레이션을 자동 실행하지 않나요?

현재 프로젝트에서는 Docker Compose가 시작될 때 자동으로 마이그레이션을 실행하지 않습니다. 그 이유는 다음과 같습니다:

### 왜 `migrate dev`는 로컬에서 실행하나요?

문서에서 `npx prisma migrate dev`를 로컬에서 실행하고 `docker-compose exec server npx prisma migrate deploy`는 컨테이너에서 실행하는 이유:

**`migrate dev`를 로컬에서 실행하는 이유:**

1. **마이그레이션 파일 생성 및 편집 필요**
   - `migrate dev`는 마이그레이션 파일을 생성합니다
   - 생성된 파일을 확인하고 수정해야 할 수 있습니다
   - 로컬 파일 시스템에서 작업하는 것이 편리합니다

2. **Prisma 스키마 파일 접근**
   - `migrate dev`는 `prisma/schema.prisma` 파일을 읽어야 합니다
   - 로컬에서 실행하면 현재 작업 중인 스키마 파일을 바로 사용할 수 있습니다
   - 컨테이너 내부의 파일은 이미 빌드 시점에 복사된 것이므로 최신이 아닐 수 있습니다

3. **개발 워크플로우**
   - 스키마 수정 → 마이그레이션 생성 → 테스트 → 수정의 반복
   - 로컬에서 실행하면 빠르게 반복할 수 있습니다
   - 컨테이너를 재빌드할 필요가 없습니다

**`migrate deploy`를 컨테이너에서 실행하는 이유:**

1. **이미 생성된 마이그레이션만 적용**
   - `migrate deploy`는 마이그레이션 파일을 생성하지 않습니다
   - 이미 Git에 커밋된 마이그레이션만 적용합니다
   - 컨테이너에 이미 마이그레이션 파일이 포함되어 있습니다

2. **프로덕션 환경**
   - 프로덕션에서는 검토된 마이그레이션만 적용해야 합니다
   - 컨테이너 내부의 마이그레이션 파일이 정확한 버전입니다

**그렇다면 `migrate dev`도 컨테이너에서 실행할 수 있나요?**

가능하지만 권장하지 않습니다:

```bash
# 가능하지만 비권장
docker-compose exec server npx prisma migrate dev --name test
```

문제점:
- 컨테이너 내부에 생성된 마이그레이션 파일을 로컬로 가져와야 함
- 볼륨 마운트가 필요함
- 스키마 파일 수정 후 컨테이너 재시작이 필요할 수 있음
- 개발 워크플로우가 복잡해짐

**권장 워크플로우:**

```bash
# 1. 로컬에서 스키마 수정
vim backend/prisma/schema.prisma

# 2. 로컬에서 마이그레이션 생성 (데이터베이스는 Docker에서 실행)
docker-compose up -d db
cd backend
npx prisma migrate dev --name my_migration

# 3. Git에 커밋
git add prisma/
git commit -m "Add migration"

# 4. 컨테이너 재빌드 및 배포
docker-compose build server
docker-compose up -d server

# 5. 프로덕션에서는 컨테이너에서 마이그레이션 적용
docker-compose exec server npx prisma migrate deploy
```

이렇게 하면:
- 개발은 빠르고 유연하게 진행
- 프로덕션은 안전하게 배포

### 1. **개발 환경의 유연성**

개발 중에는:
- 스키마를 자주 변경하고 테스트해야 합니다
- 마이그레이션을 생성하기 전에 여러 번 수정할 수 있습니다
- 때로는 `prisma db push`로 빠르게 테스트하고 싶을 수 있습니다
- 마이그레이션 파일을 수동으로 검토하고 수정해야 할 수도 있습니다

자동 실행하면 이런 유연성이 제한됩니다.

### 2. **프로덕션과 개발 환경의 차이**

- **개발 환경**: 마이그레이션 파일을 생성하고 검토한 후 적용
- **프로덕션 환경**: 이미 검토된 마이그레이션만 적용 (`migrate deploy`)

자동 실행하면 개발과 프로덕션이 동일하게 동작하지 않을 수 있습니다.

### 3. **에러 처리의 복잡성**

마이그레이션이 실패하면:
- 컨테이너가 시작되지 않을 수 있습니다
- 어떤 마이그레이션이 실패했는지 확인하기 어렵습니다
- 롤백 전략을 수동으로 실행해야 합니다

### 4. **데이터 손실 위험**

자동 실행 시:
- 실수로 잘못된 마이그레이션을 적용할 수 있습니다
- 데이터 손실이 발생해도 즉시 알기 어렵습니다
- 백업 없이 자동 실행하면 복구가 어렵습니다

### 5. **현재 프로젝트 구조**

현재 Dockerfile을 보면:
```dockerfile
# Prisma 클라이언트만 생성
RUN npx prisma generate

# 마이그레이션은 실행하지 않음
CMD ["npm", "run", "start"]
```

이렇게 설계된 이유는:
- **빌드 시점**에는 데이터베이스가 없을 수 있습니다
- **실행 시점**에 데이터베이스가 준비되어 있어야 마이그레이션을 실행할 수 있습니다
- 하지만 실행 시점에 자동 실행하면 위의 문제들이 발생합니다

### 언제 자동 실행이 유용한가?

자동 실행이 유용한 경우:
- **CI/CD 파이프라인**: 테스트 환경에서 자동으로 마이그레이션 적용
- **새로운 개발자 온보딩**: 프로젝트를 처음 클론했을 때 자동 설정
- **프로덕션 배포**: 검토된 마이그레이션을 자동 적용

하지만 현재는 **수동 실행**이 더 안전하고 유연합니다.

## 🚀 빠른 시작 (문제 발생 시)

**"Drift detected" 또는 "Could not find the migration file" 오류가 발생하면:**

```bash
cd backend

# 개발 환경: 가장 간단한 해결 (데이터 초기화됨)
npx prisma migrate reset

# 또는 마이그레이션 없이 스키마 직접 적용
npx prisma db push
```

이 두 명령으로 대부분의 문제가 해결됩니다. 자세한 내용은 아래를 참고하세요.

## 개발 환경에서 마이그레이션

### ⚡ 빠른 해결 방법 (문제 발생 시)

**"Could not find the migration file" 오류가 발생하면:**

```bash
cd backend

# 방법 1: 가장 간단한 해결 (개발 환경, 데이터 손실 가능)
npx prisma migrate reset
# 이렇게 하면 데이터베이스를 초기화하고 모든 마이그레이션을 다시 적용합니다.

# 방법 2: 스키마를 직접 적용 (마이그레이션 파일 없이)
npx prisma db push
# 이렇게 하면 마이그레이션 파일 없이 스키마를 데이터베이스에 직접 적용합니다.
# 주의: 프로덕션에서는 사용하지 마세요!
```

### 1. 스키마 파일 수정

`backend/prisma/schema.prisma` 파일을 편집하여 모델을 추가, 수정 또는 삭제합니다.

예시:
```prisma
model CourseSubstitution {
  id                  String  @id @default(uuid())
  originalCourseCode  String
  substituteCourseCode String
  department          String?
  startYear           Int
  endYear             Int?
  description         String?

  @@index([originalCourseCode])
  @@index([substituteCourseCode])
  @@index([department, startYear])
  @@unique([originalCourseCode, substituteCourseCode, department, startYear])
}
```

### 2. 마이그레이션 파일 생성

로컬에서 마이그레이션 파일을 생성합니다:

```bash
cd backend
npx prisma migrate dev --name <마이그레이션_이름>
```

예시:
```bash
cd backend
npx prisma migrate dev --name add_course_substitutions
```

이 명령은:
- 마이그레이션 파일을 `backend/prisma/migrations/` 디렉토리에 생성합니다
- 로컬 데이터베이스에 마이그레이션을 적용합니다
- Prisma Client를 자동으로 재생성합니다

**주의**: 로컬에 PostgreSQL이 실행 중이어야 합니다. Docker Compose를 사용하는 경우:

```bash
# Docker Compose로 데이터베이스만 실행
docker-compose up -d db

# 마이그레이션 생성 및 적용
cd backend
npx prisma migrate dev --name <마이그레이션_이름>
```

### 3. 마이그레이션 파일 확인

생성된 마이그레이션 파일을 확인합니다:

```bash
ls -la backend/prisma/migrations/
```

마이그레이션 파일은 다음과 같은 구조를 가집니다:
```
migrations/
  └── YYYYMMDDHHMMSS_<마이그레이션_이름>/
      └── migration.sql
```

### 4. Git에 커밋

마이그레이션 파일을 Git에 커밋합니다:

```bash
git add backend/prisma/migrations/
git add backend/prisma/schema.prisma
git commit -m "Add migration: <마이그레이션_이름>"
```

### 5. Docker 컨테이너 재빌드 및 재시작

마이그레이션이 포함된 코드를 배포한 후:

```bash
# 백엔드 컨테이너 재빌드
docker-compose build server

# 모든 서비스 재시작
docker-compose up -d
```

### 6. 프로덕션 데이터베이스에 마이그레이션 적용

프로덕션 환경에서는 `migrate deploy` 명령을 사용합니다:

```bash
# 백엔드 컨테이너에서 마이그레이션 적용
docker-compose exec server npx prisma migrate deploy
```

또는 컨테이너 외부에서:

```bash
# DATABASE_URL 환경 변수 설정 필요
export DATABASE_URL="postgresql://user_id:user_pw@localhost:5432/grad_db?schema=public"
cd backend
npx prisma migrate deploy
```

## 프로덕션 환경에서 마이그레이션

### 방법 1: 컨테이너 내부에서 실행 (권장)

```bash
# 실행 중인 백엔드 컨테이너에 접속하여 마이그레이션 실행
docker-compose exec server npx prisma migrate deploy
```

### 방법 2: 일시적으로 컨테이너 실행

```bash
# 백엔드 이미지를 사용하여 일시적으로 컨테이너 실행
docker-compose run --rm server npx prisma migrate deploy
```

### 방법 3: 로컬에서 직접 실행

```bash
# DATABASE_URL 환경 변수 설정
export DATABASE_URL="postgresql://user_id:user_pw@localhost:5432/grad_db?schema=public"

# 마이그레이션 적용
cd backend
npx prisma migrate deploy
```

## 마이그레이션 생성 및 적용 절차

### 전체 워크플로우

```mermaid
graph TD
    A[스키마 파일 수정] --> B[마이그레이션 파일 생성]
    B --> C[로컬에서 테스트]
    C --> D[Git 커밋]
    D --> E[Docker 이미지 재빌드]
    E --> F[프로덕션 배포]
    F --> G[프로덕션 DB에 마이그레이션 적용]
```

### 단계별 상세 절차

#### 1단계: 스키마 수정 및 마이그레이션 생성

```bash
# 1. 스키마 파일 수정
vim backend/prisma/schema.prisma

# 2. 데이터베이스 서비스만 실행
docker-compose up -d db

# 3. 마이그레이션 생성
cd backend
npx prisma migrate dev --name <설명적인_이름>

# 예시:
# npx prisma migrate dev --name add_course_substitutions
# npx prisma migrate dev --name add_index_to_user_email
```

#### 2단계: 로컬에서 테스트

```bash
# 마이그레이션이 자동으로 적용되었는지 확인
cd backend
npx prisma studio
# 또는
npx prisma db pull  # 스키마와 DB 상태 비교
```

#### 3단계: Git 커밋

```bash
git add backend/prisma/schema.prisma
git add backend/prisma/migrations/
git commit -m "feat: Add CourseSubstitution model"
git push
```

#### 4단계: Docker 이미지 재빌드

```bash
# 백엔드 이미지 재빌드
docker-compose build server

# 또는 전체 재빌드
docker-compose build
```

#### 5단계: 프로덕션 배포

```bash
# 모든 서비스 재시작
docker-compose up -d

# 또는 특정 서비스만 재시작
docker-compose restart server
```

#### 6단계: 프로덕션 데이터베이스에 마이그레이션 적용

```bash
# 실행 중인 컨테이너에서 마이그레이션 적용
docker-compose exec server npx prisma migrate deploy
```

## 문제 해결

### 문제 0: Drift detected 오류

**증상**: `Drift detected: Your database schema is not in sync with your migration history`

**이게 뭔가요?**
- 데이터베이스 스키마와 마이그레이션 파일이 일치하지 않을 때 발생합니다
- 예: `prisma db push`로 직접 적용했거나, 마이그레이션 파일이 삭제된 경우

**⚠️ 주의: `migrate reset`은 모든 데이터를 삭제합니다!**

**데이터 보존이 필요한 경우 (권장):**

```bash
cd backend

# 1. 현재 데이터베이스 상태를 baseline 마이그레이션으로 만들기
TIMESTAMP=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TIMESTAMP}_baseline_sync
echo "-- Baseline: Current database state" > prisma/migrations/${TIMESTAMP}_baseline_sync/migration.sql
npx prisma migrate resolve --applied ${TIMESTAMP}_baseline_sync

# 2. 이제 정상적으로 마이그레이션 사용 가능
npx prisma migrate dev --name <새_마이그레이션_이름>
```

**또는 `db push` 사용 (마이그레이션 파일 없이 스키마만 동기화):**

```bash
cd backend
npx prisma db push
# 이렇게 하면 마이그레이션 파일 없이 스키마를 직접 적용합니다.
# 데이터는 보존되지만, 마이그레이션 히스토리는 관리되지 않습니다.
```

**⚠️ 데이터 삭제해도 되는 경우에만 사용:**

```bash
cd backend
npx prisma migrate reset
# 질문에 'y' 입력하면 모든 데이터가 삭제되고 마이그레이션이 다시 적용됩니다.
# 개발 초기 단계에서만 사용하세요!
```

### 문제 1: 마이그레이션 파일이 없는 경우

**증상**: `Error: P3015 - Could not find the migration file` 또는 `Could not find the migration file`

**⚠️ 주의: `migrate reset`은 모든 데이터를 삭제합니다!**

**데이터 보존이 필요한 경우 (권장):**

```bash
# 1. 마이그레이션 상태 확인
cd backend
npx prisma migrate status

# 2. 빈 마이그레이션 디렉토리 찾기 및 삭제
ls -la prisma/migrations/
# 비어있는 디렉토리가 있으면 삭제
rm -rf prisma/migrations/YYYYMMDDHHMMSS_<이름>

# 3. 현재 상태를 baseline으로 만들기
TIMESTAMP=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TIMESTAMP}_baseline_sync
echo "-- Baseline migration" > prisma/migrations/${TIMESTAMP}_baseline_sync/migration.sql
npx prisma migrate resolve --applied ${TIMESTAMP}_baseline_sync
```

**또는 `db push` 사용 (마이그레이션 파일 없이 스키마만 동기화):**

```bash
cd backend
npx prisma db push
# 데이터는 보존되지만, 마이그레이션 히스토리는 관리되지 않습니다.
```

**⚠️ 데이터 삭제해도 되는 경우에만 사용:**

```bash
cd backend
npx prisma migrate reset
# 질문에 'y' 입력하면 데이터베이스가 초기화되고 모든 마이그레이션이 다시 적용됩니다.
# 개발 초기 단계에서만 사용하세요!
```

### 문제 2: 데이터베이스 연결 실패

**증상**: `Can't reach database server`

**해결 방법**:
```bash
# 1. 데이터베이스 컨테이너 상태 확인
docker-compose ps db

# 2. 데이터베이스 로그 확인
docker-compose logs db

# 3. 데이터베이스 재시작
docker-compose restart db

# 4. DATABASE_URL 환경 변수 확인
docker-compose exec server env | grep DATABASE_URL
```

### 문제 3: 마이그레이션 충돌

**증상**: `Migration conflict` 또는 `Migration already applied`

**해결 방법**:
```bash
# 1. 마이그레이션 상태 확인
cd backend
npx prisma migrate status

# 2. 마이그레이션 히스토리 확인
npx prisma migrate resolve --applied <마이그레이션_이름>

# 3. 롤백이 필요한 경우 (주의: 데이터 손실 가능)
# 마이그레이션 파일을 수동으로 수정하거나
# 데이터베이스를 백업에서 복원
```

### 문제 4: Prisma Client가 업데이트되지 않음

**증상**: 타입 오류 또는 새로운 필드가 인식되지 않음

**해결 방법**:
```bash
# 1. Prisma Client 재생성
cd backend
npx prisma generate

# 2. Docker 컨테이너 재빌드
docker-compose build server
docker-compose up -d server
```

### 문제 5: 마이그레이션 적용 중 오류

**증상**: `Migration failed` 또는 SQL 오류

**해결 방법**:
```bash
# 1. 마이그레이션 SQL 파일 확인
cat backend/prisma/migrations/<마이그레이션_이름>/migration.sql

# 2. 데이터베이스에 직접 연결하여 SQL 실행 테스트
docker-compose exec db psql -U user_id -d grad_db

# 3. 마이그레이션 파일 수정 후 재생성
# (주의: 이미 적용된 마이그레이션은 수정하지 마세요)
```

## 유용한 명령어 모음

### 마이그레이션 관리

```bash
# 마이그레이션 상태 확인
npx prisma migrate status

# 마이그레이션 생성 (개발 환경)
npx prisma migrate dev --name <이름>

# 마이그레이션 적용 (프로덕션)
npx prisma migrate deploy

# 마이그레이션 롤백 (개발 환경만)
npx prisma migrate reset

# 스키마를 데이터베이스에 직접 적용 (마이그레이션 없이)
npx prisma db push

# 데이터베이스 스키마를 Prisma 스키마로 가져오기
npx prisma db pull
```

### Docker 관련

```bash
# 데이터베이스만 실행
docker-compose up -d db

# 백엔드 컨테이너에 접속
docker-compose exec server sh

# 백엔드 컨테이너에서 Prisma 명령 실행
docker-compose exec server npx prisma migrate deploy
docker-compose exec server npx prisma generate
docker-compose exec server npx prisma studio

# 컨테이너 로그 확인
docker-compose logs server
docker-compose logs db

# 컨테이너 재시작
docker-compose restart server
```

### 데이터베이스 접속

```bash
# PostgreSQL에 직접 접속
docker-compose exec db psql -U user_id -d grad_db

# 또는 로컬에서
psql -h localhost -U user_id -d grad_db
```

## 주의사항

### 데이터 보존에 대한 중요 정보

**기본적으로 Prisma 마이그레이션은 기존 데이터를 보존합니다.** 다음 작업들은 데이터 손실 없이 수행됩니다:

✅ **안전한 작업 (데이터 보존됨)**:
- 새로운 모델/테이블 추가
- 새로운 필드/컬럼 추가 (기본값 또는 nullable인 경우)
- 인덱스 추가
- 관계(Relation) 추가
- 기본값이 있는 NOT NULL 필드 추가

⚠️ **주의가 필요한 작업 (데이터 손실 가능)**:
- **필드/컬럼 삭제**: 해당 컬럼의 모든 데이터가 삭제됩니다
- **기본값 없는 NOT NULL 필드 추가**: 기존 레코드에 값이 없어 오류 발생 가능
- **타입 변경**: 호환되지 않는 타입 변경 시 데이터 변환 실패 가능
- **제약조건 추가**: 기존 데이터가 제약조건을 위반하면 오류 발생

### 안전한 마이그레이션 절차

1. **프로덕션 데이터베이스 백업**: 마이그레이션 적용 전에 항상 데이터베이스를 백업하세요.
   ```bash
   # 백업 생성
   docker-compose exec db pg_dump -U user_id grad_db > backup_$(date +%Y%m%d_%H%M%S).sql
   
   # 백업 복원 (필요시)
   # docker-compose exec -T db psql -U user_id grad_db < backup_YYYYMMDD_HHMMSS.sql
   ```

2. **개발 환경에서 먼저 테스트**: 프로덕션에 적용하기 전에 개발 환경에서 충분히 테스트하세요.

3. **마이그레이션 파일 수정 금지**: 이미 적용된 마이그레이션 파일은 절대 수정하지 마세요. 새로운 마이그레이션을 생성하세요.

4. **스키마 동기화**: 팀원들과 협업할 때는 항상 `schema.prisma`와 마이그레이션 파일을 함께 커밋하세요.

5. **환경 변수 확인**: Docker 환경에서는 `DATABASE_URL`이 올바르게 설정되어 있는지 확인하세요.

6. **마이그레이션 순서**: 마이그레이션은 시간순으로 적용되므로, 여러 마이그레이션을 동시에 생성할 때 주의하세요.

### 데이터 손실 위험이 있는 변경 시 권장 절차

데이터 손실 위험이 있는 변경(컬럼 삭제, 타입 변경 등)을 수행할 때:

1. **백업 생성** (필수)
2. **단계별 마이그레이션**:
   ```bash
   # 예: 컬럼 삭제 전에 데이터를 다른 곳으로 이동
   # 1단계: 새 컬럼 추가 (기존 데이터 보존)
   # 2단계: 데이터 마이그레이션 스크립트 실행
   # 3단계: 기존 컬럼 삭제
   ```
3. **데이터 마이그레이션 스크립트 작성**: 필요시 `migration.sql` 파일에 데이터 변환 로직 추가
4. **롤백 계획 수립**: 문제 발생 시 빠르게 복구할 수 있도록 준비

## 참고 자료

- [Prisma 공식 문서 - 마이그레이션](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Migrate 명령어 참조](https://www.prisma.io/docs/reference/api-reference/command-reference#migrate)
- [Docker Compose 문서](https://docs.docker.com/compose/)
