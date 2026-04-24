import React, { useState, useEffect } from 'react';
import { Radio, CalendarCheck, Calendar, Clock, Instagram } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import MarkdownRenderer from './MarkdownRenderer';

export default function TabRoutine() {
  const [routines, setRoutines] = useState<any[]>([]);
  const [radars, setRadars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubRoutines = firestoreService.listenToCollection('routines', (data) => {
      setRoutines(data);
      setLoading(false);
    });
    const unsubRadars = firestoreService.listenToCollection('radars', setRadars);
    return () => {
      unsubRoutines();
      unsubRadars();
    };
  }, []);

  const getKolkataTime = () => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  };

  const getGoogleCalendarUrl = (item: any) => {
    try {
      const text = encodeURIComponent(item.title);
      const host = "Advanced Classes, Sonai";
      const desc = `Mathematics Only Tuition For Class XI, XII\n\n📌 Faculty: Nemesis Developers\n📍 Location: https://share.google/MTzvbg4BOw6Ya3vTF\n🌐 App: ${window.location.origin}\n\nNote: ${item.notes || 'No extra notes'}`;
      const details = encodeURIComponent(desc);
      const location = encodeURIComponent('Advanced Classes, Sonai (24.73115, 92.89119)');
      
      const parseToISO = (dateStr: string, timeStr: string) => {
        const d = new Date(dateStr);
        // Normalize time string (remove spaces, handle 12:30PM format)
        const parts = timeStr.trim().toUpperCase().match(/(\d+):(\d+)\s*(AM|PM)?/);
        if (!parts) return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        
        let hours = parseInt(parts[1], 10);
        let minutes = parseInt(parts[2], 10);
        let modifier = parts[3];

        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;
        
        d.setHours(hours, minutes, 0);
        return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      };

      const start = parseToISO(item.date, item.startTime || item.time);
      // Default classes to 2 hours if not specified
      const end = item.endTime ? parseToISO(item.date, item.endTime) : parseToISO(item.date, (item.startTime || item.time).replace(/(\d+)/, (m: string) => (parseInt(m) + 2).toString()));
      
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&location=${location}&dates=${start}/${end}`;
    } catch (e) {
      return '#';
    }
  };

  if (loading) return <div className="text-center p-10 opacity-50 font-bold">Loading...</div>;

  const kolkataNow = getKolkataTime();
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const todayName = dayNames[kolkataNow.getDay()];
  const tomorrowName = dayNames[(kolkataNow.getDay() + 1) % 7];

  const todayRadars = radars.filter(r => r.date === kolkataNow.toDateString());
  const hasLiveOrUpcoming = todayRadars.some(r => r.status === 'live' || r.status === 'upcoming');
  
  // Logic: Show tomorrow if no radars for today OR all today's radars are completed
  const showTomorrow = todayRadars.length === 0 || !hasLiveOrUpcoming;

  const tomorrowRoutines = showTomorrow ? routines.filter(r => r[tomorrowName] && r[tomorrowName] !== '-') : [];

  return (
    <div className="space-y-5">
      {/* Live Class Radar */}
      {radars.length > 0 && (
        <div className="glass-card !p-6 bg-gradient-to-r from-red-500/5 to-transparent border-red-500/20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]"></div>
              <h3 className="font-black text-sm uppercase tracking-widest text-red-500">Live Class Radar</h3>
            </div>
            {showTomorrow && (
              <div className="px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20">
                <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest">Showing Tomorrow's Routine</span>
              </div>
            )}
            <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Master Sync Enabled</span>
            </div>
          </div>
          
          {showTomorrow && tomorrowRoutines.length > 0 && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {tomorrowRoutines.map(r => (
                <div key={`tomorrow-${r.id}`} className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl flex flex-col gap-2 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-full blur-2xl"></div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest bg-blue-500 text-white">TOMORROW</span>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg text-[10px] font-bold text-gray-400">
                      <Clock size={12} className="text-blue-500" /> 
                      {r.startTime} {r.endTime && `— ${r.endTime}`}
                    </div>
                  </div>
                  <h4 className="font-bold text-lg leading-tight">
                    <MarkdownRenderer content={r[tomorrowName]} inline />
                  </h4>
                  <div className="text-[10px] opacity-60 font-medium italic">Automatically fetched from Master Routine</div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {radars.map(radar => (
              <div key={radar.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex flex-col justify-between items-start gap-4 hover:border-red-500/20 transition-all group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-3xl -mr-8 -mt-8"></div>
                <div className="w-full relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest ${
                      radar.status === 'live' ? 'bg-red-500 text-white animate-pulse' :
                      radar.status === 'upcoming' ? 'bg-blue-500/20 text-blue-500' :
                      'bg-gray-500/20 text-gray-500'
                    }`}>
                      {radar.status}
                    </span>
                    <p className="text-[10px] font-mono font-bold opacity-40">#{radar.id.slice(-4)}</p>
                  </div>
                  <h4 className="font-bold text-lg leading-tight mb-2 group-hover:text-[var(--primary)] transition-colors">
                    <MarkdownRenderer content={radar.title} inline />
                  </h4>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg text-xs font-bold text-gray-400">
                      <Clock size={14} className="text-[var(--primary)]" /> 
                      {radar.time} {radar.endTime && `— ${radar.endTime}`}
                    </div>
                    {radar.status === 'upcoming' && (
                      <a 
                        href={getGoogleCalendarUrl(radar)}
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-bold text-[var(--text-color)] transition-all"
                        title="Add to Google Calendar"
                      >
                        <Calendar size={12} className="text-[var(--primary)]" />
                        SCHEDULE
                      </a>
                    )}
                  </div>
                </div>
                
                {radar.instagramProfile && (
                  <div className="w-full">
                     <a href={radar.instagramProfile.startsWith('http') ? radar.instagramProfile : `https://instagram.com/${radar.instagramProfile.replace('@', '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-pink-500/20 rounded-lg text-xs font-bold text-pink-500 transition-all">
                       <Instagram size={14} /> Teacher's Instagram
                     </a>
                  </div>
                )}

                {radar.link && (radar.status === 'live' || radar.status === 'upcoming') && (
                  <a 
                    href={radar.link} 
                    target="_blank" 
                    rel="noreferrer" 
                    className={`w-full text-center py-2.5 rounded-xl text-xs font-black transition-all ${
                      radar.status === 'live' 
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 scale-[1.02]' 
                      : 'bg-[var(--primary)]/10 text-[var(--primary)] hover:bg-[var(--primary)]/20'
                    }`}
                  >
                    {radar.status === 'live' ? 'JOIN LIVE CLASS' : 'GET READY'}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-5">
        <h2 className="text-2xl font-bold">Master Routine</h2>
      </div>

      <div className="glass-card overflow-x-auto !p-3">
        <table className="w-full min-w-[500px] border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2.5 text-xs text-[var(--primary)] border-b-2 border-[var(--border-color)]">TIME</th>
              <th className="text-left p-2.5 text-xs text-[var(--primary)] border-b-2 border-[var(--border-color)]">MON</th>
              <th className="text-left p-2.5 text-xs text-[var(--primary)] border-b-2 border-[var(--border-color)]">TUE</th>
              <th className="text-left p-2.5 text-xs text-[var(--primary)] border-b-2 border-[var(--border-color)]">WED</th>
              <th className="text-left p-2.5 text-xs text-[var(--primary)] border-b-2 border-[var(--border-color)]">THU</th>
              <th className="text-left p-2.5 text-xs text-[var(--primary)] border-b-2 border-[var(--border-color)]">FRI</th>
              <th className="text-left p-2.5 text-xs text-[var(--primary)] border-b-2 border-[var(--border-color)]">SAT</th>
              <th className="text-left p-2.5 text-xs text-[var(--primary)] border-b-2 border-[var(--border-color)]">SUN</th>
            </tr>
          </thead>
          <tbody>
            {routines.map(routine => (
              <tr key={routine.id}>
                <td className="p-2.5 border-b border-[var(--border-color)] text-sm whitespace-nowrap">
                  {routine.startTime && routine.endTime 
                    ? `${routine.startTime} - ${routine.endTime}` 
                    : (routine.time || routine.startTime || '')}
                </td>
                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => {
                  const val = routine[day];
                  const isMath = val?.includes('Math');
                  const isChem = val?.includes('Chem');
                  let className = "p-2.5 border-b border-[var(--border-color)] text-sm max-w-[150px] whitespace-normal break-words align-top ";
                  if (isMath) className += "text-[var(--primary)] font-semibold bg-[#4f46e5]/5 border-l-[3px] border-l-[var(--primary)]";
                  else if (isChem) className += "text-[var(--accent)] font-semibold bg-[#f59e0b]/5 border-l-[3px] border-l-[var(--accent)]";
                  else className += "opacity-50";
                  
                  return (
                    <td key={day} className={className}>
                      <MarkdownRenderer content={val} inline />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-card">
        <p className="mb-2 opacity-90">🔴 <b className="font-bold">Sunday:</b> 9AM - 2PM Weekly Exams.</p>
        <p className="opacity-90">🔵 <b className="font-bold">Math:</b> 2.5 Hour Sessions.</p>
      </div>
    </div>
  );
}
