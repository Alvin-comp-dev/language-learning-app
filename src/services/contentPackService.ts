import { supabase } from '../config/supabase';
import type { ContentPack, UserContentPack } from '../config/supabase';
import { paymentService } from './paymentService';

class ContentPackService {
  // Fetch all available content packs for a language
  async getContentPacks(language: string): Promise<ContentPack[]> {
    const { data, error } = await supabase
      .from('content_packs')
      .select('*')
      .eq('language', language);

    if (error) throw error;
    return data;
  }

  // Get user's purchased content packs
  async getUserContentPacks(userId: string): Promise<UserContentPack[]> {
    const { data, error } = await supabase
      .from('user_content_packs')
      .select(`
        *,
        content_packs (*)
      `)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) throw error;
    return data;
  }

  // Purchase a content pack
  async purchaseContentPack(userId: string, contentPackId: string): Promise<UserContentPack> {
    // First check if user already owns this pack
    const { data: existingPack } = await supabase
      .from('user_content_packs')
      .select('*')
      .eq('user_id', userId)
      .eq('content_pack_id', contentPackId)
      .single();

    if (existingPack) {
      throw new Error('You already own this content pack');
    }

    // Get content pack details
    const { data: contentPack, error: packError } = await supabase
      .from('content_packs')
      .select('*')
      .eq('id', contentPackId)
      .single();

    if (packError || !contentPack) {
      throw new Error('Content pack not found');
    }

    // Process payment
    await paymentService.processContentPackPurchase(userId, contentPack);

    // Add pack to user's library
    const { data, error } = await supabase
      .from('user_content_packs')
      .insert({
        user_id: userId,
        content_pack_id: contentPackId,
        status: 'active'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Check if user has access to a specific content pack
  async hasAccess(userId: string, contentPackId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('user_content_packs')
      .select('id')
      .eq('user_id', userId)
      .eq('content_pack_id', contentPackId)
      .eq('status', 'active')
      .single();

    if (error) return false;
    return !!data;
  }

  // Get lessons from a content pack
  async getContentPackLessons(contentPackId: string) {
    const { data: contentPack, error: packError } = await supabase
      .from('content_packs')
      .select('lessons')
      .eq('id', contentPackId)
      .single();

    if (packError || !contentPack) {
      throw new Error('Content pack not found');
    }

    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('*')
      .in('id', contentPack.lessons);

    if (lessonsError) throw lessonsError;
    return lessons;
  }
}

export const contentPackService = new ContentPackService(); 