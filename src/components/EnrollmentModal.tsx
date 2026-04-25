import React, { useState, useEffect } from 'react';
import { X, LogIn, UserPlus, Phone, Chrome, User, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import confetti from 'canvas-confetti';
import toast, { Toaster } from 'react-hot-toast';
import { firestoreService } from '../services/firestoreService';
import { authService } from '../services/authService';
import { pricingService } from '../services/pricingService';

export default function EnrollmentModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [whatsappError, setWhatsappError] = useState('');
  const [fees, setFees] = useState<any[]>([]);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'guest'>('signup');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginName, setLoginName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [pricingPreview, setPricingPreview] = useState({ totalBaseAmount: 0, discountedAmount: 0 });

  const [formData, setFormData] = useState({
    name: '',
    grade: 'XII',
    whatsapp: '',
    instagram: '',
    subjects: [] as string[]
  });

  useEffect(() => {
    const handleOpen = (e: any) => {
      if (e.detail?.grade) {
        setFormData(prev => ({ ...prev, grade: e.detail.grade, subjects: [] }));
      }
      setIsOpen(true);
    };
    window.addEventListener('open-enrollment', handleOpen as EventListener);

    const unsubAuth = authService.onAuthChange((u) => {
      setUser(u);
      if (u) {
        setShowLoginPrompt(false);
      }
    });
    
    const unsubFees = firestoreService.listenToCollection('fees', setFees);

    return () => {
      window.removeEventListener('open-enrollment', handleOpen as EventListener);
      unsubAuth();
      unsubFees();
    };
  }, []);

  const handleSubjectToggle = (subject: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subject) 
        ? prev.subjects.filter(s => s !== subject)
        : [...prev.subjects, subject]
    }));
  };

  useEffect(() => {
    let active = true;

    const refreshPricingPreview = async () => {
      if (formData.subjects.length === 0 || fees.length === 0) {
        if (active) {
          setPricingPreview({ totalBaseAmount: 0, discountedAmount: 0 });
        }
        return;
      }

      try {
        const quote = await pricingService.calculateQuote({
          subjects: formData.subjects,
          grade: formData.grade,
          feeItems: fees
        });
        if (active) {
          setPricingPreview({
            totalBaseAmount: quote.totalBaseAmount,
            discountedAmount: quote.discountedAmount
          });
        }
      } catch (error) {
        console.error('Failed to calculate pricing preview', error);
        const selectedFees = fees.filter(f => formData.subjects.includes(f.subject));
        const totalBaseAmount = selectedFees.reduce((sum, f) => sum + (Number(f.originalPrice) || 0), 0);
        const discountedAmount = selectedFees.reduce((sum, f) => sum + (Number(f.finalPrice) || 0), 0);
        if (active) {
          setPricingPreview({ totalBaseAmount, discountedAmount });
        }
      }
    };

    refreshPricingPreview();

    return () => {
      active = false;
    };
  }, [fees, formData.grade, formData.subjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWhatsappError('');

    if (!user) {
      setShowLoginPrompt(true);
      setAuthMode('signup');
      return;
    }

    if (!formData.name || formData.subjects.length === 0) {
      toast.error('Please enter a name and select at least one subject.');
      return;
    }
    
    const phone = formData.whatsapp.replace(/\D/g, '');
    if (phone.length !== 10 || !/^[6-9]/.test(phone)) {
      setWhatsappError('Invalid phone number. Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      const { totalBaseAmount, discountedAmount, discount } = await pricingService.calculateQuote({
        subjects: formData.subjects,
        grade: formData.grade,
        feeItems: fees
      });

      const enrollmentData = {
        name: formData.name,
        email: user?.email || '',
        grade: formData.grade,
        whatsapp: formData.whatsapp,
        instagram: formData.instagram.replace('@', ''),
        subjects: formData.subjects,
        totalFee: totalBaseAmount,
        discount,
        finalPrice: discountedAmount,
        feeStatus: 'Pending',
        updatedAt: new Date().toISOString()
      };

      // Check for existing enrollment by email or whatsapp
      const existing = await firestoreService.findEnrollment(user?.email, formData.whatsapp) as any;

      if (existing) {
        // Update existing enrollment
        await firestoreService.updateItem('enrollments', existing.id, {
          ...enrollmentData,
          // Preserve payment history if it exists
          paymentHistory: existing.paymentHistory || [],
          createdAt: existing.createdAt || new Date().toISOString()
        });
        toast.success('Enrollment Updated! 🔄');
      } else {
        // Create new enrollment
        await firestoreService.addItem('enrollments', {
          ...enrollmentData,
          createdAt: new Date().toISOString()
        });
        toast.success('Seat Locked! 🚀');
      }

      setIsOpen(false);
      setFormData({ name: '', grade: 'XII', whatsapp: '', instagram: '', subjects: [] });
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4f46e5', '#10b981', '#f59e0b']
      });
    } catch (err) {
      console.error("Failed to enroll", err);
      toast.error('Failed to enroll. Please try again.');
    }
  };

  const getSubjectsForGrade = (grade: string) => {
    return fees
      .filter(f => {
        if (f.grades && Array.isArray(f.grades)) {
          return f.grades.includes(grade);
        }
        return !f.grade || f.grade === grade;
      })
      .map(f => f.subject);
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await authService.signInWithGoogle();
      toast.success('Logged in with Google!');
    } catch (err) {
      console.error(err);
      toast.error('Google login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handlePhoneAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError('');
    setPasswordError('');

    if (loginPhone.length < 10) {
      setPhoneError('Please enter a valid 10-digit number');
      return;
    }
    if (loginPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    setIsLoggingIn(true);
    try {
      if (authMode === 'signup') {
        if (!loginName) {
          toast.error('Please enter your name');
          return;
        }
        await authService.signUpWithPhoneAndPassword(loginPhone, loginPassword, loginName);
        toast.success('Account created successfully!');
      } else {
        await authService.signInWithPhoneAndPassword(loginPhone, loginPassword);
        toast.success('Logged in successfully!');
      }
    } catch (err: any) {
      console.error(err);
      const errorCode = err.code || '';
      
      if (errorCode.includes('email-already-in-use')) {
        setPhoneError('This number is already registered');
      } else if (errorCode.includes('user-not-found')) {
        setPhoneError('No account found with this number');
      } else if (errorCode.includes('wrong-password')) {
        setPasswordError('Incorrect password');
      } else if (errorCode.includes('invalid-email')) {
        setPhoneError('Invalid phone number format');
      } else if (errorCode.includes('weak-password')) {
        setPasswordError('Password is too weak');
      } else if (errorCode.includes('invalid-credential')) {
        toast.error('Invalid phone number or password');
      } else {
        toast.error('Authentication failed. Please try again.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim()) {
      toast.error('Please enter a display name');
      return;
    }
    setIsLoggingIn(true);
    try {
      await authService.signInAsGuest(loginName.trim());
      toast.success('Connected as Guest!');
    } catch (err) {
      console.error(err);
      toast.error('Guest login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (!isOpen) return null;

  const renderAuthPrompt = () => (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-[var(--primary)]/10 rounded-2xl flex items-center justify-center mx-auto text-[var(--primary)]">
          <LogIn size={32} />
        </div>
        <h2 className="text-2xl font-bold">Registration Required</h2>
        <p className="text-sm opacity-60">Create an account to enroll in {(formData.grade || 'batch')}.</p>
      </div>

      <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-2xl">
        <button 
          onClick={() => setAuthMode('signup')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all ${authMode === 'signup' ? 'bg-white dark:bg-gray-800 text-[var(--primary)] shadow-sm' : 'text-gray-500 opacity-60 hover:opacity-100'}`}
        >
          <UserPlus size={18} />
          Sign Up
        </button>
        <button 
          onClick={() => setAuthMode('login')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold transition-all ${authMode === 'login' ? 'bg-white dark:bg-gray-800 text-[var(--primary)] shadow-sm' : 'text-gray-500 opacity-60 hover:opacity-100'}`}
        >
          <LogIn size={18} />
          Sign In
        </button>
      </div>

      {(authMode === 'login' || authMode === 'signup') && (
        <form onSubmit={handlePhoneAuth} className="space-y-4">
          {authMode === 'signup' && (
            <div>
              <label className="text-[10px] font-bold uppercase opacity-50 ml-1">Your Full Name</label>
              <input 
                type="text" 
                required 
                value={loginName} 
                onChange={e => setLoginName(e.target.value)}
                className="w-full p-3 rounded-xl bg-gray-100 dark:bg-white/10 border border-transparent focus:border-[var(--primary)] outline-none"
                placeholder="Ex: John Doe"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase opacity-50 ml-1">Phone Number</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">+91</span>
              <input 
                type="tel" 
                required 
                value={loginPhone} 
                onChange={e => {
                  setLoginPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                  setPhoneError('');
                }}
                className={`w-full p-3 pl-12 rounded-xl bg-gray-100 dark:bg-white/10 border ${phoneError ? 'border-red-500' : 'border-transparent'} focus:border-[var(--primary)] outline-none transition-colors`}
                placeholder="10-digit mobile"
              />
            </div>
            {phoneError && <p className="text-[10px] text-red-500 mt-1 ml-1 font-bold">{phoneError}</p>}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase opacity-50 ml-1">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'} 
                required 
                value={loginPassword} 
                onChange={e => {
                  setLoginPassword(e.target.value);
                  setPasswordError('');
                }}
                className={`w-full p-3 rounded-xl bg-gray-100 dark:bg-white/10 border ${passwordError ? 'border-red-500' : 'border-transparent'} focus:border-[var(--primary)] outline-none transition-colors`}
                placeholder="Min 6 characters"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {passwordError && <p className="text-[10px] text-red-500 mt-1 ml-1 font-bold">{passwordError}</p>}
          </div>

          <button 
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-4 bg-[var(--primary)] text-white rounded-2xl font-bold shadow-lg shadow-[var(--primary)]/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isLoggingIn ? 'Processing...' : (authMode === 'login' ? 'Sign In' : 'Create Account')}
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-gray-200 dark:border-white/10"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-[10px] font-bold uppercase tracking-wider">Other ways to join</span>
            <div className="flex-grow border-t border-gray-200 dark:border-white/10"></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <Chrome size={18} className="text-red-500" />
              Google
            </button>
            <button 
              type="button"
              onClick={() => setAuthMode('guest')}
              disabled={isLoggingIn}
              className="flex items-center justify-center gap-2 p-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl font-bold text-sm hover:bg-gray-50 dark:hover:bg-white/10 transition-all disabled:opacity-50"
            >
              <User size={18} className="text-blue-500" />
              Guest
            </button>
          </div>
        </form>
      )}

      {authMode === 'guest' && (
        <form onSubmit={handleGuestLogin} className="space-y-4">
          <button 
            type="button"
            onClick={() => setAuthMode('signup')}
            className="flex items-center gap-2 text-sm font-bold text-[var(--primary)] hover:underline"
          >
            <ArrowLeft size={16} />
            Back to registration
          </button>

          <div>
            <label className="text-[10px] font-bold uppercase opacity-50 ml-1">Preferred Display Name</label>
            <input 
              type="text" 
              required 
              value={loginName} 
              onChange={e => setLoginName(e.target.value)}
              className="w-full p-3 rounded-xl bg-gray-100 dark:bg-white/10 border border-transparent focus:border-[var(--primary)] outline-none"
              placeholder="Ex: Guest Student"
              autoFocus
            />
          </div>

          <button 
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl font-bold shadow-xl hover:opacity-90 transition-all disabled:opacity-50"
          >
            {isLoggingIn ? 'Connecting...' : 'Continue as Guest'}
          </button>
          
          <p className="text-[10px] text-center opacity-40 italic">Note: Guest accounts have limited access and profiles are temporary.</p>
        </form>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <Toaster position="top-center" />
      <div className="glass-card w-full max-w-md max-h-[90vh] overflow-y-auto relative bg-white dark:bg-[#111928] p-6 shadow-2xl border border-white/20">
        <button 
          onClick={() => {
            setIsOpen(false);
            setShowLoginPrompt(false);
          }} 
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-900 dark:text-white"
        >
          <X size={20} />
        </button>

        {showLoginPrompt ? (
          renderAuthPrompt()
        ) : (
          <>
            <h2 className="text-xl font-bold mb-4 text-[var(--primary)] flex items-center gap-2">
              <UserPlus size={24} />
              Join a Batch
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold opacity-70 mb-1 block text-gray-900 dark:text-white">Full Name *</label>
            <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-2.5 rounded-xl bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 focus:border-[var(--primary)] outline-none text-gray-900 dark:text-white" placeholder="Student or Friend's Name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold opacity-70 mb-1 block text-gray-900 dark:text-white">Class *</label>
              <select value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value, subjects: []})} className="w-full p-2.5 rounded-xl bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 focus:border-[var(--primary)] outline-none appearance-none [&>option]:bg-white dark:[&>option]:bg-gray-900 [&>option]:text-gray-900 dark:[&>option]:text-white text-gray-900 dark:text-white">
                <option value="XII">Class XII</option>
                <option value="XI">Class XI</option>
                <option value="X">Class X</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold opacity-70 mb-1 block text-gray-900 dark:text-white">Instagram Handle</label>
              <input 
                type="text" 
                value={formData.instagram} 
                onChange={e => {
                  let val = e.target.value;
                  if (val && !val.startsWith('@')) val = '@' + val;
                  setFormData({...formData, instagram: val});
                }} 
                className="w-full p-2.5 rounded-xl bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 focus:border-[var(--primary)] outline-none text-gray-900 dark:text-white" 
                placeholder="@username" 
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold opacity-70 mb-1 block text-gray-900 dark:text-white">WhatsApp Number *</label>
            <input 
              type="tel" 
              required 
              value={formData.whatsapp} 
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData({...formData, whatsapp: val});
                if (whatsappError) setWhatsappError('');
              }} 
              className={`w-full p-2.5 rounded-xl bg-gray-100 dark:bg-white/10 border ${whatsappError ? 'border-red-500' : 'border-gray-200 dark:border-white/10'} focus:border-[var(--primary)] outline-none transition-colors text-gray-900 dark:text-white`} 
              placeholder="10-digit mobile number" 
            />
            {whatsappError && (
              <p className="text-[10px] text-red-500 mt-1 font-bold animate-pulse">{whatsappError}</p>
            )}
          </div>

          <div>
            <label className="text-xs font-bold opacity-70 mb-2 block text-gray-900 dark:text-white">Select Subjects *</label>
            <div className="grid grid-cols-2 gap-2">
              {getSubjectsForGrade(formData.grade).map(sub => (
                <div 
                  key={sub} 
                  onClick={() => handleSubjectToggle(sub)}
                  className={`p-2 rounded-lg text-xs text-center cursor-pointer border transition-colors ${formData.subjects.includes(sub) ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 opacity-70 text-gray-900 dark:text-white'}`}
                >
                  {sub}
                </div>
              ))}
            </div>
          </div>

          {formData.subjects.length > 0 && (() => {
            const { totalBaseAmount, discountedAmount } = pricingPreview;

            return (
              <div className="flex items-end justify-between pt-4 pb-2 border-t border-gray-200 dark:border-white/10 mt-2">
                <div className="flex flex-col items-start">
                  <span className="text-xs uppercase font-bold text-gray-500 line-through">₹{totalBaseAmount}</span>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Base Amount</p>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="text-2xl font-black text-green-500 flex items-center gap-1">
                    ₹{discountedAmount}
                    <span className="text-[10px] font-bold bg-green-500/10 px-1 py-0.5 rounded animate-pulse">LIVE</span>
                  </span>
                  <p className="text-[10px] text-green-500 font-black uppercase tracking-widest">Payable Online / Half-Half</p>
                </div>
              </div>
            );
          })()}

          <button type="submit" className="w-full py-3 mt-2 bg-[var(--primary)] text-white rounded-xl font-bold shadow-lg hover:opacity-90">
            Enroll Now
          </button>
          
          <div className="mt-4 text-center">
            <a 
              href="https://drive.google.com/file/d/1RrGU4_efhj6XaEuQIauOAWiy6-KZi5sr/view?usp=drivesdk" 
              target="_blank" 
              rel="noreferrer"
              className="text-xs text-[var(--primary)] font-bold hover:underline"
            >
              View Payment Fee Policy
            </a>
          </div>
        </form>
      </>
    )}
  </div>
</div>
  );
}
