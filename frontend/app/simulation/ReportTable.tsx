import { Requirement } from "./types";

interface RequirementsTableProps {
  requirements: Requirement[];
  isMajor?: boolean;
  lang?: string;
}

const gridLayout = 'grid grid-cols-[25px_1fr_45px_45px_50px] items-center gap-x-1'

export function RequirementsTable({ requirements, isMajor = false, lang = 'ko' }: RequirementsTableProps) {
  const ratioText = lang === 'en' ? ' passed' : ' 달성'

  if (requirements.length < 1) {
    return (<p className="text-sm">요건 없음</p>)
  }
  let index = 0
  const sortedRequirements = [...requirements].sort((a, b) => {
    const getPriority = (r: Requirement) => (r.isKey ? 2 : (r.isSecondaryKey ? 1 : 0));
    return getPriority(b) - getPriority(a);
  });

  return (
    <div className="w-full my-2 text-sm mb-2">
      <div className={`${gridLayout} pt-[3px] pb-0.5 px-1 border-b border-[#888] bg-[#f3f4f6] font-semibold text-center`}>
        <div></div>
        <div className="whitespace-nowrap">{lang === 'en' ? 'Requirement' : '요건'}</div>
        <div className="whitespace-nowrap">{lang === 'en' ? 'Acquisition' : '취득'}</div>
        <div className="whitespace-nowrap">{lang === 'en' ? 'Criteria' : '기준'}</div>
        <div className="whitespace-nowrap">{lang === 'en' ? 'Pass/Fail' : '달성여부'}</div>
      </div>

      {sortedRequirements.map((requirement) => {
        index += 1
        return (
          <RequirementBodyRow key={index} index={index} requirement={requirement} isMajor={isMajor} lang={lang} />
        )
      })}

      <div className="flex flex-row justify-between items-center px-1 pt-[3px] pb-0.5 bg-[#f9fafb] font-medium border-t border-[#eee]">
        <div className="text-left">{lang === 'en' ? 'Subtotal' : '소계'}</div>
        <div className="text-right">{requirements.filter(req => req.fulfilled).length + '/' + requirements.length + ratioText}</div>
      </div>
    </div>
  )
}


function RequirementBodyRow({ index, requirement, isMajor = false, lang = 'ko' }: { index: number, requirement: Requirement, isMajor?: boolean, lang?: string }) {
  const passText = lang === 'en' ? 'Pass' : '달성'
  const failText = lang === 'en' ? 'Fail' : '미달성'

  return (
    <div className={`${gridLayout} pt-[3px] pb-0.5 px-1 border-b border-[#eee] text-center`}>
      <div>{index}</div>
      {requirement.isKey ? isMajor ? (
        <div className="text-left">전공필수 학점 총합</div>
      ) : (
        <div className="text-left">학점 총합</div>
      ) : requirement.isSecondaryKey ? isMajor ? (
        <div className="text-left">전공선택 학점 총합</div>
      ) : (
        <div className="text-left">AU 총합</div>
      ) : (
        <div className="text-left">
          <p>{requirement.description || requirement.title}</p>
          <p className="text-xs text-[#666] mt-0.5 leading-tight">
            이수: {(requirement.usedCourses || []).map(course => course.course.code).sort((lhs, rhs) => lhs.localeCompare(rhs)).join(', ') || '없음'}
          </p>
        </div>
      )}
      <div>{requirement.currentValue || 0}</div>
      <div>{requirement.value || 0}</div>
      <div className={requirement.fulfilled ? 'text-[#059669]' : 'text-[#dc2626]'}>{requirement.fulfilled ? passText : failText}</div>
    </div>
  )
}
