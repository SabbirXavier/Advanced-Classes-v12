import React from 'react';

export default function DecorationBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden opacity-[0.15] dark:opacity-[0.1]">
      <div className="absolute inset-0 grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-12 p-8 text-indigo-600 dark:text-indigo-400 font-black opacity-40">
        {Array.from({ length: 48 }).map((_, i) => {
          const symbols = ['Σ', 'π', 'H₂O', '∫', 'e=mc²', 'Δ', 'Ω', '∞', '√x', 'λ', 'μ', 'θ'];
          const symbol = symbols[i % symbols.length];
          const rotations = [0, 15, -15, 5, -5];
          const rotation = rotations[i % rotations.length];
          
          return (
            <div 
              key={i} 
              className="flex items-center justify-center text-2xl md:text-3xl select-none"
              style={{ transform: `rotate(${rotation}deg)` }}
            >
              {symbol}
            </div>
          );
        })}
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-white/10 dark:via-black/5 dark:to-black/10" />
    </div>
  );
}
