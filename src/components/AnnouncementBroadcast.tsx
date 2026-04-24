import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  AlertTriangle, 
  Info, 
  Megaphone,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'urgent';
  isActive: boolean;
  link?: string;
  expiresAt?: string;
  createdAt: string;
}

export default function AnnouncementBroadcast() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'announcements'), 
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const latest = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Announcement;
        
        // Check if expires
        if (latest.expiresAt && new Date(latest.expiresAt) < new Date()) {
          setIsVisible(false);
          return;
        }

        // Check local storage to see if user dismissed this specific one
        const dismissed = localStorage.getItem(`announcement_${latest.id}`);
        if (!dismissed) {
          setAnnouncement(latest);
          setIsVisible(true);
        }
      } else {
        setIsVisible(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleDismiss = () => {
    if (announcement) {
      localStorage.setItem(`announcement_${announcement.id}`, 'true');
    }
    setIsVisible(false);
  };

  const getTypeStyles = (type: string) => {
    switch (type) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'warning': return 'bg-amber-500 text-white';
      default: return 'bg-indigo-600 text-white';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'urgent': return <AlertTriangle size={24} />;
      case 'warning': return <Info size={24} />;
      default: return <Megaphone size={24} />;
    }
  };

  return (
    <AnimatePresence>
      {isVisible && announcement && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center pointer-events-none p-4 md:p-8">
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.9 }}
            className="w-full max-w-lg bg-white dark:bg-[#1a1a1a] rounded-[32px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-200 dark:border-white/10 overflow-hidden pointer-events-auto"
          >
            <div className={`p-6 flex items-start gap-4 ${getTypeStyles(announcement.type)}`}>
              <div className="p-3 bg-white/20 rounded-2xl shadow-inner">
                {getIcon(announcement.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-black uppercase tracking-tight leading-tight">{announcement.title}</h3>
                <div className="flex items-center gap-2 mt-1 opacity-80 decoration-white/30 underline underline-offset-4">
                   <Bell size={12} />
                   <span className="text-[10px] font-bold uppercase tracking-widest">Global Broadcast</span>
                </div>
              </div>
              <button 
                onClick={handleDismiss}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                title="Dismiss"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <p className="text-gray-600 dark:text-gray-300 font-medium leading-relaxed whitespace-pre-wrap">
                {announcement.content}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                {announcement.link && (
                  <a 
                    href={announcement.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-3 px-6 py-4 bg-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-600/20 active:scale-95 transition-all"
                  >
                    Take Action
                    <ExternalLink size={18} />
                  </a>
                )}
                <button 
                  onClick={handleDismiss}
                  className="flex-1 px-8 py-4 bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-gray-200 font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10 active:scale-95 transition-all"
                >
                  Understood
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
