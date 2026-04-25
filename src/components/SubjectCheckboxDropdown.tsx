import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SubjectCheckboxDropdownProps {
  batchId: string;
  dynamicSubjects: string[];
}

export default function SubjectCheckboxDropdown({ batchId, dynamicSubjects }: SubjectCheckboxDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['ALL']);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSubject = (subject: string) => {
    setSelectedSubjects(prev => {
      if (subject === 'ALL') {
        return prev.includes('ALL') ? [] : ['ALL'];
      }
      
      const newSelections = prev.filter(s => s !== 'ALL');
      if (prev.includes(subject)) {
        return newSelections.filter(s => s !== subject);
      } else {
        return [...newSelections, subject];
      }
    });
  };

  // Keep a hidden input to easily grab the values from normal form submissions/refs if needed,
  // but it's better to update the DOM element that SearchableUserDropdown will read.
  // We'll mimic the multi-select behavior by having a hidden select with selected options
  return (
    <div className="relative w-full" ref={dropdownRef}>
      <select 
        id={`faculty-subject-${batchId}`}
        multiple
        className="hidden"
        value={selectedSubjects}
        data-selected={JSON.stringify(selectedSubjects)}
      >
        <option value="ALL">All Subjects</option>
        {dynamicSubjects.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 flex-1 bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase outline-none focus:border-red-500/50 transition-all hover:bg-white/20"
      >
        <span className="truncate">
          {selectedSubjects.length === 0 ? 'Select Subjects...' : (selectedSubjects.includes('ALL') ? 'ALL SUBJECTS' : selectedSubjects.join(', '))}
        </span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-[#1a1c23] border border-white/10 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
          <div className="p-2 space-y-1">
            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-all">
              <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedSubjects.includes('ALL') ? 'bg-indigo-500 border-indigo-500' : 'border-white/20 bg-black/50'}`}>
                {selectedSubjects.includes('ALL') && <Check size={12} className="text-white" />}
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">All Subjects</span>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={selectedSubjects.includes('ALL')}
                onChange={() => toggleSubject('ALL')}
              />
            </label>
            
            <div className="h-px bg-white/10 my-1"></div>

            {dynamicSubjects.map(s => (
              <label key={s} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-all">
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${selectedSubjects.includes(s) && !selectedSubjects.includes('ALL') ? 'bg-indigo-500 border-indigo-500' : 'border-white/20 bg-black/50'}`}>
                  {selectedSubjects.includes(s) && !selectedSubjects.includes('ALL') && <Check size={12} className="text-white" />}
                </div>
                <span className="text-xs font-bold uppercase">{s}</span>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={selectedSubjects.includes(s) && !selectedSubjects.includes('ALL')}
                  onChange={() => toggleSubject(s)}
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
