import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp, 
  updateDoc, 
  deleteDoc, 
  Timestamp, 
  startAfter, 
  QueryConstraint 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError } from './firestoreService';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  senderRole: string;
  channelId: string;
  type: 'text' | 'image' | 'file' | 'system';
  mediaUrl?: string;
  mediaMetadata?: {
    name: string;
    size: number;
    mimeType: string;
  };
  isEdited?: boolean;
  isDeleted?: boolean;
  replyToId?: string;
  replyPreview?: {
    senderName: string;
    content: string;
  };
  deliveryState: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  reactions?: { [emoji: string]: string[] }; // emoji -> list of userIds
  isMarked?: boolean;
  createdAt: any;
  updatedAt?: any;
}

export interface TypingIndicator {
  userId: string;
  userName: string;
  lastTypedAt: any;
}

export interface SendMessageParams {
  channelId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  content: string;
  type?: Message['type'];
  mediaUrl?: string;
  mediaMetadata?: Message['mediaMetadata'];
  replyToId?: string;
  replyPreview?: Message['replyPreview'];
}

export const chatService = {
  async sendMessage(params: SendMessageParams): Promise<string> {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const messageData: Partial<Message> = {
      content: params.content,
      senderId: params.senderId,
      senderName: params.senderName,
      senderPhoto: params.senderPhoto || '',
      senderRole: 'student', // Default, should be fetched from user profile
      channelId: params.channelId,
      type: params.type || 'text',
      isEdited: false,
      isDeleted: false,
      deliveryState: 'sent',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (params.mediaUrl !== undefined) messageData.mediaUrl = params.mediaUrl;
    if (params.mediaMetadata !== undefined) messageData.mediaMetadata = params.mediaMetadata;
    if (params.replyToId !== undefined) messageData.replyToId = params.replyToId;
    if (params.replyPreview !== undefined) messageData.replyPreview = params.replyPreview;

    const docRef = await addDoc(collection(db, 'channels', params.channelId, 'messages'), messageData);
    return docRef.id;
  },

  listenToMessages(
    channelId: string, 
    callback: (messages: Message[]) => void,
    limitCount: number = 50
  ) {
    if (!channelId) return () => {};
    
    const messagesRef = collection(db, 'channels', channelId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(limitCount));

    return onSnapshot(q, (snapshot) => {
      const messages: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({ 
          id: doc.id, 
          ...data,
          createdAt: data.createdAt?.toMillis() || Date.now() 
        } as Message);
      });
      callback(messages.reverse());
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `channels/${channelId}/messages`);
    });
  },

  async editMessage(messageId: string, newContent: string, channelId: string = 'general') {
    // Note: In a real app, we'd need the full path. For now assuming messages are in a specific channel
    // or we store the channelId in the message doc.
    const messageRef = doc(db, 'channels', channelId, 'messages', messageId);
    await updateDoc(messageRef, {
      content: newContent,
      isEdited: true,
      updatedAt: serverTimestamp()
    });
  },

  async deleteMessage(messageId: string, channelId: string = 'general') {
    const messageRef = doc(db, 'channels', channelId, 'messages', messageId);
    await updateDoc(messageRef, {
      isDeleted: true,
      content: 'Message deleted',
      updatedAt: serverTimestamp()
    });
  },

  async setTyping(channelId: string, userId: string, isTyping: boolean) {
    if (!auth.currentUser) return;
    const typingRef = doc(db, 'channels', channelId, 'typing', userId);
    
    if (isTyping) {
      await setDoc(typingRef, {
        userId: userId,
        userName: auth.currentUser.displayName || 'Anonymous',
        lastTypedAt: serverTimestamp()
      });
    } else {
      await deleteDoc(typingRef);
    }
  },

  listenToTyping(channelId: string, callback: (typingUsers: {id: string, name: string}[]) => void) {
    const typingRef = collection(db, 'channels', channelId, 'typing');
    return onSnapshot(typingRef, (snapshot) => {
      const typingUsers: {id: string, name: string}[] = [];
      snapshot.forEach((doc) => {
        typingUsers.push({ id: doc.id, name: doc.data().userName || 'Someone' });
      });
      callback(typingUsers);
    }, (error) => {
      console.error(`Error listening to typing in ${channelId}:`, error);
    });
  },

  async toggleReaction(channelId: string, messageId: string, emoji: string) {
    if (!auth.currentUser) return;
    const messageRef = doc(db, 'channels', channelId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);
    if (messageSnap.exists()) {
      const data = messageSnap.data() as Message;
      const reactions = data.reactions || {};
      const userIds = reactions[emoji] || [];
      const index = userIds.indexOf(auth.currentUser.uid);
      
      if (index === -1) {
        userIds.push(auth.currentUser.uid);
      } else {
        userIds.splice(index, 1);
      }
      
      if (userIds.length > 0) {
        reactions[emoji] = userIds;
      } else {
        delete reactions[emoji];
      }
      
      await updateDoc(messageRef, { reactions });
    }
  },

  async toggleMarked(channelId: string, messageId: string) {
    const messageRef = doc(db, 'channels', channelId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);
    if (messageSnap.exists()) {
      const isMarked = (messageSnap.data() as any).isMarked || false;
      await updateDoc(messageRef, { isMarked: !isMarked });
    }
  },

  async muteUser(uid: string, durationMinutes?: number) {
    const userRef = doc(db, 'users', uid);
    const muteUntil = durationMinutes ? new Date(Date.now() + durationMinutes * 60000) : null;
    await updateDoc(userRef, {
      isMuted: true,
      muteUntil: muteUntil ? Timestamp.fromDate(muteUntil) : null
    });
  },

  async unmuteUser(uid: string) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      isMuted: false,
      muteUntil: null,
      cooldownUntil: null
    });
  },

  async setCooldown(uid: string, durationSeconds: number) {
    const userRef = doc(db, 'users', uid);
    const cooldownUntil = new Date(Date.now() + durationSeconds * 1000);
    await updateDoc(userRef, {
      cooldownUntil: Timestamp.fromDate(cooldownUntil)
    });
  },

  async updateChannel(channelId: string, updates: any) {
    const channelRef = doc(db, 'channels_config', channelId);
    await updateDoc(channelRef, updates);
  },

  async deleteMessagesByRange(channelId: string, startDate: Date, endDate: Date) {
    const messagesRef = collection(db, 'channels', channelId, 'messages');
    const q = query(
      messagesRef, 
      where('createdAt', '>=', Timestamp.fromDate(startDate)),
      where('createdAt', '<=', Timestamp.fromDate(endDate))
    );
    const snapshot = await getDocs(q);
    
    // Process in batches (Firestore limit 500 per batch but let's just do sequential for simplicity in this volume)
    const promises = snapshot.docs.map(docSnap => 
      updateDoc(docSnap.ref, { isDeleted: true, content: 'Message removed by moderator', updatedAt: serverTimestamp() })
    );
    await Promise.all(promises);
  }
};
