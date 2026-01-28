# 1. 노드 환경 설정
FROM node:20-alpine

# 2. 작업 디렉토리 생성
WORKDIR /app

# 3. 의존성 파일 복사 및 설치
COPY package*.json ./
RUN npm install

# 4. Prisma schema 파일 복사 (generate에 필요)
COPY prisma ./prisma

# 5. Prisma 클라이언트 생성
RUN npx prisma generate

# 6. 전체 코드 복사
COPY . .

# 7. TypeScript 빌드
RUN npm run build

# 8. 서버 실행
EXPOSE 4000
CMD ["npm", "run", "start"]
