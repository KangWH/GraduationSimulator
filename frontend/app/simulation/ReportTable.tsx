import { Requirement } from "./types";

interface RequirementsTableProps {
  requirements: Requirement[];
  isMajor?: boolean;
  lang?: string;
}

const gridLayout = 'grid grid-cols-[2rem_1fr_3rem_3rem_4rem] items-center gap-x-1'

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
    <div className="w-full my-2 text-center text-sm">
      <div className={`${gridLayout} p-1 border-y-2 font-semibold`}>
        <div></div>
        <div className="whitespace-nowrap">{lang === 'en' ? 'Requirement' : '요건'}</div>
        <div className="whitespace-nowrap">{lang === 'en' ? 'Acquisition' : '취득'}</div>
        <div className="whitespace-nowrap">{lang === 'en' ? 'Criteria' : '기준'}</div>
        <div className="whitespace-nowrap">{lang === 'en' ? 'Pass/Fail' : '달성 여부'}</div>
      </div>

      {sortedRequirements.map((requirement) => {
        index += 1
        return (
          <RequirementBodyRow key={index} index={index} requirement={requirement} isMajor={isMajor} />
        )
      })}

      <div className={`flex flex-row justify-between items-center border-y-2 px-2 py-1 font-medium`}>
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
    <div className={`${gridLayout} p-1 ${index === 1 ? '' : ' border-t-1'}`}>
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
          <p className="text-xs font-light">
            이수 과목: {(requirement.usedCourses || []).map(course => course.course.code).sort((lhs, rhs) => lhs.localeCompare(rhs)).join(', ')}{(requirement.usedCourses || []).length < 1 && '없음'}
          </p>
        </div>
      )}
      <div>{requirement.currentValue || 0}</div>
      <div>{requirement.value || 0}</div>
      <div>{requirement.fulfilled ? passText : failText}</div>
    </div>
  )
}
