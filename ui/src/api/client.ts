import type {
  AuditLogsResponse,
  AdminUserAnalyticsResponse,
  AdminUserResponse,
  AdminUserUpdatePayload,
  AdminUsersResponse,
  ComplianceSummaryResponse,
  ConversationSummaryPayload,
  ConversationSummaryResponse,
  CorrectionPayload,
  CorrectionResponse,
  ChangePasswordPayload,
  DocumentsListResponse,
  CreateUserFeedbackPayload,
  CreateUserFeedbackResponse,
  CreateStorePayload,
  CreateUsageEventPayload,
  CreateNotificationPayload,
  DatabaseHealthResponse,
  ExtractionResponse,
  ExplainResponse,
  ForgotPasswordPayload,
  JobsListResponse,
  LoginPayload,
  MessageResponse,
  RagDocumentPayload,
  RagDocumentResponse,
  RagDocumentsResponse,
  RagAskPayload,
  RagAskResponse,
  RagHealthResponse,
  MongoRagIngestPayload,
  MongoRagIngestResponse,
  MongoRagStatusResponse,
  NotificationsResponse,
  PlatformsResponse,
  PrivateRagSearchPayload,
  PrivateRagSearchResponse,
  RegisterPayload,
  RegisterResponse,
  ResetPasswordPayload,
  StoreResponse,
  StoresResponse,
  TaxResponse,
  UploadResponse,
  UserFeedback,
  UserFeedbackResponse,
  UserStatsResponse,
  VerifyResetCodePayload,
  VerifyResetCodeResponse,
  YearEndSummaryResponse,
} from './types';

export function apiBaseUrl(): string {
  const v = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (v && String(v).trim()) return String(v).replace(/\/$/, '');
  return '';
}

function baseUrl(): string {
  return apiBaseUrl();
}

/** Chuẩn hóa URL file để mở tab mới (absolute hoặc gắn API base). */
export function resolvePublicFileUrl(pathOrUrl: string | null | undefined): string | null {
  if (pathOrUrl == null || !String(pathOrUrl).trim()) return null;
  const s = String(pathOrUrl).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const b = apiBaseUrl();
  if (!b) return s.startsWith('/') ? s : `/${s}`;
  return s.startsWith('/') ? `${b}${s}` : `${b}/${s}`;
}

function networkErrorMessage(path: string, cause: unknown): string {
  const direct = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  const hint = direct
    ? `Kiểm tra backend đang chạy tại ${direct} (uvicorn port 8000).`
    : 'Chạy backend: python -m uvicorn src.api.app:app --host 127.0.0.1 --port 8000 (thư mục gốc repo), rồi tải lại trang.';
  const msg = cause instanceof Error ? cause.message : String(cause);
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return `Không kết nối được API (${path}). ${hint}`;
  }
  return msg || `Không kết nối được API (${path}). ${hint}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl()}${p}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string>),
      },
    });
  } catch (err) {
    throw new Error(networkErrorMessage(p, err));
  }
  const raw = await res.text();

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = JSON.parse(raw) as { detail?: unknown };
      if (typeof j?.detail === 'string') detail = j.detail;
      else if (Array.isArray(j?.detail))
        detail = j.detail.map((x: { msg?: string }) => x.msg).join(', ');
    } catch {
      const t = raw.trim();
      if (t) detail = t.slice(0, 500);
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }

  if (res.status === 204 || !raw.trim()) return undefined as T;
  return JSON.parse(raw) as T;
}

export async function getHealth(): Promise<{ status: string; service?: string }> {
  return apiFetch('/api/health');
}

export async function getDatabaseHealth(): Promise<DatabaseHealthResponse> {
  return apiFetch('/api/db/health');
}

export async function getJobs(userId?: string | null): Promise<JobsListResponse> {
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  return apiFetch(`/api/jobs${query}`);
}

export async function getStores(userId?: string | null): Promise<StoresResponse> {
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  return apiFetch(`/api/stores${query}`);
}

export async function getPlatforms(): Promise<PlatformsResponse> {
  return apiFetch('/api/platforms');
}

export async function createStore(body: CreateStorePayload): Promise<StoreResponse> {
  return apiFetch('/api/stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getAuditLogs(userId?: string | null): Promise<AuditLogsResponse> {
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  return apiFetch(`/api/audit-logs${query}`);
}

export type DocumentsQueryParams = {
  user_id?: string | null;
  store_id?: string | null;
  period?: string | null;
  document_type?: string | null;
  status?: string | null;
  source_channel?: string | null;
  limit?: number;
  offset?: number;
};

export async function getDocuments(params: DocumentsQueryParams): Promise<DocumentsListResponse> {
  const q = new URLSearchParams();
  if (params.user_id) q.set('user_id', params.user_id);
  if (params.store_id) q.set('store_id', params.store_id);
  if (params.period?.trim()) q.set('period', params.period.trim());
  if (params.document_type?.trim()) q.set('document_type', params.document_type.trim());
  if (params.status?.trim()) q.set('status', params.status.trim());
  if (params.source_channel?.trim()) q.set('source_channel', params.source_channel.trim());
  if (typeof params.limit === 'number') q.set('limit', String(params.limit));
  if (typeof params.offset === 'number') q.set('offset', String(params.offset));
  const qs = q.toString();
  return apiFetch(`/api/documents${qs ? `?${qs}` : ''}`);
}

export function auditLogFileUrl(
  auditId: string,
  kind: 'csv' | 'invoice',
  userId?: string | null
): string {
  const b = baseUrl();
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : '';
  const p = `/api/audit-logs/${encodeURIComponent(auditId)}/file/${kind}${query}`;
  return b ? `${b}${p}` : p;
}

export async function getComplianceSummary(
  userId?: string | null,
  storeId?: string | null,
  period?: { year: number; month?: number },
): Promise<ComplianceSummaryResponse> {
  const params = new URLSearchParams();
  if (userId) params.set('user_id', userId);
  if (storeId) params.set('store_id', storeId);
  if (period?.year) params.set('year', String(period.year));
  if (period?.month) params.set('month', String(period.month));
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/compliance/summary${query}`);
}

export async function getYearEndSummary(
  year?: number,
  userId?: string | null,
  storeId?: string | null
): Promise<YearEndSummaryResponse> {
  const params = new URLSearchParams();
  if (typeof year === 'number') params.set('year', String(year));
  if (userId) params.set('user_id', userId);
  if (storeId) params.set('store_id', storeId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/api/year-end/summary${query}`);
}

export async function registerUser(body: RegisterPayload): Promise<RegisterResponse> {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function loginUser(body: LoginPayload): Promise<RegisterResponse> {
  return apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function forgotPassword(body: ForgotPasswordPayload): Promise<MessageResponse> {
  return apiFetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function verifyResetCode(body: VerifyResetCodePayload): Promise<VerifyResetCodeResponse> {
  return apiFetch('/api/auth/verify-reset-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function resetPassword(body: ResetPasswordPayload): Promise<MessageResponse> {
  return apiFetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function changePassword(body: ChangePasswordPayload): Promise<MessageResponse> {
  return apiFetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function uploadUserAvatar(userId: string, file: File): Promise<RegisterResponse> {
  const form = new FormData();
  form.append('user_id', userId);
  form.append('avatar', file);
  return apiFetch('/api/auth/avatar', {
    method: 'POST',
    body: form,
  });
}

function adminQuery(adminUserId: string): string {
  return `admin_user_id=${encodeURIComponent(adminUserId)}`;
}

export async function getAdminRagDocuments(adminUserId: string): Promise<RagDocumentsResponse> {
  return apiFetch(`/api/admin/rag-documents?${adminQuery(adminUserId)}`);
}

export async function createAdminRagDocument(
  adminUserId: string,
  body: RagDocumentPayload
): Promise<RagDocumentResponse> {
  return apiFetch(`/api/admin/rag-documents?${adminQuery(adminUserId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function updateAdminRagDocument(
  adminUserId: string,
  documentId: string,
  body: RagDocumentPayload
): Promise<RagDocumentResponse> {
  return apiFetch(`/api/admin/rag-documents/${encodeURIComponent(documentId)}?${adminQuery(adminUserId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function deleteAdminRagDocument(adminUserId: string, documentId: string): Promise<void> {
  await apiFetch(`/api/admin/rag-documents/${encodeURIComponent(documentId)}?${adminQuery(adminUserId)}`, {
    method: 'DELETE',
  });
}

export async function getAdminUsers(adminUserId: string): Promise<AdminUsersResponse> {
  return apiFetch(`/api/admin/users?${adminQuery(adminUserId)}`);
}

export async function updateAdminUser(
  adminUserId: string,
  userId: string,
  body: AdminUserUpdatePayload
): Promise<AdminUserResponse> {
  return apiFetch(`/api/admin/users/${encodeURIComponent(userId)}?${adminQuery(adminUserId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getAdminUserFeedback(
  adminUserId: string,
  status = 'all'
): Promise<UserFeedbackResponse> {
  const params = `${adminQuery(adminUserId)}&status=${encodeURIComponent(status)}`;
  return apiFetch(`/api/admin/user-feedback?${params}`);
}

export async function updateAdminUserFeedbackStatus(
  adminUserId: string,
  feedbackId: string,
  status: 'new' | 'reviewed' | 'resolved' | 'archived'
): Promise<{ feedback: UserFeedback }> {
  return apiFetch(`/api/admin/user-feedback/${encodeURIComponent(feedbackId)}?${adminQuery(adminUserId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export async function getAdminUserStats(adminUserId: string): Promise<UserStatsResponse> {
  return apiFetch(`/api/admin/user-stats?${adminQuery(adminUserId)}`);
}

export async function getAdminUserAnalytics(adminUserId: string): Promise<AdminUserAnalyticsResponse> {
  return apiFetch(`/api/admin/user-analytics?${adminQuery(adminUserId)}`);
}

export async function createUsageEvent(body: CreateUsageEventPayload): Promise<{ event: Record<string, unknown> }> {
  return apiFetch('/api/usage-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function createUserFeedback(
  body: CreateUserFeedbackPayload
): Promise<CreateUserFeedbackResponse> {
  return apiFetch('/api/user-feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function getNotifications(userId: string): Promise<NotificationsResponse> {
  return apiFetch(`/api/notifications?user_id=${encodeURIComponent(userId)}`);
}

export async function createNotification(
  body: CreateNotificationPayload
): Promise<{ notification: NotificationsResponse['notifications'][number] }> {
  return apiFetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function markNotificationsRead(
  userId: string,
  options: { notificationId?: string; all?: boolean } = { all: true }
): Promise<{ ok: boolean }> {
  return apiFetch('/api/notifications/read', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      notification_id: options.notificationId ?? null,
      all: options.all ?? false,
    }),
  });
}

export async function uploadFile(
  file: File,
  meta: { userId?: string | null; storeId?: string | null } = {}
): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append('file', file);
  if (meta.userId) fd.append('user_id', meta.userId);
  if (meta.storeId) fd.append('store_id', meta.storeId);
  return apiFetch('/api/upload', { method: 'POST', body: fd });
}

export type UploadSessionKind = 'sales_csv' | 'evidence' | 'bundle';

/** CSV doanh thu + chứng từ giao dịch; ít nhất một file. */
export async function uploadDataFiles(
  csv: File | null,
  invoice: File | null,
  meta: {
    userId?: string | null;
    storeId?: string | null;
    /** Gắn nhãn kỳ / loại phiên để lưu kho hồ sơ đúng ngữ cảnh */
    periodMonth?: number;
    periodYear?: number;
    uploadKind?: UploadSessionKind;
    evidenceCategory?: string | null;
  } = {}
): Promise<UploadResponse> {
  if (!csv && !invoice) {
    throw new Error('Can it nhat file CSV hoac chung tu (anh/PDF).');
  }
  const fd = new FormData();
  if (csv) fd.append('csv_file', csv);
  if (invoice) fd.append('invoice_file', invoice);
  if (meta.userId) fd.append('user_id', meta.userId);
  if (meta.storeId) fd.append('store_id', meta.storeId);
  if (typeof meta.periodMonth === 'number') fd.append('period_month', String(meta.periodMonth));
  if (typeof meta.periodYear === 'number') fd.append('period_year', String(meta.periodYear));
  if (meta.uploadKind) fd.append('upload_kind', meta.uploadKind);
  if (meta.evidenceCategory?.trim()) fd.append('evidence_category', meta.evidenceCategory.trim());
  return apiFetch('/api/upload', { method: 'POST', body: fd });
}

export async function getExtraction(jobId: string): Promise<ExtractionResponse> {
  return apiFetch(`/api/${encodeURIComponent(jobId)}/extraction`);
}

export async function getTax(jobId: string): Promise<TaxResponse> {
  return apiFetch(`/api/${encodeURIComponent(jobId)}/tax`);
}

export async function getExplain(jobId: string): Promise<ExplainResponse> {
  return apiFetch(`/api/${encodeURIComponent(jobId)}/explain`);
}

export async function postCorrection(
  jobId: string,
  body: CorrectionPayload
): Promise<CorrectionResponse> {
  return apiFetch(`/api/${encodeURIComponent(jobId)}/correction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function reportDownloadUrl(jobId: string): string {
  const b = baseUrl();
  const p = `/api/${encodeURIComponent(jobId)}/report`;
  return b ? `${b}${p}` : p;
}

export async function deleteJob(jobId: string): Promise<void> {
  await apiFetch(`/api/upload/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
}

/** Cho trich xuat xong hoac loi pipeline. */
export async function waitForExtraction(
  jobId: string,
  options?: { intervalMs?: number; maxAttempts?: number }
): Promise<ExtractionResponse> {
  const intervalMs = options?.intervalMs ?? 2000;
  const maxAttempts = options?.maxAttempts ?? 120;
  for (let i = 0; i < maxAttempts; i++) {
    const ex = await getExtraction(jobId);
    if (ex.status !== 'processing') return ex;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Het thoi gian cho xu ly trich xuat.');
}

// ─── RAG Pipeline API ──────────────────────────────────────────────────────

/** Kiểm tra trạng thái RAG backend (Pinecone + model). */
export async function ragHealth(): Promise<RagHealthResponse> {
  return apiFetch<RagHealthResponse>('/rag/health');
}

export async function summarizeRagConversation(
  payload: ConversationSummaryPayload,
): Promise<ConversationSummaryResponse> {
  return apiFetch<ConversationSummaryResponse>('/rag/conversation-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getMongoRagStatus(adminUserId: string): Promise<MongoRagStatusResponse> {
  return apiFetch<MongoRagStatusResponse>(`/api/rag/mongo/status?${adminQuery(adminUserId)}`);
}

export async function ingestMongoRag(
  adminUserId: string,
  payload: MongoRagIngestPayload,
): Promise<MongoRagIngestResponse> {
  return apiFetch<MongoRagIngestResponse>(`/api/rag/mongo/ingest?${adminQuery(adminUserId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function searchPrivateRag(payload: PrivateRagSearchPayload): Promise<PrivateRagSearchResponse> {
  return apiFetch<PrivateRagSearchResponse>('/api/rag/private/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

/**
 * Hỏi đáp pháp lý — stream rich (token realtime + final metadata đầy đủ).
 *
 * Event từ backend:
 * - { type: "token", token: "..." }
 * - { type: "final", ...RagAskResponse }
 * - [DONE]
 */
export function ragStreamRich(
  payload: RagAskPayload,
  callbacks: {
    onToken: (token: string) => void;
    onFinal: (result: RagAskResponse) => void;
    onDone: () => void;
    onError: (err: string) => void;
  },
): AbortController {
  const controller = new AbortController();
  const { onToken, onFinal, onDone, onError } = callbacks;

  const run = async () => {
    let res: Response;
    try {
      res = await fetch('/rag/stream-rich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError((err as Error).message ?? 'Lỗi kết nối RAG backend.');
      }
      return;
    }

    if (!res.ok) {
      let detail = '';
      try {
        const body = (await res.json()) as { detail?: string };
        if (typeof body.detail === 'string') detail = body.detail;
      } catch {
        /* body không phải JSON */
      }
      if (res.status === 503 && !detail) {
        detail =
          'Không kết nối được RAG API (cổng 8001). Chạy: python -m uvicorn src.api.api_rag.app:app --host 127.0.0.1 --port 8001';
      }
      onError(detail ? detail : `RAG backend lỗi: HTTP ${res.status}`);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) { onError('Không đọc được stream.'); return; }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') { onDone(); return; }
        try {
          const parsed = JSON.parse(data) as { type?: string; token?: string; error?: string } & Partial<RagAskResponse>;
          if (parsed.error) { onError(parsed.error); return; }
          if (parsed.type === 'token' && parsed.token) {
            onToken(parsed.token);
          }
          if (parsed.type === 'final') {
            onFinal(parsed as RagAskResponse);
          }
        } catch {
          // bỏ qua dòng không parse được
        }
      }
    }
    onDone();
  };

  void run();
  return controller;
}
