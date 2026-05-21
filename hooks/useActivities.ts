import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Activity, WatchlistItem } from '../types';

export function useActivities(city?: string, category?: string) {
  return useQuery({
    queryKey: ['activities', city, category],
    queryFn: async () => {
      let query = supabase
        .from('activities')
        .select('*')
        .order('registration_opens_at', { ascending: true });

      if (city) query = query.ilike('city', `%${city}%`);
      if (category && category !== 'all') query = query.eq('category', category);

      const { data, error } = await query;
      if (error) throw error;
      return data as Activity[];
    },
  });
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: ['activity', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as Activity;
    },
  });
}

export function useWatchlist() {
  return useQuery({
    queryKey: ['watchlist'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('watchlist')
        .select('*, activity:activities(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WatchlistItem[];
    },
  });
}

export function useAddToWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      activityId,
      notifyDaysBefore = 3,
    }: {
      activityId: string;
      notifyDaysBefore?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('watchlist')
        .insert({
          user_id: user.id,
          activity_id: activityId,
          notify_days_before: notifyDaysBefore,
          notify_via_push: true,
          notify_via_email: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });
}

export function useRemoveFromWatchlist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (watchlistId: string) => {
      const { error } = await supabase
        .from('watchlist')
        .delete()
        .eq('id', watchlistId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchlist'] });
    },
  });
}

export function useSubmitActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activity: Omit<Activity, 'id' | 'created_at' | 'is_verified' | 'submitted_by'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('activities')
        .insert({ ...activity, submitted_by: user.id, is_verified: false })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}
