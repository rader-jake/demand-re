import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary if credentials exist
const hasCloudinary = !!(
  process.env.CLOUDINARY_URL || 
  (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
);

if (hasCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Configure S3 if credentials exist
const hasS3 = !!(
  process.env.AWS_ACCESS_KEY_ID && 
  process.env.AWS_SECRET_ACCESS_KEY && 
  process.env.AWS_S3_BUCKET
);

const s3Client = hasS3
  ? new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null;

/**
 * Uploads a local file to a publicly accessible storage location.
 * Priorities:
 * 1. Cloudinary (if configured)
 * 2. AWS S3 (if configured)
 * 3. Catbox.moe (zero-config public fallback)
 * 
 * @param filePath Absolute path to the local file to upload
 * @returns The public URL of the uploaded image
 */
export async function uploadFileToPublicStorage(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist at path: ${filePath}`);
  }

  // 1. Cloudinary Upload Strategy
  if (hasCloudinary) {
    try {
      console.log(`[UploadService] Uploading ${path.basename(filePath)} to Cloudinary...`);
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'matches',
      });
      return result.secure_url;
    } catch (error: any) {
      console.error(`[UploadService] Cloudinary upload failed:`, error.message || error);
      // Fall through to next strategy if Cloudinary fails
    }
  }

  // 2. AWS S3 Upload Strategy
  if (hasS3 && s3Client) {
    try {
      console.log(`[UploadService] Uploading ${path.basename(filePath)} to AWS S3...`);
      const fileContent = fs.readFileSync(filePath);
      const fileExtension = path.extname(filePath).toLowerCase();
      const fileKey = `uploads/${uuidv4()}${fileExtension}`;

      // Map common image types to Content-Type
      let contentType = 'application/octet-stream';
      if (fileExtension === '.png') contentType = 'image/png';
      else if (fileExtension === '.jpg' || fileExtension === '.jpeg') contentType = 'image/jpeg';
      else if (fileExtension === '.webp') contentType = 'image/webp';
      else if (fileExtension === '.gif') contentType = 'image/gif';

      await s3Client.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET!,
          Key: fileKey,
          Body: fileContent,
          ContentType: contentType,
        })
      );

      const region = process.env.AWS_REGION || 'us-east-1';
      return `https://${process.env.AWS_S3_BUCKET}.s3.${region}.amazonaws.com/${fileKey}`;
    } catch (error: any) {
      console.error(`[UploadService] AWS S3 upload failed:`, error.message || error);
      // Fall through to next strategy if S3 fails
    }
  }

  // 3. Catbox.moe Zero-Config Public Fallback Strategy
  try {
    console.log(`[UploadService] Uploading ${path.basename(filePath)} to Catbox.moe fallback...`);
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer]);
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', blob, path.basename(filePath));

    const response = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Catbox HTTP error: ${response.status} ${response.statusText}`);
    }

    const url = await response.text();
    if (!url || !url.startsWith('http')) {
      throw new Error(`Catbox returned invalid response: ${url}`);
    }

    console.log(`[UploadService] Successfully uploaded to Catbox: ${url.trim()}`);
    return url.trim();
  } catch (error: any) {
    console.error(`[UploadService] Catbox upload failed:`, error.message || error);
    throw new Error(`Failed to upload file to any public storage service: ${error.message}`);
  }
}
