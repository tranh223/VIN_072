import { Activity, Bot, FileUp, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Dispatch, SetStateAction } from 'react';
import type { AdminUserAnalyticsResponse, UserStatsResponse } from '../../api/types';
import { Card, ChartPanel } from './components';
import type { AdminUserRow, GrowthRange, Totals } from './types';
import { GROWTH_RANGE_OPTIONS, statusColor, statusPieData } from './utils';

type Props = {
  totals: Totals;
  analytics: AdminUserAnalyticsResponse | null;
  stats: UserStatsResponse | null;
  users: AdminUserRow[];
  growthData: Array<{ label: string; key: string; users: number }>;
  growthRange: GrowthRange;
  setGrowthRange: Dispatch<SetStateAction<GrowthRange>>;
};

export default function Stats({ totals, analytics, stats, users, growthData, growthRange, setGrowthRange }: Props) {
  const statusData = statusPieData(stats, users);
  const statusTotal = statusData.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card label="Tổng người dùng" value={totals.totalUsers} icon={<Users size={16} />} />
        <Card label="Người dùng hoạt động 7 ngày" value={analytics?.totals.active_users_7d ?? 0} icon={<Activity size={16} />} />
        <Card label="Lượt tải dữ liệu" value={analytics?.totals.data_uploads ?? 0} icon={<FileUp size={16} />} />
        <Card label="Lượt hỏi chatbot" value={analytics?.totals.chatbot_questions ?? 0} icon={<Bot size={16} />} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel
          title="Người dùng mới"
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
              <XAxis dataKey="label" stroke="#7C758A" interval={0} tick={{ fontSize: 10 }} />
              <YAxis stroke="#7C758A" allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="users" name="Người dùng mới" fill="#4F3DD6" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Lượt sử dụng chatbot theo ngày">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analytics?.chatbot_usage ?? []}>
              <CartesianGrid stroke="#DDD6EA" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#7C758A" tick={{ fontSize: 10 }} />
              <YAxis stroke="#7C758A" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="questions" stroke="#4F3DD6" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Top tính năng được dùng nhiều nhất">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics?.feature_usage ?? []} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid stroke="#DDD6EA" strokeDasharray="3 3" />
              <XAxis type="number" stroke="#7C758A" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" stroke="#7C758A" width={100} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#4F3DD6" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
        <ChartPanel title="Tỷ lệ người dùng theo trạng thái">
          <div className="grid h-full gap-3 sm:grid-cols-[1fr_180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip />
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={68}
                  paddingAngle={4}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={statusColor(entry.name)} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col justify-center gap-2 rounded-xl bg-[#FAFAFC] p-3">
              {statusData.map((item) => {
                const percent = statusTotal > 0 ? Math.round((item.value / statusTotal) * 100) : 0;
                return (
                  <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusColor(item.name) }} />
                      <span className="truncate font-bold text-[#111827]">{item.name}</span>
                    </div>
                    <span className="shrink-0 font-mono text-[#7C758A]">{item.value} · {percent}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartPanel>
      </div>
    </section>
  );
}
