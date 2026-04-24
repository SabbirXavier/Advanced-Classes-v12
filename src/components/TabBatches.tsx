import React, { useState, useEffect } from 'react';
import EnrollmentSection from './EnrollmentSection';
import { firestoreService } from '../services/firestoreService';
import MarkdownRenderer from './MarkdownRenderer';
import { Lock } from 'lucide-react';

export default function TabBatches({ isVerified }: { isVerified?: boolean }) {
  const [batches, setBatches] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubBatches = firestoreService.listenToCollection('batches', (data) => {
      setBatches(data);
      setLoading(false);
    });
    const unsubFees = firestoreService.listenToCollection('fees', setFees);
    return () => {
      unsubBatches();
      unsubFees();
    };
  }, []);

  const liveBatches = batches.filter(b => b.enrollmentStatus === 'live');
  const upcomingBatches = batches.filter(b => b.enrollmentStatus === 'upcoming');

  if (loading) return <div className="text-center p-10 opacity-50 font-bold">Loading...</div>;

  return (
    <div className="space-y-8">
      {/* Live Batches Section */}
      {liveBatches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            <h2 className="text-xl font-bold text-red-500 uppercase tracking-wider">Live Enrollment Now</h2>
          </div>
          <div className="grid gap-4">
            {liveBatches.map(batch => (
              <div key={batch.id} className="group glass-card !border-l-4 !p-5 relative overflow-hidden" style={{ borderLeftColor: batch.color }}>
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-tighter z-10">Live</div>
                {!isVerified && (
                  <div className="absolute top-8 right-0 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-bl-lg uppercase flex items-center gap-1 z-10 shadow-lg">
                    <Lock size={10} /> Locked
                  </div>
                )}
                <div className="flex justify-between items-center mb-1">
                  <b className="tracking-wide" style={{ color: batch.color }}>
                    <MarkdownRenderer content={batch.name} inline />
                  </b>
                  <span className="text-white text-[0.7rem] px-2 py-1 rounded-md font-bold" style={{ backgroundColor: batch.tagColor }}>{batch.tag}</span>
                </div>
                <div className="text-3xl font-extrabold mb-2" style={{ color: batch.color }}>{batch.date}</div>
                <div className="opacity-90 mb-4 text-sm">
                  <MarkdownRenderer content={batch.description} />
                </div>
                <button 
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('open-enrollment', { detail: { grade: batch.name.includes('XII') ? 'XII' : batch.name.includes('XI') ? 'XI' : 'X' } }));
                  }}
                  className="w-full py-3 bg-red-500 text-white rounded-xl text-sm font-black shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 uppercase"
                >
                  Enroll in {batch.name} +
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Batches Section */}
      {upcomingBatches.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-bold opacity-80 uppercase tracking-wider">Upcoming Batches</h2>
          </div>
          <div className="grid gap-4">
            {upcomingBatches.map(batch => (
              <div key={batch.id} className="glass-card !border-l-4 !p-5 opacity-80" style={{ borderLeftColor: batch.color }}>
                <div className="flex justify-between items-center mb-1">
                  <b className="tracking-wide" style={{ color: batch.color }}>
                    <MarkdownRenderer content={batch.name} inline />
                  </b>
                  <span className="text-white text-[0.7rem] px-2 py-1 rounded-md font-bold" style={{ backgroundColor: batch.tagColor }}>{batch.tag}</span>
                </div>
                <div className="text-2xl font-extrabold mb-2 opacity-70">{batch.date}</div>
                <div className="opacity-70 text-sm">
                  <MarkdownRenderer content={batch.description} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback if no batches are live or upcoming */}
      {liveBatches.length === 0 && upcomingBatches.length === 0 && (
        <div className="text-center py-10 glass-card opacity-50">
          <p className="font-bold">No active enrollments at the moment.</p>
          <p className="text-xs">Check back later for new batches!</p>
        </div>
      )}

      <div className="glass-card">
        <div className="flex justify-between items-center mb-4">
          <div className="text-lg font-bold text-[var(--primary)]">Fee Structure</div>
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'fee' }))}
            className="text-xs font-bold text-[var(--primary)] hover:underline"
          >
            View Detailed Fee Page →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-color)] opacity-60">
                <th className="pb-2 font-bold">Subject</th>
                <th className="pb-2 font-bold text-center">Original</th>
                <th className="pb-2 font-bold text-center">Discount</th>
                <th className="pb-2 font-bold text-right">Final Price</th>
              </tr>
            </thead>
            <tbody>
              {fees.map((fee) => (
                <tr key={fee.id} className="border-b border-dashed border-[var(--border-color)] last:border-0">
                  <td className="py-3 opacity-90 font-bold">
                    <MarkdownRenderer content={fee.subject} inline />
                  </td>
                  <td className="py-3 text-center opacity-50 line-through">₹{fee.originalPrice}</td>
                  <td className="py-3 text-center text-green-500 font-bold">-₹{fee.discount}</td>
                  <td className="py-3 font-black text-right text-[var(--primary)]">₹{fee.finalPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
