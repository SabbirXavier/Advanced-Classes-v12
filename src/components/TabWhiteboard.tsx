import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { 
  Eraser, 
  Pencil, 
  Download, 
  Trash2, 
  Undo2,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

export default function TabWhiteboard() {
  const [lines, setLines] = useState<any[]>([]);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#4f46e5');
  const [strokeWidth, setStrokeWidth] = useState(5);
  const isDrawing = useRef(false);
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [showTools, setShowTools] = useState(true);

  // Robust dimension handling
  useLayoutEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { offsetWidth, offsetHeight } = containerRef.current;
        setDimensions({
          width: offsetWidth,
          height: offsetHeight
        });
      }
    };

    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    updateSize();
    return () => resizeObserver.disconnect();
  }, []);

  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    setLines([...lines, { 
      tool, 
      points: [pos.x, pos.y], 
      color: tool === 'eraser' ? '#ffffff' : color,
      strokeWidth 
    }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const lastLine = lines[lines.length - 1];
    
    if (!lastLine) return;
    
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    lines.splice(lines.length - 1, 1, lastLine);
    setLines([...lines]);
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const handleUndo = () => {
    setLines(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setLines([]);
  };

  const handleExport = () => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL();
    const link = document.createElement('a');
    link.download = 'whiteboard-capture.png';
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div ref={containerRef} className="h-full w-full flex flex-col bg-slate-50 dark:bg-[#0f1115] relative overflow-hidden rounded-3xl border border-gray-200 dark:border-white/5 shadow-xl">
      {/* Background Grid */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div 
          className="w-full h-full opacity-[0.05] dark:opacity-[0.1]" 
          style={{ 
            backgroundImage: 'radial-gradient(circle, #4f46e5 1.5px, transparent 1.5px)', 
            backgroundSize: '40px 40px' 
          }} 
        />
      </div>

      <div className="flex-1 relative z-10 touch-none">
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            onMouseDown={handleMouseDown}
            onMousemove={handleMouseMove}
            onMouseup={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            ref={stageRef}
            className="bg-transparent"
          >
            <Layer>
              {lines.map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke={line.color}
                  strokeWidth={line.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={
                    line.tool === 'eraser' ? 'destination-out' : 'source-over'
                  }
                />
              ))}
            </Layer>
          </Stage>
        )}
      </div>

      {/* Floating Toolbar - Mobile Optimized */}
      <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ${showTools ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
        <div className="bg-white/90 dark:bg-black/80 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 flex items-center gap-1.5 md:gap-3">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
            <ToolBtn active={tool === 'pen'} onClick={() => setTool('pen')} icon={<Pencil size={20} />} />
            <ToolBtn active={tool === 'eraser'} onClick={() => setTool('eraser')} icon={<Eraser size={20} />} />
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="color" 
              value={color} 
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent"
            />
            <select 
              value={strokeWidth} 
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="bg-transparent text-[10px] font-black uppercase tracking-widest outline-none px-1"
            >
              <option value={2}>S</option>
              <option value={5}>M</option>
              <option value={10}>L</option>
              <option value={20}>XL</option>
            </select>
          </div>

          <div className="w-px h-8 bg-gray-200 dark:bg-white/10 mx-1" />

          <div className="flex items-center gap-1">
            <ActionBtn onClick={handleUndo} icon={<Undo2 size={20} />} />
            <ActionBtn onClick={handleClear} icon={<Trash2 size={20} />} />
            <ActionBtn onClick={handleExport} icon={<Download size={20} />} />
          </div>
        </div>
      </div>

      {/* Toggle View Button */}
      <button 
        onClick={() => setShowTools(!showTools)}
        className="absolute bottom-4 right-4 z-[60] w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all"
      >
        {showTools ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
      </button>
    </div>
  );
}

function ToolBtn({ active, onClick, icon }: any) {
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-all ${
        active 
          ? 'bg-indigo-600 text-white shadow-md' 
          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10'
      }`}
    >
      {icon}
    </button>
  );
}

function ActionBtn({ onClick, icon }: any) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all active:scale-90"
    >
      {icon}
    </button>
  );
}
