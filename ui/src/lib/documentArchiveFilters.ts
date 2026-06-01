/** Giá trị filter khớp `GET /api/documents` / `DocumentItem` backend */

export type FilterOption = { value: string; label: string };

/** Chỉ chứng cứ (ảnh/PDF) — dùng khi upload loại « chứng từ » */
export const EVIDENCE_DOCUMENT_TYPE_OPTIONS: FilterOption[] = [
  { value: 'chứng cứ giao dịch', label: 'Chứng cứ giao dịch' },
  { value: 'hóa đơn / biên nhận', label: 'Hóa đơn / biên nhận' },
  { value: 'sao kê / screenshot', label: 'Sao kê / screenshot' },
  { value: 'hoàn trả / hủy đơn', label: 'Hoàn trả / hủy đơn' },
  { value: 'khác', label: 'Khác' },
];

export const DOCUMENT_TYPE_OPTIONS: FilterOption[] = [
  { value: '', label: 'Tất cả loại' },
  { value: 'dữ liệu bán hàng', label: 'Dữ liệu bán hàng' },
  { value: 'chứng cứ giao dịch', label: 'Chứng cứ giao dịch' },
  { value: 'hóa đơn / biên nhận', label: 'Hóa đơn / biên nhận' },
  { value: 'sao kê / screenshot', label: 'Sao kê / screenshot' },
  { value: 'hoàn trả / hủy đơn', label: 'Hoàn trả / hủy đơn' },
  { value: 'khác', label: 'Khác' },
];

export const SOURCE_CHANNEL_OPTIONS: FilterOption[] = [
  { value: '', label: 'Tất cả nguồn' },
  { value: 'upload thủ công', label: 'Upload thủ công' },
  { value: 'OCR/VLM', label: 'OCR/VLM' },
  { value: 'import từ file', label: 'Import từ file' },
];

export const STATUS_OPTIONS: FilterOption[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'Đã xác nhận', label: 'Đã đối soát (trong kho)' },
  { value: 'Cần xem lại', label: 'Cần xem lại' },
  { value: 'Thiếu thông tin', label: 'Thiếu thông tin' },
  { value: 'Đã dùng cho hồ sơ', label: 'Đã dùng cho hồ sơ' },
  { value: 'Chưa phân loại', label: 'Chưa phân loại' },
];

export const archiveFilterSelectClass =
  'min-h-10 w-full rounded-xl border border-outline-variant bg-white px-3 text-xs font-medium text-on-surface outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/5';
