import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hqtpxaeuhsovwhevztzi.supabase.co';
const supabaseKey = import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_LqxmEMuUaDLwfIAC0NshEA_RwTkK-f4';

export const supabase = createClient(supabaseUrl, supabaseKey);
