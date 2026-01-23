# 1. 노드 환경 설정
FROM node:20-alpine

# 2. 작업 디렉토리 생성
WORKDIR /app

# 3. 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm install

# 4. 전체 코드 복사
COPY . .

# 5. Prisma 클라이언트 생성 및 빌드
RUN npx prisma generate
RUN npm run build

# 6. 프로덕션 의존성만 유지 (선택사항)
# RUN npm ci --only=production && npm cache clean --force

# 7. 서버 실행
EXPOSE 4000
CMD ["npm", "run", "start"]
