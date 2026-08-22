import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Làm sạch Supabase URL (loại bỏ /rest/v1/ nếu người dùng truyền nhầm vào)
const rawUrl = process.env.SUPABASE_URL || '';
const cleanUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!cleanUrl || !supabaseKey) {
  console.warn('Supabase URL hoặc API Key chưa được cấu hình đầy đủ trong file .env');
}

export const supabase: SupabaseClient = createClient(cleanUrl, supabaseKey, {
  auth: {
    persistSession: false
  }
});

export const SUPABASE_BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'TradeVerse';
