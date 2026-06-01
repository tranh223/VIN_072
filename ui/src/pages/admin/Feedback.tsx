import { CheckCircle2, Clock3, MessageSquareText, Search, UserCog } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../../components/ui/Table';
import type { UserFeedback } from '../../api/types';
import { AdminBadge, AdminSelect, Card, PriorityBadge, TablePanel } from './components';
import type { Totals } from './types';
import { formatDate, priorityFromFeedback } from './utils';

type Props = {
  totals: Totals;
  feedback: UserFeedback[];
  feedbackQuery: string;
  setFeedbackQuery: (value: string) => void;
  feedbackTypeFilter: string;
  setFeedbackTypeFilter: (value: string) => void;
  priorityFilter: string;
  setPriorityFilter: (value: string) => void;
  feedbackStatus: string;
  setFeedbackStatus: (value: string) => void;
  loading: boolean;
  changeFeedbackStatus: (feedbackId: string, nextStatus: 'new' | 'reviewed' | 'resolved' | 'archived') => void;
};

export default function Feedback({
  totals,
  feedback,
  feedbackQuery,
  setFeedbackQuery,
  feedbackTypeFilter,
  setFeedbackTypeFilter,
  priorityFilter,
  setPriorityFilter,
  feedbackStatus,
  setFeedbackStatus,
  loading,
  changeFeedbackStatus,
}: Props) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card label="Tổng feedback" value={totals.totalFeedback} icon={<MessageSquareText size={16} />} />
        <Card label="Chưa xử lý" value={totals.newFeedback} icon={<Clock3 size={16} />} />
        <Card label="Đang xử lý" value={totals.processingFeedback} icon={<UserCog size={16} />} />
        <Card label="Đã xử lý" value={totals.resolvedFeedback} icon={<CheckCircle2 size={16} />} />
      </div>
      <div className="grid gap-3 rounded-xl border border-[#DDD6EA] bg-white p-3 shadow-sm md:grid-cols-4">
        <Input leftIcon={<Search />} placeholder="Tìm kiếm" value={feedbackQuery} onChange={(event) => setFeedbackQuery(event.target.value)} />
        <AdminSelect value={feedbackTypeFilter} onChange={setFeedbackTypeFilter}>
          <option value="all">Loại feedback</option>
          <option value="chatbot">Chatbot</option>
          <option value="bug">Lỗi hệ thống</option>
          <option value="support">Hỗ trợ</option>
          <option value="general">Chung</option>
        </AdminSelect>
        <AdminSelect value={priorityFilter} onChange={setPriorityFilter}>
          <option value="all">Mức độ ưu tiên</option>
          <option value="high">Cao</option>
          <option value="medium">Trung bình</option>
          <option value="low">Thấp</option>
        </AdminSelect>
        <AdminSelect value={feedbackStatus} onChange={setFeedbackStatus}>
          <option value="all">Trạng thái</option>
          <option value="new">Mới</option>
          <option value="reviewed">Đang xử lý</option>
          <option value="resolved">Đã phản hồi</option>
          <option value="archived">Đã đóng</option>
        </AdminSelect>
      </div>
      <TablePanel loading={loading} empty={!feedback.length} emptyText="Chưa có feedback phù hợp.">
        <Table bare className="min-w-[860px]">
          <TableHead>
            <TableRow className="border-b border-[#DDD6EA] bg-[#F8F7FB] hover:bg-[#F8F7FB]">
              <TableHeaderCell>Người gửi</TableHeaderCell>
              <TableHeaderCell>Nội dung ngắn</TableHeaderCell>
              <TableHeaderCell>Loại</TableHeaderCell>
              <TableHeaderCell>Mức độ</TableHeaderCell>
              <TableHeaderCell>Trạng thái</TableHeaderCell>
              <TableHeaderCell>Ngày gửi</TableHeaderCell>
              <TableHeaderCell className="text-right">Hành động</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {feedback.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <p className="font-bold text-[#111827]">{item.user_name || 'Người dùng'}</p>
                  <p className="text-xs text-[#7C758A]">{item.user_email || item.user_id || 'Không rõ'}</p>
                </TableCell>
                <TableCell className="max-w-[360px]"><p className="line-clamp-2 text-sm text-[#111827]">{item.comment || 'Không có nội dung'}</p></TableCell>
                <TableCell><Badge>{item.feedback_type || 'general'}</Badge></TableCell>
                <TableCell><PriorityBadge priority={priorityFromFeedback(item)} /></TableCell>
                <TableCell><AdminBadge status={item.status} /></TableCell>
                <TableCell className="text-xs text-[#7C758A]">{formatDate(item.created_at)}</TableCell>
                <TableCell className="text-right">
                  <AdminSelect value={item.status} onChange={(value) => changeFeedbackStatus(item.id, value as 'new' | 'reviewed' | 'resolved' | 'archived')}>
                    <option value="new">Mới</option>
                    <option value="reviewed">Đang xử lý</option>
                    <option value="resolved">Đã phản hồi</option>
                    <option value="archived">Đã đóng</option>
                  </AdminSelect>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TablePanel>
    </section>
  );
}
