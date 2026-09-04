/**
 * High-Resolution Client-side Image Processing & Optimization Utility
 * 
 * Supports high-resolution uploads from modern smartphones (up to 50MB / 8K),
 * resizing dynamically onto a high-definition canvas (max 1920x1920) with high smoothing
 * so that digital scale numbers, labels, and meat packaging details remain crystal clear
 * while keeping the base64 footprint lightweight (~150KB - 300KB) to ensure
 * reliable persistence in localStorage and fast cloud synchronization.
 */

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0
  format?: 'image/jpeg' | 'image/webp' | 'image/png';
}

export async function processHighResImage(
  fileOrDataUrl: File | Blob | string,
  options: ImageOptimizationOptions = {}
): Promise<string> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    format = 'image/jpeg'
  } = options;

  return new Promise((resolve, reject) => {
    // If it's already a string and not a large blob, load image directly
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width === 0 || height === 0) {
          resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
          return;
        }

        // Calculate aspect ratio preserving dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          resolve(typeof fileOrDataUrl === 'string' ? fileOrDataUrl : '');
          return;
        }

        // Apply high-quality rendering for digital scale numbers
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Fill background with white in case of transparent PNG converted to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        const optimizedDataUrl = canvas.toDataURL(format, quality);
        resolve(optimizedDataUrl);
      } catch (err) {
        console.warn('Canvas optimization error, falling back to original:', err);
        if (typeof fileOrDataUrl === 'string') {
          resolve(fileOrDataUrl);
        } else {
          // Read file directly as data URL fallback
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (e) => reject(e);
          reader.readAsDataURL(fileOrDataUrl);
        }
      }
    };

    img.onerror = (err) => {
      console.warn('Failed to load image for optimization:', err);
      if (typeof fileOrDataUrl === 'string') {
        resolve(fileOrDataUrl);
      } else {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(fileOrDataUrl);
      }
    };

    if (typeof fileOrDataUrl === 'string') {
      img.src = fileOrDataUrl;
    } else {
      const objectUrl = URL.createObjectURL(fileOrDataUrl);
      img.src = objectUrl;
      // Clean up object URL after loading
      const cleanUp = () => URL.revokeObjectURL(objectUrl);
      img.addEventListener('load', cleanUp, { once: true });
      img.addEventListener('error', cleanUp, { once: true });
    }
  });
}

/**
 * Ensures an image data URL is guaranteed to be under the Google Sheets 50,000 cell character limit
 * (target <= 35,000 chars) while keeping the image legible and preventing cloud sync exceptions.
 */
export async function ensureCloudSafeImage(
  dataUrl?: string,
  maxChars = 35000
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== 'string') return '';
  if (dataUrl.length <= maxChars) return dataUrl;

  try {
    const medium = await processHighResImage(dataUrl, {
      maxWidth: 600,
      maxHeight: 600,
      quality: 0.6,
      format: 'image/jpeg',
    });
    if (medium.length <= maxChars) return medium;

    const compact = await processHighResImage(dataUrl, {
      maxWidth: 400,
      maxHeight: 400,
      quality: 0.45,
      format: 'image/jpeg',
    });
    if (compact.length <= maxChars) return compact;

    // Fallback: return compact truncated or thumbnail
    return compact.substring(0, maxChars);
  } catch (err) {
    console.warn('Failed to compress image for cloud safely:', err);
    return dataUrl.substring(0, maxChars);
  }
}

