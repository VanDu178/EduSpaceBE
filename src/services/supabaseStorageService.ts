import path from 'path';
import { supabase, SUPABASE_BUCKET_NAME } from '../config/supabase';
import { AppError } from '../utils/appError';

export interface UploadOptions {
  folder?: string;
  allowedTypes?: string[];
  maxSizeBytes?: number;
}

/**
 * Upload buffer file lên Supabase Storage Bucket và trả về Public URL.
 * 
 * @param fileBuffer - Buffer dữ liệu của file
 * @param originalName - Tên nguyên bản của file
 * @param mimeType - Định dạng MIME (vd: image/png, video/mp4)
 * @param options - Tùy chọn folder, allowedTypes, maxSizeBytes
 * @returns Public URL của file sau khi upload thành công
 */
export async function uploadToSupabase(
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string,
  options: UploadOptions = {}
): Promise<{ url: string; path: string; fileName: string }> {
  const { folder = 'uploads', allowedTypes, maxSizeBytes } = options;

  // Kiểm tra kích thước file nếu có cài đặt
  if (maxSizeBytes && fileBuffer.length > maxSizeBytes) {
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    throw new AppError(`Dung lượng file vượt quá giới hạn cho phép (${maxMb}MB)`, 400);
  }

  // Kiểm tra loại file nếu có cài đặt
  if (allowedTypes && allowedTypes.length > 0) {
    const isAllowed = allowedTypes.some(type => {
      if (type.endsWith('/*')) {
        const category = type.split('/')[0];
        return mimeType.startsWith(`${category}/`);
      }
      return mimeType === type;
    });

    if (!isAllowed) {
      throw new AppError(`Định dạng file (${mimeType}) không được hỗ trợ`, 400);
    }
  }

  // Tạo đường dẫn file duy nhất để tránh bị đè tên
  const ext = path.extname(originalName) || getExtensionFromMime(mimeType);
  const cleanBaseName = path.basename(originalName, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-');

  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const fileName = `${cleanBaseName}-${timestamp}-${randomStr}${ext}`;
  const filePath = folder ? `${folder}/${fileName}` : fileName;

  // Gọi SDK Supabase để upload
  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET_NAME)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: true
    });

  if (error) {
    console.error('Lỗi khi upload file lên Supabase Storage:', error);
    throw new AppError(`Tải file lên Supabase thất bại: ${error.message}`, 500);
  }

  // Lấy Public URL của file vừa upload
  const { data: publicUrlData } = supabase.storage
    .from(SUPABASE_BUCKET_NAME)
    .getPublicUrl(data.path);

  return {
    url: publicUrlData.publicUrl,
    path: data.path,
    fileName
  };
}

/**
 * Xóa file trên Supabase Storage bằng filePath
 */
export async function deleteFromSupabase(filePath: string): Promise<boolean> {
  const { error } = await supabase.storage
    .from(SUPABASE_BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error('Lỗi khi xóa file trên Supabase Storage:', error);
    return false;
  }
  return true;
}

/**
 * Trích xuất filePath tương đối trong bucket từ Public URL của Supabase.
 * Ví dụ: "https://xxx.supabase.co/storage/v1/object/public/eduspace/blogs/abc.png" -> "blogs/abc.png"
 */
export function extractStoragePath(publicUrl: string): string | null {
  if (!publicUrl || typeof publicUrl !== 'string') return null;

  if (!publicUrl.startsWith('http://') && !publicUrl.startsWith('https://')) {
    return publicUrl;
  }

  try {
    const urlObj = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${SUPABASE_BUCKET_NAME}/`;
    const markerIndex = urlObj.pathname.indexOf(marker);

    if (markerIndex !== -1) {
      return decodeURIComponent(urlObj.pathname.substring(markerIndex + marker.length));
    }

    const segments = urlObj.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return decodeURIComponent(segments.slice(-2).join('/'));
    }

    return null;
  } catch (err) {
    console.error('Lỗi khi phân tích storage path từ URL:', err);
    return null;
  }
}

/**
 * Xóa danh sách các file ảnh minh chứng trên Supabase Storage dựa trên danh sách Public URLs.
 * Giúp tự động dọn dẹp rác khi xóa hoặc cập nhật UserSubscription.
 */
export async function cleanupProofImages(urls: (string | null | undefined)[] | null | undefined): Promise<number> {
  if (!urls || !Array.isArray(urls) || urls.length === 0) return 0;

  const validPaths: string[] = [];
  for (const url of urls) {
    if (url && typeof url === 'string') {
      const storagePath = extractStoragePath(url);
      if (storagePath) {
        validPaths.push(storagePath);
      }
    }
  }

  if (validPaths.length === 0) return 0;

  let deletedCount = 0;
  for (const path of validPaths) {
    const success = await deleteFromSupabase(path);
    if (success) {
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    console.log(`[Storage Cleanup] Đã tự động giải phóng ${deletedCount} file ảnh rác trên Supabase Storage.`);
  }

  return deletedCount;
}

function getExtensionFromMime(mimeType: string): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
  };
  return mimeMap[mimeType] || '';
}
