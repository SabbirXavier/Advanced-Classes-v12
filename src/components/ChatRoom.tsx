import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, 
  Image as ImageIcon, 
  Smile, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Reply, 
  X, 
  User, 
  Hash,
  AtSign,
  Copy,
  Play,
  Sigma,
  Clock,
  Check,
  CheckCheck,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  MessageSquare,
  Search,
  Shield,
  ShieldAlert,
  MicOff,
  File,
  Download,
  Maximize,
  Star,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatInTimeZone } from 'date-fns-tz';
import { authService, UserProfile } from '../services/authService';
import { chatService, Message } from '../services/chatService';
import { storageService } from '../services/storageService';
import { compressImage, urlToBase64 } from '../lib/imageUtils';
import { channelService, Channel, hasPermission } from '../services/channelService';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import MarkdownRenderer from './MarkdownRenderer';
import { AvatarWithGifHandling } from './AvatarWithGifHandling';
import toast from 'react-hot-toast';
import { aiService } from '../services/aiService';

interface ChatRoomProps {
  channelId: string;
  user: any;
  userData: UserProfile | null;
  allUsers: UserProfile[];
  onProfileClick?: (userId: string) => void;
  background?: string;
  isSearchOpen?: boolean;
  setIsSearchOpen?: (open: boolean) => void;
}

export default function ChatRoom({ channelId, user, userData, allUsers, onProfileClick, background = 'default', isSearchOpen, setIsSearchOpen }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<{id: string, name: string}[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [mediaProcessState, setMediaProcessState] = useState<'idle' | 'compressing' | 'uploading' | 'done'>('idle');
  const [selectedMedia, setSelectedMedia] = useState<{ url: string, fileType: string, fileSize: number, name: string } | null>(null);
  const [uploadTaskObj, setUploadTaskObj] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchMatches, setSearchMatches] = useState<string[]>([]); // IDs of matching messages
  const [fullScreenMedia, setFullScreenMedia] = useState<{url: string, type: string, name: string} | null>(null);
  const [showFormulaHelper, setShowFormulaHelper] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const formulaHelperRef = useRef<HTMLDivElement>(null);

  const mathSymbols = [
    { label: 'Theta', symbol: 'θ' }, { label: 'Pi', symbol: 'π' }, { label: 'Delta', symbol: 'Δ' },
    { label: 'Sigma', symbol: 'Σ' }, { label: 'Alpha', symbol: 'α' }, { label: 'Beta', symbol: 'β' },
    { label: 'Gamma', symbol: 'γ' }, { label: 'Infinity', symbol: '∞' }, { label: 'Root', symbol: '√' },
    { label: 'Integral', symbol: '∫' }, { label: 'Divide', symbol: '÷' }, { label: 'Times', symbol: '×' },
    { label: 'PlusMinus', symbol: '±' }, { label: 'NotEqual', symbol: '≠' }, { label: 'Lambda', symbol: 'λ' },
    { label: 'Omega', symbol: 'ω' }, { label: 'Mu', symbol: 'μ' }, { label: 'Rho', symbol: 'ρ' }
  ];
  const [messageLimit, setMessageLimit] = useState(50);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showScrollLatest, setShowScrollLatest] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLatexHelper, setShowLatexHelper] = useState(false);
  const [latexPreview, setLatexPreview] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showAiMentions, setShowAiMentions] = useState(false);
  const [aiMentionFilter, setAiMentionFilter] = useState('');
  const [aiMentionIndex, setAiMentionIndex] = useState(0);
  const [reactionMessageId, setReactionMessageId] = useState<string | null>(null);

  const availableAIs = [
    { id: 'ai', name: 'AI Tutor', company: 'Gemini' }
  ];
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [activeMessageMenu, setActiveMessageMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top?: number, bottom?: number, right: number }>({ right: 0 });
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [bottomPadding, setBottomPadding] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const prevScrollHeightRef = useRef<number>(0);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiToggleButtonRef = useRef<HTMLButtonElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);

  const downloadMedia = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      toast.error('Failed to download file');
    }
  };

  // Channel listener
  useEffect(() => {
    const channelRef = doc(db, 'channels_config', channelId);
    const unsubscribe = onSnapshot(channelRef, (docSnap) => {
      if (docSnap.exists()) {
        setChannel({ id: docSnap.id, ...docSnap.data() } as Channel);
      }
    });
    return () => unsubscribe();
  }, [channelId]);

  // Message listener
  useEffect(() => {
    if (!user) return;

    const unsubscribe = chatService.listenToMessages(channelId, (newMessages) => {
      setIsLoadingMessages(false);
      setMessages(prev => {
        // Determine if we are loading older messages based on the isLoadingMore flag
        const loadingOlder = isLoadingMore;
        
        setTimeout(() => {
          if (scrollRef.current) {
            if (loadingOlder) {
              const newScrollHeight = scrollRef.current.scrollHeight;
              const heightDifference = newScrollHeight - prevScrollHeightRef.current;
              scrollRef.current.scrollTop += heightDifference;
            } else {
              const isNearBottom = scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 300;
              const isInitialLoad = prev.length === 0;
              const isMyMessage = newMessages.length > 0 && newMessages[newMessages.length - 1]?.senderId === user.uid;
              
              if (isInitialLoad || isNearBottom || isMyMessage) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }
            prevScrollHeightRef.current = scrollRef.current.scrollHeight;
            setIsLoadingMore(false);
          }
        }, 50);
        
        return newMessages;
      });
    }, messageLimit);

    return () => unsubscribe();
  }, [channelId, user, messageLimit]);

  // Typing indicator listener
  useEffect(() => {
    if (!user) return;
    const unsubscribe = chatService.listenToTyping(channelId, (users) => {
      setTypingUsers(users.filter(u => u.id !== user.uid));
    });
    return () => unsubscribe();
  }, [channelId, user]);

  // Cooldown timer logic
  useEffect(() => {
    if (!userData?.cooldownUntil) {
      setCooldownRemaining(0);
      return;
    }

    const interval = setInterval(() => {
      const cooldownTime = userData.cooldownUntil.seconds ? userData.cooldownUntil.seconds * 1000 : userData.cooldownUntil.toMillis();
      const remaining = Math.max(0, Math.floor((cooldownTime - Date.now()) / 1000));
      setCooldownRemaining(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [userData?.cooldownUntil]);

  const isMuted = useMemo(() => {
    if (!userData) return false;
    if (userData.isMuted) {
      if (!userData.muteUntil) return true; // Permanent mute
      const muteTime = userData.muteUntil.seconds ? userData.muteUntil.seconds * 1000 : userData.muteUntil.toMillis();
      return muteTime > Date.now();
    }
    return false;
  }, [userData]);

  // Handle mobile keyboard and viewport
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleResize = () => {
      const vv = window.visualViewport;
      if (!vv) return;

      // Calculate how much the viewport has shrunk (usually due to keyboard)
      const diff = window.innerHeight - vv.height;
      setBottomPadding(diff > 100 ? diff : 0);
      
      if (diff > 100) {
        setTimeout(scrollToBottom, 100);
      }
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Reset limit when changing channels
  useEffect(() => {
    setMessageLimit(50);
    setIsLoadingMessages(true);
  }, [channelId]);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      if (scrollTop < 50 && !isLoadingMore && messages.length >= messageLimit) {
        setIsLoadingMore(true);
        prevScrollHeightRef.current = scrollHeight;
        setMessageLimit(prev => prev + 50);
      }
      setShowScrollLatest(scrollHeight - scrollTop - clientHeight > 300);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hasPermission(channel, user, userData, 'send')) return;
    if (!inputText.trim() && !selectedMedia) return;
    if (mediaProcessState === 'uploading' || mediaProcessState === 'compressing') return;
    if (!user) return;

    const text = inputText.trim();
    const isTaggingAi = text.toLowerCase().includes('@ai');
    const isReplyingToAi = replyTo?.senderId === 'ai-tutor';
    const isAiQuestion = isTaggingAi || isReplyingToAi;
    
    setInputText('');
    setReplyTo(null);
    setEditingMessage(null);
    setShowFormulaHelper(false);
    
    const mediaToAttach = selectedMedia;
    setSelectedMedia(null);
    setMediaProcessState('idle');

    try {
      if (editingMessage) {
        await chatService.editMessage(editingMessage.id, text, channelId);
      } else {
        await chatService.sendMessage({
          channelId,
          senderId: user.uid,
          senderName: userData?.name || user.displayName || 'Anonymous',
          senderPhoto: userData?.photoUrl || user.photoURL || '',
          content: text,
          type: mediaToAttach ? (mediaToAttach.fileType.startsWith('image/') ? 'image' : 'file') : 'text',
          mediaUrl: mediaToAttach?.url,
          mediaMetadata: mediaToAttach ? { name: mediaToAttach.name, size: mediaToAttach.fileSize, mimeType: mediaToAttach.fileType } : undefined,
          replyToId: replyTo?.id,
          replyPreview: replyTo ? {
            senderName: replyTo.senderName,
            content: replyTo.content
          } : undefined
        });

        // AI Logic
        if (isAiQuestion) {
          setIsAiThinking(true);
          let aiPrompt = text;
          
          // Clean up the @ai tag from the prompt sent to the LLM
          aiPrompt = aiPrompt.replace(/@ai/gi, '').trim();

          // Add reply context if applicable
          if (isReplyingToAi && replyTo) {
            aiPrompt = `[Replying to: "${replyTo.content}"]\n\nStudent asks: ${aiPrompt || 'Please explain more about this.'}`;
          }

          // Handle images in context
          const imageParts = [];
          if (replyTo?.type === 'image' && replyTo.mediaUrl) {
            const b64 = await urlToBase64(replyTo.mediaUrl);
            if (b64) imageParts.push({ inlineData: b64 });
          }

          const answer = await aiService.askStudentTutor(aiPrompt, imageParts);
          
          await chatService.sendMessage({
            channelId,
            senderId: 'ai-tutor',
            senderName: 'Advanced AI Tutor',
            senderPhoto: 'https://cdn-icons-png.flaticon.com/512/4712/4712010.png',
            content: answer,
            type: 'text',
            replyToId: isReplyingToAi ? undefined : undefined // We could link it back, but let's keep it clean
          });
          setIsAiThinking(false);
        }
      }
    } catch (err) {
      console.error('Failed to send message', err);
      setIsAiThinking(false);
    }
  };

  const insertSymbol = (symbol: string) => {
    if (!inputRef.current) return;
    const cursorPosition = inputRef.current.selectionStart;
    const newText = inputText.slice(0, cursorPosition) + symbol + inputText.slice(cursorPosition);
    setInputText(newText);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = cursorPosition + symbol.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleTyping = () => {
    if (!user) return;
    chatService.setTyping(channelId, user.uid, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      chatService.setTyping(channelId, user.uid, false);
    }, 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input value so selecting the same file again triggers change
    e.target.value = '';
    
    if (!file || !user) return;

    // Check file size (30MB limit as requested)
    const MAX_SIZE = 30 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error('File too large (Max 30MB)');
      return;
    }

    try {
      setMediaProcessState('compressing');
      
      // Compress if it's an image (utility handles non-GIFs locally to save server resources)
      let fileToUpload = file;
      if (file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file);
      }
      
      setMediaProcessState('uploading');
      setUploadProgress(0);

      const uploadResult = storageService.uploadFile(fileToUpload, (progress) => {
        setUploadProgress(progress);
      });
      
      setUploadTaskObj(uploadResult.task);

      const media = await uploadResult.promise;

      setSelectedMedia({
        url: media.url,
        fileType: media.fileType,
        fileSize: media.fileSize,
        name: file.name
      });
      
      setMediaProcessState('done');
      setUploadProgress(null);
      setUploadTaskObj(null);
    } catch (err: any) {
      if (err.message === 'Upload cancelled by user' || err.message === 'Upload cancelled') {
        toast.error('Upload cancelled');
      } else {
        console.error('Upload failed', err);
        toast.error('Failed to prepare media.');
      }
      setMediaProcessState('idle');
      setUploadProgress(null);
      setUploadTaskObj(null);
    }
  };

  const handleCancelUpload = () => {
    if (uploadTaskObj) {
      uploadTaskObj.cancel();
    }
    setMediaProcessState('idle');
    setUploadProgress(null);
    setSelectedMedia(null);
    setUploadTaskObj(null);
  };

  const handleEmojiClick = (emojiData: any) => {
    if (!inputRef.current) return;
    const cursorPosition = inputRef.current.selectionStart;
    const newText = inputText.slice(0, cursorPosition) + emojiData.emoji + inputText.slice(cursorPosition);
    setInputText(newText);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = cursorPosition + emojiData.emoji.length;
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);
    handleTyping();
    setLatexPreview(value.includes('$') ? value : '');

    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.slice(0, cursorPosition);
    
    const userMatch = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_ .]*)$/);
    const aiMatch = textBeforeCursor.match(/(?:^|\s)\/([a-zA-Z0-9_]*)$/);

    if (userMatch) {
      setShowMentions(true);
      setMentionFilter(userMatch[1].toLowerCase());
      setMentionIndex(0);
      setShowAiMentions(false);
    } else if (aiMatch) {
      setShowAiMentions(true);
      setAiMentionFilter(aiMatch[1].toLowerCase());
      setAiMentionIndex(0);
      setShowMentions(false);
    } else {
      setShowMentions(false);
      setShowAiMentions(false);
    }
  };

  const handleMentionSelect = (userName: string) => {
    if (!inputRef.current) return;
    const cursorPosition = inputRef.current.selectionStart;
    const textBeforeCursor = inputText.slice(0, cursorPosition);
    const newTextBeforeCursor = textBeforeCursor.replace(/(^|\s)@[a-zA-Z0-9_ .]*$/, `$1@${userName} `);
    setInputText(newTextBeforeCursor + inputText.slice(cursorPosition));
    setShowMentions(false);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newTextBeforeCursor.length, newTextBeforeCursor.length);
      }
    }, 0);
  };

  const handleAiMentionSelect = (aiId: string) => {
    if (!inputRef.current) return;
    const cursorPosition = inputRef.current.selectionStart;
    const textBeforeCursor = inputText.slice(0, cursorPosition);
    // Replace the '/' with '@aiId ' so the backend picks it up easily
    const newTextBeforeCursor = textBeforeCursor.replace(/(^|\s)\/[a-zA-Z0-9_]*$/, `$1@${aiId} `);
    setInputText(newTextBeforeCursor + inputText.slice(cursorPosition));
    setShowAiMentions(false);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newTextBeforeCursor.length, newTextBeforeCursor.length);
      }
    }, 0);
  };

  const filteredMentionUsers = useMemo(() => {
    return allUsers.filter(u => (u.name || '').toLowerCase().includes(mentionFilter));
  }, [allUsers, mentionFilter]);

  const filteredAIs = useMemo(() => {
    return availableAIs.filter(ai => 
      ai.name.toLowerCase().includes(aiMentionFilter) || 
      ai.company.toLowerCase().includes(aiMentionFilter)
    );
  }, [aiMentionFilter]);

  const filteredMessages = useMemo(() => {
    const activeMessages = messages.filter(m => !m.isDeleted && m.content !== 'Message deleted');
    return activeMessages;
  }, [messages]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return filteredMessages.filter(m => 
      (m.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.senderName || '').toLowerCase().includes(searchQuery.toLowerCase())
    ).map(m => m.id);
  }, [filteredMessages, searchQuery]);

  useEffect(() => {
    setSearchMatches(searchResults);
    setSearchIndex(searchResults.length > 0 ? searchResults.length - 1 : 0);
  }, [searchResults]);

  const scrollToMessage = (msgId: string) => {
    const element = document.getElementById(`msg-${msgId}`);
    if (element && scrollRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a temporary highlight
      element.classList.add('bg-[var(--primary)]/20');
      setTimeout(() => element.classList.remove('bg-[var(--primary)]/20'), 2000);
    }
  };

  const handleSearchNext = () => {
    if (searchMatches.length === 0) return;
    const nextIndex = (searchIndex + 1) % searchMatches.length;
    setSearchIndex(nextIndex);
    scrollToMessage(searchMatches[nextIndex]);
  };

  const handleSearchPrev = () => {
    if (searchMatches.length === 0) return;
    const prevIndex = (searchIndex - 1 + searchMatches.length) % searchMatches.length;
    setSearchIndex(prevIndex);
    scrollToMessage(searchMatches[prevIndex]);
  };

  const handleMenuClick = (e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeMessageMenu === msgId) {
      setActiveMessageMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const menuWidth = 192; // w-48 = 12rem = 192px
    const menuHeight = 160; // Estimated height

    let top: number | undefined = rect.bottom + 5;
    let bottom: number | undefined = undefined;
    let right: number = windowWidth - rect.right;

    // Vertical adjustment
    if (rect.bottom > windowHeight - 200) {
      top = undefined;
      bottom = windowHeight - rect.top + 5;
    }

    // Horizontal adjustment (ensure it doesn't go off left side)
    if (windowWidth - right < menuWidth) {
      right = windowWidth - menuWidth - 10;
    }
    // Ensure it doesn't go off right side
    if (right < 10) {
      right = 10;
    }

    setMenuPosition({ top, bottom, right });
    setActiveMessageMenu(msgId);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Close active message ID if clicking outside any message container
      if (!target.closest('.message-container')) {
        setActiveMessageId(null);
      }
      
      setActiveMessageMenu(null);
      
      if (
        showEmojiPicker && 
        emojiPickerRef.current && 
        !emojiPickerRef.current.contains(target) &&
        emojiToggleButtonRef.current &&
        !emojiToggleButtonRef.current.contains(target)
      ) {
        setShowEmojiPicker(false);
      }
      
      setShowMentions(false);
      setShowAiMentions(false);
      setShowLatexHelper(false);
      setShowFormulaHelper(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [showEmojiPicker]);

  const renderMessageContent = (content: string, isMeMsg: boolean = false) => {
    if (!content) return null;
    let processedContent = content;
    processedContent = processedContent.replace(/^-# (.*)$/gm, '<span class="text-xs opacity-70">$1</span>');
    processedContent = processedContent.replace(/__([^_]+)__/g, '<u>$1</u>');
    processedContent = processedContent.replace(/^>>> ([\s\S]*)/gm, '> $1');

    const sortedNames = [...allUsers].map(u => u.name).filter(Boolean).sort((a, b) => b.length - a.length);
    if (sortedNames.length > 0) {
      const escapedNames = sortedNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const mentionRegex = new RegExp(`@(${escapedNames.join('|')})`, 'gi');
      processedContent = processedContent.replace(mentionRegex, (match, name) => {
        const isMentionMe = name.toLowerCase() === userData?.name?.toLowerCase();
        const className = isMentionMe 
          ? 'bg-yellow-400/30 text-yellow-900 dark:text-yellow-100 font-black' 
          : 'text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer';
        return `<span class="${className}">@${name}</span>`;
      });
    }

    return (
      <div className={`text-[15px] md:text-[16px] leading-[1.4] ${isMeMsg ? 'text-white' : 'text-gray-800 dark:text-gray-200'}`}>
        <MarkdownRenderer content={processedContent} />
      </div>
    );
  };

  return (
    <div 
      className="flex-1 flex flex-col bg-[#f2f3f5] dark:bg-[#313338] relative overflow-hidden h-full"
      style={{ paddingBottom: bottomPadding }}
    >
      {/* Search Bar Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white dark:bg-[#313338] border-b border-gray-200 dark:border-white/5 overflow-hidden z-20"
          >
            <div className="p-2 flex items-center gap-2">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder="Search messages..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full bg-gray-100 dark:bg-[#1e1f22] border border-transparent text-gray-900 dark:text-gray-200 rounded-md py-1.5 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
                {searchQuery && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-50">
                    {searchMatches.length > 0 ? `${searchIndex + 1} of ${searchMatches.length}` : 'No matches'}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={handleSearchPrev} disabled={searchMatches.length === 0} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-md disabled:opacity-30">
                  <ArrowUp size={16} />
                </button>
                <button onClick={handleSearchNext} disabled={searchMatches.length === 0} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-md disabled:opacity-30">
                  <ArrowDown size={16} />
                </button>
                <button onClick={() => { setIsSearchOpen?.(false); setSearchQuery(''); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-md text-red-500">
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 scroll-smooth relative"
        style={{
          backgroundImage: background === 'whatsapp' ? `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` : background.startsWith('custom:') ? `url("${background.split('custom:')[1]}")` : 'none',
          backgroundColor: background === 'whatsapp' ? (document.documentElement.classList.contains('dark') ? '#0b141a' : '#efeae2') : 'transparent',
          backgroundSize: background.startsWith('custom:') ? 'cover' : 'auto',
          backgroundPosition: background.startsWith('custom:') ? 'center' : 'auto',
          backgroundAttachment: background.startsWith('custom:') ? 'fixed' : 'auto'
        }}
      >
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {!isLoadingMore && messages.length > 0 && messages.length < messageLimit && (
          <div className="flex flex-col items-center justify-center py-8 opacity-40">
            <div className="w-10 h-10 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-2">
              <Hash size={20} />
            </div>
            <p className="text-xs font-medium">This is the start of the #{(channel?.name || 'channel').toLowerCase()} history.</p>
          </div>
        )}

        {filteredMessages.length === 0 && !isLoadingMessages && (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 opacity-50">
            <div className="w-16 h-16 bg-gray-200 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
              <MessageSquare size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-bold mb-1">No messages yet</h3>
            <p className="text-sm max-w-xs">Be the first to start the conversation!</p>
          </div>
        )}

        {filteredMessages.map((msg, idx) => {
          const isMe = msg.senderId === user?.uid;
          const isAi = msg.senderId === 'ai-tutor';
          const isAdmin = userData?.role === 'admin' || userData?.role === 'moderator';
          const isMentioned = userData?.name && (
            (msg.content || '').toLowerCase().includes(`@${userData.name.toLowerCase()}`) ||
            msg.replyPreview?.senderName === userData.name
          );
          const isActive = activeMessageId === msg.id;
          
          return (
            <div 
              key={msg.id} 
              id={`msg-${msg.id}`}
              onClick={() => setActiveMessageId(isActive ? null : msg.id)}
              className={`flex w-full gap-2 md:gap-3 group px-2 py-0.5 rounded-xl transition-all duration-200 message-container cursor-pointer ${isMe ? 'flex-row-reverse justify-start' : 'flex-row'} ${isMentioned ? 'bg-indigo-500/10 dark:bg-indigo-500/20 border-l-4 border-indigo-500 shadow-sm' : msg.isMarked ? 'bg-yellow-500/5 dark:bg-yellow-500/10 border-l-4 border-yellow-500' : 'hover:bg-white/40 dark:hover:bg-white/5'} ${isActive ? 'bg-indigo-500/5 dark:bg-white/10' : ''}`}
              onContextMenu={(e) => {
                e.preventDefault();
                handleMenuClick(e, msg.id);
              }}
            >
              <div className="w-8 h-8 md:w-10 md:h-10 flex-shrink-0 mt-1 shadow-sm rounded-full overflow-hidden">
                <AvatarWithGifHandling 
                  src={isMe ? (userData?.photoUrl || user?.photoURL) : (isAi ? 'https://cdn-icons-png.flaticon.com/512/4712/4712010.png' : msg.senderPhoto)} 
                  name={msg.senderName} 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isAi) onProfileClick?.(msg.senderId);
                  }} 
                  className={`w-full h-full object-cover ${isAi ? 'p-1 bg-white dark:bg-white/10' : ''}`}
                />
              </div>
              
              <div className={`flex flex-col min-w-0 max-w-[85%] md:max-w-[70%] relative ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && (
                  <div className="flex items-baseline gap-2 mb-1 px-1">
                    <span className={`font-bold text-[13px] md:text-[14px] ${isAi ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer'}`} onClick={(e) => {
                      e.stopPropagation();
                      if (!isAi) onProfileClick?.(msg.senderId);
                    }}>
                      {msg.senderName}
                      {isAi && <span className="ml-2 text-[10px] bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-md">BOT</span>}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{formatInTimeZone(msg.createdAt, 'Asia/Kolkata', 'HH:mm')}</span>
                  </div>
                )}

                {msg.replyPreview && (
                  <div className={`mb-1 px-3 py-1.5 bg-black/5 dark:bg-white/5 rounded-xl border-l-4 border-indigo-500 text-[11px] max-w-full shadow-inner ${isMe ? 'mr-1' : 'ml-1'}`}>
                    <span className="font-bold block text-indigo-600 dark:text-indigo-400">@{msg.replyPreview.senderName}</span>
                    <span className="truncate block opacity-70 italic">{msg.replyPreview.content}</span>
                  </div>
                )}

                <div className={`relative px-4 py-2 rounded-2xl text-[14px] md:text-[15px] leading-snug shadow-sm transition-all ${
                  isMe 
                    ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-600/20' 
                    : isAi 
                      ? 'bg-purple-50 dark:bg-purple-900/10 text-gray-800 dark:text-gray-100 rounded-tl-none border border-purple-200 dark:border-purple-500/20 shadow-purple-500/5'
                      : 'bg-white dark:bg-[#2b2d31] text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-200 dark:border-white/5 shadow-black/5'
                }`}>
                {msg.mediaUrl ? (
                  <div className="space-y-2 overflow-x-auto custom-scrollbar-horizontal flex flex-col">
                    {msg.mediaMetadata?.mimeType?.startsWith('video/') ? (
                      <video src={msg.mediaUrl} controls className="max-w-[280px] md:max-w-sm rounded-xl shadow-md border border-black/10 dark:border-white/10" />
                    ) : msg.mediaMetadata?.mimeType?.startsWith('audio/') ? (
                      <audio src={msg.mediaUrl} controls className="max-w-[280px] md:max-w-sm" />
                    ) : (!msg.mediaMetadata?.mimeType || msg.mediaMetadata?.mimeType.startsWith('image/')) ? (
                      <div className="relative group cursor-pointer" onClick={() => setFullScreenMedia({ url: msg.mediaUrl!, type: msg.mediaMetadata?.mimeType || 'image/jpeg', name: msg.mediaMetadata?.name || 'Image' })}>
                        <img src={msg.mediaUrl} className="max-w-[280px] md:max-w-sm rounded-xl hover:brightness-90 transition-all shadow-md" alt="Upload" />
                        <div className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                          <Maximize size={16} />
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="flex items-center gap-3 p-3 bg-white/50 dark:bg-black/20 rounded-xl border border-gray-200 dark:border-white/10 max-w-[280px] md:max-w-sm cursor-pointer hover:bg-white/80 dark:hover:bg-black/40 transition-colors"
                        onClick={() => setFullScreenMedia({ url: msg.mediaUrl!, type: msg.mediaMetadata?.mimeType || 'application/octet-stream', name: msg.mediaMetadata?.name || 'File' })}
                      >
                        <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-lg shrink-0">
                          <File size={24} />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-bold text-sm truncate" title={msg.mediaMetadata?.name}>{msg.mediaMetadata?.name || 'Attachment'}</span>
                          <span className="text-xs text-gray-500">{(msg.mediaMetadata?.size ? (msg.mediaMetadata.size / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown size')}</span>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); downloadMedia(msg.mediaUrl!, msg.mediaMetadata?.name || 'file'); }} 
                          className="p-2 bg-gray-100 dark:bg-white/10 hover:bg-indigo-500 hover:text-white rounded-lg transition shrink-0"
                          title="Download"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    )}
                    {msg.content && renderMessageContent(msg.content, isMe)}
                  </div>
                ) : (
                  <div className="overflow-x-auto custom-scrollbar-horizontal">
                    {renderMessageContent(msg.content, isMe)}
                  </div>
                )}
                </div>
                
                <div className={`flex items-center gap-2 mt-1 px-1 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Message Actions - Moved below bubble per user request */}
                  <div className="flex items-center gap-1 opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setReactionMessageId(msg.id); }}
                      className="p-1 px-2 bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 rounded-full text-indigo-500 transition-all flex items-center gap-1 text-[10px] font-bold border border-indigo-500/10 shadow-sm"
                      title="React"
                    >
                      <Smile size={12} />
                      <span className="hidden md:inline">React</span>
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); chatService.toggleMarked(channelId, msg.id); }}
                        className={`p-1 px-2 rounded-full transition-all flex items-center gap-1 text-[10px] font-bold border shadow-sm ${msg.isMarked ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white/80 dark:bg-white/10 text-gray-500 border-gray-500/10 hover:bg-white'}`}
                        title={msg.isMarked ? "Unmark" : "Mark Message"}
                      >
                        <Star size={12} className={msg.isMarked ? "fill-white" : ""} />
                        <span className="hidden md:inline">{msg.isMarked ? 'Marked' : 'Mark'}</span>
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleMenuClick(e, msg.id); }}
                      className="p-1.5 bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20 rounded-full text-gray-500 transition-all border border-gray-500/10 shadow-sm"
                      title="More options"
                    >
                      <MoreVertical size={12} />
                    </button>
                  </div>

                  {/* Reactions */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                        const hasReacted = userIds.includes(user?.uid);
                        return (
                          <button
                            key={emoji}
                            onClick={() => chatService.toggleReaction(channelId, msg.id, emoji)}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${hasReacted ? 'bg-[var(--primary)]/10 border-[var(--primary)]/30 text-[var(--primary)]' : 'bg-gray-100 dark:bg-white/5 border-transparent text-gray-500'}`}
                          >
                            <span>{emoji}</span>
                            <span>{userIds.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {isMe && (
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span>{formatInTimeZone(msg.createdAt, 'Asia/Kolkata', 'HH:mm')}</span>
                      {msg.deliveryState === 'sent' && <Check size={10} />}
                      {msg.deliveryState === 'delivered' && <CheckCheck size={10} />}
                      {msg.deliveryState === 'read' && <CheckCheck size={10} className="text-blue-500" />}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing Indicators */}
        <AnimatePresence>
          {typingUsers.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 text-xs text-gray-400 italic px-2"
            >
              <div className="flex gap-1">
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" />
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
              {typingUsers.length === 1 ? `${typingUsers[0].name} is typing...` : 'Several people are typing...'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="p-3 md:p-5 border-t border-gray-200 dark:border-white/5 bg-white/80 dark:bg-[#1e1f22]/90 backdrop-blur-lg">
        {!hasPermission(channel, user, userData, 'send') ? (
          <div className="p-4 bg-gray-100 dark:bg-white/5 rounded-2xl text-center text-xs font-black uppercase tracking-widest opacity-40">
            ReadOnly Mode Enabled
          </div>
        ) : (
          <>
            {replyTo && (
              <div className="mb-3 p-3 bg-indigo-500/5 dark:bg-white/5 rounded-2xl flex items-center justify-between border-l-4 border-indigo-500 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-1 bg-indigo-500/10 rounded-lg">
                    <Reply size={16} className="text-indigo-500" />
                  </div>
                  <div className="text-[12px] truncate">
                    <span className="font-black text-indigo-600 dark:text-indigo-400">Replying to @{replyTo.senderName}</span>
                    <span className="opacity-60 block truncate text-[11px] whitespace-pre-wrap">{replyTo.content}</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setReplyTo(null)} 
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                  title="Cancel Reply"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {editingMessage && (
              <div className="mb-3 p-3 bg-amber-500/5 dark:bg-white/5 rounded-2xl flex items-center justify-between border-l-4 border-amber-500 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-1 bg-amber-500/10 rounded-lg">
                    <Edit2 size={16} className="text-amber-500" />
                  </div>
                  <div className="text-[12px] truncate">
                    <span className="font-black text-amber-600 dark:text-amber-400">Editing Message</span>
                    <span className="opacity-60 block truncate text-[11px] whitespace-pre-wrap">{editingMessage.content}</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    setEditingMessage(null);
                    // We don't clear inputText per user request
                  }} 
                  className="p-1.5 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors flex-shrink-0"
                  title="Cancel Edit"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-end gap-3 flex-col w-full">
              {/* Media Preview Area */}
              {(mediaProcessState !== 'idle' || selectedMedia) && (
                <div className="w-full relative px-4 py-3 bg-gray-100 dark:bg-[#2b2d31] rounded-2xl animate-in fade-in slide-in-from-bottom-2 border border-blue-500/30">
                  <div className="flex items-center gap-4">
                    {mediaProcessState === 'compressing' && (
                      <div className="flex items-center gap-2 text-indigo-500 font-bold text-sm">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                        Compressing Media (Saving resources)...
                      </div>
                    )}
                    {mediaProcessState === 'uploading' && (
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
                        <div className="flex-1 w-full flex flex-col justify-center min-w-0">
                          <span className="text-indigo-500 font-bold text-sm truncate">Uploading... {uploadProgress?.toFixed(0)}%</span>
                          <div className="w-full bg-gray-200 dark:bg-white/10 h-1.5 rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${uploadProgress || 0}%` }}></div>
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={handleCancelUpload}
                          className="p-1.5 bg-red-100 dark:bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors flex-shrink-0"
                          title="Cancel Upload"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    {selectedMedia && (
                      <div className="flex items-center gap-3 relative overflow-hidden group w-full">
                        {selectedMedia.fileType.startsWith('image/') ? (
                          <img src={selectedMedia.url} alt="Preview" className="w-12 h-12 rounded object-cover border border-white/10" />
                        ) : (
                          <div className="w-12 h-12 bg-white/10 rounded flex flex-col items-center justify-center text-xs">📄</div>
                        )}
                        <div className="flex flex-col flex-1 truncate pr-8">
                          <span className="text-sm font-bold truncate block">{selectedMedia.name}</span>
                          <span className="text-xs text-gray-500 block">Ready to send</span>
                        </div>
                        <button 
                          type="button"
                          onClick={handleCancelUpload}
                          className="absolute right-0 top-1/2 -translate-y-1/2 p-2 bg-red-500 text-white rounded-xl shadow-lg opacity-80 hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-end gap-3 w-full">
                <div className="flex-1 relative bg-gray-100 dark:bg-[#2b2d31] rounded-3xl flex items-center px-4 py-1.5 border border-transparent focus-within:border-indigo-500/30 focus-within:bg-white dark:focus-within:bg-[#313338] focus-within:shadow-xl focus-within:shadow-indigo-500/5 transition-all duration-300">
                  <label className={`mr-2 p-2 rounded-full transition-all cursor-pointer shadow-sm active:scale-90 ${mediaProcessState !== 'idle' ? 'bg-gray-300 dark:bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500 hover:text-white'}`}>
                    <ArrowUp size={20} className="rotate-0" />
                    <input type="file" className="hidden" onChange={handleFileUpload} accept="*/*" disabled={mediaProcessState !== 'idle'} />
                  </label>

                <textarea 
                  ref={inputRef}
                  disabled={isMuted || cooldownRemaining > 0}
                  rows={1}
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder={
                    isMuted 
                      ? "You are currently muted." 
                      : cooldownRemaining > 0 
                        ? `On cooldown: ${cooldownRemaining}s remaining` 
                        : `Send a Message #${(channel?.name || 'channel').toLowerCase()}`
                  }
                  className={`flex-1 py-2.5 bg-transparent outline-none resize-none max-h-40 text-[15px] font-medium transition-all ${
                    (isMuted || cooldownRemaining > 0) 
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                      : 'text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500'
                  }`}
                  onKeyDown={(e) => {
                    if (showMentions && filteredMentionUsers.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setMentionIndex(prev => (prev + 1) % filteredMentionUsers.length);
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setMentionIndex(prev => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
                        return;
                      }
                      if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault();
                        handleMentionSelect(filteredMentionUsers[mentionIndex].name || '');
                        return;
                      }
                      if (e.key === 'Escape') {
                        setShowMentions(false);
                        return;
                      }
                    }

                    if (showAiMentions && filteredAIs.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setAiMentionIndex(prev => (prev + 1) % filteredAIs.length);
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setAiMentionIndex(prev => (prev - 1 + filteredAIs.length) % filteredAIs.length);
                        return;
                      }
                      if (e.key === 'Enter' || e.key === 'Tab') {
                        e.preventDefault();
                        handleAiMentionSelect(filteredAIs[aiMentionIndex].id);
                        return;
                      }
                      if (e.key === 'Escape') {
                        setShowAiMentions(false);
                        return;
                      }
                    }

                    if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                
                {/* AI Mentions Dropdown */}
                <AnimatePresence>
                  {showAiMentions && filteredAIs.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-0 mb-4 z-[1000] w-64 bg-white dark:bg-[#1e1f22] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden"
                    >
                      <div className="p-2 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/20">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Ask AI ({filteredAIs.length})</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                        {filteredAIs.map((ai, i) => (
                          <button
                            key={`${ai.id}-${i}`}
                            type="button"
                            onClick={() => handleAiMentionSelect(ai.id)}
                            onMouseEnter={() => setAiMentionIndex(i)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${aiMentionIndex === i ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}
                          >
                            <img src="https://cdn-icons-png.flaticon.com/512/4712/4712010.png" className={`w-8 h-8 p-1 rounded-full object-cover ${aiMentionIndex === i ? 'bg-white/20' : 'bg-gray-100 dark:bg-white/10'}`} alt="" />
                            <div className="flex-1 text-left truncate">
                              <span className="text-sm font-bold block truncate">{ai.name}</span>
                              <span className={`text-[10px] block truncate ${aiMentionIndex === i ? 'text-white/70' : 'text-gray-500'}`}>{ai.company}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Mentions Dropdown */}
                <AnimatePresence>
                  {showMentions && filteredMentionUsers.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute bottom-full left-0 mb-4 z-[1000] w-64 bg-white dark:bg-[#1e1f22] rounded-xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden"
                    >
                      <div className="p-2 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-black/20">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Members matching "{mentionFilter}"</span>
                      </div>
                      <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                        {filteredMentionUsers.map((u, i) => (
                          <button
                            key={`${u.uid}-${i}`}
                            type="button"
                            onClick={() => handleMentionSelect(u.name || '')}
                            onMouseEnter={() => setMentionIndex(i)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${mentionIndex === i ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}
                          >
                            <img src={u.photoUrl || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'} className="w-6 h-6 rounded-full object-cover" alt="" />
                            <div className="flex-1 text-left truncate">
                              <span className="text-sm font-bold block truncate">{u.name}</span>
                              <span className={`text-[10px] block truncate ${mentionIndex === i ? 'text-white/70' : 'text-gray-500'}`}>{(userData?.role === 'admin' || userData?.role === 'moderator') ? u.email : 'Advanced Classes Student'}</span>
                            </div>
                            {mentionIndex === i && <AtSign size={14} className="opacity-70 animate-pulse" />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="flex items-center gap-1 ml-2">
                  <button 
                    type="button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFormulaHelper(!showFormulaHelper);
                    }} 
                    className={`p-2 bg-indigo-50 dark:bg-white/5 rounded-xl transition-all active:scale-95 ${showFormulaHelper ? 'text-indigo-600 bg-indigo-100' : 'text-indigo-500 hover:text-indigo-600'}`}
                    title="Math Symbols"
                  >
                    <Sigma size={22} strokeWidth={2.5} />
                  </button>
                  <button 
                    ref={emojiToggleButtonRef}
                    type="button" 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmojiPicker(!showEmojiPicker);
                    }} 
                    className={`p-2 rounded-xl transition-all active:scale-95 ${showEmojiPicker ? 'text-indigo-600 bg-indigo-100' : 'text-gray-400 hover:text-indigo-500 hover:bg-gray-100 dark:hover:bg-white/5'}`}
                  >
                    <Smile size={22} />
                  </button>
                </div>

                <AnimatePresence>
                  {showEmojiPicker && (
                    <motion.div 
                      ref={emojiPickerRef}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="fixed md:absolute bottom-[80px] md:bottom-full right-4 md:right-0 mb-4 z-[1000] shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 w-[320px] max-w-[calc(100vw-2rem)] bg-white dark:bg-[#2b2d31]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-2 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <span className="text-xs font-bold px-2 opacity-50">Choose Emoji</span>
                        <button type="button" onClick={() => setShowEmojiPicker(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-400 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                      <EmojiPicker 
                        onEmojiClick={(emojiData) => handleEmojiClick(emojiData)}
                        theme={document.documentElement.classList.contains('dark') ? Theme.DARK : Theme.LIGHT}
                        emojiStyle={EmojiStyle.NATIVE}
                        width="100%"
                        height="400px"
                        searchDisabled={false}
                        skinTonesDisabled
                        lazyLoadEmojis={true}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showFormulaHelper && (
                    <motion.div 
                      ref={formulaHelperRef}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="fixed md:absolute bottom-[80px] md:bottom-full right-4 md:right-0 mb-4 z-[1000] shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 w-[280px] bg-white dark:bg-[#2b2d31]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="p-3 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                        <span className="text-xs font-bold px-1 opacity-50">Math Symbols</span>
                        <button type="button" onClick={() => setShowFormulaHelper(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full text-gray-400 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                      <div className="p-4 grid grid-cols-6 gap-2">
                        {mathSymbols.map((item, i) => (
                          <button
                            key={`${item.label}-${i}`}
                            type="button"
                            onClick={() => insertSymbol(item.symbol)}
                            className="w-full aspect-square flex items-center justify-center text-lg font-bold hover:bg-indigo-500 hover:text-white rounded-lg transition-colors bg-gray-50 dark:bg-white/5"
                            title={item.label}
                          >
                            {item.symbol}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                type="submit"
                disabled={(!inputText.trim() && !selectedMedia) || isAiThinking || mediaProcessState === 'uploading' || mediaProcessState === 'compressing'}
                className={`flex-shrink-0 p-3.5 rounded-full transition-all duration-300 shadow-lg active:scale-90 ${
                  (inputText.trim() || selectedMedia) && !isAiThinking && mediaProcessState !== 'uploading' && mediaProcessState !== 'compressing'
                    ? 'bg-indigo-600 text-white shadow-indigo-600/30 scale-100' 
                    : 'bg-gray-200 dark:bg-white/5 text-gray-400 scale-95 opacity-50 cursor-not-allowed'
                }`}
              >
                {isAiThinking ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send size={22} className={(inputText.trim() || selectedMedia) ? 'translate-x-0.5' : ''} />
                )}
              </button>
            </div>
            </form>
          </>
        )}
      </div>

      {/* Reaction Picker Overlay */}
      <AnimatePresence>
        {reactionMessageId && (
          <div 
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setReactionMessageId(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1e1f22] p-4 rounded-2xl shadow-2xl border border-white/10 flex flex-wrap gap-3 justify-center max-w-[280px]"
              onClick={e => e.stopPropagation()}
            >
              {['❤️', '🔥', '👍', '😂', '😮', '😢', '🙏', '💯'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    chatService.toggleReaction(channelId, reactionMessageId, emoji);
                    setReactionMessageId(null);
                  }}
                  className="text-2xl hover:scale-125 transition-transform p-2 bg-gray-100 dark:bg-white/5 rounded-xl"
                >
                  {emoji}
                </button>
              ))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Context Menu */}
      <AnimatePresence>
        {activeMessageMenu && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-[100] w-48 bg-white dark:bg-[#111214] border border-gray-200 dark:border-[#1e1f22] rounded shadow-xl py-1 max-h-56 overflow-y-auto custom-scrollbar"
            style={{ ...(menuPosition.top !== undefined ? { top: menuPosition.top } : { bottom: menuPosition.bottom }), right: menuPosition.right }}
          >
            {(() => {
              const msg = filteredMessages.find(m => m.id === activeMessageMenu);
              if (!msg) return null;
              const isMe = msg.senderId === user?.uid;
              return (
                <>
                  <button onClick={() => { setReplyTo(msg); setActiveMessageMenu(null); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--primary)] hover:text-white flex items-center justify-between">
                    <span>Reply</span> <Reply size={14} />
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(msg.content); setActiveMessageMenu(null); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--primary)] hover:text-white flex items-center justify-between">
                    <span>Copy</span> <Copy size={14} />
                  </button>
                  {isMe && (
                    <button onClick={() => { setEditingMessage(msg); setInputText(msg.content); setActiveMessageMenu(null); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--primary)] hover:text-white flex items-center justify-between">
                      <span>Edit</span> <Edit2 size={14} />
                    </button>
                  )}
                  {(isMe || userData?.role === 'admin' || userData?.role === 'moderator') && (
                    <button onClick={() => { setMessageToDelete(msg); setActiveMessageMenu(null); }} className="w-full text-left px-3 py-1.5 text-sm text-red-500 hover:bg-red-500 hover:text-white flex items-center justify-between">
                      <span>Delete</span> <Trash2 size={14} />
                    </button>
                  )}
                  {!isMe && (userData?.role === 'admin' || userData?.role === 'moderator') && (() => {
                    const targetUser = allUsers.find(u => u.uid === msg.senderId);
                    const isMuted = targetUser?.isMuted;
                    const hasCooldown = targetUser?.cooldownUntil && (targetUser.cooldownUntil.toMillis ? targetUser.cooldownUntil.toMillis() : (targetUser.cooldownUntil.seconds * 1000)) > Date.now();
                    const isRestricted = isMuted || hasCooldown;

                    return (
                      <>
                        <div className="h-px bg-gray-200 dark:bg-white/10 my-1" />
                        
                        {/* Mute Options */}
                        <button 
                          onClick={() => { chatService.muteUser(msg.senderId); setActiveMessageMenu(null); toast.success(`Muted ${msg.senderName}`); }} 
                          className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between ${isMuted ? 'opacity-50 cursor-not-allowed text-gray-500' : 'text-orange-500 hover:bg-orange-500 hover:text-white'}`}
                          disabled={isMuted}
                        >
                          <span>Mute User</span> <ShieldAlert size={14} />
                        </button>
                        
                        <button 
                          onClick={() => { chatService.unmuteUser(msg.senderId); setActiveMessageMenu(null); toast.success(`Unmuted ${msg.senderName}`); }} 
                          className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between ${!isMuted ? 'opacity-50 cursor-not-allowed text-gray-500' : 'text-green-500 hover:bg-green-500 hover:text-white'}`}
                          disabled={!isMuted}
                        >
                          <span>Unmute User</span> <ShieldAlert size={14} className="rotate-180" />
                        </button>

                        <button 
                          onClick={() => { chatService.setCooldown(msg.senderId, 0); setActiveMessageMenu(null); toast.success(`Cleared status for ${msg.senderName}`); }} 
                          className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between ${( !isMuted && !hasCooldown ) ? 'opacity-50 cursor-not-allowed text-gray-500' : 'text-green-500 hover:bg-green-500 hover:text-white'}`}
                          disabled={!isMuted && !hasCooldown}
                        >
                          <span>Clear All Restriction</span> <RefreshCw size={14} className="opacity-50" />
                        </button>

                        <div className="h-px bg-gray-200 dark:bg-white/10 my-1" />

                        {/* Cooldown Options */}
                        <button onClick={() => { chatService.setCooldown(msg.senderId, 60); setActiveMessageMenu(null); toast.success(`Timed out ${msg.senderName} (1m)`); }} className="w-full text-left px-3 py-1.5 text-sm text-yellow-500 hover:bg-yellow-500 hover:text-white flex items-center justify-between">
                          <span>Timeout (1m)</span> <Clock size={14} />
                        </button>
                        <button onClick={() => { chatService.setCooldown(msg.senderId, 300); setActiveMessageMenu(null); toast.success(`Timed out ${msg.senderName} (5m)`); }} className="w-full text-left px-3 py-1.5 text-sm text-yellow-500 hover:bg-yellow-500 hover:text-white flex items-center justify-between">
                          <span>Timeout (5m)</span> <Clock size={14} />
                        </button>
                        <button onClick={() => { chatService.setCooldown(msg.senderId, 3600); setActiveMessageMenu(null); toast.success(`Timed out ${msg.senderName} (1h)`); }} className="w-full text-left px-3 py-1.5 text-sm text-yellow-500 hover:bg-yellow-500 hover:text-white flex items-center justify-between">
                          <span>Timeout (1h)</span> <Clock size={14} />
                        </button>
                        
                        <button 
                          onClick={() => { chatService.setCooldown(msg.senderId, 0); setActiveMessageMenu(null); toast.success(`Removed timeout for ${msg.senderName}`); }} 
                          className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between ${!hasCooldown ? 'opacity-50 cursor-not-allowed text-gray-500' : 'text-green-500 hover:bg-green-500 hover:text-white'}`}
                          disabled={!hasCooldown}
                        >
                          <span>Remove Timeout</span> <Clock size={14} className="opacity-50" />
                        </button>
                      </>
                    );
                  })()}
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {messageToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-[#1e1f22] rounded-2xl p-6 max-w-sm w-full">
              <h3 className="text-xl font-bold mb-2">Delete Message?</h3>
              <p className="text-gray-500 mb-6">This action cannot be undone.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setMessageToDelete(null)} className="px-4 py-2">Cancel</button>
                <button onClick={() => { chatService.deleteMessage(messageToDelete.id, channelId); setMessageToDelete(null); }} className="px-4 py-2 bg-red-500 text-white rounded-xl">Delete</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Screen Media Viewer */}
      <AnimatePresence>
        {fullScreenMedia && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 md:p-10"
            onClick={() => setFullScreenMedia(null)}
          >
            <div className="absolute top-4 right-4 flex items-center gap-4">
              <button 
                onClick={(e) => { e.stopPropagation(); downloadMedia(fullScreenMedia.url, fullScreenMedia.name); }}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                title="Download"
              >
                <Download size={24} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setFullScreenMedia(null); }}
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                title="Close cursor"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="max-w-7xl max-h-full w-full h-full flex items-center justify-center overflow-hidden" onClick={e => e.stopPropagation()}>
              {fullScreenMedia.type.startsWith('video/') ? (
                <video src={fullScreenMedia.url} controls className="max-w-full max-h-full rounded-xl shadow-2xl" />
              ) : fullScreenMedia.type.startsWith('audio/') ? (
                   <audio src={fullScreenMedia.url} controls className="w-full max-w-2xl" />
              ) : fullScreenMedia.type === 'application/pdf' ? (
                <iframe src={fullScreenMedia.url} className="w-full h-full max-h-[90vh] rounded-xl bg-white" title={fullScreenMedia.name} />
              ) : fullScreenMedia.type.startsWith('image/') ? (
                <img src={fullScreenMedia.url} className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" alt={fullScreenMedia.name} />
              ) : (
                <div className="flex flex-col items-center gap-4 bg-white dark:bg-[#111] p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white">
                  <div className="w-20 h-20 bg-[var(--primary)]/10 text-[var(--primary)] rounded-2xl flex items-center justify-center">
                    <File size={40} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-xl mb-1">{fullScreenMedia.name}</h3>
                    <p className="text-sm opacity-60">This file type cannot be previewed.</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); downloadMedia(fullScreenMedia.url, fullScreenMedia.name); }}
                    className="px-6 py-3 bg-[var(--primary)] text-white rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-opacity mt-2 shadow-lg shadow-[var(--primary)]/20"
                  >
                    <Download size={20} />
                    Download File
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
