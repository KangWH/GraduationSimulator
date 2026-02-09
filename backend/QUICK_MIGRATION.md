# Prisma 마이그레이션 빠른 가이드

## 문제 발생 시 빠른 해결

### "Drift detected" 오류

**⚠️ 데이터 보존이 필요한 경우:**

```bash
cd backend

# 방법 1: 현재 상태를 baseline으로 만들기 (권장)
TIMESTAMP=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TIMESTAMP}_baseline_sync
echo "-- Baseline: Current database state" > prisma/migrations/${TIMESTAMP}_baseline_sync/migration.sql
npx prisma migrate resolve --applied ${TIMESTAMP}_baseline_sync

# 방법 2: 마이그레이션 없이 스키마 직접 적용
npx prisma db push
# 데이터는 보존되지만, 마이그레이션 히스토리는 관리되지 않습니다.
```

**⚠️ 데이터 삭제해도 되는 경우에만:**

```bash
cd backend
npx prisma migrate reset  # 모든 데이터 삭제됨!
```

### "Could not find the migration file" 오류

**⚠️ 데이터 보존이 필요한 경우:**

```bash
cd backend

# 방법 1: 현재 상태를 baseline으로 만들기 (권장)
TIMESTAMP=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${TIMESTAMP}_baseline_sync
echo "-- Baseline migration" > prisma/migrations/${TIMESTAMP}_baseline_sync/migration.sql
npx prisma migrate resolve --applied ${TIMESTAMP}_baseline_sync

# 방법 2: 마이그레이션 없이 스키마 직접 적용
npx prisma db push
# 데이터는 보존되지만, 마이그레이션 히스토리는 관리되지 않습니다.
```

**⚠️ 데이터 삭제해도 되는 경우에만:**

```bash
cd backend
npx prisma migrate reset  # 모든 데이터 삭제됨!
```

## 정상적인 마이그레이션 절차

### 1. 스키마 수정
`backend/prisma/schema.prisma` 파일 수정

### 2. 마이그레이션 생성 및 적용
```bash
cd backend
npx prisma migrate dev --name <설명>
```

끝! 이게 전부입니다.

## Docker 환경에서

```bash
# 데이터베이스만 실행
docker-compose up -d db

# 마이그레이션
cd backend
npx prisma migrate dev --name <설명>

# 프로덕션 적용
docker-compose exec server npx prisma migrate deploy
```

## 주의사항

- ⚠️ **`migrate reset`**: 모든 데이터를 삭제합니다! 개발 초기 단계에서만 사용하세요.
- `db push`: 개발 환경에서만 사용 (마이그레이션 파일 생성 안 됨, 데이터는 보존됨)
- 프로덕션에서는 항상 `migrate deploy` 사용
- 데이터 보존이 필요하면 baseline 마이그레이션을 만드는 방법을 사용하세요 (위 참고)
