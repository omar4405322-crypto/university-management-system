import React, { useState, useEffect } from 'react';

export default function DebugOverflowPanel() {
  const [results, setResults] = useState<any[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const [vw, setVw] = useState(0);

  useEffect(() => {
    // Run after a short delay to ensure layout is settled
    const timeout = setTimeout(() => {
      const currentVw = document.documentElement.clientWidth;
      setVw(currentVw);
      
      const overflowResults = [...document.querySelectorAll('*')]
        .map(el => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            classes: el.className?.toString?.()?.slice(0, 60) || '',
            scrollWidth: el.scrollWidth,
            rectRight: Math.round(rect.right),
            overflow: Math.round(el.scrollWidth - currentVw),
          };
        })
        .filter(o => o.rectRight > currentVw + 2 || o.scrollWidth > currentVw + 2)
        .sort((a, b) => Math.max(b.scrollWidth, b.rectRight) - Math.max(a.scrollWidth, a.rectRight))
        .slice(0, 10);
        
      setResults(overflowResults);
    }, 1500); // 1.5s delay to let animations/Recharts finish rendering

    return () => clearTimeout(timeout);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-black/90 text-white p-3 max-h-64 overflow-y-auto font-mono text-[10px] leading-relaxed shadow-2xl border-b border-red-500/50">
      <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/20">
        <div className="font-bold text-red-400">DEBUG: Overflow Detection</div>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-white hover:text-red-400 font-bold px-2 py-1 bg-white/10 rounded"
        >
          CLOSE
        </button>
      </div>
      
      <div className="mb-2 text-green-400 font-bold">
        Viewport Width (vw): {vw}px
      </div>

      {results.length === 0 ? (
        <div className="text-gray-400 italic">No overflowing elements found. (Calculating...)</div>
      ) : (
        <div className="space-y-1">
          {results.map((r, i) => (
            <div key={i} className="break-all border-l-2 border-red-500 pl-2 bg-red-500/10 py-1">
              <span className="text-blue-300 font-bold">{r.tag.toLowerCase()}</span>
              {r.classes && <span className="text-purple-300"> .{r.classes}</span>}
              <div className="text-yellow-300 mt-1">
                scrollW: {r.scrollWidth}px | rectRight: {r.rectRight}px | overflow: <span className="text-red-400 font-bold">+{r.overflow}px</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
