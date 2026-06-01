import { useEffect, useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { BookOpen, CheckCircle2, Clock3, Edit3, FileCheck2, FileUp, List, Plus, Save, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../../components/ui/Table';
import type { RagDocument, RagDocumentPayload } from '../../api/types';
import { AdminBadge, AdminSelect, Card, TablePanel } from './components';
import type { Totals } from './types';
import { EMPTY_FORM, documentToForm, formatDate } from './utils';

const CONTENT_FILTERS = ['Tất cả', 'FAQ', 'Luật thuế', 'Kịch bản trả lời', 'Từ khóa bị chặn'];

type Props = {
  totals: Totals;
  contentTab: string;
  setContentTab: (value: string) => void;
  form: RagDocumentPayload;
  setForm: Dispatch<SetStateAction<RagDocumentPayload>>;
  editingId: string | null;
  resetForm: () => void;
  submitDocument: (event: FormEvent) => void;
  saving: boolean;
  loading: boolean;
  documents: RagDocument[];
  setEditingId: (value: string | null) => void;
  removeDocument: (documentId: string) => void;
};

export default function RagContent({
  totals,
  contentTab,
  setContentTab,
  form,
  setForm,
  editingId,
  resetForm,
  submitDocument,
  saving,
  loading,
  documents,
  setEditingId,
  removeDocument,
}: Props) {
  const [viewTab, setViewTab] = useState<'input' | 'list'>('input');
  const [uploadedFileName, setUploadedFileName] = useState('');

  useEffect(() => {
    if (!form.content && !editingId) setUploadedFileName('');
  }, [editingId, form.content]);

  const handleContentFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setUploadedFileName(file.name);
    setForm((current) => ({
      ...current,
      title: current.title.trim() ? current.title : file.name.replace(/\.[^.]+$/, ''),
      content,
      file_url: null,
    }));
    setViewTab('input');
    event.target.value = '';
  };

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card label="Tổng nội dung" value={totals.totalContent} icon={<BookOpen size={16} />} />
        <Card label="Nội dung đang hoạt động" value={totals.activeContent} icon={<CheckCircle2 size={16} />} />
        <Card label="Nội dung cần duyệt" value={totals.pendingContent} icon={<FileCheck2 size={16} />} />
        <Card label="Cập nhật gần nhất" value={totals.lastUpdated} icon={<Clock3 size={16} />} />
      </div>
      <div className="hidden">
        <div className="flex flex-wrap gap-2">
          {['FAQ', 'Luật thuế', 'Kịch bản trả lời', 'Từ khóa bị chặn'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setContentTab(tab)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
                contentTab === tab ? 'bg-primary text-white shadow-sm shadow-primary/20' : 'border border-[#DDD6EA] bg-white text-[#7C758A] hover:text-primary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="gap-2" onClick={() => { setForm({ ...EMPTY_FORM, document_type: contentTab === 'Tất cả' ? 'FAQ' : contentTab }); setUploadedFileName(''); setViewTab('input'); }}><Plus size={14} /> Thêm nội dung</Button>
        </div>
      </div>
      <div className={`grid gap-4 ${viewTab === 'input' ? 'xl:grid-cols-[320px_1fr]' : ''}`}>
        {viewTab === 'input' && (
        <form onSubmit={submitDocument} className="space-y-3 rounded-xl border border-[#DDD6EA] bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            {/* <Button size="sm" className="gap-2" onClick={() => { setForm({ ...EMPTY_FORM, document_type: contentTab === 'Tất cả' ? 'FAQ' : contentTab }); setUploadedFileName(''); setViewTab('input'); }}><Plus size={14} /> Thêm</Button> */}
            <h2 className="font-display text-base font-bold text-[#111827]">{editingId ? 'Sửa nội dung' : 'Thêm nội dung'}</h2>
            {editingId && <Button variant="ghost" size="sm" className="gap-1" onClick={() => { setUploadedFileName(''); resetForm(); }}><X size={14} /> Hủy</Button>}
          </div>
          <Input label="Tiêu đề" value={form.title} required onChange={(event) => setForm({ ...form, title: event.target.value })} />
          <AdminSelect label="Danh mục" value={form.document_type} onChange={(value) => setForm({ ...form, document_type: value })}>
            <option value="FAQ">FAQ</option>
            <option value="Luật thuế">Luật thuế</option>
            <option value="Kịch bản trả lời">Kịch bản trả lời</option>
            <option value="Từ khóa bị chặn">Từ khóa bị chặn</option>
          </AdminSelect>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Ngày hiệu lực" type="date" value={form.effective_date ?? ''} onChange={(event) => setForm({ ...form, effective_date: event.target.value })} />
            <Input label="Ngày hết hạn" type="date" value={form.expired_date ?? ''} onChange={(event) => setForm({ ...form, expired_date: event.target.value })} />
          </div>
          <AdminSelect label="Trạng thái" value={form.status} onChange={(value) => setForm({ ...form, status: value as RagDocumentPayload['status'] })}>
            <option value="active">Đang hoạt động</option>
            <option value="draft">Cần duyệt</option>
            <option value="expired">Hết hiệu lực</option>
          </AdminSelect>
          <div className="flex justify-end">
          <Button type="submit" size="sm" className="gap-2" disabled={saving || !form.title.trim() || !form.content?.trim()}>
            {editingId ? <Save size={14} /> : <Plus size={14} />}
            {editingId ? 'Lưu thay đổi' : 'Thêm nội dung'}
          </Button>
          </div>
        </form>
        )}
        <div className="overflow-hidden rounded-xl border border-[#DDD6EA] bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-[#DDD6EA] bg-[#FAFAFC] px-3 pt-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setViewTab('input')}
                className={`-mb-px inline-flex items-center gap-2 rounded-t-xl border px-4 py-2 text-xs font-bold transition-colors ${
                  viewTab === 'input'
                    ? 'border-[#DDD6EA] border-b-white bg-white text-primary'
                    : 'border-transparent bg-transparent text-[#7C758A] hover:bg-white/70 hover:text-primary'
                }`}
              >
                <Plus size={14} />
                Thêm nội dung
              </button>
              <button
                type="button"
                onClick={() => setViewTab('list')}
                className={`-mb-px inline-flex items-center gap-2 rounded-t-xl border px-4 py-2 text-xs font-bold transition-colors ${
                  viewTab === 'list'
                    ? 'border-[#DDD6EA] border-b-white bg-white text-primary'
                    : 'border-transparent bg-transparent text-[#7C758A] hover:bg-white/70 hover:text-primary'
                }`}
              >
                <List size={14} />
                Danh sách nội dung
              </button>
            </div>
            <div className="flex justify-end pb-2">
              <label className="relative">
                <span className="sr-only">Lọc danh mục nội dung</span>
                <select
                  value={contentTab}
                  onChange={(event) => setContentTab(event.target.value)}
                  className="h-8 min-w-[170px] cursor-pointer appearance-none rounded-lg border border-[#DDD6EA] bg-white px-3 pr-8 text-[11px] font-bold text-[#111827] shadow-sm outline-none transition-colors hover:border-primary focus:border-primary focus:ring-4 focus:ring-primary/5"
                >
                  {CONTENT_FILTERS.map((tab) => (
                    <option key={tab} value={tab}>
                      {tab}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#7C758A]">▼</span>
              </label>
            </div>
          </div>
          {viewTab === 'input' ? (
            <div className="p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-[#DDD6EA] bg-[#FAFAFC] px-3 py-2">
                <div>
                  <p className="text-xs font-bold text-[#111827]">Upload file nội dung</p>
                  <p className="text-[11px] text-[#7C758A]">
                    {uploadedFileName || 'Hỗ trợ file text như .txt, .md, .csv, .json. Nội dung sẽ được lưu raw vào MongoDB.'}
                  </p>
                </div>
                <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-white shadow-sm shadow-primary/20 transition-opacity hover:opacity-90">
                  <FileUp size={14} />
                  Chọn file
                  <input
                    type="file"
                    accept=".txt,.md,.csv,.json,.log,text/plain,text/markdown,text/csv,application/json"
                    className="hidden"
                    onChange={handleContentFile}
                  />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="ml-1 text-[10px] font-display font-bold uppercase tracking-widest text-outline">Nội dung chatbot</span>
                <textarea
                  rows={15}
                  value={form.content ?? ''}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  placeholder="Nhập nội dung tri thức, FAQ, kịch bản trả lời hoặc điều luật cần đưa vào chatbot..."
                  className="w-full rounded-xl border border-[#DDD6EA] bg-white px-4 py-3 text-sm leading-relaxed text-[#111827] outline-none focus:border-primary focus:ring-4 focus:ring-primary/5"
                />
              </label>
            </div>
          ) : (
            <TablePanel loading={loading} empty={!documents.length} emptyText="Chưa có nội dung phù hợp." flush>
              <Table bare className="min-w-[980px]">
                <TableHead>
                  <TableRow className="border-b border-[#DDD6EA] bg-[#F8F7FB] hover:bg-[#F8F7FB]">
                    <TableHeaderCell className="w-[300px] whitespace-nowrap">Tiêu đề</TableHeaderCell>
                    <TableHeaderCell className="w-[170px] whitespace-nowrap">Danh mục</TableHeaderCell>
                    <TableHeaderCell className="w-[140px] whitespace-nowrap">Trạng thái</TableHeaderCell>
                    <TableHeaderCell className="w-[145px] whitespace-nowrap">Cập nhật lần cuối</TableHeaderCell>
                    <TableHeaderCell className="w-[150px] whitespace-nowrap">Người cập nhật</TableHeaderCell>
                    <TableHeaderCell className="w-[175px] whitespace-nowrap text-right">Hành động</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <p className="text-[13px] font-bold text-[#111827]">{doc.title}</p>
                        <p className="text-[10px] text-[#7C758A]">{doc.document_number || 'Chưa có mã'}</p>
                      </TableCell>
                      <TableCell className="whitespace-nowrap"><Badge>{doc.document_type}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap"><AdminBadge status={doc.status} /></TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-[#7C758A]">{formatDate(doc.updated_at || doc.created_at)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-[#7C758A]">Admin</TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          <Button variant="outline" size="sm" onClick={() => { setEditingId(doc.id); setForm(documentToForm(doc)); setUploadedFileName(''); setViewTab('input'); }}><Edit3 size={14} /> Sửa</Button>
                          <Button variant="danger" size="sm" onClick={() => removeDocument(doc.id)} disabled={saving}><Trash2 size={14} /> Xóa</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TablePanel>
          )}
        </div>
      </div>
    </section>
  );
}
