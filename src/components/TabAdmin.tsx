import React, { useState, useEffect, useRef } from 'react';
import AdminStorageDashboard from './AdminStorageDashboard';
import AdminBrandingDashboard from './AdminBrandingDashboard';
import AdminLandingDashboard from './AdminLandingDashboard';
import AttendanceModule from './AttendanceModule';
import SalaryModule from './SalaryModule';
import SubjectCheckboxDropdown from './SubjectCheckboxDropdown';
import SearchableUserDropdown from './SearchableUserDropdown';
import AdminSupportTickets from './AdminSupportTickets';
import { channelService, Channel } from '../services/channelService';
import { authService } from '../services/authService';
import { chatService } from '../services/chatService';
import FinanceModule from './FinanceModule';
import { Settings, Shield, ShieldAlert, Layers, User, Users, BookOpen, Calendar, Download, DollarSign, Database, Palette, MessageSquare, Menu, X, ChevronRight, FileDown, Radio, Brain, Zap, Star, Wallet, Clock, Trash2, Loader2, RefreshCw, Upload, Link as LinkIcon, Instagram, Facebook, Youtube, Twitter, Send, MessageCircle, Edit, Edit2, Layout, Plus, Library, FileText, Video, ExternalLink, Image as ImageIcon, Search, UserPlus, CheckCircle2, TrendingUp, TrendingDown, HelpCircle } from 'lucide-react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { firestoreService } from '../services/firestoreService';
import { brandingService } from '../services/brandingService';
import { radarService, RadarConfig } from '../services/radarService';
import { storageService } from '../services/storageService';
import toast, { Toaster } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function TabAdmin({ branding }: { branding?: any }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeSection, setActiveSection] = useState('batches');
  const [user, setUser] = useState<any>(null);
  
  const adminEmails = [
    (import.meta.env.VITE_ADMIN_EMAIL || 'xavierscot3454@gmail.com').toLowerCase(),
    (import.meta.env.VITE_ADMIN_EMAIL_1 || '').toLowerCase(),
    (import.meta.env.VITE_ADMIN_EMAIL_2 || '').toLowerCase(),
    (import.meta.env.VITE_ADMIN_EMAIL_3 || 'dcpromoidse@gmail.com').toLowerCase()
  ].filter(Boolean);

  const isSystemAdmin = user && (user.role === 'admin' || adminEmails.includes((user.email || '').toLowerCase()));

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isMaintenanceLoading, setIsMaintenanceLoading] = useState(false);
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

  const checkConnection = async () => {
    setIsCheckingConnection(true);
    try {
      const { getDocFromServer } = await import('firebase/firestore');
      await getDocFromServer(doc(db, '_health', 'check'));
      setIsFirestoreConnected(true);
      toast.success('Connected to Firestore!');
    } catch (err: any) {
      console.error("Firestore connection failed:", err);
      setIsFirestoreConnected(false);
      
      let errorMsg = 'Cannot connect to Firestore.';
      if (err.message?.includes('permission') || err.code === 'permission-denied') {
        errorMsg = 'Permission denied. Check your rules or login status.';
      } else if (err.message?.includes('offline') || err.code === 'unavailable') {
        errorMsg = 'Firestore is offline or unreachable. Check your internet or config.';
      } else if (err.message?.includes('API key')) {
        errorMsg = 'Invalid API Key. Check your environment variables.';
      }
      
      toast.error(errorMsg, { duration: 5000 });
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Data states
  const [batches, setBatches] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [routines, setRoutines] = useState<any[]>([]);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [editingFees, setEditingFees] = useState<any[]>([]);
  const feesInitialized = useRef(false);
  const [radars, setRadars] = useState<any[]>([]);
  const [teasers, setTeasers] = useState<any[]>([]);
  const [drops, setDrops] = useState<any[]>([]);
  const [stars, setStars] = useState<any[]>([]);
  const [socialLinks, setSocialLinks] = useState<any[]>([]);
  const [exclusiveContent, setExclusiveContent] = useState<any[]>([]);
  const [courseFolders, setCourseFolders] = useState<any[]>([]);
  const [batchFaculty, setBatchFaculty] = useState<any[]>([]);
  const [chatUsers, setChatUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');
  const [newItemData, setNewItemData] = useState<any>({});
  const [dbError, setDbError] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [exportDropdown, setExportDropdown] = useState<string | null>(null);
  const [socialLinkModal, setSocialLinkModal] = useState<any>(null);
  const [editingEnrollment, setEditingEnrollment] = useState<any>(null);
  const [verifyingPayment, setVerifyingPayment] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [radarConfig, setRadarConfig] = useState<RadarConfig>({
    syncIntervalMinutes: 60,
    lastSyncAt: null,
    autoSyncEnabled: true
  });

  const getKolkataTime = () => {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  };

  const getDefaultExpiryDate = () => {
    const now = getKolkataTime();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    
    // Assam Academic Year: May to April
    // If today is May 2026, expiry is April 30, 2027
    // If today is April 2026, expiry is April 30, 2026 (or 2027 if we want "one year" from now)
    // The user said "by default set academic one year expoire"
    // Usually that means "end of next April" if we are in April or later.
    if (month >= 4) { // Including April to give at least a full year if joining late
      return `${year + 1}-04-30`;
    } else {
      return `${year}-04-30`;
    }
  };

  // Automatic Routine Sync & Cleanup
  useEffect(() => {
    if (isLoggedIn && user && routines.length > 0) {
      const runSyncAndCleanup = async () => {
        const kolkataNow = getKolkataTime();
        const realNow = new Date(); // Absolute system time for sync interval check
        const today = kolkataNow.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
        const todayDateStr = kolkataNow.toDateString();
        const kolkataMidnight = new Date(kolkataNow.toDateString());
        
        // 1. Sync new radars for today (Check if interval elapsed or manual sync needed)
        const lastSync = radarConfig.lastSyncAt?.toDate?.() || new Date(0);
        const diffMs = realNow.getTime() - lastSync.getTime();
        const intervalMs = radarConfig.syncIntervalMinutes * 60000;

        if (radarConfig.autoSyncEnabled && diffMs >= intervalMs) {
          const todayRoutines = routines.filter(r => r[today] && r[today] !== '-');
          let addedCount = 0;
          for (const r of todayRoutines) {
            const existing = radars.find(rad => rad.routineId === r.id && rad.date === todayDateStr);
            if (!existing) {
              try {
                await firestoreService.addItem('radars', {
                  title: r[today],
                  time: r.startTime && r.endTime ? `${r.startTime} - ${r.endTime}` : (r.time || r.startTime || ''),
                  startTime: r.startTime || r.time || '',
                  endTime: r.endTime || '',
                  status: 'upcoming',
                  routineId: r.id,
                  date: todayDateStr,
                  notes: '',
                  type: 'text',
                  fileUrl: '',
                  externalUrl: ''
                });
                addedCount++;
              } catch (e) {
                console.error("Auto-sync failed:", e);
              }
            }
          }
          if (addedCount > 0) {
            await radarService.markSynced();
          }
        }

        // 2. Cleanup expired radars (Auto-delete when class is over or from previous days)
        const parseTimeStr = (timeStr: string) => {
          if (!timeStr) return null;
          try {
            const cleanTime = timeStr.split('-')[0].trim();
            const timeMatch = cleanTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
            if (!timeMatch) return null;

            let hours = parseInt(timeMatch[1], 10);
            const minutes = parseInt(timeMatch[2], 10);
            const modifier = timeMatch[3]?.toUpperCase();

            if (modifier === 'PM' && hours < 12) hours += 12;
            if (modifier === 'AM' && hours === 12) hours = 0;
            
            const date = getKolkataTime();
            date.setHours(hours, minutes, 0, 0);
            return date;
          } catch (e) { return null; }
        };

        for (const rad of radars) {
          try {
            const radDate = new Date(rad.date);
            
            // Check if it's from a previous day
            if (radDate < kolkataMidnight) {
              await firestoreService.deleteItem('radars', rad.id);
              continue;
            }

            // If it's today, check if it's expired
            if (rad.date === todayDateStr && rad.endTime) {
              const end = parseTimeStr(rad.endTime);
              if (end && kolkataNow > end) {
                await firestoreService.deleteItem('radars', rad.id);
              }
            }
          } catch (e) {
            console.error("Auto-cleanup failed for radar:", rad.id, e);
          }
        }

        // 3. Cleanup EXPIRED Flash Drops
        for (const drop of drops) {
          if (drop.expiresAt) {
            const expiryDate = new Date(drop.expiresAt);
            if (expiryDate < kolkataNow) {
              try {
                await firestoreService.deleteItem('drops', drop.id);
              } catch (e) {
                console.error("Flash drop cleanup failed:", e);
              }
            }
          }
        }
      };
      
      const interval = setInterval(runSyncAndCleanup, 60000); // Check every minute
      runSyncAndCleanup();
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, user, routines, radars, radarConfig]);

  const [searchQuery, setSearchQuery] = useState('');
  const [userSortBy, setUserSortBy] = useState<'name' | 'role' | 'status' | 'createdAt'>('name');
  const [userSortOrder, setUserSortOrder] = useState<'asc' | 'desc'>('asc');
  const [chatPurgeRange, setChatPurgeRange] = useState({ start: '', end: '', channelId: 'general' });

  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;
    let unsubscribeDoc: (() => void) | undefined;
    
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsLoggedIn(true);
      startListeners();
      checkConnection();
    }
    
    // Always check Firebase Auth to ensure role is up to date
    unsubscribeAuth = authService.onAuthChange((firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
          setIsAuthLoading(false);
          const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'xavierscot3454@gmail.com').toLowerCase();
          const adminEmail1 = (import.meta.env.VITE_ADMIN_EMAIL_1 || 'xavierscot3454@gmail.com').toLowerCase();
          const adminEmail2 = (import.meta.env.VITE_ADMIN_EMAIL_2 || 'helixsmith.xavy@gmail.com').toLowerCase();
          const adminEmail3 = 'dcpromoidse@gmail.com';
          const userEmail = (firebaseUser.email || '').toLowerCase();

          if (docSnap.exists()) {
            const profile = docSnap.data() as any;
            const effectiveEmail = (profile.email || userEmail || '').toLowerCase();
            
            if (profile.role === 'admin' || effectiveEmail === adminEmail || effectiveEmail === adminEmail1 || effectiveEmail === adminEmail2 || effectiveEmail === adminEmail3) {
              localStorage.setItem('adminToken', 'admin-token');
              setIsLoggedIn(true);
              startListeners();
            } else {
              localStorage.removeItem('adminToken');
              setIsLoggedIn(false);
            }
          } else if (userEmail === adminEmail || userEmail === adminEmail1 || userEmail === adminEmail2 || userEmail === adminEmail3) {
            // Default admin even if profile doesn't exist yet
            localStorage.setItem('adminToken', 'admin-token');
            setIsLoggedIn(true);
            startListeners();
          } else {
            localStorage.removeItem('adminToken');
            setIsLoggedIn(false);
          }
        });
      } else {
        setIsAuthLoading(false);
        localStorage.removeItem('adminToken');
        setIsLoggedIn(false);
      }
    });
    
    // Always listen to channels for admin
    const unsubscribeChannels = channelService.listenToChannels(setChannels);
    
    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
      unsubscribeChannels();
    };
  }, []);

  const listenersStarted = useRef(false);
  const startListeners = () => {
    if (listenersStarted.current) return;
    listenersStarted.current = true;

    firestoreService.listenToCollection('batches', setBatches);
    firestoreService.listenToCollection('enrollments', setEnrollments);
    firestoreService.listenToCollection('leads', setLeads);
    firestoreService.listenToCollection('routines', setRoutines);
    firestoreService.listenToCollection('downloads', setDownloads);
    firestoreService.listenToCollection('fees', (data) => {
      setFees(data);
      if (!feesInitialized.current) {
        setEditingFees(data);
        feesInitialized.current = true;
      } else {
        // Sync editingFees with fees: remove items that are gone, add new items, 
        // but keep existing ones (to preserve local edits)
        setEditingFees(prev => {
          return data.map(fee => {
            const existing = prev.find(f => f.id === fee.id);
            return existing ? existing : fee;
          });
        });
      }
    });
    firestoreService.listenToCollection('radars', setRadars);
    firestoreService.listenToCollection('teasers', setTeasers);
    firestoreService.listenToCollection('drops', setDrops);
    firestoreService.listenToCollection('stars', setStars);
    firestoreService.listenToCollection('socialLinks', setSocialLinks);
    firestoreService.listenToCollection('exclusive_content', setExclusiveContent);
    firestoreService.listenToCollection('course_folders', setCourseFolders);
    firestoreService.listenToCollection('batchFaculty', setBatchFaculty);
    radarService.listenToConfig(setRadarConfig);
    
    authService.listenToAllUsers(users => {
      setChatUsers(users.map(u => ({ ...u, id: u.uid })));
    });
  };

  useEffect(() => {
    // Admin Migration: Ensure all batchFaculty users have the faculty role
    const syncFacultyRoles = async () => {
      if (!isSystemAdmin || batchFaculty.length === 0 || chatUsers.length === 0) return;
      
      const uniqueFacultyIds = Array.from(new Set(batchFaculty.map(f => f.userId)));
      
      for (const fId of uniqueFacultyIds) {
        if (!fId) continue;
        const targetUser = chatUsers.find(u => u.uid === fId || u.id === fId);
        if (targetUser && targetUser.role !== 'admin' && !(targetUser.roles || []).includes('admin')) {
          const hasFacultyStr = targetUser.role === 'faculty';
          const hasFacultyArr = (targetUser.roles || []).includes('faculty');
          if (!hasFacultyStr && !hasFacultyArr) {
            // They are faculty but don't have the role in the users collection. Fix it natively.
            const currentRoles = targetUser.roles || [targetUser.role || 'student'];
            const newRoles = Array.from(new Set([...currentRoles, 'faculty']));
            console.log(`Migrating missing faculty role for ${targetUser.email}`);
            try {
               await firestoreService.updateItem('users', fId, { roles: newRoles });
            } catch (err) {
               console.error("Failed migrating faculty role:", err);
            }
          }
        }
      }
    };
    syncFacultyRoles();
  }, [batchFaculty, chatUsers, isSystemAdmin]);

  const handleLogout = async () => {
    await authService.logout();
    localStorage.removeItem('adminToken');
    setIsLoggedIn(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (url: string, name: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      alert('File is too large. Maximum size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      callback(event.target?.result as string, file.name);
    };
    reader.readAsDataURL(file);
  };

  const updateItem = async (endpoint: string, id: any, data: any, silent = false): Promise<boolean> => {
    setDbError('');
    
    if (endpoint === 'chatUsers') {
      try {
        const userRef = doc(db, 'users', id);
        const updateData: any = { role: data.role, status: data.status };
        
        // Handle admin hierarchy
        const targetUser = chatUsers.find(u => u.id === id);
        if (data.role === 'admin' && targetUser?.role !== 'admin') {
          // If a new admin is being promoted, mark who did it
          updateData.promotedBy = user?.uid || 'system';
        }

        if (data.status === 'muted') {
          updateData.isMuted = true;
          updateData.muteUntil = null; // permanent
        } else if (data.status === 'active') {
          updateData.isMuted = false;
          updateData.cooldownUntil = null;
          updateData.muteUntil = null;
          updateData.restricted = false; 
        }

        // Hierarchy check for removing admin role
        if (id !== user?.uid) { // Don't check hierarchy for self-updates (security rules will handle mostly)
          const rootEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'xavierscot3454@gmail.com').toLowerCase();
          const isRootAdmin = user?.email?.toLowerCase() === rootEmail;
          
          // Original user data (data carries the new state, but we need the old state to check role transition)
          // Actually, 'chatUsers' listener provides the 'data' which is the current state in the component
          // I should check if the role is being changed from admin to something else
          if (targetUser && targetUser.role === 'admin' && data.role !== 'admin') {
             const wasPromotedByMe = targetUser.promotedBy === user?.uid;
             if (!isRootAdmin && !wasPromotedByMe) {
               toast.error("Only the root admin or the person who promoted this admin can demote them.");
               return false;
             }
          }
        }

        await updateDoc(userRef, updateData);
        if (!silent) toast.success('User updated successfully');
        return true;
      } catch (err) {
        console.error('Error updating user', err);
        toast.error('Failed to update user');
        return false;
      }
    }

    try {
      await firestoreService.updateItem(endpoint, id, data);
      if (!silent) toast.success('Updated successfully');
      return true;
    } catch (err: any) {
      console.error('Error updating', err);
      setDbError(err.message);
      toast.error('Failed to update');
      return false;
    }
  };

  const createItem = async (endpoint: string, data: any = {}) => {
    setDbError('');
    const toastId = toast.loading(`Creating ${endpoint}...`);
    try {
      if (endpoint === 'enrollments') {
        const existing = await firestoreService.findEnrollment(data.email, data.whatsapp, data.grade) as any;
        if (existing) {
          if (window.confirm(`An enrollment already exists for ${data.email || data.whatsapp} in Class ${data.grade}. Update it?`)) {
            await firestoreService.updateItem('enrollments', existing.id, {
              ...data,
              paymentHistory: existing.paymentHistory || [],
              updatedAt: new Date().toISOString()
            });
            toast.success('Enrollment updated', { id: toastId });
            return true;
          } else {
            toast.dismiss(toastId);
            return false;
          }
        }
      }
      await firestoreService.addItem(endpoint, data);
      toast.success('Item created', { id: toastId });
      return true;
    } catch (err: any) {
      console.error('Error creating', err);
      setDbError(err.message);
      toast.error(`Failed to create: ${err.message}`, { id: toastId });
      return false;
    }
  };

  const deleteItem = async (endpoint: string, id: any) => {
    const toastId = toast.loading(`Deleting ${endpoint}...`);
    try {
      console.log(`Deleting ${endpoint} with ID: ${id}`);
      if (!id) throw new Error('Invalid ID');
      await firestoreService.deleteItem(endpoint, id);
      toast.success('Item deleted successfully', { id: toastId });
    } catch (err: any) {
      console.error('Error deleting', err);
      setDbError(err.message);
      toast.error(`Failed to delete: ${err.message}`, { id: toastId });
    }
  };

  const openAddModal = (type: string, initialData: any) => {
    setModalType(type);
    setNewItemData(initialData);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const getSubjectsForGrade = (grade: string) => {
    return Array.from(new Set(
      fees
        .filter(f => !grade || (f.grades || [f.grade]).includes(grade))
        .map(f => f.subject)
    )).sort();
  };

  const openEditModal = (type: string, item: any) => {
    setModalType(type);
    setEditingId(item.id);
    setNewItemData({ ...item });
    setIsModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let dataToSubmit = { ...newItemData };
    if (modalType === 'routines') {
      dataToSubmit.time = (dataToSubmit.startTime ? `${dataToSubmit.startTime}` : '') + (dataToSubmit.endTime ? ` - ${dataToSubmit.endTime}` : '');
    }
    
    let success = false;
    if (editingId) {
      success = await updateItem(modalType, editingId, dataToSubmit);
    } else {
      success = await createItem(modalType, dataToSubmit);
    }
    
    if (success) {
      setIsModalOpen(false);
      setEditingId(null);
    }
  };

  const exportToExcel = (grade: string, data: any[]) => {
    const worksheet = XLSX.utils.json_to_sheet(data.map(student => ({
      Name: student.name,
      WhatsApp: student.whatsapp,
      Instagram: student.instagram || '',
      Subjects: student.subjects?.join(', ') || '',
      'Fee Status': student.feeStatus,
      Notes: student.notes || ''
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Class ${grade} Enrollments`);
    XLSX.writeFile(workbook, `Class_${grade}_Enrollments.xlsx`);
    setExportDropdown(null);
  };

  const exportToPDF = (grade: string, data: any[]) => {
    const doc = new jsPDF();
    doc.text(`Class ${grade} Enrollments`, 14, 15);
    
    const tableColumn = ["Name", "WhatsApp", "Instagram", "Subjects", "Fee Status", "Notes"];
    const tableRows = data.map(student => [
      student.name,
      student.whatsapp,
      student.instagram || '',
      student.subjects?.join(', ') || '',
      student.feeStatus,
      student.notes || ''
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });

    doc.save(`Class_${grade}_Enrollments.pdf`);
    setExportDropdown(null);
  };

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <div className="glass-card max-w-md w-full text-center p-8">
          <div className="w-20 h-20 bg-[var(--primary)]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield size={40} className="text-[var(--primary)]" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-[var(--text-color)]">Admin Access Required</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            This area is restricted to administrators. Please sign in with an authorized account to continue.
          </p>
          
          {isAuthLoading ? (
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : !user ? (
            <button 
              onClick={() => authService.signInWithGoogle()}
              className="w-full py-3 px-6 bg-[var(--primary)] text-white font-bold rounded-xl shadow-lg shadow-[var(--primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Sign in with Google
            </button>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-red-500 text-sm font-medium">
                  Account <strong>{user.email}</strong> is not authorized for admin access.
                </p>
              </div>
              <button 
                onClick={() => authService.logout()}
                className="w-full py-3 px-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-200 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 transition-all"
              >
                Sign out & Try Another Account
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const adminSections = [
    { id: 'batches', label: 'Batches', icon: BookOpen },
    { id: 'enrollments', label: 'Enrollments', icon: User },
    { id: 'verified', label: 'Verified Users', icon: Shield },
    { id: 'exclusive', label: 'Batch Materials', icon: BookOpen },
    { id: 'faculty', label: 'Faculty Access', icon: ShieldAlert },
    { id: 'leads', label: 'Leads Inbox', icon: Users },
    { id: 'routines', label: 'Routines', icon: Calendar },
    { id: 'downloads', label: 'Downloads', icon: Download },
    { id: 'attendance', label: 'Attendance', icon: CheckCircle2 },
    { id: 'salary', label: 'Faculty & Payroll', icon: Wallet },
    { id: 'finances', label: 'Finances', icon: DollarSign },
    { id: 'fees', label: 'Student Fees', icon: DollarSign },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'storage', label: 'Storage', icon: Database },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'landing', label: 'Landing Page', icon: Layout },
    { id: 'chatroom', label: 'Chatroom', icon: MessageSquare },
    { id: 'support', label: 'Support Tickets', icon: HelpCircle },
    { id: 'radars', label: 'Live Radar', icon: Radio },
    { id: 'teasers', label: 'Brain Teasers', icon: Brain },
    { id: 'drops', label: 'Flash Drops', icon: Zap },
    { id: 'stars', label: 'Star of the Week', icon: Star },
    { id: 'socialLinks', label: 'Social Links', icon: Zap },
    { id: 'maintenance', label: 'Maintenance', icon: Database },
  ];

  return (
    <div className="space-y-4 md:space-y-5 pb-24">
      <Toaster position="top-center" />
      <div className="flex justify-between items-center mb-2 md:mb-5">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="md:hidden p-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl text-gray-600 dark:text-gray-300"
          >
            <Menu size={20} />
          </button>
          <h2 className="text-xl md:text-2xl font-bold">Admin Dashboard</h2>
          <div className="flex items-center gap-2 ml-2">
            <div className={`w-2 h-2 rounded-full ${isFirestoreConnected === true ? 'bg-green-500' : isFirestoreConnected === false ? 'bg-red-500' : 'bg-gray-400 animate-pulse'}`}></div>
            <button 
              onClick={checkConnection}
              disabled={isCheckingConnection}
              className="text-[10px] uppercase font-bold opacity-50 hover:opacity-100 transition-opacity flex items-center gap-1"
            >
              {isFirestoreConnected === true ? 'Firestore Connected' : isFirestoreConnected === false ? 'Firestore Offline' : 'Checking...'}
              <RefreshCw size={10} className={isCheckingConnection ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <button onClick={handleLogout} className="text-sm px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg font-bold hover:bg-red-500/20 active:scale-95 transition-all">Logout</button>
      </div>

      {dbError && (
        <div className="bg-red-500/20 border border-red-500 text-red-500 p-4 rounded-xl font-bold flex justify-between items-center">
          <span>{dbError}</span>
          <button onClick={() => setDbError('')} className="text-xl">&times;</button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-[100] md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-[#111] shadow-2xl z-[101] transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 md:bg-transparent md:shadow-none md:z-auto ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="h-full flex flex-col glass-card p-4 md:sticky md:top-24 border-r md:border border-gray-200 dark:border-white/10 overflow-y-auto max-h-[calc(100vh-8rem)]">
            <div className="flex justify-between items-center mb-6 md:hidden px-3">
              <h3 className="font-bold text-lg">Menu</h3>
              <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full">
                <X size={16} />
              </button>
            </div>
            <h3 className="hidden md:block text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-3">Menu</h3>
            <div className="flex flex-col gap-1.5">
              {adminSections.map(sec => {
                const Icon = sec.icon;
                const isActive = activeSection === sec.id;
                return (
                  <button 
                    key={sec.id}
                    onClick={() => {
                      setActiveSection(sec.id);
                      setIsSidebarOpen(false);
                    }}
                    className={`px-4 py-3 rounded-xl font-bold text-left transition-all flex items-center gap-3 ${isActive ? 'bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                  >
                    <Icon size={18} className={isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500'} />
                    {sec.label}
                    {isActive && <ChevronRight size={16} className="ml-auto opacity-70" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="glass-card border border-gray-200 dark:border-white/10 p-4 sm:p-6 lg:p-8">
            {activeSection === 'maintenance' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-[var(--primary)]">System Maintenance</h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card bg-blue-500/10 border-blue-500/20 p-6 space-y-4">
                <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
                  <Database size={24} />
                  <h4 className="font-bold text-lg">Data Migration & Backup</h4>
                </div>
                <p className="text-sm opacity-80">
                  If your routines, batches, or other data are missing after a system update, you can restore them from the local backup file.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button 
                    disabled={isMaintenanceLoading}
                    onClick={async () => {
                      const overwrite = window.confirm('Would you like to overwrite existing data? (Cancel for "Only populate empty collections")');
                      if (!window.confirm('This will populate Firestore with backup data. Continue?')) return;
                      
                      setIsMaintenanceLoading(true);
                      const toastId = toast.loading('Restoring data...');
                      try {
                        const response = await fetch('/local_db.json');
                        const data = await response.json();
                        const results = await firestoreService.seedData(data, overwrite);
                        
                        const total = Object.values(results).reduce((a, b) => a + b, 0);
                        toast.success(`Restoration complete! Added/Updated ${total} items.`, { id: toastId });
                      } catch (err) {
                        console.error('Restoration failed', err);
                        toast.error('Failed to restore data. Check console.', { id: toastId });
                      } finally {
                        setIsMaintenanceLoading(false);
                      }
                    }}
                    className="flex-1 px-6 py-3 bg-[var(--primary)] text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMaintenanceLoading ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
                    Restore from local_db.json
                  </button>

                  <button 
                    disabled={isMaintenanceLoading}
                    onClick={async () => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.json';
                      input.onchange = async (e: any) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        const overwrite = window.confirm('Overwrite existing data? Click Cancel to only add missing items.');
                        setIsMaintenanceLoading(true);
                        const toastId = toast.loading('Restoring from file...');
                        
                        try {
                          const text = await file.text();
                          const data = JSON.parse(text);
                          const results = await firestoreService.seedData(data, overwrite);
                          const total = Object.values(results).reduce((a, b) => a + b, 0);
                          toast.success(`Restoration complete! Added/Updated ${total} items.`, { id: toastId });
                        } catch (err) {
                          console.error('Restoration failed', err);
                          toast.error('Failed to restore data. Check console.', { id: toastId });
                        } finally {
                          setIsMaintenanceLoading(false);
                        }
                      };
                      input.click();
                    }}
                    className="flex-1 px-6 py-3 bg-blue-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMaintenanceLoading ? <Loader2 className="animate-spin" size={18} /> : <Database size={18} />}
                    Restore from Uploaded JSON
                  </button>

                  <button 
                    disabled={isMaintenanceLoading}
                    onClick={async () => {
                      setIsMaintenanceLoading(true);
                      const toastId = toast.loading('Generating backup...');
                      try {
                        const data = await firestoreService.backupData();
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `firestore_backup_${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast.success('Backup generated and download started!', { id: toastId });
                      } catch (err) {
                        console.error('Backup failed', err);
                        toast.error('Failed to generate backup.', { id: toastId });
                      } finally {
                        setIsMaintenanceLoading(false);
                      }
                    }}
                    className="flex-1 px-6 py-3 bg-green-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMaintenanceLoading ? <Loader2 className="animate-spin" size={18} /> : <FileDown size={18} />}
                    Backup Firestore to JSON
                  </button>
                </div>
              </div>

              <div className="glass-card bg-purple-500/10 border-purple-500/20 p-6 space-y-4">
                <div className="flex items-center gap-3 text-purple-600 dark:text-purple-400">
                  <MessageSquare size={24} />
                  <h4 className="font-bold text-lg">Chat Migration</h4>
                </div>
                <p className="text-sm opacity-80">
                  Import messages from the old system into the new Firestore chatroom.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button 
                    disabled={isMaintenanceLoading}
                    onClick={async () => {
                      if (!window.confirm('This will migrate all messages from the old database to Firestore. This may take a while. Continue?')) return;
                      
                      setIsMaintenanceLoading(true);
                      const toastId = toast.loading('Migrating messages...');
                      try {
                        const res = await fetch('/api/chat/messages?limit=1000');
                        const messages = await res.json();
                        
                        const count = await firestoreService.migrateChat(messages);
                        toast.success(`Successfully migrated ${count} messages!`, { id: toastId });
                      } catch (err) {
                        console.error('Migration failed', err);
                        toast.error('Migration failed. Check console.', { id: toastId });
                      } finally {
                        setIsMaintenanceLoading(false);
                      }
                    }}
                    className="w-full px-6 py-3 bg-purple-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMaintenanceLoading ? <Loader2 className="animate-spin" size={18} /> : <MessageSquare size={18} />}
                    Migrate Old Messages
                  </button>
                </div>
              </div>

              <div className="glass-card bg-red-500/10 border-red-500/20 p-6 space-y-4 lg:col-span-2">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                  <Trash2 size={24} />
                  <h4 className="font-bold text-lg">Vanish Old Local Data</h4>
                </div>
                <p className="text-sm opacity-80">
                  Permanently delete all data from the old local SQLite/JSON database. This cannot be undone. Use this only after you are sure everything is in Firestore.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button 
                    disabled={isMaintenanceLoading}
                    onClick={async () => {
                      if (!window.confirm('CRITICAL: This will wipe the old local database. Make sure you have migrated everything to Firestore first. Type "DELETE" to confirm.')) return;
                      const confirmText = window.prompt('Type "DELETE" to confirm permanent deletion of local data:');
                      if (confirmText !== 'DELETE') return;
                      
                      setIsMaintenanceLoading(true);
                      const toastId = toast.loading('Wiping local database...');
                      try {
                        const res = await fetch('/api/maintenance/wipe-local', { method: 'POST' });
                        if (res.ok) {
                          toast.success('Local database wiped successfully!', { id: toastId });
                          alert('Local data vanished! The app is now running purely on Firestore.');
                        } else {
                          throw new Error('Server returned error');
                        }
                      } catch (err) {
                        console.error('Wipe failed', err);
                        toast.error('Failed to wipe local data.', { id: toastId });
                      } finally {
                        setIsMaintenanceLoading(false);
                      }
                    }}
                    className="px-6 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMaintenanceLoading ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                    Vanish Old Data
                  </button>
                </div>
              </div>
            </div>

            <div className="glass-card bg-red-500/10 border-red-500/20 p-6 space-y-4">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                <Shield size={24} />
                <h4 className="font-bold text-lg">System Reset</h4>
              </div>
              <p className="text-sm opacity-80">
                Warning: These actions are dangerous and should only be used if the system is in a broken state.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <button 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to clear the local admin token? You will need to login again.')) {
                      localStorage.removeItem('adminToken');
                      window.location.reload();
                    }
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
                >
                  Reset Admin Session
                </button>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'socialLinks' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-[var(--primary)]">Social Links</h3>
              <button 
                onClick={() => openAddModal('socialLinks', { title: '', url: '', icon: 'whatsapp', order: 0 })} 
                className="px-3 py-1 bg-[var(--primary)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
              >
                + Add Link
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {socialLinks.sort((a, b) => (a.order || 0) - (b.order || 0)).map(link => (
                <div key={link.id} className="glass-card !p-4 space-y-3 border border-[var(--border-color)]">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/5 rounded-lg">
                        {link.icon === 'whatsapp' && <MessageCircle size={20} className="text-green-500" />}
                        {link.icon === 'instagram' && <Instagram size={20} className="text-pink-500" />}
                        {link.icon === 'facebook' && <Facebook size={20} className="text-blue-600" />}
                        {link.icon === 'youtube' && <Youtube size={20} className="text-red-600" />}
                        {link.icon === 'twitter' && <Twitter size={20} className="text-blue-400" />}
                        {link.icon === 'telegram' && <Send size={20} className="text-blue-500" />}
                        {link.icon === 'link' && <LinkIcon size={20} className="text-gray-400" />}
                      </div>
                      <h4 className="font-bold">{link.title}</h4>
                    </div>
                    <button onClick={() => deleteItem('socialLinks', link.id)} className="p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <input 
                      className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" 
                      value={link.title} 
                      onChange={e => setSocialLinks(socialLinks.map(l => l.id === link.id ? { ...l, title: e.target.value } : l))} 
                      placeholder="Title (e.g. Join WhatsApp)" 
                    />
                    <input 
                      className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" 
                      value={link.url} 
                      onChange={e => setSocialLinks(socialLinks.map(l => l.id === link.id ? { ...l, url: e.target.value } : l))} 
                      placeholder="URL (https://...)" 
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select 
                        className="flex-1 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white"
                        value={link.icon}
                        onChange={e => setSocialLinks(socialLinks.map(l => l.id === link.id ? { ...l, icon: e.target.value } : l))}
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="instagram">Instagram</option>
                        <option value="facebook">Facebook</option>
                        <option value="youtube">YouTube</option>
                        <option value="twitter">Twitter / X</option>
                        <option value="telegram">Telegram</option>
                        <option value="link">Universal Link (URL Icon)</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] uppercase opacity-50 font-bold">Order:</label>
                        <input 
                          type="number"
                          className="w-16 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" 
                          value={link.order || 0} 
                          onChange={e => setSocialLinks(socialLinks.map(l => l.id === link.id ? { ...l, order: Number(e.target.value) } : l))} 
                          placeholder="0" 
                        />
                      </div>
                    </div>
                    <button 
                      onClick={() => updateItem('socialLinks', link.id, link)} 
                      className="w-full py-2 bg-[var(--success)] text-white rounded-lg text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
                    >
                      Save Link Changes
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'finances' && (
          <FinanceModule />
        )}
        {activeSection === 'attendance' && (
          <AttendanceModule 
            user={user} 
            isAdmin={true} 
            isFaculty={true} 
            facultyBatches={batchFaculty} 
            source="admin"
          />
        )}
        {activeSection === 'salary' && (
          <SalaryModule 
            user={user} 
            isAdmin={true} 
            isFaculty={true} 
            facultyBatches={batchFaculty} 
          />
        )}

        {activeSection === 'chatroom' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-[var(--primary)]">Chatroom Settings</h3>
            </div>
            
            <div className="p-6 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 space-y-4">
              <h4 className="font-bold text-lg">Manage Channels & Permissions</h4>
              <p className="text-sm text-gray-500">
                Configure who can view, send, and delete messages in each channel.
              </p>
              
              <div className="space-y-4 mt-4">
                {channels.map(ch => (
                  <div key={ch.id} className="border border-gray-200 dark:border-white/10 p-4 rounded-xl bg-white dark:bg-[#111]">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex-1 mr-4">
                        {editingChannel?.id === ch.id ? (
                          <div className="space-y-2">
                            <input 
                              className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded font-bold" 
                              value={editingChannel.name} 
                              onChange={e => setEditingChannel({...editingChannel, name: e.target.value})}
                              placeholder="Channel Name"
                            />
                            <input 
                              className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-xs" 
                              value={editingChannel.description} 
                              onChange={e => setEditingChannel({...editingChannel, description: e.target.value})}
                              placeholder="Description"
                            />
                            <button 
                              onClick={async () => {
                                await channelService.updateChannel(ch.id, { permissions: editingChannel.permissions, name: editingChannel.name, description: editingChannel.description });
                                setEditingChannel(null);
                                toast.success('Channel updated!');
                              }}
                              className="px-3 py-1 bg-[var(--success)] text-white rounded text-xs font-bold"
                            >
                              Save Info
                            </button>
                          </div>
                        ) : (
                          <>
                            <h5 className="font-bold text-lg capitalize flex items-center gap-2">
                              {ch.name}
                              <button onClick={() => setEditingChannel(ch)} className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-gray-400">
                                <Edit size={12} />
                              </button>
                            </h5>
                            <p className="text-xs text-gray-500">{ch.description}</p>
                          </>
                        )}
                      </div>
                      <button 
                        onClick={() => setEditingChannel(editingChannel?.id === ch.id ? null : ch)}
                        className={`p-2 rounded-lg transition-colors ${editingChannel?.id === ch.id ? 'bg-[var(--primary)] text-white' : 'bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500'}`}
                        title="Channel Settings"
                      >
                        <Settings size={18} />
                      </button>
                    </div>

                    {editingChannel?.id === ch.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 space-y-6 animate-in slide-in-from-top-2">
                        {/* Everyone Role Permissions */}
                        <div className="space-y-3">
                          <h6 className="font-bold text-sm flex items-center gap-2 text-[var(--primary)]">
                            <Users size={16} /> Everyone Role (Default)
                          </h6>
                          <div className="flex flex-wrap gap-4 bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-200 dark:border-white/5">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={ch.permissions.roles.everyone.view}
                                onChange={async (e) => {
                                  const newPerms = { ...ch.permissions };
                                  newPerms.roles.everyone.view = e.target.checked;
                                  await channelService.updateChannelPermissions(ch.id, newPerms);
                                }}
                                className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                              />
                              <span className="text-sm font-medium">Can View</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={ch.permissions.roles.everyone.send}
                                onChange={async (e) => {
                                  const newPerms = { ...ch.permissions };
                                  newPerms.roles.everyone.send = e.target.checked;
                                  await channelService.updateChannelPermissions(ch.id, newPerms);
                                }}
                                className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                              />
                              <span className="text-sm font-medium">Can Send</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={ch.permissions.roles.everyone.delete}
                                onChange={async (e) => {
                                  const newPerms = { ...ch.permissions };
                                  newPerms.roles.everyone.delete = e.target.checked;
                                  await channelService.updateChannelPermissions(ch.id, newPerms);
                                }}
                                className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                              />
                              <span className="text-sm font-medium text-red-500">Can Delete</span>
                            </label>
                          </div>
                        </div>

                        {/* Note about Admins */}
                        <div className="bg-blue-50 dark:bg-blue-500/10 p-3 rounded-xl flex items-start gap-3 border border-blue-100 dark:border-blue-500/20">
                          <Shield size={16} className="text-blue-500 mt-0.5" />
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            <strong>Admins & Moderators</strong> implicitly have full access (View, Send, Delete) to all channels. Their access cannot be revoked here.
                          </p>
                        </div>

                        {/* User Overrides */}
                        <div className="space-y-3">
                          <h6 className="font-bold text-sm flex items-center gap-2 text-[var(--primary)]">
                            <User size={16} /> User Overrides
                          </h6>
                          <div className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/5 space-y-4">
                            {Object.entries(ch.permissions.users || {}).map(([userId, perms]) => {
                              const user = chatUsers.find(u => u.id === userId);
                              return (
                                <div key={userId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-[#111] rounded-lg border border-gray-200 dark:border-white/5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary)] to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                                      {user?.name?.[0] || '?'}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold">{user?.name || 'Unknown User'}</p>
                                      <p className="text-xs text-gray-500">{user?.email || userId}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={perms.view}
                                        onChange={async (e) => {
                                          const newPerms = { ...ch.permissions };
                                          newPerms.users[userId].view = e.target.checked;
                                          await channelService.updateChannelPermissions(ch.id, newPerms);
                                        }}
                                        className="w-3.5 h-3.5 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                                      />
                                      <span className="text-xs font-medium">View</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={perms.send}
                                        onChange={async (e) => {
                                          const newPerms = { ...ch.permissions };
                                          newPerms.users[userId].send = e.target.checked;
                                          await channelService.updateChannelPermissions(ch.id, newPerms);
                                        }}
                                        className="w-3.5 h-3.5 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                                      />
                                      <span className="text-xs font-medium">Send</span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={perms.delete}
                                        onChange={async (e) => {
                                          const newPerms = { ...ch.permissions };
                                          newPerms.users[userId].delete = e.target.checked;
                                          await channelService.updateChannelPermissions(ch.id, newPerms);
                                        }}
                                        className="w-3.5 h-3.5 rounded text-[var(--primary)] focus:ring-[var(--primary)]"
                                      />
                                      <span className="text-xs font-medium text-red-500">Delete</span>
                                    </label>
                                    <button 
                                      onClick={async () => {
                                        const newPerms = { ...ch.permissions };
                                        delete newPerms.users[userId];
                                        await channelService.updateChannelPermissions(ch.id, newPerms);
                                      }}
                                      className="text-xs text-red-500 hover:underline ml-2"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            <div className="pt-2">
                              <select 
                                className="w-full p-2 text-sm bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-lg focus:outline-none focus:border-[var(--primary)]"
                                onChange={async (e) => {
                                  const userId = e.target.value;
                                  if (!userId) return;
                                  if (ch.permissions.users?.[userId]) return; // Already has override
                                  
                                  const newPerms = { ...ch.permissions };
                                  if (!newPerms.users) newPerms.users = {};
                                  newPerms.users[userId] = { view: true, send: true, delete: false };
                                  await channelService.updateChannelPermissions(ch.id, newPerms);
                                  e.target.value = ""; // Reset select
                                }}
                              >
                                <option value="">+ Add user override...</option>
                                {chatUsers.filter(u => !ch.permissions.users?.[u.id]).map(u => (
                                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-red-50 dark:bg-red-500/5 rounded-2xl border border-red-200 dark:border-red-500/10 space-y-6">
              <div>
                <h4 className="font-bold text-lg text-red-600 dark:text-red-400">Moderation Overview</h4>
                <p className="text-sm text-red-500/80 mb-4">
                   Manage banned users, mutes, and active timeouts.
                </p>
                
                <div className="space-y-4">
                  {/* Banned Users */}
                  <div className="bg-white dark:bg-black/20 p-4 rounded-xl border border-red-200 dark:border-red-500/20">
                    <h5 className="font-bold mb-3 flex items-center gap-2 text-red-500"><ShieldAlert size={16} /> Banned Users</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                       {chatUsers.filter(u => u.status === 'banned').map(u => (
                          <div key={u.id} className="flex justify-between items-center p-3 bg-red-500/5 rounded-lg border border-red-500/10">
                            <span className="font-bold text-sm truncate flex-1">{u.name}</span>
                            <button 
                              onClick={() => updateItem('users', u.id, { ...u, status: 'active' }, true)}
                              className="text-[10px] font-black uppercase px-2 py-1 bg-white dark:bg-black/40 rounded border border-red-500/20 text-red-500"
                            >
                              Revoke Ban
                            </button>
                          </div>
                       ))}
                       {chatUsers.filter(u => u.status === 'banned').length === 0 && <p className="text-xs opacity-40 italic">No banned users.</p>}
                    </div>
                  </div>

                  {/* Restricted Users */}
                  <div className="bg-white dark:bg-black/20 p-4 rounded-xl border border-orange-200 dark:border-orange-500/20">
                    <h5 className="font-bold mb-3 flex items-center gap-2 text-orange-500"><Clock size={16} /> Active Mutes & Timeouts</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {chatUsers.filter(u => u.isMuted || (u.cooldownUntil && (u.cooldownUntil.toMillis ? u.cooldownUntil.toMillis() : (u.cooldownUntil.seconds * 1000)) > Date.now())).map(u => {
                        const isMuted = u.isMuted;
                        return (
                          <div key={u.id} className="flex flex-col gap-2 p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm truncate flex-1">{u.name}</span>
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${isMuted ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                                {isMuted ? 'Muted' : 'Time Out'}
                              </span>
                            </div>
                            <button 
                              onClick={() => {
                                updateItem('users', u.id, { ...u, status: 'active', isMuted: false, cooldownUntil: null, muteUntil: null }, true);
                                toast.success(`Removed restrictions for ${u.name}`);
                              }}
                              className="text-xs bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-white/20 transition-colors mt-1 font-bold"
                            >
                              Untimeout / Unmute
                            </button>
                          </div>
                        );
                      })}
                      {chatUsers.filter(u => u.isMuted || (u.cooldownUntil && (u.cooldownUntil.toMillis ? u.cooldownUntil.toMillis() : (u.cooldownUntil.seconds * 1000)) > Date.now())).length === 0 && (
                        <p className="text-xs text-gray-500">No users currently restricted.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t border-red-200 dark:border-red-500/20">
                <h4 className="font-bold text-lg text-red-600 dark:text-red-400 mb-3">Bulk Tools & Clean Up</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-black/20 p-6 rounded-2xl border border-red-500/10">
                  <div className="space-y-4">
                     <h5 className="font-bold text-sm uppercase tracking-widest opacity-60">Clean Messages by Range</h5>
                     <div className="space-y-3">
                        <select 
                          className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-sm outline-none font-bold"
                          value={chatPurgeRange.channelId}
                          onChange={e => setChatPurgeRange({...chatPurgeRange, channelId: e.target.value})}
                        >
                          {channels.map(ch => <option key={ch.id} value={ch.id}>#{ch.name}</option>)}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase opacity-40 pl-1">Start Date & Time</label>
                            <input 
                              type="datetime-local" 
                              className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs"
                              value={chatPurgeRange.start}
                              onChange={e => setChatPurgeRange({...chatPurgeRange, start: e.target.value})}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[8px] font-black uppercase opacity-40 pl-1">End Date & Time</label>
                            <input 
                              type="datetime-local" 
                              className="w-full p-2 bg-white/5 border border-white/10 rounded-lg text-xs"
                              value={chatPurgeRange.end}
                              onChange={e => setChatPurgeRange({...chatPurgeRange, end: e.target.value})}
                            />
                          </div>
                        </div>
                        <button 
                          onClick={async () => {
                            if (!chatPurgeRange.start || !chatPurgeRange.end) return toast.error('Pick a range');
                            if (!confirm(`Are you sure you want to delete messages from the selected range in #${channels.find(c => c.id === chatPurgeRange.channelId)?.name}?`)) return;
                            
                            const start = new Date(chatPurgeRange.start);
                            const end = new Date(chatPurgeRange.end);
                            
                            toast.promise(chatService.deleteMessagesByRange(chatPurgeRange.channelId, start, end), {
                              loading: 'Purging messages...',
                              success: 'Range cleared successfully!',
                              error: 'Failed to purge'
                            });
                          }}
                          className="w-full py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 size={14} /> Execute Purge Range
                        </button>
                     </div>
                  </div>

                  <div className="space-y-4 border-l border-white/5 pl-6">
                    <h5 className="font-bold text-sm uppercase tracking-widest opacity-60">Instant Purge</h5>
                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => {
                          if (!confirm('Clear ALL messages in general?')) return;
                          chatService.deleteMessagesByRange('general', new Date(0), new Date());
                        }}
                        className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold text-xs hover:bg-red-500 transition-colors"
                      >
                        Clear General Chat
                      </button>
                      <button 
                        onClick={async () => {
                          if (!confirm('Purge ALL messages in ALL channels? This is irreversible.')) return;
                          for (const ch of channels) {
                            await chatService.deleteMessagesByRange(ch.id, new Date(0), new Date());
                          }
                          toast.success('Whole chat server purged!');
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 transition-colors shadow-lg"
                      >
                        Purge All Chatrooms
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-xl font-bold text-[var(--primary)]">User Management</h3>
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
                  <span className="text-[10px] font-bold uppercase opacity-50">Sort By:</span>
                  <select 
                    value={userSortBy} 
                    onChange={(e) => setUserSortBy(e.target.value as any)}
                    className="bg-transparent text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="name">Name</option>
                    <option value="role">Role</option>
                    <option value="status">Status</option>
                    <option value="createdAt">Newest</option>
                  </select>
                  <button 
                    onClick={() => setUserSortOrder(userSortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-1 hover:bg-white/10 rounded text-gray-400"
                  >
                    {userSortOrder === 'asc' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  </button>
                </div>
                <div className="relative flex-1 sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search users by name or email..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[var(--primary)]/50 transition-all text-sm font-medium"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {chatUsers
                .filter(u => 
                  (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                  (u.email || '').toLowerCase().includes(searchQuery.toLowerCase())
                )
                .sort((a, b) => {
                  let valA: any = a[userSortBy as keyof typeof a] || '';
                  let valB: any = b[userSortBy as keyof typeof b] || '';
                  
                  if (userSortBy === 'createdAt') {
                    valA = a.createdAt?.seconds || 0;
                    valB = b.createdAt?.seconds || 0;
                  }
                  
                  if (valA < valB) return userSortOrder === 'asc' ? -1 : 1;
                  if (valA > valB) return userSortOrder === 'asc' ? 1 : -1;
                  return 0;
                })
                .map(user => (
                <div key={user.id} className="border border-[var(--border-color)] p-4 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex items-center gap-3">
                    {user.photoUrl ? (
                      <img src={user.photoUrl} alt="Profile" className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center font-bold text-gray-500">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-[var(--text-color)]">{user.name}</h4>
                      <p className="text-xs text-gray-500">{user.phone || 'No phone'}</p>
                      <div className="text-[10px] text-gray-400 mt-1 flex flex-wrap gap-2">
                        {user.class && <span>Class: {user.class}</span>}
                        {user.stream && <span>Stream: {user.stream}</span>}
                        {user.school && <span>School: {user.school}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 w-full md:w-auto">
                    <div className="flex flex-wrap gap-2">
                      {['student', 'faculty', 'moderator', 'admin'].map(r => {
                        const roles = user.roles || [user.role || 'student'];
                        const hasRole = roles.includes(r);
                        return (
                          <button
                            key={r}
                            onClick={() => {
                              const newRoles = hasRole 
                                ? roles.filter(role => role !== r)
                                : [...roles, r];
                              // Ensure at least one role
                              if (newRoles.length === 0) return;
                              updateItem('users', user.id, { 
                                ...user, 
                                role: newRoles[0], // fallback for legacy
                                roles: newRoles 
                              });
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                              hasRole 
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                                : 'bg-white/5 text-gray-500 border border-white/10 hover:border-white/20'
                            }`}
                          >
                            {r}
                          </button>
                        );
                      })}
                    </div>
                    <select 
                      className="flex-1 md:w-32 p-2 bg-white/5 border border-[var(--border-color)] rounded-lg text-sm [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white"
                      value={user.status}
                      onChange={(e) => updateItem('users', user.id, { ...user, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="muted">Muted</option>
                      <option value="banned">Banned</option>
                    </select>
                  </div>
                </div>
              ))}
              {chatUsers.length === 0 && (
                <p className="text-center text-gray-500 py-4">No users registered yet.</p>
              )}
            </div>
          </div>
        )}

        {activeSection === 'enrollments' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--primary)]">Enrollments</h3>
                <p className="text-xs opacity-50 mt-1 font-medium">Manage student batch listings and fee statuses</p>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search students..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-[var(--primary)]/50 transition-all text-sm font-medium"
                  />
                </div>
                <button 
                  onClick={() => openAddModal('enrollments', { name: '', email: '', grade: 'XII', whatsapp: '', instagram: '', subjects: [], feeStatus: 'Pending', totalFee: 1500, discount: 0, notes: '' })}
                  className="px-4 py-2 bg-[var(--primary)] text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--primary)]/20"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">Add Enrollment</span>
                </button>
              </div>
            </div>
            {['XII', 'XI', 'X'].map((grade, i) => {
              const batchEnrollments = enrollments.filter(e => 
                e.grade === grade && (
                  (e.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (e.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (e.whatsapp || '').toLowerCase().includes(searchQuery.toLowerCase())
                )
              );
              if (batchEnrollments.length === 0) return null;
              return (
                <div key={grade} className="border border-[var(--border-color)] rounded-xl overflow-hidden">
                  <div className="bg-[var(--primary)]/10 p-4 border-b border-[var(--border-color)] flex justify-between items-center">
                    <h4 className="font-bold text-[var(--primary)] text-lg">Class {grade} Batch</h4>
                    <div className="flex items-center gap-3">
                      <span className="bg-[var(--primary)] text-white px-3 py-1 rounded-full text-sm font-bold">{batchEnrollments.length} Enrolled</span>
                      <div className="relative">
                        <button 
                          onClick={() => setExportDropdown(exportDropdown === grade ? null : grade)}
                          className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-[var(--border-color)] px-3 py-1 rounded-lg text-sm font-bold transition-colors"
                        >
                          <FileDown size={16} />
                          Export
                        </button>
                        {exportDropdown === grade && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-[var(--border-color)] rounded-xl shadow-xl z-50 overflow-hidden">
                            <button 
                              onClick={() => exportToExcel(grade, batchEnrollments)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--primary)]/10 transition-colors"
                            >
                              Download Spreadsheet (.xlsx)
                            </button>
                            <button 
                              onClick={() => exportToPDF(grade, batchEnrollments)}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--primary)]/10 transition-colors"
                            >
                              Download PDF
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/5 border-b border-[var(--border-color)]">
                        <tr>
                          <th className="p-3 font-bold">Name</th>
                          <th className="p-3 font-bold">Contact</th>
                          <th className="p-3 font-bold">Subjects</th>
                          <th className="p-3 font-bold">Fee Status</th>
                          <th className="p-3 font-bold">Notes</th>
                          <th className="p-3 font-bold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-color)]">
                        {batchEnrollments.map(student => (
                          <tr key={student.id} className="hover:bg-white/5">
                            <td className="p-3 font-semibold">{student.name}</td>
                            <td className="p-3">
                              <div>{student.whatsapp}</div>
                              {student.instagram && <div className="text-pink-500 text-xs">@{student.instagram}</div>}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1">
                                {student.subjects?.map((s: string, i: number) => (
                                  <span key={`${s}-${i}`} className="text-[10px] bg-[var(--primary)]/20 text-[var(--primary)] px-1.5 py-0.5 rounded">{s}</span>
                                ))}
                              </div>
                            </td>
                            <td className="p-3">
                              <select 
                                className={`p-1.5 rounded text-xs font-bold ${student.feeStatus === 'Paid' ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-yellow-500/20 text-yellow-600'}`}
                                value={student.feeStatus}
                                onChange={e => updateItem('enrollments', student.id, { ...student, feeStatus: e.target.value })}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Paid">Paid</option>
                              </select>
                            </td>
                            <td className="p-3">
                              <input 
                                className="w-full p-1.5 bg-white/5 border border-[var(--border-color)] rounded text-xs" 
                                value={student.notes || ''} 
                                onChange={e => setEnrollments(enrollments.map(en => en.id === student.id ? {...en, notes: e.target.value} : en))}
                                onBlur={e => updateItem('enrollments', student.id, { ...student, notes: e.target.value })}
                                placeholder="Notes..."
                              />
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2">
                                <button onClick={() => setEditingEnrollment(student)} className="text-[var(--primary)] hover:underline text-xs font-bold">Edit</button>
                                <button onClick={() => deleteItem('enrollments', student.id)} className="text-[var(--danger)] hover:underline text-xs font-bold">Remove</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {enrollments.length === 0 && (
              <p className="text-center text-gray-500 py-8">No enrollments yet.</p>
            )}
          </div>
        )}

        {activeSection === 'fees' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center bg-[var(--primary)]/5 p-4 rounded-2xl border border-[var(--primary)]/10">
              <div>
                <h3 className="text-xl font-bold text-[var(--primary)]">Fee Engine Control</h3>
                <p className="text-xs opacity-60">Manage student dues and subject pricing</p>
              </div>
              <button 
                onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'fee' }))}
                className="px-4 py-2 bg-white/10 border border-[var(--border-color)] rounded-xl text-xs font-bold hover:bg-white/20 transition-all flex items-center gap-2"
              >
                <Wallet size={14} /> View Student Fee Page
              </button>
            </div>

            {/* Fee Verification Section */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-lg font-bold">Fee Verification</h4>
                <button onClick={() => openAddModal('enrollments', { name: '', email: '', whatsapp: '', grade: 'XII', subjects: [], totalFee: 0, discount: 0, feeStatus: 'Pending' })} className="px-3 py-1 bg-[var(--primary)] text-white rounded-lg text-xs font-bold hover:opacity-90 active:scale-95 transition-all">+ Manual Enrollment</button>
              </div>
              <div className="overflow-x-auto glass-card !p-0">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] bg-white/5">
                      <th className="p-3 text-xs font-bold uppercase opacity-60">Student Details</th>
                      <th className="p-3 text-xs font-bold uppercase opacity-60">Fee Details</th>
                      <th className="p-3 text-xs font-bold uppercase opacity-60">Status</th>
                      <th className="p-3 text-xs font-bold uppercase opacity-60 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map(student => {
                      const pendingPayments = (student.paymentHistory?.filter((p: any) => p.status === 'pending') || [])
                        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                      return (
                        <tr key={student.id} className="border-b border-[var(--border-color)] hover:bg-white/5 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-sm">{student.name}</div>
                            <div className="text-xs opacity-60">{student.email}</div>
                            <div className="text-xs opacity-60">{student.whatsapp}</div>
                          </td>
                          <td className="p-3">
                            <div className="text-sm">Total: ₹{student.totalFee ?? 0}</div>
                            <div className="text-xs text-green-500">Disc: ₹{student.discount ?? 0}</div>
                            <div className="text-xs font-bold">Net: ₹{(student.totalFee || 0) - (student.discount || 0)}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${student.feeStatus === 'Paid' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                              {student.feeStatus || 'Pending'}
                            </span>
                            {pendingPayments.length > 0 && (
                              <div className="mt-1 text-[10px] text-yellow-500 font-bold animate-pulse">
                                {pendingPayments.length} Pending SS
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right space-x-2">
                            {pendingPayments.length > 0 && (
                              <button 
                                onClick={() => setVerifyingPayment({ student, payment: pendingPayments[0] })}
                                className="px-2 py-1 bg-yellow-500 text-white rounded text-[10px] font-bold"
                              >
                                View SS
                              </button>
                            )}
                            <button 
                              onClick={() => setEditingEnrollment(student)}
                              className="px-2 py-1 bg-blue-500 text-white rounded text-[10px] font-bold"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => deleteItem('enrollments', student.id)}
                              className="px-2 py-1 bg-red-500 text-white rounded text-[10px] font-bold"
                            >
                              Remove
                            </button>
                            <button 
                              onClick={() => {
                                const newStatus = student.feeStatus === 'Paid' ? 'Pending' : 'Paid';
                                const updatedHistory = (student.paymentHistory || []).map((p: any) => 
                                  p.status === 'pending' ? { ...p, status: newStatus === 'Paid' ? 'verified' : 'pending' } : p
                                );
                                updateItem('enrollments', student.id, { 
                                  ...student, 
                                  feeStatus: newStatus,
                                  paymentHistory: updatedHistory
                                });
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold ${student.feeStatus === 'Paid' ? 'bg-gray-500 text-white' : 'bg-green-500 text-white'}`}
                            >
                              {student.feeStatus === 'Paid' ? 'Mark Unpaid' : 'Verify Paid'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Subject Pricing Section */}
            <div className="space-y-4 pt-6 border-t border-[var(--border-color)]">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-bold">Subject Pricing</h4>
                  <button 
                    onClick={() => setEditingFees(fees)} 
                    className="p-1 text-[var(--primary)] hover:bg-[var(--primary)]/10 rounded transition-colors"
                    title="Reset to database values"
                  >
                    <Clock size={14} />
                  </button>
                </div>
                <button onClick={() => openAddModal('fees', { subject: '', grade: 'XII', originalPrice: 0, discount: 0, finalPrice: 0 })} className="px-3 py-1 bg-[var(--primary)] text-white rounded-lg text-xs font-bold hover:opacity-90 active:scale-95 transition-all">+ Add Subject</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(feesInitialized.current ? editingFees : fees).map(fee => (
                  <div key={fee.id} className="glass-card !p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-bold">{fee.subject}</h5>
                        <p className="text-[10px] opacity-40 font-mono">ID: {fee.id}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold text-[var(--primary)]">₹{fee.finalPrice}</div>
                        <div className="text-[10px] opacity-50 line-through">₹{fee.originalPrice}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] uppercase opacity-50 block mb-1">Subject</label>
                          <input type="text" className="w-full p-1.5 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={fee.subject || ''} onChange={e => {
                            setEditingFees(editingFees.map(f => f.id === fee.id ? {...f, subject: e.target.value} : f));
                          }} />
                        </div>
                        <div className="col-span-2">
                          <label className="text-[10px] uppercase opacity-50 block mb-1">Classes</label>
                          <div className="flex flex-wrap gap-2">
                            {['IX', 'X', 'XI', 'XII'].map(g => (
                              <label key={g} className="flex items-center gap-1 text-sm bg-white/5 px-2 py-1 rounded border border-[var(--border-color)] cursor-pointer hover:bg-white/10">
                                <input 
                                  type="checkbox" 
                                  checked={(fee.grades || [fee.grade]).includes(g)}
                                  onChange={e => {
                                    const currentGrades = fee.grades || (fee.grade ? [fee.grade] : []);
                                    const newGrades = e.target.checked 
                                      ? [...currentGrades, g]
                                      : currentGrades.filter((cg: string) => cg !== g);
                                    setEditingFees(editingFees.map(f => f.id === fee.id ? {...f, grades: newGrades, grade: newGrades[0] || ''} : f));
                                  }}
                                  className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                                />
                                Class {g}
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] uppercase opacity-50 block mb-1">Price</label>
                          <input type="number" className="w-full p-1.5 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={fee.originalPrice || 0} onChange={e => {
                            const val = Number(e.target.value);
                            setEditingFees(editingFees.map(f => f.id === fee.id ? {...f, originalPrice: val, finalPrice: val - (f.discount || 0)} : f));
                          }} />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase opacity-50 block mb-1">Discount</label>
                          <input type="number" className="w-full p-1.5 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={fee.discount || 0} onChange={e => {
                            const val = Number(e.target.value);
                            setEditingFees(editingFees.map(f => f.id === fee.id ? {...f, discount: val, finalPrice: (f.originalPrice || 0) - val} : f));
                          }} />
                        </div>
                        <div className="flex items-end gap-1">
                          <button onClick={async () => {
                            const success = await updateItem('fees', fee.id, fee);
                            if (success) {
                              // Update local fees state too to reflect change immediately if listener is slow
                              setFees(fees.map(f => f.id === fee.id ? fee : f));
                            }
                          }} className="flex-1 p-1.5 bg-[var(--success)] text-white rounded text-xs font-bold">Save</button>
                          <button onClick={async () => {
                            // Optimistically remove from editingFees
                            setEditingFees(prev => prev.filter(f => f.id !== fee.id));
                            await deleteItem('fees', fee.id);
                          }} className="p-1.5 bg-[var(--danger)] text-white rounded text-xs font-bold">X</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'batches' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-[var(--primary)]">Edit Batches</h3>
              <button onClick={() => openAddModal('batches', { name: '', tag: '', date: '', description: '', color: 'var(--primary)', tagColor: 'var(--primary)', capacity: 24, showProgressBar: false, waitlistMessage: '', enrollmentStatus: 'none' })} className="px-3 py-1 bg-[var(--primary)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">+ Add Batch</button>
            </div>
            {batches.map(batch => (
              <div key={batch.id} className="border border-[var(--border-color)] p-4 rounded-xl space-y-3">
                <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded" value={batch.name} onChange={e => setBatches(batches.map(b => b.id === batch.id ? {...b, name: e.target.value} : b))} placeholder="Name" />
                <div className="flex gap-2">
                  <input className="w-1/2 p-2 bg-white/5 border border-[var(--border-color)] rounded" value={batch.tag} onChange={e => setBatches(batches.map(b => b.id === batch.id ? {...b, tag: e.target.value} : b))} placeholder="Tag" />
                  <input className="w-1/2 p-2 bg-white/5 border border-[var(--border-color)] rounded" value={batch.date} onChange={e => setBatches(batches.map(b => b.id === batch.id ? {...b, date: e.target.value} : b))} placeholder="Date" />
                </div>
                <div className="flex gap-2">
                  <select className="w-1/2 p-2 bg-white/5 border border-[var(--border-color)] rounded [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={batch.color} onChange={e => setBatches(batches.map(b => b.id === batch.id ? {...b, color: e.target.value} : b))}>
                    <option value="var(--primary)">Theme Default</option>
                    <option value="#ef4444">Red</option>
                    <option value="#f97316">Orange</option>
                    <option value="#eab308">Yellow</option>
                    <option value="#22c55e">Green</option>
                    <option value="#3b82f6">Blue</option>
                    <option value="#a855f7">Purple</option>
                  </select>
                  <select className="w-1/2 p-2 bg-white/5 border border-[var(--border-color)] rounded [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={batch.tagColor} onChange={e => setBatches(batches.map(b => b.id === batch.id ? {...b, tagColor: e.target.value} : b))}>
                    <option value="var(--primary)">Theme Default</option>
                    <option value="#ef4444">Red</option>
                    <option value="#f97316">Orange</option>
                    <option value="#eab308">Yellow</option>
                    <option value="#22c55e">Green</option>
                    <option value="#3b82f6">Blue</option>
                    <option value="#a855f7">Purple</option>
                  </select>
                </div>
                <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded" value={batch.description} onChange={e => setBatches(batches.map(b => b.id === batch.id ? {...b, description: e.target.value} : b))} placeholder="Description" />
                <div className="flex gap-2">
                  <input className="w-1/2 p-2 bg-white/5 border border-[var(--border-color)] rounded" value={batch.capacity || ''} onChange={e => setBatches(batches.map(b => b.id === batch.id ? {...b, capacity: Number(e.target.value)} : b))} placeholder="Capacity (e.g. 24)" type="number" />
                  <label className="w-1/2 flex items-center gap-2 cursor-pointer text-sm font-bold p-2 bg-white/5 border border-[var(--border-color)] rounded">
                    <input type="checkbox" checked={batch.showProgressBar || false} onChange={e => setBatches(batches.map(b => b.id === batch.id ? {...b, showProgressBar: e.target.checked} : b))} className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)]" />
                    Show Progress Bar
                  </label>
                </div>
                {batch.showProgressBar && (
                  <textarea className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={batch.waitlistMessage || ''} onChange={e => setBatches(batches.map(b => b.id === batch.id ? {...b, waitlistMessage: e.target.value} : b))} placeholder="Waitlist Message (e.g. Note: If you miss these final seats...)" />
                )}
                <div className="flex items-center gap-4 p-2 bg-white/5 border border-[var(--border-color)] rounded">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-bold">
                    <input type="checkbox" checked={batch.timerEnabled || false} onChange={e => setBatches(batches.map(b => b.id === batch.id ? {...b, timerEnabled: e.target.checked} : b))} className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)]" />
                    Enable Timer
                  </label>
                  {batch.timerEnabled && (
                    <input type="datetime-local" className="flex-1 p-1.5 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={batch.targetDate || ''} onChange={e => setBatches(batches.map(b => b.id === batch.id ? {...b, targetDate: e.target.value} : b))} />
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-2 bg-white/5 border border-[var(--border-color)] rounded">
                  <label className="text-xs font-bold opacity-70">Enrollment Status:</label>
                  <select 
                    className="w-full sm:flex-1 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm [&>option]:bg-white dark:[&>option]:bg-gray-900"
                    value={batch.enrollmentStatus || 'none'}
                    onChange={e => setBatches(batches.map(b => b.id === batch.id ? {...b, enrollmentStatus: e.target.value} : b))}
                  >
                    <option value="none">Hidden (Not Enrolling)</option>
                    <option value="upcoming">Upcoming (Show as Upcoming)</option>
                    <option value="live">Live (Enrolling Now)</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateItem('batches', batch.id, batch)} className="flex-1 px-4 py-2 bg-[var(--success)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Save Changes</button>
                  <button onClick={() => deleteItem('batches', batch.id)} className="px-4 py-2 bg-[var(--danger)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'faculty' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-red-600 to-rose-600 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-3xl font-black mb-2">Faculty & Permission Manager</h2>
                <p className="text-red-100 opacity-80 font-medium">Assign specific users as "Batch Faculty" to allow them to manage materials for their respective batches.</p>
              </div>
              <ShieldAlert className="absolute -right-8 -bottom-8 w-64 h-64 text-white/10 rotate-12" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Batch Selector */}
              <div className="glass-card p-6 space-y-6">
                <h3 className="font-bold flex items-center gap-2">
                  <Layers size={18} className="text-red-500" />
                  Select Batch to Manage Faculty
                </h3>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {batches.map(batch => {
                    const activeFaculty = batchFaculty.filter(f => f.batchId === batch.id);
                    const gradeToFetch = (batch.tag?.match(/XII|XI|X/i)?.[0] || 'XII').toUpperCase();
                    const dynamicSubjects = getSubjectsForGrade(gradeToFetch);
                    
                    return (
                      <div key={batch.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-red-500/20 transition-all">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-bold text-sm">{batch.name}</h4>
                            <div className="flex gap-2 mt-1">
                              <span className="text-[10px] font-black px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded uppercase tracking-widest">{batch.tag}</span>
                              <span className="text-[10px] opacity-40 font-bold uppercase">{activeFaculty.length} Assigned Faculty</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-[10px] font-black opacity-30 uppercase tracking-widest px-1">Assigned Faculty</div>
                          {activeFaculty.length > 0 ? (
                            <div className="space-y-1">
                              {Array.from(new Set(activeFaculty.map(f => f.userId))).map(uid => {
                                const userFbs = activeFaculty.filter(f => f.userId === uid);
                                const facultyUser = chatUsers.find(u => u.id === uid);
                                return (
                                  <div key={uid} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-xs font-bold shrink-0">
                                        {facultyUser?.name?.charAt(0) || '?'}
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-xs font-bold truncate">{facultyUser?.name || 'Unknown User'}</span>
                                          <div className="flex gap-1 flex-wrap">
                                            {userFbs.map(f => f.subject && (
                                              <span key={f.id} className="text-[8px] px-1 bg-indigo-500/20 text-indigo-400 rounded font-black uppercase tracking-tighter shrink-0 flex items-center gap-1 group">
                                                {f.subject}
                                                <button 
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteItem('batchFaculty', f.id);
                                                  }}
                                                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 ml-1 pb-px"
                                                >
                                                  &times;
                                                </button>
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                        <span className="text-[9px] opacity-40 truncate">{facultyUser?.email}</span>
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => {
                                        userFbs.forEach(f => deleteItem('batchFaculty', f.id));
                                      }}
                                      className="p-1 px-2 text-[10px] bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all font-bold shrink-0 self-start mt-1"
                                    >
                                      Revoke All
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-4 text-center border border-dashed border-white/10 rounded-2xl opacity-30 text-[10px] font-bold">No faculty assigned</div>
                          )}
                        </div>

                        {/* Assign Form */}
                        <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
                          <label className="text-[10px] font-black opacity-30 uppercase tracking-widest px-1">Select Subjects</label>
                          <div className="flex items-center gap-2">
                            <SubjectCheckboxDropdown 
                              batchId={batch.id} 
                              dynamicSubjects={dynamicSubjects} 
                            />
                          </div>
                          <SearchableUserDropdown 
                            users={chatUsers}
                            excludeUserIds={chatUsers.filter(u => u.role === 'admin' || (u.roles || []).includes('admin')).map(u => u.id)}
                            placeholder="+ Grant New Faculty Access..."
                            onSelect={async (userId) => {
                              const targetUser = chatUsers.find(u => u.id === userId);
                              const subjectSelect = document.getElementById(`faculty-subject-${batch.id}`) as HTMLSelectElement;
                              let selectedSubjects = ['ALL'];
                              if (subjectSelect) {
                                try {
                                  selectedSubjects = JSON.parse(subjectSelect.getAttribute('data-selected') || '["ALL"]');
                                } catch (e) {
                                  selectedSubjects = Array.from(subjectSelect.selectedOptions || []).map(opt => opt.value);
                                }
                              }
                              
                              if (selectedSubjects.length === 0) {
                                selectedSubjects = ['ALL'];
                              }

                              let hasErrors = false;
                              for (const selectedSubject of selectedSubjects) {
                                if (activeFaculty.some((f:any) => f.userId === userId && f.subject === selectedSubject)) {
                                  toast.error(`User is already assigned to ${selectedSubject} in this batch.`);
                                  hasErrors = true;
                                  continue;
                                }

                                // Automatically upgrade role to Faculty if not admin
                                await createItem('batchFaculty', {
                                  batchId: batch.id,
                                  batchName: batch.name,
                                  userId: userId,
                                  userEmail: targetUser?.email,
                                  subject: selectedSubject,
                                  grantedAt: new Date().toISOString()
                                });
                              }

                              if (!hasErrors) {
                                if (targetUser && targetUser.role !== 'admin' && !(targetUser.roles || []).includes('admin')) {
                                  const currentRoles = targetUser.roles || [targetUser.role || 'student'];
                                  const newRoles = Array.from(new Set([...currentRoles, 'faculty']));
                                  await updateItem('users', userId, { ...targetUser, role: 'faculty', roles: newRoles });
                                }
                                toast.success('Faculty access granted');
                              } else {
                                toast.success('Access granted for remaining subjects');
                              }
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Roles Guide */}
              <div className="space-y-6">
                <div className="glass-card p-6 border border-amber-500/10 h-fit">
                  <h3 className="font-bold flex items-center gap-2 mb-4">
                    <ShieldAlert size={18} className="text-amber-500" />
                    Role Capabilities Guide
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-2">
                       <h4 className="text-xs font-black text-amber-500 uppercase tracking-widest">Faculty Role</h4>
                       <p className="text-[11px] opacity-70 leading-relaxed font-medium">
                         Faculty users can add, edit, and delete materials within the specific batches they are assigned to. 
                         They get a simplified "Add Content" interface on their My Batch page.
                       </p>
                       <ul className="text-[10px] opacity-50 space-y-1 list-disc pl-4 italic">
                         <li>Can upload protected PDFs, Videos, and Images</li>
                         <li>Can create and manage subject folders</li>
                         <li>Cannot access other batches they aren't assigned to</li>
                         <li>Cannot access Admin Dashboard</li>
                       </ul>
                    </div>
                    <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
                       <h4 className="text-xs font-black text-indigo-500 uppercase tracking-widest">Admin Role</h4>
                       <p className="text-[11px] opacity-70 leading-relaxed font-medium">
                         Admins have global control over all batches, materials, users, and system branding.
                       </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeSection === 'verified' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-green-500/10 p-5 rounded-3xl border border-green-500/20">
              <div>
                <h3 className="text-xl font-bold text-green-600 dark:text-green-400">Verified Students</h3>
                <p className="text-xs opacity-60 font-medium">Only students with 'Paid' fee status are listed here</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600/50" size={16} />
                <input 
                  type="text" 
                  placeholder="Filter verified students..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-green-500/20 rounded-xl focus:outline-none focus:border-green-500/50 transition-all text-sm font-medium placeholder:text-green-600/30"
                />
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 relative z-50">
              <div className="flex-1 glass-card p-5 border-l-4 border-green-500 relative z-50 overflow-visible">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-600 flex items-center justify-center">
                    <UserPlus size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Register Student Manually</h4>
                    <p className="text-[10px] opacity-60">Grant batch access to an existing regular user</p>
                  </div>
                </div>
                <SearchableUserDropdown 
                  users={chatUsers}
                  excludeUserIds={enrollments.map(e => e.userId).filter(Boolean) as string[]}
                  placeholder="Select a registered user to verify..."
                  onSelect={(userId) => {
                    const targetUser = chatUsers.find(u => u.id === userId);
                    if (targetUser) {
                      openAddModal('enrollments', { 
                        name: targetUser.name || '', 
                        email: targetUser.email || '', 
                        grade: 'XII', 
                        whatsapp: targetUser.phone || '', 
                        isManual: true,
                        userId: targetUser.id,
                        feeStatus: 'Paid'
                      });
                    }
                  }}
                />
              </div>
              <div className="flex-1 glass-card p-5 bg-indigo-500/5 border border-indigo-500/10">
                 <div className="flex items-center gap-3 mb-2">
                    <Shield size={20} className="text-indigo-500" />
                    <h4 className="font-bold text-sm">Verification Policy</h4>
                 </div>
                 <p className="text-[10px] opacity-70 leading-relaxed">
                   Verified students gain access to the <b>My Batch</b> tab. Access is automatically revoked once the <b>Expiry Date</b> is reached. Use the manual registration to upgrade active users.
                 </p>
              </div>
            </div>

            <div className="overflow-x-auto glass-card !p-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-white/5">
                    <th className="p-3 text-xs font-bold uppercase opacity-60">Student</th>
                    <th className="p-3 text-xs font-bold uppercase opacity-60">Class/Batch</th>
                    <th className="p-3 text-xs font-bold uppercase opacity-60">Expiry Date</th>
                    <th className="p-3 text-xs font-bold uppercase opacity-60 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments
                    .filter(s => s.feeStatus === 'Paid')
                    .filter(s => 
                      (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (s.email || '').toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((student, i) => (
                    <tr key={student.id || i} className="border-b border-[var(--border-color)] hover:bg-white/5 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-sm">{student.name}</div>
                        <div className="text-xs opacity-60">{student.email}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-xs font-bold">{student.grade}</div>
                        <div className="text-[10px] opacity-60">{student.batchName || 'No Batch'}</div>
                      </td>
                      <td className="p-3">
                        <div className={`text-xs font-black ${
                          student.expiryDate && new Date(student.expiryDate) < new Date() ? 'text-red-500' : 'text-green-500'
                        }`}>
                          {student.expiryDate ? new Date(student.expiryDate).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-[9px] opacity-40 uppercase">Assam Session</div>
                      </td>
                      <td className="p-3 text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setEditingEnrollment({...student, expiryDate: student.expiryDate || getDefaultExpiryDate()})}
                          className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <Edit2 size={12} /> Edit
                        </button>
                        <button 
                          onClick={() => window.open(`mailto:${student.email}`, '_blank')}
                          className="px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-lg text-xs font-bold hover:bg-[var(--primary)]/20 transition-all"
                        >
                          Email
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {enrollments.filter(s => s.feeStatus === 'Paid').length === 0 && (
                <div className="text-center py-10 opacity-50 font-bold">No verified students found.</div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'leads' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-teal-500/10 p-5 rounded-3xl border border-teal-500/20">
              <div>
                <h3 className="text-xl font-bold text-teal-600 dark:text-teal-400">Leads Inbox</h3>
                <p className="text-xs opacity-60 font-medium">Potential students who inquired from the landing page</p>
              </div>
          <button 
            onClick={() => {
              const worksheet = XLSX.utils.json_to_sheet(leads.map(l => ({
                'Submitted At': l.createdAt?.seconds ? new Date(l.createdAt.seconds * 1000).toLocaleString() : 'N/A',
                'Name': l.name,
                'Phone': l.phone,
                'Email': l.email,
                'Course': l.course,
                'Status': l.status,
                'Remarks': l.remarks || ''
              })));
              const workbook = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");
              XLSX.writeFile(workbook, `Leads_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
            }}
            className="px-4 py-2 bg-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
          >
            <Download size={14} /> Export Leads (.xlsx)
          </button>
            </div>

            <div className="overflow-x-auto glass-card !p-0">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-white/5">
                    <th className="p-3 text-xs font-bold uppercase opacity-60">Submitted At</th>
                    <th className="p-3 text-xs font-bold uppercase opacity-60">Lead Info</th>
                    <th className="p-3 text-xs font-bold uppercase opacity-60">Course / Remarks</th>
                    <th className="p-3 text-xs font-bold uppercase opacity-60">Status</th>
                    <th className="p-3 text-xs font-bold uppercase opacity-60 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads
                    .filter(l => 
                      (l.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (l.phone || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (l.email || '').toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .sort((a, b) => {
                      const da = a.createdAt?.seconds || 0;
                      const db = b.createdAt?.seconds || 0;
                      return db - da; // Newest first
                    })
                    .map((lead, i) => (
                    <tr key={lead.id || i} className="border-b border-[var(--border-color)] hover:bg-white/5 transition-colors">
                      <td className="p-3">
                        <div className="text-xs font-bold">
                           {lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}
                        </div>
                        <div className="text-[10px] opacity-60">
                           {lead.createdAt?.seconds ? new Date(lead.createdAt.seconds * 1000).toLocaleTimeString() : ''}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-sm">{lead.name}</div>
                        <div className="flex flex-col gap-1 mt-1">
                           <a href={`tel:${lead.phone}`} className="text-xs text-teal-500 hover:underline">{lead.phone}</a>
                           {lead.email && <div className="text-xs opacity-60">{lead.email}</div>}
                        </div>
                      </td>
                      <td className="p-3">
                         <div className="text-xs font-bold px-2 py-1 bg-white/5 inline-block rounded">{lead.course || 'Unspecified'}</div>
                         <div className="mt-2">
                           <textarea 
                             placeholder="Add remarks..."
                             value={lead.remarks || ''}
                             onChange={(e) => firestoreService.updateItem('leads', lead.id, { remarks: e.target.value })}
                             className="w-full p-2 bg-white/5 border border-white/5 rounded text-[10px] outline-none focus:border-teal-500/30 transition-all resize-none min-h-[40px]"
                           />
                         </div>
                      </td>
                      <td className="p-3">
                        <select 
                           value={lead.status || 'new'} 
                           onChange={(e) => firestoreService.updateItem('leads', lead.id, {status: e.target.value})}
                           className={`text-xs font-bold uppercase px-2 py-1 rounded outline-none border-none
                             ${lead.status === 'contacted' ? 'bg-amber-500/20 text-amber-500' : 
                               lead.status === 'enrolled' ? 'bg-green-500/20 text-green-500' : 'bg-blue-500/20 text-blue-500'}`}
                        >
                          <option value="new" className="bg-[#111]">New</option>
                          <option value="contacted" className="bg-[#111]">Contacted</option>
                          <option value="enrolled" className="bg-[#111]">Enrolled</option>
                        </select>
                      </td>
                      <td className="p-3 text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={() => window.open(`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`, '_blank')}
                          className="px-3 py-1 bg-[#25D366]/10 text-[#25D366] rounded-lg text-xs font-bold hover:bg-[#25D366]/20 transition-all flex items-center gap-1"
                        >
                          WhatsApp
                        </button>
                        <button 
                          onClick={() => window.confirm(`Delete lead ${lead.name}?`) && firestoreService.deleteItem('leads', lead.id)}
                          className="px-3 py-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leads.length === 0 && (
                <div className="text-center py-10 opacity-50 font-bold">No leads found.</div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'exclusive' && (() => {
          const isAdminEmail = (email: string) => {
            if (!email) return false;
            return import.meta.env.VITE_ADMIN_EMAIL_1 === email ||
                   import.meta.env.VITE_ADMIN_EMAIL_2 === email ||
                   'makeitawesom3@gmail.com' === email;
          };

          const canEditFolder = (folder: any) => {
            if (isAdminEmail(user?.email)) return true;
            if (folder.createdBy === user?.uid) return true;
            return batchFaculty.some(fb => (fb.userId === user?.uid || fb.email === user?.email) && (fb.subject === folder.subject || fb.subject === 'ALL'));
          };

          const canEditMaterial = (item: any) => {
            if (isAdminEmail(user?.email)) return true;
            if (item.createdBy === user?.uid) return true;
            return batchFaculty.some(fb => (fb.userId === user?.uid || fb.email === user?.email) && (fb.subject === item.subject || fb.subject === 'ALL'));
          };

          return (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-600 p-8 rounded-3xl text-white shadow-xl overflow-hidden relative">
              <div className="relative z-10">
                <h2 className="text-3xl font-black mb-2">Batch Materials Manager</h2>
                <p className="text-indigo-100 opacity-80 font-medium">Create subject-wise directories and organize protected study materials into folders.</p>
              </div>
              <div className="flex items-center gap-3 relative z-10">
                <button 
                  onClick={() => openAddModal('course_folders', { name: '', subject: 'PHYSICS', grade: 'XII' })}
                  className="px-5 py-2.5 bg-white/20 hover:bg-white/30 rounded-2xl text-sm font-bold backdrop-blur-md transition-all flex items-center gap-2 border border-white/10"
                >
                  <Plus size={18} /> New Folder
                </button>
                <button 
                  onClick={() => openAddModal('exclusive_content', { title: '', description: '', type: 'pdf', url: '', subject: 'PHYSICS', folderId: '', grade: 'XII' })}
                  className="px-5 py-2.5 bg-white text-indigo-600 rounded-2xl text-sm font-bold shadow-xl hover:scale-105 transition-all flex items-center gap-2"
                >
                  <Plus size={18} /> Add Material
                </button>
              </div>
              <Library className="absolute -right-8 -bottom-8 w-64 h-64 text-white/10 rotate-12" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Directory Sidebar */}
              <div className="lg:col-span-4 space-y-4">
                <div className="glass-card p-5 border border-indigo-500/10">
                  <h3 className="text-xs font-black uppercase tracking-widest opacity-40 mb-6 px-1">LMS Folders System</h3>
                  <div className="space-y-8">
                    {['XII', 'XI', 'X'].map(grade => {
                      const gradeFolders = courseFolders.filter(f => f.grade === grade);
                      if (gradeFolders.length === 0) return null;
                      
                      return (
                        <div key={grade} className="space-y-4">
                          <h4 className="text-[10px] font-black tracking-widest text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-md inline-block">CLASS {grade}</h4>
                          <div className="space-y-6 pl-2">
                            {['PHYSICS', 'CHEMISTRY', 'MATHEMATICS', 'BIOLOGY'].map(sub => {
                              const folders = gradeFolders.filter(f => f.subject === sub);
                              return (
                                <div key={sub} className="space-y-2">
                                  <div className="flex items-center gap-2 px-1">
                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                    <span className="text-[11px] font-black tracking-widest text-indigo-500 uppercase">{sub}</span>
                                    <span className="ml-auto text-[10px] font-bold opacity-30">{folders.length} Folders</span>
                                  </div>
                                  <div className="space-y-1">
                                    {folders.length > 0 ? folders.map(folder => (
                                      <div key={folder.id} className="group flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20 transition-all cursor-default">
                                        <div className="flex items-center gap-3">
                                          <BookOpen size={16} className="text-indigo-400" />
                                          <span className="text-sm font-bold opacity-80">{folder.name}</span>
                                        </div>
                                        {canEditFolder(folder) && (
                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEditModal('course_folders', folder)} className="p-1 hover:text-indigo-500 transition-colors">
                                              <Edit2 size={12} />
                                            </button>
                                            <button onClick={() => window.confirm(`Delete ${folder.name}?`) && deleteItem('course_folders', folder.id)} className="p-1 hover:text-red-500 transition-colors">
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )) : (
                                      <div className="p-3 text-[10px] italic opacity-30 text-center border border-dashed border-white/10 rounded-xl">No folders created</div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {/* Fallback for old folders without grade */}
                    {courseFolders.filter(f => !f.grade).length > 0 && (
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-black tracking-widest text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md inline-block">UNCLASSIFIED</h4>
                        <div className="space-y-6 pl-2">
                          {['PHYSICS', 'CHEMISTRY', 'MATHEMATICS', 'BIOLOGY'].map(sub => {
                            const folders = courseFolders.filter(f => f.subject === sub && !f.grade);
                            if (folders.length === 0) return null;
                            return (
                              <div key={sub} className="space-y-2">
                                <div className="flex items-center gap-2 px-1">
                                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                                  <span className="text-[11px] font-black tracking-widest text-amber-500 uppercase">{sub}</span>
                                </div>
                                <div className="space-y-1">
                                  {folders.map(folder => (
                                    <div key={folder.id} className="group flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-amber-500/10 border border-transparent hover:border-amber-500/20 transition-all cursor-default">
                                      <div className="flex items-center gap-3">
                                        <BookOpen size={16} className="text-amber-400" />
                                        <span className="text-sm font-bold opacity-80">{folder.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditModal('course_folders', folder)} className="p-1 hover:text-amber-500 transition-colors">
                                          <Edit2 size={12} />
                                        </button>
                                        <button onClick={() => window.confirm(`Delete ${folder.name}?`) && deleteItem('course_folders', folder.id)} className="p-1 hover:text-red-500 transition-colors">
                                          <Trash2 size={12} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Materials Grid */}
              <div className="lg:col-span-8 space-y-4">
                <div className="glass-card p-6 border border-indigo-500/10">
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-indigo-500/5">
                    <div>
                      <h3 className="font-black text-xl mb-1">Subject Materials</h3>
                      <p className="text-xs opacity-50 font-medium">Listing all uploaded files with anti-download protection.</p>
                    </div>
                    <div className="px-3 py-1.5 bg-amber-500/10 text-amber-500 rounded-xl border border-amber-500/20 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                       <Shield size={12} /> Privacy Shield Active
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {exclusiveContent.map((item) => {
                      const folderName = courseFolders.find(f => f.id === item.folderId)?.name;
                      return (
                        <div key={item.id} className="group p-4 rounded-2xl bg-white/5 border border-indigo-500/5 hover:border-indigo-500/20 hover:bg-indigo-500/[0.02] transition-all flex flex-col gap-3 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-3xl -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          
                          <div className="flex items-start justify-between relative z-10">
                            <div className={`p-2.5 rounded-xl ${
                              item.type === 'pdf' ? 'bg-rose-500/10 text-rose-500' :
                              item.type === 'video' ? 'bg-sky-500/10 text-sky-500' :
                              item.type === 'image' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-indigo-500/10 text-indigo-500'
                            }`}>
                              {item.type === 'pdf' ? <FileText size={20} /> : item.type === 'video' ? <Video size={20} /> : item.type === 'image' ? <ImageIcon size={20} /> : <ExternalLink size={20} />}
                            </div>
                            {canEditMaterial(item) && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                 <button onClick={() => openEditModal('exclusive_content', item)} className="p-2 hover:bg-indigo-500/10 rounded-lg transition-colors">
                                   <Edit2 size={14} className="text-gray-400" />
                                 </button>
                                 <button onClick={() => deleteItem('exclusive_content', item.id)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                                   <Trash2 size={14} className="text-red-400" />
                                 </button>
                              </div>
                            )}
                          </div>

                          <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-500 text-[9px] font-black rounded uppercase">{item.grade || 'XII'}</span>
                              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{item.subject}</span>
                              <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                              <span className="text-[10px] font-bold opacity-40">{folderName || 'Root'}</span>
                            </div>
                            <h4 className="font-bold text-base leading-tight group-hover:text-indigo-500 transition-colors mb-2 line-clamp-1">{item.title}</h4>
                            <p className="text-[11px] opacity-50 font-medium line-clamp-2 leading-relaxed">{item.description || 'No description provided.'}</p>
                          </div>

                          <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase opacity-30">
                               <Clock size={12} />
                               {item.createdAt?.toDate ? item.createdAt.toDate().toLocaleDateString() : 'Active'}
                            </div>
                            <a 
                              href={item.url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all"
                            >
                              Live View
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {exclusiveContent.length === 0 && (
                    <div className="text-center py-24 opacity-30">
                      <Database size={48} className="mx-auto mb-4" />
                      <h4 className="font-bold">The Library is Empty</h4>
                      <p className="text-xs">Start by adding folders and materials.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })()}

        {activeSection === 'routines' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-[var(--primary)]">Edit Routines</h3>
              <button onClick={() => openAddModal('routines', { startTime: '09:00 AM', endTime: '10:00 AM', mon: '-', tue: '-', wed: '-', thu: '-', fri: '-', sat: '-', sun: '-' })} className="px-3 py-1 bg-[var(--primary)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">+ Add Routine</button>
            </div>
            {routines.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')).map(routine => (
              <div key={routine.id} className="border border-[var(--border-color)] p-4 rounded-xl space-y-3 bg-white/5">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] uppercase opacity-50 font-bold ml-1">Start Time</label>
                    <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded font-bold" value={routine.startTime || ''} onChange={e => setRoutines(routines.map(r => r.id === routine.id ? {...r, startTime: e.target.value, time: e.target.value + (r.endTime ? ` - ${r.endTime}` : '')} : r))} placeholder="09:00 AM" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] uppercase opacity-50 font-bold ml-1">End Time</label>
                    <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded font-bold" value={routine.endTime || ''} onChange={e => setRoutines(routines.map(r => r.id === routine.id ? {...r, endTime: e.target.value, time: (r.startTime ? `${r.startTime} - ` : '') + e.target.value} : r))} placeholder="10:00 AM" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
                    <div key={day}>
                      <label className="text-[10px] uppercase opacity-50 font-bold ml-1">{day}</label>
                      <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={routine[day]} onChange={e => setRoutines(routines.map(r => r.id === routine.id ? {...r, [day]: e.target.value} : r))} placeholder="Class Name" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateItem('routines', routine.id, routine)} className="flex-1 px-4 py-2 bg-[var(--success)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Save Routine Changes</button>
                  <button onClick={() => deleteItem('routines', routine.id)} className="px-4 py-2 bg-[var(--danger)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'downloads' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-[var(--primary)]">Edit Downloads</h3>
              <button onClick={() => openAddModal('downloads', { subject: '', icon: 'Download', color: 'var(--primary)', links: [] })} className="px-3 py-1 bg-[var(--primary)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">+ Add Download</button>
            </div>
            {downloads.map(dl => (
              <div key={dl.id} className="border border-[var(--border-color)] p-4 rounded-xl space-y-3">
                <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded font-bold" value={dl.subject} onChange={e => setDownloads(downloads.map(d => d.id === dl.id ? {...d, subject: e.target.value} : d))} placeholder="Subject" />
                <div className="flex flex-col sm:flex-row gap-2">
                  <select className="w-full sm:w-1/2 p-2 bg-white/5 border border-[var(--border-color)] rounded [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={dl.icon} onChange={e => setDownloads(downloads.map(d => d.id === dl.id ? {...d, icon: e.target.value} : d))}>
                    <option value="Download">Download Icon</option>
                    <option value="Book">Book Icon</option>
                    <option value="FlaskConical">Science Icon</option>
                    <option value="Atom">Physics/Atom Icon</option>
                    <option value="Dna">Biology/DNA Icon</option>
                    <option value="Calculator">Math Icon</option>
                    <option value="FolderOpen">Folder Icon</option>
                  </select>
                  <select className="w-full sm:w-1/2 p-2 bg-white/5 border border-[var(--border-color)] rounded [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={dl.color} onChange={e => setDownloads(downloads.map(d => d.id === dl.id ? {...d, color: e.target.value} : d))}>
                    <option value="var(--primary)">Theme Default</option>
                    <option value="var(--secondary)">Theme Secondary</option>
                    <option value="var(--accent)">Theme Accent</option>
                    <option value="var(--success)">Theme Success</option>
                    <option value="#ef4444">Red</option>
                    <option value="#f97316">Orange</option>
                    <option value="#eab308">Yellow</option>
                    <option value="#22c55e">Green</option>
                    <option value="#3b82f6">Blue</option>
                    <option value="#a855f7">Purple</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Links</label>
                  {(dl.links || []).map((link: any, i: number) => (
                    <div key={i} className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-2 p-3 sm:p-0 bg-white/5 sm:bg-transparent rounded-xl border border-[var(--border-color)] sm:border-none">
                      <input className="w-full sm:w-1/3 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={link.label || ''} onChange={e => {
                        const newLinks = [...dl.links];
                        newLinks[i].label = e.target.value;
                        setDownloads(downloads.map(d => d.id === dl.id ? {...d, links: newLinks} : d));
                      }} placeholder="Label (e.g. PYQ)" />
                      <div className="flex-1 flex gap-1 items-center">
                        <input className="flex-1 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={link.url?.startsWith('data:') ? 'Local File Uploaded' : (link.url || '')} onChange={e => {
                          const newLinks = [...dl.links];
                          newLinks[i].url = e.target.value;
                          setDownloads(downloads.map(d => d.id === dl.id ? {...d, links: newLinks} : d));
                        }} placeholder="URL (e.g. https://...)" disabled={link.url?.startsWith('data:')} />
                        
                        <div className="flex items-center gap-2 px-2 bg-white/5 border border-[var(--border-color)] rounded h-[38px]">
                          <Shield size={14} className={link.isProtected ? "text-indigo-500" : "opacity-30"} />
                          <input 
                            type="checkbox" 
                            checked={link.isProtected || false} 
                            onChange={e => {
                              const newLinks = [...dl.links];
                              newLinks[i].isProtected = e.target.checked;
                              setDownloads(downloads.map(d => d.id === dl.id ? {...d, links: newLinks} : d));
                            }} 
                            title="Protect Media (Open in Viewer)"
                          />
                        </div>

                        {link.url?.startsWith('data:') ? (
                          <button type="button" onClick={() => {
                            const newLinks = [...dl.links];
                            newLinks[i].url = '';
                            setDownloads(downloads.map(d => d.id === dl.id ? {...d, links: newLinks} : d));
                          }} className="px-2 py-2 text-xs bg-red-500/20 text-red-500 rounded font-bold">Clear</button>
                        ) : (
                          <label className="flex items-center justify-center px-3 py-2 bg-white/10 hover:bg-white/20 rounded cursor-pointer transition-colors">
                            <span className="text-xs font-bold">File</span>
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, (url, name) => {
                              const newLinks = [...dl.links];
                              newLinks[i].url = url;
                              if (!newLinks[i].label) newLinks[i].label = name;
                              setDownloads(downloads.map(d => d.id === dl.id ? {...d, links: newLinks} : d));
                            })} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
                          </label>
                        )}
                      </div>
                      <button onClick={() => {
                        const newLinks = dl.links.filter((_: any, index: number) => index !== i);
                        setDownloads(downloads.map(d => d.id === dl.id ? {...d, links: newLinks} : d));
                      }} className="w-full sm:w-auto px-3 py-2 bg-red-500/20 text-red-500 rounded font-bold">Remove Link</button>
                    </div>
                  ))}
                  <button onClick={() => {
                    const newLinks = [...(dl.links || []), { label: '', url: '', icon: 'Download' }];
                    setDownloads(downloads.map(d => d.id === dl.id ? {...d, links: newLinks} : d));
                  }} className="text-xs bg-[var(--primary)] text-white px-3 py-1.5 rounded-lg font-bold">+ Add Link</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateItem('downloads', dl.id, dl)} className="flex-1 px-4 py-2 bg-[var(--success)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Save Changes</button>
                  <button onClick={() => deleteItem('downloads', dl.id)} className="px-4 py-2 bg-[var(--danger)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'support' && (
          <AdminSupportTickets user={user} userData={userData} />
        )}

        {activeSection === 'radars' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="text-xl font-bold text-[var(--primary)]">Radar Master Dashboard</h3>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl">
                  <Clock size={14} className="opacity-50" />
                  <span className="text-[10px] font-bold opacity-50 uppercase">Auto Sync:</span>
                  <input 
                    type="number"
                    className="w-12 bg-transparent border-none outline-none text-xs font-black text-center"
                    value={radarConfig.syncIntervalMinutes}
                    onChange={e => radarService.updateConfig({ syncIntervalMinutes: Number(e.target.value) })}
                  />
                  <span className="text-[10px] font-bold opacity-50 uppercase">Min</span>
                </div>
                <button 
                  onClick={async () => {
                    const kolkataNow = getKolkataTime();
                    const today = kolkataNow.toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase();
                    const todayDateStr = kolkataNow.toDateString();
                    const todayRoutines = routines.filter(r => r[today] && r[today] !== '-');
                    
                    let addedCount = 0;
                    const toastId = toast.loading('Syncing with Master Routine...');
                    
                    for (const r of todayRoutines) {
                      const existing = radars.find(rad => rad.routineId === r.id && rad.date === todayDateStr);
                      if (!existing) {
                        try {
                          await firestoreService.addItem('radars', {
                            title: r[today],
                            time: r.startTime && r.endTime ? `${r.startTime} - ${r.endTime}` : (r.time || r.startTime || ''),
                            startTime: r.startTime || r.time || '',
                            endTime: r.endTime || '',
                            status: 'upcoming',
                            routineId: r.id,
                            date: todayDateStr,
                            notes: '',
                            type: 'text',
                            fileUrl: '',
                            externalUrl: ''
                          });
                          addedCount++;
                        } catch (e) { console.error(e); }
                      }
                    }
                    await radarService.markSynced();
                    toast.success(`Sync complete! Added ${addedCount} classes.`, { id: toastId });
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
                >
                  <RefreshCw size={14} /> Sync Now
                </button>
                <button onClick={() => openAddModal('radars', { title: '', startTime: '09:00 AM', endTime: '10:00 AM', time: '09:00 AM - 10:00 AM', link: '', status: 'upcoming', notes: '', instagramProfile: '', type: 'text', fileUrl: '', externalUrl: '', date: getKolkataTime().toDateString() })} className="px-3 py-1.5 bg-[var(--primary)] text-white rounded-lg text-xs font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-[var(--primary)]/20">+ Add Manual Class</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {radars.map(radar => (
                <div key={radar.id} className="border border-[var(--border-color)] p-4 rounded-xl space-y-3 bg-white/5">
                  <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded font-bold" value={radar.title} onChange={e => setRadars(radars.map(r => r.id === radar.id ? {...r, title: e.target.value} : r))} placeholder="Class Title (e.g. Physics HS 2nd)" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase opacity-50 font-bold ml-1">Start Time</label>
                      <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={radar.startTime || radar.time || ''} onChange={e => setRadars(radars.map(r => r.id === radar.id ? {...r, startTime: e.target.value, time: e.target.value} : r))} placeholder="09:00 AM" />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase opacity-50 font-bold ml-1">End Time</label>
                      <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={radar.endTime || ''} onChange={e => setRadars(radars.map(r => r.id === radar.id ? {...r, endTime: e.target.value} : r))} placeholder="10:00 AM" />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input className="w-full sm:w-1/2 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={radar.date || ''} onChange={e => setRadars(radars.map(r => r.id === radar.id ? {...r, date: e.target.value} : r))} placeholder="Date (e.g. Wed Apr 15 2026)" />
                    <select className="w-full sm:w-1/2 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm [&>option]:bg-white dark:[&>option]:bg-gray-900" value={radar.status} onChange={e => setRadars(radars.map(r => r.id === radar.id ? {...r, status: e.target.value} : r))}>
                      <option value="upcoming">Upcoming</option>
                      <option value="live">Ongoing (Live)</option>
                      <option value="canceled">Canceled</option>
                      <option value="delayed">Delayed</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={radar.link || ''} onChange={e => setRadars(radars.map(r => r.id === radar.id ? {...r, link: e.target.value} : r))} placeholder="Class Link (Optional)" />
                  
                  <div className="flex gap-2">
                    <select className="w-1/2 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm [&>option]:bg-white dark:[&>option]:bg-gray-900" value={radar.type || 'text'} onChange={e => setRadars(radars.map(r => r.id === radar.id ? {...r, type: e.target.value} : r))}>
                      <option value="text">Text Only</option>
                      <option value="image">Image</option>
                      <option value="pdf">PDF Document</option>
                      <option value="video">Video (YouTube)</option>
                      <option value="voice">Voice Note</option>
                    </select>
                    <input className="w-1/2 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={radar.externalUrl || ''} onChange={e => setRadars(radars.map(r => r.id === radar.id ? {...r, externalUrl: e.target.value} : r))} placeholder={radar.type === 'video' ? "YouTube Link" : "External URL"} />
                  </div>

                  <div className="flex gap-2">
                    <input className="flex-1 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={radar.fileUrl?.startsWith('data:') ? 'Local File Uploaded' : (radar.fileUrl || '')} onChange={e => setRadars(radars.map(r => r.id === radar.id ? {...r, fileUrl: e.target.value} : r))} placeholder="File URL" disabled={radar.fileUrl?.startsWith('data:')} />
                    {radar.fileUrl?.startsWith('data:') ? (
                      <button type="button" onClick={() => setRadars(radars.map(r => r.id === radar.id ? {...r, fileUrl: ''} : r))} className="px-3 py-2 text-xs bg-red-500/20 text-red-500 rounded-lg font-bold">Clear</button>
                    ) : (
                      <label className="flex items-center justify-center px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer transition-colors">
                        <Upload size={16} />
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, (url) => setRadars(radars.map(r => r.id === radar.id ? {...r, fileUrl: url} : r)))} accept={radar.type === 'image' ? 'image/*' : radar.type === 'pdf' ? '.pdf' : radar.type === 'voice' ? 'audio/*' : '*/*'} />
                      </label>
                    )}
                  </div>

                  <textarea className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={radar.notes || ''} onChange={e => setRadars(radars.map(r => r.id === radar.id ? {...r, notes: e.target.value} : r))} placeholder="Teacher's Note (e.g. Bring your lab manual)" />
                  <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={radar.instagramProfile || ''} onChange={e => setRadars(radars.map(r => r.id === radar.id ? {...r, instagramProfile: e.target.value} : r))} placeholder="Teacher's Instagram Username / URL" />
                  <div className="flex gap-2">
                    <button onClick={() => updateItem('radars', radar.id, radar)} className="flex-1 px-4 py-2 bg-[var(--success)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Save Radar Changes</button>
                    <button onClick={() => deleteItem('radars', radar.id)} className="px-4 py-2 bg-[var(--danger)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Delete</button>
                  </div>
                </div>
              ))}
            </div>
            {radars.length === 0 && (
              <div className="text-center py-12 glass-card opacity-50">
                <p>No classes on radar. Use "Sync Routine" to fetch today's schedule.</p>
              </div>
            )}
          </div>
        )}

        {activeSection === 'teasers' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-[var(--primary)]">Daily Brain Teasers</h3>
              <button onClick={() => openAddModal('teasers', { question: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' })} className="px-3 py-1 bg-[var(--primary)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">+ Add Teaser</button>
            </div>
            {teasers.map(teaser => (
              <div key={teaser.id} className="border border-[var(--border-color)] p-4 rounded-xl space-y-3">
                <textarea className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded font-bold min-h-[80px]" value={teaser.question} onChange={e => setTeasers(teasers.map(t => t.id === teaser.id ? {...t, question: e.target.value} : t))} placeholder="Question" />
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Options</label>
                  {(teaser.options || ['', '', '', '']).map((opt: string, i: number) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input type="radio" name={`correct-${teaser.id}`} checked={teaser.correctAnswer === i} onChange={() => setTeasers(teasers.map(t => t.id === teaser.id ? {...t, correctAnswer: i} : t))} className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]" />
                      <input className="flex-1 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={opt} onChange={e => {
                        const newOptions = [...(teaser.options || ['', '', '', ''])];
                        newOptions[i] = e.target.value;
                        setTeasers(teasers.map(t => t.id === teaser.id ? {...t, options: newOptions} : t));
                      }} placeholder={`Option ${i + 1}`} />
                    </div>
                  ))}
                </div>
                <textarea className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={teaser.explanation || ''} onChange={e => setTeasers(teasers.map(t => t.id === teaser.id ? {...t, explanation: e.target.value} : t))} placeholder="Explanation (shown after answering)" />
                <div className="flex gap-2">
                  <button onClick={() => updateItem('teasers', teaser.id, teaser)} className="flex-1 px-4 py-2 bg-[var(--success)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Save Changes</button>
                  <button onClick={() => deleteItem('teasers', teaser.id)} className="px-4 py-2 bg-[var(--danger)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'drops' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-[var(--primary)]">Flash Drops</h3>
              <button onClick={() => openAddModal('drops', { title: '', content: '', type: 'text', expiresAt: '', fileUrl: '', externalUrl: '' })} className="px-3 py-1 bg-[var(--primary)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">+ Add Drop</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drops.map(drop => (
                <div key={drop.id} className="border border-[var(--border-color)] p-4 rounded-xl space-y-3 bg-white/5">
                  <div className="flex justify-between items-start">
                    <input className="flex-1 p-2 bg-white/5 border border-[var(--border-color)] rounded font-bold mr-2" value={drop.title} onChange={e => setDrops(drops.map(d => d.id === drop.id ? {...d, title: e.target.value} : d))} placeholder="Title" />
                    <select 
                      className="p-2 bg-white/5 border border-[var(--border-color)] rounded text-xs font-bold [&>option]:bg-white dark:[&>option]:bg-gray-900"
                      value={drop.type || 'text'}
                      onChange={e => setDrops(drops.map(d => d.id === drop.id ? {...d, type: e.target.value} : d))}
                    >
                      <option value="text">Text/Announcement</option>
                      <option value="image">Image</option>
                      <option value="pdf">PDF Document</option>
                      <option value="video">Video (YouTube)</option>
                      <option value="voice">Voice Note</option>
                    </select>
                  </div>
                  
                  <textarea className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded min-h-[80px] text-sm" value={drop.content} onChange={e => setDrops(drops.map(d => d.id === drop.id ? {...d, content: e.target.value} : d))} placeholder="Description/Content" />
                  
                  <div className="space-y-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase opacity-50 font-bold ml-1">Expiry Date & Time (Optional)</label>
                      <input 
                        type="datetime-local"
                        className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" 
                        value={drop.expiresAt ? new Date(drop.expiresAt).toISOString().slice(0, 16) : ''} 
                        onChange={e => setDrops(drops.map(d => d.id === drop.id ? {...d, expiresAt: e.target.value} : d))} 
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase opacity-50 font-bold ml-1">External Link / Video URL</label>
                      <input 
                        className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" 
                        value={drop.externalUrl || ''} 
                        onChange={e => setDrops(drops.map(d => d.id === drop.id ? {...d, externalUrl: e.target.value} : d))} 
                        placeholder={drop.type === 'video' ? "YouTube Link" : "External URL"} 
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase opacity-50 font-bold ml-1">File Upload (Image/PDF/Audio)</label>
                      <div className="flex gap-2">
                        <input 
                          className="flex-1 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" 
                          value={drop.fileUrl?.startsWith('data:') ? 'Local File Uploaded' : (drop.fileUrl || '')} 
                          onChange={e => setDrops(drops.map(d => d.id === drop.id ? {...d, fileUrl: e.target.value} : d))} 
                          placeholder="File URL" 
                          disabled={drop.fileUrl?.startsWith('data:')}
                        />
                        {drop.fileUrl?.startsWith('data:') ? (
                          <button type="button" onClick={() => setDrops(drops.map(d => d.id === drop.id ? {...d, fileUrl: ''} : d))} className="px-2 py-2 text-xs bg-red-500/20 text-red-500 rounded font-bold">Clear</button>
                        ) : (
                          <label className="flex items-center justify-center px-3 py-2 bg-white/10 hover:bg-white/20 rounded cursor-pointer transition-colors">
                            <Upload size={16} />
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, (url) => setDrops(drops.map(d => d.id === drop.id ? {...d, fileUrl: url} : d)))} accept={drop.type === 'image' ? 'image/*' : drop.type === 'pdf' ? '.pdf' : drop.type === 'voice' ? 'audio/*' : '*/*'} />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => updateItem('drops', drop.id, drop)} className="flex-1 px-4 py-2 bg-[var(--success)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Save Drop</button>
                    <button onClick={() => deleteItem('drops', drop.id)} className="px-4 py-2 bg-[var(--danger)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'stars' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-[var(--primary)]">Star of the Week</h3>
              <button onClick={() => openAddModal('stars', { name: '', achievement: '', image: '', week: '' })} className="px-3 py-1 bg-[var(--primary)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">+ Add Star</button>
            </div>

            {/* Star of the Week Title Setting */}
            <div className="glass-card !p-6 border border-[var(--primary)]/20 bg-[var(--primary)]/5 space-y-4">
              <div className="flex items-center gap-2 text-[var(--primary)]">
                <Star size={20} />
                <h4 className="font-bold">Section Title Settings</h4>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text"
                  defaultValue={branding?.starTitle || 'STAR OF THE WEEK'}
                  id="starTitleInput"
                  className="flex-1 p-3 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-[var(--primary)] transition-all text-sm font-bold"
                  placeholder="STAR OF THE WEEK"
                />
                <button 
                  onClick={async () => {
                    const input = document.getElementById('starTitleInput') as HTMLInputElement;
                    if (input) {
                      await brandingService.updateBranding({ starTitle: input.value });
                      toast.success('Title updated');
                    }
                  }}
                  className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl text-sm font-bold hover:opacity-90 active:scale-95 transition-all"
                >
                  Save Title
                </button>
              </div>
              <p className="text-[10px] opacity-50">This title appears at the top of the Star of the Week section on the home page.</p>
            </div>

            {stars.map(star => (
              <div key={star.id} className="border border-[var(--border-color)] p-4 rounded-xl space-y-3">
                <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded font-bold" value={star.name} onChange={e => setStars(stars.map(s => s.id === star.id ? {...s, name: e.target.value} : s))} placeholder="Student Name" />
                <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded" value={star.achievement} onChange={e => setStars(stars.map(s => s.id === star.id ? {...s, achievement: e.target.value} : s))} placeholder="Achievement (e.g., Highest Score in Math)" />
                <div className="flex gap-2">
                  <input className="w-1/2 p-2 bg-white/5 border border-[var(--border-color)] rounded" value={star.week} onChange={e => setStars(stars.map(s => s.id === star.id ? {...s, week: e.target.value} : s))} placeholder="Week (e.g., Week 12)" />
                  <div className="w-1/2 flex gap-1 items-center">
                    <input className="flex-1 p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={star.image?.startsWith('data:') ? 'Local File Uploaded' : (star.image || '')} onChange={e => setStars(stars.map(s => s.id === star.id ? {...s, image: e.target.value} : s))} placeholder="Image URL" disabled={star.image?.startsWith('data:')} />
                    {star.image?.startsWith('data:') ? (
                      <button type="button" onClick={() => setStars(stars.map(s => s.id === star.id ? {...s, image: ''} : s))} className="px-2 py-2 text-xs bg-red-500/20 text-red-500 rounded font-bold">Clear</button>
                    ) : (
                      <label className="flex items-center justify-center px-3 py-2 bg-white/10 hover:bg-white/20 rounded cursor-pointer transition-colors">
                        <span className="text-xs font-bold">File</span>
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, (url) => setStars(stars.map(s => s.id === star.id ? {...s, image: url} : s)))} accept=".png,.jpg,.jpeg" />
                      </label>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => updateItem('stars', star.id, star)} className="flex-1 px-4 py-2 bg-[var(--success)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Save Changes</button>
                  <button onClick={() => deleteItem('stars', star.id)} className="px-4 py-2 bg-[var(--danger)] text-white rounded-lg text-sm font-bold hover:opacity-90 active:scale-95 transition-all">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'storage' && <AdminStorageDashboard />}
        {activeSection === 'branding' && <AdminBrandingDashboard />}
        {activeSection === 'landing' && <AdminLandingDashboard />}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {/* Edit Enrollment Modal */}
      {editingEnrollment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-white/10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Edit Enrollment</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase opacity-50 font-bold">Name</label>
                  <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={editingEnrollment.name} onChange={e => setEditingEnrollment({...editingEnrollment, name: e.target.value})} placeholder="Name" />
                </div>
                <div>
                  <label className="text-[10px] uppercase opacity-50 font-bold">Email</label>
                  <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={editingEnrollment.email} onChange={e => setEditingEnrollment({...editingEnrollment, email: e.target.value})} placeholder="Email" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase opacity-50 font-bold">WhatsApp</label>
                  <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={editingEnrollment.whatsapp} onChange={e => setEditingEnrollment({...editingEnrollment, whatsapp: e.target.value})} placeholder="WhatsApp" />
                </div>
                <div>
                  <label className="text-[10px] uppercase opacity-50 font-bold">Instagram</label>
                  <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={editingEnrollment.instagram || ''} onChange={e => setEditingEnrollment({...editingEnrollment, instagram: e.target.value})} placeholder="Instagram" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase opacity-50 font-bold">Class</label>
                  <select className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={editingEnrollment.grade} onChange={e => setEditingEnrollment({...editingEnrollment, grade: e.target.value})}>
                    <option value="XII">Class XII</option>
                    <option value="XI">Class XI</option>
                    <option value="X">Class X</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase opacity-50 font-bold">Batch</label>
                  <select 
                    className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm [&>option]:bg-white dark:[&>option]:bg-gray-900" 
                    value={editingEnrollment.batchId || ''} 
                    onChange={e => {
                      const batch = batches.find(b => b.id === e.target.value);
                      setEditingEnrollment({
                        ...editingEnrollment, 
                        batchId: e.target.value,
                        batchName: batch ? batch.name : ''
                      });
                    }}
                  >
                    <option value="">No Batch</option>
                    {batches.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase opacity-50 font-bold">Fee Status</label>
                  <select className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={editingEnrollment.feeStatus} onChange={e => setEditingEnrollment({...editingEnrollment, feeStatus: e.target.value})}>
                    <option value="Pending">Pending</option>
                    <option value="Paid">Paid</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase opacity-50 font-bold">Expiry Date (May-Apr Year)</label>
                  <input 
                    type="date" 
                    className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" 
                    value={editingEnrollment.expiryDate || getDefaultExpiryDate()} 
                    onChange={e => setEditingEnrollment({...editingEnrollment, expiryDate: e.target.value})} 
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase opacity-50 font-bold">Enrolled Subjects (From Pricing)</label>
                <div className="space-y-2 mt-1">
                  <div className="flex flex-wrap gap-2 min-h-[32px] p-2 bg-white/5 border border-[var(--border-color)] rounded-lg">
                    {editingEnrollment.subjects && editingEnrollment.subjects.length > 0 ? (
                      editingEnrollment.subjects.map((subj: string) => (
                        <span key={subj} className="px-2 py-1 bg-[var(--primary)] text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 shadow-sm">
                          {subj}
                          <button 
                            type="button" 
                            onClick={() => setEditingEnrollment({...editingEnrollment, subjects: editingEnrollment.subjects.filter((s: string) => s !== subj)})}
                            className="hover:text-red-200 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] opacity-40 italic">No subjects selected</span>
                    )}
                  </div>
                  <select 
                    className="w-full p-2 bg-white/10 border border-[var(--border-color)] rounded-lg text-xs font-bold [&>option]:bg-white dark:[&>option]:bg-gray-900"
                    onChange={e => {
                      if (e.target.value && !editingEnrollment.subjects?.includes(e.target.value)) {
                        setEditingEnrollment({
                          ...editingEnrollment, 
                          subjects: [...(editingEnrollment.subjects || []), e.target.value]
                        });
                      }
                      e.target.value = "";
                    }}
                    value=""
                  >
                    <option value="">+ Add Subject from Pricing...</option>
                    {getSubjectsForGrade(editingEnrollment.grade).map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase opacity-50 font-bold">Enrolled Slots</label>
                <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={editingEnrollment.slots || ''} onChange={e => setEditingEnrollment({...editingEnrollment, slots: e.target.value})} placeholder="e.g. 2:30 PM - 4:00 PM" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase opacity-50 font-bold">Total Fee</label>
                  <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={editingEnrollment.totalFee || ''} onChange={e => setEditingEnrollment({...editingEnrollment, totalFee: Number(e.target.value)})} placeholder="Total Fee" type="number" />
                </div>
                <div>
                  <label className="text-[10px] uppercase opacity-50 font-bold">Discount</label>
                  <input className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm" value={editingEnrollment.discount || ''} onChange={e => setEditingEnrollment({...editingEnrollment, discount: Number(e.target.value)})} placeholder="Discount" type="number" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase opacity-50 font-bold">Notes</label>
                <textarea className="w-full p-2 bg-white/5 border border-[var(--border-color)] rounded text-sm min-h-[60px]" value={editingEnrollment.notes || ''} onChange={e => setEditingEnrollment({...editingEnrollment, notes: e.target.value})} placeholder="Admin Notes" />
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => {
                  updateItem('enrollments', editingEnrollment.id, editingEnrollment);
                  setEditingEnrollment(null);
                }} className="flex-1 px-4 py-2 bg-[var(--success)] text-white rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all">Save</button>
                <button onClick={() => setEditingEnrollment(null)} className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verify Payment Modal */}
      {verifyingPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-[#1e1e1e] w-full max-w-md rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-white/10 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Verify Payment</h3>
            <div className="space-y-4">
              <p><strong>Student:</strong> {verifyingPayment.student.name}</p>
              <p><strong>Amount:</strong> ₹{verifyingPayment.payment.amount}</p>
              {verifyingPayment.payment.screenshot || verifyingPayment.payment.screenshotUrl ? (
                <img src={verifyingPayment.payment.screenshot || verifyingPayment.payment.screenshotUrl} alt="Screenshot" className="w-full rounded-lg border border-[var(--border-color)]" />
              ) : (
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg text-center opacity-60 text-sm">No screenshot provided</div>
              )}
              
              {verifyingPayment.payment.transactionId && (
                <p className="text-sm"><strong>Transaction ID:</strong> <span className="font-mono bg-white/10 px-2 py-0.5 rounded">{verifyingPayment.payment.transactionId}</span></p>
              )}
              {verifyingPayment.payment.notes && (
                <p className="text-sm"><strong>Notes:</strong> {verifyingPayment.payment.notes}</p>
              )}
              
              <div className="flex gap-2 mt-4">
                <button onClick={() => {
                  const updatedStudent = { ...verifyingPayment.student };
                  updatedStudent.paymentHistory = updatedStudent.paymentHistory.map((p: any) => 
                     (p.id === verifyingPayment.payment.id || p.date === verifyingPayment.payment.date) ? { ...p, status: 'verified' } : p
                  );
                  updatedStudent.feeStatus = 'Paid'; // Auto update fee status
                  updatedStudent.expiryDate = updatedStudent.expiryDate || getDefaultExpiryDate(); // Set default expiry on verify
                  updateItem('enrollments', updatedStudent.id, updatedStudent);
                  setVerifyingPayment(null);
                }} className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all">Approve</button>
                
                <button onClick={() => {
                  const updatedStudent = { ...verifyingPayment.student };
                  updatedStudent.paymentHistory = updatedStudent.paymentHistory.map((p: any) => 
                     (p.id === verifyingPayment.payment.id || p.date === verifyingPayment.payment.date) ? { ...p, status: 'rejected' } : p
                  );
                  updateItem('enrollments', updatedStudent.id, updatedStudent);
                  setVerifyingPayment(null);
                }} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all">Reject</button>
                
                <button onClick={() => setVerifyingPayment(null)} className="px-4 py-2 bg-gray-500 text-white rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/20">
            <div className="p-5 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
              <h3 className="text-xl font-bold capitalize">{editingId ? 'Edit' : 'Add New'} {modalType.split('_').join(' ').slice(0, -1)}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-red-500 font-bold active:scale-95 transition-all">✕</button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {modalType === 'socialLinks' && (
                <>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.title} onChange={e => setNewItemData({...newItemData, title: e.target.value})} placeholder="Link Title (e.g. Join WhatsApp)" required />
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.url} onChange={e => setNewItemData({...newItemData, url: e.target.value})} placeholder="URL (https://...)" required />
                  <div className="flex gap-2">
                    <select className="w-2/3 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.icon} onChange={e => setNewItemData({...newItemData, icon: e.target.value})} required>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="instagram">Instagram</option>
                      <option value="facebook">Facebook</option>
                      <option value="youtube">YouTube</option>
                      <option value="twitter">Twitter / X</option>
                      <option value="telegram">Telegram</option>
                      <option value="link">Universal Link</option>
                    </select>
                    <input type="number" className="w-1/3 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.order || 0} onChange={e => setNewItemData({...newItemData, order: Number(e.target.value)})} placeholder="Order" />
                  </div>
                </>
              )}
              {modalType === 'exclusive_content' && (
                <>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.title} onChange={e => setNewItemData({...newItemData, title: e.target.value})} placeholder="Material Title (e.g. Electric Charges Notes)" required />
                  <textarea className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white min-h-[80px]" value={newItemData.description} onChange={e => setNewItemData({...newItemData, description: e.target.value})} placeholder="Description" />
                  <div className="flex gap-2">
                    <select className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.grade} onChange={e => setNewItemData({...newItemData, grade: e.target.value})} required>
                      <option value="XII">Class XII</option>
                      <option value="XI">Class XI</option>
                      <option value="X">Class X</option>
                    </select>
                    <select className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.subject} onChange={e => setNewItemData({...newItemData, subject: e.target.value})} required>
                      <option value="">Select Subject</option>
                      <option value="PHYSICS">PHYSICS</option>
                      <option value="CHEMISTRY">CHEMISTRY</option>
                      <option value="MATHEMATICS">MATHEMATICS</option>
                      <option value="BIOLOGY">BIOLOGY</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <select className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.folderId} onChange={e => setNewItemData({...newItemData, folderId: e.target.value})} required>
                      <option value="">Select Folder</option>
                      {courseFolders.filter(f => f.subject === newItemData.subject && f.grade === newItemData.grade).map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <select className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.type} onChange={e => setNewItemData({...newItemData, type: e.target.value})} required>
                      <option value="pdf">Protected PDF</option>
                      <option value="video">Protected Video</option>
                      <option value="image">Protected Image</option>
                      <option value="link">External Link</option>
                    </select>
                    <div className="w-1/2 flex gap-1">
                      <input className="flex-1 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-sm" value={newItemData.url?.startsWith('data:') ? 'Local File' : (newItemData.url || '')} onChange={e => setNewItemData({...newItemData, url: e.target.value})} placeholder="URL or Upload" required={!newItemData.url} disabled={newItemData.url?.startsWith('data:')} />
                      {newItemData.url?.startsWith('data:') ? (
                        <button type="button" onClick={() => setNewItemData({...newItemData, url: ''})} className="px-3 bg-red-500/20 text-red-500 rounded-xl font-bold">X</button>
                      ) : (
                        <label className="flex items-center justify-center px-4 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 rounded-xl cursor-pointer transition-colors">
                          <Upload size={18} />
                          <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, (url) => setNewItemData({...newItemData, url: url}))} accept={newItemData.type === 'image' ? 'image/*' : newItemData.type === 'pdf' ? '.pdf' : '*/*'} />
                        </label>
                      )}
                    </div>
                  </div>
                </>
              )}
              {modalType === 'course_folders' && (
                <>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.name} onChange={e => setNewItemData({...newItemData, name: e.target.value})} placeholder="Folder Name (e.g. Chapter 1)" required />
                  <select className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.subject} onChange={e => setNewItemData({...newItemData, subject: e.target.value})} required>
                    <option value="">Select Subject</option>
                    <option value="PHYSICS">PHYSICS</option>
                    <option value="CHEMISTRY">CHEMISTRY</option>
                    <option value="MATHEMATICS">MATHEMATICS</option>
                    <option value="BIOLOGY">BIOLOGY</option>
                  </select>
                  <select className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.grade} onChange={e => setNewItemData({...newItemData, grade: e.target.value})} required>
                    <option value="XII">Class XII</option>
                    <option value="XI">Class XI</option>
                    <option value="X">Class X</option>
                  </select>
                </>
              )}
              {modalType === 'batches' && (
                <>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.name} onChange={e => setNewItemData({...newItemData, name: e.target.value})} placeholder="Batch Name" required />
                  <div className="flex gap-2">
                    <input className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.tag} onChange={e => setNewItemData({...newItemData, tag: e.target.value})} placeholder="Tag (e.g. URGENT)" required />
                    <input className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.date} onChange={e => setNewItemData({...newItemData, date: e.target.value})} placeholder="Date (e.g. APR 15)" required />
                  </div>
                  <div className="flex gap-2">
                    <select className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.color} onChange={e => setNewItemData({...newItemData, color: e.target.value})} required>
                      <option value="var(--primary)">Theme Default</option>
                      <option value="#ef4444">Red</option>
                      <option value="#f97316">Orange</option>
                      <option value="#eab308">Yellow</option>
                      <option value="#22c55e">Green</option>
                      <option value="#3b82f6">Blue</option>
                      <option value="#a855f7">Purple</option>
                    </select>
                    <select className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.tagColor} onChange={e => setNewItemData({...newItemData, tagColor: e.target.value})} required>
                      <option value="var(--primary)">Theme Default</option>
                      <option value="#ef4444">Red</option>
                      <option value="#f97316">Orange</option>
                      <option value="#eab308">Yellow</option>
                      <option value="#22c55e">Green</option>
                      <option value="#3b82f6">Blue</option>
                      <option value="#a855f7">Purple</option>
                    </select>
                  </div>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.description} onChange={e => setNewItemData({...newItemData, description: e.target.value})} placeholder="Description" required />
                  <div className="flex items-center gap-4 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                    <label className="text-xs font-bold opacity-70 text-gray-700 dark:text-gray-300">Status:</label>
                    <select 
                      className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900"
                      value={newItemData.enrollmentStatus || 'none'}
                      onChange={e => setNewItemData({...newItemData, enrollmentStatus: e.target.value})}
                    >
                      <option value="none">Hidden (Not Enrolling)</option>
                      <option value="upcoming">Upcoming (Show as Upcoming)</option>
                      <option value="live">Live (Enrolling Now)</option>
                    </select>
                  </div>
                </>
              )}
              {modalType === 'routines' && (
                <>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs uppercase opacity-70 ml-1">Start Time</label>
                      <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-gray-900 dark:text-white" value={newItemData.startTime} onChange={e => setNewItemData({...newItemData, startTime: e.target.value})} placeholder="09:00 AM" required />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs uppercase opacity-70 ml-1">End Time</label>
                      <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-gray-900 dark:text-white" value={newItemData.endTime} onChange={e => setNewItemData({...newItemData, endTime: e.target.value})} placeholder="10:00 AM" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
                      <div key={day}>
                        <label className="text-xs uppercase opacity-70 ml-1 text-gray-700 dark:text-gray-300">{day}</label>
                        <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white" value={newItemData[day]} onChange={e => setNewItemData({...newItemData, [day]: e.target.value})} placeholder="-" />
                      </div>
                    ))}
                  </div>
                </>
              )}
              {modalType === 'downloads' && (
                <>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-gray-900 dark:text-white" value={newItemData.subject} onChange={e => setNewItemData({...newItemData, subject: e.target.value})} placeholder="Subject Name" required />
                  <div className="flex gap-2">
                    <select className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.icon} onChange={e => setNewItemData({...newItemData, icon: e.target.value})} required>
                      <option value="Download">Download Icon</option>
                      <option value="Book">Book Icon</option>
                      <option value="FlaskConical">Science Icon</option>
                      <option value="Atom">Physics/Atom Icon</option>
                      <option value="Dna">Biology/DNA Icon</option>
                      <option value="Calculator">Math Icon</option>
                      <option value="FolderOpen">Folder Icon</option>
                    </select>
                    <select className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.color} onChange={e => setNewItemData({...newItemData, color: e.target.value})} required>
                      <option value="var(--primary)">Theme Default</option>
                      <option value="var(--secondary)">Theme Secondary</option>
                      <option value="var(--accent)">Theme Accent</option>
                      <option value="var(--success)">Theme Success</option>
                      <option value="#ef4444">Red</option>
                      <option value="#f97316">Orange</option>
                      <option value="#eab308">Yellow</option>
                      <option value="#22c55e">Green</option>
                      <option value="#3b82f6">Blue</option>
                      <option value="#a855f7">Purple</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold ml-1 text-gray-700 dark:text-gray-300">Links</label>
                    {(newItemData.links || []).map((link: any, i: number) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input className="w-1/3 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white" value={link.label || ''} onChange={e => {
                          const newLinks = [...newItemData.links];
                          newLinks[i].label = e.target.value;
                          setNewItemData({...newItemData, links: newLinks});
                        }} placeholder="Label" required />
                        <div className="flex-1 flex gap-1 items-center">
                          <input className="flex-1 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white" value={link.url?.startsWith('data:') ? 'Local File Uploaded' : (link.url || '')} onChange={e => {
                            const newLinks = [...newItemData.links];
                            newLinks[i].url = e.target.value;
                            setNewItemData({...newItemData, links: newLinks});
                          }} placeholder="URL" required={!link.url} disabled={link.url?.startsWith('data:')} />
                          
                          {link.url?.startsWith('data:') ? (
                            <button type="button" onClick={() => {
                              const newLinks = [...newItemData.links];
                              newLinks[i].url = '';
                              setNewItemData({...newItemData, links: newLinks});
                            }} className="px-3 py-3 text-xs bg-red-500/20 text-red-500 rounded-xl font-bold">Clear</button>
                          ) : (
                            <label className="flex items-center justify-center px-3 py-3 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 rounded-xl cursor-pointer transition-colors">
                              <span className="text-xs font-bold text-gray-900 dark:text-white">File</span>
                              <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, (url, name) => {
                                const newLinks = [...newItemData.links];
                                newLinks[i].url = url;
                                if (!newLinks[i].label) newLinks[i].label = name;
                                setNewItemData({...newItemData, links: newLinks});
                              })} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
                            </label>
                          )}
                        </div>
                        <button type="button" onClick={() => {
                          const newLinks = newItemData.links.filter((_: any, index: number) => index !== i);
                          setNewItemData({...newItemData, links: newLinks});
                        }} className="px-3 bg-red-500/20 text-red-500 rounded-xl font-bold">X</button>
                      </div>
                    ))}
                    <button type="button" onClick={() => {
                      const newLinks = [...(newItemData.links || []), { label: '', url: '', icon: 'Download' }];
                      setNewItemData({...newItemData, links: newLinks});
                    }} className="text-xs bg-[var(--primary)] text-white px-3 py-2 rounded-xl mt-1 font-bold">+ Add Link</button>
                  </div>
                </>
              )}
              {modalType === 'fees' && (
                <>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.subject} onChange={e => setNewItemData({...newItemData, subject: e.target.value})} placeholder="Subject Name" required />
                  
                  <div>
                    <label className="text-[10px] uppercase opacity-50 block mb-1 font-bold">Classes</label>
                    <div className="flex flex-wrap gap-2">
                      {['IX', 'X', 'XI', 'XII'].map(g => (
                        <label key={g} className="flex items-center gap-2 text-sm bg-gray-100 dark:bg-white/5 px-3 py-2 rounded-xl border border-transparent cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10">
                          <input 
                            type="checkbox" 
                            checked={(newItemData.grades || [newItemData.grade]).includes(g)}
                            onChange={e => {
                              const currentGrades = newItemData.grades || (newItemData.grade ? [newItemData.grade] : []);
                              const newGrades = e.target.checked 
                                ? [...currentGrades, g]
                                : currentGrades.filter((cg: string) => cg !== g);
                              setNewItemData({...newItemData, grades: newGrades, grade: newGrades[0] || ''});
                            }}
                            className="rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
                          />
                          Class {g}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input type="number" className="w-1/3 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.originalPrice || ''} onChange={e => {
                      const val = Number(e.target.value);
                      setNewItemData({...newItemData, originalPrice: val, finalPrice: val - (newItemData.discount || 0)});
                    }} placeholder="Price" required />
                    <input type="number" className="w-1/3 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.discount || ''} onChange={e => {
                      const val = Number(e.target.value);
                      setNewItemData({...newItemData, discount: val, finalPrice: (newItemData.originalPrice || 0) - val});
                    }} placeholder="Discount" />
                    <input type="number" className="w-1/3 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.finalPrice || ''} readOnly placeholder="Final" />
                  </div>
                </>
              )}
              {modalType === 'radars' && (
                <>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.title} onChange={e => setNewItemData({...newItemData, title: e.target.value})} placeholder="Class Title (e.g. Physics HS 2nd)" required />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs uppercase opacity-70 ml-1">Start Time</label>
                      <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.startTime} onChange={e => setNewItemData({...newItemData, startTime: e.target.value})} placeholder="09:00 AM" required />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs uppercase opacity-70 ml-1">End Time</label>
                      <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.endTime} onChange={e => setNewItemData({...newItemData, endTime: e.target.value})} placeholder="10:00 AM" />
                    </div>
                  </div>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.date} onChange={e => setNewItemData({...newItemData, date: e.target.value})} placeholder="Date (e.g. Wed Apr 15 2026)" required />
                  <select className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.status} onChange={e => setNewItemData({...newItemData, status: e.target.value})} required>
                      <option value="upcoming">Upcoming</option>
                      <option value="live">Ongoing (Live)</option>
                      <option value="canceled">Canceled</option>
                      <option value="delayed">Delayed</option>
                      <option value="completed">Completed</option>
                    </select>
                  <div className="flex gap-2">
                    <select className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.type} onChange={e => setNewItemData({...newItemData, type: e.target.value})} required>
                      <option value="text">Text Only</option>
                      <option value="image">Image</option>
                      <option value="pdf">PDF Document</option>
                      <option value="video">Video (YouTube)</option>
                      <option value="voice">Voice Note</option>
                    </select>
                    <input className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.externalUrl} onChange={e => setNewItemData({...newItemData, externalUrl: e.target.value})} placeholder={newItemData.type === 'video' ? "YouTube Link" : "External URL"} />
                  </div>
                  <div className="flex gap-2">
                    <input className="flex-1 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.fileUrl?.startsWith('data:') ? 'Local File Uploaded' : (newItemData.fileUrl || '')} onChange={e => setNewItemData({...newItemData, fileUrl: e.target.value})} placeholder="File URL" disabled={newItemData.fileUrl?.startsWith('data:')} />
                    {newItemData.fileUrl?.startsWith('data:') ? (
                      <button type="button" onClick={() => setNewItemData({...newItemData, fileUrl: ''})} className="px-3 py-3 text-xs bg-red-500/20 text-red-500 rounded-xl font-bold">Clear</button>
                    ) : (
                      <label className="flex items-center justify-center px-4 py-3 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 rounded-xl cursor-pointer transition-colors">
                        <Upload size={20} />
                        <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, (url) => setNewItemData({...newItemData, fileUrl: url}))} accept={newItemData.type === 'image' ? 'image/*' : newItemData.type === 'pdf' ? '.pdf' : newItemData.type === 'voice' ? 'audio/*' : '*/*'} />
                      </label>
                    )}
                  </div>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.link} onChange={e => setNewItemData({...newItemData, link: e.target.value})} placeholder="Class Link (Optional)" />
                  <textarea className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white min-h-[80px]" value={newItemData.notes} onChange={e => setNewItemData({...newItemData, notes: e.target.value})} placeholder="Teacher's Note (Optional)" />
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.instagramProfile || ''} onChange={e => setNewItemData({...newItemData, instagramProfile: e.target.value})} placeholder="Teacher's Instagram Username / URL" />
                </>
              )}
              {modalType === 'teasers' && (
                <>
                  <textarea className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white min-h-[80px]" value={newItemData.question} onChange={e => setNewItemData({...newItemData, question: e.target.value})} placeholder="Question" required />
                  <div className="space-y-2">
                    <label className="text-sm font-semibold ml-1 text-gray-700 dark:text-gray-300">Options</label>
                    {(newItemData.options || ['', '', '', '']).map((opt: string, i: number) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input type="radio" name="new-correct" checked={newItemData.correctAnswer === i} onChange={() => setNewItemData({...newItemData, correctAnswer: i})} className="w-4 h-4 text-[var(--primary)] focus:ring-[var(--primary)]" />
                        <input className="flex-1 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white" value={opt} onChange={e => {
                          const newOptions = [...(newItemData.options || ['', '', '', ''])];
                          newOptions[i] = e.target.value;
                          setNewItemData({...newItemData, options: newOptions});
                        }} placeholder={`Option ${i + 1}`} required />
                      </div>
                    ))}
                  </div>
                  <textarea className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white" value={newItemData.explanation} onChange={e => setNewItemData({...newItemData, explanation: e.target.value})} placeholder="Explanation" />
                </>
              )}
              {modalType === 'drops' && (
                <>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.title} onChange={e => setNewItemData({...newItemData, title: e.target.value})} placeholder="Title" required />
                  <textarea className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white min-h-[80px]" value={newItemData.content} onChange={e => setNewItemData({...newItemData, content: e.target.value})} placeholder="Content (Optional)" />
                  <div className="flex gap-2">
                    <select className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.type} onChange={e => setNewItemData({...newItemData, type: e.target.value})} required>
                      <option value="text">Text/Announcement</option>
                      <option value="image">Image</option>
                      <option value="pdf">PDF Document</option>
                      <option value="video">Video (YouTube)</option>
                      <option value="voice">Voice Note</option>
                    </select>
                    <input type="datetime-local" className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white text-sm" value={newItemData.expiresAt} onChange={e => setNewItemData({...newItemData, expiresAt: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.externalUrl} onChange={e => setNewItemData({...newItemData, externalUrl: e.target.value})} placeholder={newItemData.type === 'video' ? "YouTube Link" : "External URL"} />
                    <div className="flex gap-2">
                      <input className="flex-1 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.fileUrl?.startsWith('data:') ? 'Local File Uploaded' : (newItemData.fileUrl || '')} onChange={e => setNewItemData({...newItemData, fileUrl: e.target.value})} placeholder="File URL" disabled={newItemData.fileUrl?.startsWith('data:')} />
                      {newItemData.fileUrl?.startsWith('data:') ? (
                        <button type="button" onClick={() => setNewItemData({...newItemData, fileUrl: ''})} className="px-3 py-3 text-xs bg-red-500/20 text-red-500 rounded-xl font-bold">Clear</button>
                      ) : (
                        <label className="flex items-center justify-center px-4 py-3 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 rounded-xl cursor-pointer transition-colors">
                          <Upload size={20} />
                          <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, (url) => setNewItemData({...newItemData, fileUrl: url}))} accept={newItemData.type === 'image' ? 'image/*' : newItemData.type === 'pdf' ? '.pdf' : newItemData.type === 'voice' ? 'audio/*' : '*/*'} />
                        </label>
                      )}
                    </div>
                  </div>
                </>
              )}
              {modalType === 'stars' && (
                <>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.name} onChange={e => setNewItemData({...newItemData, name: e.target.value})} placeholder="Student Name" required />
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.achievement} onChange={e => setNewItemData({...newItemData, achievement: e.target.value})} placeholder="Achievement" required />
                  <div className="flex gap-2">
                    <input className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.week} onChange={e => setNewItemData({...newItemData, week: e.target.value})} placeholder="Week" required />
                    <div className="w-1/2 flex gap-1 items-center">
                      <input className="flex-1 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white" value={newItemData.image?.startsWith('data:') ? 'Local File Uploaded' : (newItemData.image || '')} onChange={e => setNewItemData({...newItemData, image: e.target.value})} placeholder="Image URL" disabled={newItemData.image?.startsWith('data:')} />
                      {newItemData.image?.startsWith('data:') ? (
                        <button type="button" onClick={() => setNewItemData({...newItemData, image: ''})} className="px-3 py-3 text-xs bg-red-500/20 text-red-500 rounded-xl font-bold">Clear</button>
                      ) : (
                        <label className="flex items-center justify-center px-3 py-3 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 rounded-xl cursor-pointer transition-colors">
                          <span className="text-xs font-bold text-gray-900 dark:text-white">File</span>
                          <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, (url) => setNewItemData({...newItemData, image: url}))} accept=".png,.jpg,.jpeg" />
                        </label>
                      )}
                    </div>
                  </div>
                </>
              )}
              {modalType === 'enrollments' && (
                <>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.name} onChange={e => setNewItemData({...newItemData, name: e.target.value})} placeholder="Student Name" required />
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.email} onChange={e => setNewItemData({...newItemData, email: e.target.value})} placeholder="Email Address" required />
                  <div className="flex gap-2">
                    <input className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.phone} onChange={e => setNewItemData({...newItemData, phone: e.target.value})} placeholder="Phone Number" />
                    <input className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.whatsapp} onChange={e => setNewItemData({...newItemData, whatsapp: e.target.value})} placeholder="WhatsApp Number" required />
                  </div>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.instagram} onChange={e => setNewItemData({...newItemData, instagram: e.target.value})} placeholder="Instagram Username (Optional)" />
                  <select className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white" value={newItemData.grade} onChange={e => setNewItemData({...newItemData, grade: e.target.value})} required>
                    <option value="XII">Class XII</option>
                    <option value="XI">Class XI</option>
                    <option value="X">Class X</option>
                  </select>
                  
                  <div>
                    <label className="text-[10px] uppercase opacity-50 block mb-1 font-bold ml-1">Subjects (Multi-select)</label>
                    <div className="space-y-2">
                       <div className="flex flex-wrap gap-2 min-h-[44px] p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                        {(newItemData.subjects || []).map((subj: string) => (
                          <span key={subj} className="px-2 py-1 bg-[var(--primary)] text-white text-xs font-bold rounded-lg flex items-center gap-1.5">
                            {subj}
                            <button 
                              type="button" 
                              onClick={() => setNewItemData({...newItemData, subjects: newItemData.subjects.filter((s: string) => s !== subj)})}
                              className="hover:text-red-200"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                        {(newItemData.subjects || []).length === 0 && <span className="text-xs opacity-50 italic">Select subjects below</span>}
                      </div>
                      <select 
                        className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white [&>option]:bg-white dark:[&>option]:bg-gray-900"
                        onChange={e => {
                          if (e.target.value && !(newItemData.subjects || []).includes(e.target.value)) {
                            setNewItemData({
                              ...newItemData, 
                              subjects: [...(newItemData.subjects || []), e.target.value]
                            });
                          }
                          e.target.value = "";
                        }}
                        value=""
                      >
                        <option value="">+ Add Subject from Pricing...</option>
                        {getSubjectsForGrade(newItemData.grade).map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <input className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.slots || ''} onChange={e => setNewItemData({...newItemData, slots: e.target.value})} placeholder="Enrolled Slots (e.g. 2:30 PM - 4:00 PM)" />
                  <div className="flex gap-2">
                    <input type="number" className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.totalFee || ''} onChange={e => setNewItemData({...newItemData, totalFee: Number(e.target.value)})} placeholder="Total Fee" required />
                    <input type="number" className="w-1/2 p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white" value={newItemData.discount || ''} onChange={e => setNewItemData({...newItemData, discount: Number(e.target.value)})} placeholder="Discount" />
                  </div>
                  <textarea className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white min-h-[80px]" value={newItemData.notes} onChange={e => setNewItemData({...newItemData, notes: e.target.value})} placeholder="Notes" />
                </>
              )}
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 p-3 rounded-xl bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-white font-bold active:scale-95 transition-all">Cancel</button>
                <button type="submit" className="flex-1 p-3 rounded-xl bg-[var(--primary)] text-white font-bold active:scale-95 transition-all">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
