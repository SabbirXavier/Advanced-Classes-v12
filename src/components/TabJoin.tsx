import React, { useState, useEffect } from 'react';
import { MessageCircle, Instagram, Facebook, Youtube, Twitter, Send, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';

export default function TabJoin() {
  const [socialLinks, setSocialLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = firestoreService.listenToCollection('socialLinks', (data) => {
      setSocialLinks(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'whatsapp': return <MessageCircle size={24} className="text-green-500" />;
      case 'instagram': return <Instagram size={24} className="text-pink-500" />;
      case 'facebook': return <Facebook size={24} className="text-blue-600" />;
      case 'youtube': return <Youtube size={24} className="text-red-600" />;
      case 'twitter': return <Twitter size={24} className="text-blue-400" />;
      case 'telegram': return <Send size={24} className="text-blue-500" />;
      default: return <LinkIcon size={24} className="text-gray-400" />;
    }
  };

  if (loading) return <div className="text-center p-10 opacity-50 font-bold">Loading Links...</div>;

  return (
    <div className="space-y-6">
      <div className="glass-card text-center py-8">
        <h2 className="text-2xl font-bold text-[var(--primary)] uppercase tracking-wide mb-2">Connect With Us</h2>
        <p className="text-sm opacity-70 max-w-xs mx-auto">Join our community across all platforms for updates, resources, and support.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {socialLinks.map((link) => (
          <a 
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="glass-card flex items-center justify-between p-5 group hover:scale-[1.02] hover:shadow-xl transition-all duration-300 border border-white/10 hover:border-[var(--primary)]/30"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                {getIcon(link.icon)}
              </div>
              <div>
                <h3 className="font-bold text-lg">{link.title}</h3>
                <p className="text-xs opacity-50 truncate max-w-[150px]">{link.url}</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--primary)]/10 text-[var(--primary)]">
              <ExternalLink size={18} />
            </div>
          </a>
        ))}
      </div>

      {socialLinks.length === 0 && (
        <div className="text-center p-12 glass-card opacity-50">
          <p className="italic">No social links added yet.</p>
        </div>
      )}
    </div>
  );
}
