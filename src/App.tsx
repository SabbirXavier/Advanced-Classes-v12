import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Layers, Calendar, Download, UserPlus, MessageSquare, Settings, Menu, Sun, Moon, Wallet, ArrowUp, Library, Edit2, BookOpen, Shield, Users } from 'lucide-react';
import TabHome from './components/TabHome';
import TabAbout from './components/TabAbout';
import TabBatches from './components/TabBatches';
import TabRoutine from './components/TabRoutine';
import TabDownloads from './components/TabDownloads';
import TabJoin from './components/TabJoin';
import TabAdmin from './components/TabAdmin';
import TabStudyHub from './components/TabStudyHub';
import TabSettings from './components/TabSettings';
import TabTest from './components/TabTest';
import TabFee from './components/TabFee';
import TabResourceVault from './components/TabResourceVault';
import TabWhiteboard from './components/TabWhiteboard';
import TabMyBatch from './components/TabMyBatch';
import EnrollmentModal from './components/EnrollmentModal';
import AnnouncementBroadcast from './components/AnnouncementBroadcast';
import LandingPage from './components/LandingPage';
import ErrorLogPage from './components/ErrorLogPage';
import SupportChatView from './components/SupportChatView';
import { brandingService, BrandingConfig } from './services/brandingService';
import { authService } from './services/authService';
import { presenceService } from './services/presenceService';
import { channelService } from './services/channelService';
import { firestoreService } from './services/firestoreService';
import { auth, db } from './firebase';

import DecorationBackground from './components/DecorationBackground';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [branding, setBranding] = useState<BrandingConfig>({
    title: 'Advanced Classes',
    logo: '',
    updatedAt: null
  });
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [userEnrollment, setUserEnrollment] = useState<any>(null);
  const [facultyBatches, setFacultyBatches] = useState<any[]>([]);

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isLandingPage, setIsLandingPage] = useState(window.location.pathname === '/landing');

  // Root Admin Check Helper
  const isRootAdmin = (email?: string | null) => {
    if (!email) return false;
    const e = email.toLowerCase();
    const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'xavierscot3454@gmail.com').toLowerCase();
    const adminEmail1 = (import.meta.env.VITE_ADMIN_EMAIL_1 || '').toLowerCase();
    const adminEmail2 = (import.meta.env.VITE_ADMIN_EMAIL_2 || '').toLowerCase();
    const adminEmail3 = (import.meta.env.VITE_ADMIN_EMAIL_3 || 'dcpromoidse@gmail.com').toLowerCase();
    return e === adminEmail || e === adminEmail1 || e === adminEmail2 || e === adminEmail3;
  };

  const isSystemAdmin = userData?.role === 'admin' || isRootAdmin(user?.email);
  const isSystemFaculty = userData?.role === 'faculty' || (facultyBatches && facultyBatches.length > 0);

  useEffect(() => {
    // Sync landing page state on mount and popstate
    const checkPath = () => {
      setIsLandingPage(window.location.pathname === '/landing');
    };
    window.addEventListener('popstate', checkPath);
    return () => window.removeEventListener('popstate', checkPath);
  }, []);

  useEffect(() => {
    // Theme initialization
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      setIsDarkMode(true);
    }

    // Seed default channels
    channelService.seedDefaultChannels();

    // Test Firestore connection
    firestoreService.testConnection();

    // Branding listener
    const unsubscribeBranding = brandingService.listenToBranding((config) => {
      setBranding(config);
      document.title = config.title;
      
      // Update favicon
      if (config.logo) {
        let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = config.logo;
      }

      // Inject Meta Pixel
      if (config.metaPixelCode) {
        const existingScript = document.getElementById('meta-pixel-script');
        if (existingScript) existingScript.remove();
        
        // Extract script content or just inject as is if it's a full block
        // For safety, we'll create a container and inject
        const container = document.createElement('div');
        container.id = 'meta-pixel-script';
        container.innerHTML = config.metaPixelCode;
        
        // Move scripts to head
        const scripts = container.querySelectorAll('script');
        scripts.forEach(oldScript => {
          const newScript = document.createElement('script');
          Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
          newScript.appendChild(document.createTextNode(oldScript.innerHTML));
          document.head.appendChild(newScript);
          oldScript.remove();
        });
        
        // Add noscript to body if present
        const noscripts = container.querySelectorAll('noscript');
        noscripts.forEach(ns => document.body.appendChild(ns));
      }
    });

    // Scroll listener for Scroll to Top button
    const mainElement = document.querySelector('main');
    const handleScroll = () => {
      if (mainElement) {
        setShowScrollTop(mainElement.scrollTop > 400);
      }
    };
    mainElement?.addEventListener('scroll', handleScroll);

    // Auth listener
    const unsubscribeAuth = authService.onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        presenceService.setupPresence(firebaseUser.uid);
        // Ensure profile exists immediately for new users
        authService.ensureUserProfile(firebaseUser.uid, firebaseUser.email, firebaseUser.displayName, firebaseUser.photoURL)
          .then(() => authService.getUserProfile(firebaseUser.uid, firebaseUser.email))
          .then(setUserData);
        
        // Check verification status
        if (firebaseUser.email) {
          const checkVerification = async () => {
             const { collection, query, where, getDocs } = await import('firebase/firestore');
             const userEmail = firebaseUser.email!;
             const emailLower = userEmail.toLowerCase();
             // Check both to handle cases where email might be stored differently in DB
             const emailsToCheck = Array.from(new Set([userEmail, emailLower]));
             
             const q = query(collection(db, 'enrollments'), where('email', 'in', emailsToCheck), where('feeStatus', '==', 'Paid'));
             const snap = await getDocs(q);
             if (!snap.empty) {
               const docSnap = snap.docs[0];
               const data = docSnap.data();
               const expiryDate = data.expiryDate;
               
               // Check if membership is expired
               if (expiryDate && new Date(expiryDate) < new Date()) {
                 // Important: Actually invalidate the feeStatus in Firestore so admin knows they are pending
                 await import('firebase/firestore').then(({ updateDoc, doc }) => {
                   return updateDoc(doc(db, 'enrollments', docSnap.id), { feeStatus: 'Pending' });
                 }).catch(console.error);

                 setIsVerified(false);
                 setUserEnrollment({ id: docSnap.id, ...data, isExpired: true, feeStatus: 'Pending' });
               } else {
                 setIsVerified(true);
                 setUserEnrollment({ id: docSnap.id, ...data });
               }
             } else {
               setIsVerified(false);
               setUserEnrollment(null);
             }
          };
          checkVerification();
        }
      } else {
        setIsVerified(false);
        setUserData(null);
      }
    });

    // Custom navigation listener
    const handleNavigation = (e: CustomEvent) => {
      setActiveTab(e.detail);
      setIsMoreMenuOpen(false);
    };
    window.addEventListener('navigate', handleNavigation as EventListener);

    return () => {
      unsubscribeBranding();
      unsubscribeAuth();
      window.removeEventListener('navigate', handleNavigation as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setFacultyBatches([]);
      return;
    }
    let unsub: any = null;
    const initFaculty = async () => {
      const { collection, query, where, onSnapshot } = await import('firebase/firestore');
      const q = query(collection(db, 'batchFaculty'), where('userId', '==', user.uid));
      unsub = onSnapshot(q, (snap) => {
        setFacultyBatches(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    };
    initFaculty();
    return () => unsub?.();
  }, [user]);

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const navItemsConfig: Record<string, { icon: React.ReactNode, label: string, isActive: (tab: string) => boolean }> = {
    home: { icon: <Home size={22} />, label: "Home", isActive: (t) => t === 'home' || t === 'about' },
    batches: { icon: <Layers size={22} />, label: "Batches", isActive: (t) => t === 'batches' },
    routine: { icon: <Calendar size={22} />, label: "Routine", isActive: (t) => t === 'routine' },
    test: { icon: <Calendar size={22} />, label: "Tests", isActive: (t) => t === 'test' },
    downloads: { icon: <Download size={22} />, label: "PDFs", isActive: (t) => t === 'downloads' },
    library: { icon: <Library size={22} />, label: "Library", isActive: (t) => t === 'library' },
    whiteboard: { icon: <Edit2 size={22} />, label: "Board", isActive: (t) => t === 'whiteboard' },
    exclusive: { icon: <BookOpen size={22} />, label: "My Batch", isActive: (t) => t === 'exclusive' },
    studyhub: { icon: <MessageSquare size={22} />, label: "Chat Room", isActive: (t) => t === 'studyhub' },
    about: { icon: <Users size={22} />, label: "About", isActive: (t) => t === 'about' },
    admin: { icon: <Shield size={22} />, label: "Dashboard", isActive: (t) => t === 'admin' },
    fee: { icon: <Wallet size={22} />, label: "Fees", isActive: (t) => t === 'fee' },
    join: { icon: <UserPlus size={22} />, label: "Join", isActive: (t) => t === 'join' },
    settings: { icon: <Settings size={22} />, label: "Settings", isActive: (t) => t === 'settings' }
  };

  const isUserAdmin = isSystemAdmin;

  const defaultNavOrder = ['home', 'about', 'exclusive', 'batches', 'routine', 'downloads', 'join', 'test', 'fee', 'studyhub', 'admin', 'settings'];
  const hasExclusivePermission = isVerified || isUserAdmin || isSystemFaculty || !!user;

  // Map branding nav order names to internal names
  // User might type "mybatch" for "exclusive"
  const navMap: Record<string, string> = {
    'home': 'home',
    'about': 'about',
    'batches': 'batches',
    'routine': 'routine',
    'downloads': 'downloads',
    'join': 'join',
    'test': 'test',
    'fee': 'fee',
    'studyhub': 'studyhub',
    'admin': 'admin',
    'settings': 'settings',
    'mybatch': 'exclusive',
    'mybatches': 'exclusive',
    'exclusive': 'exclusive'
  };

  const brandingOrder = branding.navOrder || defaultNavOrder;
  const mappedOrder = brandingOrder.map(k => navMap[k.toLowerCase()] || k).filter(Boolean);
  
  // Build the effective navigation order
  let effectiveOrder = Array.from(new Set([...mappedOrder, ...defaultNavOrder]));
  
  // If "exclusive" is allowed but missing from the pool, inject it
  if (hasExclusivePermission && !effectiveOrder.includes('exclusive')) {
    const batchesIdx = effectiveOrder.indexOf('batches');
    const homeIdx = effectiveOrder.indexOf('home');
    const insertPos = batchesIdx !== -1 ? batchesIdx : (homeIdx !== -1 ? homeIdx + 1 : 0);
    effectiveOrder.splice(insertPos, 0, 'exclusive');
  }

  const currentNavOrder = effectiveOrder.filter(id => {
    if (id === 'exclusive') return hasExclusivePermission;
    if (id === 'admin') return isUserAdmin;
    // Filter out if not in config
    return !!navItemsConfig[id];
  });
  const mobileVisibleTabs = currentNavOrder.slice(0, 4);
  const mobileMoreTabs = currentNavOrder.slice(4);

  const renderTab = () => {
    switch (activeTab) {
      case 'home': return <TabHome onNavigate={setActiveTab} branding={branding} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />;
      case 'about': return <TabAbout onNavigate={setActiveTab} />;
      case 'batches': return <TabBatches isVerified={isVerified} />;
      case 'routine': return <TabRoutine />;
      case 'downloads': return <TabDownloads />;
      case 'library': return <TabResourceVault />;
      case 'whiteboard': return <TabWhiteboard />;
      case 'join': return <TabJoin />;
      case 'test': return <TabTest />;
      case 'exclusive': return <TabMyBatch userEnrollment={userEnrollment} user={user} facultyBatches={facultyBatches} isVerified={isVerified} />;
      case 'fee': return <TabFee branding={branding} />;
      case 'studyhub': return <TabStudyHub branding={branding} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />;
      case 'admin': return <TabAdmin branding={branding} />;
      case 'settings': return <TabSettings onNavigate={setActiveTab} />;
      case 'support_chat': return <SupportChatView user={user} userData={userData} onBack={() => setActiveTab('settings')} />;
      case 'error_log': return <ErrorLogPage user={user} isAdmin={isUserAdmin} />;
      default: return <TabHome onNavigate={setActiveTab} branding={branding} />;
    }
  };

  if (isLandingPage) {
    return (
      <>
        <LandingPage />
        <EnrollmentModal />
      </>
    );
  }

  return (
    <div className="w-full h-[100dvh] flex flex-col overflow-hidden relative">
      <DecorationBackground />
      <AnnouncementBroadcast />
      {/* Main Content */}
      <main className={`flex-1 w-full ${activeTab === 'studyhub' ? 'flex flex-col overflow-hidden pt-[env(safe-area-inset-top)]' : 'overflow-y-auto px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] md:px-8 md:pt-[calc(2rem+env(safe-area-inset-top))] max-w-7xl mx-auto'}`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
            className={`w-full will-change-transform ${activeTab === 'studyhub' ? 'flex-1 flex flex-col h-full overflow-hidden' : 'h-full'}`}
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Scroll to Top Button */}
      <AnimatePresence>
        {showScrollTop && activeTab !== 'studyhub' && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={() => {
              const mainElement = document.querySelector('main');
              mainElement?.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="fixed bottom-24 right-6 p-3 bg-[var(--primary)] text-white rounded-full shadow-xl z-[900] hover:scale-110 active:scale-95 transition-all"
            title="Scroll to Top"
          >
            <ArrowUp size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      <EnrollmentModal />

      {/* Bottom Navigation */}
      <nav className="flex-shrink-0 w-full bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-white/10 z-[1000] shadow-[0_-5px_20px_rgba(0,0,0,0.05)] relative">
        {/* More Menu Popup (Mobile) */}
        <AnimatePresence>
          {isMoreMenuOpen && (
            <>
              <div className="md:hidden fixed inset-0 z-[990]" onClick={() => setIsMoreMenuOpen(false)} />
              <motion.div 
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="md:hidden absolute bottom-[calc(100%+8px)] right-4 bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 p-2 flex flex-col gap-1 z-[1000] min-w-[160px]"
              >
                {mobileMoreTabs.map(tabKey => {
                  const config = navItemsConfig[tabKey];
                  if (!config) return null;
                  return (
                    <MenuItem 
                      key={tabKey}
                      icon={React.cloneElement(config.icon as React.ReactElement, { size: 20 })} 
                      label={config.label} 
                      isActive={config.isActive(activeTab)} 
                      onClick={() => { setActiveTab(tabKey); setIsMoreMenuOpen(false); }} 
                    />
                  );
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Desktop View (All items) */}
        <div className="hidden md:flex justify-around items-center px-4 py-2 pb-safe max-w-7xl mx-auto">
          {currentNavOrder.map(tabKey => {
            const config = navItemsConfig[tabKey];
            if (!config) return null;
            return (
              <NavItem 
                key={tabKey}
                icon={config.icon} 
                label={config.label} 
                isActive={config.isActive(activeTab)} 
                onClick={() => setActiveTab(tabKey)} 
              />
            );
          })}
        </div>

        {/* Mobile View (Collapsed) */}
        <div className="flex md:hidden justify-around items-center px-1 py-2 pb-safe">
          {mobileVisibleTabs.map(tabKey => {
            const config = navItemsConfig[tabKey];
            if (!config) return null;
            return (
              <NavItem 
                key={tabKey}
                icon={config.icon} 
                label={config.label === 'Chat Room' ? 'Chat' : config.label} 
                isActive={config.isActive(activeTab)} 
                onClick={() => { setActiveTab(tabKey); setIsMoreMenuOpen(false); }} 
              />
            );
          })}
          <NavItem 
            icon={<Menu size={22} />} 
            label="More" 
            isActive={isMoreMenuOpen || mobileMoreTabs.some(t => navItemsConfig[t]?.isActive(activeTab))} 
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)} 
          />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 p-2 flex-1 cursor-pointer transition-colors ${isActive ? 'text-[var(--primary)]' : 'text-gray-500 dark:text-gray-400 hover:text-[var(--primary)]'}`}
    >
      <div className={`transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] sm:text-xs font-medium whitespace-nowrap tracking-tight">{label}</span>
    </div>
  );
}

function MenuItem({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive ? 'bg-[var(--primary)]/10 text-[var(--primary)] font-bold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
