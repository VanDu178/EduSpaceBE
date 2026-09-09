import crypto from 'crypto';

/**
 * Service tích hợp REST API của Bunny Stream VOD Platform (Dùng Native Fetch của Node.js)
 */

export interface CreateBunnyVideoResult {
  videoId: string;
  libraryId: string;
  uploadUrl: string;
  apiKey: string;
  cdnHostname: string;
  signature: string;
  expirationTime: number;
}

/**
 * Lấy các cấu hình Bunny Stream từ môi trường (Environment Variables)
 */
export function getBunnyConfig() {
  const libraryId = process.env.BUNNY_LIBRARY_ID || '';
  const apiKey = process.env.BUNNY_STREAM_API_KEY || '';
  const cdnHostname = process.env.BUNNY_CDN_HOSTNAME || 'video-eduspace.b-cdn.net';
  const webhookSecret = process.env.BUNNY_WEBHOOK_SECRET || '';

  return { libraryId, apiKey, cdnHostname, webhookSecret };
}

/**
 * Tạo chữ ký TUS Authentication Signature (SHA256 Token) có thời hạn bảo mật
 * Formula: sha256(libraryId + apiKey + expirationTime + videoId)
 */
export function generateBunnyTusSignature(videoId: string, expirationTime: number): string {
  const { libraryId, apiKey } = getBunnyConfig();
  const rawString = `${libraryId}${apiKey}${expirationTime}${videoId}`;
  return crypto.createHash('sha256').update(rawString).digest('hex');
}

/**
 * Khởi tạo container video mới trên Bunny Stream để cấp thông số Upload cho Client (Frontend)
 * @param title Tiêu đề file video
 */
export async function createBunnyVideoSession(title: string): Promise<CreateBunnyVideoResult> {
  const { libraryId, apiKey, cdnHostname } = getBunnyConfig();

  if (!libraryId || !apiKey) {
    throw new Error('Chưa cấu hình BUNNY_LIBRARY_ID hoặc BUNNY_STREAM_API_KEY trong .env');
  }

  const response = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: 'POST',
    headers: {
      AccessKey: apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({ title: title || 'Untitled Video' }),
  });

  const resData = (await response.json()) as any;
  if (!response.ok) {
    throw new Error(resData?.message || 'Khởi tạo video Bunny Stream thất bại');
  }

  const videoId = resData.guid;
  const uploadUrl = `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`;

  // Thời gian hết hạn của TUS signature: 1 giờ (3600s)
  const expirationTime = Math.floor(Date.now() / 1000) + 3600;
  const signature = generateBunnyTusSignature(videoId, expirationTime);

  return {
    videoId,
    libraryId,
    uploadUrl,
    apiKey,
    cdnHostname,
    signature,
    expirationTime,
  };
}

/**
 * Xóa video trên Bunny Stream khi bản ghi Video bị xóa trong DB
 * @param videoId GUID của video trên Bunny Stream
 */
export async function deleteBunnyVideo(videoId: string): Promise<boolean> {
  const { libraryId, apiKey } = getBunnyConfig();

  if (!libraryId || !apiKey || !videoId) return false;

  try {
    const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
      method: 'DELETE',
      headers: {
        AccessKey: apiKey,
        accept: 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.warn(`[BUNNY STREAM] Xóa video ${videoId} thất bại (HTTP ${res.status}): ${errorText}`);
      return false;
    }

    console.log(`[BUNNY STREAM] Xóa thành công video ${videoId} trên Bunny Stream`);
    return true;
  } catch (error: any) {
    console.warn(`[BUNNY STREAM] Không thể xóa video ${videoId}:`, error?.message);
    return false;
  }
}

/**
 * Tạo URL luồng phát HLS (.m3u8) từ Bunny CDN
 * @param videoId GUID video hoặc đường dẫn lưu trữ
 */
export function getBunnyHlsUrl(videoId: string): string {
  if (!videoId) return '';

  if (videoId.startsWith('http://') || videoId.startsWith('https://')) {
    return videoId;
  }

  const { cdnHostname } = getBunnyConfig();
  let cleanId = videoId.replace(/^bunny:\/\//, '').trim();

  if (cleanId.startsWith('http://') || cleanId.startsWith('https://')) {
    return cleanId;
  }

  const guidMatch = cleanId.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  if (guidMatch) {
    cleanId = guidMatch[0];
  }

  return `https://${cdnHostname}/${cleanId}/playlist.m3u8`;
}

/**
 * Lấy thông tin và trạng thái mã hóa thực tế của video trên Bunny Stream REST API
 * @param videoId GUID video trên Bunny Stream
 */
export async function getBunnyVideoDetails(videoId: string): Promise<{ status: number; encodeProgress: number } | null> {
  const { libraryId, apiKey } = getBunnyConfig();

  if (!libraryId || !apiKey || !videoId) return null;

  try {
    const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`, {
      method: 'GET',
      headers: {
        AccessKey: apiKey,
        accept: 'application/json',
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as any;
    return {
      status: data.status,
      encodeProgress: data.encodeProgress ?? (data.status === 3 ? 100 : 0),
    };
  } catch (error: any) {
    console.warn(`[BUNNY STREAM] Không thể kiểm tra trạng thái video ${videoId}:`, error?.message);
    return null;
  }
}

