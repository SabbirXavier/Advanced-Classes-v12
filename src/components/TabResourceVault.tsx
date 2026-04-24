import React, { useState, useEffect } from 'react';
import { 
  Search, 
  BookOpen, 
  Video, 
  FileText, 
  ExternalLink, 
  Filter,
  Download,
  Library,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

interface Resource {
  id: string;
  title: string;
  description?: string;
  category: string;
  type: 'pdf' | 'video' | 'link' | 'image';
  url: string;
  thumbnail?: string;
  author?: string;
  createdAt: string;
}

export default function TabResourceVault() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource));
      setResources(data);
      setIsLoading(false);
    }, (err) => {
      console.error("Resource fetch failed:", err);
      // Fallback/Mock data for first-time use
      setResources([
        {
          id: '1',
          title: 'Calculus: Integration Mastery',
          description: 'Comprehensive guide to definite and indefinite integrals.',
          category: 'Calculus',
          type: 'pdf',
          url: '#',
          createdAt: new Date().toISOString()
        },
        {
          id: '2',
          title: '3D Geometry Visualized',
          description: 'Understanding vectors and planes in 3D space.',
          category: 'Geometry',
          type: 'video',
          url: 'https://www.youtube.com/watch?v=fNk_zzaMoSs',
          createdAt: new Date().toISOString()
        }
      ]);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const categories = ['All', ...Array.from(new Set(resources.map(r => r.category)))];

  const filteredResources = resources.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (r.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === 'All' || r.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="text-red-500" />;
      case 'video': return <Video className="text-blue-500" />;
      case 'image': return <Download className="text-green-500" />;
      default: return <ExternalLink className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Library className="text-[var(--primary)]" />
            Resource Vault
          </h2>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Study materials, notes, and video lectures.</p>
        </div>
        
        <div className="relative group flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[var(--primary)] transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl outline-none focus:border-[var(--primary)]/50 focus:ring-4 focus:ring-[var(--primary)]/5 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
        <Filter size={18} className="text-gray-400 mr-2 flex-shrink-0" />
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              activeCategory === cat 
                ? 'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/20 scale-105' 
                : 'bg-white dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          [1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass-card !p-0 overflow-hidden shimmer">
              <div className="h-40 bg-gray-200 dark:bg-white/5" />
              <div className="p-5 space-y-3">
                <div className="h-4 w-3/4 skeleton" />
                <div className="h-3 w-1/2 skeleton" />
                <div className="flex gap-2 pt-2">
                  <div className="h-8 w-20 skeleton rounded-full" />
                  <div className="h-8 w-20 skeleton rounded-full" />
                </div>
              </div>
            </div>
          ))
        ) : filteredResources.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {filteredResources.map((res) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={res.id}
                className="glass-card !p-0 group overflow-hidden flex flex-col hover:border-[var(--primary)]/50"
              >
                <div className="relative aspect-video overflow-hidden bg-gray-100 dark:bg-[#111]">
                  {res.thumbnail ? (
                    <img 
                      src={res.thumbnail} 
                      alt={res.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500/10 to-purple-500/10">
                      <Sparkles className="text-indigo-500/30" size={48} />
                    </div>
                  )}
                  <div className="absolute top-3 left-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[10px] uppercase font-black tracking-widest text-white">
                    {res.category}
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-lg leading-tight group-hover:text-[var(--primary)] transition-colors">{res.title}</h3>
                    <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-xl">
                      {getIcon(res.type)}
                    </div>
                  </div>
                  
                  <p className="text-gray-500 dark:text-gray-400 text-sm line-clamp-2 mb-6 flex-1">
                    {res.description || 'No description provided.'}
                  </p>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100 dark:border-white/5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {res.author || 'Math Team'}
                    </span>
                    <a 
                      href={res.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white text-xs font-bold rounded-xl hover:bg-indigo-600 active:scale-95 transition-all"
                    >
                      {res.type === 'video' ? 'Watch Now' : 'View File'}
                      <ChevronRight size={14} />
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="col-span-full py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto">
              <Search className="text-gray-400" size={32} />
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-bold">No resources found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
