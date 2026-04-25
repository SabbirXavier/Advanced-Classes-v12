import React, { useState, useEffect, useRef } from 'react';
import { User, Moon, Sun, LogOut, Shield, Edit2, Check, X, MessageCircle, HelpCircle, Image as ImageIcon, Camera, ZoomIn, Link as LinkIcon, Play, AlertTriangle, Mail as MailIcon } from 'lucide-react';
import { authService, UserProfile } from '../services/authService';
import { auth, db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { compressImage } from '../lib/imageUtils';
import { storageService } from '../services/storageService';
import ImageCropper from './ImageCropper';
import toast, { Toaster } from 'react-hot-toast';

interface TabSettingsProps {
  onNavigate: (tab: string) => void;
}

const AvatarWithGifHandling = ({ src, name, isUploading }: { src: string | null | undefined, name: string, isUploading: boolean }) => {
  const [staticSrc, setStaticSrc] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const imageUrl = src || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`;
  const isGif = imageUrl.toLowerCase().includes('.gif');

  useEffect(() => {
    if (isGif) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            setStaticSrc(canvas.toDataURL());
          } catch (e) {
            // CORS error - fallback to original src
          }
        }
      };
    }
  }, [imageUrl, isGif]);

  return (
    <div 
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img 
        src={isHovered ? imageUrl : (staticSrc || imageUrl)} 
        className={`w-20 h-20 rounded-2xl object-cover shadow-sm ${isUploading ? 'opacity-50' : ''}`} 
        alt="Profile" 
        referrerPolicy="no-referrer"
      />
      {isGif && !isHovered && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl transition-opacity">
          <Play size={20} className="text-white fill-current" />
        </div>
      )}
    </div>
  );
};

export default function TabSettings({ onNavigate }: TabSettingsProps) {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [chatBackground, setChatBackground] = useState(localStorage.getItem('chatBackground') || 'default');
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [profileDetails, setProfileDetails] = useState({
    bio: '',
    school: '',
    town: '',
    village: '',
    phone: '',
    socialHandle: ''
  });
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [isUpdatingUrl, setIsUpdatingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropType, setCropType] = useState<'profile' | 'background'>('profile');

  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
  const [errorConsoleEnabled, setErrorConsoleEnabled] = useState(localStorage.getItem('errorConsoleEnabled') === 'true');

  useEffect(() => {
    let unsubscribeDoc: () => void;
    
    const unsubscribeAuth = authService.onAuthChange((u) => {
      setUser(u);
      if (u) {
        // Listen to user document changes
        const userRef = doc(db, 'users', u.uid);
        unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            // Ensure admin role for specific email
            const userEmail = (profile.email || u.email || '').toLowerCase();
            const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'xavierscot3454@gmail.com').toLowerCase();
            const adminEmail1 = (import.meta.env.VITE_ADMIN_EMAIL_1 || 'xavierscot3454@gmail.com').toLowerCase();
            const adminEmail2 = (import.meta.env.VITE_ADMIN_EMAIL_2 || 'helixsmith.xavy@gmail.com').toLowerCase();
            
            console.log('Admin Check:', { userEmail, adminEmail, adminEmail1, adminEmail2 });
            
            if ((userEmail === adminEmail || userEmail === adminEmail1 || userEmail === adminEmail2) && profile.role !== 'admin') {
              console.log('Forcing admin role for:', userEmail);
              profile.role = 'admin';
            }
            setUserData(profile);
            setProfileDetails({
              bio: profile.bio || '',
              school: profile.school || '',
              town: profile.town || '',
              village: profile.village || '',
              phone: profile.phone || '',
              socialHandle: profile.socialHandle || ''
            });
          } else {
            // Fallback to fetching profile if doc doesn't exist yet
            const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || 'xavierscot3454@gmail.com').toLowerCase();
            const adminEmail1 = (import.meta.env.VITE_ADMIN_EMAIL_1 || 'xavierscot3454@gmail.com').toLowerCase();
            const adminEmail2 = (import.meta.env.VITE_ADMIN_EMAIL_2 || 'helixsmith.xavy@gmail.com').toLowerCase();
            const userEmail = (u.email || '').toLowerCase();
            
            console.log('Fallback Admin Check:', { userEmail, adminEmail, adminEmail1, adminEmail2 });
            
            if (userEmail === adminEmail || userEmail === adminEmail1 || userEmail === adminEmail2) {
              setUserData({
                uid: u.uid,
                name: u.displayName || 'Admin',
                email: userEmail || '',
                photoUrl: u.photoURL || '',
                role: 'admin'
              });
            } else {
              authService.getUserProfile(u.uid, u.email).then((profile) => {
                setUserData(profile);
                if (profile) {
                  setProfileDetails({
                    bio: profile.bio || '',
                    school: profile.school || '',
                    town: profile.town || '',
                    village: profile.village || '',
                    phone: profile.phone || '',
                    socialHandle: profile.socialHandle || ''
                  });
                }
              });
            }
          }
        });
      } else {
        setUserData(null);
        if (unsubscribeDoc) unsubscribeDoc();
      }
    });
    
    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const handleChatBgChange = (bg: string) => {
    setChatBackground(bg);
    localStorage.setItem('chatBackground', bg);
    // Dispatch event so chat component can update immediately if needed
    window.dispatchEvent(new Event('chatBgChanged'));
  };

  const handleUpdateName = async () => {
    if (!newProfileName.trim() || !user) return;
    try {
      await authService.updateUserName(user.uid, newProfileName.trim());
      setUserData(prev => prev ? { ...prev, name: newProfileName.trim() } : null);
      setIsEditingName(false);
    } catch (err) {
      console.error('Failed to update name', err);
    }
  };

  const handleUpdateDetails = async () => {
    if (!user) return;
    try {
      await authService.updateUserProfile(user.uid, profileDetails);
      setUserData(prev => prev ? { ...prev, ...profileDetails } : null);
      setIsEditingDetails(false);
    } catch (err) {
      console.error('Failed to update details', err);
    }
  };

  const handleUpdatePhotoUrl = async () => {
    if (!photoUrlInput.trim() || !user) return;
    try {
      setIsUpdatingUrl(true);
      await authService.updateUserPhoto(user.uid, photoUrlInput.trim());
      setUserData(prev => prev ? { ...prev, photoUrl: photoUrlInput.trim() } : null);
      setPhotoUrlInput('');
    } catch (err) {
      console.error('Failed to update photo URL', err);
      alert('Failed to update photo URL. Please check the link.');
    } finally {
      setIsUpdatingUrl(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Check if it's a GIF - skip cropping for GIFs
    if (file.type === 'image/gif') {
      try {
        setIsUploadingPhoto(true);
        const toastId = toast.loading('Uploading GIF profile picture...');
        const uploadResult = storageService.uploadFile(file, () => {});
        const media = await uploadResult.promise;
        await authService.updateUserPhoto(user.uid, media.url);
        setUserData(prev => prev ? { ...prev, photoUrl: media.url } : null);
        toast.success('Profile picture updated!', { id: toastId });
      } catch (error) {
        console.error('Failed to upload GIF:', error);
        toast.error('Failed to upload GIF. Please try again.');
      } finally {
        setIsUploadingPhoto(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setCropType('profile');
    };
    reader.readAsDataURL(file);
  };

  const handleCustomBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.type === 'image/gif') {
      try {
        setIsUploadingBg(true);
        const toastId = toast.loading('Uploading GIF chat background...');
        const uploadResult = storageService.uploadFile(file, () => {});
        const media = await uploadResult.promise;
        handleChatBgChange(`custom:${media.url}`);
        toast.success('Chat background updated!', { id: toastId });
      } catch (error) {
        console.error('Failed to upload background GIF:', error);
        toast.error('Failed to upload background GIF. Please try again.');
      } finally {
        setIsUploadingBg(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImage(reader.result as string);
      setCropType('background');
    };
    reader.readAsDataURL(file);
  };

  const onCropComplete = async (croppedBlob: Blob) => {
    setCropImage(null);
    if (!user) return;

    try {
      if (cropType === 'profile') {
        setIsUploadingPhoto(true);
        const toastId = toast.loading('Uploading profile picture...');
        const file = new File([croppedBlob], 'profile.jpg', { type: 'image/jpeg' });
        const compressedFile = await compressImage(file);
        const uploadResult = storageService.uploadFile(compressedFile, () => {});
        const media = await uploadResult.promise;
        await authService.updateUserPhoto(user.uid, media.url);
        setUserData(prev => prev ? { ...prev, photoUrl: media.url } : null);
        toast.success('Profile picture updated!', { id: toastId });
      } else {
        setIsUploadingBg(true);
        const toastId = toast.loading('Uploading chat background...');
        const file = new File([croppedBlob], 'background.jpg', { type: 'image/jpeg' });
        const compressedFile = await compressImage(file);
        const uploadResult = storageService.uploadFile(compressedFile, () => {});
        const media = await uploadResult.promise;
        handleChatBgChange(`custom:${media.url}`);
        toast.success('Chat background updated!', { id: toastId });
      }
    } catch (error) {
      console.error('Failed to upload cropped image:', error);
      toast.error('Failed to upload image. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
      setIsUploadingBg(false);
    }
  };

  const [loginMethod, setLoginMethod] = useState<'google' | 'phone'>('google');
  const [phoneMode, setPhoneMode] = useState<'login' | 'signup'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [supportTicketPopup, setSupportTicketPopup] = useState<{ open: boolean; ticketId: string }>({ open: false, ticketId: '' });

  const toUserFriendlyAuthError = (err: any) => {
    const code = String(err?.code || '').toLowerCase();
    if (code.includes('wrong-password') || code.includes('invalid-password')) return 'Wrong password. Please try again.';
    if (code.includes('invalid-credential')) return 'Invalid phone/email or password. Please check and try again.';
    if (code.includes('user-not-found')) return 'Account not found. Please sign up first.';
    if (code.includes('invalid-email')) return 'Invalid email format.';
    if (code.includes('invalid-phone-number')) return 'Invalid phone number.';
    if (code.includes('too-many-requests')) return 'Too many attempts. Please wait a few minutes.';
    if (code.includes('email-already-in-use')) return 'This account is already registered.';
    return 'Authentication failed. Please check your details and try again.';
  };

  const handleGoogleLogin = async () => {
    try {
      setAuthError('');
      await authService.signInWithGoogle();
    } catch (err) {
      console.error('Login failed', err);
      setAuthError('Google login failed. Please try again.');
    }
  };

  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password || (phoneMode === 'signup' && !name)) {
      setAuthError('Please fill all fields');
      return;
    }
    
    try {
      setAuthError('');
      setIsAuthenticating(true);
      if (phoneMode === 'signup') {
        await authService.signUpWithPhoneAndPassword(phone, password, name);
      } else {
        await authService.signInWithPhoneAndPassword(phone, password);
      }
    } catch (err: any) {
      console.error('Phone auth failed', err);
      setAuthError(toUserFriendlyAuthError(err));
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6 pb-24">
      <Toaster position="top-center" />
      {cropImage && (
        <ImageCropper 
          image={cropImage} 
          aspect={cropType === 'profile' ? 1 : 16/9}
          onCropComplete={onCropComplete}
          onCancel={() => setCropImage(null)}
        />
      )}
      <div className="bg-white dark:bg-[#1e1e1e] rounded-3xl p-6 lg:p-8 shadow-sm border border-gray-200 dark:border-white/10">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        {!user ? (
          <div className="text-center py-8 space-y-6">
            <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <User size={32} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-bold">Sign in to access settings</h2>
            <p className="text-gray-500 text-sm max-w-sm mx-auto">
              Create a profile to customize your experience, participate in the chat room, and more.
            </p>

            <div className="flex justify-center gap-2 p-1 bg-gray-100 dark:bg-white/5 rounded-xl max-w-xs mx-auto">
              <button 
                onClick={() => { setLoginMethod('google'); setAuthError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMethod === 'google' ? 'bg-white dark:bg-gray-800 shadow-sm' : 'opacity-50'}`}
              >
                Google
              </button>
              <button 
                onClick={() => { setLoginMethod('phone'); setAuthError(''); }}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${loginMethod === 'phone' ? 'bg-white dark:bg-gray-800 shadow-sm' : 'opacity-50'}`}
              >
                Phone
              </button>
            </div>

            {authError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-xl max-w-sm mx-auto">
                {authError}
              </div>
            )}

            {loginMethod === 'google' ? (
              <button 
                onClick={handleGoogleLogin}
                className="inline-flex items-center gap-3 px-6 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-bold shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                Continue with Google
              </button>
            ) : (
              <form onSubmit={handlePhoneAuth} className="max-w-sm mx-auto space-y-4 text-left">
                {phoneMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-bold opacity-50 mb-1 uppercase">Full Name</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold opacity-50 mb-1 uppercase">Phone Number</label>
                  <input 
                    type="tel" 
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold opacity-50 mb-1 uppercase">Password</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl outline-none focus:border-[var(--primary)]"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isAuthenticating}
                  className="w-full py-3 bg-[var(--primary)] text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  {isAuthenticating ? 'Processing...' : (phoneMode === 'login' ? 'Sign In' : 'Create Account')}
                </button>
                <p className="text-center text-xs opacity-70">
                  {phoneMode === 'login' ? "Don't have an account?" : "Already have an account?"}{' '}
                  <button 
                    type="button"
                    onClick={() => setPhoneMode(phoneMode === 'login' ? 'signup' : 'login')}
                    className="text-[var(--primary)] font-bold hover:underline"
                  >
                    {phoneMode === 'login' ? 'Sign Up' : 'Login'}
                  </button>
                </p>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Profile Section */}
            <section>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Profile</h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                <div className="relative group">
                  <AvatarWithGifHandling 
                    src={userData?.photoUrl || user.photoURL} 
                    name={user.uid} 
                    isUploading={isUploadingPhoto} 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl cursor-pointer"
                  >
                    <Camera size={24} />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handlePhotoUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
                <div className="flex-1 w-full">
                  {isEditingName ? (
                    <div className="flex items-center gap-2 mb-1">
                      <input 
                        type="text"
                        value={newProfileName}
                        onChange={e => setNewProfileName(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 focus:border-[var(--primary)] rounded-lg text-lg font-bold outline-none"
                        autoFocus
                      />
                      <button onClick={handleUpdateName} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setIsEditingName(false)} className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group mb-1">
                      <h3 className="text-xl font-bold">{userData?.name || user.displayName || 'Guest'}</h3>
                      <button 
                        onClick={() => {
                          setNewProfileName(userData?.name || user.displayName || '');
                          setIsEditingName(true);
                        }}
                        className="p-1.5 text-gray-400 hover:text-[var(--primary)] hover:bg-gray-200 dark:hover:bg-white/10 rounded-md transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                    </div>
                  )}
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">{user.email || 'Guest Account'}</p>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-bold rounded-md capitalize">
                      {userData?.role || 'Student'}
                    </span>
                    <span className="px-2.5 py-1 bg-green-500/10 text-green-500 text-xs font-bold rounded-md">
                      Online
                    </span>
                  </div>
                </div>
              </div>

              {/* Profile Picture URL Option */}
              <div className="mt-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LinkIcon size={16} className="text-blue-500" />
                    <span className="text-sm font-bold">Profile Picture URL</span>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Recommended</span>
                </div>
                <p className="text-[10px] opacity-60 font-medium">Use an external image link (e.g. from Pinterest, Google) to save data and keep the app fast.</p>
                <div className="flex gap-2">
                  <input 
                    type="url"
                    value={photoUrlInput}
                    onChange={e => setPhotoUrlInput(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 px-3 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-blue-500"
                  />
                  <button 
                    onClick={handleUpdatePhotoUrl}
                    disabled={isUpdatingUrl || !photoUrlInput.trim()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-xl text-sm font-bold hover:bg-blue-600 disabled:opacity-50 transition-all active:scale-95"
                  >
                    {isUpdatingUrl ? '...' : 'Apply'}
                  </button>
                </div>
              </div>

              {/* Detailed Profile Information */}
              <div className="mt-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm uppercase tracking-wider opacity-70">Detailed Information</h3>
                  {!isEditingDetails ? (
                    <button onClick={() => setIsEditingDetails(true)} className="p-1.5 text-gray-400 hover:text-[var(--primary)] hover:bg-gray-200 dark:hover:bg-white/10 rounded-md transition-all">
                      <Edit2 size={14} />
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={handleUpdateDetails} className="p-1.5 bg-green-500 text-white rounded-md hover:bg-green-600">
                        <Check size={14} />
                      </button>
                      <button onClick={() => setIsEditingDetails(false)} className="p-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600">
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {isEditingDetails ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] uppercase opacity-50 block mb-1">Bio</label>
                      <textarea value={profileDetails.bio} onChange={e => setProfileDetails({...profileDetails, bio: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[var(--primary)] min-h-[60px]" placeholder="Tell us about yourself..." />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] uppercase opacity-50 block mb-1">School/College</label>
                        <input type="text" value={profileDetails.school} onChange={e => setProfileDetails({...profileDetails, school: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[var(--primary)]" placeholder="School Name" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase opacity-50 block mb-1">Phone Number</label>
                        <input type="tel" value={profileDetails.phone} onChange={e => setProfileDetails({...profileDetails, phone: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[var(--primary)]" placeholder="+91..." />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] uppercase opacity-50 block mb-1">Town</label>
                        <input type="text" value={profileDetails.town} onChange={e => setProfileDetails({...profileDetails, town: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[var(--primary)]" placeholder="Town Name" />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase opacity-50 block mb-1">Village</label>
                        <input type="text" value={profileDetails.village} onChange={e => setProfileDetails({...profileDetails, village: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[var(--primary)]" placeholder="Village Name" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase opacity-50 block mb-1">Social Handle</label>
                      <input type="text" value={profileDetails.socialHandle} onChange={e => setProfileDetails({...profileDetails, socialHandle: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-[#111] border border-gray-200 dark:border-white/10 rounded-xl text-sm outline-none focus:border-[var(--primary)]" placeholder="@username" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                    {userData?.bio && <div className="col-span-2"><span className="opacity-50 block text-[10px] uppercase">Bio</span>{userData.bio}</div>}
                    {userData?.school && <div><span className="opacity-50 block text-[10px] uppercase">School/College</span>{userData.school}</div>}
                    {userData?.phone && <div><span className="opacity-50 block text-[10px] uppercase">Phone</span>{userData.phone}</div>}
                    {userData?.town && <div><span className="opacity-50 block text-[10px] uppercase">Town</span>{userData.town}</div>}
                    {userData?.village && <div><span className="opacity-50 block text-[10px] uppercase">Village</span>{userData.village}</div>}
                    {userData?.socialHandle && <div><span className="opacity-50 block text-[10px] uppercase">Social Handle</span>{userData.socialHandle}</div>}
                    {!userData?.bio && !userData?.school && !userData?.phone && !userData?.town && !userData?.village && !userData?.socialHandle && (
                      <div className="col-span-2 text-center opacity-50 italic text-xs py-2">No detailed information added yet.</div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* App Settings */}
            <section>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">App Preferences</h2>
              <div className="space-y-3">
                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-[#111] rounded-xl shadow-sm">
                      {isDarkMode ? <Moon size={18} className="text-[var(--primary)]" /> : <Sun size={18} className="text-[var(--primary)]" />}
                    </div>
                    <div>
                      <p className="font-bold">Dark Mode</p>
                      <p className="text-xs text-gray-500">Toggle dark theme for the platform</p>
                    </div>
                  </div>
                  <button 
                    onClick={toggleDarkMode}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isDarkMode ? 'bg-[var(--primary)]' : 'bg-gray-300 dark:bg-gray-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isDarkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white dark:bg-[#111] rounded-xl shadow-sm">
                      <AlertTriangle size={18} className="text-red-500" />
                    </div>
                    <div>
                      <p className="font-bold">Error Console</p>
                      <p className="text-xs text-gray-500">Enable advanced error logging and diagnostics</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      const newState = !localStorage.getItem('errorConsoleEnabled');
                      if (newState) {
                        localStorage.setItem('errorConsoleEnabled', 'true');
                      } else {
                        localStorage.removeItem('errorConsoleEnabled');
                      }
                      window.dispatchEvent(new Event('storage'));
                      // Force re-render
                      setErrorConsoleEnabled(newState);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${errorConsoleEnabled ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${errorConsoleEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {errorConsoleEnabled && (
                  <button 
                    onClick={() => onNavigate('error_log')}
                    className="w-full relative mt-2 overflow-hidden flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-2xl hover:bg-red-500/20 transition-all group"
                  >
                     <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                     <div className="flex items-center gap-3 relative">
                       <div className="p-2 bg-red-500/20 text-red-500 rounded-xl">
                         <AlertTriangle size={18} />
                       </div>
                       <div className="text-left">
                         <p className="font-bold text-red-500">View Error Logs</p>
                         <p className="text-xs text-red-500/70">Access system and user error traces</p>
                       </div>
                     </div>
                     <span className="text-red-500 opacity-50 group-hover:opacity-100 transition-opacity">&rarr;</span>
                  </button>
                )}

                <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-white dark:bg-[#111] rounded-xl shadow-sm">
                      <ImageIcon size={18} className="text-[var(--primary)]" />
                    </div>
                    <div>
                      <p className="font-bold">Chat Background</p>
                      <p className="text-xs text-gray-500">Customize chat room appearance</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={() => handleChatBgChange('default')}
                      className={`flex-1 min-w-[100px] py-2.5 rounded-xl text-sm font-bold transition-all ${chatBackground === 'default' ? 'bg-[var(--primary)] text-white shadow-md' : 'bg-white dark:bg-[#111] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                    >
                      Default
                    </button>
                    <button 
                      onClick={() => handleChatBgChange('whatsapp')}
                      className={`flex-1 min-w-[100px] py-2.5 rounded-xl text-sm font-bold transition-all ${chatBackground === 'whatsapp' ? 'bg-[var(--primary)] text-white shadow-md' : 'bg-white dark:bg-[#111] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                    >
                      WhatsApp
                    </button>
                    {userData?.role !== 'admin' ? (
                      <button 
                        disabled
                        className="flex-1 min-w-[100px] py-1.5 rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center gap-0.5 bg-gray-50 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed border border-dashed border-gray-200 dark:border-white/10"
                      >
                        <span className="flex items-center gap-1"><ImageIcon size={14} /> Custom</span>
                        <span className="text-[9px] uppercase tracking-widest text-[var(--primary)]">Coming Soon</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => bgInputRef.current?.click()}
                        disabled={isUploadingBg}
                        className={`flex-1 min-w-[100px] py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${chatBackground.startsWith('custom:') ? 'bg-[var(--primary)] text-white shadow-md' : 'bg-white dark:bg-[#111] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'}`}
                      >
                        {isUploadingBg ? (
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <ImageIcon size={16} />
                        )}
                        Custom
                      </button>
                    )}
                    <input 
                      type="file" 
                      ref={bgInputRef} 
                      onChange={handleCustomBgUpload} 
                      accept="image/*" 
                      className="hidden" 
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Support / Help */}
            <section>
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Help & Support</h2>
              <div className="space-y-3">
                <button 
                  onClick={() => {
                    const wsValue = import.meta.env.VITE_WHATSAPP_SUPPORT || 'https://wa.me/917002158841';
                    const prefilledMessage = encodeURIComponent('Hello Admin, I want to report an issue.');
                    const finalUrl = wsValue.includes('?') ? `${wsValue}&text=${prefilledMessage}` : `${wsValue}?text=${prefilledMessage}`;
                    window.open(finalUrl, '_blank');
                  }}
                  className="w-full flex items-center justify-between p-4 bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl hover:bg-[#25D366]/20 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#25D366]/20 text-[#25D366] rounded-xl">
                      <MessageCircle size={18} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-[#25D366]">WhatsApp Support</p>
                      <p className="text-xs text-[#25D366]/70">Chat with admins on WhatsApp</p>
                    </div>
                  </div>
                </button>

                <button 
                  onClick={async () => {
                    const existingTicket = localStorage.getItem('activeSupportTicket');
                    if (existingTicket) {
                       onNavigate('support_chat');
                       return;
                    }
                    
                    const ticketId = `ticket_${user.uid}_${Date.now()}`;
                    try {
                      const { doc, setDoc } = await import('firebase/firestore');
                      const ticketRef = doc(db, 'channels_config', ticketId);
                      await setDoc(ticketRef, {
                        id: ticketId,
                        name: `Support: ${user.displayName || user.email}`,
                        iconName: 'HelpCircle',
                        description: 'In-app support ticket',
                        order: 9999,
                        isSupportTicket: true,
                        ticketOwnerId: user.uid,
                        permissions: {
                          roles: { everyone: { view: false, send: false, delete: false } },
                          users: { [user.uid]: { view: true, send: true, delete: false } }
                        }
                      });
                      // Store the active ticket id in localStorage and navigate
                      localStorage.setItem('activeSupportTicket', ticketId);
                      setSupportTicketPopup({ open: true, ticketId });
                    } catch (e) {
                      console.error('Failed to create ticket', e);
                    }
                  }}
                  className="w-full flex items-center justify-between p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl hover:bg-indigo-500/20 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/20 text-indigo-500 rounded-xl">
                      <HelpCircle size={18} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-indigo-400">In-App Chat Support</p>
                      <p className="text-xs text-indigo-400/70">Create a support ticket directly</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    const email = import.meta.env.VITE_SUPPORT_EMAIL || import.meta.env.VITE_ADMIN_EMAIL || 'support@advancedclasses.com';
                    const subject = encodeURIComponent('Support Request');
                    const body = encodeURIComponent('Hello Support Team,\n\nI need help with:');
                    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
                  }}
                  className="w-full flex items-center justify-between p-4 bg-slate-500/10 border border-slate-500/20 rounded-2xl hover:bg-slate-500/20 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-500/20 text-slate-300 rounded-xl">
                      {MailIcon ? <MailIcon size={18} /> : <HelpCircle size={18} />}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-slate-200">Email Support</p>
                      <p className="text-xs text-slate-300/70">Send a support email directly from your device</p>
                    </div>
                  </div>
                </button>
              </div>
            </section>

            {/* Admin Section */}
            {(userData?.role === 'admin' || userData?.role === 'moderator') && (
              <section>
                <h2 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-4">Administration</h2>
                <button 
                  onClick={() => onNavigate('admin')}
                  className="w-full flex items-center justify-between p-4 bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 rounded-2xl hover:bg-red-100 dark:hover:bg-red-500/10 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 dark:bg-red-500/20 text-red-500 rounded-xl">
                      <Shield size={18} />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-red-600 dark:text-red-400">Admin Panel</p>
                      <p className="text-xs text-red-500/70">Manage app content and chatrooms</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-[#111] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Shield size={14} className="text-red-500" />
                  </div>
                </button>
              </section>
            )}

            {/* Danger Zone */}
            <section className="pt-4 border-t border-gray-200 dark:border-white/10">
              <button 
                onClick={async () => {
                  await authService.logout();
                  onNavigate('home');
                }}
                className="w-full flex items-center justify-center gap-2 p-4 bg-gray-50 dark:bg-white/5 text-red-500 rounded-2xl font-bold hover:bg-red-50 dark:hover:bg-red-500/10 transition-all"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </section>
          </div>
        )}
      </div>
      {supportTicketPopup.open && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-indigo-500/30 bg-[#121420] p-6 space-y-4">
            <h3 className="text-lg font-black text-indigo-400">Support Channel Created</h3>
            <p className="text-sm opacity-80">Your in-app support ticket has been created successfully.</p>
            <p className="text-[11px] opacity-50 font-mono break-all">{supportTicketPopup.ticketId}</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSupportTicketPopup({ open: false, ticketId: '' });
                  onNavigate('support_chat');
                }}
                className="flex-1 py-2 rounded-xl bg-indigo-500 text-white font-bold text-sm"
              >
                Open Ticket Channel
              </button>
              <button
                onClick={() => setSupportTicketPopup({ open: false, ticketId: '' })}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
