import { motion } from 'motion/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  UploadCloud,
  ShoppingBag,
  Music,
  Diamond,
  Store,
  Globe,
  Instagram,
  MapPin,
  MessageCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/Badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '../../components/ui/Table';
import { createStore, getPlatforms, getStores } from '../../api/client';
import type { AuthUser, CreateStorePayload, PlatformSummary, StoreSummary } from '../../api/types';
import { getStoreDossierBadge } from '../../lib/storeDossier';

function platformMeta(code?: string | null) {
  const c = String(code ?? '').toLowerCase();
  if (c.includes('website')) return { icon: Globe, color: 'text-blue-700 bg-blue-100' };
  if (c.includes('facebook')) return { icon: Store, color: 'text-blue-600 bg-blue-100' };
  if (c.includes('zalo')) return { icon: MessageCircle, color: 'text-sky-600 bg-sky-100' };
  if (c.includes('instagram')) return { icon: Instagram, color: 'text-pink-600 bg-pink-100' };
  if (c.includes('offline')) return { icon: MapPin, color: 'text-emerald-700 bg-emerald-100' };
  if (c.includes('shopee')) return { icon: ShoppingBag, color: 'text-orange-600 bg-orange-100' };
  if (c.includes('tiktok')) return { icon: Music, color: 'text-white bg-black' };
  if (c.includes('lazada')) return { icon: Diamond, color: 'text-blue-600 bg-blue-100' };
  return { icon: Store, color: 'text-primary bg-primary/10' };
}

function formatVnd(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return '0 đ';
  return `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(amount)} đ`;
}

function latestRevenueValue(shop: StoreSummary): number {
  const report = shop.latest_report as Record<string, unknown> | null | undefined;
  if (!report) return 0;
  const candidates = [
    report.total_revenue,
    report.net_revenue,
    report.taxable_revenue,
    report.revenue_raw,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate ?? 0);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return 0;
}

function formatUpdatedAt(value?: string | null) {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

type ShopsProps = {
  currentUser?: AuthUser | null;
  onNavigate?: (id: string, search?: string) => void;
};

const emptyForm: CreateStorePayload = {
  user_id: null,
  platform_code: 'website',
  platform_name: 'Website',
  store_name: '',
  store_code: '',
  tax_code: '',
  business_type: 'individual',
};

export default function Shops({ currentUser, onNavigate }: ShopsProps) {
  const [searchParams] = useSearchParams();
  const [shops, setShops] = useState<StoreSummary[]>([]);
  const [platforms, setPlatforms] = useState<PlatformSummary[]>([]);
  const [platformsLoading, setPlatformsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateStorePayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeShopId, setActiveShopId] = useState<string>(() => {
    try {
      return window.localStorage.getItem('scaify_active_store_id') ?? '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    const sid = searchParams.get('store_id');
    if (sid) setActiveShopId(sid);
  }, [searchParams]);

  const loadStores = () => {
    let alive = true;
    void getStores(currentUser?.id)
      .then((data) => {
        if (alive) setShops(data.stores);
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  };

  useEffect(() => {
    return loadStores();
  }, [currentUser?.id]);

  useEffect(() => {
    let alive = true;
    void getPlatforms()
      .then((data) => {
        if (!alive) return;
        setPlatforms(data.platforms);
        const first = data.platforms[0];
        if (first) {
          setForm((current) => {
            const currentExists = data.platforms.some((platform) => platform.code === current.platform_code);
            if (currentExists) return current;
            return {
              ...current,
              platform_code: first.code,
              platform_name: first.name,
            };
          });
        }
      })
      .catch((err: Error) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setPlatformsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      if (activeShopId) window.localStorage.setItem('scaify_active_store_id', activeShopId);
      else window.localStorage.removeItem('scaify_active_store_id');
    } catch {
      // ignore
    }
  }, [activeShopId]);

  const updateForm = <K extends keyof CreateStorePayload>(key: K, value: CreateStorePayload[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const filteredShops = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter((s) => {
      const name = (s.store_name ?? '').toLowerCase();
      const code = (s.store_code ?? '').toLowerCase();
      const platformName = (s.platform?.name ?? '').toLowerCase();
      const platformCode = (s.platform?.code ?? '').toLowerCase();
      return (
        name.includes(q) ||
        code.includes(q) ||
        platformName.includes(q) ||
        platformCode.includes(q)
      );
    });
  }, [shops, query]);

  function shopAlertCount(shop: StoreSummary): number {
    const est = shop.latest_estimation as Record<string, unknown> | null | undefined;
    const cd = est?.calculation_detail as Record<string, unknown> | null | undefined;
    const dash = (cd?.dashboard ?? {}) as Record<string, unknown>;
    const v = Number(dash.alerts_count ?? 0);
    if (Number.isFinite(v) && v >= 0) return v;
    const alerts = cd?.alerts;
    return Array.isArray(alerts) ? alerts.length : 0;
  }

  const submitStore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    if (platformsLoading || platforms.length === 0) {
      setFormError('Chưa tải được danh sách nền tảng.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        user_id: currentUser?.id ?? null,
      };
      const response = await createStore(payload);
      setShops((current) => [response.store, ...current]);
      const nextPlatform = platforms.find((platform) => platform.code === 'website') ?? platforms[0];
      setForm(nextPlatform
        ? { ...emptyForm, platform_code: nextPlatform.code, platform_name: nextPlatform.name }
        : emptyForm);
      setShowCreate(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Không thể thêm shop.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 sm:space-y-8"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" data-product-tour="shops-header">
        <div>
          <h1 className="mb-2 font-display text-2xl font-bold text-on-surface sm:text-3xl">
            Danh mục shop đang kiểm soát
          </h1>
          <p className="text-sm leading-relaxed text-outline">
            Theo dõi doanh thu kỳ gần nhất, tình trạng hồ sơ, cảnh báo và cập nhật cuối cùng theo từng shop.
            Trạng thái và cột « Còn thiếu » dùng cùng checklist với Hồ sơ cuối năm (12 kỳ CSV, ước tính thuế, chứng từ).
          </p>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setShowCreate(true)}>
          Thêm shop
        </Button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-outline-variant bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-outline-variant px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-primary">Thêm shop</h2>
                <p className="text-xs text-outline">Dùng để gắn dữ liệu upload và báo cáo theo từng shop.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-2 text-outline hover:bg-surface hover:text-primary"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <form className="space-y-5 p-5" onSubmit={submitStore}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Tên shop"
                  name="store_name"
                  value={form.store_name}
                  onChange={(e) => updateForm('store_name', e.target.value)}
                  required
                />
                <Input
                  label="Mã shop"
                  name="store_code"
                  value={form.store_code}
                  onChange={(e) => updateForm('store_code', e.target.value)}
                  required
                />
                <Input
                  label="Mã số thuế"
                  name="tax_code"
                  value={form.tax_code ?? ''}
                  onChange={(e) => updateForm('tax_code', e.target.value)}
                />
                <div className="space-y-1.5">
                  <label className="ml-1 font-display text-[10px] font-bold uppercase tracking-widest text-outline">
                    Loại hình kinh doanh
                  </label>
                  <select
                    value={form.business_type}
                    onChange={(e) => updateForm('business_type', e.target.value as CreateStorePayload['business_type'])}
                    className="min-h-11 w-full rounded-xl border border-outline-variant bg-white px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/5"
                  >
                    <option value="individual">Cá nhân / Hộ kinh doanh</option>
                    <option value="company">Công ty</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="ml-1 font-display text-[10px] font-bold uppercase tracking-widest text-outline">
                    Nền tảng
                  </label>
                  <select
                    value={form.platform_code}
                    onChange={(e) => {
                      const selected = platforms.find((platform) => platform.code === e.target.value);
                      updateForm('platform_code', e.target.value);
                      updateForm('platform_name', selected?.name ?? '');
                    }}
                    disabled={platformsLoading || platforms.length === 0}
                    className="min-h-11 w-full rounded-xl border border-outline-variant bg-white px-4 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/5"
                  >
                    {platformsLoading && <option value={form.platform_code}>Đang tải...</option>}
                    {!platformsLoading && platforms.length === 0 && <option value="">Chưa có nền tảng</option>}
                    {!platformsLoading && platforms.map((platform) => (
                      <option key={platform.id} value={platform.code}>
                        {platform.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Tên nền tảng"
                  name="platform_name"
                  value={form.platform_name}
                  readOnly
                  className="bg-surface/40"
                  required
                />
              </div>

              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                  Hủy
                </Button>
                <Button type="submit" disabled={saving || platformsLoading || platforms.length === 0}>
                  {saving ? 'Đang lưu...' : 'Lưu shop'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex min-h-[400px] flex-col overflow-hidden rounded-2xl border border-outline-variant bg-white shadow-sm sm:rounded-3xl sm:min-h-[500px]" data-product-tour="shops-table">
        <div className="flex flex-col gap-4 border-b border-outline-variant bg-surface/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="w-full md:max-w-md">
            <Input
              type="search"
              placeholder="Tìm kiếm shop..."
              leftIcon={<Search className="text-outline" />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <Table bare className="min-w-[920px] rounded-none border-0 shadow-none">
          <TableHead>
            <TableRow className="bg-surface/30 hover:bg-surface/30">
              <TableHeaderCell>Tên cửa hàng</TableHeaderCell>
              <TableHeaderCell>Nền tảng</TableHeaderCell>
              <TableHeaderCell>Doanh thu kỳ gần nhất</TableHeaderCell>
              <TableHeaderCell>Tình trạng hồ sơ</TableHeaderCell>
              <TableHeaderCell>Còn thiếu / cần làm</TableHeaderCell>
              <TableHeaderCell>Cảnh báo</TableHeaderCell>
              <TableHeaderCell>Kỳ gần nhất</TableHeaderCell>
              <TableHeaderCell>Cập nhật lần cuối</TableHeaderCell>
              <TableHeaderCell className="text-right">Thao tác</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-outline">
                  Đang tải dữ liệu cửa hàng...
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredShops.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-sm text-outline">
                  {shops.length === 0
                    ? 'Chưa có shop nào. Bấm “Thêm shop” để bắt đầu.'
                    : 'Không tìm thấy shop phù hợp với từ khóa.'}
                </TableCell>
              </TableRow>
            )}
            {!loading && filteredShops.map((shop) => {
              const meta = platformMeta(shop.platform.code);
              const PlatformIcon = meta.icon;
              const dossierBadge = getStoreDossierBadge(shop);
              const alerts = shopAlertCount(shop);
              const revenue = latestRevenueValue(shop);
              const isActive = activeShopId === shop.id;
              return (
                <TableRow key={shop.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-on-surface">{shop.store_name ?? 'Chưa đặt tên shop'}</div>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          <CheckCircle2 className="size-3.5" /> Đang chọn
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] uppercase tracking-tighter text-outline">
                      ID: {shop.store_code ?? shop.id}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className={`flex size-8 items-center justify-center rounded-lg ${meta.color}`}>
                        <PlatformIcon size={16} />
                      </div>
                      <span className="font-medium">{shop.platform.name ?? 'Chưa có nền tảng'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-on-surface">{formatVnd(revenue)}</div>
                    <div className="text-[11px] text-outline">Tổng từ báo cáo gần nhất</div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={dossierBadge.status} label={dossierBadge.label} />
                  </TableCell>
                  <TableCell className="max-w-xs text-xs text-outline">
                    {dossierBadge.missingItems.length > 0 ? (
                      <ul className="list-inside list-disc space-y-0.5">
                        {dossierBadge.missingItems.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-emerald-700">Không thiếu mục checklist</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {alerts}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-outline">
                    {shop.latest_period ?? 'Chưa có báo cáo'}
                  </TableCell>
                  <TableCell className="text-xs text-outline">
                    {formatUpdatedAt(shop.updated_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-outline transition-all hover:bg-primary/10 hover:text-primary"
                        title="Thêm dữ liệu"
                        aria-label={`Thêm dữ liệu cho ${shop.store_name ?? 'shop'}`}
                        onClick={() => {
                          setActiveShopId(shop.id);
                          onNavigate?.('upload', `store_id=${encodeURIComponent(shop.id)}`);
                        }}
                      >
                        <UploadCloud size={18} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between border-t border-outline-variant bg-surface/30 p-4 text-[11px] font-bold uppercase tracking-wider text-outline sm:p-6">
          <span>
            Hiển thị {filteredShops.length} / {shops.length} shop
          </span>
          {query.trim() && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-primary hover:underline"
            >
              Xóa tìm kiếm
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
