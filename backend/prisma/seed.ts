import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

import fs from 'fs';
import path from 'path'; // 경로 처리를 위해 추가
import csv from 'csv-parser';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' });
const prisma = new PrismaClient({ adapter });

async function main() {
  const results: any[] = [];
  // 현재 파일(seed.ts) 위치를 기준으로 CSV 경로 설정
  const csvFilePath = path.resolve(process.cwd(), 'prisma', 'kaist_temp_courses.csv'); 

  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => {
      results.push({
        code: data.code,
        title: data.title,
        department: data.department,
        category: data.category,
        credit: parseInt(data.credit),
        au: parseInt(data.au),
        tags: data.tags ? data.tags.trim().split('|').map((text: string) => text.trim()) : [],
      });
    })
    .on('end', async () => {
      console.log('🌱 데이터 적재 시작...');
      await prisma.courseOffering.createMany({
        data: results,
        skipDuplicates: true,
      });
      console.log('✅ 적재 완료!');
      await prisma.$disconnect();
    });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
