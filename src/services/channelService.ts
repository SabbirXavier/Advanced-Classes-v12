import { collection, doc, getDocs, setDoc, onSnapshot, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface ChannelPermissions {
  roles: {
    everyone: { view: boolean; send: boolean; delete: boolean };
    [role: string]: { view: boolean; send: boolean; delete: boolean };
  };
  users: {
    [userId: string]: { view?: boolean; send?: boolean; delete?: boolean };
  };
}

export interface Channel {
  id: string;
  name: string;
  iconName: string;
  description: string;
  permissions: ChannelPermissions;
  order: number;
  isSupportTicket?: boolean;
  ticketOwnerId?: string;
  ticketStatus?: 'open' | 'solved' | 'closed';
  autoDeleteAt?: number;
  closedAt?: number;
  closedBy?: string;
}

const defaultPermissions: ChannelPermissions = {
  roles: {
    everyone: { view: true, send: true, delete: false }
  },
  users: {}
};

export const channelService = {
  listenToChannels(callback: (channels: Channel[]) => void) {
    const q = collection(db, 'channels_config');
    return onSnapshot(q, (snapshot) => {
      const channels: Channel[] = [];
      snapshot.forEach(doc => {
        channels.push({ id: doc.id, ...doc.data() } as Channel);
      });
      callback(channels.sort((a, b) => a.order - b.order));
    }, (error) => {
      console.error("Error listening to channels:", error);
    });
  },

  async seedDefaultChannels() {
    try {
      const defaults: Channel[] = [
        { id: 'general', name: 'General', iconName: 'MessageSquare', description: 'General discussion', order: 0, permissions: defaultPermissions },
        { id: 'resources', name: 'Resources', iconName: 'BookOpen', description: 'Study resources', order: 1, permissions: { roles: { everyone: { view: true, send: false, delete: false } }, users: {} } },
        { id: 'announcements', name: 'Announcements', iconName: 'Bell', description: 'Important announcements', order: 2, permissions: { roles: { everyone: { view: true, send: false, delete: false } }, users: {} } },
        { id: 'help', name: 'Help', iconName: 'HelpCircle', description: 'Get help', order: 3, permissions: defaultPermissions },
      ];

      for (const ch of defaults) {
        const chRef = doc(db, 'channels_config', ch.id);
        const chSnap = await getDoc(chRef);
        if (!chSnap.exists()) {
          await setDoc(chRef, ch);
          console.log(`Seeded default channel: ${ch.id}`);
        }
      }
    } catch (error) {
      console.error("Error seeding default channels:", error);
    }
  },

  async updateChannel(channelId: string, data: Partial<Channel>) {
    try {
      await updateDoc(doc(db, 'channels_config', channelId), data);
    } catch (error) {
      console.error("Error updating channel:", error);
      throw error;
    }
  },

  async updateChannelPermissions(channelId: string, permissions: ChannelPermissions) {
    return this.updateChannel(channelId, { permissions });
  },

  async addChannel(channel: Omit<Channel, 'id'>) {
    try {
      const newDoc = doc(collection(db, 'channels_config'));
      await setDoc(newDoc, { ...channel, id: newDoc.id });
    } catch (error) {
      console.error("Error adding channel:", error);
      throw error;
    }
  },

  async deleteChannel(channelId: string) {
    try {
      await deleteDoc(doc(db, 'channels_config', channelId));
    } catch (error) {
      console.error("Error deleting channel:", error);
      throw error;
    }
  },

  async closeSupportTicket(channelId: string, closedBy: string) {
    try {
      const autoDeleteAt = Date.now() + 10000;
      await updateDoc(doc(db, 'channels_config', channelId), {
        ticketStatus: 'solved',
        autoDeleteAt,
        closedAt: Date.now(),
        closedBy
      });

      setTimeout(async () => {
        try {
          await this.deleteChannel(channelId);
        } catch (error) {
          console.error("Error auto-deleting closed support ticket:", error);
        }
      }, 10000);
    } catch (error) {
      console.error("Error closing support ticket:", error);
      throw error;
    }
  }
};

export function hasPermission(
  channel: Channel | null,
  user: any,
  userData: any,
  action: 'view' | 'send' | 'delete'
): boolean {
  if (!channel) return false;

  // If no user, only check 'everyone' role
  if (!user) {
    const everyonePerms = channel.permissions?.roles?.everyone;
    if (everyonePerms && everyonePerms[action] !== undefined) {
      return everyonePerms[action]!;
    }
    return false;
  }

  const role = userData?.role || 'student';
  
  // Admins and moderators always have full access
  if (role === 'admin' || role === 'moderator') return true;

  // 1. Check user-specific overrides
  const userPerms = channel.permissions?.users?.[user.uid];
  if (userPerms && userPerms[action] !== undefined) {
    return userPerms[action]!;
  }

  // 2. Check role-specific overrides
  const rolePerms = channel.permissions?.roles?.[role];
  if (rolePerms && rolePerms[action] !== undefined) {
    return rolePerms[action]!;
  }

  // 3. Fallback to 'everyone' role
  const everyonePerms = channel.permissions?.roles?.everyone;
  if (everyonePerms && everyonePerms[action] !== undefined) {
    return everyonePerms[action]!;
  }

  // Default deny if no permissions found
  return false;
}
