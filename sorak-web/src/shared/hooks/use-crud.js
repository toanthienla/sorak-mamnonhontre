import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { toast } from 'sonner';

function unwrap(data) {
  const root = data;
  if (root?.data && typeof root.data === 'object' && 'data' in root.data) {
    return root.data.data;
  }
  return root?.data ?? data;
}

export function useList(key, path, params, opts) {
  return useQuery({
    queryKey: [key, params],
    queryFn: async () => {
      const res = await apiClient.get(path, { params });
      const body = res.data;
      return { data: body.data ?? [], meta: body.meta };
    },
    ...opts,
  });
}

export function useDetail(key, path, id) {
  return useQuery({
    queryKey: [key, id],
    enabled: id != null,
    queryFn: async () => {
      const res = await apiClient.get(`${path}/${id}`);
      return unwrap(res.data);
    },
  });
}

function refresh(qc, key) {
  qc.invalidateQueries({ queryKey: [key] });
  qc.refetchQueries({ queryKey: [key], type: 'all' });
}

export function useCreate(invalidateKey, path, successMsg = 'Tạo thành công') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto) => {
      const res = await apiClient.post(path, dto);
      return unwrap(res.data);
    },
    onSuccess: () => {
      toast.success(successMsg);
      refresh(qc, invalidateKey);
    },
  });
}

export function useUpdate(invalidateKey, path, successMsg = 'Cập nhật thành công') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await apiClient.patch(`${path}/${id}`, data);
      return unwrap(res.data);
    },
    onSuccess: () => {
      toast.success(successMsg);
      refresh(qc, invalidateKey);
    },
  });
}

export function useDelete(invalidateKey, path, successMsg = 'Xóa thành công') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const res = await apiClient.delete(`${path}/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success(successMsg);
      refresh(qc, invalidateKey);
    },
  });
}
