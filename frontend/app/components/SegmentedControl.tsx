interface SegmentedControlProps {
  activeSegment: string;
  onActiveSegmentChange: (newSegment: string) => void;
  segments: SegmentItemProps[];
}
interface SegmentItemProps {
  identifier: string;
  displayText: string;
}

export default function SegmentedControl({ activeSegment, onActiveSegmentChange, segments }: SegmentedControlProps) {
  const activeSegmentIndex = segments.map(segment => segment.identifier).indexOf(activeSegment)
  return (
    <div className="relative p-1 flex rounded-full bg-white/50 dark:bg-black/50 backdrop-blur-lg shadow-lg border border-gray-200/50 dark:border-zinc-700/50">
      {activeSegmentIndex >= 0 && (
        <div
          className="absolute top-1 bottom-1 z-1 bg-gray-100 dark:bg-zinc-800 rounded-full transition-all duration-300 ease-out"
          style={{ left: `calc((100% - 0.5rem) / ${segments.length} * ${activeSegmentIndex} + 0.25rem)`, width: `calc((100% - 0.5rem) / ${segments.length})` }}
        />
      )}
      {segments.map(segment => {
        const isActive = segment.identifier === activeSegment
        return (
          <button
            key={segment.identifier}
            type="button"
            className={`relative z-2 min-w-0 flex-1 rounded-full px-4 py-2 text-center text-sm cursor-pointer select-none touch-manipulation transition-all duration-200 ease-out whitespace-nowrap
              active:scale-[0.90] active:opacity-90
              ${isActive ? 'font-medium' : 'opacity-80 hover:opacity-100'}`}
            onClick={() => onActiveSegmentChange(segment.identifier)}
          >
            {segment.displayText}
          </button>
        )
      })}
    </div>
  )
}
