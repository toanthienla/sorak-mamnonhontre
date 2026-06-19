import { z } from 'zod';

export const STUDENT_STATUS_LABELS = {
  'đang học': 'Đang học',
  'thôi học': 'Thôi học',
  'chuyển trường': 'Chuyển trường',
  active: 'Đang học',
  inactive: 'Thôi học',
};

export const ROLE_LABELS = {
  PRINCIPAL: 'Ban Giám Hiệu',
  TEACHER: 'Giáo viên',
  PARENT: 'Phụ huynh',
};

export const assignSchema = z.object({
  role: z.enum(['PRINCIPAL', 'TEACHER']),
  password: z.union([z.string().min(6, 'Tối thiểu 6 ký tự'), z.literal('')]).optional(),
});

export const resetPwSchema = z.object({
  password: z.string().min(6, 'Tối thiểu 6 ký tự'),
});

export const WORK_STATUS_VALUES = [
  'Đang làm việc',
  'Chuyển đến',
  'Đã chuyển đi',
  'Đã điều động',
  'Chờ nghỉ hưu',
  'Đã nghỉ hưu',
  'Đã biệt phái',
  'Thôi việc',
];

export const STAFF_COLS = [
  { key: 'role', label: 'Vai trò' },
  { key: 'full_name', label: 'Họ tên' },
  { key: 'position', label: 'Chức vụ' },
  { key: 'work_status', label: 'Trạng thái CB' },
  { key: 'email', label: 'Email' },
  { key: 'is_active', label: 'Trạng thái TK' },
];

export const STUDENT_ACC_COLS = [
  { key: 'student_id_card_number', label: 'Mã thẻ' },
  { key: 'full_name', label: 'Họ tên' },
  { key: 'student_status', label: 'Trạng thái HS' },
  { key: 'is_active', label: 'Trạng thái TK' },
];
