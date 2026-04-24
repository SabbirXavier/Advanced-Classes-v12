import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronDown, User, Mail, Check } from 'lucide-react';

interface User {
  id: string;
  name?: string;
  email?: string;
  role?: string;
}

interface SearchableUserDropdownProps {
  users: User[];
  onSelect: (userId: string) => void;
  placeholder?: string;
  excludeUserIds?: string[];
}

export default function SearchableUserDropdown({ 
  users, 
  onSelect, 
  placeholder = "Select a user...",
  excludeUserIds = []
}: SearchableUserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredUsers = users.filter(u => {
    const isExcluded = excludeUserIds.includes(u.id);
    const matchesSearch = 
      (u.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    return !isExcluded && matchesSearch;
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all text-left outline-none focus:border-[var(--primary)]/50"
      >
        <span className="truncate opacity-70 italic">{placeholder}</span>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full left-0 right-0 z-[2000] bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
          >
            <div className="p-3 border-b border-white/5 relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
              <input
                autoFocus
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-xl text-xs outline-none focus:border-[var(--primary)]/30 transition-all"
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
              {filteredUsers.length > 0 ? (
                <div className="space-y-1">
                  {filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        onSelect(u.id);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all text-left group"
                    >
                      <div className="w-8 h-8 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                        <User size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{u.name || 'Anonymous'}</div>
                        <div className="text-[10px] opacity-40 truncate">{u.email}</div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Check size={14} className="text-[var(--primary)]" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2 opacity-20">
                    <Search size={20} />
                  </div>
                  <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest">No users found</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
