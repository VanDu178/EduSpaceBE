import { AppError } from '../utils/appError';
import { checkUserFeatureAccess } from './featureAccessService';

export type AccessBehavior = 'teaser' | 'metadata_only' | 'strict_gate';

export interface AuthenticatedUser {
  id: number;
  role: string;
  isPremium?: boolean;
  [key: string]: any;
}

export interface AccessPolicyOptions<T> {
  resourceType: 'video' | 'blog' | 'tool' | string;
  resource: T;
  featureCode: string;
  user?: AuthenticatedUser;
  behaviorOnDenied?: AccessBehavior;
  customSanitizer?: (resource: T, behavior: AccessBehavior) => Partial<T>;
}

/**
 * Utility ẩn các trường dữ liệu nhạy cảm dựa trên Loại tài nguyên và Chiến lược (AccessBehavior)
 */

function defaultSanitizer<T extends Record<string, any>>(
  resourceType: string,
  resource: T,
  behavior: AccessBehavior
): Partial<T> {
  // Loại B: Metadata Only (Tools, Indicators, Trading Signals - MOCK Implementation)
  if (behavior === 'metadata_only') {
    const { formulaConfig, secretKey, apiEndpoint, scriptCode, fullDataSignalHistory, ...metadata } = resource;
    return {
      ...metadata,
      hasFullAccess: false,
      isPremium: true,
      accessMessage: 'Bạn cần nâng cấp gói hội viên để xem toàn bộ cấu hình công cụ này.',
    } as unknown as Partial<T>;
  }

  // Loại A: Teaser (Video, Blog, Khóa học)
  if (resourceType === 'video') {
    return {
      ...resource,
      videoUrl: null,
      storagePath: null,
      youtubeVideoId: null,
      hasFullAccess: false,
    };
  }

  if (resourceType === 'blog') {
    let teaserContent = resource.summary ? `<p>${resource.summary}</p>` : '';
    if (resource.content && resource.content.includes('<!--more-->')) {
      teaserContent = resource.content.split('<!--more-->')[0];
    } else if (resource.content && resource.content.length > 350) {
      teaserContent = resource.content.slice(0, 350) + '...';
    } else if (resource.content) {
      teaserContent = resource.content;
    }

    return {
      ...resource,
      content: teaserContent,
      hasFullAccess: false,
    };
  }

  // Mặc định trả về resource với cờ hasFullAccess = false
  return {
    ...resource,
    hasFullAccess: false,
  };
}

/**
 * Resource Access Policy Engine Trung tâm
 * Tự động kiểm tra quyền theo chuẩn:
 * 1. Nếu tài nguyên là FREE -> Full Access ngay lập tức (0 DB query).
 * 2. Nếu User là Admin -> Full Access.
 * 3. Nếu User có quyền gói hội viên -> Full Access.
 * 4. Nếu không có quyền -> Xử lý theo Chiến lược (teaser, metadata_only, strict_gate).
 */
export async function evaluateResourceAccess<T extends Record<string, any>>(
  options: AccessPolicyOptions<T>
) {
  const {
    resourceType,
    resource,
    featureCode,
    user,
    behaviorOnDenied = 'teaser',
    customSanitizer,
  } = options;

  // BƯỚC 1: Nếu là Admin -> Full Access ngay bất kể trạng thái hay gói
  if (user?.role === 'admin') {
    return {
      hasFullAccess: true,
      data: {
        ...resource,
        hasFullAccess: true,
      },
    };
  }

  // BƯỚC 2: Kiểm tra trạng thái xuất bản (dành cho người dùng thường)
  if (resource.status && resource.status !== 'published') {
    throw new AppError('Tài nguyên không tồn tại hoặc chưa được xuất bản', 404, 'NOT_FOUND');
  }

  // BƯỚC 3: Nếu là FREE (isPremium = false) -> Full Access ngay (0 DB Query)
  if (!resource.isPremium) {
    return {
      hasFullAccess: true,
      data: {
        ...resource,
        hasFullAccess: true,
      },
    };
  }

  // BƯỚC 4: Kiểm tra quyền truy cập tính năng nếu người dùng đã đăng nhập
  if (user && user.id) {
    const { hasAccess } = await checkUserFeatureAccess(user.id, featureCode);
    if (hasAccess) {
      return {
        hasFullAccess: true,
        data: {
          ...resource,
          hasFullAccess: true,
        },
      };
    }
  }

  // BƯỚC 5: KHÔNG CÓ QUYỀN -> Xử lý theo Chiến lược (AccessBehavior)
  if (behaviorOnDenied === 'strict_gate') {
    throw new AppError('Bạn cần nâng cấp gói hội viên để sử dụng tài nguyên này', 403, 'FEATURE_REQUIRED');
  }

  const sanitizedData = customSanitizer
    ? customSanitizer(resource, behaviorOnDenied)
    : defaultSanitizer(resourceType, resource, behaviorOnDenied);

  return {
    hasFullAccess: false,
    data: {
      ...sanitizedData,
      hasFullAccess: false,
      requiredFeatureCode: featureCode,
      behavior: behaviorOnDenied,
    },
  };
}
