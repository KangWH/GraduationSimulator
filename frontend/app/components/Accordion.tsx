import { Children, isValidElement } from 'react';

interface AccordionProps {
  isCollapsed?: boolean;
  onTitleClick: () => void;
  children: React.ReactNode;
}

export default function Accordion({ isCollapsed = false, onTitleClick, children }: AccordionProps) {
  let _title: React.ReactNode = null;
  let _body: React.ReactNode = null;

  Children.forEach(children, child => {
    if (child != null && isValidElement(child)) {
      if (child.type === ACTitle) {
        _title = child;
      }
      if (child.type === ACBody) {
        _body = child;
      }
    }
  });

  return (
    <div className="px-3 py-4">
      <button
        onClick={onTitleClick}
        className="px-1 flex w-full items-center gap-2 text-left hover:opacity-70 hover:bg-gray-100 dark:hover:bg-zinc-800 active:scale-96 transition-all rounded"
      >
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {_title}
      </button>
      <div className={`px-1 overflow-hidden transition-all duration-200 ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[2000px] opacity-100 mt-3'}`}>
        {_body}
      </div>
    </div>
  )
}

export function ACTitle ({ children }: { children: React.ReactNode }) {
  return children;
}

export function ACBody ({ children }: { children: React.ReactNode }) {
  return children;
}
