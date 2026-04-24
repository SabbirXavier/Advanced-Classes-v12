import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  Zap, 
  Brain, 
  Radio, 
  MessageSquare, 
  Star, 
  ArrowUpRight, 
  GraduationCap, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  Target,
  Users,
  Trophy,
  UserCheck,
  ShieldCheck,
  Shield,
  Download,
  X
} from 'lucide-react';
import { landingService, LandingConfig, Achiever, Faculty } from '../services/landingService';
import { brandingService, BrandingConfig } from '../services/brandingService';

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';

const ICON_MAP: Record<string, any> = {
  Zap, Brain, Radio, MessageSquare, Star, GraduationCap, BookOpen, Clock, Target, Users, Trophy, UserCheck, ShieldCheck
};

export default function LandingPage() {
  const [config, setConfig] = useState<LandingConfig | null>(null);
  const [achievers, setAchievers] = useState<Achiever[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [expandedFaculty, setExpandedFaculty] = useState<Record<string, boolean>>({});
  const [zoomedFaculty, setZoomedFaculty] = useState<Faculty | null>(null);
  const [legalModal, setLegalModal] = useState<string | null>(null);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [isSubmittingLead, setIsSubmittingLead] = useState(false);
  const [leadFormData, setLeadFormData] = useState({
    name: '',
    phone: '',
    email: '',
    course: ''
  });

  useEffect(() => {
    const unsubConfig = landingService.listenToConfig(setConfig);
    const unsubAchievers = landingService.listenToAchievers(setAchievers);
    const unsubFaculty = landingService.listenToFaculty(setFaculty);
    const unsubBranding = brandingService.listenToBranding(setBranding);
    return () => {
      unsubConfig();
      unsubAchievers();
      unsubFaculty();
      unsubBranding();
    };
  }, []);

  const handleCTA = () => {
    setShowLeadForm(true);
  };

  const submitLeadForm = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Robust validation
    const nameTrimmed = leadFormData.name.trim();
    const phoneClean = leadFormData.phone.replace(/\D/g, '');
    
    if (nameTrimmed.length < 3) {
      toast.error("Please enter a valid full name (at least 3 characters).");
      return;
    }
    
    if (phoneClean.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number.");
      return;
    }
    
    if (leadFormData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadFormData.email)) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setIsSubmittingLead(true);
    const toastId = toast.loading('Submitting your details...');
    try {
      await addDoc(collection(db, 'leads'), {
        ...leadFormData,
        createdAt: serverTimestamp(),
        source: 'landing_page',
        status: 'new'
      });
      toast.success('Thank you! Our team will contact you shortly.', { id: toastId });
      setShowLeadForm(false);
      setLeadFormData({ name: '', phone: '', email: '', course: '' });
    } catch (err) {
      toast.error('Failed to submit. Please try again.', { id: toastId });
    }
    setIsSubmittingLead(false);
  };

  if (!config) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-[var(--primary)] selection:text-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 px-6 py-4 flex items-center justify-between backdrop-blur-md border-b border-white/5 bg-black/50">
        <div 
          className="flex items-center gap-4 cursor-pointer group"
          onClick={() => window.location.href = '/'}
        >
          {branding?.logo ? (
            <img 
              src={branding.logo} 
              className="w-12 h-12 md:w-14 md:h-14 object-contain drop-shadow-xl group-hover:scale-105 transition-transform" 
              referrerPolicy="no-referrer" 
            />
          ) : (
            <div className="w-10 h-10 bg-[var(--primary)] rounded-xl flex items-center justify-center shadow-lg shadow-[var(--primary)]/20">
              <Star className="text-white fill-current" size={24} />
            </div>
          )}
          <span className="text-xl md:text-2xl font-black tracking-tight uppercase italic bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent group-hover:from-[var(--primary)] group-hover:to-white transition-all">
            {branding?.title || 'Advanced Classes'}
          </span>
        </div>
        <button 
          onClick={() => window.location.href = '/'}
          className="text-sm font-bold opacity-60 hover:opacity-100 transition-opacity"
        >
          Home
        </button>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[var(--primary)] rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[10%] right-[-10%] w-[40%] h-[40%] bg-blue-500 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col items-center text-center space-y-8 will-change-transform">
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest text-[var(--primary)]"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--primary)] text-white"></span>
              </span>
              Best Institute now in Sonai
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="text-5xl md:text-8xl font-black tracking-tight leading-[0.9] md:leading-[0.85] uppercase max-w-4xl"
            >
              {config.heroTitle.split(' ').map((word, i) => (
                <span key={i}>
                  {i === 2 ? <span className="text-[var(--primary)] italic">{word} </span> : `${word} `}
                </span>
              ))}
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-lg md:text-xl text-gray-400 max-w-2xl font-medium whitespace-pre-wrap"
            >
              {config.heroSubtitle}
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
            >
              <button 
                onClick={handleCTA}
                className="group relative px-8 py-5 bg-[var(--primary)] text-white text-lg font-black rounded-2xl shadow-2xl shadow-[var(--primary)]/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                JOIN THE REVOLUTION
                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Counter Section */}
      <section className="py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {config.stats.map((stat, i) => (
              <div key={i} className="text-center space-y-1">
                <div className="text-3xl md:text-4xl font-black tracking-tighter text-[var(--primary)]">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 whitespace-pre-line">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Strategic Features */}
      <section className="py-16 md:py-20 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 md:mb-12 space-y-4">
            <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">Advanced Learning Features</h2>
            <div className="w-20 h-2 bg-[var(--primary)] rounded-full" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Zap className="text-yellow-400" />}
              title="Smart Rooms & Interaction"
              points={["Flat Interactive Board Aid", "Basic Smart Learning Rooms", "Immersive Visual Analysis"]}
            />
            <FeatureCard 
              icon={<Brain className="text-purple-400" />}
              title="Mentorship & Testing"
              points={["Best Mentorship 24/7", "PYQ Bundles & Practice", "Regular MCQ Testing"]}
            />
            <FeatureCard 
              icon={<Target className="text-red-400" />}
              title="Academic Excellence"
              points={["100% Syllabus Coverage", "Proper Revision Sessions", "NEET & JEE Special Batches"]}
            />
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MiniFeature icon={<Clock size={16} />} text="All classes recorded for later review" />
            <MiniFeature icon={<UserCheck size={16} />} text="Advanced Attendance Tracking" />
            <MiniFeature icon={<Users size={16} />} text="Performance & Individual Attention" />
            <MiniFeature icon={<ShieldCheck size={16} />} text="Effective Career Counseling" />
          </div>
        </div>
      </section>

      {/* Achievers Section */}
      {achievers.length > 0 && (
        <section className="py-16 md:py-20 px-6 bg-white/[0.01]">
          <div className="max-w-7xl mx-auto">
            <div className="mb-10 md:mb-12 text-center">
              <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight italic">
                Our <span className="text-[var(--primary)]">Achievers</span>
              </h2>
              <p className="text-gray-500 text-sm mt-2 font-bold uppercase tracking-widest">Hall of Fame from Advanced Classes</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
              {achievers.map((achiever) => (
                <motion.div 
                  key={achiever.id}
                  whileHover={{ y: -5 }}
                  className="group relative bg-[#111] border border-white/5 rounded-2xl overflow-hidden aspect-[4/5]"
                >
                  {achiever.photo ? (
                    <img src={achiever.photo} alt={achiever.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/5">
                      <Users size={40} className="opacity-20" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-4">
                    <div className="text-[10px] font-black text-[var(--primary)] uppercase italic leading-none mb-1">
                      {achiever.rank} {achiever.achievementTitle && `• ${achiever.achievementTitle}`}
                    </div>
                    <div className="text-sm font-bold truncate">{achiever.name}</div>
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/10">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">
                          {achiever.batch || achiever.grade}
                        </span>
                      </div>
                      <span className="text-[10px] font-black">{achiever.percentage}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Faculty Section */}
      {faculty.length > 0 && (
        <section className="py-16 md:py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-12 gap-6">
              <div className="space-y-4">
                <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight">Elite Faculty</h2>
                <div className="w-20 h-2 bg-[var(--primary)] rounded-full" />
                <p className="text-gray-400 font-medium">Learn from highly qualified and experienced experts.</p>
              </div>
              <div className="flex gap-2">
                 <button onClick={handleCTA} className="px-6 py-3 bg-white/5 rounded-xl text-xs font-bold hover:bg-white/10 transition-all border border-white/10">TALK TO EXPERTS</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {faculty.map((f) => (
                <motion.div 
                  key={f.id}
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                  className="bg-white/[0.03] border border-white/5 rounded-[2.5rem] p-6 flex flex-col items-center text-center hover:bg-white/[0.05] hover:border-[var(--primary)]/30 transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--primary)]/5 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-[var(--primary)]/10 transition-colors"></div>
                  
                  <div 
                    className="w-28 h-28 rounded-2xl overflow-hidden mb-6 border-2 border-white/10 group-hover:border-[var(--primary)]/50 transition-colors shadow-2xl relative z-10 cursor-zoom-in"
                    onClick={() => setZoomedFaculty(f)}
                  >
                    {f.photo ? (
                      <motion.img 
                        layoutId={`faculty-photo-${f.id}`}
                        src={f.photo} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center text-gray-500">
                        <Users size={40} />
                      </div>
                    )}
                  </div>

                  <div className="relative z-10 space-y-3">
                    <div>
                      <h4 className="font-black text-xl leading-tight group-hover:text-[var(--primary)] transition-colors tracking-tight">{f.name}</h4>
                      <div className="inline-block px-3 py-1 bg-[var(--primary)]/10 rounded-full mt-2">
                         <p className="text-[10px] text-[var(--primary)] font-black uppercase tracking-widest">{f.degree}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 space-y-2">
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-400 font-bold uppercase tracking-wider">
                        <Star size={12} className="text-yellow-500 fill-current" />
                        {f.experience} Experience
                      </div>
                        <div className="flex flex-col items-center justify-center gap-2 text-xs text-gray-400 font-semibold italic bg-white/5 py-2 px-4 rounded-xl w-full">
                          <div className="flex flex-col gap-2 w-full">
                            <div className="flex items-center gap-2 justify-center">
                              <Trophy size={14} className="text-[var(--primary)] shrink-0" />
                              <span className="font-black uppercase tracking-widest text-[var(--primary)]">Key Achievements</span>
                            </div>
                            <div className={`space-y-1 text-left ${expandedFaculty[f.id] ? "" : "line-clamp-3"}`}>
                              {f.achievement.split('\n').map((line, i) => (
                                <div key={i} className="flex gap-2 items-start text-[10px] leading-relaxed">
                                  {line.trim().startsWith('*') ? (
                                    <>
                                      <CheckCircle2 size={10} className="text-[var(--primary)] shrink-0 mt-1" />
                                      <span>{line.replace('*', '').trim()}</span>
                                    </>
                                  ) : (
                                    <span className="italic">{line}</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          {f.achievement.length > 60 && (
                            <button 
                              onClick={() => setExpandedFaculty(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                              className="text-[var(--primary)] text-[10px] font-black uppercase tracking-widest mt-1 hover:underline"
                            >
                              {expandedFaculty[f.id] ? "Show Less" : "Read More"}
                            </button>
                          )}
                        </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Sticky CTA for Mobile */}
      <motion.div 
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="md:hidden fixed bottom-6 left-6 right-6 z-[60] gpu"
      >
        <button 
          onClick={handleCTA}
          className="w-full py-5 bg-[var(--primary)] text-white font-black rounded-2xl shadow-2xl shadow-[var(--primary)]/40 flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          ENROLL NOW
          <ArrowRight size={20} />
        </button>
      </motion.div>

      <footer className="pt-12 pb-32 md:pb-12 px-6 border-t border-white/5 text-center bg-white/[0.01]">
        <p className="text-xs text-gray-500 font-medium tracking-wide italic">
          © 2026 Advanced Classes. All rights reserved.
        </p>
      </footer>

      {/* Zoom Modal */}
      <AnimatePresence>
        {zoomedFaculty && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setZoomedFaculty(null)}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 cursor-zoom-out"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="relative max-w-2xl w-full flex flex-col items-center"
              onClick={e => e.stopPropagation()}
            >
              <motion.div 
                layoutId={`faculty-photo-${zoomedFaculty.id}`}
                className="w-64 h-64 md:w-96 md:h-96 rounded-3xl overflow-hidden shadow-2xl border-4 border-white/10 mb-8"
              >
                <img 
                  src={zoomedFaculty.photo} 
                  alt={zoomedFaculty.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </motion.div>
              <div className="text-center space-y-4">
                <h3 className="text-4xl font-black text-[var(--primary)] uppercase italic leading-none">{zoomedFaculty.name}</h3>
                <div className="inline-block px-4 py-2 bg-[var(--primary)]/10 rounded-full">
                  <p className="text-sm text-[var(--primary)] font-black uppercase tracking-widest">{zoomedFaculty.degree}</p>
                </div>
                <p className="text-gray-400 font-medium max-w-lg mx-auto leading-relaxed whitespace-pre-wrap text-center">{zoomedFaculty.achievement}</p>
                <div className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">{zoomedFaculty.experience} Excellence</div>
              </div>
              <button 
                onClick={() => setZoomedFaculty(null)}
                className="absolute -top-12 right-0 p-2 text-white/50 hover:text-white transition-colors"
              >
                <X size={32} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="border-t border-white/10 bg-[#050505] pt-16 pb-8 px-6 mt-20 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Star className="text-[var(--primary)] fill-[var(--primary)]" size={24} />
              <span className="text-xl font-black uppercase italic tracking-tight">{branding?.title || 'Advanced Classes'}</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
              Empowering students with premium educational resources, interactive live classes, and data-driven performance tracking to ensure academic excellence.
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Contact Us</h4>
            <ul className="space-y-3 text-sm text-gray-300">
              <li className="flex gap-2"><span className="text-[var(--primary)] font-bold">Email:</span> {branding?.contactEmail || import.meta.env.VITE_ADMIN_EMAIL || 'support@advancedclasses.com'}</li>
              <li className="flex gap-2"><span className="text-[var(--primary)] font-bold">Phone:</span> {branding?.contactPhone || '+91 9876543210'}</li>
              <li className="flex gap-2"><span className="text-[var(--primary)] font-bold">Address:</span> {branding?.contactAddress || '123 Education Hub, Knowledge Park, City Center - 400001, India'}</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li><button onClick={() => setLegalModal('privacy')} className="text-gray-400 hover:text-[var(--primary)] transition-colors">Privacy Policy</button></li>
              <li><button onClick={() => setLegalModal('terms')} className="text-gray-400 hover:text-[var(--primary)] transition-colors">Terms of Service</button></li>
              <li><button onClick={() => setLegalModal('fee-policy')} className="text-gray-400 hover:text-[var(--primary)] transition-colors">Fee & Payment Policy</button></li>
              <li><button onClick={() => setLegalModal('refund')} className="text-gray-400 hover:text-[var(--primary)] transition-colors">Refund & Cancellation</button></li>
              <li><button onClick={() => setLegalModal('about')} className="text-gray-400 hover:text-[var(--primary)] transition-colors">About Us</button></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Quick Links</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li><button onClick={handleCTA} className="hover:text-white transition-colors">Student Login / Register</button></li>
              <li><button onClick={handleCTA} className="hover:text-white transition-colors">Browse Courses</button></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-gray-600 font-bold uppercase tracking-wider">
          <div>© {new Date().getFullYear()} {branding?.title || 'Advanced Classes'}. All rights reserved.</div>
          <div className="flex gap-4">
            <span>Operated strictly in accordance with local regulations</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-6 pt-6 border-t border-white/5 text-[10px] text-gray-500 text-center leading-relaxed max-w-4xl">
          <strong>Disclaimer:</strong> This platform provides coaching, supplementary material, and educational resources. Results may vary depending on individual effort and dedication. We are not officially affiliated with any government examination boards or institutions unless explicitly stated. Any performance claims are based on specific top performers and do not guarantee future success for all users.
        </div>
      </footer>

      {/* Lead Generation Form Modal */}
      <AnimatePresence>
        {showLeadForm && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[3000] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 gpu"
            onClick={() => setShowLeadForm(false)}
          >
            <motion.div 
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative max-w-md w-full bg-[#111] border border-[var(--primary)]/30 rounded-3xl p-6 sm:p-8 gpu"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowLeadForm(false)}
                className="absolute top-4 right-4 p-2 text-white/50 hover:text-white bg-white/5 rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-[var(--primary)]/20 text-[var(--primary)] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star size={24} className="fill-[var(--primary)]" />
                </div>
                <h3 className="text-2xl font-black uppercase italic text-white tracking-tight">Request Info</h3>
                <p className="text-sm text-gray-400 mt-2 font-medium">Fill out the form below and our expert counselors will get back to you.</p>
              </div>

              <form onSubmit={submitLeadForm} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1 block">Full Name *</label>
                  <input 
                    type="text" 
                    required
                    value={leadFormData.name}
                    onChange={(e) => setLeadFormData({...leadFormData, name: e.target.value})}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--primary)]/50 transition-all placeholder:text-gray-600"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1 block">Phone / WhatsApp *</label>
                  <input 
                    type="tel" 
                    required
                    value={leadFormData.phone}
                    onChange={(e) => setLeadFormData({...leadFormData, phone: e.target.value})}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--primary)]/50 transition-all placeholder:text-gray-600"
                    placeholder="Enter your mobile number"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1 block">Email (Optional)</label>
                  <input 
                    type="email" 
                    value={leadFormData.email}
                    onChange={(e) => setLeadFormData({...leadFormData, email: e.target.value})}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--primary)]/50 transition-all placeholder:text-gray-600"
                    placeholder="Enter your email address"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1 block">Course Interested In</label>
                  <input 
                    type="text" 
                    value={leadFormData.course}
                    onChange={(e) => setLeadFormData({...leadFormData, course: e.target.value})}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:border-[var(--primary)]/50 transition-all placeholder:text-gray-600"
                    placeholder="E.g. Class 12 Boards, NEET, JEE"
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={isSubmittingLead}
                  className="w-full mt-4 px-6 py-4 bg-[var(--primary)] text-white rounded-xl font-black text-sm uppercase tracking-wider shadow-xl shadow-[var(--primary)]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingLead ? 'Submitting...' : 'Send Inquiry'}
                </button>
                <div className="text-center mt-4 text-[10px] text-gray-500">
                  By submitting, you agree to our <button type="button" onClick={() => {setShowLeadForm(false); setLegalModal('terms');}} className="text-[var(--primary)] underline hover:text-white">Terms</button> & <button type="button" onClick={() => {setShowLeadForm(false); setLegalModal('privacy');}} className="text-[var(--primary)] underline hover:text-white">Privacy Policy</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legal Modal */}
      <AnimatePresence>
        {legalModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 gpu"
            onClick={() => setLegalModal(null)}
          >
            <motion.div 
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative max-w-3xl w-full max-h-[85vh] bg-[#111] border border-white/10 rounded-3xl p-6 sm:p-10 overflow-y-auto custom-scrollbar gpu"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setLegalModal(null)}
                className="sticky top-0 float-right p-2 text-white/50 hover:text-white bg-black/50 backdrop-blur-md rounded-full transition-colors z-10"
              >
                <X size={24} />
              </button>
              
              <div className="prose prose-invert prose-sm sm:prose-base max-w-none clear-both">
                {legalModal === 'privacy' && (
                  <>
                    <h2 className="text-2xl font-black text-[var(--primary)] uppercase tracking-tight mb-6">Privacy Policy</h2>
                    <p>Last updated: {new Date().toLocaleDateString()}</p>
                    <p>This Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your information when You use the Service and tells You about Your privacy rights and how the law protects You.</p>
                    <h3>Information Collection and Use</h3>
                    <p>We collect several different types of information for various purposes to provide and improve our Service to you. This includes Personal Data (like email address, first name and last name, phone number) and Usage Data depending on your interaction with our platform.</p>
                    <h3>Data Security</h3>
                    <p>The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. We strive to use commercially acceptable means to protect your Personal Data.</p>
                    <h3>Contact Us</h3>
                    <p>If you have any questions about this Privacy Policy, You can contact us securely at {branding?.contactEmail || import.meta.env.VITE_ADMIN_EMAIL || 'support@advancedclasses.com'} or {branding?.contactPhone || '+91 9876543210'}.</p>
                  </>
                )}
                {legalModal === 'terms' && (
                  <>
                    <h2 className="text-2xl font-black text-[var(--primary)] uppercase tracking-tight mb-6">Terms of Service</h2>
                    <p>Please read these terms and conditions carefully before using Our Service.</p>
                    <h3>Acknowledgment</h3>
                    <p>These are the Terms and Conditions governing the use of this Service and the agreement that operates between You and the Company. These Terms and Conditions set out the rights and obligations of all users regarding the use of the Service.</p>
                    <h3>User Accounts</h3>
                    <p>When You create an account with Us, You must provide Us information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of Your account on Our Service.</p>
                    <h3>Termination</h3>
                    <p>We may terminate or suspend Your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if You breach these Terms and Conditions.</p>
                  </>
                )}
                {legalModal === 'fee-policy' && (
                  <>
                    <h2 className="text-2xl font-black text-[var(--primary)] uppercase tracking-tight mb-6 flex items-center gap-2">
                       <Shield size={24} /> Fee & Payment Policy
                    </h2>
                    <div className="bg-[var(--primary)]/5 border border-[var(--primary)]/20 p-5 rounded-2xl mb-8">
                       <p className="text-sm text-[var(--primary)] font-black uppercase mb-2 italic">Official Document 2026-2027</p>
                       <p className="text-xs opacity-70 mb-4">Review the official fee structure, payment schedule, and terms for the 2026-27 session.</p>
                       <a 
                         href="https://drive.google.com/file/d/1RrGU4_efhj6XaEuQIauOAWiy6-KZi5sr/view" 
                         target="_blank" 
                         rel="noreferrer"
                         className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white text-xs font-bold rounded-xl hover:scale-105 transition-all shadow-lg"
                       >
                         <Download size={16} /> VIEW OFFICIAL PDF
                       </a>
                    </div>
                    
                    <h3 className="text-lg font-bold mt-8 mb-4">Payment Norms & Compliance</h3>
                    <p>Advanced Classes, Sonai adheres strictly to RBI digital payment guidelines to ensure maximum security for your transactions.</p>
                    <ul className="list-disc pl-5 space-y-3 mt-4 text-sm opacity-80">
                      <li><strong>Transparency:</strong> All fee components are clearly mentioned in the PDF above. No hidden charges apply.</li>
                      <li><strong>Security:</strong> All online payments must be through verified UPI/IMPS channels. Never share your OTP or UPI PIN with anyone claiming to be from Advanced Classes.</li>
                      <li><strong>Transaction Proof:</strong> For every successful payment, the student must upload/share the transaction ID and screenshot for verification.</li>
                      <li><strong>RBI Guidelines:</strong> We respect the limits and security protocols set by the Reserve Bank of India for merchant and P2P transfers.</li>
                    </ul>
                    <h3>Refund Timeline</h3>
                    <p>Refunds, if approved as per the Cancellation Policy, take 5-7 business days to reflect in your original payment source.</p>
                  </>
                )}
                {legalModal === 'refund' && (
                  <>
                    <h2 className="text-2xl font-black text-[var(--primary)] uppercase tracking-tight mb-6">Refund & Cancellation Policy</h2>
                    <p>Thank you for choosing {branding?.title || 'Advanced Classes'}.</p>
                    <h3>Cancellation</h3>
                    <p>You may request to cancel your enrollment within 7 days of initial purchase. If you cancel within this period, your access to the platform will be immediately revoked.</p>
                    <h3>Refunds</h3>
                    <p>Refunds are processed within 5-7 business days of an approved cancellation request. Partial refunds may be granted if course materials have already been downloaded or accessed extensively. Please contact support at {branding?.contactEmail || import.meta.env.VITE_ADMIN_EMAIL || 'support@advancedclasses.com'} to initiate a refund request.</p>
                  </>
                )}
                {legalModal === 'about' && (
                  <>
                    <h2 className="text-2xl font-black text-[var(--primary)] uppercase tracking-tight mb-6">About Us</h2>
                    <p>We are a dedicated educational platform committed to bridging the gap between ambition and academic excellence.</p>
                    <h3>Our Mission</h3>
                    <p>To provide high-quality, accessible, and comprehensive learning materials through an interactive, digital-first environment.</p>
                    <h3>Our Team</h3>
                    <p>Our educators are highly vetted professionals with years of competitive and academic expertise. We strive to offer an unparalleled learning experience completely centered around student success and growth.</p>
                    <h3>Our Location</h3>
                    <p>{branding?.contactAddress || '123 Education Hub, Knowledge Park, City Center - 400001, India'}</p>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FeatureCard({ icon, title, points }: { icon: React.ReactNode, title: string, points: string[] }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -5 }}
      className="p-8 rounded-3xl bg-white/5 border border-white/10 hover:border-[var(--primary)]/30 transition-all group gpu"
    >
      <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[var(--primary)]/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      <ul className="space-y-3">
        {points.map((p, i) => (
          <li key={i} className="flex items-start gap-2 text-gray-400 text-sm">
            <CheckCircle2 size={16} className="text-[var(--primary)] shrink-0 mt-0.5" />
            {p}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function MiniFeature({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
      <div className="text-[var(--primary)] font-bold">{icon}</div>
      <span className="text-[10px] uppercase font-bold tracking-tight text-gray-300">{text}</span>
    </div>
  );
}
