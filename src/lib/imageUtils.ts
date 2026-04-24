import imageCompression from 'browser-image-compression';

export async function compressImage(file: File): Promise<File> {
  // If it's a GIF, don't compress as it might lose animation
  if (file.type === 'image/gif') return file;

  const options = {
    maxSizeMB: 0.8, // Max 800KB
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Compression failed:', error);
    return file; // Fallback to original
  }
}

export async function urlToBase64(url: string): Promise<{ data: string, mimeType: string } | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ data: base64, mimeType: blob.type });
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to convert URL to base64:", error);
    return null;
  }
}
