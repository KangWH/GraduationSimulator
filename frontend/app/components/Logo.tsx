export default function Logo({ bold = false, language = 'ko' }: { bold?: boolean, language?: 'ko' | 'en' }) {
  if (language === 'en') {
    return (
      <div className="whitespace-nowrap" style={{ fontFamily: 'var(--font-logo)' }}>
        <span className={bold ? 'font-black' : 'font-bold'}>grad</span>
        <span className={bold ? 'font-normal' : 'font-light'}>.log</span>
      </div>
    );
  }

  return (
    <div className="whitespace-nowrap" style={{ fontFamily: 'var(--font-logo)' }}>
      <span className={bold ? 'font-black' : 'font-bold'}>졸업</span>
      <span className={bold ? 'font-normal' : 'font-light'}>로그</span>
    </div>
  );
}
