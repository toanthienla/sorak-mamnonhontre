import swaggerJsdoc from 'swagger-jsdoc';

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Sorak API',
    version: '1.0.0',
    description: 'Hệ thống quản lý giáo dục mầm non — Trường Mầm non Hòn Tre, Kiên Hải',
    contact: { name: 'Sorak Team' },
  },
  servers: [
    { url: '/api', description: 'Current server' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      // ── Auth ──────────────────────────────────────────────────────────────
      LoginRequest: {
        type: 'object', required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'phanthihoa@edu.vn' },
          password: { type: 'string', example: 'Hoa@12345' },
        },
      },
      ParentLoginRequest: {
        type: 'object', required: ['student_id_card_number', 'password'],
        properties: {
          student_id_card_number: { type: 'string', example: 'NMK2025.001' },
          password: { type: 'string', example: 'NMK2025.001' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          user: { $ref: '#/components/schemas/UserInfo' },
        },
      },
      UserInfo: {
        type: 'object',
        properties: {
          account_id: { type: 'integer' },
          teacher_id: { type: 'integer' },
          email: { type: 'string' },
          full_name: { type: 'string' },
          role: { type: 'string', enum: ['BGH', 'GV', 'PH'] },
        },
      },
      // ── Teacher ───────────────────────────────────────────────────────────
      Teacher: {
        type: 'object',
        properties: {
          teacher_id: { type: 'integer' },
          account_id: { type: 'integer', nullable: true },
          full_name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string', nullable: true },
          gender: { type: 'string', nullable: true },
          date_of_birth: { type: 'string', format: 'date-time', nullable: true },
          position: { type: 'string', nullable: true },
          work_status: { type: 'string', default: 'Đang làm việc' },
          qualification: { type: 'string', nullable: true },
          deleted_at: { type: 'string', format: 'date-time', nullable: true },
          account: {
            type: 'object', nullable: true,
            properties: { role: { type: 'string' }, is_active: { type: 'boolean' } },
          },
        },
      },
      CreateTeacher: {
        type: 'object', required: ['full_name', 'email', 'position'],
        properties: {
          full_name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          position: { type: 'string' },
          phone: { type: 'string' },
          gender: { type: 'string', enum: ['Nam', 'Nữ', 'Khác'] },
          date_of_birth: { type: 'string', format: 'date' },
          work_status: { type: 'string' },
          qualification: { type: 'string' },
          address: { type: 'string' },
          work_start_date: { type: 'string', format: 'date' },
        },
      },
      // ── Student ───────────────────────────────────────────────────────────
      Student: {
        type: 'object',
        properties: {
          student_id: { type: 'integer' },
          student_id_card_number: { type: 'string' },
          full_name: { type: 'string' },
          date_of_birth: { type: 'string', format: 'date-time' },
          gender: { type: 'string' },
          grade_level: { type: 'string', nullable: true },
          student_status: { type: 'string', default: 'Đang học' },
          photo_url: { type: 'string', nullable: true },
          account: { type: 'object', nullable: true, properties: { is_active: { type: 'boolean' } } },
        },
      },
      CreateStudent: {
        type: 'object', required: ['full_name', 'date_of_birth', 'gender'],
        properties: {
          full_name: { type: 'string' },
          date_of_birth: { type: 'string', format: 'date' },
          gender: { type: 'string', enum: ['Nam', 'Nữ'] },
          grade_level: { type: 'string' },
          enrollment_date: { type: 'string', format: 'date' },
          class_id: { type: 'integer' },
          parents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                full_name: { type: 'string' },
                relationship: { type: 'string' },
                phone: { type: 'string' },
              },
            },
          },
        },
      },
      // ── Class ─────────────────────────────────────────────────────────────
      Class: {
        type: 'object',
        properties: {
          class_id: { type: 'integer' },
          class_name: { type: 'string' },
          school_year_id: { type: 'integer' },
          age_group: { type: 'string', nullable: true },
          room: { type: 'string', nullable: true },
          deleted_at: { type: 'string', format: 'date-time', nullable: true },
          school_year: { type: 'object', properties: { name: { type: 'string' } } },
          teacher_classes: { type: 'array', items: { type: 'object' } },
        },
      },
      // ── Academic Year ─────────────────────────────────────────────────────
      SchoolYear: {
        type: 'object',
        properties: {
          school_year_id: { type: 'integer' },
          name: { type: 'string', example: '2025-2026' },
          start_date: { type: 'string', format: 'date-time' },
          end_date: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['upcoming', 'active', 'closed'] },
        },
      },
      // ── Common ────────────────────────────────────────────────────────────
      PaginatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'array', items: {} },
          meta: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              pageSize: { type: 'integer' },
              total: { type: 'integer' },
              totalPages: { type: 'integer' },
            },
          },
        },
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {},
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          code: { type: 'string' },
          message: { type: 'string' },
          traceId: { type: 'string' },
          timestamp: { type: 'string' },
          path: { type: 'string' },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    // ── AUTH ──────────────────────────────────────────────────────────────────
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập BGH/GV',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } } },
        responses: {
          200: { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          401: { description: 'Sai email/mật khẩu' },
        },
      },
    },
    '/auth/parent-login': {
      post: {
        tags: ['Auth'],
        summary: 'Đăng nhập phụ huynh',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ParentLoginRequest' } } } },
        responses: { 200: { description: 'OK' }, 401: { description: 'Sai mã thẻ/mật khẩu' } },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'], summary: 'Refresh access token', security: [],
        responses: { 200: { description: 'New access token' } },
      },
    },
    '/auth/logout': {
      post: { tags: ['Auth'], summary: 'Đăng xuất', responses: { 200: { description: 'OK' } } },
    },
    '/auth/me': {
      get: { tags: ['Auth'], summary: 'Lấy thông tin user hiện tại', responses: { 200: { description: 'User info' } } },
    },
    '/auth/forgot-password': {
      post: { tags: ['Auth'], summary: 'Gửi OTP quên mật khẩu (BGH/GV)', security: [], responses: { 200: { description: 'OTP sent' } } },
    },
    '/auth/reset-password': {
      post: { tags: ['Auth'], summary: 'Đặt lại mật khẩu bằng OTP', security: [], responses: { 200: { description: 'OK' } } },
    },
    '/auth/change-password': {
      post: { tags: ['Auth'], summary: 'Đổi mật khẩu (đã đăng nhập)', responses: { 200: { description: 'OK' } } },
    },

    // ── TEACHERS ─────────────────────────────────────────────────────────────
    '/teachers': {
      get: {
        tags: ['Teachers'], summary: 'Danh sách cán bộ',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'pageSize', schema: { type: 'integer', default: 20 } },
          { in: 'query', name: 'search', schema: { type: 'string' } },
          { in: 'query', name: 'role', schema: { type: 'string', enum: ['BGH', 'GV', 'none'] } },
          { in: 'query', name: 'work_status', schema: { type: 'string' } },
          { in: 'query', name: 'is_active', schema: { type: 'string', enum: ['true', 'false'] } },
          { in: 'query', name: 'include_deleted', schema: { type: 'string', enum: ['true', 'false'] } },
        ],
        responses: { 200: { description: 'Paginated teachers', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedResponse' } } } } },
      },
      post: {
        tags: ['Teachers'], summary: 'Tạo cán bộ mới (BGH)',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTeacher' } } } },
        responses: { 200: { description: 'Created teacher' } },
      },
    },
    '/teachers/{id}': {
      get: { tags: ['Teachers'], summary: 'Chi tiết cán bộ', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Teacher detail' } } },
      patch: { tags: ['Teachers'], summary: 'Cập nhật cán bộ (BGH)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTeacher' } } } }, responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Teachers'], summary: 'Lưu trữ cán bộ (BGH)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Soft deleted' } } },
    },
    '/teachers/{id}/restore': {
      patch: { tags: ['Teachers'], summary: 'Khôi phục cán bộ', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Restored' } } },
    },
    '/teachers/export/excel': {
      get: { tags: ['Teachers'], summary: 'Export Excel cán bộ', responses: { 200: { description: 'Excel file' } } },
    },
    '/teachers/import': {
      post: { tags: ['Teachers'], summary: 'Import Excel cán bộ', requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Import result' } } },
    },

    // ── ACCOUNTS ─────────────────────────────────────────────────────────────
    '/accounts/{id}/assign-role': {
      post: {
        tags: ['Accounts'], summary: 'Cấp role + mật khẩu cho cán bộ (BGH)',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' }, description: 'teacher_id' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { role: { type: 'string', enum: ['BGH', 'GV'] }, password: { type: 'string' } } } } } },
        responses: { 200: { description: 'Role assigned' } },
      },
    },
    '/accounts/{id}/active': {
      patch: {
        tags: ['Accounts'], summary: 'Khóa/mở khóa tài khoản (BGH)',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' }, description: 'account_id' }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { is_active: { type: 'boolean' } } } } } },
        responses: { 200: { description: 'Updated' } },
      },
    },

    // ── ACADEMIC YEARS ────────────────────────────────────────────────────────
    '/academic-years': {
      get: { tags: ['Academic Years'], summary: 'Danh sách năm học', responses: { 200: { description: 'List school years' } } },
      post: { tags: ['Academic Years'], summary: 'Tạo năm học mới (BGH)', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/SchoolYear' } } } }, responses: { 200: { description: 'Created' } } },
    },
    '/academic-years/{id}': {
      get: { tags: ['Academic Years'], summary: 'Chi tiết năm học', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Detail' } } },
      patch: { tags: ['Academic Years'], summary: 'Cập nhật năm học (BGH)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Academic Years'], summary: 'Xóa mềm năm học (BGH)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Deleted' } } },
    },
    '/academic-years/{id}/activate': {
      patch: { tags: ['Academic Years'], summary: 'Activate năm học → promote students (BGH)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Activated' } } },
    },
    '/academic-years/{id}/promote': {
      post: { tags: ['Academic Years'], summary: 'Promote học sinh thủ công (BGH)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Promoted' } } },
    },

    // ── CLASSES ───────────────────────────────────────────────────────────────
    '/classes': {
      get: {
        tags: ['Classes'], summary: 'Danh sách lớp học',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer' } },
          { in: 'query', name: 'school_year_id', schema: { type: 'integer' } },
          { in: 'query', name: 'age_group', schema: { type: 'string' } },
          { in: 'query', name: 'homeroom_teacher_id', schema: { type: 'integer' }, description: 'account_id of GV' },
          { in: 'query', name: 'include_deleted', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Paginated classes' } },
      },
      post: { tags: ['Classes'], summary: 'Tạo lớp học (BGH)', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Class' } } } }, responses: { 200: { description: 'Created' } } },
    },
    '/classes/{id}': {
      get: { tags: ['Classes'], summary: 'Chi tiết lớp', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Detail' } } },
      patch: { tags: ['Classes'], summary: 'Cập nhật lớp (BGH)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Classes'], summary: 'Lưu trữ lớp (BGH)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Archived' } } },
    },
    '/classes/{id}/restore': {
      patch: { tags: ['Classes'], summary: 'Khôi phục lớp', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Restored' } } },
    },
    '/classes/import': {
      post: { tags: ['Classes'], summary: 'Import Excel lớp', requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Import result' } } },
    },
    '/classes/export/excel': {
      get: { tags: ['Classes'], summary: 'Export Excel lớp', responses: { 200: { description: 'Excel file' } } },
    },

    // ── STUDENTS ──────────────────────────────────────────────────────────────
    '/students': {
      get: {
        tags: ['Students'], summary: 'Danh sách học sinh',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer' } },
          { in: 'query', name: 'pageSize', schema: { type: 'integer' } },
          { in: 'query', name: 'search', schema: { type: 'string' } },
          { in: 'query', name: 'school_year_id', schema: { type: 'integer' } },
          { in: 'query', name: 'class_id', schema: { type: 'integer' } },
          { in: 'query', name: 'grade_level', schema: { type: 'string' } },
          { in: 'query', name: 'student_status', schema: { type: 'string' } },
          { in: 'query', name: 'is_active', schema: { type: 'string' } },
          { in: 'query', name: 'include_deleted', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Paginated students' } },
      },
      post: { tags: ['Students'], summary: 'Tạo hồ sơ học sinh (BGH)', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateStudent' } } } }, responses: { 200: { description: 'Created' } } },
    },
    '/students/{id}': {
      get: { tags: ['Students'], summary: 'Chi tiết học sinh', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Detail' } } },
      patch: { tags: ['Students'], summary: 'Cập nhật hồ sơ học sinh (BGH)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Updated' } } },
      delete: { tags: ['Students'], summary: 'Lưu trữ học sinh (BGH)', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Archived' } } },
    },
    '/students/{id}/restore': {
      patch: { tags: ['Students'], summary: 'Khôi phục học sinh', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Restored' } } },
    },
    '/students/{id}/parents': {
      post: { tags: ['Students'], summary: 'Thêm phụ huynh cho học sinh', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Parent added' } } },
    },
    '/students/parents/{parentId}': {
      patch: { tags: ['Students'], summary: 'Cập nhật phụ huynh', parameters: [{ in: 'path', name: 'parentId', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Updated' } } },
    },
    '/students/{id}/photo': {
      post: { tags: ['Students'], summary: 'Upload ảnh học sinh', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { photo: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Photo URL' } } },
    },
    '/students/{id}/active': {
      patch: { tags: ['Students'], summary: 'Khóa/mở tài khoản PH', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Updated' } } },
    },
    '/students/{id}/reset-password': {
      post: { tags: ['Students'], summary: 'Reset mật khẩu PH về mặc định', parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'integer' } }], responses: { 200: { description: 'Reset done' } } },
    },
    '/students/import': {
      post: { tags: ['Students'], summary: 'Import Excel học sinh', requestBody: { content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } } } }, responses: { 200: { description: 'Import result' } } },
    },
    '/students/export/excel': {
      get: { tags: ['Students'], summary: 'Export Excel học sinh', responses: { 200: { description: 'Excel file' } } },
    },
  },
  tags: [
    { name: 'Auth', description: 'Đăng nhập, refresh token, quên mật khẩu' },
    { name: 'Accounts', description: 'Phân quyền, cấp tài khoản' },
    { name: 'Teachers', description: 'Hồ sơ cán bộ giáo viên' },
    { name: 'Academic Years', description: 'Quản lý năm học, học kỳ' },
    { name: 'Classes', description: 'Quản lý lớp học' },
    { name: 'Students', description: 'Hồ sơ học sinh, phụ huynh' },
  ],
};

const options = { definition, apis: [] };
export const swaggerSpec = swaggerJsdoc(options);
