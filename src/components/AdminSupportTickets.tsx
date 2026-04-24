import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { channelService, Channel } from '../services/channelService';
import { MessageSquare, LayoutTemplate, Trash2 } from 'lucide-react';
import ChatRoom from './ChatRoom';

export default function AdminSupportTickets({ user, userData }: { user: any, userData: any }) {
  const [tickets, setTickets] = useState<Channel[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'channels_config'), where('isSupportTicket', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      const ts: Channel[] = [];
      snap.forEach(doc => {
        ts.push({ id: doc.id, ...doc.data() } as Channel);
      });
      setTickets(ts);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (e: React.MouseEvent, ticketId: string) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to resolve and delete this support ticket? This will remove all messages within it.")) {
      try {
        await channelService.deleteChannel(ticketId);
        if (activeTicketId === ticketId) setActiveTicketId(null);
      } catch (err) {
        console.error("Failed to delete ticket", err);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-[var(--primary)] flex items-center gap-2">
          <MessageSquare size={20} /> Open Support Tickets
        </h3>
        <span className="bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
           {tickets.length} Active Tickets
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        <div className="md:col-span-1 space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
           {tickets.length === 0 ? (
             <div className="text-center p-8 bg-white/5 border border-white/5 rounded-2xl text-white/40">
                No active support tickets.
             </div>
           ) : (
             tickets.map(ticket => (
               <div key={ticket.id} className="relative group">
                 <button
                   onClick={() => setActiveTicketId(ticket.id)}
                   className={`w-full text-left p-4 rounded-2xl border transition-all ${activeTicketId === ticket.id ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'}`}
                 >
                   <div className="font-bold pr-8">{ticket.name}</div>
                   <div className="text-xs opacity-60 truncate pr-8">{ticket.description}</div>
                 </button>
                 <button 
                   onClick={(e) => handleDelete(e, ticket.id)}
                   className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                 >
                   <Trash2 size={16} />
                 </button>
               </div>
             ))
           )}
        </div>
        
        <div className="md:col-span-2 h-[600px] bg-[#1a1c23] border border-white/5 rounded-3xl overflow-hidden relative">
           {activeTicketId ? (
              <ChatRoom 
                channelId={activeTicketId}
                user={user}
                userData={userData}
                allUsers={[]}
                onProfileClick={() => {}}
              />
           ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30 pointer-events-none">
                 <LayoutTemplate size={48} className="mb-4" />
                 <p className="font-bold">Select a ticket to begin chatting</p>
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
