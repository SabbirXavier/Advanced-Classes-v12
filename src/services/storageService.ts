import { 
  getStorage, 
  ref as storageRef, 
  uploadBytesResumable, 
  getDownloadURL, 
  FirebaseStorage,
  listAll,
  getMetadata
} from 'firebase/storage';
import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  getDoc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { db, initializeSecondaryApp, primaryConfig } from '../firebase';

export interface StorageProject {
  id: string;
  name: string;
  config: any;
  status: 'active' | 'running' | 'full' | 'disabled' | 'maintenance';
  currentUsageBytes: number;
  maxCapacityBytes: number;
  priority: number;
  lastActivity: any;
}

export interface MediaMetadata {
  url: string;
  projectId: string;
  bucket: string;
  fileType: string;
  fileSize: number;
  uploadTimestamp: any;
}

let activeStorageApps: { [key: string]: any } = {};

export const storageService = {
  async getStorageProjects(): Promise<StorageProject[]> {
    const projectsRef = collection(db, 'admin', 'storage', 'projects');
    const q = query(projectsRef, orderBy('priority', 'asc'));
    const snap = await getDocs(q);
    
    const projects: StorageProject[] = [];
    snap.forEach(doc => {
      projects.push({ id: doc.id, ...doc.data() } as StorageProject);
    });
    
    // If no projects in Firestore, initialize with primary
    if (projects.length === 0) {
      const primary: StorageProject = {
        id: 'primary',
        name: 'Primary Storage',
        config: primaryConfig,
        status: 'active',
        currentUsageBytes: 0,
        maxCapacityBytes: 5 * 1024 * 1024 * 1024, // 5GB default
        priority: 0,
        lastActivity: serverTimestamp()
      };
      await setDoc(doc(db, 'admin', 'storage', 'projects', 'primary'), primary);
      projects.push(primary);
    }
    
    return projects;
  },

  uploadFile(
    file: File, 
    onProgress: (progress: number) => void
  ): { task: any, promise: Promise<MediaMetadata> } {
    const fileExtension = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const storageReference = storageRef(activeStorageApps['primary'] || (import('../firebase').then(m => m.storage)), `uploads/${fileName}`);
    
    let isCancelled = false;
    let uploadTask: any = null;

    const promise = new Promise<MediaMetadata>(async (resolve, reject) => {
      try {
        const { storage } = await import('../firebase');
        const finalRef = storageRef(storage, `uploads/${fileName}`);
        uploadTask = uploadBytesResumable(finalRef, file);

        uploadTask.on('state_changed', 
          (snapshot: any) => {
            if (isCancelled) return;
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(progress);
          },
          (error: any) => {
            if (!isCancelled) reject(error);
          },
          async () => {
             if (isCancelled) return;
             try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve({
                  url: downloadURL,
                  projectId: 'primary',
                  bucket: 'uploads',
                  fileType: file.type,
                  fileSize: file.size,
                  uploadTimestamp: Date.now()
                });
             } catch (err) {
                reject(err);
             }
          }
        );
      } catch (err) {
        reject(err);
      }
    });

    return {
      task: { cancel: () => {
         isCancelled = true;
         if (uploadTask) uploadTask.cancel();
      } },
      promise
    };
  },

  async markProjectFull(projectId: string) {
    const projectRef = doc(db, 'admin', 'storage', 'projects', projectId);
    await setDoc(projectRef, { status: 'full' }, { merge: true });
  },

  async updateProjectUsage(projectId: string, size: number) {
    const projectRef = doc(db, 'admin', 'storage', 'projects', projectId);
    const snap = await getDoc(projectRef);
    if (snap.exists()) {
      const currentUsage = snap.data().currentUsageBytes || 0;
      await setDoc(projectRef, { 
        currentUsageBytes: currentUsage + size,
        lastActivity: serverTimestamp()
      }, { merge: true });
    }
  },

  async addStorageProject(project: StorageProject) {
    const projectRef = doc(db, 'admin', 'storage', 'projects', project.id);
    await setDoc(projectRef, project);
  },

  async refreshProjectUsage(projectId: string) {
    const projects = await this.getStorageProjects();
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    let storageInstance: FirebaseStorage;
    if (projectId === 'primary') {
      const { storage } = await import('../firebase');
      storageInstance = storage;
    } else {
      if (!activeStorageApps[projectId]) {
        const app = initializeSecondaryApp(projectId, project.config);
        activeStorageApps[projectId] = getStorage(app);
      }
      storageInstance = activeStorageApps[projectId];
    }

    const listRef = storageRef(storageInstance, 'chat_media');
    let totalSize = 0;
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Operation timed out. Please try again later.')), 30000)
    );

    try {
      const result = await Promise.race([
        (async () => {
          console.log(`Listing items in chat_media for ${projectId}...`);
          const res = await listAll(listRef);
          console.log(`Found ${res.items.length} items in chat_media`);
          
          const mediaMetadataPromises = res.items.map(item => 
            getMetadata(item).then(meta => meta.size).catch(e => {
              console.warn(`Failed to get metadata for ${item.fullPath}`, e);
              return 0;
            })
          );
          
          const mediaSizes = await Promise.all(mediaMetadataPromises);
          totalSize += mediaSizes.reduce((a, b) => a + b, 0);
          
          // Also check profile photos
          console.log(`Listing items in profile_photos for ${projectId}...`);
          const profileRef = storageRef(storageInstance, 'profile_photos');
          const profileRes = await listAll(profileRef).catch((err) => {
            console.warn(`Failed to list profile_photos for ${projectId}:`, err);
            return { items: [] };
          });
          console.log(`Found ${profileRes.items.length} items in profile_photos`);
          
          const profileMetadataPromises = profileRes.items.map(item => 
            getMetadata(item).then(meta => meta.size).catch(e => {
              console.warn(`Failed to get metadata for ${item.fullPath}`, e);
              return 0;
            })
          );
          
          const profileSizes = await Promise.all(profileMetadataPromises);
          totalSize += profileSizes.reduce((a, b) => a + b, 0);

          return totalSize;
        })(),
        timeoutPromise
      ]) as number;

      totalSize = result;

      console.log(`Total size calculated for ${projectId}: ${totalSize} bytes`);
      await setDoc(doc(db, 'admin', 'storage', 'projects', projectId), {
        currentUsageBytes: totalSize,
        lastActivity: serverTimestamp()
      }, { merge: true });

      return totalSize;
    } catch (error: any) {
      console.error('Error refreshing usage:', error);
      if (error.code === 'storage/retry-limit-exceeded') {
        throw new Error('Storage connection timed out. Please check if Firebase Storage is enabled in your console and CORS is configured.');
      }
      throw error;
    }
  }
};
