import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { Filter, Requirement } from './types';
import { Section } from './sectionBuilder';

// 1. 한글 폰트 등록
Font.register({
  family: 'Pretendard',
  fonts: [
    {
      src: `/fonts/Pretendard/Pretendard-Light.otf`,
      fontWeight: 300,
    },
    {
      src: `/fonts/Pretendard/Pretendard-Regular.otf`,
      fontWeight: 400,
    },
    {
      src: `/fonts/Pretendard/Pretendard-Medium.otf`,
      fontWeight: 500,
    },
    {
      src: `/fonts/Pretendard/Pretendard-SemiBold.otf`,
      fontWeight: 600,
    },
    {
      src: `/fonts/Pretendard/Pretendard-Bold.otf`,
      fontWeight: 700,
    },
  ]
});

// 2. 스타일 정의
const styles = StyleSheet.create({
  page: {
    paddingTop: '15mm',
    paddingHorizontal: '15mm',
    paddingBottom: '20mm',
    lineHeight: 1.5,
    fontFamily: 'Pretendard',
    fontSize: 9,
  },
  headerContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },

  title: {
    marginBottom: 2,
    lineHeight: 1.5,
    fontSize: 18,
    fontWeight: 'bold'
  },
  subTitle: {
    marginBottom: 4,
    lineHeight: 1.5,
    fontSize: 8
  },
  warning: { lineHeight: 1.5, fontSize: 8, color: '#991b1b' },
  
  // 섹션 제목
  h1: { lineHeight: 1.5, fontSize: 14.4, fontWeight: 700, marginTop: 16, marginBottom: 5 },
  h2: { lineHeight: 1.5, fontSize: 12, fontWeight: 600, marginTop: 8, marginBottom: 5 },

  // 공통 테이블 스타일
  table: { width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#ccc', marginBottom: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ccc' },
  tableHeader: { backgroundColor: '#f3f4f6', fontWeight: 600 },
  tableCell: { padding: 4, paddingTop: 5, paddingBottom: 3.5, textAlign: 'center', borderRightWidth: 1, borderRightColor: '#ccc' },
  lastCell: { borderRightWidth: 0 },

  // 요건 상세 테이블 (Grid 레이아웃 모방)
  reqRow: { paddingTop: 3, paddingBottom: 1, flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'center' },
  colIndex: { width: 25, textAlign: 'center' },
  colDesc: { flex: 1, textAlign: 'left' },
  colValue: { width: 45, textAlign: 'center' },
  colCriteria: { width: 45, textAlign: 'center' },
  colPass: { width: 50, textAlign: 'center' },
  
  courseText: { lineHeight: 1.5, fontSize: 8, color: '#666', marginTop: 1 },
  subtotal: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 3, paddingBottom: 1, backgroundColor: '#f9fafb', fontWeight: 500 }
});

// 3. 요건 테이블 컴포넌트
const PDFRequirementsTable = ({ requirements, title, isMajor = false }: { requirements: Requirement[], title: string, isMajor?: boolean}) => {
  if (!requirements || requirements.length < 1)
    return <View style={{ marginBottom: 15 }} wrap={false}>
      <Text style={styles.h2}>{title}</Text>
      <Text style={{ lineHeight: 1.5, fontSize: 9 }}>요건 없음</Text>;
    </View>

  const sortedRequirements = [...requirements].sort((a, b) => {
    const getPriority = (r: Requirement) => (r.isKey ? 2 : (r.isSecondaryKey ? 1 : 0));
    return getPriority(b) - getPriority(a);
  });

  return (
    <View style={{ marginBottom: 15 }} wrap={false}>
      <Text style={styles.h2}>{title}</Text>
      
      {/* 헤더 */}
      <View style={[styles.reqRow, styles.tableHeader, { borderBottomWidth: 1, borderBottomColor: '#888' }]}>
        <Text style={styles.colIndex}></Text>
        <Text style={[styles.colDesc, { textAlign: 'center' }]}>요건</Text>
        <Text style={styles.colValue}>취득</Text>
        <Text style={styles.colCriteria}>기준</Text>
        <Text style={styles.colPass}>달성여부</Text>
      </View>

      {/* 데이터 행 */}
      {sortedRequirements.map((req, i) => (
        <View key={i} style={styles.reqRow}>
          <View style={styles.colIndex}>
            <Text>{i + 1}</Text>
          </View>
          <View style={styles.colDesc}>
            <Text>
              {req.isKey ? (isMajor ? '전공필수 학점 총합' : '학점 총합') 
              : req.isSecondaryKey ? (isMajor ? '전공선택 학점 총합' : 'AU 총합') 
              : (req.description || req.title)}
            </Text>
            {!req.isKey && !req.isSecondaryKey && (
              <Text style={styles.courseText}>
                이수: {(req.usedCourses || []).map(c => c.course.code).sort().join(', ') || '없음'}
              </Text>
            )}
          </View>
          <Text style={styles.colValue}>{req.currentValue || 0}</Text>
          <Text style={styles.colCriteria}>{req.value || 0}</Text>
          <Text style={[styles.colPass, { color: req.fulfilled ? '#059669' : '#dc2626' }]}>
            {req.fulfilled ? '달성' : '미달성'}
          </Text>
        </View>
      ))}

      {/* 소계 */}
      <View style={styles.subtotal}>
        <Text>소계</Text>
        <Text>{requirements.filter(r => r.fulfilled).length}/{requirements.length} 달성</Text>
      </View>
    </View>
  );
};

// 4. 메인 PDF 문서
const GraduationReportPDF = ({ totalStats, canGraduate, sections, filters, getDeptName }: { totalStats: { totalCredit: number, totalAu: number, gpa: string }, canGraduate: boolean, sections: Section[], filters: Filter, getDeptName: (department: string) => string }) => {
  const currentTime = new Date();
  const timeStr = `${currentTime.getFullYear()}년 ${currentTime.getMonth() + 1}월 ${currentTime.getDate()}일 ${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 상단 헤더 */}
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.title}>졸업 시뮬레이션 결과 보고서</Text>
            <Text style={styles.subTitle}>시행 일시: {timeStr}</Text>
            <Text style={styles.warning}>주의: 본 문서는 참고용이며, 법적·행정적 효력이 없습니다.</Text>
          </View>
          {/* 로고 대신 텍스트 혹은 Image 컴포넌트 사용 가능 */}
          <View>
            <Text style={{ fontSize: 14, fontWeight: 'bold' }}>grad</Text><Text style={{ fontSize: 14, fontWeight: 300 }}>.log</Text>
          </View>
        </View>

        {/* 요약 테이블 */}
        <Text style={styles.h1}>요약</Text>
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={[styles.tableCell, { width: '15%' }]}>이수 학점</Text>
            <Text style={[styles.tableCell, { width: '15%' }]}>이수 AU</Text>
            <Text style={[styles.tableCell, { width: '15%' }]}>평점</Text>
            <Text style={[styles.tableCell, { width: '15%' }]}>졸업구분</Text>
            <Text style={[styles.tableCell, { width: '15%', borderRightWidth: 0 }]}>결과</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, { width: '15%' }]}>{totalStats.totalCredit}</Text>
            <Text style={[styles.tableCell, { width: '15%' }]}>{totalStats.totalAu}</Text>
            <Text style={[styles.tableCell, { width: '15%' }]}>{totalStats.gpa}</Text>
            <Text style={[styles.tableCell, { width: '15%' }]}>{filters.earlyGraduation ? '조기졸업' : '정규졸업'}</Text>
            <Text style={[styles.tableCell, { width: '15%', borderRightWidth: 0, color: canGraduate ? '#059669' : '#dc2626' }]}>
              {canGraduate ? '졸업 가능' : '졸업 불가'}
            </Text>
          </View>
        </View>

        {/* 요건별 상세 */}
        <Text style={styles.h1}>요건별 달성 여부</Text>

        <PDFRequirementsTable 
          title="교양필수" 
          requirements={sections.find(s => s.id === 'MANDATORY_GENERAL_COURSES')?.requirements || []} 
        />
        <PDFRequirementsTable 
          title="인문사회선택" 
          requirements={sections.find(s => s.id === 'HUMANITIES_SOCIETY_ELECTIVE')?.requirements || []} 
        />
        <PDFRequirementsTable 
          title="기초필수" 
          requirements={sections.find(s => s.id === 'BASIC_REQUIRED')?.requirements || []} 
        />
        <PDFRequirementsTable 
          title="기초선택" 
          requirements={sections.find(s => s.id === 'BASIC_ELECTIVE')?.requirements || []} 
        />
        <PDFRequirementsTable 
          title={`전공: ${getDeptName(filters.major)}`} 
          requirements={sections.find(s => s.id.startsWith('MAJOR'))?.requirements || []}
          isMajor={true}
        />
        <PDFRequirementsTable 
          title="연구" 
          requirements={sections.find(s => s.id.startsWith('RESEARCH'))?.requirements || []}
        />
        {filters.doubleMajors.map(dept => (
          <PDFRequirementsTable 
            key={dept}
            title={`복수전공: ${getDeptName(dept)}`}
            requirements={sections.find(s => s.id === `DOUBLE_MAJOR_${dept}`)?.requirements || []}
            isMajor={true}
          />
        ))}
        {filters.minors.map(dept => (
          <PDFRequirementsTable 
            key={dept}
            title={`부전공: ${getDeptName(dept)}`}
            requirements={sections.find(s => s.id === `MINOR_${dept}`)?.requirements || []}
          />
        ))}
        {filters.advancedMajor && <PDFRequirementsTable
          title="심화전공"
          requirements={sections.find(s => s.id.startsWith('ADVANCED'))?.requirements || []}
        />}
        {filters.individuallyDesignedMajor && <PDFRequirementsTable
          title="자유융합전공"
          requirements={sections.find(s => s.id === 'INDIVIDUALLY_DESIGNED_MAJOR')?.requirements || []}
        />}

      </Page>
    </Document>
  );
};

export default GraduationReportPDF;
