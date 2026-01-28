import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

import fs from 'fs';
import path from 'path'; // 경로 처리를 위해 추가
import csv from 'csv-parser';

const adapter = new PrismaPg({ connectionString: process.env["DATABASE_URL"] ?? '' });
const prisma = new PrismaClient({ adapter });

const ROMAN_MAP: Record<string, string> = {
  'Ⅰ': 'I', 'Ⅱ': 'II', 'Ⅲ': 'III', 'Ⅳ': 'IV', 'Ⅴ': 'V',
  'Ⅵ': 'VI', 'Ⅶ': 'VII', 'Ⅷ': 'VIII', 'Ⅸ': 'IX', 'Ⅹ': 'X',
  'Ⅺ': 'XI', 'Ⅻ': 'XII', 'Ⅼ': 'L', 'Ⅽ': 'C', 'Ⅾ': 'D', 'Ⅿ': 'M',
  'ⅰ': 'i', 'ⅱ': 'ii', 'ⅲ': 'iii', 'ⅳ': 'iv', 'ⅴ': 'v',
  'ⅵ': 'vi', 'ⅶ': 'vii', 'ⅷ': 'viii', 'ⅸ': 'ix', 'ⅹ': 'x'
};

function normalizeText(input: string): string {
  // 1. 유니코드 로마 숫자를 알파벳으로 치환
  let converted = input.replace(/[Ⅰ-Ⅿⅰ-ⅹ]/g, (match) => ROMAN_MAP[match] || match);

  // 2. 한글(가-힣), 숫자(0-9), 영문(a-zA-Z)만 남기고 제거
  const result = converted.replace(/[^가-힣0-9a-zA-Z]/g, '').toLowerCase();

  return result;
}

async function main() {
  const results: any[] = [];
  // 현재 파일(seed.ts) 위치를 기준으로 CSV 경로 설정
  const csvFilePath = path.resolve(process.cwd(), 'prisma', 'kaist_courses.csv'); 

  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => {
      const searchTitle = normalizeText(data.title);
      results.push({
        code: data.code,
        title: data.title,
        searchTitle: searchTitle,
        department: data.department,
        category: data.category,
        credit: parseInt(data.credit),
        au: parseInt(data.au),
        tags: data.tags ? data.tags.trim().split('|').map((text: string) => text.trim()) : [],
        level: data.level,
        crossRecognition: data.crossRecognition === 'Y'
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
