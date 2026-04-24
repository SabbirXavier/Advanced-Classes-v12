import React, { useEffect, useState } from 'react';
import ChatRoom from './ChatRoom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { channelService, Channel } from '../services/channelService';

export default function SupportChatView({ user, userData, onBack }: { user: any, userData: any, onBack: () => void }) {
  const [activeTicket, setActiveTicket] = useState<string | null>(localStorage.getItem('activeSupportTicket'));
  const [ticketDetails, setTicketDetails] = useState<Channel | null>(null);

  useEffect(() => {
    if (!activeTicket) return;
    const unsub = channelService.listenToChannels((channels) => {
      const ticket = channels.find(c => c.id === activeTicket);
      if (ticket) {
        setTicketDetails(ticket);
      } else {
        // Ticket resolved/deleted
        setTicketDetails(null);
        localStorage.removeItem('activeSupportTicket');
        setActiveTicket(null);
      }
    });
    return () => unsub();
  }, [activeTicket]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#111] text-white flex flex-col">
      <header className="flex items-center gap-4 p-4 border-b border-white/5 bg-[#16181d]">
        <button 
          onClick={() => {
            onBack();
          }}
          className="p-2 hover:bg-white/5 rounded-full transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="font-bold">{ticketDetails?.name || 'Support Ticket'}</h2>
          <p className="text-xs text-white/50">{ticketDetails?.description || 'Your direct line to admins'}</p>
        </div>
      </header>

      <div className="flex-1 overflow-hidden relative">
        {activeTicket ? (
           <ChatRoom 
             channelId={activeTicket}
             user={user}
             userData={userData}
             allUsers={[]}
             onProfileClick={() => {}}
           />
        ) : (
          <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
            <p>No active ticket to display.</p>
            <p className="text-sm">If you had an open ticket, it might have been resolved by the admins.</p>
          </div>
        )}
      </div>
    </div>
  );
}
