export type JobStatus = 'processing' | 'done' | 'error';

export type JobSummary = {
  job_id: string;
  status: JobStatus;
  filename: string | null;
  file_kind: string | null;
  user_id?: string | null;
  store_id?: string | null;
  store_name?: string | null;
  error: string | null;
};

export type JobsListResponse = {
  jobs: JobSummary[];
};

export type DatabaseHealthResponse = {
  status: string;
  database: string;
};

export type StoreSummary = {
  id: string;
  user_id?: string | null;
  store_name: string | null;
  store_code: string | null;
  tax_code?: string | null;
  business_type?: string | null;
  platform: {
    id?: string | null;
    name?: string | null;
    code?: string | null;
  };
  latest_period?: string | null;
  latest_report?: Record<string, unknown> | null;
  latest_estimation?: Record<string, unknown> | null;
  dossier?: {
    year?: number;
    revenue_months_count?: number;
    missing_revenue_months?: number[];
    has_tax_estimation?: boolean;
    tax_estimation_count?: number;
    evidence_count?: number;
    has_evidence?: boolean;
  } | null;
  dossier_missing_items?: string[];
  created_at?: string | null;
  updated_at?: string | null;
};

export type StoresResponse = {
  stores: StoreSummary[];
};

export type PlatformSummary = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type PlatformsResponse = {
  platforms: PlatformSummary[];
};

export type CreateStorePayload = {
  user_id?: string | null;
  platform_code: string;
  platform_name: string;
  store_name: string;
  store_code: string;
  tax_code?: string | null;
  business_type: 'individual' | 'company';
};

export type StoreResponse = {
  store: StoreSummary;
};

export type AuditLogSummary = {
  id: string;
  actor_name?: string | null;
  actor_email?: string | null;
  action?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  created_at?: string | null;
};

export type AuditLogsResponse = {
  audit_logs: AuditLogSummary[];
};

/** `GET /api/documents` — hồ sơ đã gộp (CSV doanh thu + chứng từ + phiên upload) */
export type DocumentItem = {
  id: string;
  store_id: string;
  store_name?: string | null;
  period?: string | null;
  document_type: string;
  source_channel: string;
  status: string;
  filename?: string | null;
  file_url?: string | null;
  file_kind?: string | null;
  job_id?: string | null;
  user_id?: string | null;
  uploaded_at?: string | null;
  confirmed_at?: string | null;
  confidence?: number | null;
  tags?: string[];
};

export type DocumentsListResponse = {
  documents: DocumentItem[];
  total: number;
};

export type ComplianceSummaryResponse = {
  has_data: boolean;
  score: number | null;
  label: string | null;
  compliance_band?: string | null;
  compliance_penalties?: Record<string, number> | null;
  metrics: Array<{ label: string; value: number }>;
  latest_estimation: Record<string, unknown> | null;
  alerts_count: number;
  total_revenue: number;
  payable_tax: number;
  deducted_tax_amount: number;
  difference_amount: number;
  trend: Array<{
    year: number;
    month: number;
    period: string;
    total_revenue: number;
    payable_tax: number;
    alerts_count: number;
  }>;
  missing_supporting_evidence?: boolean;
};

export type YearEndSummaryResponse = {
  has_data: boolean;
  year: number | null;
  total_revenue: number;
  deducted_tax_amount: number;
  payable_tax: number;
  completed_reports: number;
  total_reports: number;
  readiness_score: number;
  is_ready?: boolean;
  readiness_label_vi?: string | null;
  checklist: Array<{
    title: string;
    sub: string;
    meta: string;
    done: boolean;
  }>;
  latest_document: Record<string, unknown> | null;
};

export type RegisterPayload = {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
};

export type RegisterResponse = {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  url_avt?: string | null;
  role: string;
  status: string;
};

export type AuthUser = RegisterResponse;

export type AdminUser = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
  store_count: number;
  last_login?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AdminUsersResponse = {
  users: AdminUser[];
};

export type AdminUserResponse = {
  user: AdminUser;
};

export type AdminUserUpdatePayload = {
  role?: 'admin' | 'user';
  status?: 'active' | 'inactive' | 'locked' | 'pending';
};

export type RagDocument = {
  id: string;
  title: string;
  document_type: string;
  document_number?: string | null;
  content?: string | null;
  issued_date?: string | null;
  effective_date?: string | null;
  expired_date?: string | null;
  file_url?: string | null;
  created_by?: string | null;
  status: 'active' | 'expired' | 'draft' | string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type RagDocumentPayload = {
  title: string;
  document_type: string;
  document_number?: string | null;
  content?: string | null;
  issued_date?: string | null;
  effective_date?: string | null;
  expired_date?: string | null;
  file_url?: string | null;
  status: 'active' | 'expired' | 'draft';
};

export type RagDocumentsResponse = {
  documents: RagDocument[];
};

export type RagDocumentResponse = {
  document: RagDocument;
};

export type UserFeedback = {
  id: string;
  user_id?: string | null;
  user_name?: string | null;
  user_email?: string | null;
  message_id?: string | null;
  rating?: number | null;
  feedback_type?: string | null;
  comment?: string | null;
  status: 'new' | 'reviewed' | 'resolved' | 'archived' | string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type UserFeedbackResponse = {
  feedback: UserFeedback[];
};

export type CreateUserFeedbackPayload = {
  user_id?: string | null;
  message_id?: string | null;
  rating?: number | null;
  feedback_type: string;
  comment: string;
};

export type CreateUserFeedbackResponse = {
  feedback: UserFeedback;
};

export type NotificationItem = {
  id: string;
  target_type: 'broadcast' | 'user' | string;
  user_id?: string | null;
  title: string;
  detail: string;
  type: string;
  source?: string | null;
  version?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  created_at?: string | null;
  read: boolean;
};

export type NotificationsResponse = {
  notifications: NotificationItem[];
};

export type CreateNotificationPayload = {
  user_id: string;
  title: string;
  detail?: string | null;
  type?: string;
  source?: string;
};

export type UserStatsResponse = {
  totals: {
    total_users: number;
    active_users: number;
    admin_users: number;
    stores: number;
    rag_documents: number;
    feedback: number;
  };
  role_counts: Record<string, number>;
  status_counts: Record<string, number>;
  recent_users: Array<{
    _id: string;
    email?: string | null;
    full_name?: string | null;
    phone?: string | null;
    role?: string | null;
    status?: string | null;
    store_count?: number | null;
    last_login?: string | null;
    created_at?: string | null;
  }>;
};

export type AdminUserAnalyticsResponse = {
  totals: {
    active_users_7d: number;
    data_uploads: number;
    chatbot_questions: number;
  };
  monthly_users: Array<{
    month: string;
    key: string;
    users: number;
  }>;
  chatbot_usage: Array<{
    day: string;
    key: string;
    questions: number;
  }>;
  feature_usage: Array<{
    name: string;
    value: number;
  }>;
};

export type CreateUsageEventPayload = {
  user_id?: string | null;
  event_type: string;
  feature?: string | null;
  metadata?: Record<string, unknown>;
};

export type LoginPayload = {
  identifier: string;
  password: string;
};

export type ForgotPasswordPayload = {
  email: string;
};

export type ResetPasswordPayload = {
  token: string;
  password: string;
};

export type ChangePasswordPayload = {
  user_id: string;
  current_password: string;
  new_password: string;
};

export type MessageResponse = {
  message: string;
};

export type VerifyResetCodePayload = {
  email: string;
  code: string;
};

export type VerifyResetCodeResponse = {
  message: string;
  token: string;
};

export type UploadResponse = {
  job_id: string;
  status: string;
  message: string;
  filename?: string | null;
  file_kind?: string | null;
  user_id?: string | null;
  store_id?: string | null;
  store_name?: string | null;
};

/** Chứng từ / hóa đơn TMĐT từ OCR (doanh thu, thuế tham khảo trên chứng cứ) — dùng cho extraction và đối soát */
export type ECommerceEvidenceDocument = {
  document_category?: 'sales_invoice' | 'return_document' | 'deduction_document' | 'transaction_screenshot' | 'unknown' | string;
  document_type?: string;
  document_no?: string;
  symbol?: string;
  issuer_name?: string;
  issuer_tax_code?: string;
  issuer_address?: string;
  issuer_phone?: string;
  taxpayer_name?: string;
  taxpayer_tax_code?: string;
  taxpayer_id_no?: string;
  taxpayer_address_or_phone?: string;
  issue_date?: string;
  amount?: number;
  revenue?: number;
  revenue_reported?: number;
  total?: number;
  subtotal?: number;
  counterparty?: string;
  order_id?: string;
  items?: Array<Record<string, unknown>>;
  confidence?: number;
  needs_review?: boolean;
  warnings?: string[];
  is_valid?: boolean;
  industry_rows?: Array<{
    industry_group: string;
    revenue: number;
    gtgt: number;
    tncn: number;
    total: number;
  }>;
};

export type ExtractionResponse = {
  job_id: string;
  status: string;
  csv_result?: Record<string, unknown> | null;
  /** Bản rút gọn từ worker OCR; các trường bám sát ECommerceEvidenceDocument */
  ocr_result?: (Record<string, unknown> & Partial<ECommerceEvidenceDocument>) | null;
  /** Lỗi pipeline (OCR/CSV/VLM) khi status done */
  errors?: string[];
};

export type AlertItem = {
  level: string;
  code: string;
  message: string;
};

export type TaxResponse = {
  job_id: string;
  status: string;
  tax_result?: Record<string, unknown> | null;
  dashboard?: Record<string, unknown> | null;
  alerts?: AlertItem[];
};

export type ExplanationItem = {
  code: string;
  level: string;
  message: string;
  conclusion: string;
  reason: string;
  data_used: Record<string, unknown>;
  recommended_action: string;
};

export type ExplainResponse = {
  job_id: string;
  status: string;
  has_explanations?: boolean;
  alert_explanations: ExplanationItem[];
  legalBasis: string[];
  confirmationMessage: string | null;
  dataTags: string[];
  note?: string | null;
};

export type Deductions = {
  refunds?: number;
  trade_discounts?: number;
  payment_discounts?: number;
  promotions?: number;
};

export type CorrectionPayload = {
  revenue_raw?: number;
  industry?: string;
  period?: string;
  total_amount?: number;
  issue_date?: string;
  /** Các khoản giảm trừ doanh thu theo TT40/2021 */
  deductions?: Deductions;
};

export type CorrectionResponse = {
  job_id: string;
  changed_fields: string[];
  tax_result: Record<string, unknown>;
  dashboard: Record<string, unknown>;
  alerts: AlertItem[];
  alert_explanations: ExplanationItem[];
  ocr_result: {
    total: number;
    issue_date: string;
    review_value: number;
  };
};

// ─── RAG Pipeline types ────────────────────────────────────────────────────

export type RagCitation = {
  dieu: string;
  law_id: string;
  law_name: string;
  text_snippet: string;
  source: string;
  url: string;
};

export type RagContext = {
  text: string;
  rerank_score: number;
  metadata: Record<string, unknown>;
};

export type RagAskPayload = {
  query: string;
  retrieve_top_k?: number;
  rerank_top_k?: number;
  clarification_count?: number;
  conversation_summary?: string | null;
  recent_messages?: Array<{ role: 'user' | 'assistant'; text: string }>;
  metadata_filter?: Record<string, unknown> | null;
};

export type RagAskResponse = {
  query: string;
  answer: string;
  citations: RagCitation[];
  contexts_used: RagContext[];
  is_hallucination_risk: boolean;
  hallucination_reason: string;
  latency_ms: number;
  model: string;
  tokens_used: number;
};

export type ConversationMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export type ConversationSummaryPayload = {
  previous_summary?: string | null;
  messages: ConversationMessage[];
};

export type ConversationSummaryResponse = {
  summary: string;
  model: string;
  tokens_used: number;
};

export type RagHealthResponse = {
  status: string;
  pinecone_index: string;
  dense_ready: boolean;
  model: string;
  version: string;
};

export type MongoRagIngestPayload = {
  scope: 'public' | 'private' | 'all';
  user_id?: string | null;
  store_id?: string | null;
  limit?: number;
  dry_run?: boolean;
  clear_namespace?: boolean;
  public_namespace?: string;
  private_namespace?: string;
};

export type MongoRagIngestResponse = {
  scope: string;
  dry_run: boolean;
  public?: { documents: number; chunks: number; upserted: number; namespace: string };
  private?: { documents: number; chunks: number; upserted: number; namespace: string };
};

export type MongoRagStatusResponse = {
  public_namespace: string;
  private_namespace: string;
  collections: Record<string, { total: number; indexed: number; failed: number }>;
};

export type PrivateRagSearchPayload = {
  query: string;
  user_id: string;
  store_id?: string | null;
  top_k?: number;
  namespace?: string;
};

export type PrivateRagSearchResponse = {
  query: string;
  namespace: string;
  filter: Record<string, string>;
  results: Array<{ text: string; score: number; metadata: Record<string, unknown> }>;
};
