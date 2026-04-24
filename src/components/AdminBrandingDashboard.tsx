import React, { useState, useEffect } from 'react';
import { 
  Palette, 
  Image as ImageIcon, 
  Type, 
  Save, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Upload,
  X,
  CreditCard,
  QrCode,
  Star,
  Settings,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { brandingService, BrandingConfig } from '../services/brandingService';
import { storageService } from '../services/storageService';

export default function AdminBrandingDashboard() {
  const [config, setConfig] = useState<BrandingConfig | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = brandingService.listenToBranding((newConfig) => {
      setConfig(newConfig);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;

    setIsSaving(true);
    setSaveStatus('idle');

    try {
      await brandingService.updateBranding(config);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Failed to save branding', err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !config) return;

    try {
      setUploadProgress(0);
      const uploadResult = storageService.uploadFile(file, (progress) => {
        setUploadProgress(progress);
      });
      const metadata = await uploadResult.promise;
      setConfig({ ...config, logo: metadata.url });
      setUploadProgress(null);
    } catch (err) {
      console.error('Logo upload failed', err);
      setUploadProgress(null);
      alert('Logo upload failed. Please try again.');
    }
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw size={32} className="animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
          <Palette size={24} />
        </div>
        <div>
          <h3 className="text-xl font-bold">Site Branding</h3>
          <p className="text-xs text-gray-500">Customize the look and feel of your application</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="glass-card border border-gray-200 dark:border-white/5 p-6 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold flex items-center gap-2">
                <Type size={16} className="text-gray-400" />
                Application Title
              </label>
              <input 
                type="text"
                value={config.title}
                onChange={e => setConfig({ ...config, title: e.target.value })}
                className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-xl outline-none transition-all"
                placeholder="Enter site title..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold flex items-center gap-2">
                <ImageIcon size={16} className="text-gray-400" />
                Logo URL or Upload
              </label>
              <div className="flex gap-3">
                <input 
                  type="text"
                  value={config.logo}
                  onChange={e => setConfig({ ...config, logo: e.target.value })}
                  className="flex-1 p-3 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-xl outline-none transition-all text-sm"
                  placeholder="https://..."
                />
                <label className="p-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl cursor-pointer transition-all relative">
                  <Upload size={20} className="text-gray-500" />
                  <input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" />
                  {uploadProgress !== null && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-black/80 rounded-xl flex items-center justify-center">
                      <span className="text-[10px] font-bold">{uploadProgress}%</span>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold flex items-center gap-2">
                <CreditCard size={16} className="text-gray-400" />
                UPI ID
              </label>
              <input 
                type="text"
                value={config.upiId || ''}
                onChange={e => setConfig({ ...config, upiId: e.target.value })}
                className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-xl outline-none transition-all text-sm"
                placeholder="advancedclasses@boi"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold flex items-center gap-2">
                <QrCode size={16} className="text-gray-400" />
                Payment QR Code (Custom)
              </label>
              <div className="flex gap-3">
                <input 
                  type="text"
                  value={config.qrCodeUrl || ''}
                  onChange={e => setConfig({ ...config, qrCodeUrl: e.target.value })}
                  className="flex-1 p-3 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-xl outline-none transition-all text-sm"
                  placeholder="Leave empty to use auto-generated QR"
                />
                <label className="p-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl cursor-pointer transition-all relative">
                  <Upload size={20} className="text-gray-500" />
                  <input type="file" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setUploadProgress(0);
                      const uploadResult = storageService.uploadFile(file, setUploadProgress);
                      const metadata = await uploadResult.promise;
                      setConfig({ ...config, qrCodeUrl: metadata.url });
                      setUploadProgress(null);
                    } catch (err) {
                      console.error('QR upload failed', err);
                      setUploadProgress(null);
                    }
                  }} accept="image/*" />
                </label>
                {config.qrCodeUrl && (
                  <button 
                    type="button"
                    onClick={() => setConfig({ ...config, qrCodeUrl: '' })}
                    className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold flex items-center gap-2">
                <Settings size={16} className="text-gray-400" />
                Navigation Bar Order (Comma separated)
              </label>
              <input 
                type="text"
                value={config.navOrder?.join(', ') || 'home, batches, routine, test, downloads, studyhub, fee, join, settings'}
                onChange={e => setConfig({ ...config, navOrder: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-xl outline-none transition-all text-sm font-mono"
                placeholder="home, batches, routine, test, downloads, studyhub, fee, join, settings"
              />
              <p className="text-[10px] text-gray-500">Available: home, about, exclusive, batches, routine, downloads, join, test, fee, studyhub, admin, settings</p>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-white/5">
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Contact Details</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    Email Address
                  </label>
                  <input 
                    type="email"
                    value={config.contactEmail || ''}
                    onChange={e => setConfig({ ...config, contactEmail: e.target.value })}
                    className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-xl outline-none transition-all text-sm"
                    placeholder="support@advancedclasses.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold flex items-center gap-2">
                    Phone Number
                  </label>
                  <input 
                    type="tel"
                    value={config.contactPhone || ''}
                    onChange={e => setConfig({ ...config, contactPhone: e.target.value })}
                    className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-xl outline-none transition-all text-sm"
                    placeholder="+91 9876543210"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-2">
                  Physical Address
                </label>
                <textarea 
                  value={config.contactAddress || ''}
                  onChange={e => setConfig({ ...config, contactAddress: e.target.value })}
                  className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-xl outline-none transition-all text-sm min-h-[80px]"
                  placeholder="123 Education Hub, City Center..."
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-white/5">
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-400">Advanced Analytics</h4>
              
              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-2">
                  <Shield size={16} className="text-indigo-500" />
                  Google Analytics Code
                </label>
                <textarea 
                  value={config.googleAnalyticsCode || ''}
                  onChange={e => setConfig({ ...config, googleAnalyticsCode: e.target.value })}
                  className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-indigo-500 rounded-xl outline-none transition-all text-sm font-mono min-h-[100px]"
                  placeholder="Paste your Google Analytics tracking code here..."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold flex items-center gap-2">
                  <Settings size={16} className="text-gray-400" />
                  Meta Pixel Code (Ads Retargeting)
                </label>
                <textarea 
                  value={config.metaPixelCode || ''}
                  onChange={e => setConfig({ ...config, metaPixelCode: e.target.value })}
                  className="w-full p-3 bg-gray-100 dark:bg-white/5 border border-transparent focus:border-[var(--primary)] rounded-xl outline-none transition-all text-sm font-mono min-h-[100px]"
                  placeholder="Paste your Meta Pixel code here (including <script> tags)..."
                />
                <p className="text-[10px] text-gray-500">Analytics and Tracking codes will be injected into the website header for all users.</p>
              </div>
            </div>

            <div className="pt-4 flex items-center gap-4">
              <button 
                type="submit"
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--primary)] text-white rounded-xl font-bold shadow-lg shadow-[var(--primary)]/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
                Save Changes
              </button>
              
              <AnimatePresence mode="wait">
                {saveStatus === 'success' && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-2 text-green-500 font-bold text-sm"
                  >
                    <CheckCircle size={18} />
                    Saved!
                  </motion.div>
                )}
                {saveStatus === 'error' && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-2 text-red-500 font-bold text-sm"
                  >
                    <AlertCircle size={18} />
                    Error
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </form>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Live Preview</h4>
          <div className="glass-card border border-gray-200 dark:border-white/5 p-8 flex flex-col items-center justify-center text-center space-y-6 bg-gradient-to-br from-gray-50 to-white dark:from-[#111] dark:to-[#0a0a0a]">
            <div className="w-24 h-24 bg-[var(--primary)] rounded-3xl flex items-center justify-center shadow-2xl shadow-[var(--primary)]/20 overflow-hidden">
              {config.logo ? (
                <img src={config.logo} alt="Logo Preview" className="w-16 h-16 object-contain" />
              ) : (
                <Palette size={48} className="text-white" />
              )}
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">{config.title}</h1>
              <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto text-sm">
                This is how your application will appear to users.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
