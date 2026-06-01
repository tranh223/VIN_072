const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export interface UploadResponse {
  job_id: string;
  status: string;
  message: string;
  filename?: string | null;
  file_kind?: string | null;
  csv_filename?: string | null;
  invoice_filename?: string | null;
  user_id?: string | null;
  store_id?: string | null;
  store_name?: string | null;
}

export interface ExtractionResponse {
  job_id: string;
  status: "processing" | "done";
  csv_result?: Record<string, unknown> | null;
  ocr_result?: Record<string, unknown> | null;
}

export interface TaxAlert {
  level: string;
  code: string;
  message: string;
}

export interface TaxResponse {
  job_id: string;
  status: "processing" | "done";
  tax_result?: Record<string, unknown> | null;
  dashboard?: Record<string, unknown> | null;
  alerts: TaxAlert[];
}

export interface ExplanationItem {
  code: string;
  level: string;
  message: string;
  conclusion: string;
  reason: string;
  data_used: Record<string, unknown>;
  recommended_action: string;
}

export interface ExplainResponse {
  job_id: string;
  status: "processing" | "done";
  has_explanations: boolean;
  alert_explanations: ExplanationItem[];
  legalBasis: string[];
  confirmationMessage?: string | null;
  dataTags: string[];
  note?: string | null;
}

export interface CorrectionPayload {
  total_amount?: number;
  issue_date?: string;
  revenue_raw?: number;
}

export interface CorrectionResponse {
  job_id: string;
  changed_fields: string[];
  tax_result: Record<string, unknown>;
  dashboard: Record<string, unknown>;
  alerts: TaxAlert[];
  alert_explanations: ExplanationItem[];
  ocr_result: Record<string, unknown>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const hint = API_BASE
      ? `Kiểm tra backend tại ${API_BASE}.`
      : 'Chạy backend port 8000 rồi tải lại trang.';
    throw new Error(
      /failed to fetch|networkerror|load failed/i.test(msg)
        ? `Không kết nối được API (${path}). ${hint}`
        : msg,
    );
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function uploadFiles(
  csvFile?: File | null,
  invoiceFile?: File | null,
  meta: { userId?: string | null; storeId?: string | null } = {}
): Promise<UploadResponse> {
  const formData = new FormData();
  if (csvFile) formData.append("csv_file", csvFile);
  if (invoiceFile) formData.append("invoice_file", invoiceFile);
  if (!csvFile && !invoiceFile) {
    throw new Error("Vui long chon it nhat mot file CSV hoac chung tu.");
  }
  if (meta.userId) formData.append("user_id", meta.userId);
  if (meta.storeId) formData.append("store_id", meta.storeId);
  return request<UploadResponse>("/api/upload", {
    method: "POST",
    body: formData,
  });
}

export function getExtraction(jobId: string): Promise<ExtractionResponse> {
  return request<ExtractionResponse>(`/api/${jobId}/extraction`);
}

export function getTax(jobId: string): Promise<TaxResponse> {
  return request<TaxResponse>(`/api/${jobId}/tax`);
}

export function getExplain(jobId: string): Promise<ExplainResponse> {
  return request<ExplainResponse>(`/api/${jobId}/explain`);
}

export function applyCorrection(jobId: string, payload: CorrectionPayload): Promise<CorrectionResponse> {
  return request<CorrectionResponse>(`/api/${jobId}/correction`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export function buildReportUrl(jobId: string): string {
  return `${API_BASE}/api/${jobId}/report`;
}

