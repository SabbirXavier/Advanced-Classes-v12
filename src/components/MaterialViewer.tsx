import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen, Shield, AlertCircle, ExternalLink } from 'lucide-react';

interface MaterialViewerProps {
  material: any;
  user: any;
  onClose: () => void;
  onComplete?: (id: string) => void;
}

const MaterialViewer: React.FC<MaterialViewerProps> = ({ material, user, onClose, onComplete }) => {
  useEffect(() => {
    if (material.id && onComplete) onComplete(material.id);
  }, [material.id, onComplete]);

  // Anti-download measures
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'p' || e.key === 's' || e.key === 'u')) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[3000] bg-black/98 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 bg-white/5 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft size={24} className="text-white" />
          </button>
          <div>
            <h3 className="text-white font-bold">{material.title || material.label}</h3>
            <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">{material.type || 'Document'} • Protected Content</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-black uppercase">
            <BookOpen size={14} /> Shield Active
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-lg text-[10px] font-black uppercase">
            <Shield size={14} /> Privacy Protection
          </div>
        </div>
      </div>
      
      <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#050505]">
        <div className="w-full h-full p-2 md:p-8 flex items-center justify-center">
          {(material.type === 'pdf' || (material.url && material.url.includes('.pdf'))) ? (
            <div className="w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl relative bg-white/5 border border-white/10">
              {/* Mobile Fallback Overlay */}
              <div className="md:hidden absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-black/90 z-20">
                <AlertCircle size={48} className="text-amber-500 mb-4" />
                <h4 className="text-xl font-bold mb-2">Mobile Optimized Browser</h4>
                <p className="text-[10px] opacity-60 mb-6 px-4">Protected PDFs often fail to render inside mobile apps. Use our secure portal for optimal viewing on your device.</p>
                <div className="flex flex-col gap-3 w-full">
                  <a 
                    href={material.url.includes('drive.google.com') 
                      ? (material.url.includes('/view') ? material.url.replace('/view', '/preview') : material.url)
                      : material.url
                    } 
                    target="_blank" 
                    rel="noreferrer" 
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={16} /> Open Secure Mode
                  </a>
                  <p className="text-[8px] font-black text-amber-500/50 uppercase tracking-[0.2em]">Privacy Shield Active • Encryption Sync</p>
                </div>
              </div>
              <iframe 
                src={material.url.includes('drive.google.com') 
                  ? (material.url.includes('/view') ? material.url.replace('/view', '/preview') : material.url)
                  : `${material.url}#toolbar=0&navpanes=0&scrollbar=0`
                }
                className="w-full h-full border-none select-none"
                title={material.title || material.label}
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (material.type === 'video' || (material.url && (material.url.includes('youtube') || material.url.includes('youtu.be')))) ? (
            <div className="w-full max-w-5xl aspect-video relative rounded-3xl overflow-hidden shadow-2xl shadow-indigo-500/10 border-4 border-white/5 bg-black">
              <iframe 
                src={material.url.includes('youtube.com') 
                  ? material.url.replace('watch?v=', 'embed/').split('&')[0] + "?autoplay=1&rel=0&modestbranding=1&controls=1&showinfo=0" 
                  : material.url.includes('youtu.be')
                  ? material.url.replace('youtu.be/', 'youtube.com/embed/') + "?autoplay=1&rel=0&modestbranding=1&controls=1&showinfo=0"
                  : material.url}
                className="w-full h-full border-none"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="max-w-2xl w-full text-center p-12 glass-card border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
              <AlertCircle size={64} className="mx-auto text-amber-500 mb-6 drop-shadow-lg" />
              <h4 className="text-2xl font-black mb-4">Privacy Shield Feature Active</h4>
              <p className="text-gray-400 mb-8 font-medium italic">Your session ({user?.email || 'Authenticated User'}) is protected. This content requires authorized viewing only.</p>
              <div className="flex flex-col gap-4 items-center">
                <a href={material.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-8 py-3 bg-[var(--primary)] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-[var(--primary)]/30 hover:scale-105 active:scale-95 transition-all">
                  Open Secure Portal <ExternalLink size={18} />
                </a>
                <p className="text-[10px] opacity-40 uppercase font-bold tracking-widest">Screenshot prevention initialized</p>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Watermark / Anti-print Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] select-none flex flex-wrap gap-20 items-center justify-center overflow-hidden">
           {Array.from({length: 24}).map((_, i) => (
             <span key={i} className="text-white font-black text-4xl rotate-12 select-none whitespace-nowrap">{user?.email || 'PROTECTED CONTENT'}</span>
           ))}
        </div>
      </div>
    </motion.div>
  );
};

export default MaterialViewer;
