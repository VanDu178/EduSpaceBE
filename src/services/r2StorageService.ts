import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { AppError } from '../utils/appError';

let s3ClientInstance: S3Client | null = null;

/**
 * Lấy hoặc khởi tạo Singleton S3Client tương thích Cloudflare R2
 */
export function getR2Client(): S3Client {
  if (s3ClientInstance) {
    return s3ClientInstance;
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new AppError(
      'Cấu hình Cloudflare R2 chưa đầy đủ trong .env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)',
      500,
      'R2_CONFIG_MISSING'
    );
  }

  s3ClientInstance = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });

  return s3ClientInstance;
}

/**
 * Tạo URL Công khai (Public URL) cho tệp trên R2
 */
export function getR2PublicUrl(key: string): string {
  const publicDomain = process.env.R2_PUBLIC_DOMAIN || '';
  const cleanDomain = publicDomain.endsWith('/') ? publicDomain.slice(0, -1) : publicDomain;
  const cleanKey = key.startsWith('/') ? key.slice(1) : key;
  
  if (!cleanDomain) {
    return `/${cleanKey}`;
  }
  return `${cleanDomain}/${cleanKey}`;
}

/**
 * 1. Khởi tạo Multipart Upload Session trên Cloudflare R2
 */
export async function initR2MultipartUpload(key: string, contentType: string) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;

  if (!bucket) {
    throw new AppError('Tên Bucket Cloudflare R2 chưa được thiết lập trong .env', 500, 'R2_BUCKET_MISSING');
  }

  const command = new CreateMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const response = await client.send(command);

  if (!response.UploadId) {
    throw new AppError('Khởi tạo Multipart Upload trên Cloudflare R2 thất bại!', 500, 'R2_INIT_FAILED');
  }

  return {
    uploadId: response.UploadId,
    key,
    bucket,
    fileUrl: getR2PublicUrl(key),
  };
}

/**
 * 2. Sinh danh sách Presigned URLs cho từng part
 */
export async function generateR2UploadPartPresignedUrls(
  key: string,
  uploadId: string,
  partsCount: number
) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;

  if (!bucket) {
    throw new AppError('Tên Bucket Cloudflare R2 chưa được thiết lập trong .env', 500, 'R2_BUCKET_MISSING');
  }

  const presignedUrls: Array<{ partNumber: number; url: string }> = [];

  for (let partNumber = 1; partNumber <= partsCount; partNumber++) {
    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const url = await getSignedUrl(client, command, { expiresIn: 3600 });
    presignedUrls.push({ partNumber, url });
  }

  return presignedUrls;
}

/**
 * 3. Hoàn tất ghép các Part (Complete Multipart Upload)
 */
export async function completeR2MultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ PartNumber: number; ETag: string }>
) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;

  if (!bucket) {
    throw new AppError('Tên Bucket Cloudflare R2 chưa được thiết lập trong .env', 500, 'R2_BUCKET_MISSING');
  }

  // Sắp xếp các part theo đúng thứ tự PartNumber tăng dần
  const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);

  const command = new CompleteMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sortedParts,
    },
  });

  const response = await client.send(command);

  return {
    key,
    location: response.Location || getR2PublicUrl(key),
    fileUrl: getR2PublicUrl(key),
  };
}

/**
 * 4. Huỷ phiên Multipart Upload nếu gặp lỗi
 */
export async function abortR2MultipartUpload(key: string, uploadId: string) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;

  if (!bucket) {
    throw new AppError('Tên Bucket Cloudflare R2 chưa được thiết lập trong .env', 500, 'R2_BUCKET_MISSING');
  }

  const command = new AbortMultipartUploadCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
  });

  await client.send(command);
  return { success: true, key, uploadId };
}

/**
 * 5. Sinh Presigned Single PUT URL cho tệp nhỏ (như Thumbnail)
 */
export async function generateR2SinglePresignedUrl(key: string, contentType: string) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;

  if (!bucket) {
    throw new AppError('Tên Bucket Cloudflare R2 chưa được thiết lập trong .env', 500, 'R2_BUCKET_MISSING');
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 });

  return {
    key,
    presignedUrl,
    fileUrl: getR2PublicUrl(key),
  };
}

/**
 * 6. Xoá tệp trên Cloudflare R2
 */
export async function deleteR2Object(key: string) {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;

  if (!bucket) {
    throw new AppError('Tên Bucket Cloudflare R2 chưa được thiết lập trong .env', 500, 'R2_BUCKET_MISSING');
  }

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
  return { success: true, key };
}
