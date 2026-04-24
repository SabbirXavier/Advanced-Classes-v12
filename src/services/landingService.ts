import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  serverTimestamp,
  collection,
  query,
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase';

export interface LandingConfig {
  heroTitle: string;
  heroSubtitle: string;
  stats: { label: string; value: string }[];
  features: { title: string; description: string; icon: string }[];
}

export interface Achiever {
  id?: string;
  name: string;
  rank: string;
  percentage: string;
  grade: string;
  batch: string;
  achievementTitle: string;
  photo: string;
  year: string;
  achievement: string;
  order: number;
}

export interface Faculty {
  id?: string;
  name: string;
  degree: string;
  experience: string;
  achievement: string;
  photo: string;
  subjects: string[];
  order: number;
}

const DEFAULT_LANDING_CONFIG: LandingConfig = {
  heroTitle: 'Master Your Future Today.',
  heroSubtitle: 'The digital revolution for modern students. Live classes, elite mentoring, and a powerful community to help you crush your goals.',
  stats: [
    { label: "Success Rate", value: "98%" },
    { label: "Proper Revision", value: "100%" },
    { label: "Letter Marks", value: "90%+" },
    { label: "Exam Mentoring", value: "Top Tier" }
  ],
  features: [
    {
      title: "Smart Learning Rooms",
      description: "Equipped with Flat Interactive Boards and modern visual aids for an immersive experience.",
      icon: "Zap"
    },
    {
      title: "24/7 Doubt Solving",
      description: "Best mentorship with round-the-clock support for all your academic queries.",
      icon: "MessageSquare"
    },
    {
      title: "Exam Mastery Bundle",
      description: "PYQ bundles, regular tests, and MCQ practice to make you exam-ready.",
      icon: "Brain"
    }
  ]
};

export const landingService = {
  // Config
  listenToConfig(callback: (config: LandingConfig) => void) {
    const configRef = doc(db, 'admin', 'landing');
    return onSnapshot(configRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as LandingConfig);
      } else {
        callback(DEFAULT_LANDING_CONFIG);
      }
    });
  },

  async updateConfig(config: Partial<LandingConfig>) {
    const configRef = doc(db, 'admin', 'landing');
    await setDoc(configRef, {
      ...config,
      updatedAt: serverTimestamp()
    }, { merge: true });
  },

  // Achievers
  listenToAchievers(callback: (achievers: Achiever[]) => void) {
    const q = query(collection(db, 'achievers'), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Achiever)));
    });
  },

  // Faculty
  listenToFaculty(callback: (faculty: Faculty[]) => void) {
    const q = query(collection(db, 'faculty'), orderBy('order', 'asc'));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Faculty)));
    });
  }
};
