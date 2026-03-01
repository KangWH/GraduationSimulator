import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import { Filter, Requirement } from './types';
import { Section } from './sectionBuilder';
import type { SubstitutionMap } from './conditionTester';
import { formatYearSemester, getRemarks, computeSectionSubtotal } from './reportCourseListUtils';
import type { CourseSimulation } from './types';

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
  subtotal: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 3, paddingBottom: 1, backgroundColor: '#f9fafb', fontWeight: 500 },

  // 이수 과목 목록 테이블
  courseListTable: { width: '100%', marginBottom: 8 },
  courseListRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee' },
  courseListHeader: { backgroundColor: '#f3f4f6', fontWeight: 600, borderBottomWidth: 1, borderBottomColor: '#888' },
  courseListCell: { padding: 4, paddingTop: 3, paddingBottom: 1, textAlign: 'center' },
  courseListCellLeft: { textAlign: 'left' },
  courseListLastCell: { borderRightWidth: 0 },
  courseListSubtotal: { flexDirection: 'row', backgroundColor: '#f9fafb', fontWeight: 500 }
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
        <Text style={styles.colPass}>달성 여부</Text>
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

// 4. 이수 과목 목록 (섹션별)
const PDFCourseListSection = ({
  section,
  substitutionMap,
  majorDepartment,
  getCategoryName,
}: {
  section: Section;
  substitutionMap: SubstitutionMap | undefined;
  majorDepartment: string;
  getCategoryName: (categoryId: string) => string;
}) => {
  if (!section.courses || section.courses.length === 0) return null;
  const semesterOrder = ['SPRING', 'SUMMER', 'FALL', 'WINTER'] as const;
  const sortedCourses = [...section.courses].sort((a: CourseSimulation, b: CourseSimulation) => {
    if (a.enrolledYear !== b.enrolledYear) return a.enrolledYear - b.enrolledYear;
    return semesterOrder.indexOf(a.enrolledSemester) - semesterOrder.indexOf(b.enrolledSemester);
  });
  const col = (width: number, left?: boolean) => (width === 0 ? { flex: 1, ...styles.courseListCell, ...(left ? styles.courseListCellLeft : {})} : { width, ...styles.courseListCell, ...(left ? styles.courseListCellLeft : {}) });
  return (
    <View style={{ marginBottom: 10 }} wrap={false}>
      <Text style={styles.h2}>{section.title}</Text>
      <View style={styles.courseListTable}>
        <View style={[styles.courseListRow, styles.courseListHeader]}>
          <Text style={[col(56)]}>과목 코드</Text>
          <Text style={[col(0, true)]}>제목</Text>
          <Text style={[col(56)]}>이수 학기</Text>
          <Text style={[col(56)]}>과목 구분</Text>
          <Text style={[col(24)]}>학점</Text>
          <Text style={[col(24)]}>AU</Text>
          <Text style={[col(24)]}>성적</Text>
          <Text style={[col(60), styles.courseListLastCell]}>비고</Text>
        </View>
        {sortedCourses.map((cs: CourseSimulation, i: number) => {
          const remarks = getRemarks(cs, substitutionMap, majorDepartment);
          return (
            <View key={`${cs.courseId}-${cs.enrolledYear}-${cs.enrolledSemester}-${i}`} style={styles.courseListRow}>
              <Text style={[col(56)]}>{cs.course.code}</Text>
              <Text style={[col(0, true)]}>{cs.course.title}</Text>
              <Text style={[col(56)]}>{formatYearSemester(cs.enrolledYear, cs.enrolledSemester)}</Text>
              <Text style={[col(56)]}>{getCategoryName(cs.course.category)}</Text>
              <Text style={[col(24)]}>{cs.course.credit}</Text>
              <Text style={[col(24)]}>{cs.course.au || '-'}</Text>
              <Text style={[col(24)]}>{cs.grade}</Text>
              <Text style={[col(60), styles.courseListLastCell]}>{remarks.join(', ') || '-'}</Text>
            </View>
          );
        })}
        {(() => {
          const { creditSum, auSum, gpa } = computeSectionSubtotal(sortedCourses);
          return (
            <View style={[styles.courseListSubtotal]}>
              <Text style={[col(56, true)]}>소계</Text>
              <Text style={[col(0, true)]}></Text>
              <Text style={[col(56)]}></Text>
              <Text style={[col(56)]}></Text>
              <Text style={[col(24)]}>{creditSum}</Text>
              <Text style={[col(24)]}>{auSum}</Text>
              <Text style={[col(24)]}>{gpa}</Text>
              <Text style={[col(60), styles.courseListLastCell]}></Text>
            </View>
          );
        })()}
      </View>
    </View>
  );
};

// 5. 메인 PDF 문서
const GraduationReportPDF = ({
  totalStats,
  canGraduate,
  sections,
  filters,
  getDeptName,
  substitutionMap,
  getCategoryName,
}: {
  totalStats: { totalCredit: number; totalAu: number; gpa: string };
  canGraduate: boolean;
  sections: Section[];
  filters: Filter;
  getDeptName: (department: string) => string;
  substitutionMap?: SubstitutionMap;
  getCategoryName?: (categoryId: string) => string;
}) => {
  const resolveCategoryName = getCategoryName ?? ((id: string) => id);
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

        <Text style={styles.h1}>이수 과목 목록</Text>
        {sections.find(s => s.id === 'MANDATORY_GENERAL_COURSES') && (
          <PDFCourseListSection section={sections.find(s => s.id === 'MANDATORY_GENERAL_COURSES')!} substitutionMap={substitutionMap} majorDepartment={filters.major} getCategoryName={resolveCategoryName} />
        )}
        {sections.find(s => s.id === 'HUMANITIES_SOCIETY_ELECTIVE') && (
          <PDFCourseListSection section={sections.find(s => s.id === 'HUMANITIES_SOCIETY_ELECTIVE')!} substitutionMap={substitutionMap} majorDepartment={filters.major} getCategoryName={resolveCategoryName} />
        )}
        {sections.find(s => s.id === 'BASIC_REQUIRED') && (
          <PDFCourseListSection section={sections.find(s => s.id === 'BASIC_REQUIRED')!} substitutionMap={substitutionMap} majorDepartment={filters.major} getCategoryName={resolveCategoryName} />
        )}
        {sections.find(s => s.id === 'BASIC_ELECTIVE') && (
          <PDFCourseListSection section={sections.find(s => s.id === 'BASIC_ELECTIVE')!} substitutionMap={substitutionMap} majorDepartment={filters.major} getCategoryName={resolveCategoryName} />
        )}
        {sections.find(s => s.id === `MAJOR_${filters.major}`) && (
          <PDFCourseListSection section={sections.find(s => s.id === `MAJOR_${filters.major}`)!} substitutionMap={substitutionMap} majorDepartment={filters.major} getCategoryName={resolveCategoryName} />
        )}
        {sections.find(s => s.id.startsWith('RESEARCH')) && (
          <PDFCourseListSection section={sections.find(s => s.id.startsWith('RESEARCH'))!} substitutionMap={substitutionMap} majorDepartment={filters.major} getCategoryName={resolveCategoryName} />
        )}
        {filters.doubleMajors.map(dept => sections.find(s => s.id === `DOUBLE_MAJOR_${dept}`)).filter(Boolean).map(section => (
          <PDFCourseListSection key={section!.id} section={section!} substitutionMap={substitutionMap} majorDepartment={filters.major} getCategoryName={resolveCategoryName} />
        ))}
        {filters.minors.map(dept => sections.find(s => s.id === `MINOR_${dept}`)).filter(Boolean).map(section => (
          <PDFCourseListSection key={section!.id} section={section!} substitutionMap={substitutionMap} majorDepartment={filters.major} getCategoryName={resolveCategoryName} />
        ))}
        {filters.advancedMajor && sections.find(s => s.id.startsWith('ADVANCED')) && (
          <PDFCourseListSection section={sections.find(s => s.id.startsWith('ADVANCED'))!} substitutionMap={substitutionMap} majorDepartment={filters.major} getCategoryName={resolveCategoryName} />
        )}
        {filters.individuallyDesignedMajor && sections.find(s => s.id === 'INDIVIDUALLY_DESIGNED_MAJOR') && (
          <PDFCourseListSection section={sections.find(s => s.id === 'INDIVIDUALLY_DESIGNED_MAJOR')!} substitutionMap={substitutionMap} majorDepartment={filters.major} getCategoryName={resolveCategoryName} />
        )}

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
