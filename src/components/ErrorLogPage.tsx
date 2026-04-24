import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Clock, Search, Trash2, Filter, AlertTriangle } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, limit, deleteDoc, doc, where } from 'firebase/firestore';

export default function ErrorLogPage({ user, isAdmin }: { user: any, isAdmin: boolean }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    if (!user) return;
    const logsRef = collection(db, 'error_logs');
    // Admin sees all, users see only their own error logs
    const q = isAdmin 
      ? query(logsRef, orderBy('createdAt', 'desc'), limit(100))
      : query(logsRef, where('authInfo.userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(50));
      
    const unsub = onSnapshot(q, (snap) => {
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [user, isAdmin]);

  const categories = ['ALL', ...Array.from(new Set(logs.map(l => l.category || 'App')))];

  const filteredLogs = logs.filter(l => {
    const matchesSearch = (l.error?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (l.path?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || l.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const deleteLog = async (id: string) => {
    if (window.confirm('Delete this error log?')) {
      await deleteDoc(doc(db, 'error_logs', id));
    }
  };

  const clearAllUserLogs = async () => {
    if (window.confirm('Clear all your errors?')) {
      // simplified, usually requires batch
      for (const log of logs) {
        if (!isAdmin || log.authInfo?.userId === user.uid) {
          await deleteDoc(doc(db, 'error_logs', log.id));
        }
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 text-white pb-32">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <AlertTriangle className="text-red-500" /> 
            {isAdmin ? 'System Error Console' : 'My Error Logs'}
          </h1>
          <p className="text-white/50 text-sm mt-1">
            {isAdmin ? 'Monitoring all system and user errors.' : 'Errors related to your actions.'}
          </p>
        </div>
        <button 
          onClick={clearAllUserLogs}
          className="px-4 py-2 bg-white/5 hover:bg-red-500/10 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold transition-all border border-red-500/20"
        >
           Clear My Logs
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={16} />
          <input 
            type="text" 
            placeholder="Search error messages or paths..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl outline-none focus:border-red-500/50 text-sm transition-all"
          />
        </div>
        <div className="relative min-w-[200px]">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={16} />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-xl outline-none focus:border-red-500/50 text-sm appearance-none"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="text-center p-12 bg-white/5 rounded-2xl border border-white/5 text-white/40">
             No errors logged matching the criteria.
          </div>
        ) : (
          filteredLogs.map(log => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={log.id} 
              className="p-4 bg-[#1a1a24] rounded-2xl border border-red-500/20 relative group"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                   <div className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-black tracking-widest uppercase rounded">
                     {log.category || 'App'}
                   </div>
                   <div className="text-xs font-bold opacity-50 flex items-center gap-1">
                      <Clock size={12}/>
                      {new Date(log.timestamp || log.createdAt?.toDate()).toLocaleString()}
                   </div>
                </div>
                <button onClick={() => deleteLog(log.id)} className="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-red-400 transition-all">
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="font-mono text-sm text-red-300 break-words mb-3">
                {log.error}
              </div>

              {log.path && (
                <div className="text-[10px] opacity-60 bg-black/40 p-2 rounded truncate">
                   Path: {log.path}
                </div>
              )}

              {isAdmin && log.authInfo?.email && (
                 <div className="mt-2 text-[10px] bg-white/5 p-2 rounded flex items-center justify-between">
                    <span>User: <strong>{log.authInfo.email}</strong></span>
                    <span className="opacity-40">ID: {log.authInfo.userId}</span>
                 </div>
              )}
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
