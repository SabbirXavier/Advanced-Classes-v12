import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Settings, 
  Save, 
  RefreshCw, 
  Plus,
  Trash2,
  Image as ImageIcon,
  Users,
  Trophy,
  Layout,
  Upload,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { landingService, LandingConfig, Achiever, Faculty } from '../services/landingService';
import { storageService } from '../services/storageService';
import { firestoreService } from '../services/firestoreService';
import toast from 'react-hot-toast';

export default function AdminLandingDashboard() {
  const [config, setConfig] = useState<LandingConfig | null>(null);
  const [achievers, setAchievers] = useState<Achiever[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [activeTab, setActiveTab] = useState<'config' | 'achievers' | 'faculty'>('config');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    const unsubConfig = landingService.listenToConfig(setConfig);
    const unsubAchievers = landingService.listenToAchievers(setAchievers);
    const unsubFaculty = landingService.listenToFaculty(setFaculty);
    return () => {
      unsubConfig();
      unsubAchievers();
      unsubFaculty();
    };
  }, []);

  const handleSaveConfig = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await landingService.updateConfig(config);
      toast.success('Landing config saved!');
    } catch (err) {
      toast.error('Failed to save config');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (file: File, callback: (url: string) => void) => {
    try {
      setUploadProgress(0);
      const uploadResult = storageService.uploadFile(file, setUploadProgress);
      const metadata = await uploadResult.promise;
      callback(metadata.url);
      setUploadProgress(null);
      toast.success('Photo uploaded!');
    } catch (err) {
      console.error(err);
      setUploadProgress(null);
      toast.error('Upload failed');
    }
  };

  if (!config) return <div className="flex justify-center py-12"><RefreshCw className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
            <Layout size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold">Landing Page Manager</h3>
            <p className="text-xs text-gray-500">Manage achievers, faculty, and site copy</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'config' ? 'bg-white dark:bg-gray-800 text-[var(--primary)] shadow-sm' : 'text-gray-500'}`}
        >
          <Settings size={14} /> Main Copy
        </button>
        <button 
          onClick={() => setActiveTab('achievers')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'achievers' ? 'bg-white dark:bg-gray-800 text-[var(--primary)] shadow-sm' : 'text-gray-500'}`}
        >
          <Trophy size={14} /> Achievers
        </button>
        <button 
          onClick={() => setActiveTab('faculty')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'faculty' ? 'bg-white dark:bg-gray-800 text-[var(--primary)] shadow-sm' : 'text-gray-500'}`}
        >
          <Users size={14} /> Faculty
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'config' && (
          <motion.div 
            key="config"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="glass-card p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold">Hero Title</label>
                  <input 
                    type="text"
                    value={config.heroTitle}
                    onChange={e => setConfig({ ...config, heroTitle: e.target.value })}
                    className="w-full p-3 bg-gray-100 dark:bg-white/5 rounded-xl outline-none border border-transparent focus:border-[var(--primary)] text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold">Hero Subtitle</label>
                  <textarea 
                    value={config.heroSubtitle}
                    onChange={e => setConfig({ ...config, heroSubtitle: e.target.value })}
                    className="w-full p-3 bg-gray-100 dark:bg-white/5 rounded-xl outline-none border border-transparent focus:border-[var(--primary)] text-sm min-h-[100px]"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Stats Indicators</h4>
                  <button 
                    onClick={() => setConfig({ ...config, stats: [...config.stats, { label: '', value: '' }] })}
                    className="p-1.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-lg hover:bg-[var(--primary)]/20 transition-all"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {config.stats.map((stat, i) => (
                    <div key={i} className="p-4 bg-gray-100 dark:bg-white/5 rounded-2xl relative group">
                      <button 
                        onClick={() => setConfig({ ...config, stats: config.stats.filter((_, idx) => idx !== i) })}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X size={12} />
                      </button>
                      <input 
                        placeholder="Value (e.g. 98%)"
                        value={stat.value}
                        onChange={e => {
                          const newStats = [...config.stats];
                          newStats[i].value = e.target.value;
                          setConfig({ ...config, stats: newStats });
                        }}
                        className="w-full bg-transparent border-none outline-none font-black text-xl mb-1"
                      />
                      <textarea 
                        placeholder="Label (e.g. Success Rate)"
                        value={stat.label}
                        onChange={e => {
                          const newStats = [...config.stats];
                          newStats[i].label = e.target.value;
                          setConfig({ ...config, stats: newStats });
                        }}
                        className="w-full bg-transparent border-none outline-none text-[10px] uppercase font-bold opacity-60 min-h-[40px] leading-tight"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-gray-400">Features</h4>
                  <button 
                    onClick={() => setConfig({ ...config, features: [...config.features, { title: '', description: '', icon: 'Zap' }] })}
                    className="p-1.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-lg hover:bg-[var(--primary)]/20 transition-all"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {config.features.map((feature, i) => (
                    <div key={i} className="p-5 bg-gray-100 dark:bg-white/5 rounded-2xl relative group space-y-3">
                      <button 
                        onClick={() => setConfig({ ...config, features: config.features.filter((_, idx) => idx !== i) })}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X size={12} />
                      </button>
                      <div className="flex gap-3">
                        <select 
                          value={feature.icon}
                          onChange={e => {
                            const newFeatures = [...config.features];
                            newFeatures[i].icon = e.target.value;
                            setConfig({ ...config, features: newFeatures });
                          }}
                          className="bg-white dark:bg-gray-800 p-2 rounded-lg text-xs outline-none border border-transparent focus:border-[var(--primary)] text-[var(--primary)] font-bold"
                        >
                          <option value="Zap">Zap</option>
                          <option value="Brain">Brain</option>
                          <option value="Radio">Radio</option>
                          <option value="MessageSquare">MessageSquare</option>
                          <option value="Star">Star</option>
                          <option value="ShieldCheck">Shield</option>
                          <option value="Target">Target</option>
                          <option value="Clock">Clock</option>
                        </select>
                        <input 
                          placeholder="Feature Title"
                          value={feature.title}
                          onChange={e => {
                            const newFeatures = [...config.features];
                            newFeatures[i].title = e.target.value;
                            setConfig({ ...config, features: newFeatures });
                          }}
                          className="flex-1 bg-transparent border-none outline-none font-bold text-sm"
                        />
                      </div>
                      <textarea 
                        placeholder="Feature Description"
                        value={feature.description}
                        onChange={e => {
                          const newFeatures = [...config.features];
                          newFeatures[i].description = e.target.value;
                          setConfig({ ...config, features: newFeatures });
                        }}
                        className="w-full bg-transparent border-none outline-none text-xs opacity-70 min-h-[60px]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="w-full py-4 bg-[var(--primary)] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all"
              >
                {isSaving ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                Save Landing Configuration
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === 'achievers' && (
           <motion.div key="achievers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
             <div className="flex justify-between items-center bg-white dark:bg-[#111] p-4 rounded-xl border border-gray-100 dark:border-white/5">
               <h4 className="font-bold">Managed Achievers ({achievers.length})</h4>
               <button 
                 onClick={async () => {
                   await firestoreService.addItem('achievers', { 
                     name: 'New Student', 
                     rank: '1st', 
                     percentage: '95%', 
                     grade: 'XII', 
                     batch: 'Master Minds', 
                     achievementTitle: 'Letter in Physics',
                     photo: '', 
                     achievement: 'Achieved top rank in school exam', 
                     year: '2025',
                     order: achievers.length 
                   });
                 }}
                 className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-xs font-bold flex items-center gap-2"
               >
                 <Plus size={14} /> Add Achiever
               </button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
               {achievers.map((a) => (
                 <div key={a.id} className="glass-card p-6 space-y-4">
                   <div className="flex flex-col sm:flex-row gap-6">
                     <div className="w-full sm:w-32 space-y-2">
                       <div className="w-full h-40 bg-gray-100 dark:bg-white/5 rounded-xl overflow-hidden relative group shrink-0">
                         {a.photo ? (
                           <img src={a.photo} className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-gray-400">
                             <ImageIcon size={32} />
                           </div>
                         )}
                         <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                           <Upload size={20} className="text-white" />
                           <input type="file" className="hidden" onChange={e => {
                             const file = e.target.files?.[0];
                             if (file) handlePhotoUpload(file, url => firestoreService.updateItem('achievers', a.id!, { photo: url }));
                           }} />
                         </label>
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold opacity-50 uppercase">Photo URL</label>
                         <input 
                           className="w-full bg-gray-100 dark:bg-white/5 p-2 rounded-lg text-[10px] outline-none border border-transparent focus:border-[var(--primary)]" 
                           value={a.photo} 
                           onChange={e => firestoreService.updateItem('achievers', a.id!, { photo: e.target.value })}
                           placeholder="Paste Image URL" 
                         />
                       </div>
                     </div>

                     <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold opacity-50 uppercase">Full Name</label>
                         <input 
                           className="w-full bg-gray-100 dark:bg-white/5 p-2 rounded-lg text-sm font-bold outline-none border border-transparent focus:border-[var(--primary)]" 
                           value={a.name} 
                           onChange={e => firestoreService.updateItem('achievers', a.id!, { name: e.target.value })}
                           placeholder="Full Name" 
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold opacity-50 uppercase">Achievement Title</label>
                         <input 
                           className="w-full bg-gray-100 dark:bg-white/5 p-2 rounded-lg text-sm outline-none border border-transparent focus:border-[var(--primary)]" 
                           value={a.achievementTitle} 
                           onChange={e => firestoreService.updateItem('achievers', a.id!, { achievementTitle: e.target.value })}
                           placeholder="e.g. Letter in Chemistry" 
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold opacity-50 uppercase">Rank/Position</label>
                         <input 
                           className="w-full bg-gray-100 dark:bg-white/5 p-2 rounded-lg text-sm outline-none border border-transparent focus:border-[var(--primary)]" 
                           value={a.rank} 
                           onChange={e => firestoreService.updateItem('achievers', a.id!, { rank: e.target.value })}
                           placeholder="e.g. 1st / District Top" 
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold opacity-50 uppercase">Percentage/Score</label>
                         <input 
                           className="w-full bg-gray-100 dark:bg-white/5 p-2 rounded-lg text-sm outline-none border border-transparent focus:border-[var(--primary)]" 
                           value={a.percentage} 
                           onChange={e => firestoreService.updateItem('achievers', a.id!, { percentage: e.target.value })}
                           placeholder="e.g. 98.4%" 
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold opacity-50 uppercase">Batch Name</label>
                         <input 
                           className="w-full bg-gray-100 dark:bg-white/5 p-2 rounded-lg text-sm outline-none border border-transparent focus:border-[var(--primary)]" 
                           value={a.batch} 
                           onChange={e => firestoreService.updateItem('achievers', a.id!, { batch: e.target.value })}
                           placeholder="e.g. NEET 2026 / Master Minds" 
                         />
                       </div>
                       <div className="space-y-1">
                         <label className="text-[10px] font-bold opacity-50 uppercase">Class/Grade</label>
                         <input 
                           className="w-full bg-gray-100 dark:bg-white/5 p-2 rounded-lg text-sm outline-none border border-transparent focus:border-[var(--primary)]" 
                           value={a.grade} 
                           onChange={e => firestoreService.updateItem('achievers', a.id!, { grade: e.target.value })}
                           placeholder="e.g. XII" 
                         />
                       </div>
                       <div className="space-y-1 md:col-span-2">
                         <label className="text-[10px] font-bold opacity-50 uppercase">Detailed Achievement Note</label>
                         <textarea 
                           className="w-full bg-gray-100 dark:bg-white/5 p-2 rounded-lg text-xs outline-none border border-transparent focus:border-[var(--primary)] min-h-[60px]" 
                           value={a.achievement} 
                           onChange={e => firestoreService.updateItem('achievers', a.id!, { achievement: e.target.value })}
                           placeholder="Description of achievement" 
                         />
                       </div>
                     </div>
                   </div>
                   <div className="flex gap-2">
                    <button onClick={() => firestoreService.deleteItem('achievers', a.id!)} className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all flex items-center justify-center gap-2 text-xs font-bold w-full"><Trash2 size={14} /> Remove Student Record</button>
                   </div>
                 </div>
               ))}
             </div>
           </motion.div>
        )}

        {activeTab === 'faculty' && (
           <motion.div key="faculty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
             <div className="flex justify-between items-center bg-white dark:bg-[#111] p-4 rounded-xl border border-gray-100 dark:border-white/5">
               <h4 className="font-bold">Faculty Members ({faculty.length})</h4>
               <button 
                 onClick={async () => {
                   await firestoreService.addItem('faculty', { name: 'New Teacher', degree: 'M.Sc, B.Ed', experience: '5+ Years', photo: '', subjects: [], achievement: '', order: faculty.length });
                 }}
                 className="px-4 py-2 bg-[var(--primary)] text-white rounded-lg text-xs font-bold flex items-center gap-2"
               >
                 <Plus size={14} /> Add Faculty
               </button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {faculty.map((f) => (
                 <div key={f.id} className="glass-card p-4 space-y-4">
                   <div className="flex gap-4">
                     <div className="w-24 space-y-2">
                       <div className="w-full h-28 bg-gray-100 dark:bg-white/5 rounded-xl overflow-hidden relative group shrink-0">
                         {f.photo ? (
                           <img src={f.photo} className="w-full h-full object-cover" />
                         ) : (
                           <div className="w-full h-full flex items-center justify-center text-gray-400">
                             <ImageIcon size={24} />
                           </div>
                         )}
                         <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                           <Upload size={16} className="text-white" />
                           <input type="file" className="hidden" onChange={e => {
                             const file = e.target.files?.[0];
                             if (file) handlePhotoUpload(file, url => firestoreService.updateItem('faculty', f.id!, { photo: url }));
                           }} />
                         </label>
                       </div>
                       <input 
                         className="w-full bg-gray-100 dark:bg-white/5 p-1 rounded text-[8px] outline-none border border-transparent focus:border-[var(--primary)]" 
                         value={f.photo} 
                         onChange={e => firestoreService.updateItem('faculty', f.id!, { photo: e.target.value })}
                         placeholder="Photo URL" 
                       />
                     </div>
                     <div className="flex-1 space-y-2">
                       <input 
                         className="w-full bg-transparent font-bold border-b border-white/5 focus:border-[var(--primary)] outline-none" 
                         value={f.name} 
                         onChange={e => firestoreService.updateItem('faculty', f.id!, { name: e.target.value })}
                         placeholder="Name" 
                       />
                       <input 
                         className="w-full bg-transparent text-xs border-b border-white/5 focus:border-[var(--primary)] outline-none" 
                         value={f.degree} 
                         onChange={e => firestoreService.updateItem('faculty', f.id!, { degree: e.target.value })}
                         placeholder="Degree" 
                       />
                       <input 
                         className="w-full bg-transparent text-xs border-b border-white/5 focus:border-[var(--primary)] outline-none" 
                         value={f.experience} 
                         onChange={e => firestoreService.updateItem('faculty', f.id!, { experience: e.target.value })}
                         placeholder="Experience" 
                       />
                       <textarea 
                         className="w-full bg-transparent text-[10px] border-b border-white/5 focus:border-[var(--primary)] outline-none min-h-[40px]" 
                         value={f.achievement} 
                         onChange={e => firestoreService.updateItem('faculty', f.id!, { achievement: e.target.value })}
                         placeholder="Summary/Achievements" 
                       />
                     </div>
                   </div>
                   <button onClick={() => firestoreService.deleteItem('faculty', f.id!)} className="w-full py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-all flex justify-center"><Trash2 size={16} /></button>
                 </div>
               ))}
             </div>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
