import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Hook for secondary market data operations
 */
export function useSecondaryObjects(filters = {}) {
  return useQuery({
    queryKey: ['secondary-objects', filters],
    queryFn: async () => {
      const query = {
        marketType: 'secondary',
        ...filters
      };
      return base44.entities.SecondaryObject.filter(query, '-created_date', 100);
    }
  });
}

export function useSecondaryBuyerProfiles(filters = {}) {
  return useQuery({
    queryKey: ['secondary-buyer-profiles', filters],
    queryFn: async () => {
      const query = {
        marketType: 'secondary',
        ...filters
      };
      return base44.entities.SecondaryBuyerProfile.filter(query, '-created_date', 100);
    }
  });
}

export function useSecondaryObject(id) {
  return useQuery({
    queryKey: ['secondary-object', id],
    queryFn: () => base44.entities.SecondaryObject.get(id),
    enabled: !!id
  });
}

export function useBuyerProfile(id) {
  return useQuery({
    queryKey: ['buyer-profile', id],
    queryFn: () => base44.entities.SecondaryBuyerProfile.get(id),
    enabled: !!id
  });
}

export function useConvertToSecondaryObject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.functions.invoke('convertToSecondaryObject', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secondary-objects'] });
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
    }
  });
}

export function useConvertToSecondaryBuyerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.functions.invoke('convertToSecondaryBuyerProfile', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['secondary-buyer-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['inquiries'] });
    }
  });
}

export function useValidateSecondaryReservation() {
  return useMutation({
    mutationFn: (data) => base44.functions.invoke('validateSecondaryReservation', data)
  });
}

export function useCreateSecondaryReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => base44.functions.invoke('createReservation', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    }
  });
}