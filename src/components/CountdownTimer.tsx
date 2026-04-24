import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';

export default function CountdownTimer() {
  const [targetDate, setTargetDate] = useState<number | null>(null);
  const [batchName, setBatchName] = useState<string>('');
  
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const unsubscribe = firestoreService.listenToCollection('batches', (batches) => {
      const activeBatch = batches.find((b: any) => b.timerEnabled && b.targetDate);
      if (activeBatch) {
        setTargetDate(new Date(activeBatch.targetDate).getTime());
        setBatchName(activeBatch.name);
      } else {
        setTargetDate(null);
        setBatchName('');
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!targetDate) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        clearInterval(interval);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate) return null;

  return (
    <div className="bg-gradient-to-r from-[var(--danger)] to-orange-500 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
      <div className="absolute -right-4 -top-4 opacity-20">
        <Clock size={100} />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <h3 className="font-bold text-sm tracking-widest uppercase mb-3 opacity-90">{batchName} Begins In:</h3>
        <div className="flex gap-4 text-center">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black">{String(timeLeft.days).padStart(2, '0')}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-80">Days</span>
          </div>
          <span className="text-3xl font-black opacity-50">:</span>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black">{String(timeLeft.hours).padStart(2, '0')}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-80">Hours</span>
          </div>
          <span className="text-3xl font-black opacity-50">:</span>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black">{String(timeLeft.minutes).padStart(2, '0')}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-80">Mins</span>
          </div>
          <span className="text-3xl font-black opacity-50">:</span>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-yellow-300">{String(timeLeft.seconds).padStart(2, '0')}</span>
            <span className="text-[10px] uppercase tracking-wider opacity-80">Secs</span>
          </div>
        </div>
      </div>
    </div>
  );
}
