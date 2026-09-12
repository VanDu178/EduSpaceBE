/**
 * TẦNG HÀM BỔ TRỢ & UTILITIES CHO MODULE VIDEOS
 */

/**
 * Tạo slug chuẩn SEO từ tiêu đề tiếng Việt
 */
export function generateVideoSlug(title: string): string {
  if (!title) return '';

  let slug = title.toLowerCase();

  // Đổi ký tự có dấu thành không dấu
  slug = slug
    .replace(/[áàảãạâấầẩẫậăắằẳẵặ]/g, 'a')
    .replace(/[éèẻẽẹêếềểễệ]/g, 'e')
    .replace(/[iíìỉĩị]/g, 'i')
    .replace(/[óòỏõọôốồổỗộơớờởỡợ]/g, 'o')
    .replace(/[úùủũụưứừửữự]/g, 'u')
    .replace(/[ýỳỷỹỵ]/g, 'y')
    .replace(/đ/g, 'd');

  // Xóa các ký tự đặc biệt
  slug = slug
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  // Loại bỏ bớt dấu gạch ở đầu/cuối
  return slug.replace(/^-+|-+$/g, '');
}

/**
 * Sinh mã Video tự động viết hoa (mặc định dạng VID-XXXXX)
 */
export function generateVideoCode(): string {
  const randomStr = Math.floor(10000 + Math.random() * 90000).toString();
  return `VID-${randomStr}`;
}

/**
 * Trích xuất YouTube Video ID từ link full YouTube hoặc trả về chính chuỗi nếu đã là ID
 * Ví dụ: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" -> "dQw4w9WgXcQ"
 * "https://youtu.be/dQw4w9WgXcQ" -> "dQw4w9WgXcQ"
 */
export function extractYoutubeVideoId(urlOrId: string | null | undefined): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();

  // Regex trích xuất ID YouTube chuẩn
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = trimmed.match(regExp);

  if (match && match[2].length === 11) {
    return match[2];
  }

  // Nếu dài đúng 11 ký tự không chứa slash, coi là ID đã được nhập sẵn
  if (trimmed.length === 11 && !trimmed.includes('/')) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Gọi YouTube oEmbed API để kiểm tra tính tồn tại của YouTube Video ID và tự động lấy ảnh Thumbnail
 */
export async function fetchYoutubeMetadata(youtubeVideoId: string): Promise<{ isValid: boolean; thumbnailUrl: string | null; title?: string }> {
  if (!youtubeVideoId || !/^[a-zA-Z0-9_-]{11}$/.test(youtubeVideoId)) {
    return { isValid: false, thumbnailUrl: null };
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${youtubeVideoId}&format=json`;
    const response = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });

    if (!response.ok) {
      return { isValid: false, thumbnailUrl: null };
    }

    const data: any = await response.json();
    const thumbnailUrl = data.thumbnail_url || `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;

    return {
      isValid: true,
      thumbnailUrl,
      title: data.title,
    };
  } catch (error) {
    console.error('Lỗi khi kiểm tra YouTube Video ID:', error);
    // Nếu fetch lỗi mạng nhưng ID có đúng 11 ký tự, có thể fallback lấy đường dẫn ảnh thumbnail chuẩn YouTube
    return {
      isValid: true,
      thumbnailUrl: `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`,
    };
  }
}

/**
 * Cắt ngắn nội dung file HLS Variant Playlist (.m3u8) dựa theo thời lượng xem thử (teaserDuration - tính bằng giây)
 * và tự động chuẩn hóa các URL phân đoạn tương đối thành URL tuyệt đối trên CDN
 */
export function truncateHlsVariantPlaylist(
  m3u8Content: string,
  teaserDuration: number,
  baseUrl?: string
): string {
  if (teaserDuration === undefined || teaserDuration === null || teaserDuration < 0) {
    teaserDuration = 180;
  }

  const cleanBaseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : '';
  const lines = m3u8Content.split('\n');
  const resultLines: string[] = [];
  let accumulatedDuration = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const match = line.match(/#EXTINF:([\d.]+)/);
      const segmentDuration = match ? parseFloat(match[1]) : 6.0;

      if (accumulatedDuration + segmentDuration > teaserDuration) {
        break;
      }

      accumulatedDuration += segmentDuration;
      resultLines.push(line);

      // Dòng tiếp theo trong HLS variant là tên file segment .ts
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && !nextLine.startsWith('#')) {
          let segmentUrl = nextLine;
          if (cleanBaseUrl && !segmentUrl.startsWith('http://') && !segmentUrl.startsWith('https://')) {
            segmentUrl = `${cleanBaseUrl}/${segmentUrl.replace(/^\/+/, '')}`;
          }
          resultLines.push(segmentUrl);
          i++;
        }
      }
    } else if (line.startsWith('#EXT-X-ENDLIST')) {
      continue;
    } else {
      let processedLine = line;
      if (cleanBaseUrl && !processedLine.startsWith('#') && !processedLine.startsWith('http://') && !processedLine.startsWith('https://')) {
        processedLine = `${cleanBaseUrl}/${processedLine.replace(/^\/+/, '')}`;
      }
      resultLines.push(processedLine);
    }
  }

  // Luôn thêm #EXT-X-ENDLIST ở cuối
  resultLines.push('#EXT-X-ENDLIST');
  return resultLines.join('\n');
}


