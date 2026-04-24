import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

export interface BrandingConfig {
  title: string;
  logo: string;
  qrCodeUrl?: string;
  upiId?: string;
  starTitle?: string;
  metaPixelCode?: string;
  googleAnalyticsCode?: string;
  navOrder?: string[];
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  updatedAt: any;
}

const DEFAULT_BRANDING: BrandingConfig = {
  title: 'Advanced Classes',
  logo: '', // Default logo URL
  qrCodeUrl: '',
  upiId: 'advancedclasses@boi',
  starTitle: 'STAR OF THE WEEK',
  metaPixelCode: '',
  googleAnalyticsCode: '',
  contactEmail: 'support@advancedclasses.com',
  contactPhone: '+91 9876543210',
  contactAddress: '123 Education Hub, Knowledge Park, City Center - 400001, India',
  navOrder: ['home', 'exclusive', 'batches', 'routine', 'test', 'downloads', 'studyhub', 'fee', 'join', 'settings'],
  updatedAt: null
};

export const brandingService = {
  async getBranding(): Promise<BrandingConfig> {
    const brandingRef = doc(db, 'admin', 'branding');
    const brandingSnap = await getDoc(brandingRef);
    
    if (!brandingSnap.exists()) {
      await setDoc(brandingRef, DEFAULT_BRANDING);
      return DEFAULT_BRANDING;
    }
    
    return brandingSnap.data() as BrandingConfig;
  },

  listenToBranding(callback: (config: BrandingConfig) => void) {
    const brandingRef = doc(db, 'admin', 'branding');
    return onSnapshot(brandingRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as BrandingConfig);
      } else {
        callback(DEFAULT_BRANDING);
      }
    });
  },

  async updateBranding(config: Partial<BrandingConfig>) {
    const brandingRef = doc(db, 'admin', 'branding');
    await setDoc(brandingRef, {
      ...config,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }
};
