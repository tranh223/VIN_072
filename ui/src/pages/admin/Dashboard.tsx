import { Activity, Clock3, FileCheck2, MessageSquareText, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Dispatch, SetStateAction } from 'react';
import { Card, AdminBadge, ChartPanel, ListPanel } from './components';
import type { GrowthRange, Totals } from './types';
import type { RagDocument, UserFeedback } from '../../api/types';
import { formatDate, formatDateTime, GROWTH_RANGE_OPTIONS } from './utils';

type Props = {
  totals: Totals;
  feedback: UserFeedback[];
  documents: RagDocument[];
  recentAdminActivity: Array<{ id: string; title: string; type: string; time: string | null }>;
  growthData: Array<{ label: string; key: string; users: number }>;
  growthRange: GrowthRange;
  setGrowthRange: Dispatch<SetStateAction<GrowthRange>>;
};

export default function Dashboard({
  totals,
  feedback,
  documents,
  recentAdminActivity,
  growthData,
  growthRange,
  setGrowthRange,
}: Props) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card label="Tổng user" value={totals.totalUsers} icon={<Users size={16} />} />
        <Card label="User hoạt động" value={totals.activeUsers} icon={<Activity size={16} />} />
        <Card label="Feedback mới" value={totals.newFeedback} icon={<MessageSquareText size={16} />} />
        <Card label="Nội dung cần duyệt" value={totals.pendingContent} icon={<FileCheck2 size={16} />} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.85fr]">
        <ChartPanel
          title="Tăng trưởng người dùng"
          chartClassName="h-36 sm:h-40"
          actions={
            <div className="flex rounded-md border border-[#DDD6EA] bg-[#FAFAFC] p-0.5">
              {GROWTH_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setGrowthRange(option.id)}
                  className={`rounded px-2 py-0.5 text-[10px] font-bold transition-colors ${
                    growthRange === option.id ? 'bg-primary text-white shadow-sm' : 'text-[#7C758A] hover:bg-white hover:text-primary'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={growthData} barCategoryGap="28%">
              <CartesianGrid stroke="#DDD6EA" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                stroke="#7C758A"
                interval={0}
                tick={{ fontSize: 10 }}
              />
              <YAxis stroke="#7C758A" allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="users" name="Người dùng mới" fill="#4F3DD6" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ListPanel title="Danh sách feedback mới nhất">
          {feedback.slice(0, 4).length ? (
            feedback.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-xl border border-[#DDD6EA] bg-[#FAFAFC] p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-bold text-[#111827]">{item.user_name || 'Người dùng'}</p>
                  <AdminBadge status={item.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[#7C758A]">{item.comment || 'Không có nội dung'}</p>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-[#DDD6EA] bg-[#FAFAFC] p-3 text-sm text-[#7C758A]">Chưa có feedback.</p>
          )}
        </ListPanel>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ListPanel title="Nội dung chatbot vừa cập nhật">
          {documents.slice(0, 4).length ? (
            documents.slice(0, 4).map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#DDD6EA] bg-white p-3">
                <div>
                  <p className="font-bold text-[#111827]">{doc.title}</p>
                  <p className="text-xs text-[#7C758A]">{doc.document_type} · {formatDate(doc.updated_at)}</p>
                </div>
                <AdminBadge status={doc.status} />
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-[#DDD6EA] bg-[#FAFAFC] p-3 text-sm text-[#7C758A]">Chưa có nội dung chatbot.</p>
          )}
        </ListPanel>
        <ListPanel title="Nhật ký hoạt động dữ liệu">
          {recentAdminActivity.length ? (
            recentAdminActivity.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 rounded-xl bg-[#FAFAFC] p-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Clock3 size={14} />
                </div>
                <div>
                  <p className="line-clamp-1 text-sm font-bold text-[#111827]">{activity.title}</p>
                  <p className="text-xs text-[#7C758A]">{activity.type} · {formatDateTime(activity.time)}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-[#FAFAFC] p-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Clock3 size={14} />
              </div>
              <p className="text-sm text-[#7C758A]">Chưa có hoạt động dữ liệu.</p>
            </div>
          )}
        </ListPanel>
      </div>
    </section>
  );
}
