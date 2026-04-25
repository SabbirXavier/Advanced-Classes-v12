import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GraduationCap, MapPin, CalendarCheck, Phone, Calendar, ArrowRight, Radio, Brain, Zap, Star, CheckCircle2, Circle, Download, Play, Image as ImageIcon, FileText, Mic, ExternalLink, Moon, Sun, Clock, Instagram, MessageCircle } from 'lucide-react';
import EnrollmentSection from './EnrollmentSection';
import CountdownTimer from './CountdownTimer';
import { firestoreService } from '../services/firestoreService';
import MarkdownRenderer from './MarkdownRenderer';

interface TabHomeProps {
  onNavigate: (tab: string) => void;
  branding?: any;
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
}

export default function TabHome({ onNavigate, branding, isDarkMode, toggleDarkMode }: TabHomeProps) {
  const [radars, setRadars] = useState<any[]>([]);

  const getGoogleCalendarUrl = (item: any) => {
    try {
      const text = encodeURIComponent(item.title);
      const desc = `Mathematics Only Tuition For Class XI, XII\n\n📌 Faculty: Nemesis Developers\n📍 Location: https://share.google/MTzvbg4BOw6Ya3vTF\n🌐 App: ${window.location.origin}\n\nNote: ${item.notes || 'No extra notes'}`;
      const details = encodeURIComponent(desc);
      const location = encodeURIComponent('Advanced Classes, Sonai (24.73115, 92.89119)');
      
      const parseToISO = (dateStr: string, timeStr: string) => {
        const d = new Date(dateStr);
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
      const end = item.endTime ? parseToISO(item.date, item.endTime) : parseToISO(item.date, (item.startTime || item.time).replace(/(\d+)/, (m: string) => (parseInt(m) + 2).toString()));
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&details=${details}&location=${location}&dates=${start}/${end}`;
    } catch (e) {
      return '#';
    }
  };

  const getKolkataTime = () => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  };

  const [currentTime, setCurrentTime] = useState(getKolkataTime());
  const [teasers, setTeasers] = useState<any[]>([]);
  const [drops, setDrops] = useState<any[]>([]);
  const [stars, setStars] = useState<any[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [showExplanations, setShowExplanations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(getKolkataTime()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubDrops = firestoreService.listenToCollection('drops', setDrops);
    const unsubStars = firestoreService.listenToCollection('stars', setStars);
    const unsubRadars = firestoreService.listenToCollection('radars', (data) => {
      // Filter for today's radars or those without a specific date (legacy)
      const kolkataNow = getKolkataTime();
      const today = kolkataNow.toDateString();
      setRadars(data.filter(r => !r.date || r.date === today));
    });
    const unsubTeasers = firestoreService.listenToCollection('teasers', setTeasers);
    
    return () => {
      unsubDrops();
      unsubStars();
      unsubRadars();
      unsubTeasers();
    };
  }, []);

  const parseTime = (timeStr: string) => {
    if (!timeStr) return null;
    try {
      // If it contains a range (e.g., "09:00 AM - 10:00 AM"), take the start time
      const startTimeStr = timeStr.split('-')[0].trim();
      
      // Match "09:00", "09:00AM", "09:00 AM", etc.
      const timeMatch = startTimeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (!timeMatch) return null;

      let hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const modifier = timeMatch[3]?.toUpperCase();

      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      
      const date = getKolkataTime();
      date.setHours(hours, minutes, 0, 0);
      return date;
    } catch (e) {
      return null;
    }
  };

  const getYouTubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const getStatusInfo = (radar: any) => {
    const startTime = parseTime(radar.time);
    if (!startTime) return { status: radar.status, label: radar.status.toUpperCase(), color: 'bg-gray-500' };

    const diffMs = startTime.getTime() - currentTime.getTime();
    const diffMins = diffMs / (1000 * 60);

    // Admin Override Status
    if (radar.status === 'canceled') return { status: 'canceled', label: 'CANCELED', color: 'bg-red-600' };
    if (radar.status === 'delayed') return { status: 'delayed', label: 'DELAYED', color: 'bg-orange-500' };
    if (radar.status === 'completed') return { status: 'completed', label: 'COMPLETED', color: 'bg-gray-500' };

    // Auto Logic
    // Ongoing: starts 10 mins after scheduled time, lasts 2 hours
    if (diffMins <= -10 && diffMins > -130) {
      return { status: 'live', label: 'ONGOING', color: 'bg-red-500 animate-pulse' };
    }
    
    // Upcoming: before start time or within first 10 mins
    if (diffMins > -10) {
      const hours = Math.floor(diffMins / 60);
      const mins = Math.floor(diffMins % 60);
      const secs = Math.floor((diffMs / 1000) % 60);
      
      let countdown = '';
      if (diffMins > 0) {
        countdown = `${hours > 0 ? hours + 'h ' : ''}${mins}m ${secs}s`;
      } else {
        countdown = 'Starting...';
      }

      return { 
        status: 'upcoming', 
        label: 'UPCOMING', 
        color: 'bg-yellow-500',
        countdown 
      };
    }

    return { status: 'completed', label: 'COMPLETED', color: 'bg-gray-500' };
  };

  // Filter out completed/old radars
  const activeRadars = radars.filter(r => {
    const endTime = parseTime(r.endTime || '');
    if (endTime && currentTime > endTime) return false;
    const info = getStatusInfo(r);
    return info.status !== 'completed';
  }).sort((a, b) => {
    const timeA = parseTime(a.time)?.getTime() || 0;
    const timeB = parseTime(b.time)?.getTime() || 0;
    return timeA - timeB;
  });

  const handleAnswerSelect = (teaserId: string, optionIndex: number) => {
    if (showExplanations[teaserId]) return; // Prevent changing answer after revealing
    setSelectedAnswers(prev => ({ ...prev, [teaserId]: optionIndex }));
  };

  const handleCheckAnswer = (teaserId: string) => {
    if (selectedAnswers[teaserId] !== undefined) {
      setShowExplanations(prev => ({ ...prev, [teaserId]: true }));
    }
  };

  return (
    <div className="space-y-5">
      <div className="fixed top-4 right-4 z-[100]">
        <button 
          onClick={toggleDarkMode}
          className="p-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-all text-[var(--primary)]"
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
      <CountdownTimer />
      
      <motion.header 
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex flex-col items-center justify-center text-center relative z-10 p-4 pt-12 gpu"
      >
        <div 
          className="flex flex-row items-center justify-center gap-6 mb-8 group cursor-pointer"
          onClick={() => onNavigate('home')}
        >
          {branding?.logo && (
            <img 
              src={branding.logo} 
              alt="Logo" 
              className="w-28 h-28 md:w-36 md:h-36 lg:w-44 lg:h-44 object-contain drop-shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-transform duration-700 group-hover:scale-110 group-hover:rotate-3" 
            />
          )}
          <div className="flex flex-col items-start translate-y-1">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black leading-[0.8] bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent uppercase tracking-tighter sm:whitespace-nowrap">
              {branding?.title || 'Advanced Classes'}
            </h1>
            <p className="text-[12px] md:text-2xl font-bold opacity-70 uppercase tracking-[0.5em] font-sans mt-2">
              Sonai, Cachar
            </p>
          </div>
        </div>

        <div className="text-sm text-[var(--text-color)] font-bold tracking-widest uppercase opacity-80 mb-6 border-y border-[var(--border-color)] py-1.5 px-5 inline-block">
          Phase 2 Restart
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--primary)]/10 via-transparent to-[var(--secondary)]/10 p-8 rounded-3xl border border-[var(--primary)]/20 mb-8 w-full max-w-3xl mx-auto shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] backdrop-blur-sm group">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-[var(--primary)]/20 rounded-full blur-3xl group-hover:bg-[var(--primary)]/30 transition-colors duration-500"></div>
          <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-[var(--secondary)]/20 rounded-full blur-3xl group-hover:bg-[var(--secondary)]/30 transition-colors duration-500"></div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex items-center gap-2.5 mb-4 flex-wrap justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold border border-[var(--primary)]/20">
                <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse"></span>
                Admissions Open
              </div>
              
              <a 
                href="https://maps.app.goo.gl/4R49EfUuGHfvTQw58" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-[var(--danger)] text-[10px] font-bold border border-red-500/20 hover:bg-red-500/20 transition-all"
              >
                <MapPin size={12} /> Sonai
              </a>
              
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-[var(--success)] text-[10px] font-bold border border-emerald-500/20">
                <CalendarCheck size={12} /> Session 2026-27
              </div>
            </div>
            
            <h2 className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] mb-3 text-center leading-tight">
              Get Physics, Chemistry, Mathematics & Biology Tuition in Sonai
            </h2>
            
            <p className="text-sm md:text-base font-semibold text-[var(--text-color)] opacity-80 mb-6 text-center max-w-xl">
              For HS 1st & 2nd Year <span className="mx-2 text-[var(--primary)]/50">|</span> NEET <span className="mx-2 text-[var(--primary)]/50">|</span> JEE Aspirants
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-enrollment'))}
              className="inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#5B3CFF] to-[#6C4DFF] text-white px-10 py-3 rounded-2xl font-extrabold text-2xl shadow-[0_10px_30px_rgba(91,60,255,0.35)] hover:scale-[1.02] active:scale-95 transition-all"
            >
              Enroll Now <ArrowRight size={22} />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-4xl mx-auto px-4">
          <a 
            href="tel:6001539070" 
            className="flex-1 inline-flex items-center justify-center gap-2.5 bg-gradient-to-br from-blue-600 to-blue-800 text-white w-full py-4 px-6 rounded-2xl font-bold shadow-lg transition-all duration-200 border border-white/20 text-lg hover:scale-[1.03] active:scale-95"
          >
            <Phone size={24} />
            Call Now: 6001539070
          </a>
          
          <a 
            href="https://chat.whatsapp.com/DTdhZ56STusGNLu8I72Vne" 
            target="_blank" 
            rel="noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-2.5 bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white w-full py-4 px-6 rounded-2xl font-bold shadow-lg transition-all duration-200 border border-white/20 text-lg hover:scale-[1.03] active:scale-95"
          >
            <MessageCircle size={24} />
            Join WhatsApp Group
          </a>

        </div>
      </motion.header>

      {/* Live Class Radar */}
      {activeRadars.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="glass-card !p-4 bg-gradient-to-r from-red-500/5 to-transparent border-red-500/20 gpu"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <h3 className="font-bold text-sm uppercase tracking-wider text-red-500">Live Class Radar</h3>
            </div>
            <span className="text-[10px] opacity-50 font-bold uppercase tracking-widest">Real-time Updates</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeRadars.map(radar => {
              const info = getStatusInfo(radar);
              return (
                <div key={radar.id} className="bg-white/5 border border-[var(--border-color)] p-4 rounded-xl space-y-4 relative overflow-hidden group">
                  <div className="flex items-center justify-between gap-4 relative z-10">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${info.color}`}></span>
                        <h4 className="font-bold text-sm truncate">
                          <MarkdownRenderer content={radar.title} inline />
                        </h4>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Clock size={10} className="opacity-50" />
                          <p className="text-[10px] opacity-70 font-bold">
                            {radar.startTime} {radar.endTime ? `- ${radar.endTime}` : ''}
                          </p>
                        </div>
                        {info.countdown && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-bold uppercase opacity-40 tracking-wider">Starting in</span>
                            <span className="text-[10px] font-mono font-bold text-[var(--primary)] bg-[var(--primary)]/10 px-1.5 rounded">
                              {info.countdown}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded text-white ${info.color}`}>
                        {info.label}
                      </span>
                      {radar.link && info.status !== 'canceled' && (
                        <a 
                          href={radar.link} 
                          target="_blank" 
                          rel="noreferrer"
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${info.status === 'live' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/10 text-[var(--text-color)]'}`}
                        >
                          {info.status === 'live' ? 'JOIN NOW' : 'GO TO CLASS'}
                        </a>
                      )}
                      {info.status === 'upcoming' && (
                        <a 
                          href={getGoogleCalendarUrl(radar)}
                          target="_blank" 
                          rel="noreferrer"
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5"
                          title="Add to Google Calendar"
                        >
                          <Calendar size={10} />
                          SCHEDULE
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Media Content */}
                  {radar.type && radar.type !== 'text' && (
                    <div className="relative z-10 bg-black/20 rounded-lg overflow-hidden border border-white/5">
                      {radar.type === 'video' && (radar.externalUrl || radar.fileUrl) && (
                        <div className="aspect-video w-full">
                          <iframe
                            className="w-full h-full"
                            src={radar.externalUrl?.includes('youtube.com') || radar.externalUrl?.includes('youtu.be') 
                              ? `https://www.youtube.com/embed/${radar.externalUrl.split('v=')[1]?.split('&')[0] || radar.externalUrl.split('/').pop()}`
                              : radar.externalUrl || radar.fileUrl}
                            title="Class Video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          ></iframe>
                        </div>
                      )}
                      {radar.type === 'image' && (radar.fileUrl || radar.externalUrl) && (
                        <div className="relative group/media">
                          <img src={radar.fileUrl || radar.externalUrl} alt="Class Media" className="w-full h-auto max-h-[300px] object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <a href={radar.fileUrl || radar.externalUrl} target="_blank" rel="noreferrer" className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-md transition-all">
                              <ExternalLink size={20} />
                            </a>
                            <a href={radar.fileUrl || radar.externalUrl} download className="p-2 bg-white/20 hover:bg-white/30 rounded-full text-white backdrop-blur-md transition-all">
                              <Download size={20} />
                            </a>
                          </div>
                        </div>
                      )}
                      {radar.type === 'voice' && (radar.fileUrl || radar.externalUrl) && (
                        <div className="p-3 flex items-center gap-3 bg-white/5">
                          <div className="p-2 bg-[var(--primary)]/20 rounded-full text-[var(--primary)]">
                            <Mic size={20} />
                          </div>
                          <audio controls className="flex-1 h-8">
                            <source src={radar.fileUrl || radar.externalUrl} type="audio/mpeg" />
                            Your browser does not support the audio element.
                          </audio>
                          <a href={radar.fileUrl || radar.externalUrl} download className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                            <Download size={18} />
                          </a>
                        </div>
                      )}
                      {radar.type === 'pdf' && (radar.fileUrl || radar.externalUrl) && (
                        <div className="p-4 flex items-center justify-between bg-white/5">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-red-500/20 rounded-lg text-red-500">
                              <FileText size={24} />
                            </div>
                            <div>
                              <p className="text-xs font-bold">Class Document (PDF)</p>
                              <p className="text-[10px] opacity-50">Open to view or download</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <a href={radar.fileUrl || radar.externalUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5">
                              <ExternalLink size={14} /> VIEW
                            </a>
                            <a href={radar.fileUrl || radar.externalUrl} download className="px-3 py-1.5 bg-[var(--primary)] text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5">
                              <Download size={14} /> DOWNLOAD
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5 relative z-10 items-center">
                    {radar.link && info.status !== 'canceled' && (
                      <a 
                        href={radar.link} 
                        target="_blank" 
                        rel="noreferrer"
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${info.status === 'live' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/10 text-[var(--text-color)]'}`}
                      >
                        {info.status === 'live' ? <Zap size={10} /> : <ExternalLink size={10} />}
                        {info.status === 'live' ? 'JOIN NOW' : 'GO TO CLASS'}
                      </a>
                    )}
                    {radar.instagramProfile && (
                       <a href={radar.instagramProfile.startsWith('http') ? radar.instagramProfile : `https://instagram.com/${radar.instagramProfile.replace('@', '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border border-pink-500/20 rounded-lg text-xs font-bold text-pink-500 transition-all">
                         <Instagram size={14} /> Teacher's Insta
                       </a>
                    )}
                  </div>

                  {radar.notes && (
                    <p className="text-[10px] relative z-10 text-[var(--primary)] font-bold italic opacity-80 border-l-2 border-[var(--primary)]/30 pl-3 py-0.5">
                      Note: {radar.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="glass-card relative z-20 pt-8 gpu"
      >
        <h3 className="text-center uppercase text-[var(--primary)] mb-5 font-bold tracking-wide">The Sonai Story</h3>
        <div className="border-l-2 border-[var(--border-color)] ml-2.5 pl-5">
          <div className="relative mb-6">
            <div className="absolute -left-[27px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--danger)]"></div>
            <div className="font-bold mb-1 text-[var(--danger)]">The Struggle</div>
            <p className="text-sm opacity-90">Rush to Silchar. 60-80 students. 1.5 hrs travel. Exhaustion.</p>
          </div>
          <div className="relative mb-6">
            <div className="absolute -left-[27px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--secondary)]"></div>
            <div className="font-bold mb-1 text-[var(--secondary)]">The Reality</div>
            <p className="text-sm opacity-90">Crowded classes. Unsolved doubts. Lost Confidence.</p>
          </div>
          <div className="relative mb-6">
            <div className="absolute -left-[27px] top-1.5 w-2.5 h-2.5 rounded-full bg-[var(--success)]"></div>
            <div className="font-bold mb-1 text-[var(--success)]">The Solution</div>
            <p className="text-sm opacity-90"><b>Advanced Classes.</b> Small batches. Smart Boards. No Travel. <b>Result? Growth.</b></p>
          </div>
        </div>

        <div className="mt-5 text-center border-t border-dashed border-[var(--border-color)] pt-4">
          <button 
            onClick={() => onNavigate('about')}
            className="bg-transparent border-none text-[var(--primary)] font-bold cursor-pointer text-sm flex items-center justify-center gap-2 mx-auto hover:opacity-80 transition-opacity"
          >
            Read Full About Us <ArrowRight size={16} />
          </button>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass-card"
      >
        <div className="flex items-center gap-2.5 mb-1.5 text-lg">
          <MapPin className="text-[var(--danger)]" size={20} />
          <b className="tracking-wide text-[var(--primary)] uppercase font-black">Tuition Location</b>
        </div>
        <p className="opacity-90 mb-2 font-bold text-sm">Mathematics Only Tuition For Class XI, XII</p>
        <p className="opacity-70 mb-4 text-xs">Sonai, Cachar (24.7311519, 92.8911900)</p>
        <a 
          href="https://share.google/MTzvbg4BOw6Ya3vTF" 
          target="_blank" 
          rel="noreferrer"
          className="block w-full p-4 text-center border border-[var(--border-color)] rounded-2xl no-underline text-[var(--text-color)] font-bold bg-white/10 transition-all duration-300 hover:bg-[var(--primary)] hover:text-white hover:border-[var(--primary)] hover:-translate-y-1 hover:shadow-xl group"
        >
          <div className="flex items-center justify-center gap-2">
            Show in Google Maps
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </a>
      </motion.div>

      {/* Flash Drops */}
      {drops.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drops.map((drop, idx) => (
            <motion.div 
              key={drop.id} 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, ease: "easeOut", delay: idx * 0.1 }}
              className="glass-card relative overflow-hidden group flex flex-col"
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition-colors"></div>
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <Zap className="text-yellow-500" size={20} />
                <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                  {drop.type === 'text' ? 'Announcement' : drop.type?.toUpperCase() || 'FLASH DROP'}
                </span>
              </div>
              <h4 className="font-bold text-lg mb-2 relative z-10 line-clamp-2" title={drop.title}>
                {drop.externalUrl || drop.fileUrl ? (
                  <a href={drop.externalUrl || drop.fileUrl} target="_blank" rel="noreferrer" className="hover:underline hover:text-[var(--primary)] transition-colors">
                    <MarkdownRenderer content={drop.title} inline />
                  </a>
                ) : (
                  <MarkdownRenderer content={drop.title} inline />
                )}
              </h4>
              
              {drop.content ? (
                <div className="text-sm opacity-90 relative z-10 mb-4 flex-1">
                  <MarkdownRenderer content={drop.content} />
                </div>
              ) : (
                <div className="text-sm opacity-90 relative z-10 mb-4 flex-1 line-clamp-2 break-all">
                  {drop.externalUrl || drop.fileUrl || ''}
                </div>
              )}

              {/* Rich Media Rendering */}
              <div className="relative z-10 space-y-3">
                {drop.type === 'video' && drop.externalUrl && getYouTubeId(drop.externalUrl) && (
                  <div className="aspect-video w-full rounded-xl overflow-hidden border border-[var(--border-color)] bg-black">
                    <iframe 
                      src={`https://www.youtube.com/embed/${getYouTubeId(drop.externalUrl)}`}
                      className="w-full h-full"
                      allowFullScreen
                      title={drop.title}
                    />
                  </div>
                )}

                {drop.type === 'image' && drop.fileUrl && (
                  <div className="rounded-xl overflow-hidden border border-[var(--border-color)]">
                    <img src={drop.fileUrl} alt={drop.title} className="w-full h-auto" referrerPolicy="no-referrer" />
                  </div>
                )}

                {drop.type === 'pdf' && drop.fileUrl && (
                  <div className="flex gap-2">
                    <a 
                      href={drop.fileUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex-1 p-3 bg-[var(--primary)] text-white rounded-xl text-center text-sm font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={16} /> Open PDF
                    </a>
                  </div>
                )}

                {drop.type === 'voice' && drop.fileUrl && (
                  <div className="bg-white/5 p-3 rounded-xl border border-[var(--border-color)]">
                    <audio src={drop.fileUrl} controls className="w-full h-8" />
                    <a href={drop.fileUrl} download className="text-[10px] font-bold opacity-50 hover:opacity-100 mt-2 block text-center uppercase tracking-widest">Download Audio</a>
                  </div>
                )}

                {drop.externalUrl && drop.type !== 'video' && (
                  <a 
                    href={drop.externalUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="block w-full p-3 border border-[var(--border-color)] rounded-xl text-center text-sm font-bold hover:bg-white/5 transition-all"
                  >
                    Visit Link
                  </a>
                )}
              </div>

              {drop.expiresAt && (
                <div className="mt-4 text-[10px] uppercase tracking-wider opacity-50 font-bold relative z-10">
                  Expires: {new Date(drop.expiresAt).toLocaleString()}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Star of the Week */}
      {stars.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="glass-card relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl"></div>
          <div className="flex items-center gap-2.5 mb-5 text-lg relative z-10">
            <Star className="text-yellow-500 fill-yellow-500" size={24} />
            <b className="tracking-wide text-yellow-600 dark:text-yellow-500">{branding?.starTitle || 'STAR OF THE WEEK'}</b>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
            {stars.map(star => (
              <div key={star.id} className="bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/20 p-5 rounded-2xl flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-yellow-500 flex-shrink-0 bg-white/10 flex items-center justify-center">
                  {star.image ? (
                    <img src={star.image} alt={star.name} className="w-full h-full object-cover" />
                  ) : (
                    <Star className="text-yellow-500" size={24} />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-lg">
                    <MarkdownRenderer content={star.name} inline />
                  </h4>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium mb-1">
                    <MarkdownRenderer content={star.achievement} inline />
                  </p>
                  <span className="text-[10px] uppercase tracking-wider opacity-60 font-bold">{star.week}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <EnrollmentSection />

      {/* Footer */}
      <footer className="mt-8 text-center text-sm text-[var(--text-color)]/70 flex flex-col items-center gap-2">
        <p className="font-medium">
          Made by <span className="font-bold text-[var(--primary)]">Ackier LLP</span>
        </p>
        <p className="flex items-center gap-1.5">
          Made with <span className="text-red-500 animate-pulse">❤️</span> By{' '}
          <a 
            href="https://instagram.com/xavy.dev" 
            target="_blank" 
            rel="noreferrer"
            className="font-bold text-[var(--secondary)] hover:underline transition-all"
          >
            @xavy.dev
          </a>
        </p>
        <p className="text-xs opacity-60 mt-2">
          Note: Enrollments system improvements are underway.
        </p>
      </footer>
    </div>
  );
}
