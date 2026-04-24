import React, { useState, useEffect } from 'react';
import { 
  Database, 
  HardDrive, 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  Trash2, 
  Activity,
  Server
} from 'lucide-react';
import { motion } from 'motion/react';
import { storageService, StorageProject } from '../services/storageService';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function AdminStorageDashboard() {
  const [projects, setProjects] = useState<StorageProject[]>([]);
  const [serverStats, setServerStats] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newProject, setNewProject] = useState({
    id: '',
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    appId: '',
    maxCapacityBytes: 5 * 1024 * 1024 * 1024 // 5GB default
  });

  useEffect(() => {
    // Ensure primary project exists
    storageService.getStorageProjects();

    const q = query(collection(db, 'admin/storage/projects'), orderBy('priority', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StorageProject));
      setProjects(p);
    });

    fetchServerStats();

    return () => unsubscribe();
  }, []);

  const fetchServerStats = async () => {
    try {
      const res = await fetch('/api/storage/stats');
      const data = await res.json();
      if (data.success) {
        setServerStats(data);
      }
    } catch(err) {
      console.error('Failed to fetch server stats', err);
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, we'd call storageService.addStorageProject
    console.log('Adding project:', newProject);
    setIsAdding(false);
  };

  const handleRefreshUsage = async (projectId: string) => {
    const toastId = toast.loading(`Refreshing usage for ${projectId}...`);
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out. Please check your internet connection and Firebase Storage configuration.')), 30000)
      );
      
      await Promise.race([
        storageService.refreshProjectUsage(projectId),
        timeoutPromise
      ]);
      
      toast.success('Usage updated!', { id: toastId });
    } catch (err: any) {
      console.error(err);
      const message = err.message || 'Failed to refresh usage.';
      toast.error(message, { id: toastId, duration: 5000 });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* MONGODB CLUSTERS */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg text-green-500">
              <Server size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Server Database Clusters</h3>
              <p className="text-sm text-gray-500">Separated MongoDB free clusters for distinct workloads</p>
            </div>
          </div>
          <button onClick={fetchServerStats} className="p-2 bg-gray-100 dark:bg-white/10 rounded-lg hover:bg-gray-200 dark:hover:bg-white/20 transition">
            <Activity size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Primary DB (Records)</span>
                <h4 className="font-bold font-mono text-sm mt-1">{serverStats?.mainDb?.uri || 'Loading...'}</h4>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${serverStats?.mainDb?.status === 'Connected' ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'}`}>
                {serverStats?.mainDb?.status || 'Unknown'}
              </span>
            </div>
            <div className="text-xs opacity-70">
              Responsible for text data: chat messages, users, schedules, and settings.
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Secondary DB (Files / GridFS)</span>
                <h4 className="font-bold font-mono text-sm mt-1">{serverStats?.fileDb?.uri || 'Not Configured'}</h4>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${serverStats?.fileDb?.status === 'Connected' ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`}>
                {serverStats?.fileDb?.status || 'Unknown'}
              </span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="opacity-60">Total Files</span>
                <span className="font-bold">{serverStats?.fileDb?.count || 0}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="opacity-60">Storage Used</span>
                <span className="font-bold">{formatBytes(serverStats?.fileDb?.size || 0)} / 512 MB Free Tier</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
            <HardDrive size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold">Firebase Storage Configured Buckets</h3>
            <p className="text-xs text-gray-500">Legacy and backup storage routing</p>
          </div>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white rounded-xl font-bold text-sm shadow-lg shadow-[var(--primary)]/20"
        >
          <Plus size={18} />
          Add Bucket
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map(project => {
          const usagePercent = (project.currentUsageBytes / project.maxCapacityBytes) * 100;
          const isCritical = usagePercent > 90;
          const isWarning = usagePercent > 70;

          return (
            <motion.div 
              key={project.id}
              layout
              className="glass-card border border-gray-200 dark:border-white/5 p-5 space-y-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Database size={18} className="text-gray-400" />
                  <span className="font-bold text-sm truncate max-w-[150px]">{project.id}</span>
                </div>
                <div className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tighter ${
                  project.status === 'active' ? 'bg-green-500/10 text-green-500' :
                  project.status === 'full' ? 'bg-red-500/10 text-red-500' :
                  'bg-yellow-500/10 text-yellow-500'
                }`}>
                  {project.status}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-500">Usage</span>
                  <span>{formatBytes(project.currentUsageBytes)} / {formatBytes(project.maxCapacityBytes)}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercent}%` }}
                    className={`h-full ${isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-blue-500'}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-lg text-center">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Priority</p>
                  <p className="font-bold">{project.priority}</p>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-lg text-center">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Last Activity</p>
                  <p className="text-[10px] font-bold truncate">
                    {project.lastActivity ? 
                      (project.lastActivity.toDate ? project.lastActivity.toDate().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) : new Date(project.lastActivity).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })) 
                      : 'Never'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => handleRefreshUsage(project.id)}
                  className="flex-1 py-2 bg-blue-500/10 text-blue-500 rounded-lg text-xs font-bold hover:bg-blue-500/20 transition-all flex items-center justify-center gap-1"
                >
                  <Activity size={14} />
                  Refresh
                </button>
                <button className="flex-1 py-2 bg-gray-100 dark:bg-white/5 rounded-lg text-xs font-bold hover:bg-gray-200 dark:hover:bg-white/10 transition-all">
                  Details
                </button>
                <button className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-12 glass-card border-dashed">
          <Activity size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No storage projects configured.</p>
        </div>
      )}

      {/* Firestore Database Usage */}
      <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-200 dark:border-white/10 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
              <Database size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Firestore Databases</h3>
              <p className="text-sm text-gray-500">Active database instances and estimated usage</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-xs font-bold text-orange-500 uppercase tracking-wider">Primary Database</span>
                <h4 className="font-bold">(default)</h4>
              </div>
              <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-[10px] font-bold rounded uppercase">Active</span>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-xs">
                <span className="opacity-60">Daily Reads</span>
                <span className="font-bold">~50k (Free Tier)</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full w-[15%]" />
              </div>
              <p className="text-[10px] opacity-50 italic">Note: Real-time Firestore usage metrics are available in the Firebase Console.</p>
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 border-dashed flex flex-col items-center justify-center text-center">
            <Plus size={24} className="text-gray-400 mb-2" />
            <p className="text-xs font-bold opacity-60">Multiple databases are supported via Firebase Enterprise.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
