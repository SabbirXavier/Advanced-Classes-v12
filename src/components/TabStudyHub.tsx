import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronDown, 
  Settings, 
  LogOut, 
  Search,
  Hash,
  MessageSquare,
  BookOpen,
  Bell,
  HelpCircle,
  Moon,
  Sun,
  Maximize,
  Minimize,
  User,
  X,
  MicOff,
  ShieldAlert,
  Clock,
  CheckCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { authService, UserProfile } from '../services/authService';
import { channelService, Channel, hasPermission } from '../services/channelService';
import { chatService } from '../services/chatService';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import ChatRoom from './ChatRoom';
import { AvatarWithGifHandling } from './AvatarWithGifHandling';

interface TabStudyHubProps {
  branding?: {
    title: string;
    logo: string;
  };
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
}

export default function TabStudyHub({ branding, isDarkMode, toggleDarkMode }: TabStudyHubProps) {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState('general');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [chatBackground, setChatBackground] = useState(localStorage.getItem('chatBackground') || 'default');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedProfileData, setSelectedProfileData] = useState<UserProfile | null>(null);
  const [settingsChannel, setSettingsChannel] = useState<Channel | null>(null);
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelDesc, setEditChannelDesc] = useState('');
  const [isSavingChannel, setIsSavingChannel] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [guestName, setGuestName] = useState('');

  const toggleFullScreen = () => {
    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) return;

    if (!document.fullscreenElement) {
      chatContainer.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (settingsChannel) {
      setEditChannelName(settingsChannel.name);
      setEditChannelDesc(settingsChannel.description || '');
    }
  }, [settingsChannel]);

  const handleUpdateChannel = async () => {
    if (!settingsChannel || !editChannelName.trim()) return;
    setIsSavingChannel(true);
    try {
      await chatService.updateChannel(settingsChannel.id, {
        name: editChannelName.trim(),
        description: editChannelDesc.trim()
      });
      setSettingsChannel(null);
    } catch (err) {
      console.error("Failed to update channel:", err);
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleDeleteChannel = async () => {
    if (!settingsChannel) return;
    if (['general', 'resources', 'announcements', 'help'].includes(settingsChannel.id)) {
      toast.error('Default channels cannot be deleted.');
      return;
    }
    if (!window.confirm(`Delete #${settingsChannel.name}? This action cannot be undone.`)) return;
    try {
      await channelService.deleteChannel(settingsChannel.id);
      toast.success('Channel deleted');
      if (activeChannel === settingsChannel.id) {
        setActiveChannel('general');
      }
      setSettingsChannel(null);
    } catch (err) {
      console.error('Failed to delete channel:', err);
      toast.error('Failed to delete channel');
    }
  };

  // Auth initialization
  useEffect(() => {
    let unsubscribeDoc: () => void;

    const unsubscribeAuth = authService.onAuthChange((u) => {
      setUser(u);
      if (u) {
        const userRef = doc(db, 'users', u.uid);
        unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data() as UserProfile);
          } else {
            authService.getUserProfile(u.uid, u.email).then(setUserData);
          }
        });
      } else {
        setUserData(null);
        if (unsubscribeDoc) unsubscribeDoc();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  // Channels listener
  useEffect(() => {
    const unsubscribe = channelService.listenToChannels((data) => {
      setChannels(data);
      if (data.length > 0 && !data.find(c => c.id === activeChannel)) {
        setActiveChannel(data[0].id);
      }
    });

    if (userData?.role === 'admin') {
      channelService.seedDefaultChannels();
    }

    return () => unsubscribe();
  }, [userData?.role, activeChannel]);

  // Fetch all users for mentions and moderation
  useEffect(() => {
    if (!user) return;
    const unsub = authService.listenToAllUsers(setAllUsers);
    return () => unsub();
  }, [user]);

  // Fetch profile data when selected
  useEffect(() => {
    if (selectedProfileId) {
      authService.getUserProfile(selectedProfileId).then(data => {
        setSelectedProfileData(data);
      });
    } else {
      setSelectedProfileData(null);
    }
  }, [selectedProfileId]);

  const activeChannelObj = useMemo(() => channels.find(c => c.id === activeChannel) || null, [channels, activeChannel]);
  const visibleChannels = useMemo(() => channels.filter(ch => hasPermission(ch, user, userData, 'view')), [channels, user, userData]);
  const canCloseActiveTicket = useMemo(() => {
    if (!activeChannelObj?.isSupportTicket || !user) return false;
    const isAdmin = userData?.role === 'admin' || userData?.role === 'moderator';
    const isOwner = activeChannelObj.ticketOwnerId === user.uid;
    return isAdmin || isOwner;
  }, [activeChannelObj, user, userData?.role]);

  const handleCloseTicket = async () => {
    if (!activeChannelObj || !canCloseActiveTicket || !user) return;
    const ok = window.confirm('Mark this ticket as solved and auto-delete it after 10 seconds?');
    if (!ok) return;
    try {
      await channelService.closeSupportTicket(activeChannelObj.id, user.uid);
      toast.success('Ticket marked as solved. It will auto-delete in 10 seconds.');
    } catch (error) {
      console.error('Failed to close ticket:', error);
      toast.error('Failed to close ticket');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await authService.signInWithGoogle();
    } catch (err) {
      console.error('Login failed', err);
    }
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    try {
      await authService.signInAsGuest(guestName.trim());
    } catch (err: any) {
      console.error('Guest login failed', err);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center space-y-8 bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="w-24 h-24 bg-[var(--primary)] rounded-3xl flex items-center justify-center shadow-2xl shadow-[var(--primary)]/20">
          {branding?.logo ? (
            <img src={branding.logo} alt="Logo" className="w-16 h-16 object-contain" />
          ) : (
            <Hash size={48} className="text-white" />
          )}
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{branding?.title || 'Study Hub'}</h1>
          <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">
            Join our community to collaborate, share resources, and grow together.
          </p>
        </div>
        
        <div className="w-full max-w-sm space-y-4">
          <button 
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Continue with Google
          </button>
          
          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">or</span>
            <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
          </div>

          <form onSubmit={handleGuestLogin} className="space-y-3">
            <input 
              type="text" 
              placeholder="Enter your name" 
              value={guestName}
              onChange={e => setGuestName(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-[var(--primary)] transition-colors"
            />
            <button 
              type="submit"
              disabled={!guestName.trim()}
              className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <User size={18} />
              Join as Guest
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div id="chat-container" className={`flex h-full overflow-hidden bg-gray-50 dark:bg-[#0a0a0a] transition-all ${isFullScreen ? 'fixed inset-0 z-[60]' : 'relative'}`}>
      {/* Sidebar */}
      <div className="hidden lg:flex flex-col w-[280px] bg-[#f2f3f5] dark:bg-[#2b2d31] border-r border-gray-200 dark:border-transparent z-50">
        <div className="p-4 border-b border-gray-200 dark:border-[#1e1f22] flex items-center gap-3 shadow-sm">
          <h2 className="font-bold text-base">{branding?.title || 'Study Hub'}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4 mt-2">
          <div>
            <h3 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 px-2">Text Channels</h3>
            <div className="space-y-0.5">
              {visibleChannels.map(ch => (
                <div key={ch.id} className="relative group flex items-center">
                  <button 
                    onClick={() => setActiveChannel(ch.id)}
                    className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md font-medium transition-all ${activeChannel === ch.id ? 'bg-gray-200/60 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/40 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    <Hash size={18} className="text-gray-400" />
                    <span className="capitalize text-[15px]">{ch.name}</span>
                  </button>
                  {userData?.role === 'admin' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSettingsChannel(ch);
                        setEditChannelName(ch.name);
                        setEditChannelDesc(ch.description || '');
                      }}
                      className="absolute right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-opacity"
                    >
                      <Settings size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-2 bg-[#ebedef] dark:bg-[#232428] flex items-center justify-between">
          <button 
            onClick={() => {
              const event = new CustomEvent('navigate', { detail: 'settings' });
              window.dispatchEvent(event);
            }}
            className="flex items-center gap-2 p-1.5 rounded-md hover:bg-gray-200/60 dark:hover:bg-white/10 transition-all flex-1 min-w-0"
          >
            <div className="relative">
              <img src={userData?.photoUrl || user.photoURL || undefined} className="w-8 h-8 rounded-full object-cover" alt="Profile" />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#ebedef] dark:border-[#232428] rounded-full"></div>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="font-semibold text-sm truncate text-gray-900 dark:text-white leading-tight">{userData?.name || user.displayName}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate leading-tight">Online</p>
            </div>
          </button>
          <button onClick={() => {
            const event = new CustomEvent('navigate', { detail: 'settings' });
            window.dispatchEvent(event);
          }} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-white/10 rounded-md transition-colors">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-12 border-b border-gray-200 dark:border-white/5 flex items-center justify-between px-4 bg-white dark:bg-[#313338] shadow-sm z-10">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-md">
              <MessageSquare size={20} />
            </button>
            <Hash size={20} className="text-gray-400 flex-shrink-0" />
            <h1 className="font-bold text-gray-900 dark:text-white truncate">{activeChannelObj?.name || 'Channel'}</h1>
            {activeChannelObj?.description && (
              <>
                <div className="w-px h-6 bg-gray-200 dark:bg-white/10 mx-2 hidden md:block" />
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate hidden md:block">{activeChannelObj.description}</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {activeChannelObj?.isSupportTicket && canCloseActiveTicket && (
              <button
                onClick={handleCloseTicket}
                className="px-2.5 py-1.5 rounded-md text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5"
                title="Mark ticket as solved"
              >
                <CheckCheck size={14} />
                Ticket Close
              </button>
            )}
            <button 
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className={`p-1.5 rounded-md transition-colors ${isSearchOpen ? 'bg-[var(--primary)] text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'}`}
              title="Search Messages"
            >
              <Search size={20} />
            </button>
            <button onClick={toggleFullScreen} className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-md transition-colors">
              {isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
            <button 
              onClick={toggleDarkMode}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-md transition-colors"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0">
          <ChatRoom 
            channelId={activeChannel}
            user={user}
            userData={userData}
            allUsers={allUsers}
            onProfileClick={setSelectedProfileId}
            background={chatBackground}
            isSearchOpen={isSearchOpen}
            setIsSearchOpen={setIsSearchOpen}
          />
        </div>
      </div>

      {/* Profile Modal */}
      <AnimatePresence>
        {selectedProfileData && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProfileId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-[#111] rounded-[32px] shadow-2xl overflow-hidden border border-gray-200 dark:border-white/5"
            >
              <div className="h-32 bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)]" />
              <div className="px-8 pb-8">
                <div className="relative -mt-16 mb-6">
                  <AvatarWithGifHandling 
                    src={selectedProfileData.photoUrl} 
                    name={selectedProfileData.name} 
                    onClick={() => {}} 
                    className="w-32 h-32 rounded-[40px] border-8 border-white dark:border-[#111] object-cover shadow-xl"
                  />
                  <div className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-white dark:border-[#111] rounded-full" />
                </div>

                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedProfileData.name}</h2>
                    {(userData?.role === 'admin' || userData?.role === 'moderator' || selectedProfileData.uid === user?.uid) ? (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">{selectedProfileData.email || 'Guest Account'}</p>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm italic">Advanced Classes Student</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Role</p>
                      <p className="font-bold capitalize">{selectedProfileData.role || 'Student'}</p>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                      <p className="font-bold text-green-500">Online</p>
                    </div>
                  </div>

                  {(() => {
                    const isMuted = selectedProfileData.isMuted;
                    const hasCooldown = selectedProfileData.cooldownUntil && (selectedProfileData.cooldownUntil.toMillis ? selectedProfileData.cooldownUntil.toMillis() : (selectedProfileData.cooldownUntil.seconds * 1000)) > Date.now();
                    const isRestricted = isMuted || hasCooldown;

                    if (!isRestricted) return null;

                    return (
                      <div className="p-4 bg-red-500/10 text-red-500 rounded-2xl flex items-center gap-3">
                        <ShieldAlert size={18} />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider">Moderation Status</p>
                          <p className="font-bold">
                            {isMuted && hasCooldown ? 'Muted & Timed Out' : isMuted ? 'Muted' : 'Timed Out'}
                          </p>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex gap-2">
                    {userData?.role === 'admin' && selectedProfileData.uid !== user?.uid && (
                      <div className="flex flex-col gap-2 w-full">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              if (selectedProfileData.isMuted) chatService.unmuteUser(selectedProfileData.uid);
                              else chatService.muteUser(selectedProfileData.uid);
                            }}
                            className={`flex-1 p-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-xs ${selectedProfileData.isMuted ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}
                          >
                            {selectedProfileData.isMuted ? <ShieldAlert size={16} className="rotate-180" /> : <MicOff size={16} />}
                            {selectedProfileData.isMuted ? 'Unmute' : 'Mute'}
                          </button>
                          <button 
                            onClick={() => {
                              const duration = prompt('Timeout duration in seconds (e.g. 60 for 1 min):', '60');
                              if (duration) chatService.setCooldown(selectedProfileData.uid, parseInt(duration));
                            }}
                            className="flex-1 p-3 bg-red-500/10 text-red-500 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                          >
                            <Clock size={16} /> Timeout
                          </button>
                        </div>
                        <button 
                          onClick={async () => {
                            const startDate = prompt('Start Date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
                            const endDate = prompt('End Date (YYYY-MM-DD):', new Date(Date.now() + 86400000).toISOString().split('T')[0]);
                            if (startDate && endDate && confirm('Delete all messages in this range?')) {
                              await chatService.deleteMessagesByRange(activeChannel, new Date(startDate), new Date(endDate));
                              toast.success('Messages deleted');
                            }
                          }}
                          className="w-full p-3 bg-red-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2"
                        >
                          <X size={16} /> Delete By Date Range
                        </button>
                      </div>
                    )}
                    <button 
                      onClick={() => setSelectedProfileId(null)}
                      className={`${(userData?.role === 'admin' || userData?.role === 'moderator') && selectedProfileData.uid !== user?.uid ? 'w-full mt-2' : 'w-full'} p-4 bg-gray-100 dark:bg-white/5 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all`}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-[#f2f3f5] dark:bg-[#2b2d31] border-r border-gray-200 dark:border-transparent z-[70] flex flex-col lg:hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-[#1e1f22] flex items-center gap-3 shadow-sm">
                <h2 className="font-bold text-base">{branding?.title || 'Study Hub'}</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-4 mt-2">
                <div>
                  <h3 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 px-2">Text Channels</h3>
                  <div className="space-y-0.5">
                    {visibleChannels.map(ch => (
                      <button 
                        key={ch.id}
                        onClick={() => {
                          setActiveChannel(ch.id);
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md font-medium transition-all ${activeChannel === ch.id ? 'bg-gray-200/60 dark:bg-white/10 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/40 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-300'}`}
                      >
                        <Hash size={18} className="text-gray-400" />
                        <span className="capitalize text-[15px]">{ch.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Channel Settings Modal */}
      <AnimatePresence>
        {settingsChannel && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-white dark:bg-[#1e1f22] rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10"
            >
              <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-500/10 rounded-xl text-indigo-500">
                    <Settings size={20} />
                  </div>
                  <h3 className="font-bold text-lg">Channel Settings</h3>
                </div>
                <button onClick={() => setSettingsChannel(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-400">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Channel Name</label>
                  <input 
                    type="text" 
                    value={editChannelName}
                    onChange={(e) => setEditChannelName(e.target.value)}
                    className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 block">Description</label>
                  <textarea 
                    value={editChannelDesc}
                    onChange={(e) => setEditChannelDesc(e.target.value)}
                    rows={3}
                    className="w-full p-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="p-6 bg-gray-50 dark:bg-black/20 flex gap-3">
                <button
                  onClick={handleDeleteChannel}
                  className="py-3 px-4 bg-red-500/10 text-red-500 border border-red-500/30 rounded-xl font-bold text-sm hover:bg-red-500/20 transition-all"
                >
                  Delete Channel
                </button>
                <button 
                  onClick={() => setSettingsChannel(null)}
                  className="flex-1 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleUpdateChannel}
                  disabled={isSavingChannel || !editChannelName.trim()}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {isSavingChannel ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
