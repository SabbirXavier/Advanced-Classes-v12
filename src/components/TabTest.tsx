import React, { useState, useEffect } from 'react';
import { Brain, CheckCircle2, Circle } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import MarkdownRenderer from './MarkdownRenderer';

export default function TabTest() {
  const [teasers, setTeasers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [showExplanations, setShowExplanations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubscribe = firestoreService.listenToCollection('teasers', (data) => {
      setTeasers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAnswerSelect = (teaserId: string, optionIndex: number) => {
    if (showExplanations[teaserId]) return; // Prevent changing answer after revealing
    setSelectedAnswers(prev => ({ ...prev, [teaserId]: optionIndex }));
  };

  const handleCheckAnswer = (teaserId: string) => {
    if (selectedAnswers[teaserId] !== undefined) {
      setShowExplanations(prev => ({ ...prev, [teaserId]: true }));
    }
  };

  if (loading) return <div className="text-center p-10 opacity-50 font-bold">Loading...</div>;

  return (
    <div className="space-y-5">
      <div className="mb-5">
        <h2 className="text-2xl font-bold">Tests & Teasers</h2>
      </div>

      {teasers.length > 0 ? (
        <div className="space-y-6">
          {teasers.map(teaser => {
            const isRevealed = showExplanations[teaser.id];
            const selectedOpt = selectedAnswers[teaser.id];
            
            return (
              <div key={teaser.id} className="glass-card relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl"></div>
                <div className="flex items-center gap-2.5 mb-5 text-lg relative z-10">
                  <Brain className="text-purple-500" size={24} />
                  <b className="tracking-wide text-purple-500">DAILY BRAIN TEASER</b>
                </div>
                
                <div className="relative z-10">
                  <div className="font-bold text-lg mb-4">
                    <MarkdownRenderer content={teaser.question} />
                  </div>
                  <div className="space-y-2 mb-4">
                    {(teaser.options || []).map((opt: string, i: number) => {
                      const isSelected = selectedOpt === i;
                      const isCorrect = teaser.correctAnswer === i;
                      
                      let optionClass = "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ";
                      
                      if (!isRevealed) {
                        optionClass += isSelected 
                          ? "border-[var(--primary)] bg-[var(--primary)]/10" 
                          : "border-[var(--border-color)] hover:border-[var(--primary)]/50 hover:bg-white/5";
                      } else {
                        optionClass += "cursor-default ";
                        if (isCorrect) {
                          optionClass += "border-green-500 bg-green-500/10";
                        } else if (isSelected && !isCorrect) {
                          optionClass += "border-red-500 bg-red-500/10 opacity-70";
                        } else {
                          optionClass += "border-[var(--border-color)] opacity-50";
                        }
                      }

                      return (
                        <div 
                          key={i} 
                          className={optionClass}
                          onClick={() => handleAnswerSelect(teaser.id, i)}
                        >
                          <div className={`flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center ${
                            isRevealed && isCorrect ? 'border-green-500 text-green-500' :
                            isRevealed && isSelected && !isCorrect ? 'border-red-500 text-red-500' :
                            isSelected ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-gray-400'
                          }`}>
                            {isRevealed && isCorrect ? <CheckCircle2 size={14} /> : 
                             isSelected ? <Circle size={10} className="fill-current" /> : null}
                          </div>
                          <div className={`text-sm font-medium ${
                            isRevealed && isCorrect ? 'text-green-600 dark:text-green-400' :
                            isRevealed && isSelected && !isCorrect ? 'text-red-600 dark:text-red-400 line-through' : ''
                          }`}>
                            <MarkdownRenderer content={opt} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {!isRevealed ? (
                    <button 
                      onClick={() => handleCheckAnswer(teaser.id)}
                      disabled={selectedOpt === undefined}
                      className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--primary)]/90 transition-colors"
                    >
                      Check Answer
                    </button>
                  ) : (
                    <div className="mt-4 p-4 bg-[var(--primary)]/5 border border-[var(--primary)]/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                      <h5 className="font-bold text-[var(--primary)] mb-1 text-sm">Explanation:</h5>
                      <div className="text-sm opacity-90">
                        <MarkdownRenderer content={teaser.explanation || "No explanation provided."} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="glass-card text-center p-10 opacity-50 font-bold">
          No tests or teasers available right now. Check back later!
        </div>
      )}
    </div>
  );
}
